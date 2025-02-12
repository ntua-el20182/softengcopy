./se2436 logout 
read -p "Press any key to resume ..."
./se2436 login --username admin --passw freepasses4all
read -p "Press any key to resume ..."
./se2436 healthcheck
read -p "Press any key to resume ..."
./se2436 resetpasses
read -p "Press any key to resume ..."
./se2436 healthcheck
read -p "Press any key to resume ..."
./se2436 resetstations
read -p "Press any key to resume ..."
./se2436 healthcheck
read -p "Press any key to resume ..."
./se2436 admin --addpasses --source ./passes36.csv
read -p "Press any key to resume ..."
./se2436 healthcheck
read -p "Press any key to resume ..."
./se2436 tollstationpasses --station AM08 --from 20220504 --to 20220518 --format json
read -p "Press any key to resume ..."
./se2436 tollstationpasses --station NAO04 --from 20220504 --to 20220518 --format csv
read -p "Press any key to resume ..."
./se2436 tollstationpasses --station NO01 --from 20220504 --to 20220518 --format csv
read -p "Press any key to resume ..."
./se2436 tollstationpasses --station OO03 --from 20220504 --to 20220518 --format csv
read -p "Press any key to resume ..."
./se2436 tollstationpasses --station XXX --from 20220504 --to 20220518 --format csv
read -p "Press any key to resume ..."
./se2436 tollstationpasses --station OO03 --from 20220504 --to 20220518 --format YYY
read -p "Press any key to resume ..."
./se2436 errorparam --station OO03 --from 20220504 --to 20220518 --format csv
read -p "Press any key to resume ..."
./se2436 tollstationpasses --station AM08 --from 20220505 --to 20220516 --format json
read -p "Press any key to resume ..."
./se2436 tollstationpasses --station NAO04 --from 20220505 --to 20220516 --format csv
read -p "Press any key to resume ..."
./se2436 tollstationpasses --station NO01 --from 20220505 --to 20220516 --format csv
read -p "Press any key to resume ..."
./se2436 tollstationpasses --station OO03 --from 20220505 --to 20220516 --format csv
read -p "Press any key to resume ..."
./se2436 tollstationpasses --station XXX --from 20220505 --to 20220516 --format csv
read -p "Press any key to resume ..."
./se2436 tollstationpasses --station OO03 --from 20220505 --to 20220516 --format YYY
read -p "Press any key to resume ..."
./se2436 passanalysis --stationop AM --tagop NAO --from 20220504 --to 20220518 --format json
read -p "Press any key to resume ..."
./se2436 passanalysis --stationop NAO --tagop AM --from 20220504 --to 20220518 --format csv
read -p "Press any key to resume ..."
./se2436 passanalysis --stationop NO --tagop OO --from 20220504 --to 20220518 --format csv
read -p "Press any key to resume ..."
./se2436 passanalysis --stationop OO --tagop KO --from 20220504 --to 20220518 --format csv
read -p "Press any key to resume ..."
./se2436 passanalysis --stationop XXX --tagop KO --from 20220504 --to 20220518 --format csv
read -p "Press any key to resume ..."
./se2436 passanalysis --stationop AM --tagop NAO --from 20220505 --to 20220516 --format json
read -p "Press any key to resume ..."
./se2436 passanalysis --stationop NAO --tagop AM --from 20220505 --to 20220516 --format csv
read -p "Press any key to resume ..."
./se2436 passanalysis --stationop NO --tagop OO --from 20220505 --to 20220516 --format csv
read -p "Press any key to resume ..."
./se2436 passanalysis --stationop OO --tagop KO --from 20220505 --to 20220516 --format csv
read -p "Press any key to resume ..."
./se2436 passanalysis --stationop XXX --tagop KO --from 20220505 --to 20220516 --format csv
read -p "Press any key to resume ..."
./se2436 passescost --stationop AM --tagop NAO --from 20220504 --to 20220518 --format json
read -p "Press any key to resume ..."
./se2436 passescost --stationop NAO --tagop AM --from 20220504 --to 20220518 --format csv
read -p "Press any key to resume ..."
./se2436 passescost --stationop NO --tagop OO --from 20220504 --to 20220518 --format csv
read -p "Press any key to resume ..."
./se2436 passescost --stationop OO --tagop KO --from 20220504 --to 20220518 --format csv
read -p "Press any key to resume ..."
./se2436 passescost --stationop XXX --tagop KO --from 20220504 --to 20220518 --format csv
read -p "Press any key to resume ..."
./se2436 passescost --stationop AM --tagop NAO --from 20220505 --to 20220516 --format json
read -p "Press any key to resume ..."
./se2436 passescost --stationop NAO --tagop AM --from 20220505 --to 20220516 --format csv
read -p "Press any key to resume ..."
./se2436 passescost --stationop NO --tagop OO --from 20220505 --to 20220516 --format csv
read -p "Press any key to resume ..."
./se2436 passescost --stationop OO --tagop KO --from 20220505 --to 20220516 --format csv
read -p "Press any key to resume ..."
./se2436 passescost --stationop XXX --tagop KO --from 20220505 --to 20220516 --format csv
read -p "Press any key to resume ..."
./se2436 chargesby --opid NAO --from 20220504 --to 20220518 --format json
read -p "Press any key to resume ..."
./se2436 chargesby --opid GE --from 20220504 --to 20220518 --format csv
read -p "Press any key to resume ..."
./se2436 chargesby --opid OO --from 20220504 --to 20220518 --format csv
read -p "Press any key to resume ..."
./se2436 chargesby --opid KO --from 20220504 --to 20220518 --format csv
read -p "Press any key to resume ..."
./se2436 chargesby --opid NO --from 20220504 --to 20220518 --format csv
read -p "Press any key to resume ..."
./se2436 chargesby --opid NAO --from 20220505 --to 20220516 --format json
read -p "Press any key to resume ..."
./se2436 chargesby --opid GE --from 20220505 --to 20220516 --format csv
read -p "Press any key to resume ..."
./se2436 chargesby --opid OO --from 20220505 --to 20220516 --format csv
read -p "Press any key to resume ..."
./se2436 chargesby --opid KO --from 20220505 --to 20220516 --format csv
read -p "Press any key to resume ..."
./se2436 chargesby --opid NO --from 20220505 --to 20220516 --format csv
