@echo off
chcp 65001
echo 🚀 Ξεκινάει η εγκατάσταση των npm πακέτων...

:: Έλεγχος αν υπάρχει package.json, αλλιώς δημιουργία
if not exist package.json (
    echo 📦 Δημιουργία package.json...
    npm init -y
)

:: Επεξεργασία του package.json για να αλλάξουμε το main, name και author
powershell -Command "(Get-Content package.json) -replace '\"main\": \"index.js\"', '\"main\": \"server.js\"' -replace '\"name\": \"[^\"]*\"', '\"name\": \"api\"' | Set-Content package.json"

echo ✅ Το package.json ενημερώθηκε με:
echo    📌 name: api
echo    📌 main: server.js
pause
