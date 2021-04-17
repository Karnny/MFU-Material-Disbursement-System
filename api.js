const path = require("path");
const database = require('./config/dbConfig')
const { OAuth2Client } = require('google-auth-library');
const { resume } = require("./config/dbConfig");
const client = new OAuth2Client(process.env.CLIENT_ID);

// API function fields
function api(app) {

  // API services go here
  app.post("/api/login", (req, res) => {
    // DO LOGIN AUTHENTICATION THINGS..
    const token = req.body.token;
    if (token) {
      client.verifyIdToken({
        idToken: token,
        audience: process.env.CLIENT_ID
      }).then((ticket) => {
        const payload = ticket.getPayload(); // Google User Information
        const email = payload.email;

        // check email in our Database
        const sql = `SELECT us.user_id AS 'user_id', us.email AS 'email', us.role_id AS 'role_id', ur.role_name AS 'role_name', us.user_status AS 'user_status'
                    FROM users us JOIN user_roles ur ON us.role_id = ur.role_id
                    WHERE email = ?`;
        database.query(sql, [email], (err, db_result) => {
          
          if (err) {
            console.log(err);
            return res.status(500).send("Database Server Error");
          }

          if (db_result.length != 1) {
            return res.status(404).send("Not a member");
          }

          if (db_result[0].user_status != "Active") {
            return res.status(400).send("Inactive member");
          }

          // Role ID Name: 1 = User, 2 = Admin, 3 = Super Advisor, 4 = Super Admin
          let url;
          switch(db_result[0].role_id) {
            case 1:
              url = '/user_items';
              break;
            case 2:
              url = '/admin_requests';
              break;
            case 3:
              url = '/advisor_requests';
              break;
            case 4:
              url = '/manageUsers';
          }

          req.session.user = {
            username: payload.name, 
            user_id: db_result[0].user_id,
            role_id: db_result[0].role_id,
            role_name: db_result[0].role_name,
            main_url: url
          };

          console.log(url);
          res.send(url);
        });
      }).catch((err) => {
        console.log(err);
        res.status(400).send("Invalid token");
      });
    } else {
      console.log("No token");
      res.status(401).send("No Token");
    }


  });

  app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.log(err);
        res.status(500).send('Action unable to complete');
      }
      res.redirect('/');
    });
  });

}

module.exports = api;
