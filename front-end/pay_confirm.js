const token = sessionStorage.getItem('authToken');

// Functions to populate the table dynamically
function createTableWithBtn(table_id, endpoint, action_label, action) {
    const tableBody = document.getElementById(`${table_id}`).querySelector('.tbody');
    tableBody.innerHTML = ''; // Clear existing rows

    fetch(localStorage.getItem('baseURL') + `${endpoint}`, {
        method: 'GET',
        headers: {
            'X-OBSERVATORY-AUTH': token,
            'Content-Type': 'application/json'
        }
    }).then(response => {
        if (!response.ok)
            showErrorPopup(data.message || 'Σφάλμα σύνδεσης');
        return response.json();
    }).then(data => {
        data.forEach(row => {
            const tableRow = document.createElement('tr');

            // Add data cells
            Object.keys(row).forEach(key => {
                if (key != "char_id") {
                    const cell = document.createElement('td');
                    if (key == "amount")
                        cell.textContent = row[key] + ' €';
                    else if (key == "date_created" || key =="date_paid") 
                        cell.textContent = row[key].slice(0, 10);
                    else
                        cell.textContent = row[key];
                    tableRow.appendChild(cell);
                }
            });

            // Add action cell with the update button
            const actionCell = document.createElement('td');
            const updateButton = document.createElement('button');
            updateButton.textContent = `${action_label}`;
            updateButton.className = 'tick-btn';
            updateButton.addEventListener('click', () => action(row.char_id));
            actionCell.appendChild(updateButton);
            tableRow.appendChild(actionCell);

            // Append the row to the table
            tableBody.appendChild(tableRow);
        });
    }).catch(error => {
        console.error(error);
        showErrorPopup('Κάτι πήγε στραβά. Προσπαθήστε ξανά.');
    });
}

function createTable(table_id, endpoint) {
    const tableBody = document.getElementById(`${table_id}`).querySelector('.tbody');
    tableBody.innerHTML = ''; // Clear existing rows

    fetch(localStorage.getItem('baseURL') + `${endpoint}`, {
        method: 'GET',
        headers: {
            'X-OBSERVATORY-AUTH': token,
            'Content-Type': 'application/json'
        }
    }).then(response => {
        if (!response.ok)
            showErrorPopup(data.message || 'Σφάλμα σύνδεσης');
        return response.json();
    }).then(data => {
        data.forEach(row => {
            const tableRow = document.createElement('tr');

            // Add data cells
            Object.keys(row).forEach(key => {
                const cell = document.createElement('td');
                if (key == "amount")
                    cell.textContent = row[key] + ' €';
                else if (key == "date_created" || key =="date_paid") 
                    cell.textContent = row[key].slice(0, 10);
                else
                    cell.textContent = row[key];
                tableRow.appendChild(cell);
                
            });

            // Append the row to the table
            tableBody.appendChild(tableRow);
        });
    }).catch(error => {
        console.error(error);
        showErrorPopup('Κάτι πήγε στραβά. Προσπαθήστε ξανά.');
    });
}

// Function to handle update button click
function pay(char_id) {
    fetch(localStorage.getItem('baseURL') + `/pay`, {
        method: 'POST',
        headers: {
            'X-OBSERVATORY-AUTH': token,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({char_id}),
    }).then(response => {
        if (!response.ok)
            throw new Error('Failed to update the record');
        return response.json();
    }).then(data => {
        console.log('Update successful:', data);
        createTableWithBtn('table1', '/owing', 'Πληρωμή', pay);
        createTable('table4', '/to_confirm');
    }).catch(error => {
        console.error(error.message || 'Σφάλμα σύνδεσης');
    });
}


function confirm(char_id) {
    fetch(localStorage.getItem('baseURL') + `/confirm`, {
        method: 'POST',
        headers: {
            'X-OBSERVATORY-AUTH': token,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({char_id}),
    }).then(response => {
        if (!response.ok) {
            throw new Error('Failed to update the record');
        }
        return response.json();
    }).then(data => {
        console.log('Update successful:', data);
        createTableWithBtn('table3', '/to_be_confirmed', 'Επιβεβαίωση', confirm);
    })
    .catch(error => {
        console.error(error.message || 'Σφάλμα σύνδεσης');
    });
}

// Πίνακας οφειλών από εμένα
createTableWithBtn('table1', '/owing', 'Πληρωμή', pay);
// Πίνακας οφειλών προς εμένα
createTable('table2', '/owed');
// Πίνακας επιβεβαιώσεων για εμένα
createTableWithBtn('table3', '/to_be_confirmed', 'Επιβεβαίωση', confirm);
// Πίνακας επιβεβαιώσεων από εμένα
createTable('table4', '/to_confirm');