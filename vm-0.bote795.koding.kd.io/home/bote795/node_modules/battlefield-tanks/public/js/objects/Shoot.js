(function() {
	/*
		Shoot
	 */
	var Shoot = function(playerid, x, y, rotation) {
		this.initialize(playerid, x, y, rotation);
	};

	var shoot = Shoot.prototype = new createjs.Container();
	shoot.Container_initialize = shoot.initialize;

	shoot.initialize = function(playerid, x, y, rotation) {
		var _this = this;
		this.Container_initialize();

		this.width = 6;
		this.height = 15;

		this.x = x;
		this.y = y;

		this.rotation = rotation;
		this.playerid = playerid;

		this.image = new Image();
		this.image.src = '/assets/missile/0.png';
		this.image.name = 'missileBackground';

		this.hit = 10;

		$(this.image).load(function(e) {
			_this.background = new createjs.Bitmap(_this.image);
			_this.addChild(_this.background);
		});
	};

	window.Shoot = Shoot;
}());