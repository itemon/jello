var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

router.get('/hello', function (req, resp, next) {
	resp.json({
		jello: 'world'
	})
});

module.exports = router;
