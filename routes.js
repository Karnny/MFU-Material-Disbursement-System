const path = require("path");

function router(app) {

  // Page route root
  app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "/views/index.html"));
  });


  //other routes here..
  app.get("/login", (req, res) => {
    res.sendFile(path.join(__dirname, "/views/login.html"));
  });

  //other routes here..
  app.get("/test", (req, res) => {
    res.render(path.join(__dirname, "/views/super admin/manageUsers.ejs"));
  });

}

module.exports = router;
