const path = require("path");

function router(app) {

  // Page route root
  app.get("/", (req, res) => {
    if (req.session.user) {
      res.redirect(req.session.user.main_url);
    } else {
      res.render('login');
    }
    
  });

  
  //other routes here..
  app.get("/login", (req, res) => {
    res.render("login");
  });


}

module.exports = router;
