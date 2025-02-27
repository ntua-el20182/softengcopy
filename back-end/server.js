require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const { stringify } = require('querystring');
const setupSwagger = require('./swagger');
const { match } = require('assert');
const dayjs = require('dayjs');
const multer = require('multer');
const csvParser = require('csv-parser');
const upload = multer({ dest: 'uploads/' });

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..')));

setupSwagger(app);
const PORT = process.env.PORT || 9115;

const SECRET_KEY = 'your_secret_key';


// Δημιουργία σύνδεσης με τη βάση δεδομένων
const db = mysql.createConnection({
    host: 'localhost',       // ή '127.0.0.1'
    user: 'root',            // Το όνομα χρήστη της MySQL
    password: '--',  // Ο κωδικός χρήστη της MySQL
    database: 'toll_interoperability',        // Το όνομα της βάσης δεδομένων
});

// Σύνδεση με τη βάση δεδομένων
db.connect((err) => {
    if (err) {
        console.error('Σφάλμα σύνδεσης στη MySQL:', err.message);
    } else {
        console.log('Συνδεθήκαμε στη MySQL βάση δεδομένων!');
    }
});

// Ρυθμίσεις για στατική εξυπηρέτηση αρχείων
app.use(express.static(path.join(__dirname, '../front-end'))); // Ανάλογα με τη δομή του φακέλου σου
// Ορισμός διαδρομής για την αρχική σελίδα
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../front-end', 'login.html')); // Δηλώνει το αρχείο login.html
});

const authenticate = (req, res, next) => {
    const token = req.header('X-OBSERVATORY-AUTH'); // Λήψη του token από το custom header

    if (!token) { return res.status(401).json({ error: 'Mη εξουσιοδοτημένος χρήστης!' }); }

    try {
        const decoded = jwt.verify(token, SECRET_KEY); // Επαλήθευση του JWT
        req.user = decoded; // Αποθηκεύουμε τον χρήστη στο request object
        next(); // Συνεχίζουμε
    } catch (error) {
        return res.status(401).json({ error: 'Μη έγκυρο ή ληγμένο token!' });
    }
};

// Helper functions to convert data to CSV format and Date string
function convertToCSV(data) {
    if (!Array.isArray(data) || data.length === 0) {
        return ''; // Αν η λίστα είναι άδεια, επιστρέφει κενό string
    }
    const keys = Object.keys(data[0]); // Τα ονόματα των στηλών
    const csv = [
        keys.join(','), // Γράψτε τα ονόματα των στηλών ως πρώτη γραμμή
        ...data.map(row => keys.map(key => row[key]).join(',')) // Γράψτε τα δεδομένα
    ].join('\n');
    return csv;
}

function convertDate(dateString) {
    if (dateString.length === 8) {
        return dateString.slice(0, 4) + '-' + dateString.slice(4, 6) + '-' + dateString.slice(6, 8);
    } else {
        throw new Error('Η ημερομηνία πρέπει να έχει τη μορφή YYYYMMDD');
    }
}


// Endpoints admin
/**
 * @swagger
 * /api/admin/healthcheck:
 *   get:
 *     summary: Check the health of the server and database
 *     responses:
 *       200:
 *         description: Server and database are healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: OK
 *                 dbconnection:
 *                   type: string
 *                   example: mysql://root@localhost/toll_interoperability
 *                 n_stations:
 *                   type: integer
 *                   example: 10
 *                 n_tags:
 *                   type: integer
 *                   example: 100
 *                 n_passes:
 *                   type: integer
 *                   example: 1000
 *       401:
 *         description: Failed to connect to the database
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: failed
 *                 dbconnection:
 *                   type: string
 *                   example: mysql://root@localhost/toll_interoperability
 */
app.get('/api/admin/healthcheck', authenticate, (req, res) => {
    if (req.user.role != "admin") return res.status(401).json({ error: 'Mη εξουσιοδοτημένος χρήστης!' });
    const connectionString = `mysql://${db.config.user}@${db.config.host}/${db.config.database}`;
    
    const query1 = 'SELECT COUNT(*) AS n_stations FROM toll';
    const query2 = 'SELECT COUNT(*) AS n_tags FROM tag';
    const query3 = 'SELECT COUNT(*) AS n_passes FROM pass';

    db.query(query1, (err1, result1) => {
        if (err1) {
            return res.status(401).json({ status: 'failed', dbconnection: connectionString });
        }
        db.query(query2, (err2, result2) => {
            if (err2) {
                return res.status(401).json({ status: 'failed', dbconnection: connectionString });
            }
            db.query(query3, (err3, result3) => {
                if (err3) {
                    return res.status(401).json({ status: 'failed', dbconnection: connectionString });
                }
                return res.status(200).json({
                    status: 'OK',
                    dbconnection: connectionString,
                    n_stations: result1[0].n_stations,
                    n_tags: result2[0].n_tags,
                    n_passes: result3[0].n_passes
                });
            });
        });
    });
});

/**
 * @swagger
 * /api/admin/resetstations:
 *   post:
 *     summary: Αρχικοποιεί τον πίνακα toll με δεδομένα από το αρχείο tollstations2024.csv
 *     description: >
 *       Διαγράφει (με DELETE) όλες τις εγγραφές του πίνακα `toll`, ώστε να μην μπλοκάρονται από foreign keys.  
 *       Στη συνέχεια φορτώνει τα δεδομένα από το αρχείο `tollstations2024.csv`.  
 *       Για την τιμή της στήλης op_pk χρησιμοποιεί τον operator με primary key = 9 (dummy).  
 *       Σε περίπτωση επιτυχίας, επιστρέφει `{ "status": "OK" }`,  
 *       αλλιώς `{ "status":"failed", "info":"reason" }`.
 *     responses:
 *       200:
 *         description: Επιτυχής ολοκλήρωση
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: OK
 *       204:
 *         description: Το αρχείο CSV είναι κενό
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: failed
 *                 info:
 *                   type: string
 *       401:
 *         description: Unauthorized access, user is not authenticated
 *       500:
 *         description: Σφάλμα διακομιστή/βάσης ή μη εύρεση αρχείου CSV
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: failed
 *                 info:
 *                   type: string
 */
app.post('/api/admin/resetstations', authenticate, (req, res) => {
    if (req.user.role != "admin") return res.status(401).json({ error: 'Mη εξουσιοδοτημένος χρήστης!' });
    const filePath = path.join(__dirname, 'tollstations2024.csv');
  
    // 1) Ελέγχουμε αν υπάρχει το CSV αρχείο
    fs.access(filePath, fs.constants.F_OK, (fileErr) => {
      if (fileErr) {
        return res.status(500).json({
          status: 'failed',
          info: `Αδυναμία εντοπισμού του αρχείου CSV: ${fileErr.message}`
        });
      }
  
      // 2) Διαβάζουμε τις εγγραφές σε πίνακα records
      const records = [];
      fs.createReadStream(filePath)
        .pipe(csvParser()) // Χρησιμοποιούμε csv-parser
        .on('error', (err) => {
          return res.status(500).json({
            status: 'failed',
            info: `Σφάλμα κατά την ανάγνωση του CSV: ${err.message}`
          });
        })
        .on('data', (row) => {
          records.push(row);
        })
        .on('end', () => {
          // Αν δεν υπάρχουν γραμμές στο CSV
          if (records.length === 0) {
            return res.status(204).json({
              status: 'failed',
              info: 'Το αρχείο CSV είναι κενό!'
            });
          }
  
          // 3) Διαγράφουμε όλες τις εγγραφές από τον πίνακα toll
          db.query('DELETE FROM toll', (delErr) => {
            if (delErr) {
              console.error('Σφάλμα στο DELETE FROM toll:', delErr.message);
              return res.status(500).json({
                status: 'failed',
                info: `Αποτυχία διαγραφής δεδομένων από toll: ${delErr.message}`
              });
            }
            
            db.query('ALTER TABLE toll AUTO_INCREMENT = 1;', (modErr) => {
                if (modErr) {
                  console.error('Σφάλμα στο ALTER TABLE toll AUTO_INCREMENT = 1:', delErr.message);
                  return res.status(500).json({
                    status: 'failed',
                    info: `Αποτυχία αλλαγής pk στο toll: ${delErr.message}`
                  });
                } 
  
            const OpIdToPK = { NAO: 1, OO: 2, EG: 3, NO: 4, KO: 5, MO: 6, GE: 7, AM: 8 };
            const cleanedRecords = records.map(record =>
                Object.fromEntries(
                  Object.entries(record).map(([key, value]) => [key.replace(/["']/g, "").trim(), value])
                )
              );
            
            const insertPromises = cleanedRecords.map((r) => {
              return new Promise((resolve, reject) => {
                // Από το CSV: προσαρμόστε τα ονόματα πεδίων/στηλών σύμφωνα με το tollstations2024.csv
                const { OpID, Operator, TollID, Name, PM, Locality, Road, Lat, Long, Email, Price1, Price2, Price3, Price4 } = r;
                // Μετατροπή σε αριθμούς
                const latNum = parseFloat(Lat);
                const longNum = parseFloat(Long);
                const p1 = parseFloat(Price1);
                const p2 = parseFloat(Price2);
                const p3 = parseFloat(Price3);
                const p4 = parseFloat(Price4);

                // Αντιστοίχιση op_pk
                const op_pk = OpIdToPK[OpID] || null;
                const match = Name.match(/^(.*) \((.*)\)$/);
                if (match) { tollName = match[1] + ' '; Dest = match[2]; }
  
                // Αντιστοίχιση: op_pk, toll_id, name, coord_lat, coord_long, dest, locality, road, price1-4
                const insertQuery = `
                  INSERT INTO toll
                    (op_pk, toll_id, name, coord_lat, coord_long,
                     dest, locality, road, price1, price2, price3, price4)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;
                const insertParams = [
                  op_pk,
                  TollID,
                  tollName,
                  latNum,
                  longNum,
                  Dest,        // Εδώ το PM μπαίνει στη στήλη dest, αν αυτό θέλουμε
                  Locality,
                  Road,
                  p1, p2, p3, p4
                ];
  
                db.query(insertQuery, insertParams, (insErr, result) => {
                  if (insErr) {
                    return reject(insErr);
                  }
                  resolve(result);
                });
              });
            });
  
            Promise.all(insertPromises)
              .then(() => {
                // Επιτυχής εισαγωγή
                return res.status(200).json({ status: 'OK' });
              })
              .catch((insError) => {
                console.error('Σφάλμα κατά την εισαγωγή εγγραφών:', insError.message);
                return res.status(500).json({
                  status: 'failed',
                  info: `Αποτυχία εισαγωγής δεδομένων: ${insError.message}`
                });
              });
            });
          });
        });
    });
});

/**
 * @swagger
 * /api/admin/addpasses:
 *   post:
 *     summary: Upload a CSV file and update pass events
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - in: formData
 *         name: file
 *         type: file
 *         required: true
 *         description: CSV file containing pass data
 *     responses:
 *       200:
 *         description: Passes added successfully
 *       400:
 *         description: Invalid file format
 *       401:
 *         description: Unauthorized access, user is not authenticated
 *       500:
 *         description: Server error
 */
app.post('/api/admin/addpasses', upload.single('file'), authenticate, async (req, res) => {
    if (req.user.role != "admin") return res.status(401).json({ error: 'Mη εξουσιοδοτημένος χρήστης!' });
    if (!req.file) { return res.status(400).json({ error: 'No file uploaded' }); }

    const filePath = req.file.path;
    const passes = [];

    fs.createReadStream(filePath)
        .pipe(csvParser({ separator: ',', mapHeaders: ({ header }) => header.trim().replace(/\uFEFF/g, '') }))
        .on('data', (row) => {
            passes.push(row);
        })
        .on('end', async () => {
            fs.unlinkSync(filePath); // Delete file after processing

            try {
                for (const pass of passes) {
                    const { timestamp, tollID, tagRef, tagHomeID, charge } = pass;

                    if (!timestamp || !tollID || !tagRef || !tagHomeID || !charge) {
                        throw new Error('Missing required fields');
                    }

                    // Convert timestamp to MySQL format
                    const [date, time] = timestamp.split(' ');
                    const [year, month, day] = date.split('-');
                    const formattedTimestamp = `${year}-${month}-${day} ${time}:00`;

                    const query1 = `SELECT t.toll_pk FROM toll t WHERE t.toll_id = ?`;
                    const toll_pk = await new Promise((resolve, reject) => {
                        db.query(query1, [tollID], (err, result) => {
                            if (err) {
                                console.error('Σφάλμα κατά την εκτέλεση του query1:', err.message);
                                return reject(new Error('Σφάλμα στη βάση δεδομένων'));
                            }
                            if (result.length === 0) {
                                return reject(new Error('Toll ID not found'));
                            }
                            resolve(result[0].toll_pk);
                        });
                    });
                    const query2 = `SELECT tg.tag_pk FROM tag tg WHERE tg.tag_id = ?`;
                    const tag_pk = await new Promise((resolve, reject) => {
                        db.query(query2, [tagRef], (err, result) => {
                            if (err) {
                                console.error('Σφάλμα κατά την εκτέλεση του query2:', err.message);
                                return reject(new Error('Σφάλμα στη βάση δεδομένων'));
                            }
                            if (result.length === 0) {
                                const query3 = `INSERT INTO tag (tag_id, op_pk) VALUES (?, ?)`;
                                const OpIdToPK = { NAO: 1, OO: 2, EG: 3, NO: 4, KO: 5, MO: 6, GE: 7, AM: 8 };
                                db.query(query3, [tagRef, OpIdToPK[tagHomeID]], (err, result) => {
                                    if (err) return reject(err);
                                    resolve(result.insertId);
                                });
                            } else {
                                resolve(result[0].tag_pk);
                            }
                        });
                    });

                    const query = `INSERT INTO pass (toll_pk, tag_pk, amount, date_occured) VALUES (?, ?, ?, ?)`;
                    await new Promise((resolve, reject) => {
                        db.query(query, [toll_pk, tag_pk, charge, formattedTimestamp], (err, result) => {
                            if (err) return reject(err);
                            resolve(result);
                        });
                    });
                }

                res.status(200).json({ message: 'Passes added successfully' });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        })
        .on('error', (error) => {
            res.status(500).json({ error: 'Error reading CSV file' });
        });
});

/**
 * @swagger
 * /api/admin/changePass:
 *   post:
 *     summary: Change the password of a user
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized access, user is not authenticatedf
 *       500:
 *         description: Server error
 */
app.post('/api/admin/changePass', authenticate, (req, res) => {
    if (req.user.role !== 'admin') return res.status(401).json({ error: 'Μη εξουσιοδοτημένος (admin only)' });

    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Απαιτούνται username & password' });
    }

    // Έλεγχος αν υπάρχει ο χρήστης
    const checkQuery = 'SELECT * FROM user WHERE username = ?';
    db.query(checkQuery, [username], (err, results) => {
      if (err) {
        console.error('Σφάλμα DB (usermod-check):', err.message);
        return res.status(500).json({ error: 'Σφάλμα DB' });
      }

      if (results.length > 0) {
        // Υπάρχει ο χρήστης => Update μόνο το password
        const updateQ = 'UPDATE user SET password = ? WHERE username = ?';
        db.query(updateQ, [password, username], (uErr, uRes) => {
          if (uErr) {
            console.error('Σφάλμα Update user:', uErr.message);
            return res.status(500).json({ error: 'Σφάλμα DB (update)' });
          }
          // OK
          return res.status(200).json({ status: 'updated' });
        });
      } else
        return res.status(204).send({ error: 'Δεν βρέθηκαν εγγραφές!' });
    });
});

/**
 * @swagger
 * /api/admin/de-activate:
 *   post:
 *     summary: (De)Activation of a user
 *     responses:
 *       200:
 *         description: User (de)activated successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized access, user is not authenticatedf
 *       500:
 *         description: Server error
 */
app.post('/api/admin/de-activate', authenticate, (req, res) => {
    if (req.user.role !== 'admin') return res.status(401).json({ error: 'Μη εξουσιοδοτημένος (admin only)' });

    const { username, status } = req.body;

    if (!username || !status) {
      return res.status(400).json({ error: 'Απαιτούνται username & status' });
    }
    const activate = status === 'Y' ? 1 : 0;

    // Έλεγχος αν υπάρχει ο χρήστης
    const checkQuery = 'SELECT * FROM user WHERE username = ?';
    db.query(checkQuery, [username], (err, results) => {
      if (err) {
        console.error('Σφάλμα DB (usermod-check):', err.message);
        return res.status(500).json({ error: 'Σφάλμα DB' });
      }

      if (results.length > 0) {
        // Υπάρχει ο χρήστης => Update μόνο το password
        const updateQ = 'UPDATE user SET active = ? WHERE username = ?';
        db.query(updateQ, [activate, username], (uErr, uRes) => {
          if (uErr) {
            console.error('Σφάλμα Update user:', uErr.message);
            return res.status(500).json({ error: 'Σφάλμα DB (update)' });
          }
          // OK
          return res.status(200).json({ status: 'updated' });
        });
      } else
        return res.status(204).send({ error: 'Δεν βρέθηκαν εγγραφές!' });
    });
});

/**
 * @swagger
 * /api/admin/allUers:
 *   get:
 *     summary: Get a list of all usernames
 *     responses:
 *       200:
 *         description: Data retrieved successfully
 *       401:
 *         description: Unauthorized access, user is not authenticatedf
 *       500:
 *         description: Server error
 */
app.get('/api/admin/allUsers', authenticate, (req, res) => {
    if (req.user.role != "admin") return res.status(401).json({ error: 'Mη εξουσιοδοτημένος χρήστης!' });
    const format = req.query.format || 'json';

    // Query 1: Ανάκτηση στοιχείων του σταθμού (toll station)
    const query = 'SELECT username FROM user';
    db.query(query, [], (err, results) => {
        if (err) {
            console.error('Σφάλμα κατά την εκτέλεση του query1:', err.message);
            return res.status(500).send({ error: 'Σφάλμα στη βάση δεδομένων' });
        }
        if (results.length === 0) {
            return res.status(204).send();
        }

        // Επιστροφή σε CSV ή JSON
        if (format === 'csv') {
            const csvData = convertToCSV(results);
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename="allUsers.csv"');
            return res.status(200).send('\uFEFF' + csvData);
        } else {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            return res.status(200).json(results);
        }
    });
});

/**
 * @swagger
 * /api/admin/resetpasses:
 *   post:
 *     summary: Reset all pass events and dependent data
 *     description: >
 *       Διαγράφει τα δεδομένα από τους πίνακες pass, tag και αφαιρεί όλους τους
 *       μη-admin χρήστες. Επαναφέρει τα στοιχεία του admin σε προκαθορισμένη τιμή.
 *       Χρησιμοποιούνται εντολές DELETE αντί για TRUNCATE, ώστε να μην εμποδίζονται από foreign keys.
 *     responses:
 *       200:
 *         description: Successful reset
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: OK
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: failed
 *                 info:
 *                   type: string
 *                   example: reason
 */
app.post('/api/admin/resetpasses', authenticate, (req, res) => {
    if (req.user.role != "admin") res.status(401).json({ error: 'Mη εξουσιοδοτημένος χρήστης!' });
    // 1) Oι εντολές που θέλουμε να εκτελέσουμε, κατά σειρά
    const resetQueries = [
      'DELETE FROM pass',
      'ALTER TABLE pass AUTO_INCREMENT = 1',
      'DELETE FROM tag',
      'ALTER TABLE tag AUTO_INCREMENT = 1',
      'UPDATE user SET password = "freepasses4all", username = "admin" WHERE role = "admin"'
    ];
  
    // 2) Έναρξη συναλλαγής
    db.beginTransaction(err => {
      if (err) {
        console.error('Σφάλμα κατά την έναρξη της συναλλαγής:', err.message);
        return res.status(500).json({ status: 'failed', info: 'Σφάλμα στο beginTransaction' });
      }
  
      let currentIndex = 0; // Δείκτης για το query που τρέχουμε τώρα
      const total = resetQueries.length;
  
      // Συνάρτηση που τρέχει το επόμενο query
      function runNextQuery() {
        // Αν έχουμε τελειώσει όλα τα queries, κάνουμε commit
        if (currentIndex >= total) {
          db.commit(commitErr => {
            if (commitErr) {
              console.error('Σφάλμα κατά την επιβεβαίωση της συναλλαγής:', commitErr.message);
              return db.rollback(() => {
                return res.status(500).json({ status: 'failed', info: 'Σφάλμα στο commit' });
              });
            }
            // Επιτυχία
            return res.status(200).json({ status: 'OK' });
          });
          return; 
        }
  
        // Παίρνουμε το query τρέχοντος index
        const query = resetQueries[currentIndex];
        db.query(query, (qe) => {
          if (qe) {
            console.error(`Σφάλμα κατά την εκτέλεση του query #${currentIndex + 1}:`, qe.message);
            return db.rollback(() => {
              return res.status(500).json({ 
                status: 'failed', 
                info: `Σφάλμα στο query #${currentIndex + 1}`
              });
            });
          }
          // Αν δεν υπήρξε σφάλμα, προχωράμε στο επόμενο
          currentIndex++;
          runNextQuery();
        });
      }
  
      // 3) Εκκίνηση της αλληλουχίας queries
      runNextQuery();
    });
});

/**
 * @swagger
 * /api/admin/new_user:
 *   post:
 *     summary: Create a new user
 *     description: >
 *       Δημιουργεί έναν νέο χρήστη με τα δεδομένα που παρέχονται στο σώμα του αιτήματος.
 *       Επιστρέφει μήνυμα επιτυχίας ή αποτυχίας.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: John Doe
  *               username:
 *                 type: string
 *                 example: johndoe
 *               password:
 *                 type: string
 *                 example: password123
 *               role:
 *                 type: string
 *                 example: admin
 *               email:
 *                 type: string
 *                 example: johndoe@example.com
 *               op_primaryKey:
 *                 type: integer
 *                 example: 1
 *     responses:
 *       200:
 *         description: Ο χρήστης προστέθηκε με επιτυχία!
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Ο χρήστης προστέθηκε με επιτυχία!
 *       400:
 *         description: Απαιτούνται όλα τα δεδομένα!
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Απαιτούνται όλα τα δεδομένα!
 *       500:
 *         description: Σφάλμα στη βάση δεδομένων
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Σφάλμα στη βάση δεδομένων
 */
app.post('/api/admin/new_user', authenticate, (req, res) => {
    if (req.user.role != "admin") return res.status(401).json({ error: 'Mη εξουσιοδοτημένος χρήστης!' });
    const { name, username, password, role, email, op_primaryKey } = req.body;
    const op_pk = op_primaryKey ? parseInt(op_primaryKey) : null;
    if (!username || username.trim() === '' || !password || password.trim() === '' || !name || name.trim() === '' ||
        !role || role.trim() === '' || !email || email.trim() === '' || (role === "op_user" && isNaN(op_pk)))
           return res.status(400).json({ error: 'Απαιτούνται όλα τα δεδομένα!' });

    const query = 'INSERT INTO user (u_name, username, password, role, email, op_pk) VALUES (?, ?, ?, ?, ?, ?)';
    db.query(query, [name.trim(), username.trim(), password, role.trim(), email.trim(), op_pk], (err, results) => {
        if (err) {
            console.error('Σφάλμα κατά την εισαγωγή χρήστη:', err.message);
            return res.status(500).send({ error: 'Σφάλμα στη βάση δεδομένων' });
        } else {
            if (results.length === 0) {
                return res.status(204).json({ error: 'Κάτι πήγε λάθος!' });
            }
            
            return res.status(200).json({ message: 'Ο χρήστης προστέθηκε με επιτυχία!' });
        }
    });
})

// Endpoints εκφώνησης
/**
 * @swagger
 * /api/tollStationPasses/{tollStationID}/{date_from}/{date_to}:
 *   get:
 *     summary: Retrieve the passes for toll with <tollStationID> from <date_from> to <date_to>
 *     parameters:
 *       - in: path
 *         name: tollStationID
 *         required: true
 *         schema:
 *           type: string
 *         description: Id of Toll Station
 *       - in: path
 *         name: date_from
 *         required: true
 *         schema:
 *           type: string
 *         description: The date in YYYYMMDD format
 *       - in: path
 *         name: date_to
 *         required: true
 *         schema:
 *           type: string
 *         description: The date in YYYYMMDD format
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *         description: Response format (default is json)
 *     responses:
 *       200:
 *         description: Successful retrieval of passes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 stationID:
 *                   type: string
 *                 stationOperator:
 *                   type: string
 *                 requestTimestamp:
 *                   type: string
 *                 periodFrom:
 *                   type: string
 *                 periodTO:
 *                   type: string
 *                 nPasses: 
 *                   type: integer
 *                 passList:
 *                   type: array 
 *                   items:
 *                     type: object
 *                     properties:
 *                       pass_index:
 *                         type: integer
 *                       passID:
 *                         type: string
 *                       timestamp:
 *                         type: string
 *                       tagID:
 *                         type: string
 *                       tagProvider:
 *                         type: string
 *                       passType:
 *                         type: string
 *                       passCharge:
 *                         type: string
 *           text/csv:
 *             schema:
 *               type: string
 *               description: CSV formatted response
 *       204:
 *         description: No content
 *       400:
 *         description: Bad request
 *       500:
 *         description: Internal server error
 */
app.get('/api/tollStationPasses/:tollStationID/:date_from/:date_to', (req, res) => {
    const format = req.query.format || 'json';
    if (format != "json" && format != "csv") return res.status(400).json({ error: 'Λάθος format!' });

    const tollStationID = req.params.tollStationID;
    const date_from = req.params.date_from;
    const date_to = req.params.date_to;
    const dateRegex = /^\d{8}$/;

    const opIDs = ["NAO", "OO", "EG", "NO", "KO", "AM", "MO", "GE"];
    if (!opIDs.some(prefix => tollStationID.startsWith(prefix))) {
        return res.status(400).json({ error: 'Η τιμή των opIDs δεν είναι σωστή!' });
    }
    
    // Έλεγχος για την ύπαρξη και τη μη κενή τιμή των παραμέτρων
    if (!tollStationID || tollStationID.trim() === '' ||
        !date_from || date_from.trim() === '' ||
        !date_to || date_to.trim() === '')
        return res.status(400).json({ error: 'Απαιτούνται όλες οι παράμετροι!' });

    // Έλεγχος ότι οι ημερομηνίες έχουν τη μορφή YYYYMMDD
    if (!dateRegex.test(date_from) || !dateRegex.test(date_to))
        return res.status(400).json({ error: 'Η ημερομηνία πρέπει να είναι της μορφής YYYYMMDD!' });
    
    // Query 1: Ανάκτηση στοιχείων του σταθμού (toll station)
    let query1 = `
        SELECT o.op_name, t.toll_pk 
        FROM toll t 
        INNER JOIN operator o ON t.op_pk = o.op_pk 
        WHERE t.toll_id = ?
    `;

    db.query(query1, [tollStationID], (err, tollResults) => {
        if (err) {
            console.error('Σφάλμα κατά την εκτέλεση του query1:', err.message);
            return res.status(500).send({ error: 'Σφάλμα στη βάση δεδομένων' });
        }
        if (tollResults.length === 0)
            return res.status(204).send();
        // Λαμβάνουμε το toll_pk από το πρώτο αποτέλεσμα
        const toll_pk = tollResults[0].toll_pk;

        // Query 2: Ανάκτηση των διελεύσεων (passes) εντός του εύρους ημερομηνιών για το συγκεκριμένο toll
        let query2 = `
            SELECT p.pass_id, p.date_occured, tg.tag_id, o.op_name, p.amount 
            FROM pass p 
            INNER JOIN toll t ON t.toll_pk = p.toll_pk 
            INNER JOIN tag tg ON p.tag_pk = tg.tag_pk
            INNER JOIN operator o ON o.op_pk = tg.op_pk 
            WHERE t.toll_pk = ? AND p.date_occured BETWEEN ? AND ?
        `;
        
        db.query(query2, [toll_pk, date_from, date_to], (err, passesResults) => {
            if (err) {
                console.error('Σφάλμα κατά την εκτέλεση του query2:', err.message);
                return res.status(500).send({ error: 'Σφάλμα στη βάση δεδομένων' });
            }
            // Αν δεν βρέθηκαν διέλευσεις, επιστρέφουμε 204 (No Content)
            if (passesResults.length === 0)
                return res.status(204).send();
            
            // Ετοιμάζουμε τα δεδομένα απάντησης, συμπεριλαμβάνοντας και τις πληροφορίες του σταθμού
            const responseData = {
                stationID: tollStationID,
                stationOperator: tollResults[0].op_name,
                requestTimestamp: dayjs().format('YYYY-MM-DD HH:mm'),
                periodFrom: dayjs(date_from, 'YYYYMMDD').format('YYYY-MM-DD 00:00'),
                periodTo: dayjs(date_to, 'YYYYMMDD').format('YYYY-MM-DD 23:59'),
                nPasses: passesResults.length,
                passList: passesResults.map((pass, index) => ({
                    passIndex: index + 1, // Δημιουργεί αύξοντα αριθμό
                    passID: pass.pass_id,
                    timestamp: dayjs(pass.date_occured).format('YYYY-MM-DD HH:mm'),
                    tagID: pass.tag_id,
                    tagProvider: pass.op_name,
                    passType: pass.op_name === tollResults[0].op_name ? 'home' : 'visitor', // Check if stationID equals stationOperator
                    passCharge: pass.amount
                }))
            };

            if (format === 'csv') {
                const csvData = convertToCSV(responseData.passList);
                res.setHeader('Content-Type', 'text/csv; charset=utf-8');
                res.setHeader('Content-Disposition', 'attachment; filename="tollStationPasses.csv"');
                return res.status(200).send('\uFEFF' + csvData);
            } else {
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                return res.status(200).json(responseData);
            }
        });
    });
});

/**
 * @swagger
 * /api/passAnalysis/{stationOpID}/{tagOpID}/{date_from}/{date_to}:
 *   get:
 *     summary: Επιστρέφει γεγονότα διέλευσης σταθμών με tag του tagOpID σε σταθμούς του stationOpID, μεταξύ date_from και date_to
 *     parameters:
 *       - in: path
 *         name: stationOpID
 *         required: true
 *         schema:
 *           type: string
 *         description: Το ID του λειτουργού (operator) του σταθμού
 *       - in: path
 *         name: tagOpID
 *         required: true
 *         schema:
 *           type: string
 *         description: Το ID του λειτουργού (operator) που εξέδωσε το tag
 *       - in: path
 *         name: date_from
 *         required: true
 *         schema:
 *           type: string
 *         description: Ημερομηνία έναρξης σε μορφή YYYYMMDD
 *       - in: path
 *         name: date_to
 *         required: true
 *         schema:
 *           type: string
 *         description: Ημερομηνία λήξης σε μορφή YYYYMMDD
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *         description: Μορφή απόκρισης (προεπιλογή είναι json)
 *     responses:
 *       200:
 *         description: Επιτυχής επιστροφή γεγονότων διέλευσης
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 stationOpID:
 *                   type: string
 *                 tagOpID:
 *                   type: string
 *                 requestTimestamp:
 *                   type: string
 *                 periodFrom:
 *                   type: string
 *                 periodTo:
 *                   type: string
 *                 nPasses:
 *                   type: integer
 *                 passList:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       passIndex:
 *                         type: integer
 *                       passID:
 *                         type: string
 *                       stationID:
 *                         type: string
 *                       timestamp:
 *                         type: string
 *                       tagID:
 *                         type: string
 *                       passCharge:
 *                         type: number
 *           text/csv:
 *             schema:
 *               type: string
 *               description: Αρχείο CSV με τα δεδομένα απόκρισης
 *       204:
 *         description: Δεν βρέθηκαν γεγονότα διέλευσης
 *       400:
 *         description: Εσφαλμένο αίτημα (ελλιπείς/μη έγκυρες παράμετροι)
 *       500:
 *         description: Εσωτερικό σφάλμα διακομιστή
 */
app.get('/api/passAnalysis/:stationOpID/:tagOpID/:date_from/:date_to', (req, res) => {
    const format = req.query.format || 'json';
    if (format != "json" && format != "csv") return res.status(400).json({ error: 'Λάθος format!' });

    const stationOpID = req.params.stationOpID;
    const tagOpID = req.params.tagOpID;
    const date_from = req.params.date_from;
    const date_to = req.params.date_to;
    
    // Απλός έλεγχος εγκυρότητας
    const dateRegex = /^\d{8}$/;
    if (!stationOpID || !tagOpID || !date_from || !date_to) {
      return res.status(400).json({ error: 'Απαιτούνται όλες οι παράμετροι!' });
    }
    const opIDs = ["NAO", "OO", "EG", "NO", "KO", "AM", "MO", "GE"];
    if (!opIDs.includes(stationOpID) || !opIDs.includes(tagOpID)) {
        return res.status(400).json({ error: 'Η τιμή των opIDs δεν είναι σωστή!' });
    }
    if (!dateRegex.test(date_from) || !dateRegex.test(date_to)) {
      return res.status(400).json({ error: 'Η ημερομηνία πρέπει να είναι της μορφής YYYYMMDD!' });
    }
  
    // 1) Εύρεση του operator PK (op_pk) για το stationOpID
    const queryOpStation = 'SELECT op_pk FROM operator WHERE op_id = ?';
    db.query(queryOpStation, [stationOpID], (err, stationOpResults) => {
      if (err) {
        console.error('Σφάλμα κατά την εκτέλεση του queryOpStation:', err.message);
        return res.status(500).json({ error: 'Σφάλμα στη βάση δεδομένων' });
      }
      if (stationOpResults.length === 0) {
        return res.status(204).json({ error: 'Δεν βρέθηκε operator με το given stationOpID!' });
      }
      const stationOpPK = stationOpResults[0].op_pk;
  
      // 2) Εύρεση του operator PK (op_pk) για το tagOpID
      const queryOpTag = 'SELECT op_pk FROM operator WHERE op_id = ?';
      db.query(queryOpTag, [tagOpID], (err, tagOpResults) => {
        if (err) {
          console.error('Σφάλμα κατά την εκτέλεση του queryOpTag:', err.message);
          return res.status(500).json({ error: 'Σφάλμα στη βάση δεδομένων' });
        }
        if (tagOpResults.length === 0) {
          return res.status(204).json({ error: 'Δεν βρέθηκε operator με το given tagOpID!' });
        }
        const tagOpPK = tagOpResults[0].op_pk;
  
        // 3) Ανάκτηση γεγονότων διέλευσης με:
        //    - p.toll_pk -> toll του οποίου το op_pk == stationOpPK
        //    - p.tag_pk -> tag του οποίου το op_pk == tagOpPK
        //    - date_occured ανάμεσα σε date_from και date_to
        const queryPasses = `
          SELECT p.pass_id, p.date_occured, t.toll_id AS stationID, tg.tag_id AS tagID, p.amount
          FROM pass p
          JOIN toll t      ON p.toll_pk = t.toll_pk
          JOIN tag tg      ON p.tag_pk  = tg.tag_pk
          WHERE t.op_pk   = ? 
            AND tg.op_pk  = ?
            AND p.date_occured BETWEEN ? AND ?
          ORDER BY p.date_occured ASC
        `;
        db.query(queryPasses, [stationOpPK, tagOpPK, date_from, date_to], (err, passResults) => {
          if (err) {
            console.error('Σφάλμα κατά την εκτέλεση του queryPasses:', err.message);
            return res.status(500).json({ error: 'Σφάλμα στη βάση δεδομένων' });
          }
          if (passResults.length === 0) {
            // Δεν βρέθηκαν σχετικές διελεύσεις
            return res.status(204).send();
          }
  
          // Δημιουργούμε το αντικείμενο απόκρισης
          const responseData = {
            stationOpID: stationOpID,
            tagOpID: tagOpID,
            requestTimestamp: dayjs().format('YYYY-MM-DD HH:mm'),
            periodFrom: dayjs(date_from, 'YYYYMMDD').format('YYYY-MM-DD 00:00'),
            periodTo: dayjs(date_to, 'YYYYMMDD').format('YYYY-MM-DD 23:59'),
            nPasses: passResults.length,
            passList: passResults.map((p, index) => ({
              passIndex: index + 1,
              passID: p.pass_id,
              stationID: p.stationID,
              timestamp: dayjs(p.date_occured).format('YYYY-MM-DD HH:mm'),
              tagID: p.tagID,
              passCharge: p.amount
            }))
          };
  
          // Επιστρέφουμε είτε JSON είτε CSV
          if (format === 'csv') {
            const csvData = convertToCSV(responseData.passList);
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename="passAnalysis.csv"');
            return res.status(200).send('\uFEFF' + csvData);
          } else {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            return res.status(200).json(responseData);
          }
        });
      });
   });
});

/**
 * @swagger
 * /api/passesCost/{tollOpID}/{tagOpID}/{date_from}/{date_to}:
 *   get:
 *     summary: Retrieve the passes by tag <tagOpID> for the tolls belonging to operator <tollOpID>
 *     parameters:
 *       - in: path
 *         name: tollOpID
 *         required: true
 *         schema:
 *           type: string
 *         description: Id of Operator 
 *       - in: path
 *         name: tagOpID
 *         required: true
 *         schema:
 *           type: string
 *         description: Id of Operator 
 *       - in: path
 *         name: date_from
 *         required: true
 *         schema:
 *           type: string
 *         description: The date in YYYYMMDD format
 *       - in: path
 *         name: date_to
 *         required: true
 *         schema:
 *           type: string
 *         description: The date in YYYYMMDD format
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *         description: Response format (default is json)
 *     responses:
 *       200:
 *         description: Successful retrieval of charges
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tollOpID:
 *                   type: string
 *                 tagOpID:
 *                   type: string
 *                 requestTimestamp:
 *                   type: string
 *                 periodFrom:
 *                   type: string
 *                 periodTO:
 *                   type: string
 *                 nPasses:
 *                   type: integer
 *                 passesCost:
 *                   type: float 
 *           text/csv:
 *             schema:
 *               type: string
 *               description: CSV formatted response
 *       204:
 *         description: No content
 *       400:
 *         description: Bad request
 *       500:
 *         description: Internal server error
 */
app.get('/api/passesCost/:tollOpID/:tagOpID/:date_from/:date_to', (req, res) => {
    const format = req.query.format || 'json';
    if (format != "json" && format != "csv") return res.status(400).json({ error: 'Λάθος format!' });

    const { tollOpID, tagOpID, date_from, date_to } = req.params;
    const opIDs = ["NAO", "OO", "EG", "NO", "KO", "AM", "MO", "GE"];
    if (!opIDs.includes(tollOpID) || !opIDs.includes(tagOpID)) {
        return res.status(400).json({ error: 'Η τιμή των opIDs δεν είναι σωστή!' });
    }

    const query = `
        SELECT COUNT(*) AS nPasses, SUM(p.amount) AS passesCost 
        FROM pass p
        JOIN toll t ON p.toll_pk = t.toll_pk 
        JOIN tag tg ON p.tag_pk = tg.tag_pk
        JOIN operator o1 ON tg.op_pk = o1.op_pk
        JOIN operator o2 ON t.op_pk = o2.op_pk 
        WHERE o1.op_id = ? AND o2.op_id = ?
        AND p.date_occured BETWEEN ? AND ?
    `;

    db.query(query, [tollOpID, tagOpID, date_from, date_to], (err, results) => {
        if (err) {
            console.error('Σφάλμα κατά την εκτέλεση του query:', err.message);
            return res.status(500).send({ error: 'Σφάλμα στη βάση δεδομένων' });
        }
        
        if (results.length === 0 || results[0].nPasses === 0) {
            return res.status(204).send({ error: 'Δεν βρέθηκαν εγγραφές!' });
        }
        
        const response = {
            tollOpID: tollOpID,
            tagOpID: tagOpID,
            requestTimestamp: dayjs().format('YYYY-MM-DD HH:mm'),
            periodFrom: dayjs(date_from, 'YYYYMMDD').format('YYYY-MM-DD 00:00'),
            periodTo: dayjs(date_to, 'YYYYMMDD').format('YYYY-MM-DD 23:59'),
            nPasses: results[0].nPasses,
            passesCost: results[0].passesCost || 0
        };
        
        if (format === 'csv') {
            const csvData = convertToCSV(response);
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename="passesCost.csv"');
            return res.status(200).send('\uFEFF' + csvData);
        } else {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            return res.status(200).json(response);
        }
    });
});  

/**
 * @swagger
 * /api/chargesBy/{tollOpID}/{date_from}/{date_to}:
 *   get:
 *     summary: Retrieve the charges for the tolls belonging to operator <tollOpID>
 *     parameters:
 *       - in: path
 *         name: tollOpID
 *         required: true
 *         schema:
 *           type: string
 *         description: Id of Operator 
 *       - in: path
 *         name: date_from
 *         required: true
 *         schema:
 *           type: string
 *         description: The date in YYYYMMDD format
 *       - in: path
 *         name: date_to
 *         required: true
 *         schema:
 *           type: string
 *         description: The date in YYYYMMDD format
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *         description: Response format (default is json)
 *     responses:
 *       200:
 *         description: Successful retrieval of charges
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tollOpID:
 *                   type: string
 *                 requestTimestamp:
 *                   type: string
 *                 periodFrom:
 *                   type: string
 *                 periodTO:
 *                   type: string
 *                 vOpList:
 *                   type: array 
 *                   items:
 *                     type: object
 *                     properties:
 *                       visitingOpID:
 *                         type: string
 *                       nPasses:
 *                         type: integer
 *                       passesCost:
 *                         type: string
 *           text/csv:
 *             schema:
 *               type: string
 *               description: CSV formatted response
 *       204:
 *         description: No content
 *       400:
 *         description: Bad request
 *       500:
 *         description: Internal server error
 */
app.get('/api/chargesBy/:tollOpID/:date_from/:date_to', (req, res) => {
    const format = req.query.format || 'json';
    if (format != "json" && format != "csv") return res.status(400).json({ error: 'Λάθος format!' });

    const tollOpID = req.params.tollOpID;
    const date_from = req.params.date_from;
    const date_to = req.params.date_to;
    const dateRegex = /^\d{8}$/;
    
    // Έλεγχος για την ύπαρξη και τη μη κενή τιμή των παραμέτρων
    if (!tollOpID || tollOpID.trim() === '' ||
        !date_from || date_from.trim() === '' ||
        !date_to || date_to.trim() === '')
        return res.status(400).json({ error: 'Απαιτούνται όλες οι παράμετροι!' });

    const opIDs = ["NAO", "OO", "EG", "NO", "KO", "AM", "MO", "GE"];
    if (!opIDs.includes(tollOpID)) {
        return res.status(400).json({ error: 'Η τιμή των opIDs δεν είναι σωστή!' });
    }

    // Έλεγχος ότι οι ημερομηνίες έχουν τη μορφή YYYYMMDD
    if (!dateRegex.test(date_from) || !dateRegex.test(date_to))
        return res.status(400).json({ error: 'Η ημερομηνία πρέπει να είναι της μορφής YYYYMMDD!' });
    
    let query = `
        SELECT o1.op_id as visitingOpID, count(*) as passes_count, sum(p.amount) as total_charges
        FROM pass p
        INNER JOIN toll t ON t.toll_pk = p.toll_pk
        INNER JOIN tag tg ON p.tag_pk = tg.tag_pk
        INNER JOIN operator o1 ON o1.op_pk = tg.op_pk
        INNER JOIN operator o2 ON o2.op_pk = t.op_pk
        WHERE o2.op_id = ? AND o1.op_pk <> o2.op_pk AND p.date_occured BETWEEN ? AND ?
        GROUP BY o1.op_id
    `;

    db.query(query, [tollOpID, date_from, date_to], (err, passesResults) => {
        if (err) {
            console.error('Σφάλμα κατά την εκτέλεση του query1:', err.message);
            return res.status(500).send({ error: 'Σφάλμα στη βάση δεδομένων' });
        }
        
        // Αν δεν βρέθηκαν διέλευσεις, επιστρέφουμε 204 (No Content)
        if (passesResults.length === 0)
            return res.status(204).send();

        const responseData = {
            tollOpID: tollOpID,
            requestTimestamp: dayjs().format('YYYY-MM-DD HH:mm'),
            periodFrom: dayjs(date_from, 'YYYYMMDD').format('YYYY-MM-DD 00:00'),
            periodTo: dayjs(date_to, 'YYYYMMDD').format('YYYY-MM-DD 23:59'),
            vOpList: passesResults.map(row => ({
                visitingOpID: row.visitingOpID,
                nPasses: row.passes_count,
                passesCost: row.total_charges
            }))
        }

        if (format === 'csv') {
                const csvData = convertToCSV(responseData.vOpList);
                res.setHeader('Content-Type', 'text/csv; charset=utf-8');
                res.setHeader('Content-Disposition', 'attachment; filename="chargesBy.csv"');
                return res.status(200).send('\uFEFF' + csvData);
        } else {
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                return res.status(200).json(responseData);
        }
    });
});



// Ρούτες για στατιστικά εταιριών
/**
 * @swagger
 * /api/payment_delay/{date_range}:
 *   get:
 *     summary: Retrieve the filtered payment delays history to the company
 *     description: >
 *       Returns the payment delays history for the company, grouped by debtor_name.
 *       For each debtor, a list is returned containing the date when the charge was created
 *       and the number of days the payment was delayed.
 *     parameters:
 *       - in: path
 *         name: date_range
 *         required: true
 *         schema:
 *           type: string
 *         description: The date range in YYYYMMDD-YYYYMMDD format
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *         description: Response format (default is json)
 *     responses:
 *       200:
 *         description: Successful retrieval of filtered payment delays history
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   debtor_name:
 *                     type: string
 *                   payment_delays:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         date_created:
 *                           type: string
 *                         delay_days:
 *                           type: integer 
 *           text/csv:
 *             schema:
 *               type: string
 *               description: CSV formatted response
 *       204:
 *         description: No content
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized access, user is not authenticated
 *       500:
 *         description: Internal server error
 */
app.get('/api/payment_delay/:date_range', authenticate, (req, res) => {
    const format = req.query.format || 'json';
    try{
        const company = req.user.operator;
        if (company === null || company === undefined) 
            return res.status(400).json({ error: 'Δεν είστε χρήστης που ανήκει σε εταιρία!' });

        const date_range = req.params.date_range;
        if (!date_range || date_range.trim() === '')
            return res.status(400).json({ error: 'Απαιτούνται όλες οι παράμετροι!' });
        
        /* Αρχικοποίηση του query */
        let query = 'SELECT o.op_name AS debtor_name, c.date_created, DATEDIFF(c.date_paid, c.date_created) AS delay_days ' +
                    'FROM charges c LEFT JOIN operator o ON c.debtor_id = o.op_pk WHERE ' +
                    'c.status IN ("paid", "confirmed") AND c.creditor_id = ?';
        let params = [company];

        /* Πέρασμα εύρους ημερομηνιών του φίλτρου */
        let match = date_range.match(/^(\d{8})-(\d{8})$/);
        let oneday_match = date_range.match(/^(\d{8})$/);
        if (match) { query += ' AND (? <= c.date_created AND c.date_created <= ?)'; params.push(convertDate(match[1])); params.push(convertDate(match[2])); } 
        else if (oneday_match) { query += ' AND c.date_created = ?'; params.push(convertDate(oneday_match[1])); }
        else if (date_range === "default") query += ' AND c.date_created >= DATE_SUB(CURDATE(), INTERVAL 4 MONTH)';
        else return res.status(400).json({ error: 'Άγνωστη τιμή της παραμέτρου "date_range"!' });

        /* Ταξινόμηση με αύξουσα σειρά βάσει της date_created */
        query += ' ORDER BY c.date_created ASC';
        
        db.query(query, params, (err, results) => {
            if (err) {
                console.error('Σφάλμα κατά την εκτέλεση του query:', err.message);
                res.status(500).send({ error: 'Σφάλμα στη βάση δεδομένων' });
            } else {
                if (results.length == 0) return res.status(204).send({ error: 'Δεν βρέθηκαν εγγραφές!' });

                // Ομαδοποίηση των αποτελεσμάτων κατά debtor_name
                const data = {};
                results.forEach(row => {
                    const name = row.debtor_name || 'Άγνωστος';
                    if (!data[name]) { data[name] = []; }
                    data[name].push({
                        date_created: row.date_created,
                        delay_days: row.delay_days
                    });
                });

                if (format === 'csv') {
                    const csvData = convertToCSV(data);
                    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
                    res.setHeader('Content-Disposition', 'attachment; filename="payment_delay.csv"');
                    return res.status(200).send('\uFEFF' + csvData);
                } else {
                    res.setHeader('Content-Type', 'application/json; charset=utf-8');
                    return res.status(200).json(data);
                }
            }
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Εσωτερικό σφάλμα του server!' });
    }
});

/**
 * @swagger
 * /api/debt_stat/{type}/{date_range}:
 *   get:
 *     summary: Retrieve the filtered overall debts to/of the company
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *         description: Consider overall debts to or of the company
 *       - in: path
 *         name: date_range
 *         required: true
 *         schema:
 *           type: string
 *         description: The date range in YYYYMMDD-YYYYMMDD format
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *         description: Response format (default is json)
 *     responses:
 *       200:
 *         description: Successful retrieval of filtered payment delays history
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   creditor_name:
 *                     type: string
 *                   debtor_name:
 *                     type: string
 *                   debt:
 *                     type: string
 *           text/csv:
 *             schema:
 *               type: string
 *               description: CSV formatted response
 *       204:
 *         description: No content
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized access, user is not authenticated
 *       500:
 *         description: Internal server error
 */
app.get('/api/debt_stat/:type/:date_range', authenticate, (req, res) => {
    const format = req.query.format || 'json';
    try{
        const company = req.user.operator;
        if (company === null || company === undefined) 
            return res.status(400).json({ error: 'Δεν είστε χρήστης που ανήκει σε εταιρία!' });

        const date_range = req.params.date_range;
        if (!date_range || date_range.trim() === '')
            return res.status(400).json({ error: 'Απαιτούνται όλες οι παράμετροι!' });
        
        /* Αρχικοποίηση του query */
        let query = 'SELECT o1.op_id as creditor_id, o2.op_id as debtor_id, sum(c.amount) AS debt ' +
                    'FROM charges c LEFT JOIN operator o1 ON c.creditor_id = o1.op_pk LEFT JOIN operator o2 ON c.debtor_id = o2.op_pk ';

        const type = req.params.type;
        if (type == "from_me") query += 'WHERE c.debtor_id = ?';
        else if (type == "to_me") query += 'WHERE c.creditor_id = ?';
        else return res.status(400).json({ error: 'Απαιτούνται όλες οι παράμετροι!' });
        let params = [company];

        /* Πέρασμα εύρους ημερομηνιών του φίλτρου */
        let match = date_range.match(/^(\d{8})-(\d{8})$/);
        let oneday_match = date_range.match(/^(\d{8})$/);
        if (match) { query += ' AND (? <= c.date_created AND c.date_created <= ?)'; params.push(convertDate(match[1])); params.push(convertDate(match[2])); } 
        else if (oneday_match) { query += ' AND c.date_created = ?'; params.push(convertDate(oneday_match[1])); }
        else if (date_range != "default") return res.status(400).json({ error: 'Άγνωστη τιμή της παραμέτρου "date_range"!' });

        query += ' GROUP BY o1.op_name, o2.op_name';
        
        db.query(query, params, (err, results) => {
            if (err) {
                console.error('Σφάλμα κατά την εκτέλεση του query:', err.message);
                res.status(500).send({ error: 'Σφάλμα στη βάση δεδομένων' });
            } else {
                if (results.length == 0) return res.status(204).send({ error: 'Δεν βρέθηκαν εγγραφές!' });

                if (format === 'csv') {
                    const csvData = convertToCSV(results);
                    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
                    res.setHeader('Content-Disposition', 'attachment; filename="debt_stat.csv"');
                    return res.status(200).send('\uFEFF' + csvData);
                } else {
                    res.setHeader('Content-Type', 'application/json; charset=utf-8');
                    return res.status(200).json(results);
                }
            }
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Εσωτερικό σφάλμα του server!' });
    }
});

/**
 * @swagger
 * /api/tollPassesOp/{date_range}:
 *   get:
 *     summary: Retrieve the number of passes per toll (belonging to particular operator) 
 *     parameters:
 *       - in: path
 *         name: date_range
 *         required: true
 *         schema:
 *           type: string
 *         description: The date range in YYYYMMDD-YYYYMMDD format
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *         description: Response format (default is json)
 *     responses:
 *       200:
 *         description: Successful retrieval of passes
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   toll_id: 
 *                      type: string
 *                   passes_list:
 *                      type: array
 *                      items:
 *                        type: object
 *                        properties:
 *                          op_name:
 *                              type: string
 *                          passes:
 *                              type: integer
 *           text/csv:
 *             schema:
 *               type: string
 *               description: CSV formatted response
 *       204:
 *         description: No content
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized access, user is not authenticated
 *       500:
 *         description: Internal server error
 */
app.get('/api/tollPassesOp/:date_range', authenticate, (req, res) => {
    const format = req.query.format || 'json';
    const op_pk = req.user.operator;

    const date_range = req.params.date_range;
    if (!date_range || date_range.trim() === '')
        return res.status(400).json({ error: 'Απαιτούνται όλες οι παράμετροι!' });

    let query = `
        SELECT t.toll_id, o.op_name, count(*) AS passes
        FROM pass p
        INNER JOIN tag tg ON tg.tag_pk = p.tag_pk
        INNER JOIN operator o ON o.op_pk = tg.op_pk
        INNER JOIN toll t ON t.toll_pk = p.toll_pk
        WHERE t.op_pk = ?`;
    let params = [op_pk];

    let match = date_range.match(/^(\d{8})-(\d{8})$/);
    let oneday_match = date_range.match(/^(\d{8})$/);
    if (match) { query += ' AND (? <= p.date_occured AND p.date_occured <= ?)'; params.push(convertDate(match[1])); params.push(convertDate(match[2])); } 
    else if (oneday_match) { query += ' AND p.date_occured = ?'; params.push(convertDate(oneday_match[1])); }
    else if (date_range !== "default") return res.status(400).json({ error: 'Άγνωστη τιμή της παραμέτρου "date_range"!' });

    query += ' GROUP BY t.toll_id, o.op_name';

    db.query(query, params, (err, results) => {
        if (err) {
            console.error('Σφάλμα κατά την εκτέλεση του query:', err.message);
            return res.status(500).send({ error: 'Σφάλμα στη βάση δεδομένων' });
        }
        
        if (results.length === 0) {
            return res.status(204).send({ error: 'Δεν βρέθηκαν εγγραφές!' });
        }

        // Αναδιάρθρωση των δεδομένων στη ζητούμενη μορφή
        const formattedResults = {};
        results.forEach(({ toll_id, op_name, passes }) => {
            if (!formattedResults[toll_id]) {
                formattedResults[toll_id] = {};
            }
            formattedResults[toll_id][op_name] = passes;
        });

        for (const op in formattedResults) {
            formattedResults[op] = Object.fromEntries(
                Object.entries(formattedResults[op]).sort(([a], [b]) => a.localeCompare(b, 'el', { numeric: true }))
            );
        }

        if (format === 'csv') {
            const csvData = convertToCSV(formattedResults);
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename="toll_data.csv"');
            return res.status(200).send('\uFEFF' + csvData);
        } else {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            return res.status(200).json(formattedResults);
        }
    });
});

/**
 * @swagger
 * /api/opCat/{date_range}:
 *   get:
 *     summary: Retrieve the number of passes per vehicle category for each operator
 *     parameters:
 *       - in: path
 *         name: date_range
 *         required: true
 *         schema:
 *           type: string
 *         description: The date range in YYYYMMDD-YYYYMMDD format
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *         description: Response format (default is json)
 *     responses:
 *       200:
 *         description: Successful retrieval of passes
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   operator_name: 
 *                      type: string
 *                   vehicle_list:
 *                      type: array
 *                      items:
 *                        type: object
 *                        properties:
 *                          vehicle_type:
 *                              type: string
 *                          passes:
 *                              type: integer
 *           text/csv:
 *             schema:
 *               type: string
 *               description: CSV formatted response
 *       204:
 *         description: No content
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized access, user is not authenticated
 *       500:
 *         description: Internal server error
 */
app.get('/api/opCat/:date_range', authenticate, (req, res) => {
    const format = req.query.format || 'json';
    const op_pk = req.user.operator;

    const date_range = req.params.date_range;
    if (!date_range || date_range.trim() === '')
        return res.status(400).json({ error: 'Απαιτούνται όλες οι παράμετροι!' });

    let query = `
        SELECT o.op_name, p.vehicle_type, COUNT(*) AS passes
        FROM pass p
        INNER JOIN tag tg ON tg.tag_pk = p.tag_pk
        INNER JOIN toll t ON t.toll_pk = p.toll_pk
        INNER JOIN operator o ON o.op_pk = tg.op_pk
        WHERE t.op_pk = ?`;
    let params = [op_pk];

    let match = date_range.match(/^(\d{8})-(\d{8})$/);
    let oneday_match = date_range.match(/^(\d{8})$/);
    if (match) { query += ' AND (? <= p.date_occured AND p.date_occured <= ?)'; params.push(convertDate(match[1])); params.push(convertDate(match[2])); } 
    else if (oneday_match) { query += ' AND p.date_occured = ?'; params.push(convertDate(oneday_match[1])); }
    else if (date_range !== "default") return res.status(400).json({ error: 'Άγνωστη τιμή της παραμέτρου "date_range"!' });

    query += ' GROUP BY o.op_name, p.vehicle_type';

    db.query(query, params, (err, results) => {
        if (err) {
            console.error('Σφάλμα κατά την εκτέλεση του query:', err.message);
            return res.status(500).send({ error: 'Σφάλμα στη βάση δεδομένων' });
        }
        
        if (results.length === 0) {
            return res.status(204).send({ error: 'Δεν βρέθηκαν εγγραφές!' });
        }

        // Αναδιάρθρωση των δεδομένων στη ζητούμενη μορφή
        const formattedResults = {};
        results.forEach(({ op_name, vehicle_type, passes }) => {
            if (!formattedResults[op_name]) {
                formattedResults[op_name] = {};
            }
            formattedResults[op_name][vehicle_type] = passes;
        });

        for (const op in formattedResults) {
            formattedResults[op] = Object.fromEntries(
                Object.entries(formattedResults[op]).sort(([a], [b]) => a.localeCompare(b, 'el', { numeric: true }))
            );
        }

        if (format === 'csv') {
            const csvData = convertToCSV(formattedResults);
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename="opCat.csv"');
            return res.status(200).send('\uFEFF' + csvData);
        } else {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            return res.status(200).json(formattedResults);
        }
    });
});


// Ρούτες για στατιστικά αναλυτών
/**
 * @swagger
 * /api/passes_stat/{date_range}:
 *   get:
 *     summary: Retrieve the passes made by each operator tag to each operator toll
 *     parameters:
 *       - in: path
 *         name: date_range
 *         required: true
 *         schema:
 *           type: string
 *         description: The date range in YYYYMMDD-YYYYMMDD format
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *         description: Response format (default is json)
 *     responses:
 *       200:
 *         description: Successful retrieval of passes
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   tag_operator:
 *                     type: string
 *                   toll_operator:
 *                     type: string
 *                   num_passes:
 *                     type: integer
 *           text/csv:
 *             schema:
 *               type: string
 *               description: CSV formatted response
 *       204:
 *         description: No content
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized access, user is not authenticated
 *       500:
 *         description: Internal server error
 */
app.get('/api/passes_stat/:date_range', authenticate, (req, res) => {
    const format = req.query.format || 'json';
    let params=[];
    try{
        const date_range = req.params.date_range;
        if (!date_range || date_range.trim() === '')
            return res.status(400).json({ error: 'Απαιτούνται όλες οι παράμετροι!' });
        
        /* Αρχικοποίηση του query */
        let query = `SELECT 
                            o1.op_id AS tag_operator,
                            o2.op_id AS toll_operator,
                            COUNT(p.pass_id) AS num_passes
                        FROM pass p
                        JOIN tag tg ON p.tag_pk = tg.tag_pk
                        JOIN operator o1 ON tg.op_pk = o1.op_pk  
                        JOIN toll t ON t.toll_pk = p.toll_pk
                        JOIN operator o2 ON t.op_pk = o2.op_pk
                        WHERE 1=1        
                    `;


        /* Πέρασμα εύρους ημερομηνιών του φίλτρου */
        let match = date_range.match(/^(\d{8})-(\d{8})$/);
        let oneday_match = date_range.match(/^(\d{8})$/);
        if (match) { query += ' AND (? <= p.date_occured AND p.date_occured <= ?)'; params.push(convertDate(match[1])); params.push(convertDate(match[2])); } 
        else if (oneday_match) { query += ' AND p.date_occured = ?'; params.push(convertDate(oneday_match[1])); }
        else if (date_range != "default") return res.status(400).json({ error: 'Άγνωστη τιμή της παραμέτρου "date_range"!' });

        query += ' GROUP BY o1.op_name, o2.op_name;';
        
        db.query(query, params, (err, results) => {
            if (err) {
                console.error('Σφάλμα κατά την εκτέλεση του query:', err.message);
                res.status(500).send({ error: 'Σφάλμα στη βάση δεδομένων' });
            } else {
                if (results.length == 0) return res.status(204).send({ error: 'Δεν βρέθηκαν εγγραφές!' });

                if (format === 'csv') {
                    const csvData = convertToCSV(results);
                    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
                    res.setHeader('Content-Disposition', 'attachment; filename="passes_stat.csv"');
                    return res.status(200).send('\uFEFF' + csvData);
                } else {
                    res.setHeader('Content-Type', 'application/json; charset=utf-8');
                    return res.status(200).json(results);
                }
            }
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Εσωτερικό σφάλμα του server!' });
    }
});

/**
 * @swagger
 * /api/vehicle_stats/{date_range}:
 *   get:
 *     summary: Retrieve the number of different vehicle types that pass through each operator
 *     parameters:
 *       - in: path
 *         name: date_range
 *         required: true
 *         schema:
 *           type: string
 *         description: The date range in YYYYMMDD-YYYYMMDD format
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *         description: Response format (default is json)
 *     responses:
 *       200:
 *         description: Successful retrieval of passes
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   op_name:
 *                     type: string
 *                   vehicle_type:
 *                     type: string
 *                   vehicle_type_count:
 *                     type: integer
 *           text/csv:
 *             schema:
 *               type: string
 *               description: CSV formatted response
 *       204:
 *         description: No content
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized access, user is not authenticated
 *       500:
 *         description: Internal server error
 */
app.get('/api/vehicle_stats/:date_range', authenticate, (req, res) => {
    const format = req.query.format || 'json';
    let params=[];
    try{
        const date_range = req.params.date_range;
        if (!date_range || date_range.trim() === '')
            return res.status(400).json({ error: 'Απαιτούνται όλες οι παράμετροι!' });
        
        /* Αρχικοποίηση του query */
        let query = ` select o.op_name, p.vehicle_type, count(*) as vehicle_type_count
                      from pass p
                      inner join toll t on t.toll_pk = p.toll_pk
                      inner join operator o on o.op_pk = t.op_pk     
                    `;


        /* Πέρασμα εύρους ημερομηνιών του φίλτρου */
        let match = date_range.match(/^(\d{8})-(\d{8})$/);
        let oneday_match = date_range.match(/^(\d{8})$/);
        if (match) { query += ' AND (? <= p.date_occured AND p.date_occured <= ?)'; params.push(convertDate(match[1])); params.push(convertDate(match[2])); } 
        else if (oneday_match) { query += ' AND p.date_occured = ?'; params.push(convertDate(oneday_match[1])); }
        else if (date_range != "default") return res.status(400).json({ error: 'Άγνωστη τιμή της παραμέτρου "date_range"!' });

        query += ' group by o.op_name, p.vehicle_type' + 
                 ' order by o.op_name, p.vehicle_type;';
        
        db.query(query, params, (err, results) => {
            if (err) {
                console.error('Σφάλμα κατά την εκτέλεση του query:', err.message);
                res.status(500).send({ error: 'Σφάλμα στη βάση δεδομένων' });
            } else {
                if (results.length == 0) return res.status(204).send({ error: 'Δεν βρέθηκαν εγγραφές!' });

                // Αναδιάρθρωση των δεδομένων στη ζητούμενη μορφή
                const formattedResults = {};
                results.forEach(({ op_name, vehicle_type, vehicle_type_count }) => {
                    if (!formattedResults[op_name]) {
                        formattedResults[op_name] = {};
                    }
                    formattedResults[op_name][vehicle_type] = vehicle_type_count;
                });

                for (const op in formattedResults) {
                    formattedResults[op] = Object.fromEntries(
                        Object.entries(formattedResults[op]).sort(([a], [b]) => a.localeCompare(b, 'el', { numeric: true }))
                    );
                }

                if (format === 'csv') {
                    const csvData = convertToCSV(formattedResults);
                    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
                    res.setHeader('Content-Disposition', 'attachment; filename="vehicle_stats.csv"');
                    return res.status(200).send('\uFEFF' + csvData);
                } else {
                    res.setHeader('Content-Type', 'application/json; charset=utf-8');
                    return res.status(200).json(formattedResults);
                }
            }
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Εσωτερικό σφάλμα του server!' });
    }
});

/**
 * @swagger
 * /api/allTollPasses/{toll_op_pk}/{date_range}:
 *   get:
 *     summary: Retrieve the total passes for each toll 
 *     parameters:
 *       - in: path
 *         name: toll_op_pk
 *         required: true
 *         schema:
 *           type: string
 *         description: The id of the tolls' operator
 *       - in: path
 *         name: date_range
 *         required: true
 *         schema:
 *           type: string
 *         description: The date range in YYYYMMDD-YYYYMMDD format
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *         description: Response format (default is json)
 *     responses:
 *       200:
 *         description: Successful retrieval of passes
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   toll_id:
 *                     type: string
 *                   op_name:
 *                     type: string
 *                   total_passes:
 *                     type: integer
 *           text/csv:
 *             schema:
 *               type: string
 *               description: CSV formatted response
 *       204:
 *         description: No content
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized access, user is not authenticated
 *       500:
 *         description: Internal server error
 */
app.get('/api/allTollPasses/:toll_op_pk/:date_range', authenticate, (req, res) => {
    const format = req.query.format || 'json';
    const date_range = req.params.date_range;
    const toll_op_pk = req.params.toll_op_pk;
    if (!date_range || date_range.trim() === '')
        return res.status(400).json({ error: 'Απαιτούνται όλες οι παράμετροι!' });

    let query = `
        select t.toll_id, o.op_name, count(*) as total_passes
        from toll t
        inner join pass p on p.toll_pk=t.toll_pk
        inner join tag tg on tg.tag_pk = p.tag_pk
        inner join operator o on o.op_pk = tg.op_pk
        where t.op_pk = ?`;
    let params = [toll_op_pk];

    let match = date_range.match(/^(\d{8})-(\d{8})$/);
    let oneday_match = date_range.match(/^(\d{8})$/);
    if (match) { query += ' AND (? <= p.date_occured AND p.date_occured <= ?)'; params.push(convertDate(match[1])); params.push(convertDate(match[2])); } 
    else if (oneday_match) { query += ' AND p.date_occured = ?'; params.push(convertDate(oneday_match[1])); }
    else if (date_range !== "default") return res.status(400).json({ error: 'Άγνωστη τιμή της παραμέτρου "date_range"!' });

    query += ' group by t.toll_id, o.op_name' +
             ' order by t.toll_id, o.op_name;';

    db.query(query, params, (err, results) => {
        if (err) {
            console.error('Σφάλμα κατά την εκτέλεση του query:', err.message);
            return res.status(500).send({ error: 'Σφάλμα στη βάση δεδομένων' });
        }
        
        if (results.length === 0) {
            return res.status(204).send({ error: 'Δεν βρέθηκαν εγγραφές!' });
        }

        // Αναδιάρθρωση των δεδομένων στη ζητούμενη μορφή
        const formattedResults = {};
        results.forEach(({ toll_id, op_name, total_passes }) => {
            if (!formattedResults[toll_id]) {
                formattedResults[toll_id] = {};
            }
            formattedResults[toll_id][op_name] = total_passes;
        });

        for (const op in formattedResults) {
            formattedResults[op] = Object.fromEntries(
                Object.entries(formattedResults[op]).sort(([a], [b]) => a.localeCompare(b, 'el', { numeric: true }))
            );
        }

        if (format === 'csv') {
            const csvData = convertToCSV(formattedResults);
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename="allTollPasses.csv"');
            return res.status(200).send('\uFEFF' + csvData);
        } else {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            return res.status(200).json(formattedResults);
        }
    });
});

/**
 * @swagger
 * /api/tags:
 *   get:
 *     summary: Retrieve the number of tags of each operator
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *         description: Response format (default is json)
 *     responses:
 *       200:
 *         description: Successful retrieval of tags
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   operator_name: 
 *                      type: string
 *                   tags:
 *                      type: integer
 *           text/csv:
 *             schema:
 *               type: string
 *               description: CSV formatted response
 *       204:
 *         description: No content
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized access, user is not authenticated
 *       500:
 *         description: Internal server error
 */
app.get('/api/tags', (req, res) => {
    const format = req.query.format || 'json';

    const query = `
        SELECT o.op_name, count(*) AS tags
        FROM tag tg
        INNER JOIN operator o ON o.op_pk = tg.op_pk
        GROUP BY tg.op_pk`;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Σφάλμα κατά την εκτέλεση του query:', err.message);
            return res.status(500).send({ error: 'Σφάλμα στη βάση δεδομένων' });
        }
        
        if (results.length === 0) {
            return res.status(204).send({ error: 'Δεν βρέθηκαν εγγραφές!' });
        }

        if (format === 'csv') {
            const csvData = convertToCSV(results);
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename="tags.csv"');
            return res.status(200).send('\uFEFF' + csvData);
        } else {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            return res.status(200).json(results);
        }
    });
});



// Ρούτες για ιστορικo οφειλων και οφειλομενων της εταιριας
/**
 * @swagger
 * /api/history:
 *   get:
 *     summary: Retrieve the transaction history of the company
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *         description: Response format (default is json)
 *     responses:
 *       200:
 *         description: Successful retrieval of transaction history
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   debtor_name:
 *                     type: string
 *                   creditor_name:
 *                     type: string
 *                   amount:
 *                     type: string
 *                   date_created:
 *                     type: string
 *                   date_paid:
 *                     type: string
 *           text/csv:
 *             schema:
 *               type: string
 *               description: CSV formatted response
 *       204:
 *         description: No content
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized access, user is not authenticated
 *       500:
 *         description: Internal server error
 */
app.get('/api/history', authenticate, (req, res) => {
    const format = req.query.format || 'json';
    try{
        const company = req.user.operator;
        if (company === null || company === undefined) 
            return res.status(400).json({ error: 'Δεν είστε χρήστης που ανήκει σε εταιρία!' });
        

        const query = 'SELECT o1.op_name AS debtor_name, o2.op_name AS creditor_name, c.amount, c.date_created, c.date_paid ' +
                        'FROM charges c LEFT JOIN operator o1 ON c.debtor_id = o1.op_pk LEFT JOIN operator o2 ON c.creditor_id = o2.op_pk ' +
                        'WHERE (c.debtor_id = ? OR c.creditor_id = ?) AND c.status = "confirmed"';
        db.query(query, [company, company], (err, results) => {
            if (err) {
                console.error('Σφάλμα κατά την εκτέλεση του query:', err.message);
                return res.status(500).send({ error: 'Σφάλμα στη βάση δεδομένων' });
            } else {
                if (results.length == 0) return res.status(204).send({ error: 'Δεν βρέθηκαν εγγραφές!' });

                if (format === 'csv') {
                    const csvData = convertToCSV(results);
                    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
                    res.setHeader('Content-Disposition', 'attachment; filename="history.csv"');
                    return res.status(200).send('\uFEFF' + csvData);
                } else {
                    res.setHeader('Content-Type', 'application/json; charset=utf-8');
                    return res.status(200).json(results);
                }
            }
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Εσωτερικό σφάλμα του server!' });
    }
});

/**
 * @swagger
 * /api/history_filtered/{type}/{date_range}/{s_amount}/{e_amount}/{stakeholders}:
 *   get:
 *     summary: Retrieve the filtered transaction history of the company
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [all, from_me, to_me]
 *         description: The type of debts
 *       - in: path
 *         name: date_range
 *         required: true
 *         schema:
 *           type: string
 *         description: The date range in YYYYMMDD-YYYYMMDD format
 *       - in: path
 *         name: s_amount
 *         required: true
 *         schema:
 *           type: string
 *         description: The starting amount of debt
 *       - in: path
 *         name: e_amount
 *         required: true
 *         schema:
 *           type: string
 *         description: The ending amount of debt
 *       - in: path
 *         name: stakeholders
 *         required: true
 *         schema:
 *           type: string
 *         description: The list of the stakeholders included (in csv form)
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *         description: Response format (default is json)
 *     responses:
 *       200:
 *         description: Successful retrieval of filtered transaction history
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   debtor_name:
 *                     type: string
 *                   creditor_name:
 *                     type: string
 *                   amount:
 *                     type: string
 *                   date_created:
 *                     type: string
 *                   date_paid:
 *                     type: string
 *           text/csv:
 *             schema:
 *               type: string
 *               description: CSV formatted response
 *       204:
 *         description: No content
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized access, user is not authenticated
 *       500:
 *         description: Internal server error
 */
app.get('/api/history_filtered/:type/:date_range/:s_amount/:e_amount/:stakeholders', authenticate, (req, res) => {
    const format = req.query.format || 'json';
    try{
        const company = req.user.operator;
        if (company === null || company === undefined) 
            return res.status(400).json({ error: 'Δεν είστε χρήστης που ανήκει σε εταιρία!' });

        const type = req.params.type;
        const date_range = req.params.date_range;
        const s_amount = req.params.s_amount;
        const e_amount = req.params.e_amount;
        const stakes = req.params.stakeholders;
        if (!type || type.trim() === '' || !date_range || date_range.trim() === '' || !s_amount || s_amount.trim() === '' || 
            !e_amount || e_amount.trim() === '' || !stakes || stakes.trim() === '')
            return res.status(400).json({ error: 'Απαιτούνται όλες οι παράμετροι!' });
        
        /* Αρχικοποίηση του query */
        let query = 'SELECT o1.op_name AS debtor_name, o2.op_name AS creditor_name, c.amount, c.date_created, c.date_paid ' +
                    'FROM charges c LEFT JOIN operator o1 ON c.debtor_id = o1.op_pk LEFT JOIN operator o2 ON c.creditor_id = o2.op_pk ';
        let params = []

        /* Πέρασμα των εμπλεκόμενων του φίλτρου */
        const stakeholders = stakes.split(',').map(Number).filter(stake => stake !== company);
        if (stakeholders.some(isNaN)) return res.status(400).json({ error: 'Άγνωστη τιμή της παραμέτρου "stakeholders"!' });

        /* Πέρασμα τύπου του φίλτρου */
        if (type == "all") {
            query += 'WHERE (c.debtor_id = ? OR c.creditor_id = ?) AND (c.debtor_id IN (?) OR c.creditor_id IN (?)) ';
            params = [company, company, stakeholders, stakeholders];
        } 
        else if (type == "from_me") { query += 'WHERE c.debtor_id = ? AND c.creditor_id IN (?) '; params = [company, stakeholders]; } 
        else if (type == "to_me") { query += 'WHERE c.creditor_id = ? AND c.debtor_id IN (?) '; params = [company, stakeholders]; } 
        else return res.status(400).json({ error: 'Άγνωστη τιμή της παραμέτρου "type"!' });

        /* Πέρασμα εύρους ημερομηνιών του φίλτρου */
        let match = date_range.match(/^(\d{8})-(\d{8})$/);
        let oneday_match = date_range.match(/^(\d{8})$/);
        if (match) { query += ' AND (? <= c.date_created AND c.date_created <= ?)'; params.push(convertDate(match[1])); params.push(convertDate(match[2])); } 
        else if (oneday_match) { query += ' AND c.date_created = ?'; params.push(convertDate(oneday_match[1])); }
        else { if (date_range != "all") return res.status(400).json({ error: 'Άγνωστη τιμή της παραμέτρου "date_range"!' }); }

        /* Πέρασμα εύρους χρημάτων του φίλτρου */
        if (isNaN(s_amount) || isNaN(e_amount)) return res.status(400).json({ error: 'Το ποσό πρέπει να είναι αριθμός!' });
        else { query += 'AND (? <= c.amount AND c.amount <= ?) '; params.push(parseFloat(s_amount)); params.push(parseFloat(e_amount)); }

        query += 'AND c.status = "confirmed"';

        db.query(query, params, (err, results) => {
            if (err) {
                console.error('Σφάλμα κατά την εκτέλεση του query:', err.message);
                res.status(500).send({ error: 'Σφάλμα στη βάση δεδομένων' });
            } else {
                if (results.length == 0) return res.status(204).send({ error: 'Δεν βρέθηκαν εγγραφές!' });

                if (format === 'csv') {
                    const csvData = convertToCSV(results);
                    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
                    res.setHeader('Content-Disposition', 'attachment; filename="history_filtered.csv"');
                    return res.status(200).send('\uFEFF' + csvData);
                } else {
                    res.setHeader('Content-Type', 'application/json; charset=utf-8');
                    return res.status(200).json(results);
                }
            }
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Εσωτερικό σφάλμα του server!' });
    }
});

/**
 * @swagger
 * /api/owing:
 *   get:
 *     summary: Retrieve the active debts of the company
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *         description: Response format (default is json)
 *     responses:
 *       200:
 *         description: Successful retrieval of the active debts of the company
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   creditor_name:
 *                     type: string
 *                   amount:
 *                     type: string
 *                   date_created:
 *                     type: string
 *           text/csv:
 *             schema:
 *               type: string
 *               description: CSV formatted response
 *       204:
 *         description: No content
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized access, user is not authenticated
 *       500:
 *         description: Internal server error
 */
app.get('/api/owing', authenticate, (req, res) => {
    const format = req.query.format || 'json';
    try{
        const company = req.user.operator;
        if (company === null || company === undefined) 
            return res.status(400).json({ error: 'Δεν είστε χρήστης που ανήκει σε εταιρία!' });

        const query = 'SELECT c.char_id, o.op_name AS creditor_name, c.amount, c.date_created FROM charges c ' +
                        'LEFT JOIN operator o ON c.creditor_id = o.op_pk WHERE c.debtor_id = ? AND c.status = "owed"';
        db.query(query, [company], (err, results) => {
            if (err) {
                console.error('Σφάλμα κατά την εκτέλεση του query:', err.message);
                return res.status(500).send({ error: 'Σφάλμα στη βάση δεδομένων' });
            } else {
                if (results.length == 0) return res.status(204).send({ error: 'Δεν βρέθηκαν εγγραφές!' });

                if (format === 'csv') {
                    const csvData = convertToCSV(results);
                    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
                    res.setHeader('Content-Disposition', 'attachment; filename="owing.csv"');
                    return res.status(200).send('\uFEFF' + csvData);
                } else {
                    res.setHeader('Content-Type', 'application/json; charset=utf-8');
                    return res.status(200).json(results);
                }
            }
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Εσωτερικό σφάλμα του server!' });
    }
});

/**
 * @swagger
 * /api/owed:
 *   get:
 *     summary: Retrieve the active debts to the company
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *         description: Response format (default is json)
 *     responses:
 *       200:
 *         description: Successful retrieval of the active debts to the company
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   debtor_name:
 *                     type: string
 *                   amount:
 *                     type: string
 *                   date_created:
 *                     type: string
 *           text/csv:
 *             schema:
 *               type: string
 *               description: CSV formatted response
 *       204:
 *         description: No content
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized access, user is not authenticated
 *       500:
 *         description: Internal server error
 */
app.get('/api/owed', authenticate, (req, res) => {
    const format = req.query.format || 'json';
    try{
        const company = req.user.operator;
        if (company === null || company === undefined) 
            return res.status(400).json({ error: 'Δεν είστε χρήστης που ανήκει σε εταιρία!' });

        const query = 'SELECT o.op_name AS debtor_name, c.amount, c.date_created FROM charges c ' +
                        'LEFT JOIN operator o ON c.debtor_id = o.op_pk WHERE c.creditor_id = ? AND c.status = "owed"';
        db.query(query, [company], (err, results) => {
            if (err) {
                console.error('Σφάλμα κατά την εκτέλεση του query:', err.message);
                res.status(500).send({ error: 'Σφάλμα στη βάση δεδομένων' });
            } else {
                if (results.length == 0) return res.status(204).send({ error: 'Δεν βρέθηκαν εγγραφές!' });

                if (format === 'csv') {
                    const csvData = convertToCSV(results);
                    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
                    res.setHeader('Content-Disposition', 'attachment; filename="owed.csv"');
                    return res.status(200).send('\uFEFF' + csvData);
                } else {
                    res.setHeader('Content-Type', 'application/json; charset=utf-8');
                    return res.status(200).json(results);
                }
            }
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Εσωτερικό σφάλμα του server!' });
    }
});

/**
 * @swagger
 * /api/to_confirm:
 *   get:
 *     summary: Retrieve the payments of the company waiting to be confirmed
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *         description: Response format (default is json)
 *     responses:
 *       200:
 *         description: Successful retrieval of the payments of the company
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   creditor_name:
 *                     type: string
 *                   amount:
 *                     type: string
 *                   date_created:
 *                     type: string
 *                   date_paid:
 *                     type: string
 *           text/csv:
 *             schema:
 *               type: string
 *               description: CSV formatted response
 *       204:
 *         description: No content
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized access, user is not authenticated
 *       500:
 *         description: Internal server error
 */
app.get('/api/to_confirm', authenticate, (req, res) => {
    const format = req.query.format || 'json';
    const company = req.user.operator;
    if (company === null || company === undefined) 
        return res.status(400).json({ error: 'Δεν είστε χρήστης που ανήκει σε εταιρία!' });

    const query = 'SELECT o.op_name AS creditor_name, c.amount, c.date_created, c.date_paid FROM charges c ' +
                    'LEFT JOIN operator o ON c.creditor_id = o.op_pk WHERE c.debtor_id = ? AND c.status = "paid"';
    db.query(query, [company], (err, results) => {
        if (err) {
            console.error('Σφάλμα κατά την εκτέλεση του query:', err.message);
            res.status(500).send({ error: 'Σφάλμα στη βάση δεδομένων' });
        } else {
            if (results.length == 0) return res.status(204).send({ error: 'Δεν βρέθηκαν εγγραφές!' });

            if (format === 'csv') {
                const csvData = convertToCSV(results);
                res.setHeader('Content-Type', 'text/csv; charset=utf-8');
                res.setHeader('Content-Disposition', 'attachment; filename="to_confirm.csv"');
                return res.status(200).send('\uFEFF' + csvData);
            } else {
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                return res.status(200).json(results);
            }
        }
    });
});

/**
 * @swagger
 * /api/to_be_confirmed:
 *   get:
 *     summary: Retrieve the payments to the company waiting to be confirmed
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *         description: Response format (default is json)
 *     responses:
 *       200:
 *         description: Successful retrieval of the payments to the company
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   debtor_name:
 *                     type: string
 *                   amount:
 *                     type: string
 *                   date_created:
 *                     type: string
 *                   date_paid:
 *                     type: string
 *           text/csv:
 *             schema:
 *               type: string
 *               description: CSV formatted response
 *       204:
 *         description: No content
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized access, user is not authenticated
 *       500:
 *         description: Internal server error
 */
app.get('/api/to_be_confirmed', authenticate, (req, res) => {
    const format = req.query.format || 'json';
    const company = req.user.operator;
    if (company === null || company === undefined) 
        return res.status(400).json({ error: 'Δεν είστε χρήστης που ανήκει σε εταιρία!' });

    const query = 'SELECT c.char_id, o.op_name AS debtor_name, c.amount, c.date_created, c.date_paid FROM charges c ' +
                    'LEFT JOIN operator o ON c.debtor_id = o.op_pk WHERE c.creditor_id = ? AND c.status = "paid"';
    db.query(query, [company], (err, results) => {
        if (err) {
            console.error('Σφάλμα κατά την εκτέλεση του query:', err.message);
            res.status(500).send({ error: 'Σφάλμα στη βάση δεδομένων' });
        } else {
            if (results.length == 0) return res.status(204).send({ error: 'Δεν βρέθηκαν εγγραφές!' });

            if (format === 'csv') {
                const csvData = convertToCSV(results);
                res.setHeader('Content-Type', 'text/csv; charset=utf-8');
                res.setHeader('Content-Disposition', 'attachment; filename="to_be_confirmed.csv"');
                return res.status(200).send('\uFEFF' + csvData);
            } else {
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                return res.status(200).json(results);
            }
        }
    });
});


// Ρούτες για πληρωμή και επιβεβαίωση πληρωμών
/**
 * @swagger
 * /api/pay:
 *   post:
 *     summary: Handle payment request
 *     responses:
 *       200:
 *         description: Successful payment
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Η πληρωμή ολοκληρώθηκε με επιτυχία!
 *       400:
 *         description: Bad request
 *       500:
 *         description: Internal server error
 *       204:
 *         description: No content
 */
app.post('/api/pay', authenticate, (req, res) => {
    const { char_id } = req.body;
    if (!char_id || isNaN(char_id))
        return res.status(400).json({ error: 'Απαιτείται αναγνωριστικό χρέωσης!' });

    const query = 'UPDATE charges SET status = "paid" WHERE char_id = ? AND status = "owed"';
    db.query(query, [char_id], (err, results) => {
        if (err) {
            console.error('Σφάλμα κατά την εκτέλεση του query:', err.message);
            return res.status(500).send({ error: 'Σφάλμα στη βάση δεδομένων' });
        } else {
            if (results.affectedRows > 0) {
                return res.status(200).json({ message: 'Η πληρωμή ολοκληρώθηκε με επιτυχία!' });
            } else {
                return res.status(204).json({ error: 'Δεν βρέθηκε χρέωση με την κατάσταση "owed".' });
            }
        }
    });
});

/**
 * @swagger
 * /api/confirm:
 *   post:
 *     summary: Handle payment confirmation request
 *     responses:
 *       200:
 *         description: Successful confirmation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Η επιβεβαίωση πληρωμής ολοκληρώθηκε με επιτυχία!
 *       400:
 *         description: Bad request
 *       500:
 *         description: Internal server error
 *       204:
 *         description: No content
 */
app.post('/api/confirm', authenticate, (req, res) => {
    const { char_id } = req.body;
    if (!char_id || isNaN(char_id))
        return res.status(400).json({ error: 'Απαιτείται αναγνωριστικό χρέωσης!' });

    const query = 'UPDATE charges SET status = "confirmed" WHERE char_id = ? AND status = "paid"';
    db.query(query, [char_id], (err, results) => {
        if (err) {
            console.error('Σφάλμα κατά την εκτέλεση του query:', err.message);
            return res.status(500).send({ error: 'Σφάλμα στη βάση δεδομένων' });
        } else {
            if (results.affectedRows > 0) {
                return res.status(200).json({ message: 'Η επιβεβαίωση πληρωμής ολοκληρώθηκε με επιτυχία!' });
            } else {
                return res.status(204).json({ error: 'Δεν βρέθηκε χρέωση με την κατάσταση "paid".' });
            }
        }
    });
});


// Βοηθητική ρούτα για το μενού των φίλτρων
/**
 * @swagger
 * /api/max_debt:
 *   get:
 *     summary: Retrieve the max paid debt to or from the company
 *     responses:
 *       200:
 *         description: Successful retrieval of the debt
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   max:
 *                     type: string
 *       204:
 *         description: No content
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized access, user is not authenticated
 *       500:
 *         description: Internal server error
 */
app.get('/api/max_debt', authenticate, (req, res) => {
    const company = req.user.operator;
    if (company === null || company === undefined) 
        return res.status(400).json({ error: 'Δεν είστε χρήστης που ανήκει σε εταιρία!' });
    

    const query = 'SELECT max(c.amount) as max FROM charges c LEFT JOIN operator o1 ON c.debtor_id = o1.op_pk ' + 
                  'LEFT JOIN operator o2 ON c.creditor_id = o2.op_pk WHERE (c.debtor_id = ? OR c.creditor_id = ?) AND c.status = "confirmed"';
    db.query(query, [company, company], (err, results) => {
        if (err) {
            console.error('Σφάλμα κατά την εκτέλεση του query:', err.message);
            return res.status(500).send({ error: 'Σφάλμα στη βάση δεδομένων' });
        } else {
            if (results.length == 0) return res.status(204).send({ error: 'Δεν βρέθηκαν εγγραφές!' });

            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            return res.status(200).json({ max: results[0].max });
        }
    });
});



// Ρούτα για λήψη όλων των δεδομένων από τον πίνακα `toll`
/**
 * @swagger
 * /api/toll:
 *   get:
 *     summary: Retrieve toll data
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *         description: Response format (default is json)
 *     responses:
 *       200:
 *         description: Successful retrieval of toll data
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   toll_pk:
 *                     type: integer
 *                   op_pk:
 *                     type: integer
 *                   toll_id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   coord_lat:
 *                     type: string
 *                   coord_long:
 *                     type: string
 *                   dest:
 *                     type: string
 *                   locality:
 *                     type: string
 *                   road:
 *                     type: string
 *                   price1:
 *                     type: string
 *                   price2:
 *                     type: string
 *                   price3:
 *                     type: string
 *                   price4:
 *                     type: string
 *           text/csv:
 *             schema:
 *               type: string
 *               description: CSV formatted response
 *       204:
 *         description: No content
 *       401:
 *         description: Unauthorized access, user is not authenticated
 *       500:
 *         description: Internal server error
 */
app.get('/api/toll', authenticate, (req, res) => {
    const format = req.query.format || 'json';
    const op_pk = req.user.operator;
    let query;
    let queryParams = [];

    if (op_pk === null) {
        query = 'SELECT * FROM toll';
    } else {
        query = 'SELECT * FROM toll WHERE op_pk = ?';
        queryParams.push(op_pk);
    }

    db.query(query, queryParams, (err, results) => {
        if (err) {
            console.error('Σφάλμα κατά την εκτέλεση του query:', err.message);
            return res.status(500).send({ error: 'Σφάλμα στη βάση δεδομένων' });
        } else {
            if (results.length == 0)
                return res.status(204).send({ error: 'Δεν βρέθηκαν εγγραφές!' });
            else {
                if (format === 'csv') {
                    const csvData = convertToCSV(results);
                    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
                    res.setHeader('Content-Disposition', 'attachment; filename="toll_data.csv"');
                    return res.status(200).send('\uFEFF' + csvData);
                } else {
                    res.setHeader('Content-Type', 'application/json; charset=utf-8');
                    return res.status(200).json(results);
                    }
            }
        }
    });
});


// Ρούτες για παραγωγή στατιστικών για συγκεκριμένο id διοδίου
/**
 * @swagger
 * /api/single_toll_per_cat/{toll_pk}/{name}:
 *   get:
 *     summary: Get statistics for a specific toll by vehicle category
 *     parameters:
 *       - in: path
 *         name: toll_pk
 *         required: true
 *         schema:
 *           type: integer
 *         description: The primary key of the toll
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         description: The name of the toll
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *         description: Response format (default is json)
 *     responses:
 *       200:
 *         description: Successful retrieval of toll statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   vehicle_type:
 *                     type: string
 *                   passes:
 *                     type: integer
 *           text/csv:
 *             schema:
 *               type: string
 *               description: CSV formatted response
 *       400:
 *         description: Bad request
 *       401:
 *         description: Not authorized
 *       500:
 *         description: Internal server error
 *       204:
 *         description: Toll not found
 */
app.get('/api/single_toll_per_cat/:toll_pk/:name', authenticate, (req, res) => {
    const format = req.query.format || 'json';
    const name = req.params.name;
    if (!name || name.trim() === '')
        return res.status(400).json({ error: 'Απαιτείται η παράμετρος "name"!' });

    var query1, param;
    if (name.endsWith('Μετωπικά')) {
        query1 = 'SELECT toll_pk, dest FROM toll WHERE name = ?';
        param = name + ' ';
    }
    else {
        query1 = 'SELECT toll_pk, dest FROM toll WHERE toll_pk = ?';
        param = req.params.toll_pk;
    }
    if (!param || param.trim() === '')
        return res.status(400).json({ error: 'Πιθανόν δεν έχει δοθεί το pk του διοδίου!' });
    
    db.query(query1, [param], (err, results1) => {
        if (err) {
            console.error('Σφάλμα κατά την εκτέλεση του query:', err.message);
            return res.status(500).send({ error: 'Σφάλμα στη βάση δεδομένων' });
        } else if (results1.length === 0) {
            return res.status(204).send({ error: 'Το διόδιο δεν βρέθηκε' });
        }

        var tollPKs = []; var dests = {};
        results1.forEach(row => {
            const { toll_pk, dest } = row;
            dests[toll_pk] = dest; tollPKs.push(toll_pk);
        });

        const query2 = 'SELECT vehicle_type, COUNT(*) AS passes FROM pass WHERE toll_pk IN (?) GROUP BY vehicle_type ORDER BY vehicle_type ASC';
        db.query(query2, [tollPKs], (err, results2) => {
            if (err) {
                console.error('Σφάλμα κατά την εκτέλεση του δεύτερου query:', err.message);
                return res.status(500).send({ error: 'Σφάλμα στη βάση δεδομένων' });
            }

            // Εξαγωγή στατιστικών
            vehicle_type = ["Κατηγορία 1", "Κατηγορία 2", "Κατηγορία 3", "Κατηγορία 4"]; 
            vehicle_type_passes = [0, 0, 0, 0];

            results2.forEach(row => {
                // Διελεύσεις ανά κατηγορία
                vehicle_type_passes[Number(row["vehicle_type"].slice(-1))-1] = row["passes"];
            });
            const results = vehicle_type.map((type, index) => ({
                vehicle_type: type,
                passes: vehicle_type_passes[index]
            }));
            if (format === 'csv') {
                const csvData = convertToCSV(results);
                res.setHeader('Content-Type', 'text/csv; charset=utf-8');
                res.setHeader('Content-Disposition', 'attachment; filename="toll_cat_stats.csv"');
                return res.status(200).send('\uFEFF' + csvData);
            } else {
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                return res.status(200).json(results);
            }
        });
    })
});

/**
 * @swagger
 * /api/single_toll_per_ops/{toll_pk}/{name}:
 *   get:
 *     summary: Get statistics for a specific toll by operator passes
 *     parameters:
 *       - in: path
 *         name: toll_pk
 *         required: true
 *         schema:
 *           type: integer
 *         description: The primary key of the toll
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         description: The name of the toll
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *         description: Response format (default is json)
 *     responses:
 *       200:
 *         description: Successful retrieval of toll statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   op_name:
 *                     type: string
 *                   passes:
 *                     type: integer
 *           text/csv:
 *             schema:
 *               type: string
 *               description: CSV formatted response
 *       400:
 *         description: Bad request
 *       401:
 *         description: Not authorized
 *       500:
 *         description: Internal server error
 *       204:
 *         description: No content
 */
app.get('/api/single_toll_per_ops/:toll_pk/:name', authenticate, (req, res) => {
    const format = req.query.format || 'json';
    const name = req.params.name;
    if (!name || name.trim() === '')
        return res.status(400).json({ error: 'Απαιτείται η παράμετρος "name"!' });

    var query1, param;
    if (name.endsWith('Μετωπικά')) {
        query1 = 'SELECT toll_pk, dest FROM toll WHERE name = ?';
        param = name + ' ';
    }
    else {
        query1 = 'SELECT toll_pk, dest FROM toll WHERE toll_pk = ?';
        param = req.params.toll_pk;
    }
    if (!param || param.trim() === '')
        return res.status(400).json({ error: 'Πιθανόν δεν έχει δοθεί το pk του διοδίου!' });
    
    db.query(query1, [param], (err, results1) => {
        if (err) {
            console.error('Σφάλμα κατά την εκτέλεση του query:', err.message);
            return res.status(500).send({ error: 'Σφάλμα στη βάση δεδομένων' });
        } else if (results1.length === 0) {
            return res.status(204).send({ error: 'Το διόδιο δεν βρέθηκε' });
        }

        var tollPKs = []; var dests = {};
        results1.forEach(row => {
            const { toll_pk, dest } = row;
            dests[toll_pk] = dest; tollPKs.push(toll_pk);
        });

        const query2 = 'SELECT o.op_name, count(*) as passes FROM pass p INNER JOIN tag t ON p.tag_pk = t.tag_pk INNER JOIN operator o ON o.op_pk = t.op_pk WHERE toll_pk IN (?) group by o.op_name';
        db.query(query2, [tollPKs], (err, results2) => {
            if (err) {
                console.error('Σφάλμα κατά την εκτέλεση του δεύτερου query:', err.message);
                return res.status(500).send({ error: 'Σφάλμα στη βάση δεδομένων' });
            } else if (results2.length === 0) {
                return res.status(204).send({ error: 'Δεν βρέθηκαν διελεύσεις!' });
            }

            if (format === 'csv') {
                const csvData = convertToCSV(results2);
                res.setHeader('Content-Type', 'text/csv; charset=utf-8');
                res.setHeader('Content-Disposition', 'attachment; filename="toll_ops_stats.csv"');
                return res.status(200).send('\uFEFF' + csvData);
            } else {
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                return res.status(200).json(results2);
            }
        });
    });
});

/**
 * @swagger
 * /api/single_toll_charges/{toll_pk}/{name}:
 *   get:
 *     summary: Get charges statistics for a specific toll by operator
 *     parameters:
 *       - in: path
 *         name: toll_pk
 *         required: true
 *         schema:
 *           type: integer
 *         description: The primary key of the toll
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         description: The name of the toll
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *         description: Response format (default is json)
 *     responses:
 *       200:
 *         description: Successful retrieval of toll statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   op_name:
 *                     type: string
 *                   debt:
 *                     type: string
 *           text/csv:
 *             schema:
 *               type: string
 *               description: CSV formatted response
 *       400:
 *         description: Bad request
 *       401:
 *         description: Not authorized
 *       500:
 *         description: Internal server error
 *       204:
 *         description: No content
 */
app.get('/api/single_toll_charges/:toll_pk/:name', authenticate, (req, res) => {
    const format = req.query.format || 'json';
    const name = req.params.name;
    if (!name || name.trim() === '')
        return res.status(400).json({ error: 'Απαιτείται η παράμετρος "name"!' });

    var query1, param;
    if (name.endsWith('Μετωπικά')) {
        query1 = 'SELECT toll_pk, dest FROM toll WHERE name = ?';
        param = name + ' ';
    }
    else {
        query1 = 'SELECT toll_pk, dest FROM toll WHERE toll_pk = ?';
        param = req.params.toll_pk;
    }
    if (!param || param.trim() === '')
        return res.status(400).json({ error: 'Πιθανόν δεν έχει δοθεί το pk του διοδίου!' });
    
    db.query(query1, [param], (err, results1) => {
        if (err) {
            console.error('Σφάλμα κατά την εκτέλεση του query:', err.message);
            return res.status(500).send({ error: 'Σφάλμα στη βάση δεδομένων' });
        } else if (results1.length === 0) {
            return res.status(204).send({ error: 'Το διόδιο δεν βρέθηκε' });
        }

        var tollPKs = []; var dests = {};
        results1.forEach(row => {
            const { toll_pk, dest } = row;
            dests[toll_pk] = dest; tollPKs.push(toll_pk);
        });

        const query2 = 'SELECT op_name, sum(amount) as debt FROM pass p INNER JOIN tag t ON p.tag_pk = t.tag_pk INNER JOIN operator o ON o.op_pk = t.op_pk WHERE toll_pk IN (?) group by o.op_name';
        db.query(query2, [tollPKs], (err, results2) => {
            if (err) {
                console.error('Σφάλμα κατά την εκτέλεση του δεύτερου query:', err.message);
                return res.status(500).send({ error: 'Σφάλμα στη βάση δεδομένων' });
            } else if (results2.length === 0) {
                return res.status(204).send({ error: 'Δεν βρέθηκαν διελεύσεις!' });
            }

            if (format === 'csv') {
                const csvData = convertToCSV(results2);
                res.setHeader('Content-Type', 'text/csv; charset=utf-8');
                res.setHeader('Content-Disposition', 'attachment; filename="toll_charges.csv"');
                return res.status(200).send('\uFEFF' + csvData);
            } else {
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                return res.status(200).json(results2);
            }
        });
    });
});

/**
 * @swagger
 * /api/single_toll_per_dest/{toll_pk}/{name}:
 *   get:
 *     summary: Get statistics for a specific toll by destination
 *     parameters:
 *       - in: path
 *         name: toll_pk
 *         required: true
 *         schema:
 *           type: integer
 *         description: The primary key of the toll
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         description: The name of the toll
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *         description: Response format (default is json)
 *     responses:
 *       200:
 *         description: Successful retrieval of toll statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   destination:
 *                     type: string
 *                   passes:
 *                     type: integer
 *           text/csv:
 *             schema:
 *               type: string
 *               description: CSV formatted response
 *       400:
 *         description: Bad request
 *       401:
 *         description: Not authorized
 *       500:
 *         description: Internal server error
 *       204:
 *         description: No content
 */
app.get('/api/single_toll_per_dest/:toll_pk/:name', authenticate, (req, res) => {
    const format = req.query.format || 'json';
    const name = req.params.name;
    if (!name || name.trim() === '')
        return res.status(400).json({ error: 'Απαιτείται η παράμετρος "name"!' });

    var query1, param;
    if (name.endsWith('Μετωπικά')) {
        query1 = 'SELECT toll_pk, dest FROM toll WHERE name = ?';
        param = name + ' ';
    }
    else {
        query1 = 'SELECT toll_pk, dest FROM toll WHERE toll_pk = ?';
        param = req.params.toll_pk;
    }
    if (!param || param.trim() === '')
        return res.status(400).json({ error: 'Πιθανόν δεν έχει δοθεί το pk του διοδίου!' });
    
    db.query(query1, [param], (err, results1) => {
        if (err) {
            console.error('Σφάλμα κατά την εκτέλεση του query:', err.message);
            return res.status(500).send({ error: 'Σφάλμα στη βάση δεδομένων' });
        } else if (results1.length === 0) {
            return res.status(204).send({ error: 'Το διόδιο δεν βρέθηκε' });
        }

        var tollPKs = []; var dests = {};
        results1.forEach(row => {
            const { toll_pk, dest } = row;
            dests[toll_pk] = dest; tollPKs.push(toll_pk);
        });

        const query2 = 'SELECT count(*) as passes, toll_pk FROM pass WHERE toll_pk IN (?) group by toll_pk';
        db.query(query2, [tollPKs], (err, results2) => {
            if (err) {
                console.error('Σφάλμα κατά την εκτέλεση του δεύτερου query:', err.message);
                return res.status(500).send({ error: 'Σφάλμα στη βάση δεδομένων' });
            } else if (results2.length === 0) {
                return res.status(204).send({ error: 'Δεν βρέθηκαν διελεύσεις!' });
            }

            var result = [];
            results2.forEach(row => {
                result.push({
                    destination: dests[row["toll_pk"]],
                    passes: row["passes"]
                })
            });
            if (format === 'csv') {
                const csvData = convertToCSV(result);
                res.setHeader('Content-Type', 'text/csv; charset=utf-8');
                res.setHeader('Content-Disposition', 'attachment; filename="toll_dest_stat.csv"');
                return res.status(200).send('\uFEFF' + csvData);
            } else {
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                return res.status(200).json(result);
            }
        });
    });
});

/**
 * @swagger
 * /api/single_toll_per_hour/{toll_pk}/{name}:
 *   get:
 *     summary: Get statistics for a specific toll by hour
 *     parameters:
 *       - in: path
 *         name: toll_pk
 *         required: true
 *         schema:
 *           type: integer
 *         description: The primary key of the toll
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         description: The name of the toll
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *         description: Response format (default is json)
 *     responses:
 *       200:
 *         description: Successful retrieval of toll statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   hour:
 *                     type: string
 *                   passes:
 *                     type: integer
 *           text/csv:
 *             schema:
 *               type: string
 *               description: CSV formatted response
 *       400:
 *         description: Bad request
 *       401:
 *         description: Not authorized
 *       500:
 *         description: Internal server error
 *       204:
 *         description: No content
 */
app.get('/api/single_toll_per_hour/:toll_pk/:name', authenticate, (req, res) => {
    const format = req.query.format || 'json';
    const name = req.params.name;
    if (!name || name.trim() === '')
        return res.status(400).json({ error: 'Απαιτείται η παράμετρος "name"!' });

    var query1, param;
    if (name.endsWith('Μετωπικά')) {
        query1 = 'SELECT toll_pk, dest FROM toll WHERE name = ?';
        param = name + ' ';
    }
    else {
        query1 = 'SELECT toll_pk, dest FROM toll WHERE toll_pk = ?';
        param = req.params.toll_pk;
    }
    if (!param || param.trim() === '')
        return res.status(400).json({ error: 'Πιθανόν δεν έχει δοθεί το pk του διοδίου!' });
    
    db.query(query1, [param], (err, results1) => {
        if (err) {
            console.error('Σφάλμα κατά την εκτέλεση του query:', err.message);
            return res.status(500).send({ error: 'Σφάλμα στη βάση δεδομένων' });
        } else if (results1.length === 0) {
            return res.status(204).send({ error: 'Το διόδιο δεν βρέθηκε' });
        }

        var tollPKs = []; var dests = {};
        results1.forEach(row => {
            const { toll_pk, dest } = row;
            dests[toll_pk] = dest; tollPKs.push(toll_pk);
        });

        const query2 = 'SELECT date_occured FROM pass WHERE toll_pk IN (?)';
        db.query(query2, [tollPKs], (err, results2) => {
            if (err) {
                console.error('Σφάλμα κατά την εκτέλεση του δεύτερου query:', err.message);
                return res.status(500).send({ error: 'Σφάλμα στη βάση δεδομένων' });
            } else if (results2.length === 0) {
                return res.status(204).send({ error: 'Δεν βρέθηκαν διελεύσεις!' });
            }

            hours_passes = {"0:00":0, "1:00":0, "2:00":0, "3:00":0, "4:00":0, "5:00":0, "6:00":0, "7:00":0, 
                            "8:00":0, "9:00":0, "10:00":0, "11:00":0, "12:00":0, "13:00":0, "14:00":0, "15:00":0, 
                            "16:00":0, "17:00":0, "18:00":0, "19:00":0, "20:00":0, "21:00":0, "22:00":0, "23:00":0};
            results2.forEach(row => {
                var date = new Date(row["date_occured"]);
                var hour = `${date.getUTCHours()}:00`;
                hours_passes[hour]++;
            });
            const result = Object.entries(hours_passes).map(([hour, passes]) => ({
                hour,
                passes
            }));
            if (format === 'csv') {
                const csvData = convertToCSV(result);
                res.setHeader('Content-Type', 'text/csv; charset=utf-8');
                res.setHeader('Content-Disposition', 'attachment; filename="toll_hour_stat.csv"');
                return res.status(200).send('\uFEFF' + csvData);
            } else {
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                return res.status(200).json(result);
            }
        });
    });
});

// Ρούτα για σύνδεση χρήστη
/**
 * @swagger
 * /api/login:
 *   post:
 *     summary: Handle login request
 *     responses:
 *       200:
 *         description: Successful login
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   token:
 *                     type: string
 *       400:
 *         description: Bad request
 *       500:
 *         description: Internal server error
 *       204:
 *         description: No content
 */
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || username.trim() === '' || !password || password.trim() === '')
        return res.status(400).json({ error: 'Απαιτείται ο κωδικός και το όνομα χρήστη!' });

    const query = 'SELECT * FROM user WHERE username = ? AND password = ?';
    db.query(query, [username, password], (err, results) => {
        if (err) {
            console.error('Σφάλμα κατά την εκτέλεση του query:', err.message);
            return res.status(500).send({ error: 'Σφάλμα στη βάση δεδομένων' });
        } else {
            if (results.length === 0) {
                return res.status(204).json({ error: 'Λάθος όνομα χρήστη ή κωδικός!' });
            }
    
            const user = results[0];
            // Δημιουργία JWT Token
            const token = jwt.sign(
                { name: user.u_name, operator: user.op_pk, role: user.role, email: user.email, active: user.active },
                SECRET_KEY,
                { expiresIn: '2h' } // Λήξη σε 2 ώρες
            );
            // Αποστολή του token στο custom header
            res.setHeader('X-OBSERVATORY-AUTH', token);
            
            return res.status(200).json({ token: token });
        }
    });
});

/**
 * @swagger
 * /api/logout:
 *   post:
 *     summary: Handle logout request
 *     responses:
 *       200:
 *         description: Successful logout (No Content in Response)
 */
app.post('/api/logout', authenticate, (req, res) => {
    res.setHeader('X-OBSERVATORY-AUTH', '');
    return res.status(200).send();
});

app.listen(PORT, "0.0.0.0", () => console.log(`Server running on port ${PORT}!`));
