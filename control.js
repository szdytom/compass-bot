const mineflayer = require('mineflayer');
const { pathfinder, Movements } = require('mineflayer-pathfinder');
const { GoalNear } = require('mineflayer-pathfinder').goals

function gotoOwner(bot, context) {
	let owner = context.owner();
	if (!owner) {
		console.log('Owner is not configured or is offline');
		return false;
	}

	if (!owner.entity) {
		console.log('Owner is out of sight');
		return false;
	}
	let pos = owner.entity.position;
	bot.pathfinder.setMovements(context.peaceful_tactic);
	bot.pathfinder.setGoal(new GoalNear(pos.x, pos.y, pos.z, 1))
}

module.exports = { gotoOwner };
