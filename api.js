const path = require("path");
const bcrypt = require("bcrypt");

// mysql
const mysql = require("mysql");
var database;
try {
    const dbConfig = require("./config/dbConfig.js");
    database = mysql.createConnection(dbConfig);
} catch (error) {
    console.log("WARNING: The database could not be connected, ignore if you are FRONT-END devs and testing the page routes.");
}


// API function fields
function apis(app) {

  // API services go here
  app.post("/api/login", (req, res) => {
    // DO LOGIN AUTHENTICATION THINGS..
    
  });

}

module.exports = apis;
