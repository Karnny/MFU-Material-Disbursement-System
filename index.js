const express = require('express');
const app = express();
const path = require('path');
const bcrypt = require('bcrypt');


// ----- Mysql ------
const mysql = require('mysql');
const dbConfig = require('./config/dbConfig.js');
const database = mysql.createConnection(dbConfig);

// ---- Middleware -----
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Page Router from separated file
require("./routes.js")(app);


const PORT = 3777;
app.listen(PORT, (req, res) => {
    console.log("Server is running on port " + PORT);
});