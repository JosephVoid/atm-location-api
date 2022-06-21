const geolib = require('geolib');

module.exports = getAtmDist = (userLat, userLon, AtmList) => {
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