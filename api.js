const path = require("path");
const database = require('./config/dbConfig')
const { OAuth2Client } = require('google-auth-library');
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
                    FROM Users us JOIN User_roles ur ON us.role_id = ur.role_id
                    WHERE email = ?`;
        database.query(sql, [email], (err, db_result) => {

          if (err) {
            console.log(err);
            return res.status(500).send("Database Server Error");
          }

          if (db_result.length != 1) {
            return res.status(404).send("Sorry, this user is not a member yet");
          }

          if (db_result[0].user_status != "Active") {
            return res.status(400).send("This member's account is suspended");
          }

          // Role ID Name: 1 = User, 2 = Admin, 3 = Super Advisor, 4 = Super Admin
          let url;
          switch (db_result[0].role_id) {
            case 1:
              url = '/user/allSupplies';
              break;
            case 2:
              url = '/admin/pendingRequests';
              break;
            case 3:
              url = '/advisor/pendingRequests';
              break;
            case 4:
              url = '/manageUsers';
          }

          //url = '/index';
          req.session.user = {
            email: payload.email,
            picture: payload.picture,
            firstname: payload.given_name,
            lastname: payload.family_name,
            username: payload.username,
            user_id: db_result[0].user_id,
            role_id: db_result[0].role_id,
            role_name: db_result[0].role_name,
            main_url: url
          };

          //console.log(req.session.user);

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

  app.get('/api/user/getItemsList', checkAuth, (req, res) => {

    const sql = `SELECT itm.item_id AS 'item_id', itm.item_code AS 'supID', itm.item_name AS 'supName', itm.item_amount AS 'Amount',
                DATE(itm.item_last_add_datetime) AS 'dates', itp.type_name AS 'supCate', iun.unit_name AS 'supUnit'
                FROM Items itm JOIN Item_types itp ON itm.type_id = itp.type_id
                JOIN Item_units iun ON itm.unit_id = iun.unit_id
                WHERE used='Y'
                AND itm.item_amount > 0`;

    database.query(sql, (err, db_result) => {
      if (err) {
        console.log(err.message);
        return res.status(500).send("Database Server Error");
      }

      res.json(db_result);
    });
  });

  app.get('/api/admin/getItemsList', checkAuth, (req, res) => {

    const sql = `SELECT itm.item_id AS 'item_id', itm.item_code AS 'id', itm.item_name AS 'name', itm.item_amount AS 'amount',
                DATE(itm.item_last_add_datetime) AS 'dates', itp.type_name AS 'type', iun.unit_name AS 'unit'
                FROM Items itm JOIN Item_types itp ON itm.type_id = itp.type_id
                JOIN Item_units iun ON itm.unit_id = iun.unit_id
                WHERE used='Y'`;

    database.query(sql, (err, db_result) => {
      if (err) {
        console.log(err.message);
        return res.status(500).send("Database Server Error");
      }

      res.json(db_result);
    });
  });

  app.get('/api/admin/getEditHistory', checkAuth, (req, res) => {

    const sql = `SELECT iuh.update_id AS 'update_id', iuh.old_item_name AS 'old_item_name', iuh.update_item_name AS 'update_item_name',
                iuh.old_item_amount AS 'old_item_amount', iuh.update_item_amount AS 'update_item_amount',
                itpO.type_name AS 'old_item_type_name', itp.type_name AS 'update_item_type_name',
                iunO.unit_name AS 'old_item_unit_name', iun.unit_name AS 'update_item_unit_name',
                iuh.update_type AS 'update_type', DATE(iuh.update_datetime) AS 'date', TIME(iuh.update_datetime) AS 'time',
                itm.item_code AS 'item_code', CONCAT(us.firstname, ' ', us.lastname) AS 'updater_name'
                FROM Item_update_history iuh 
                JOIN Items itm ON iuh.item_id = itm.item_id
                JOIN Users us ON iuh.updater_id = us.user_id
                JOIN Item_types itpO ON iuh.old_item_type_id = itpO.type_id
                JOIN Item_types itp ON iuh.update_item_type_id = itp.type_id
                JOIN Item_units iunO ON iuh.old_item_unit_id = iunO.unit_id
                JOIN Item_units iun ON iuh.update_item_unit_id = iun.unit_id
                WHERE itm.used = 'Y' 
                ORDER BY iuh.update_datetime DESC`;
    database.query(sql, (err, db_result) => {
      if (err) {
        console.log(err);
        return res.status(500).send("Database Error while fetching update history");
      }
      res.json(db_result);
    });
  });

  app.put('/api/admin/updateItem', checkAuth, (req, res) => {
    if (req.session.user.role_id != 2) { // check for Admin level
      return res.status(400).send('Action not allowed');
    }

    const {
      item_code,
      item_name,
      item_amount,
      updateAmountType,
      type_id,
      unit_id
    } = req.body;

    // Check common input correction
    if (item_code == null || item_name == null || type_id == null || unit_id == null) {
      return res.status(400).send("Invalid input, please check the inputs correctness");
    } else if (item_code == "" || item_name == "" || type_id == "" || unit_id == "") {
      return res.status(400).send("Invalid input, please check the inputs correctness");
    }

    // Check if update item_amount is needed

    if (item_amount == null || item_amount == "" || item_amount == 0) {
      updateItemWithoutAmount();
    } else {
      updateItemWithAmount();
    }

    // -----------------------------------

    function updateItemWithoutAmount() {


      // update history record
      // 1. getting old record data
      getItemData(item_code, (err, db_result) => {
        if (err) {
          console.log(err);
          return res.status(500).send(err);
        }

        // 2. insert them with new data to history table
        const insData = {

          old_item_name: db_result.item_name,
          update_item_name: item_name,
          old_item_amount: db_result.item_amount,
          update_item_amount: db_result.item_amount,
          old_item_type_id: db_result.type_id,
          update_item_type_id: type_id,
          old_item_unit_id: db_result.unit_id,
          update_item_unit_id: unit_id,
          update_type: "แก้ไขข้อมูล",
          updater_id: req.session.user.user_id,
          item_id: db_result.item_id

        };

        insertUpdateHistory('update', insData, (err) => {
          if (err) {
            console.log(err);
            return res.status(500).send(err);
          } else {
            // 3. update item table record
            // update Item record
            const sql = `UPDATE Items SET item_name=?, item_last_add_datetime=NOW(), type_id=?, unit_id=?
                        WHERE item_code = ?`;
            database.query(sql, [item_name, type_id, unit_id, item_code], (err, db_result) => {
              if (err) {
                console.log(err.message);
                return res.status(500).send("Database Server Error");
              }

              if (db_result.affectedRows != 1) {
                return res.status(400).send("Error updating item record");
              }

              res.send("Update item " + item_name + " success");
            });

          }
        });
      });

    }

    function updateItemWithAmount() {
      if (updateAmountType != 'increase' && updateAmountType != 'decrease') {
        return res.status(400).send("Specify the item amount updating by 'increase' or 'decrease'");
      }

      // update history record
      // 1. getting old record data


      getItemData(item_code, (err, db_result) => {
        if (err) {
          console.log(err);
          return res.status(500).send(err);
        }

        let updatedItemAmount = 0;
        if (updateAmountType == 'increase') {
          updatedItemAmount = db_result.item_amount + Number(item_amount);
        } else if (updateAmountType == 'decrease') {
          if (item_amount > db_result.item_amount) {
            return res.status(400).send("The decrease item amount is higher than the actual item amount left in the database");
          } else {
            updatedItemAmount = db_result.item_amount - Number(item_amount);
          }

        }

        // 2. insert them with new data to history table
        const insData = {
          old_item_name: db_result.item_name,
          update_item_name: item_name,
          old_item_amount: db_result.item_amount,
          update_item_amount: updatedItemAmount,
          old_item_type_id: db_result.type_id,
          update_item_type_id: type_id,
          old_item_unit_id: db_result.unit_id,
          update_item_unit_id: unit_id,
          update_type: (function () {
            if (updateAmountType === 'increase') {
              return "เพิ่มจำนวน";
            } else if (updateAmountType === 'decrease') {
              return "ลดจำนวน";
            } else {
              return res.status(500).send("Cannot set update type to updating history");
            }
          })(),
          updater_id: req.session.user.user_id,
          item_id: db_result.item_id

        };

        insertUpdateHistory('update', insData, (err) => {
          if (err) {
            console.log(err);
            return res.status(500).send(err);
          } else {
            // 3. update item table record
            updateWithAmount(updatedItemAmount);
          }
        });

      });

      function updateWithAmount(finalAmount) {

        const sql = `UPDATE Items SET item_name=?, item_amount=?, item_last_add_datetime=NOW(), type_id=?, unit_id=?
                    WHERE item_code = ?`;
        database.query(sql, [item_name, finalAmount, type_id, unit_id, item_code], (err, db_result) => {
          if (err) {
            console.log(err.message);
            return res.status(500).send("Database Server Error");
          }

          if (db_result.affectedRows != 1) {
            return res.status(400).send("Error updating item record");
          }

          res.send("Update item " + item_name + " success");
        });
      }

    }

  });

  function insertUpdateHistory(insOption, insData, cb) {
    if (insOption === "update") {
      const {
        old_item_name,
        update_item_name,
        old_item_amount,
        update_item_amount,
        old_item_type_id,
        update_item_type_id,
        old_item_unit_id,
        update_item_unit_id,
        update_type,
        updater_id,
        item_id
      } = insData;

      const sql = `INSERT INTO Item_update_history (
        old_item_name,
        update_item_name,
        old_item_amount,
        update_item_amount,
        old_item_type_id,
        update_item_type_id,
        old_item_unit_id,
        update_item_unit_id,
        update_type,
        update_datetime,
        updater_id,
        item_id
        ) VALUES (?,?,?,?,?,?,?,?,?, NOW(),?,?)`;

      database.query(sql, [old_item_name,
        update_item_name,
        old_item_amount,
        update_item_amount,
        old_item_type_id,
        update_item_type_id,
        old_item_unit_id,
        update_item_unit_id,
        update_type,
        updater_id,
        item_id], (err, db_result) => {
          if (err) {
            console.log(err.message);
            cb(err);
          } else {
            if (db_result.affectedRows != 1) {
              cb(new Error("Error updating history record"))
            } else {
              cb(undefined);
            }
          }
        });
    } else if (insOption === "add") {
      const {
        update_item_name,
        update_item_amount,
        update_item_type_id,
        update_item_unit_id,
        update_type,
        updater_id,
        item_id
      } = insData;

      const sql = `INSERT INTO Item_update_history (
        
        update_item_name,
        
        update_item_amount,
        
        update_item_type_id,
        
        update_item_unit_id,
        update_type,
        update_datetime,
        updater_id,
        item_id
        ) VALUES (?,?,?,?,?, NOW(),?,?)`;

      database.query(sql, [update_item_name,
        update_item_amount,
        update_item_type_id,
        update_item_unit_id,
        update_type,
        updater_id,
        item_id], (err, db_result) => {
          if (err) {
            console.log(err.message);
            cb(err);
          } else {
            if (db_result.affectedRows != 1) {
              cb(new Error("Error adding history record"));
            } else {
              cb(undefined);
            }
          }
        });
    } else if (insOption === "delete") {
      const {
        update_item_name,
        update_item_amount,
        update_item_type_id,
        update_item_unit_id,
        update_type,
        updater_id,
        item_id
      } = insData;

      const sql = `INSERT INTO Item_update_history (
        
        update_item_name,
        
        update_item_amount,
        
        update_item_type_id,
        
        update_item_unit_id,
        update_type,
        update_datetime,
        updater_id,
        item_id
        ) VALUES (?,?,?,?,?, NOW(),?,?)`;

      database.query(sql, [update_item_name,
        update_item_amount,
        update_item_type_id,
        update_item_unit_id,
        update_type,
        updater_id,
        item_id], (err, db_result) => {
          if (err) {
            console.log(err.message);
            cb(err);
          } else {
            if (db_result.affectedRows != 1) {
              cb(new Error("Error adding history record"));
            } else {
              cb(undefined);
            }
          }
        });
    }
  } // ==== end of ADMIN UPDATE ITEM API =====

  app.post('/api/user/requestItems', checkAuth, (req, res) => {
    const { reqData, reqReason } = req.body;

    if (!reqData || !reqReason) {
      return res.status(400).send("กรุณากรอกข้อมูลให้ครบถ้วน");
    }


    function validateAmount(reqData, cb) {
      let err = null
      reqData.forEach(function (data, index, arr) {
        if (isNaN(Number(data.choseAmount))) {
          err = "The requested amount must be a number";
        } else if (Number(data.choseAmount) < 1) {
          err = "The requested amount per item must greater than 0";
        } else {

        }
      });

      cb(err);
    }


    validateAmount(reqData, (err) => {

      if (err) {
        return res.status(400).send(err);
      }
      // 1. Insert to Requests table
      // 2. Insert to RHS table
      const sql = `INSERT INTO Requests (request_reason, request_datetime, approval_status, progress_state, user_id) 
                VALUES (?, NOW(), '', 0, ?)`;

      database.query(sql, [reqReason, req.session.user.user_id], (err, insResult) => {
        if (err) {
          console.log(err.message);
          return res.status(500).send("Database Error while adding newly request");
        }

        if (insResult.affectedRows != 1) {
          return res.status(400).send("Error, the item requesting cannot be done");
        }

        const request_id = insResult.insertId;
        const sql = `INSERT INTO Requests_has_Items (request_id, item_id, item_request_amount) 
                  VALUES (?,?,?)`;
        for (i in reqData) {
          database.query(sql, [request_id, reqData[i].item_id, reqData[i].choseAmount], (err, db_result) => {
            if (err) {
              console.log(err.message);
              return res.status(500).send("Database Error while adding newly request item");
            }

          });
        }

        res.send("Request success")


      });
    });

  });

  app.post('/api/admin/importItems', checkAuth, async (req, res) => {
    const { eng_obj, type } = req.body;

    if (type == null || type == "") {
      return res.status(400).send("No type provided");
    }
    if (!eng_obj) {
      return res.status(400).send("No import data provided");
    }

    // var loop_err = null;

    importData(eng_obj, (err) => {
      if (err) {
        console.log(err);
        return res.status(500).send(err);
      } else {
        res.send("Import success");
      }
    });

    

    function importData(arrObj, cb) {

     
      var pendingItem = arrObj.length;
      var hasErr;
      for (const eng_obj of arrObj) {
        if (hasErr) {
          break;
        }

        isItemCodeExists(eng_obj['item_code'], (isExisted) => { // Check each item if already existed in DB
          if (isExisted) { // Then UPDATE it

            const sql = `UPDATE Items SET item_name = ?, item_amount = ?, type_id = ?, unit_id = ?, item_last_add_datetime = NOW()
                          WHERE item_code = ?`;

            let updateArr = [
              eng_obj['item_name'],
              eng_obj['item_amount'],
              eng_obj['type_id'],
              eng_obj['unit_id'],
              eng_obj['item_code']
            ];
            database.query(sql, updateArr, (err, db_result) => {
              if (err) {
                
                console.log("ERR UPDATE: " + err.message);
                hasErr = err;
              } else {
                if (db_result.affectedRows != 1) {    
                  hasErr = `Importing data error, 'UPDATE' item_code = ${updateArr[4]}`;
                  
                } else {
                  //console.log(`UPDATE ${eng_obj['item_code']}, ${eng_obj['item_name']} --> Items`);
                }
              }

            });

          } else { // If not exist (New item) then INSERT it

            const sql = `INSERT INTO Items (item_code, item_name, item_amount, type_id, unit_id, item_last_add_datetime) VALUES (?,?,?,?,?, NOW())`;

            let insArr = [
              eng_obj['item_code'],
              eng_obj['item_name'],
              eng_obj['item_amount'],
              eng_obj['type_id'],
              eng_obj['unit_id']
            ];

            
            database.query(sql, insArr, (err, db_result) => {
              if (err) {
                console.log("ERR INSERT: " + err.message);
                hasErr = err;

              } else {
                if (db_result.affectedRows != 1) {
                  hasErr = `Importing data error, 'INSERT' item_code = ${insArr[0]}`;
                  console.log(`ERROR INSERT ${eng_obj['item_code']}`);
                  
                } else {
                  //console.log(`INSERT ${eng_obj['item_code']}, ${eng_obj['item_name']} --> Items`);
                }
              }
            });
          }

        });
      }

      cb(hasErr);

    }

    //console.log(eng_obj);


  });

  app.post('/api/admin/addItem', checkAuth, (req, res) => {
    if (req.session.user.role_id != 2) { // check for Admin level
      return res.status(400).send('Action not allowed');
    }

    const {
      item_code,
      item_name,
      item_amount,
      type_id,
      unit_id
    } = req.body;

    if (item_code == null || item_name == null || item_amount == null || type_id == null || unit_id == null) {
      return res.status(400).send("Invalid input, please check the inputs correctness");
    } else if (item_code == "" || item_name == "" || item_amount == "" || type_id == "" || unit_id == "") {
      return res.status(400).send("Invalid input, please check the inputs correctness");
    }

    isItemCodeExists(item_code, (isExisted) => {
      if (isExisted) {
        return res.status(400).send("Item code is already taken!");
      }

      // Begin adding new item to table
      const sql = `INSERT INTO Items (item_code, item_name, item_amount, item_last_add_datetime, type_id, unit_id) 
      VALUES (?,?,?, NOW(),?,?)`;
      database.query(sql, [item_code, item_name, item_amount, type_id, unit_id], (err, db_result) => {
        if (err) {
          console.log(err.message);
          return res.status(500).send("Database Server Error");
        }

        if (db_result.affectedRows != 1) {
          return res.status(400).send("Error creating new item record");
        }

        const insHisData = {
          update_item_name: item_name,
          update_item_amount: item_amount,
          update_item_type_id: type_id,
          update_item_unit_id: unit_id,
          update_type: "เพิ่มรายการวัสดุใหม่",
          updater_id: req.session.user.user_id,
          item_id: db_result.insertId
        };


        insertUpdateHistory('add', insHisData, (err) => {
          if (err) {
            console.log(err);
            return res.status(500).send(err);
          } else {
            res.send("Add new item " + item_code + " success");
          }
        });


      });


    });


  });

  app.delete('/api/admin/deleteItem', checkAuth, (req, res) => {
    if (req.session.user.role_id != 2) { // check for Admin level
      return res.status(400).send('Action not allowed');
    }

    const item_code = req.body.item_code;

    if (item_code == null || item_code == "") {
      return res.status(400).send("Invalid request");
    }

    getItemData(item_code, (err, db_result) => {

      const insHisData = {
        update_item_name: db_result.item_name,
        update_item_amount: db_result.item_amount,
        update_item_type_id: db_result.type_id,
        update_item_unit_id: db_result.unit_id,
        update_type: "ลบวัสดุ",
        updater_id: req.session.user.user_id,
        item_id: db_result.item_id
      };

      insertUpdateHistory('delete', insHisData, (err) => {
        if (err) {
          console.log(err);
          res.status(500).send(err);
        } else {

          const sql = `UPDATE Items SET used='N', item_code= CONCAT('DEL_', item_code) WHERE item_code = ?`;
          database.query(sql, [item_code], (err, db_result) => {
            if (err) {
              console.log(err.message);
              return res.status(500).send("Database Server Error");
            }

            if (db_result.affectedRows != 1) {
              return res.status(400).send("Error deleting the record");
            }

            res.send("Record deleted");
          });
        }
      });

    });


  });

  app.get('/api/getPendingRequestCount', checkAuth, (req, res) => {
    const sql = `SELECT COUNT(*) AS 'count' FROM Requests WHERE progress_state = 0`;
    database.query(sql, (err, db_result) => {
      if (err) {
        console.log(err.message);
        return res.status(500).send("Database Error while getting total number of item");
      } else {
        res.json(db_result[0]);
      }
    });
  });

  app.get('/api/getItemTypes', checkAuth, (req, res) => {
    const sql = `SELECT * FROM Item_types`;
    database.query(sql, (err, db_result) => {
      if (err) {
        console.log(err.message);
        return res.status(500).send("Database Server Error");
      }
      res.json(db_result);
    });

  });

  app.get('/api/getItemUnits', checkAuth, (req, res) => {
    const sql = `SELECT * FROM Item_units`;
    database.query(sql, (err, db_result) => {
      if (err) {
        console.log(err);
        return res.status(500).send("Database Server Error");
      }
      res.json(db_result);
    });

  });

  app.get('/api/admin/getPendingRequest', checkAuth, (req, res) => {
    if (req.session.user.role_id != 2 && req.session.user.role_id != 3) { // check for Admin and Super Adviosr level
      return res.status(400).send('Action not allowed');
    }

    const sql = `SELECT rq.request_id AS 'reqNo', DATE(rq.request_datetime) AS 'dates', TIME(rq.request_datetime) AS 'time',
                CONCAT(us.division_name, ' ', us.name_title, ' ', us.firstname, ' ', us.lastname) AS 'name', us.email AS 'email',
                rq.request_reason AS 'reqReason' 
                FROM Requests rq
                JOIN Users us ON rq.user_id = us.user_id
                WHERE rq.progress_state = 0`;
    database.query(sql, (err, db_result) => {
      if (err) {
        console.log(err.message);
        return res.status(500).send("Database Error while fetching pending requests");
      }

      res.json(db_result);
    });
  });

  app.get('/api/admin/getUpdateRequest', checkAuth, (req, res) => {
    if (req.session.user.role_id != 2 && req.session.user.role_id != 3) { // check for Admin and Super Adviosr level
      return res.status(400).send('Action not allowed');
    }

    const sql = `SELECT rq.request_id AS 'reqNo', DATE(rq.request_datetime) AS 'dateReq', DATE(rq.approve_datetime) AS 'dateApp', TIME(rq.approve_datetime) AS 'timeApp',
                CONCAT(us.division_name, ' ', us.name_title) AS 'name_title', us.firstname AS 'firstName', us.lastname AS 'lastName', us.email AS 'email',
                rq.progress_state AS 'progress_state' , rq.request_reason AS 'reqReason' 
                FROM Requests rq
                JOIN Users us ON rq.user_id = us.user_id
                WHERE rq.approval_status = 'approved'
                AND rq.progress_state < 3`;
    database.query(sql, (err, db_result) => {
      if (err) {
        console.log(err.message);
        return res.status(500).send("Database Error while fetching requests");
      }

      for (i in db_result) {
        if (db_result[i].progress_state == 1) {
          db_result[i].reqStatus = "กำลังดำเนินการ";
        } else if (db_result[i].progress_state == 2) {
          db_result[i].reqStatus = "รอส่งมอบ";
        }
      }

      res.json(db_result);
    });
  });

  app.get('/api/admin/getRequestHistory', checkAuth, (req, res) => {
    if (req.session.user.role_id != 2 && req.session.user.role_id != 3) { // check for Admin and Super Adviosr level
      return res.status(400).send('Action not allowed');
    }

    const sql = `SELECT rq.request_id AS 'reqNo', DATE(rq.request_datetime) AS 'dateReq', DATE(rq.approve_datetime) AS 'dateApp', TIME(rq.approve_datetime) AS 'timeApp',
                CONCAT(us.division_name, ' ', us.name_title) AS 'name_title', us.firstname AS 'firstName', us.lastname AS 'lastName', us.email AS 'email',
                rq.progress_state AS 'progress_state' , rq.request_reason AS 'reqReason', rq.approval_status AS 'approval_status',
                rq.reject_reason AS 'reject_reason', DATE(rq.reject_dateTime) AS 'reject_date'
                FROM Requests rq
                JOIN Users us ON rq.user_id = us.user_id
                WHERE rq.progress_state = 3`;
    database.query(sql, (err, db_result) => {
      if (err) {
        console.log(err.message);
        return res.status(500).send("Database Error while fetching requests history");
      }

      for (i in db_result) {
        if (db_result[i].progress_state == 3) {
          if (db_result[i].approval_status == "approved") {
            db_result[i].reqStatus = "เสร็จสิ้น";
          } else if (db_result[i].approval_status != "approved") {
            db_result[i].reqStatus = "ไม่อนุมัติ";
          }

        }
      }

      res.json(db_result);
    });
  });

  app.get('/api/user/getRequestCount', checkAuth, (req, res) => {
    const sql = `SELECT COUNT(*) AS 'count'
                FROM Requests rq
                WHERE rq.approval_status = 'approved'
                AND rq.progress_state < 3
                AND rq.user_id = ?`;

    database.query(sql, [req.session.user.user_id], (err, db_result) => {
      if (err) {
        console.log(err.message);
        return res.status(500).send("Database Error while counting user requests");
      }

      res.json(db_result[0]);
    });
  });

  app.get('/api/user/getRequest', checkAuth, (req, res) => {

    const sql = `SELECT rq.request_id AS 'reqNo', DATE(rq.request_datetime) AS 'dates', TIME(rq.request_datetime) AS 'time',DATE(rq.approve_datetime) AS 'dateApp', TIME(rq.approve_datetime) AS 'timeApp',
                CONCAT(us.division_name, ' ', us.name_title) AS 'name_title', us.firstname AS 'firstname', us.lastname AS 'lastname', us.email AS 'email',
                rq.progress_state AS 'progress_state' , rq.request_reason AS 'reqReason' 
                FROM Requests rq
                JOIN Users us ON rq.user_id = us.user_id
                WHERE rq.approval_status = 'approved'
                AND rq.progress_state < 3
                AND rq.user_id = ?`;
    database.query(sql, [req.session.user.user_id], (err, db_result) => {
      if (err) {
        console.log(err.message);
        return res.status(500).send("Database Error while fetching requests");
      }

      for (i in db_result) {
        if (db_result[i].progress_state == 1) {
          db_result[i].reqStatus = "กำลังดำเนินการ";
        } else if (db_result[i].progress_state == 2) {
          db_result[i].reqStatus = "รอรับวัสดุ";
        }
      }

      res.json(db_result);
    });
  });

  app.get('/api/user/getRequestHistory', checkAuth, (req, res) => {

    const sql = `SELECT rq.request_id AS 'reqNo', DATE(rq.request_datetime) AS 'dateReq', DATE(rq.approve_datetime) AS 'dateApp', TIME(rq.approve_datetime) AS 'timeApp',
                CONCAT(us.division_name, ' ', us.name_title) AS 'name_title', us.firstname AS 'firstName', us.lastname AS 'lastName', us.email AS 'email',
                rq.progress_state AS 'progress_state' , rq.request_reason AS 'reqReason', rq.approval_status AS 'approval_status',
                rq.reject_reason AS 'reject_reason', DATE(rq.reject_dateTime) AS 'reject_date'
                FROM Requests rq
                JOIN Users us ON rq.user_id = us.user_id
                WHERE rq.progress_state = 3
                AND rq.user_id = ?`;
    database.query(sql, [req.session.user.user_id], (err, db_result) => {
      if (err) {
        console.log(err.message);
        return res.status(500).send("Database Error while fetching requests history");
      }

      for (i in db_result) {
        if (db_result[i].progress_state == 3) {
          if (db_result[i].approval_status == "approved") {
            db_result[i].reqStatus = "เสร็จสิ้น";
          } else if (db_result[i].approval_status != "approved") {
            db_result[i].reqStatus = "ไม่อนุมัติ";
          }

        }
      }

      res.json(db_result);
    });
  });

  app.get('/api/admin/getRequestDetailsId/:id', checkAuth, (req, res) => {
    if (req.session.user.role_id != 2 && req.session.user.role_id != 3) { // check for Admin and Super Adviosr level
      return res.status(400).send('Action not allowed');
    }

    const id = req.params.id;

    if (id == null || id == "") {
      return res.status(400).send("Please provide a request id");
    }

    const sql = `SELECT itm.item_code AS 'supID', itm.item_name AS 'supName', 
                itp.type_name AS 'supCate', iun.unit_name AS 'supUnit', itm.item_amount AS 'supLeft',
                rhi.item_request_amount AS 'supAmount'
                FROM Items itm 
                JOIN Item_types itp ON itm.type_id = itp.type_id
                JOIN Item_units iun ON itm.unit_id = iun.unit_id
                JOIN Requests_has_Items rhi ON itm.item_id = rhi.item_id
                WHERE rhi.request_id = ?`;

    database.query(sql, [id], (err, db_result) => {
      if (err) {
        console.log(err);
        return res.status(500).send("Database Error while fetching Request details");
      }

      res.json(db_result);
    });
  });

  app.get('/api/user/getRequestDetailsId/:id', checkAuth, (req, res) => {


    const id = req.params.id;

    if (id == null || id == "") {
      return res.status(400).send("Please provide a request id");
    }

    const sql = `SELECT itm.item_code AS 'supID', itm.item_name AS 'supName', 
                itp.type_name AS 'supCate', iun.unit_name AS 'supUnit', itm.item_amount AS 'supLeft',
                rhi.item_request_amount AS 'supAmount'
                FROM Items itm 
                JOIN Item_types itp ON itm.type_id = itp.type_id
                JOIN Item_units iun ON itm.unit_id = iun.unit_id
                JOIN Requests_has_Items rhi ON itm.item_id = rhi.item_id
                WHERE rhi.request_id = ?`;

    database.query(sql, [id], (err, db_result) => {
      if (err) {
        console.log(err);
        return res.status(500).send("Database Error while fetching Request details");
      }

      res.json(db_result);
    });
  });

  app.put('/api/admin/updateRequestApproval', checkAuth, (req, res) => {
    if (req.session.user.role_id != 2 && req.session.user.role_id != 3) { // check for Admin and Super Adviosr level
      return res.status(400).send('Action not allowed');
    }

    const { reqNo, status, rejectReason } = req.body;

    if (reqNo == null || reqNo == "") {
      return res.status(400).send("Please provide a request id");
    }

    if (status == null || status == "") {
      return res.status(400).send("Please provide a request approve status");
    }

    let appr;
    switch (status) {
      case "approved":
        appr = "approved";
        updateItemAmount(req, res);

        break;
      case "disapprove":
        appr = "disapprove";
        makeDisapprove();
        break;
      default:
        return res.status(400).send("Invalid status");
    }

    function updateItemAmount() {
      // 1. get all item of that request 
      const sql = `SELECT rhi.item_id AS 'item_id', itm.item_code AS 'item_code', rhi.item_request_amount AS 'amount' 
                  FROM Requests_has_Items rhi 
                  JOIN Items itm ON rhi.item_id = itm.item_id
                  WHERE request_id = ?`;

      database.query(sql, [reqNo], (err, rhs_result) => {
        if (err) {
          console.log(err.message);
          return res.status(500).send("Database Error while updating requested item amount");
        }

        if (rhs_result.length == 0) {
          return res.status(400).send("Error, there are no items of that request");
        }

        // 1.5 check if each item is available to subtract

        function checkValidAmount(rhs_result, cb) {
          var checking_result = {};
          checking_result.isOK = null;
          checking_result.message = '';
          const sql_check = `SELECT item_amount, used FROM Items WHERE item_id = ?`;
          for (i in rhs_result) {
            database.query(sql_check, [rhs_result[i].item_id], (err, db_itm) => {
              if (err) {
                console.log(err.message);
                cb(err, null);
              } else {
                if (db_itm[0].used != 'Y') {
                  checking_result.isOK = false;
                  checking_result.message = 'Error, รายการที่ขอเบิกมีวัสดุที่ถูกลบไปแล้ว.';
                  cb(null, checking_result);

                } else if (db_itm[0].item_amount < rhs_result[i].amount) {
                  checking_result.isOK = false;
                  checking_result.message = 'Error, จำนวนคงเหลือในคลังไม่พอต่อความต้องการ.';
                  cb(null, checking_result);

                } else {
                  checking_result.isOK = true;
                  cb(null, checking_result);
                }
              }
            });
          }
        }

        checkValidAmount(rhs_result, (err, check_result) => {
          if (err) {
            console.log(err);
            return res.status(500).send("Database Error while checking item amount")
          } else {
            // 2. Subtract items in Items table with each item in RHS

            if (check_result.isOK === true) {
              for (i in rhs_result) {
                const sql = `UPDATE Items SET item_amount = item_amount - ? WHERE item_id = ?`;
                database.query(sql, [Number(rhs_result[i].amount), rhs_result[i].item_id],
                  (err, db_result) => {
                    if (err) {
                      console.log(err);
                      let log = `Database Error while updating item amount of ${rhs_result[i].amount} of request_id ${rhs_result[i].item_id}`;
                      return res.status(500).send(log);
                    }

                  });
              }

              makeApprove();
            } else {
              return res.status(400).send(check_result.message);
            }
          }
        });




      });
    }

    function makeApprove() {
      const sql = `UPDATE Requests SET approval_status = ?, progress_state = 1, request_approval_endorser_id = ?,
                  approve_datetime = NOW() 
                  WHERE request_id = ?`;
      database.query(sql, [appr, req.session.user.user_id, reqNo], (err, db_result) => {
        if (err) {
          console.log(err.message);
          return res.status(500).send("Database Error while updating approval status");
        }

        if (db_result.affectedRows != 1) {
          return res.status(400).send("Error while updating approval record");
        }

        res.send("Changes applied");

      });
    }

    function makeDisapprove() {
      const sql = `UPDATE Requests SET approval_status = ?, progress_state = 3, reject_reason = ?, 
                  reject_datetime = NOW(), request_approval_endorser_id = ?, approve_datetime = NOW() 
                  WHERE request_id = ?`;
      database.query(sql, [appr, rejectReason, req.session.user.user_id, reqNo], (err, db_result) => {
        if (err) {
          console.log(err.message);
          return res.status(500).send("Database Error while updating approval status");
        }

        if (db_result.affectedRows != 1) {
          return res.status(400).send("Error while updating approval record");
        }

        res.send("Changes applied");

      });
    }


  });

  app.put('/api/admin/updateRequestStatus', checkAuth, (req, res) => {
    if (req.session.user.role_id != 2 && req.session.user.role_id != 3) { // check for Admin and Super Adviosr level
      return res.status(400).send('Action not allowed');
    }

    const { reqNo, status } = req.body;

    if (reqNo == null || reqNo == "") {
      return res.status(400).send("Please provide a request id");
    }

    if (status == null || status == "") {
      return res.status(400).send("Please provide a request status");
    }

    let state;
    switch (status) {
      case "รอส่งมอบ":
        state = 2;
        break;
      case "เสร็จสิ้น":
        state = 3;
        break;
      default:
        return res.status(400).send("Invalid status");
    }

    const sql = `UPDATE Requests SET progress_state = ? WHERE request_id = ?`;
    database.query(sql, [state, reqNo], (err, db_result) => {
      if (err) {
        console.log();
        return res.status(500).send("Database Error while updating request status");
      }

      if (db_result.affectedRows != 1) {
        return res.status(400).send("Error updating request status");
      }

      res.send("Change applied");
    });

  });

  app.get('/api/getUsers', checkAuth, (req, res) => {
    if (req.session.user.role_id != 4) { // check for Super Admin level
      return res.status(400).send('Action not allowed');
    }

    const sql = `SELECT us.user_id AS 'user_id', us.email AS 'email', us.name_title AS 'name_title', us.division_name AS 'division_name',
                us.firstname AS 'firstname', us.lastname AS 'lastname', us.role_id AS 'role_id', ur.role_name AS 'role_name', us.phone_number AS 'phone_number',
                DATE(us.register_datetime) AS 'register_date', us.user_status AS 'user_status'
                FROM Users us JOIN User_roles ur ON us.role_id = ur.role_id`;

    database.query(sql, (err, db_result) => {
      if (err) {
        console.log(err.message);
        return res.status(500).send("Database Server Error");
      }

      res.json(db_result);
    })
  });

  app.get('/api/getUserProfile', checkAuth, (req, res) => {
    // const { user_id } = req.body;
    let user_id = req.session.user.user_id;

    const sql = `SELECT user_id, email, name_title, division_name, firstname, lastname, role_id, phone_number
                FROM Users WHERE user_id = ?`;

    database.query(sql, [user_id], (err, db_result) => {
      if (err) {
        console.log(err);
        return res.status(500).send("Database Error while getting user by ID");
      }

      if (db_result.length != 1) {
        return res.status(400).send("Error querying user info by ID");
      }

      res.json(db_result[0]);
    });

    app.put('/api/updateUserProfile', checkAuth, (req, res) => {
      const { user_data } = req.body;

      if (user_data == null) {
        return res.status(400).send("No data provided");
      } else if (user_data.firstname == null || user_data.firstname == "") {
        return res.status(400).send("No firstname provided");
      } else if (user_data.lastname == null || user_data.lastname == "") {
        return res.status(400).send("No lastname provided");
      } else if (user_data.phone_number == null || user_data.phone_number == "") {
        return res.status(400).send("No phone number provided");
      }

      const sql = `UPDATE Users SET firstname = ?, lastname = ?, phone_number = ? WHERE user_id = ?`;
      database.query(sql, [user_data.firstname, user_data.lastname, user_data.phone_number, req.session.user.user_id],
        (err, db_result) => {
          if (err) {
            console.log(err.message);
            return res.status(500).send("Database Error while updating user info");
          }

          if (db_result.affectedRows != 1) {
            return res.status(400).send("Error, no update changed");
          }

          res.send("Change saved.");
        });
    });

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

    const sql = `UPDATE Users SET user_status = ? WHERE user_id = ?`;
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

    isUserEmailExists(email, (err, isTrue, db_q) => {
      if (err) {
        console.log(err.message);
        return res.status(500).send("Database Server Error while checking user email");
      } else if (isTrue) {
        return res.status(400).send("The user email is already exist");
      } else {

        const sql = `INSERT INTO Users (email, name_title, division_name, firstname, lastname, role_id, register_datetime, phone_number)
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

      }

    });

  });

  function isUserEmailExists(email, cb) {
    const sql = `SELECT user_id FROM Users WHERE email = ?`;
    database.query(sql, [email], (err, db_result) => {
      if (err) {
        console.log(err.message);
        cb(err, undefined, undefined);
      } else {

        if (db_result.length > 0) {
          cb(undefined, true, db_result);
        } else {
          cb(undefined, false, db_result);
        }

      }

    });
  }

  function isItemCodeExists(code, cb) {
    const sql = `SELECT item_id FROM Items WHERE item_code=? AND used='Y'`;
    database.query(sql, [code], (err, db_result) => {
      if (err) {
        console.log(err.message);
        return res.status(500).send("Database Server Error");
      }

      if (db_result.length > 0) {
        cb(true);
      } else {
        cb(false);
      }

    });
  }

  function getItemData(item_code, cb) {

    const sql = `SELECT * FROM Items WHERE item_code = ? AND used='Y'`;
    database.query(sql, [item_code], (err, db_result) => {
      if (err) {
        console.log(err.message);
        cb(new Error("Database Error when getting item data"));
      }

      if (db_result.length != 1) {
        cb(new Error("Database Error, item is duplicated"));
      }

      cb(undefined, db_result[0]);
    });

  }


}

module.exports = api;
