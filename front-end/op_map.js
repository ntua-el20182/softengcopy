// Δημιουργία marker με custom εικονίδια
var headpin = L.icon({
    iconUrl: 'red-pin.png', // Προσθέστε το path του εικονιδίου
    iconSize: [40, 24], // Μέγεθος εικονιδίου
    iconAnchor: [20, 24], // Κέντρο του εικονιδίου
    popupAnchor: [0, -30] // Θέση popup
});

var sidepin = L.icon({
    iconUrl: 'orange-pin.png', // Προσθέστε το path του εικονιδίου
    iconSize: [40, 24], // Μέγεθος εικονιδίου
    iconAnchor: [20, 24], // Κέντρο του εικονιδίου
    popupAnchor: [0, -30] // Θέση popup
});

// Αυτοκινητόδρομοι
var roads = [
    { points: [[39.48576, 20.26016], [40.94529, 26.30905]], color: 'green'}, // Εγνατία Οδός
    { points: [[40.62359, 21.06037], [40.22652, 21.55327]], color: 'green'}, // Εγνατία Οδός πρός Ιεροπηγή
    { points: [[41.12733, 22.55164], [40.69415, 22.84585]], color: 'green'}, // Εγνατία Οδός προς Ευζώνους
    { points: [[41.37278, 23.36073], [40.73906, 23.01072]], color: 'green'}, // Εγνατία Οδός προς Προμαχώνα
    { points: [[38.90562, 22.83401], [40.55574, 22.59927]], color: 'orange'}, // Αυτοκινητόδρομος Αιγαίου
    { points: [[38.77782, 22.76424], [38.90562, 22.83401]], color: 'purple'}, // Κεντρική Οδός
    { points: [[38.82250, 22.48892], [39.70187, 21.60604]], color: 'purple'}, // Κεντρική Οδός (Ξυνιάδα-Τρίκαλα)
    { points: [[38.04970, 23.74261], [38.77782, 22.76424]], color: 'red'}, // Νέα Οδός (Τμήμα ε.ο. Αθηνών - Θεσ/νίκης)
    { points: [[38.33382, 21.76609], [39.59035, 20.82232]], color: 'red'}, // Νέα Οδός (Αντίρριο - Ιωάννινα)
    { points: [[38.29946, 21.79437], [38.33382, 21.76609]], color: 'coral'}, // Γέφυρα Ρίου - Αντιρρίου
    { points: [[38.05072, 23.50523], [37.91864, 23.92771]], color: 'black'}, // Αττική Οδός
    { points: [[38.06334, 23.64565], [38.09426, 23.68712]], color: 'black'}, // Αττική Οδός (Προς Λεωφ. ΝΑΤΟ)
    { points: [[37.97532, 23.79639], [37.99002, 23.91702]], color: 'black'}, // Αττική Οδός (Από Κατεχάκη)
    { points: [[38.00018, 23.81995], [38.02723, 23.82974]], color: 'black'}, // Αττική Οδός (Από Δημόκριτο)
    { points: [[38.05578, 23.52688], [38.18429, 21.69225]], color: 'brown'}, // Ολυμπία Οδός
    { points: [[37.91909, 22.91330], [37.04576, 22.12603]], color: 'blue'}, // Μορέας
    { points: [[37.36015, 22.14744], [37.09576, 22.42877]], color: 'blue'} // Μορέας (Προς Σπάρτη)
]

// Σχεδιασμός όλων των αυτοκινητοδρόμων (σειριακή συνάρτηση)
async function fetchRoutes() {
    const loadingScreen = document.getElementById('loading-screen');

    for (let route of roads) {
        const point1 = route.points[0];
        const point2 = route.points[1];
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${point1[1]},${point1[0]};${point2[1]},${point2[0]}?overview=full&geometries=geojson`;
        try {
            const response = await fetch(osrmUrl);
            const data = await response.json();

            if (data.routes && data.routes.length > 0) {
                const routeGeometry = data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
                L.polyline(routeGeometry, {
                    color: route.color,
                    weight: 4,
                    opacity: 1
                }).addTo(map);
            }
        } catch (error) {
            console.error('Σφάλμα στη λήψη διαδρομής:', error);
        }
    }

    loadingScreen.style.display = 'none';
}


// Δημιουργία χάρτη
var map = L.map('map').setView([39.0742, 23.00], 7);  // Κέντρο Ελλάδας, zoom 6
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
}).addTo(map);

const token = sessionStorage.getItem('authToken');
// Αίτημα στο API για τα δεδομένα
fetch(localStorage.getItem('baseURL') + '/toll', {
    method: 'GET',
    headers: {
        'X-OBSERVATORY-AUTH': token,
        'Content-Type': 'application/json'
    }
}).then(response => {
    if (!response.ok) {
        throw new Error('Network response was not ok');
    }
    return response.json();
}).then(data => {
    const uniqueStations = new Set();
    data.forEach(row => {
        // Ανάλογα με το αν ο σταθμός είναι μετωπικός ή πλευρικός:
        // var pin: Χρησιμοποιούμε διαφορετική καρφίτσα στον χάρτη
        // var name: Τυπώνουμε την κατεύθυνση
        // var isSide: Συμπεριλαμβάνουμε στον χάρτη όλες τις κατευθύνσεις
        // var code: Εμφανίζουμε μαζί τους κωδικούς όλων των κατευθύνσεων
        if (row.name.endsWith('Μετωπικά ')) {
            var pin = headpin;
            var name = row.name;
            var isSide = false;
            var nextCode = parseInt(row.toll_id.slice(-2), 10) + 1;
            if (row.op_pk != 1)
                var code = row.toll_id + ', ' + row.toll_id.slice(0, -2) + nextCode.toString().padStart(2, "0");
            else
                var code = row.toll_id;
        }
        else {
            var pin = sidepin;
            var name = row.name + '(' + row.dest +')';
            var isSide = true;
            var code = row.toll_id;
        }

        if (!uniqueStations.has(row.name) || isSide) {
            var point = [row.coord_lat, row.coord_long];
            var marker = L.marker(point, { icon: pin }).addTo(map).bindPopup('Σημείο');
            // Δημιουργία πίνακα τιμών (χρησιμοποιούμε έναν πίνακα για τις τιμές και τα εικονίδια)
            const categories = [
                { icon: 'cat1.jpeg', price: row.price1 },
                { icon: 'cat2.jpeg', price: row.price2 },
                { icon: 'cat3.jpeg', price: row.price3 },
                { icon: 'cat4.jpeg', price: row.price4 }
            ];

            // Δημιουργία του πίνακα δυναμικά
            const priceTable = `
                <table style="width: 75%; border-collapse: collapse;">
                    <thead>
                        <tr>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Κατηγορία</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Τιμή</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${categories.map(category => `
                            <tr>
                                <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">
                                    <img src="${category.icon}" style="width: 140px; height: 80px; vertical-align: middle;" />
                                </td>
                                <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">
                                    ${category.price} €
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;

            marker.bindPopup(`
                <div class="popup-content">
                    <h4 class="popup-content">${name}</h4>
                    <p class="popup-content">Κωδικός: ${code}</p>
                    <p class="popup-content">Τοποθεσία: ${row.locality}</p>
                    <p class="popup-content">Δρόμος: ${row.road}</p>
                    <h5>Τιμές:</h5>
                    ${priceTable}
                    <a href="comp_toll_statistics.html?toll_pk=${row.toll_pk}&name=${(row.name)}&dest=${(row.dest)}" class="popup-button" target="_blank" 
                    style="display: inline-block; text-align: center; color: white;  margin-top: 10px; text-decoration: none;">
                    Ετήσια στατιστικά
                    </a>    
                </div>
            `);
            

            if (!isSide)
                uniqueStations.add(row.name);
        }
    });
}).catch(error => {
    console.error('Υπήρξε ένα πρόβλημα με το αίτημα:', error);
});
// Κάλεσε τη συνάρτηση για να φορτώσεις τις διαδρομές
fetchRoutes();


// Δημιουργία Υπομνήματος
var legend = L.control({ position: 'bottomright' }); // Τοποθέτηση κάτω δεξιά
legend.onAdd = function (map) {
    var div = L.DomUtil.create('div', 'legend'); // Δημιουργία div με class "legend"
    div.innerHTML = `
        <h4>Υπόμνημα</h4>
        <div><span style="background: black;"></span> Αττική Οδός</div>
        <div><span style="background: orange;"></span> Αυτοκινητόδρομος Αιγαίου</div>
        <div><span style="background: coral;"></span> Γέφυρα Α.Ε.</div>
        <div><span style="background: green;"></span> Εγνατία Οδός Α.Ε.</div>
        <div><span style="background: purple;"></span> Κεντρική Οδός</div>
        <div><span style="background: blue;"></span> Μορέας</div>
        <div><span style="background: red;"></span> Νέα Οδός</div>
        <div><span style="background: brown;"></span> Ολυμπία Οδός</div>
        <div>
            <img src="red-pin-leg.png" alt="red-pin" style="width: 25px; height: 20px; vertical-align: middle;" /> 
            Μετωπικός Σταθμός Διοδίων
        </div>
        <div>
            <img src="orange-pin-leg.png" alt="orange-pin" style="width: 25px; height: 20px; vertical-align: middle;" /> 
            Πλευρικός Σταθμός Διοδίων
        </div>
    `;
    return div;
};
legend.addTo(map); // Προσθήκη του υπομνήματος στον χάρτη