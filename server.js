const express = require("express");
const app = express();
const path = require("path");

// ----- Mysql ------

app.use(express.static(path.join(__dirname, "img")));
app.use(express.static(path.join(__dirname, "views")));
app.use(express.static(path.join(__dirname, "css")));
app.use(express.static(path.join(__dirname, "js")));
app.use(express.urlencoded({extended: true}));
app.use(express.json());


app.set('view engine', 'ejs');

app.get('/', function(req, res){
    res.render('index');
});

app.get("/adminSupReq", function (req, res) {
  res.sendFile(path.join(__dirname, "/views/admin/material_requests.html"))
});


// ---- Middleware -----
// app.use(express.static(path.join(__dirname, "public")));
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// Page Router from separated file
require("./routes.js")(app);

// // APIs
require("./api.js");

const PORT = 4777;
app.listen(PORT, (req, res) => {
  console.log("Server is running on port " + PORT);
});
