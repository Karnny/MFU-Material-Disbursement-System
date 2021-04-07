const express = require("express");
const app = express();
const path = require("path");
const PORT = 4777;
// ----- Mysql ------



// ---- Middleware -----
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.set('view engine', 'ejs');

// Page Router from separated file
require("./routes.js")(app);

// APIs
require("./api.js");


app.listen(PORT, (req, res) => {
  console.log("Server is running on port " + PORT);
});
