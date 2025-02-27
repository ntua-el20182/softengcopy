const token = sessionStorage.getItem('authToken');

// Function to populate the table dynamically
function createHistoryTable() {
    const tableBody = document.getElementById('table_body');
    tableBody.innerHTML = ''; // Clear existing rows

    fetch(localStorage.getItem('baseURL') + '/history', {
        method: 'GET',
        headers: {
            'X-OBSERVATORY-AUTH': token,
            'Content-Type': 'application/json'
        }
    }).then(response => {
        if (!response.ok)
            throw new Error (data.message || 'Σφάλμα σύνδεσης');
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
    });
}

createHistoryTable();

// Function to collect filter values
function getFilters() {
    const category = document.getElementById('category-filter').value;
    const dateRange = document.getElementById('dateRange').value;
    const rangeStart = document.getElementById('rangeStart').value;
    const rangeEnd = document.getElementById('rangeEnd').value;

    const checkboxes = document.querySelectorAll('input[name="checkboxGroup"]:checked');
    const involvedParties = Array.from(checkboxes).map(checkbox => checkbox.value);

    return {
        category,
        dateRange,
        rangeStart,
        rangeEnd,
        involvedParties
    };
}

// Event listener for the "Apply Filters" button
document.getElementById('applyFilters').addEventListener('click', () => {
    const filters = getFilters();
    const tableBody = document.getElementById('table_body');
    tableBody.innerHTML = ''; // Clear existing rows

    const category = document.getElementById('category-filter').value;
    const dateRange = document.getElementById('dateRange').value.
                            split(" to ").map(date => date.replace(/-/g, "")).join("-") || "all";
    const s_amount = document.getElementById('rangeStart').value;
    const e_amount = document.getElementById('rangeEnd').value;
    const checkboxes = document.querySelectorAll('input[name="checkboxGroup"]:checked');
    const stakeholders = Array.from(checkboxes).map(checkbox => parseInt(checkbox.value)).join(',') || '1,2,3,4,5,6,7,8';

    const urlParams = `${category}/${dateRange}/${s_amount}/${e_amount}/${stakeholders}`;

    fetch(localStorage.getItem('baseURL') + `/history_filtered/${urlParams}`, {
        method: 'GET',
        headers: {
            'X-OBSERVATORY-AUTH': token,
            'Content-Type': 'application/json'
        }
    }).then(response => {
        if (!response.ok)
            throw new Error (data.message || 'Σφάλμα σύνδεσης');
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
    });
});

// Event listener for the "Download" button
document.getElementById('download-btn').addEventListener('click', (event) =>{
    event.preventDefault(); // Prevent navigation
    const table = document.getElementById('table_id');
    const rows = Array.from(table.querySelectorAll('tr'));

    const csvContent = rows.map(row => {
        const cells = Array.from(row.querySelectorAll('th, td'));
        return cells.map(cell => `${cell.textContent.replace(/"/g, '""')}`).join('; ');
    }).join('\n');

    console.log(csvContent);

    // Δημιουργία blob και προσωρινού URL
    const bom = '\uFEFF'; // Byte Order Mark για UTF-8
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    // Δημιουργία προσωρινού link για λήψη
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'history_table.csv');
    document.body.appendChild(link); // Προσθήκη του link στο DOM

    // Αυτόματη ενεργοποίηση λήψης
    link.click();

    // Καθαρισμός του προσωρινού link και URL
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
});