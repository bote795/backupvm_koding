var helpers = {
	/**
	 * Get a random color for the player.
	 *
	 * @return {String}
	 */
	randomTank: function() {
		return this.getRandom(0, 1);
	},

	/**
	 * Get a random number between min and max
	 *
	 * @param {Number} min
	 * @param {Number} max
	 *
	 * @return {Number}
	 */
	getRandom: function(min, max) {
		if(min > max) {
			return -1;
		}

		if(min == max) {
			return min;
		}

		var r;

		do {
			r = Math.random();
		}
		while(r == 1.0);

		return min + parseInt(r * (max - min + 1), 10);
	}
};

module.exports = helpers;