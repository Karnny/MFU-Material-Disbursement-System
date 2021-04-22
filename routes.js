const path = require("path");
const checkAuth = require('./checkAuth');
function router(app) {

  // Page route root
  app.get("/", (req, res) => {
    if (req.session.user) {
      res.redirect(req.session.user.main_url);
    } else {
      res.redirect('/login');
    }
    
  });


  //other routes here..
  app.get("/login", (req, res) => {
    if (req.session.user) {
      res.redirect(req.session.user.main_url);
    } else {
      res.render('login');
    }
  });

  app.get('/index', checkAuth, (req, res) => {
    res.render('index');
  });

  app.get('/manageUsers', checkAuth, (req, res) => {
    if (req.session.user.role_id != 4) {
      return res.redirect(req.session.user.main_url);
    }
    
    res.render('manageUsers');
  });


}

module.exports = router;
