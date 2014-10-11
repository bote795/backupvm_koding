var socketOptions = {
	'reconnect': false
};
var socket = io.connect('http://localhost:8000', socketOptions);

function registerSockets() {
	app.debug('Registering sockets...');

	/*
		Application sockets
	 */

	socket.on('connect', function() {
		app.debug('Socket: Connected to Websocket Server.');
	});

	socket.on('disconnect', function() {
		app.debug('Socket: Disconnected from Websocket Server!');
		app.error('Disconnected from server...');
	});

	socket.on('error', function(data) {
		if (data.message) {
			app.debug('Error: ' + data.message);
			app.error(data.message);
		}
	});

	socket.on('warning', function(data) {
		if (data.message) {
			app.debug('Warning: ' + data.message);
			app.warning(data.message);
		}
	});

	socket.on('info', function(data) {
		if (data.message) {
			app.debug('Info: ' + data.message);
			app.info(data.message);
		}
	});

	socket.on('success', function(data) {
		if (data.message) {
			app.debug('Success: ' + data.message);
			app.success(data.message);
		}
	});

	/*
		Game meta sockets
	 */

	/**
	 * Game validated by server
	 *
	 * @param data {Object}
	 *        id: {String} Game ID
	 */
	socket.on('game validate', function(data) {
		app.debug('Socket: game validatet');

		if (theGame && data.id) {
			theGame.validate(data.id);
		}
	});

	/**
	 * Game initialized by server
	 *
	 * @param data {Object}
	 *        player: {Object} Player
	 *        playerlist: {Array} Array of all players
	 */
	socket.on('game init', function(data) {
		app.debug('Socket: Init game');

		if (data.player && data.playerlist) {
			theGame.setPlayer(data.player);

			theGame.updatePlayers(data.playerlist);
			theGame.ready();
		}
	});

	socket.on('game player update', function(data) {
		app.debug('Socket: game player update');

		console.log('socket ', data);

		if (data && data.playerid && data.health) {
			theGame.trigger('health:update', {
				playerid: data.playerid,
				health: data.health
			});
		}
	});

	/**
	 * Player joined the game
	 *
	 * @param {Object} data
	 *        player: {Object} Player who joined the game
	 */
	socket.on('game player join', function(data) {
		app.debug('Socket: game player join');

		if (data.player) {
			theGame.addPlayer(data.player);
		}
	});

	/**
	 * Player left the game
	 *
	 * @param {Object} data
	 *        player: {Object} Player who left the game
	 */
	socket.on('game player leave', function(data) {
		app.debug('Socket: game player leave');

		if (data.player) {
			theGame.removePlayer(data.player);
		}
	});

	/*
		Game Sockets
	 */

	/**
	 * Opponent moved to a different position
	 *
	 * @param {Object} data
	 *        p: {String} ID of the player who moved
	 *        x: {Number} X target position
	 *        y: {Number} Y target position
	 *        r: {Number} Target rotation
	 */
	socket.on('game player move', function(data) {
		if (data.p && data.x && data.y && data.r) {
			theGame.movePlayer(data.p, data.x, data.y, data.r);
		}
	});

	/**
	 * Opponent shot a missile
	 *
	 * @param {Object} data
	 *        p: {String} ID of the player who shot
	 *        x: {Number} X position of the shooting start point
	 *        y: {Number} Y position of the shooting start point
	 *        r: {Number} Rotation of the shooting start point
	 */
	socket.on('game player shoot', function(data) {
		app.debug('Socket: game player shoot');

		if (data.p && data.x && data.y && data.r) {
			theGame.shoot(data.p, data.x, data.y, data.r);
		}
	});

	/**
	 * Player was hit by a opponent missile
	 *
	 * @param {Object} data
	 *        f: {String} ID of the opponent who shot the missile
	 *        p: {String} ID of the player who was hit
	 */
	socket.on('game player shoot hit', function(data) {
		app.debug('Socket: game shoot hit');

		if (data.f && data.p) {
			theGame.trigger('hit', {
				id: data.i,
				from: data.f,
				hit: data.p
			});
		}
	});

	/**
	 * The game was started
	 */
	socket.on('game start', function() {
		app.debug('Socket: game start');

		theGame.start();
	});

	/*
		Game play sockets
	 */

	app.debug('All sockets registered.');
}

var Game = Backbone.Model.extend({
	//Preloader
	manifest: [
		//Tanks
		{
			id: 'tank-0',
			src: '../assets/tank/0.png'
		},
		{
			id: 'tank-1',
			src: '../assets/tank/1.png'
		},

		//Missiles
		{
			id: 'missile',
			src: '../assets/missile/0.png'
		},

		/*
			Sounds
		 */
		//Tank
		{
			id: 'tank-move',
			src: '../assets/sounds/tank_move.mp3'
		},
		
		//Missile
		{
			id: 'missile-fire',
			src: '../assets/sounds/missile.wav'
		},
		{
			id: 'missile-explode',
			src: '../assets/sounds/missile_explosion.wav'
		}
	],
	assets: {},
	preload: null,

	//Game meta data
	id: null, //Game ID
	valid: false, //Whether the game is valid (proofed by server)
	stage: null, //Easeljs canvas
	stageWidth: null, //Width of the canvas
	stageHeight: null, //Height of the canvas
	map: null,
	//opponentMove: false, //Opponent has moved since the last tick
	hasSound: false,

	//Game data
	pause: true, //Game is in pause mode
	isReady: false, //Game is ready
	players: {}, //List of all players

	//Player data
	player: null, //Player
	moved: false, //Player moved since last tick
	lastShoot: null, //Date in milliseconds since the last shot
	shootCooldown: 2000, //Number of milliseconds the player can't fire
	health: 100, //Player health
	
	//Texts
	text: {
		fps: null, //Display FPS
		health: null, //Display player health
		coolDown: null //Pipe cooldown of the player tank
	},

	//Shapes
	shapes: {
		preload: null, //Preload animation
		coolDown: null //Pipe cooldown gradient
	},

	//Selectors
	selectors: {
		list: '#player-list', //Player list
		actions: '#player-actions', //Player actions
		startGame: '#player-start-game', //Start button
		stage: '#stage' //Canvas
	},

	//Helpers
	keys: {
		LEFT: 37,
		TOP: 38,
		RIGHT: 39,
		DOWN: 40,
		SPACE: 32,

		W: 87,
		A: 65,
		S: 83,
		D: 68
	},

	//Speed
	speed: {
		rotation: 3,
		forward: 3,
		backward: 1.5,
		shoot: 5
	},

	//Colors
	colors: {
		green: '#87CA4D',
		yellow: '#f89406',
		red: '#9d261d'
	},

	//Shoots
	shoots: [],

	/**
	 * Load assets and inititialze game when finished.
	 */
	load: function() {
		var _this = this;

		//Check for the ability to play sounds
		if (!createjs.SoundJS.checkPlugin(true)) {
			app.debug('Unable to play sounds!');
		}

		//Create new stage
		this.stage = new createjs.Stage(this.selectors.stage.substring(1));

		//Create preloader animation
		this.shapes.preload = new createjs.Text('Loading ...', 'bold 30px Arial', this.colors.green);
		this.shapes.preload.textAlign = 'center';
		this.shapes.preload.x = 460;
		this.shapes.preload.y = 220;
		this.stage.addChild(this.shapes.preload);
		this.stage.update();

		//Create preloader
		this.preload = new createjs.PreloadJS();

		//Install sound plugin
		this.preload.installPlugin(createjs.SoundJS);

		//Set options
		this.preload.setMaxConnections(5);

		//Set progress handler
		this.preload.onProgress = function(e) {
			_this.shapes.preload.text = 'Loading ' + e.loaded.toFixed(1) * 100 + '%';
			_this.stage.update();
		};

		//Set error handler
		this.preload.onError = function(e) {
			app.debug('Error while loading asset: ' + e.src);

			//Displayer error message
			_this.shapes.preload.color = _this.colors.red;
			_this.shapes.preload.text = 'Error while loading the game!';

			_this.stage.update();
		};

		//Set progress complete handler
		this.preload.onComplete = function(e) {
			//Remove preloader
			_this.stage.removeChild(_this.shapes.preload);
			_this.stage.update();

			//Register socket handlers
			registerSockets();

			//Init game
			_this.init();

			//Handle keydown events
			$(window).keydown(function(e) {
				theGame.keyDown(e.which);
			});

			//Handle keyup events
			$(window).keyup(function(e) {
				theGame.keyUp(e.which);
			});
		};

		//Load
		this.preload.loadManifest(this.manifest);
	},

	/**
	 * Init game.
	 */
	init: function() {
		var _this = this;

		/*
			Create event listeners
		 */
		
		//Player joined/left the game
		this.on('player:update', function() {
			var $playerlist = $(_this.selectors.list);
			$playerlist.html('');

			_.each(_this.players, function(player) {
				$playerlist.append('<li style="color: #' + player.color + '">' + player.id + '</li>');
			});
		});

		//Player moved the position
		this.on('player:move', function() {
			this.moved = true;

			if (!this.player.moveTankSound) {
				this.player.moveTankSound = createjs.SoundJS.play('tank-move', createjs.SoundJS.INTERUPT_NONE);
			}
		});

		this.on('player:stop', function() {
			if (!this.player.spinLeft && !this.player.spinRight && !this.player.moveForward && !this.player.moveBackward && this.player.moveTankSound) {
				this.player.moveTankSound.stop();
				this.player.moveTankSound = null;
			}
		});

		//An opponent moved the position
		/*this.on('player:opponentmove', function() {
			_this.opponentMove = true;
		});*/

		//Pause state changed
		this.on('pause:change', function() {
			app.debug('Set pause: ' + _this.pause);
			createjs.Ticker.setPaused(_this.pause);
		});

		//Player shooted
		this.on('player:shoot', function(data) {
			socket.emit('game player shoot', {
				g: _this.id,
				x: data.x,
				y: data.y,
				r: data.rotation
			});

			//Cooldown gradient
			//TODO: animate gradient
		});

		this.on('health:update', function(data) {
			console.log('health', data);

			if (data && data.health) {
				if (data.playerid && data.playerid === this.player.id) {
					//Set player health
					_this.health = data.health;

					if (_this.health <= 0) {
						this.stage.removeChild(this.player.tank);

						app.error('You\'ve lost!');
					}
				} else if (data.health <= 0) {
					//Opponent health is below 0
					var thePlayer = _.find(_this.players, function(player) {
						return (player.id === data.playerid);
					});

					//Remove player from stage
					if (thePlayer && thePlayer.tank)
						_this.stage.removeChild(thePlayer.tank);

					app.success('Player ' + data.playerid + ' lost!');
				}

				if (_this.health < 0)
					_this.health = 0;
			}
		});

		//Player got hit by opponent
		this.on('hit', function(data) {
			this.player.moveTankSound = createjs.SoundJS.play('missile-explode', createjs.SoundJS.INTERRUPT_ANY);

			if (data.hit === this.player.id) {
				app.debug('Hit by ' + data.from);

				//Remove shot from shot list and from stage
				_this.shoots = _.filter(_this.shoots, function(shoot) {
					if (shoot.id === data.id) {
						app.debug(_this.stage.removeChild(shoot));
						return false;
					} else {
						return true;
					}
				});
			}
		});

		//Get canvas dimensions
		this.stageWidth = $(this.selectors.stage).width();
		this.stageHeight = $(this.selectors.stage).height();

		//FPS text
		this.text.fps = new createjs.Text('FPS: ', '12px Arial', '#ffffff');
		this.text.fps.textAlign = 'left';
		this.text.fps.x = this.stageWidth - 65;
		this.text.fps.y = 5;
		this.stage.addChild(this.text.fps);

		//Healt text
		this.text.health = new createjs.Text('Health: ' + this.health, 'bold 12px Arial', this.colors.green);
		this.text.health.textAlign = 'left';
		this.text.health.x = 5;
		this.text.health.y = 5;
		this.stage.addChild(this.text.health);

		//Set pipe cooldown
		this.text.coolDown = new createjs.Text('Cooldown:', 'bold 12px Arial', this.colors.green);
		this.text.coolDown.textAlign = 'left';
		this.text.coolDown.x = 130;
		this.text.coolDown.y = 5;
		this.stage.addChild(this.text.coolDown);

		this.shapes.coolDown = new createjs.Shape();
		this.shapes.coolDown.graphics.beginLinearGradientFill(
			[
				this.colors.green,
				this.colors.red
			],
			[
				0,
				1
			],
			200,
			7,
			350,
			10
		).rect(200, 7, 100, 10);
		this.stage.addChild(this.shapes.coolDown);

		//Add event loop
		createjs.Ticker.addListener(this, true);
		createjs.Ticker.setFPS(30);
		createjs.Ticker.setPaused(this.pause);

		//Validate game
		socket.emit('game validate', {
			id: this.id
		});
	},

	/**
	 * Game was validated by the server
	 *
	 * @param {String} id Game ID
	 *
	 * @return {Boolean}
	 */
	validate: function(id) {
		app.debug('Validate game...');

		if (this.id === id) {
			this.valid = true;

			app.debug('Game validated.');

			socket.emit('game init', {
				id: id
			});
		} else {
			this.valid = false;

			app.debug('Game could not be validated (' + this.id + ' !== ' + id + ')');
			app.error('Game could not be validated!');
		}

		return this.valid;
	},

	/**
	 * Game loaded, validated and initialized.
	 */
	ready: function() {
		app.debug('Waiting for opponent...');

		var _this = this;

		this.playing = false;

		//Set game manager options
		if (this.player.manager === true) {
			app.debug('Current player is game manager.');

			//Add 'start game' button to player actions
			var $startGameButton = $('<li><a class="btn btn-primary" id="' + this.selectors.startGame.substring(1) + '">Start game!</a></li>');
			$startGameButton.find(this.selectors.startGame).on('click', {gameid: _this.id}, this.requestStart);
			$(this.selectors.actions).append($startGameButton);
		}

		this.isReady = true;
	},

	/**
	 * Game manager requests game start.
	 *
	 * @param {Object} e
	 *     data:
	 *         gameid: {String} ID of the game
	 */
	requestStart: function(e) {
		app.debug('Request start for game: ' + e.data.gameid);

		socket.emit('game request start', {
			gameid: e.data.gameid
		});
	},

	/**
	 * Set own player account.
	 *
	 * @param {Player} player Player account
	 */
	setPlayer: function(player) {
		player.tank = new Tank(player.tankType, player.position.x, player.position.y);
		this.player = player;

		this.stage.addChild(player.tank);
	},

	/**
	 * Update players in playerlist.
	 *
	 * @param {Array} playerlist List of {Player}
	 */
	updatePlayers: function(playerlist) {
		if (_.isArray(playerlist)) {
			app.debug('Update playerlist');

			var _this = this;
			//Reset userlist
			this.players = {};

			//Iterate users and add
			_.each(playerlist, function(player) {
				_this.addPlayer(player);
			});
		}
	},

	/**
	 * Add player to game.
	 *
	 * @param {Player} player Player to add
	 */
	addPlayer: function(player) {
		//Check if user already joined
		var joined = _.any(this.players, function(playerIn) {
			return (playerIn.id === player.id);
		});

		if (!joined) {
			app.debug('Add player `' + player.id + '`.');

			//Playertank is already created,
			//only add for the other players
			if (player.id !== this.player.id) {
				//Create opponent tank
				player.tank = new Tank(player.tankType, player.position.x, player.position.y);

				this.stage.addChild(player.tank);
			}
			this.players[player.id] = player;

			this.trigger('player:update');
		} else {
			app.debug('Player `' + player.id + '` already joined!');
		}
	},

	/**
	 * Remove player from game.
	 *
	 * @param {Player} player Player to remove
	 */
	removePlayer: function(player) {
		//Check if user already joined
		var _this = this;

		var joined = _.any(this.players, function(playerIn) {
			return (playerIn.id === player.id);
		});

		if (joined) {
			app.debug('Remove player: ' + player.id);

			//Remove player from playerlist
			this.players = _.reject(this.players, function(playerIn) {
				if (playerIn.id === player.id) {
					_this.stage.removeChild(playerIn.tank);
					return true;
				} else {
					return false;
				}
			});

			this.trigger('player:update');
		} else {
			app.debug('Player `' + player.id + '` did not join and cannot be removed!');
		}
	},

	/**
	 * Move opponent to a postion. The move is animated so the *** are compensated.
	 *
	 * @param {String} playerid ID of the player who moved
	 * @param {Number} x New tank x position
	 * @param {Number} y New tank y position
	 * @param {Number} rotation New tank rotation
	 *
	 * @return {[type]}
	 */
	movePlayer: function(playerid, x, y, rotation) {
		if (playerid !== this.player.id) {
			createjs.Tween.get(this.players[playerid].tank).to({
				x: x,
				y: y,
				rotation: rotation
			}, 100);

			//this.trigger('player:opponentmove');
		}
	},

	/**
	 * Start the game.
	 */
	start: function() {
		$(this.selectors.startGame).parent().remove();
		app.success('<strong>The game has started!</strong>');

		this.pause = false;
		this.trigger('pause:change');
	},

	/**
	 * EasleJS stage ticker (eventloop)
	 */
	tick: function() {
		var _this = this;

		//Move player
		this.move(this.player);

		//If a opponent move since the last tick, move the opponents
		/*if (this.opponentMove) {
			_.each(this.players, function(player) {
				_this.move(player);
			});

			this.opponentMove = false;
		}*/

		//If any missiles are on the stage, move the missiles
		if (this.shoots.length > 0) {

			//Filter missiles which hit a player or are out of bounds
			var shoots = _.filter(this.shoots, function(shoot) {
				//Move missile
				shoot.x += Math.sin(shoot.rotation * (Math.PI / -180)) * _this.speed.shoot;
				shoot.y += Math.cos(shoot.rotation * (Math.PI / -180)) * _this.speed.shoot;

				var hit = false;
				//Only do collision tests when the player shooted
				if (shoot.playerid == _this.player.id) {
					hit = _this.shootTest(shoot.x, shoot.y, shoot.hit);
				}

				//Check for collision with tank and if the missile is out of bounds
				if (hit ||
					shoot.x - 15 < 0 ||
					shoot.x > _this.stageWidth - 15 ||
					shoot.y - 15 < 0 ||
					shoot.y > _this.stageHeight - 15)
				{
					//Remove missile
					_this.stage.removeChild(shoot);

					//Emit hit
					if (hit) {
						socket.emit('game player shoot hit', {
							g: _this.id, //Game ID
							i: shoot.id, //Shoot ID
							p: hit.id //Player who was hit
						});
					}

					return false;
				} else {
					return true;
				}
			});

			this.shoots = shoots;
		}

		//Set FPS text
		this.text.fps.text = 'FPS: ' + createjs.Ticker.getMeasuredFPS().toFixed(2);

		//Set health text
		this.text.health.text = 'Health: ' + this.health;

		if (this.health <= 0) {
			this.text.health.color = this.colors.red;
			this.text.health.text = 'DEAD!';
		}
		if (this.health < 30) {
			this.text.health.color = this.colors.red;
		} else if (this.health < 50) {
			this.text.health.color = this.colors.yellow;
		}

		//Update stage
		this.stage.update();
	},

	/**
	 * Move player to a position.
	 *
	 * @param {Player} player Player to move
	 */
	move: function(player) {
		if (player.tank) {
			//Reset postion if tank is out of canvas
			var xBefore = player.tank.x;
			var yBefore = player.tank.y;
			var rotationBefore = player.tank.rotation;

			var hit = false;

			//Spin around axis
			if (player.spinLeft) {
				if (player.moveBackward) {
					player.tank.rotation += this.speed.rotation;
				}
				else {
					player.tank.rotation -= this.speed.rotation;
				}
			} else if (player.spinRight) {
				if (player.moveBackward)
					player.tank.rotation -= this.speed.rotation;
				else
					player.tank.rotation += this.speed.rotation;
			}

			//Move forward/backward
			if (player.moveForward) {
				player.tank.x += Math.sin(player.tank.rotation * (Math.PI / -180)) * this.speed.forward;
				player.tank.y += Math.cos(player.tank.rotation * (Math.PI / -180)) * this.speed.forward;
			}

			if (player.moveBackward) {
				player.tank.x -= Math.sin(player.tank.rotation * (Math.PI / -180)) * this.speed.backward;
				player.tank.y -= Math.cos(player.tank.rotation * (Math.PI / -180)) * this.speed.backward;
			}

			//Hit test for opponents
			hit = this.hitTest(this, player.tank.x, player.tank.y);

			//Reset tank if out of canvas
			if (hit ||
				player.tank.x - 35 < 0 ||
				player.tank.x > this.stageWidth - 35 ||
				player.tank.y - 35 < 0 ||
				player.tank.y > this.stageHeight - 35)
			{
				player.tank.x = xBefore;
				player.tank.y = yBefore;
			} else if (player.id === this.player.id && this.moved === true) {
				//Emit move if player moved since last time
				socket.emit('game player move', {
					g: this.id,
					x: player.tank.x,
					y: player.tank.y,
					r: player.tank.rotation
				});

				this.moved = false;
			}
		}
	},

	keyDown: function(key) {
		this.trigger('keydown', {
			key: key
		});

		switch (key) {
			case this.keys.LEFT:
			case this.keys.A:
				this.spinLeft();
				break;
			case this.keys.TOP:
			case this.keys.W:
				this.moveForward();
				break;
			case this.keys.RIGHT:
			case this.keys.D:
				this.spinRight();
				break;
			case this.keys.DOWN:
			case this.keys.S:
				this.moveBackward();
				break;
			case this.keys.SPACE:
				this.shoot();
				break;
		}
	},

	keyUp: function(key) {
		this.trigger('keyup', {
			key: key
		});

		switch (key) {
			case this.keys.LEFT:
			case this.keys.A:
				this.stopLeft();
				break;
			case this.keys.TOP:
			case this.keys.W:
				this.stopForward();
				break;
			case this.keys.RIGHT:
			case this.keys.D:
				this.stopRight();
				break;
			case this.keys.DOWN:
			case this.keys.S:
				this.stopBackward();
				break;
		}
	},

	hitTest: function(_this, x, y) {
		return _.any(this.players, function(player) {
			//Skip current player in playerlist
			if (_this.player.id !== player.id) {
				/*var p = player.tank.localToLocal(_this.player.tank.x, _this.player.tank.y, _this.player.tank);
				console.log(p);
				return (player.tank.hitTest(p.x, p.y));*/

				return (player.tank.hitRadius(x, y, _this.player.tank.hit));
			} else {
				return false;
			}
		});
	},

	shootTest: function(x, y, hit) {
		return _.find(this.players, function(player) {
			if (player && player.tank) {
				if (player.tank.hitRadius(x, y, hit))
					return true;
				else
					return false;
			}
		});
	},

	spinLeft: function() {
		this.player.spinRight = false;
		this.player.spinLeft = true;

		this.trigger('player:move');
	},

	spinRight: function() {
		this.player.spinLeft = false;
		this.player.spinRight = true;

		this.trigger('player:move');
	},

	moveForward: function() {
		this.player.moveBackward = false;
		this.player.moveForward = true;

		this.trigger('player:move');
	},

	moveBackward: function() {
		this.player.moveForward = false;
		this.player.moveBackward = true;

		this.trigger('player:move');
	},

	stopLeft: function() {
		this.player.spinLeft = false;

		this.trigger('player:stop');
	},

	stopRight: function() {
		this.player.spinRight = false;

		this.trigger('player:stop');
	},

	stopForward: function() {
		this.player.moveForward = false;

		this.trigger('player:stop');
	},

	stopBackward: function() {
		this.player.moveBackward = false;

		this.trigger('player:stop');
	},

	shoot: function(playerid, x, y, rotation) {
		var shoot = null;

		if (playerid) {
			//Opponent fired
			if (playerid !== this.player.id) {
				shoot = new Shoot(
					playerid,
					x,
					y,
					rotation
				);
				this.stage.addChild(shoot);
				this.shoots.push(shoot);
			}

			createjs.SoundJS.play('missile-fire', createjs.SoundJS.INTERUPT_LATE);
		} else {
			//Check if pipe is cooled down
			var now = new Date();

			if (this.lastShoot === null || (this.lastShoot < now.getTime() - this.shootCooldown)) {
				//Player fires
				shoot = new Shoot(
					this.player.id,
					this.player.tank.x + Math.sin(this.player.tank.rotation * (Math.PI / -180)) * 25,
					this.player.tank.y + Math.cos(this.player.tank.rotation * (Math.PI / -180)) * 35,
					this.player.tank.rotation
				);
				this.stage.addChild(shoot);
				this.shoots.push(shoot);

				this.trigger('player:shoot', {
					x: shoot.x,
					y: shoot.y,
					rotation: shoot.rotation
				});

				this.lastShoot = now.getTime();

				createjs.SoundJS.play('missile-fire', createjs.SoundJS.INTERUPT_LATE);
			}
		}
	}
});
var theGame = null;

$(function() {
	//Get game id
	//ToDo: Load from url
	var gameId = $('#game-id').html();
	app.debug('Game ID: ' + gameId);

	//Create new game instance and init game
	theGame = new Game({
		id: gameId
	});
	theGame.load();
});