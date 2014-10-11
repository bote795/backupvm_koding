var logger = require(__dirname + '/logger.js');

var mongoose = require('mongoose');

logger.log(5, 'Creating connection to mongodb database...');

var db = mongoose.createConnection('mongodb://localhost:27017/battlefield', function(err) {
	if (err) {
		logger.log(1, 'Cannot connect to database: ' + err);
	} else {
		logger.log(5, 'Connected to database!');
	}
});

db.on('error', function(err) {
	logger.log(1, 'Database error: ' + err);
});

exports.mongoose = mongoose;
exports.db = db;