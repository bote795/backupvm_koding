/*
	Modules
 */
var logger = require(__dirname + '/libs/logger');
var _ = require('underscore');
var helpers = require(__dirname + '/libs/helper');

/*
	Webserver
 */
var connect = require('connect');
var express = require('express')
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);
var port = (process.env.PORT || 8000);

/*
	Models
 */
var Game = require(__dirname + '/models/Game.js');

app.configure(function() {
	app.set('views', __dirname + '/views');
	app.set('view engine', 'jade');
	app.use(app.router);
	app.use(express.static(
		__dirname + '/public'
	));
});

server.listen(port);

app.get('/', function(req, res) {
	res.render('index.jade', {
		pageTitle : 'Battlefield W'
	});
});

app.get('/new', function(req, res) {
	var game = new Game();
	game.save(function(err, theGame) {
		if (err) {
			res.render('error.jade', {
				pageTitle: 'Error',
				error: {
					title: 'Could not save game!',
					message: 'The game could not be created!'
				}
			});
		} else {
			res.redirect('/play/' + theGame.id);
		}
	});
});

app.get('/play/:id', function(req, res) {
	Game.findById(req.params.id, function(err, theGame) {
		if (err) {
			res.render('error.jade', {
				pageTitle: 'Error',
				error: {
					title: 'Could not find the game!',
					message: 'The game with the ID `' + req.params.id + '` could not be found!'
				}
			});
		} else {
			res.render('play.jade', {
				id: theGame.id,
				pageTitle: 'Play Battlefield W'
			});
		}
	});
});

/*
	Websockets
 */
io.set('log level', 2);

io.sockets.on('connection', function(socket) {
	/**
	 * Check if game exists in database.
	 *
	 * @param {Object} data
	 *        id: {String} Game ID
	 */
	socket.on('game validate', function(data) {
		if (data && data.id) {
			logger.log(7, 'Validating game `' + data.id + '`.');

			Game.findById(data.id, function(err, theGame) {
				if (err || !theGame) {
					if (err) {
						logger.log(1, 'Could not find game `' + data.gameid + '` for validation: ' + err);
					} else {
						logger.log(4, 'Game `' + data.id + '` could not be validated!');
					}

					socket.emit('error', {
						message: 'Could not validate the game!'
					});
				} else {
					logger.log(7, 'Game `' + theGame.id + '` validated');

					socket.emit('game validate', {
						id: theGame.id
					});
				}
			});
		}
	});

	/**
	 * Initialize game, add player to database and add player into game channel
	 *
	 * @param {Object} data
	 *        id: {String} Game ID
	 */
	socket.on('game init', function(data) {
		if (data && data.id) {
			logger.log(7, 'Initialize game `' + data.id + '`.');

			Game.findById(data.id, function(err, theGame) {
				if (err || !theGame) {
					if (err) {
						logger.log(1, 'Error while finding game to init `' + data.id + '`: ' + err);
					} else {
						logger.log(4, 'Game `' + data.id + '` could not be validated!');
					}

					socket.emit('error', {
						message: 'Could not Initialize the game!'
					});
				} else {
					//Check if game already has started
					if (theGame.started === false) {
						//Check if player already joined the game
						var playerJoined = _.any(theGame.players, function(player) {
							return (player.id === socket.id);
						});

						if (playerJoined) {
							//Player already joined the game
							logger.log(6, 'Player `' + socket.id + '` already joined the game `' + theGame.id + '`!');

							socket.emit('error', {
								message: 'You already joined the game!'
							});
						} else {
							//Add player to game
							var thePlayer = {
								id: socket.id,
								manager: (theGame.players.length === 0),
								tankType: helpers.randomTank(),
								position: {
									x: helpers.getRandom(100, 840), //940 - 100
									y: helpers.getRandom(140, 360) //500 - 140
								}
							};
							theGame.players.push(thePlayer);

							//Save game with new player in database
							theGame.save(function(err, theGame) {
								if (err) {
									logger.log(7, 'Could not save game `' + data.id + '` after adding the player `' + socket.id + '`: ' + err);

									socket.emit('error', {
										message: 'Could not add your tank to the battlefield!'
									});
								} else {
									logger.log(6, 'Added new player `' + socket.id + '` to the game `' + theGame.id + '`.');

									//Join player in game channel
									socket.join(theGame.id);
	
									//Init player game
									socket.emit('game init', {
										player: thePlayer,
										playerlist: theGame.players
									});

									//Update client player list
									io.sockets.in(theGame.id).emit('game player join', {
										player: thePlayer
									});
								}
							});
						}
						
					} else {
						socket.emit('warning', {
							message: 'The game already started!'
						});
					}
				}
			});
		}
	});
	
	/**
	 * Player requests game start.
	 *
	 * @param {Object} data
	 *        gameid: {String} ID of the game to start
	 *
	 * @return {[type]}
	 */
	socket.on('game request start', function(data) {
		if (data && data.gameid) {
			logger.log(6, 'Player `' + socket.id + '` tries to start game `' + data.gameid + '`.');

			Game.findById(data.gameid, function(err, theGame) {
				if (err || !theGame) {
					if (err) {
						logger.log(1, 'Error while finding game `' + data.gameid + '` the player `' + socket.id + '` tried to start!');
					} else {
						logger.log(4, 'Could not find game `' + data.gameid + '` the player `' + socket.id + '` tried to start!');
					}

					socket.emit('error', {
						message: 'You tried to start a game that doesn\'t exist!'
					});
				} else {
					//Get player from playerlist
					var thePlayer = _.find(theGame.players, function(player) {
						return (player.id === socket.id);
					});

					//Check if the player is the game manager
					if (thePlayer.manager === true) {
						theGame.started = true;

						//Save started game
						theGame.save(function(err) {
							if (err) {
								logger.log(1, 'Could not save started game `' + theGame.id + '`: ' + err);
							} else {
								logger.log(5, 'Game `' + theGame.id + '` started.');

								io.sockets.in(theGame.id).emit('game start');
							}
						});
					}
				}
			});
		}
	});
	
	/**
	 * Player moved his position
	 *
	 * @param {Object} data
	 *        g: {String} Game ID
	 *        x: {Number} Target x position
	 *        y: {Number} Target y position
	 *        r: {Number} Target rotation
	 */
	socket.on('game player move', function(data) {
		if (data && data.g && data.x && data.y && data.r) {
			io.sockets.in(data.g).emit('game player move', {
				p: socket.id,
				x: data.x,
				y: data.y,
				r: data.r
			});
		}
	});

	/**
	 * Player fired a missile.
	 *
	 * @param {Object} data
	 *        g: {String} Game ID
	 *        x: {Number} Target x position
	 *        y: {Number} Target y position
	 *        r: {Number} Target rotation
	 */
	socket.on('game player shoot', function(data) {
		if (data && data.g && data.x && data.y && data.r) {
			io.sockets.in(data.g).emit('game player shoot', {
				p: socket.id,
				x: data.x,
				y: data.y,
				r: data.r
			});
		}
	});

	/**
	 * Player hit an opponent with a missile
	 *
	 * @param {Object} data
	 *        g: {String} Game ID
	 *        i: {String} ID of the missile
	 *        p: {String} ID of the player who got hit
	 */
	socket.on('game player shoot hit', function(data) {
		if (data && data.g && data.i && data.p) {
			io.sockets.in(data.g).emit('game player shoot hit', {
				i: data.i, //ID of the missile
				f: socket.id, //ID of the player who fired the missile
				p: data.p //ID of the player who got hit
			});

			Game.findById(data.g, function(err, theGame) {
				if (err || !theGame) {
					if (err) {
						logger.log(1, 'Error while finding the game `' + data.g + '`: ' + err);
					} else {
						logger.log(4, 'Could not find the game `' + data.g + '`!');
					}
				} else {
					//Get player from playerlist
					var thePlayer = _.find(theGame.players, function(player) {
						return (player.id === socket.id);
					});

					if (thePlayer && thePlayer.health >= 0) {
						thePlayer.health -= 10;

						if (thePlayer.health === 0)
							thePlayer.health = -1; //0 can't be transported over websockets

						//Save player with new health
						theGame.save(function(err) {
							if (err) {
								logger.log(1, 'Could not save game `' + theGame.id + '` after player was hit: ' + err);
							} else {
								io.sockets.in(theGame.id).emit('game player update', {
									playerid: data.p,
									health: thePlayer.health
								});
							}
						});
					}
				}
			});
		}
	});

	socket.on('disconnect', function() {
		logger.log(5, 'Client `' + socket.id + '` disconnected!');

		//Get all game channels for the user
		var rooms = io.sockets.manager.roomClients[socket.id];
		_.each(rooms, function(inRoom, room) {
			if (room.length && inRoom) {
				room = room.substring(1);
				logger.log(5, 'Remove client from game ' + room);

				//Find game by channelname
				Game.findById(room, function(err, theGame) {
					if (err || !theGame) {
						if (err) {
							logger.log(1, 'Error while finding game `' + theGame.id + '` the player `' + socket.id + '` tried to leave!');
						} else {
							logger.log(2, 'Could not find game `' + room + '` the player `' + socket.id + '` tried to leave!');
						}
					} else {
						//Remove player from game
						var playerRemove = _.find(theGame.players, function(player) {
							return (player.id === socket.id);
						});
						theGame.players.id(playerRemove._id).remove();

						//Save game
						theGame.save(function(err, theGame) {
							if (err || !theGame) {
								if (err) {
									logger.log(1, 'Error while saving game `' + theGame.id + '` with removed player `' + socket.id + '`!');
								} else {
									logger.log(2, 'Error saving game after removing player: Could not find game!');
								}
							} else {
								//Update playerlist
								io.sockets.in(theGame.id).emit('game player leave', {
									player: playerRemove
								});
							}
						});
					}
				});
			}
		});
	});
});