const express = require("express");
const app = express();
const path = require("path");

// ----- Mysql ------



// ---- Middleware -----
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Page Router from separated file
require("./routes.js")(app);

// APIs
require("./api.js");

const PORT = 4777;
app.listen(PORT, (req, res) => {
  console.log("Server is running on port " + PORT);
});
