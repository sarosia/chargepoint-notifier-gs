/* global DriveApp SpreadsheetApp GmailApp UrlFetchApp */

function openSpreadsheet() {  //eslint-disable-line no-unused-vars
    var file = DriveApp.getFilesByName("ChargePoint Stations");
    var spreadsheet = SpreadsheetApp.open(file.next());

    var sheet = spreadsheet.getSheets()[0];
    var config = spreadsheet.getSheets()[1];
    var values = config.getDataRange().getValues();

    var oldAvailables = {};
    var oldStations = sheet.getDataRange().getValues();
    for (var i = 0; i < oldStations.length; i += 2) {
        oldAvailables[oldStations[i * 2][0]] = oldStations[i * 2 + 1][0];
    }

    var username = values[0][1];
    var password = values[1][1];
    var lat = values[2][1];
    var lng = values[3][1];
    var delta = values[4][1];

    var stations = fetchChargePoint(username, password, lat, lng, delta);
    var keys = Object.keys(stations);
    sheet.clearContents();

    var availableChanged = false;

    keys.forEach(function (key, i) {
        var station = stations[key];
        sheet.getRange(i * 2 + 1, 1).setValue(station.name);
        sheet.getRange(i * 2 + 2, 1).setValue(station.available);
        sheet.getRange(i * 2 + 2, 2).setValue(station.total);

        if (oldAvailables[station.name] !== station.available) {
            availableChanged = true;
        }
    });

    if (availableChanged) {
        var emailContent = "";
        keys.forEach(function (key) {
            var station = stations[key];
            emailContent += station.name + " - " + station.available + "/" + station.total + "\n";
        });

        GmailApp.sendEmail("tochiming@gmail.com", "ChargePoint Station Available", emailContent, {
            name: "ChargePoint Scraper"
        });
    }
}

function fetchChargePoint(username, password, lat, lng, delta) {
    var authResponse = UrlFetchApp.fetch("https://na.chargepoint.com/users/validate", {
        method: "post",
        payload: {
            user_name: username,
            user_password: password
        }
    });

    var sessionId = authResponse.getHeaders()["Set-Cookie"].split(";")[0];

    var url = "https://na.chargepoint.com/dashboard/getChargeSpots?" +
        "lat=" + lat + "&" +
        "lng=" + lng + "&" +
        "ne_lat=" + (lat + delta) + "&" +
        "ne_lng=" + (lng + delta) + "&" +
        "sw_lat=" + (lat - delta) + "&" +
        "sw_lng=" + (lng - delta) + "&" +
        "f_available=false" + "&" +
        "f_free=false";

    var response = JSON.parse(UrlFetchApp.fetch(url, {
        headers: {
            cookie: sessionId
        }
    }));

    var summaries = response[0]["station_list"]["summaries"];

    summaries.filter(function (station) {
        return station["payment_type"] === "free";
    });

    var stations = {};

    summaries.forEach(function (summary) {
        var name = summary["station_name"].join(" ").split(",")[0];
        var available = summary["port_count"]["available"];
        var total = summary["port_count"]["total"];

        var station = stations[name];
        if (!station) {
            station = stations[name] = {
                name: name,
                available: 0,
                total: 0
            };
        }
        station.available += available;
        station.total += total;
    });

    return stations;
}
