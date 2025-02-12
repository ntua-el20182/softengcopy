:: Εγκατάσταση dependencies
echo 📌 Εγκατάσταση dependencies...
npm install express dotenv mysql2 cors jsonwebtoken path fs body-parser querystring assert dayjs multer csv-parser swagger-jsdoc swagger-ui-express commander

:: Εγκατάσταση axios και commander στον φάκελο ../cli-client
echo 📦 Εγκατάσταση axios και commander στο ../cli-client...
cd ..\cli-client
npm install axios commander

echo ✅ Όλα τα πακέτα εγκαταστάθηκαν!
pause
