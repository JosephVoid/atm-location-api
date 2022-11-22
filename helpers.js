const geolib = require('geolib');
const fs = require('fs');

const getAtmDist = (userLat, userLon, AtmList) => {
    var ATMdist = [];
    AtmList.forEach(ATM => {
        ATMdist.push(
            {dist: geolib.getDistance({latitude: userLat, longitude: userLon},{latitude: ATM.LATITIUDE, longitude: ATM.LONGITUDE}), 
            atm: ATM}
        );
    });
    console.log(userLat, userLon);
    return ATMdist;
}

const writeToLog = (dataToWrite) => {
  fs.appendFile('log.txt', dataToWrite, function (err) {
    if (err) throw err;
    console.log('Saved!');
  });
}

module.exports = {
  writeToLog,
  getAtmDist
}