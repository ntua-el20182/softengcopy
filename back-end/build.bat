@echo off
npm set init-main "server.js"
npm set init-name "api"

echo 🚀 Ξεκινάει η εγκατάσταση των npm πακέτων...

:: Έλεγχος αν υπάρχει package.json, αλλιώς δημιουργία
if not exist package.json (
    echo 📦 Δημιουργία package.json...
    npm init -y
)

:: Εγκατάσταση dependencies
echo 📌 Εγκατάσταση dependencies...
npm install express dotenv mysql2 cors jsonwebtoken path fs body-parser querystring assert dayjs multer csv-parser

echo ✅ Όλα τα πακέτα εγκαταστάθηκαν!
pause