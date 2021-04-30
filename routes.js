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

  // Role ID Name: 1 = User, 2 = Admin, 3 = Super Advisor, 4 = Super Admin
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
    
    res.render('manageUsers', {user: req.session.user});
  });

  app.get('/admin/allSupplies', checkAuth, (req, res) => {
    if (req.session.user.role_id != 2) {
      return res.redirect(req.session.user.main_url);
    }

    res.render('admin_all_supplies', {user: req.session.user});
  });

  app.get('/admin/editHistory', checkAuth, (req, res) => {
    if (req.session.user.role_id != 2) {
      return res.redirect(req.session.user.main_url);
    }

    res.render('admin_edit_info_history', {user: req.session.user});
  });

  app.get('/admin/updateRequest', checkAuth, (req, res) => {
    if (req.session.user.role_id != 2) {
      return res.redirect(req.session.user.main_url);
    }

    res.render('admin_update_req', {user: req.session.user});
  });
  
  app.get('/admin/requestHistory', checkAuth, (req, res) => {
    if (req.session.user.role_id != 2) {
      return res.redirect(req.session.user.main_url);
    }

    res.render('admin_req_history', {user: req.session.user});
  });

  app.get('/admin/pendingRequests', checkAuth, (req, res) => {
    if (req.session.user.role_id != 2) {
      return res.redirect(req.session.user.main_url);
    }

    res.render('admin_pending_requests', {user: req.session.user});
  });


}

module.exports = router;
