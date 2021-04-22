const path = require("path");
const database = require('./config/dbConfig')
const { OAuth2Client } = require('google-auth-library');
const { resume } = require("./config/dbConfig");
const client = new OAuth2Client(process.env.CLIENT_ID);
const checkAuth = require('./checkAuth');

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
          switch (db_result[0].role_id) {
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

          //url = '/index';
          req.session.user = {
            username: payload.name,
            user_id: db_result[0].user_id,
            role_id: db_result[0].role_id,
            role_name: db_result[0].role_name,
            main_url: url
          };

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

  app.get('/api/getUsers', checkAuth, (req, res) => {
    if (req.session.user.role_id != 4) { // check for Super Admin level
      return res.status(400).send('Action not allowed');
    }

    const sql = `SELECT us.user_id AS 'user_id', us.email AS 'email', us.name_title AS 'name_title', us.division_name AS 'division_name',
                us.firstname AS 'firstname', us.lastname AS 'lastname', us.role_id AS 'role_id', ur.role_name AS 'role_name', us.phone_number AS 'phone_number',
                DATE(us.register_datetime) AS 'register_date', us.user_status AS 'user_status'
                FROM users us JOIN user_roles ur ON us.role_id = ur.role_id`;

    database.query(sql, (err, db_result) => {
      if (err) {
        return res.status(500).send("Database Server Error");
      }

      res.json(db_result);
    })
  });

  app.put('/api/manageUsers', checkAuth, (req, res) => {
    if (req.session.user.role_id != 4) { // check for Super Admin level
      return res.status(400).send('Action not allowed');
    }

    let { user_id, user_status } = req.body;
    if (user_id == null || user_status == null) {
      return res.status(400).send("Invalid request");
    } else if (user_status != 'Active' && user_status != 'Disabled') {
      return res.status(400).send("User status must be 'Active' or 'Disabled'");
    }

    const sql = `UPDATE users SET user_status = ? WHERE user_id = ?`;
    database.query(sql, [user_status, user_id], (err, db_result) => {
      if (err) {
        console.log(err);
        return res.status(500).send("Database Server Error");
      } else {
        if (db_result.affectedRows != 1) {
          return res.status(400).send('Unable to apply the changes');
        } else {
          res.status(200).send("Changes applied");
        }
      }

    });

  });

  app.post('/api/addUser', checkAuth, (req, res) => {
    if (req.session.user.role_id != 4) { // check for Super Admin level
      return res.status(400).send('Action not allowed');
    }

    const {
      email,
      firstname,
      lastname,
      name_title,
      division_name,
      role,
      phone_number
    } = req.body;

    if (email == null || email == "") {
      return res.status(400).send("Invalid email");
    } else if (firstname == null || firstname == "") {
      return res.status(400).send("Invalid firstname");
    } else if (lastname == null || lastname == "") {
      return res.status(400).send("Invalid lastname");
    } else if (role != "User" && role != "Admin" && role != "Super Advisor" && role != "Super Admin") {
      return res.status(400).send("Role must be User, Admin, Super Advisor or Super Admin");
    }

    // Role ID Name: 1 = User, 2 = Admin, 3 = Super Advisor, 4 = Super Admin
    let insRole;
    switch (role) {
      case "User":
        insRole = 1;
        break;
      case "Admin":
        insRole = 2;
        break;
      case "Super Advisor":
        insRole = 3;
        break;
      case "Super Admin":
        insRole = 4;
        break;
    }

    const sql = `INSERT INTO users (email, name_title, division_name, firstname, lastname, role_id, register_datetime, phone_number)
                VALUES(?,?,?,?,?,?, NOW(),?)`;
    database.query(sql, [email, name_title, division_name, firstname, lastname, insRole, phone_number], (err, db_result) => {
      if (err) {
        console.log(err);
        return res.status(500).send("Database Server Error");
      } else {
        if (db_result.affectedRows != 1) {
          return res.status(400).send("Unable to add new user");
        } else {
          res.send("Add user " + email + " complete");
        }
      }
    });
  });

}

module.exports = api;
