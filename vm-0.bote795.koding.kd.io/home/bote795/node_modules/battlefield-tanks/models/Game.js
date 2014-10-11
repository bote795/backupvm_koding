var mongoose = require(__dirname + '/../libs/db.js').mongoose;
var db = require(__dirname + '/../libs/db.js').db;

var playerSchema = new mongoose.Schema({
	id: String,
	tankType: Number,
	health: {
		type: Number,
		default: 100
	},
	name: {
		type: String,
		default: ""
	},
	position: {
		x: {
			type: Number,
			default: 0
		},
		y: {
			type: Number,
			default: 0
		}
	},
	manager: {
		type: Boolean,
		default: false
	}
});

var gameSchema = new mongoose.Schema({
	players: [playerSchema],
	created: {
		type: Date,
		default: Date.now
	},
	started: {
		type: Boolean,
		default: false
	}
});

var Game = db.model('Game', gameSchema);

module.exports = Game;