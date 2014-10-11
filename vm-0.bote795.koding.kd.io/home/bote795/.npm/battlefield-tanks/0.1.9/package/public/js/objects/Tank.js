(function() {
	/*
		Tank
	 */
	var Tank = function(type, x, y) {
		this.initialize(type, x, y);
	};

	var tank = Tank.prototype = new createjs.Container();
	tank.Container_initialize = tank.initialize;

	tank.initialize = function(type, x, y) {
		var _this = this;

		this.Container_initialize();

		this.x = x;
		this.y = y;

		this.width = 100;
		this.height = 140;

		//Tank center
		this.regX = 50;
		this.regY = 70;

		this.rotationBefore = 0;

		this.hit = 40; //Hit radius

		this.image = new Image();
		this.image.src = '/assets/tank/' + type + '.png';
		this.image.name = 'tankBackground';

		$(this.image).load(function(e) {
			_this.background = new createjs.Bitmap(_this.image);
			_this.addChild(_this.background);
		});
	};

	tank.hitRadius = function(tX, tY, tHit) {
		if(tX - tHit > this.x + this.hit) { return; }
		if(tX + tHit < this.x - this.hit) { return; }
		if(tY - tHit > this.y + this.hit) { return; }
		if(tY + tHit < this.y - this.hit) { return; }

		//now do the circle distance test
		return this.hit + tHit > Math.sqrt(Math.pow(Math.abs(this.x - tX), 2) + Math.pow(Math.abs(this.y - tY), 2));
	};

	window.Tank = Tank;
}());