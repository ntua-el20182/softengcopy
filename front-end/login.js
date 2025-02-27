function showErrorPopup(message) {
    // Δημιουργία του pop-up δυναμικά
    const errorPopup = document.createElement('div');
    errorPopup.classList.add('error-popup');
    errorPopup.textContent = message;

    // Προσθήκη στο body
    document.body.appendChild(errorPopup);

    // Αφαίρεση μετά από 3 δευτερόλεπτα
    setTimeout(() => {
        errorPopup.classList.add('fade-out'); // Προσθήκη animation fade-out
        errorPopup.addEventListener('animationend', () => {
            errorPopup.remove(); // Αφαίρεση μετά το τέλος του animation
        });
    }, 3000);
}

function base64UrlDecode(str) {
    return decodeURIComponent(atob(str.replace(/-/g, '+').replace(/_/g, '/')));
}

const loginForm = document.getElementById('login-form');

loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    // Πάρε τα στοιχεία από τη φόρμα
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    // Αίτημα στο API για τα δεδομένα
    fetch(localStorage.getItem('baseURL') + '/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ username, password })
    }).then(response => {
        if (!response.ok)
            showErrorPopup(data.message || 'Σφάλμα σύνδεσης');
        return response.json();
    }).then(data => {
        console.log('Απάντηση από backend:', data);

        if (!data.token) {
            showErrorPopup('Δεν ελήφθη token, αποτυχία σύνδεσης.');
        }
        
        const payload = JSON.parse(base64UrlDecode(data.token.split('.')[1]));

        if (!payload.active) {
            showErrorPopup('Δεν είστε ενεργός χρήστης!');
            return;
        }

        sessionStorage.setItem('authToken', data.token);
        localStorage.setItem('authTokenLoc', data.token);

        // Μετάβαση στη σελίδα ανάλογα με τον ρόλο
        switch (payload.role) {
            case 'op_user':
                window.location.href = 'company_home.html';
                break;
            case 'admin':
                window.location.href = 'admin_home.html';
                break;
            case 'data_analyst':
                window.location.href = 'analyst_home.html';
                break;
            default:
                throw new Error('Άγνωστος ρόλος χρήστη');
        }
    }).catch(error => {
        console.error(error);
    });
});