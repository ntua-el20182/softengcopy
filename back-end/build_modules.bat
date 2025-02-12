@echo off
chcp 65001

:: Εγκατάσταση dependencies
echo 📌 Εγκατάσταση dependencies...
npm install express dotenv mysql2 cors jsonwebtoken path fs body-parser querystring assert dayjs multer csv-parser swagger-jsdoc swagger-ui-express

echo ✅ Όλα τα πακέτα εγκαταστάθηκαν!
pause
