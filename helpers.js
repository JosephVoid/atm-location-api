const geolib = require('geolib');

module.exports = getAtmDist = (userLat, userLon, AtmList) => {
    var ATMdist = [];
    AtmList.forEach(ATM => {
        ATMdist.push(
            {dist: geolib.getDistance({latitude: userLat, longitude: userLon},{latitude: ATM.lat, longitude: ATM.lon}), 
            atm: ATM}
        );
    });
    return ATMdist;
}