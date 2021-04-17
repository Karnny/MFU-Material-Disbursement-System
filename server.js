require('dotenv').config();
const express = require("express");
const app = express();
const path = require("path");
const { OAuth2Client } = require('google-auth-library');
const session = require('express-session');
const MemoryStore = require('memorystore')(session);
const PORT = process.env.PORT || 4777;
// ----- Mysql ------



// ---- Middleware -----
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ========= Session ==========
app.use(session({
  cookie: { maxAge: 24*60*60*1000, httpOnly: true},
  store: new MemoryStore({
    checkPeriod: 24*60*60*1000
  }),
  secret: process.env.SESSION_SECRET,
  resave: true,
  saveUninitialized: false
}));

// Page Router from separated file
require("./routes.js")(app);

// APIs
require("./api.js")(app);

const PORT = 4777;
app.listen(PORT, (req, res) => {
  console.log("Server is running on port " + PORT);
});
