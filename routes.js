const path = require('path');

function router(app) {

  // Page route root
  app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "/views/index.html"));
  });

  //other routes..
}

module.exports = router;

