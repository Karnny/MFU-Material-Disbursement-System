const mysql = require('mysql');

const config = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    dateString: true
};

const database = mysql.createConnection(config);

module.exports = database;