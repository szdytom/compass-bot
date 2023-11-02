import assert from 'node:assert/strict';
import debug from 'debug';
import { Task } from 'compass-utils';
const logger = debug('mineflayer-fly-control');

export class ElytraNotEquippedError extends Error {
	constructor() { super('Elytra is not equipped!'); }
}

export class InsufficientRocketError extends Error {
	constructor(flight_requirement, flight_actual) {
		super(`Expected ${flight_requirement} flight in total, got ${flight_actual}`);
		this.flight_requirement = flight_requirement;
		this.flight_actual = flight_actual;
	}
};

export class AlreadyElytraFlyingError extends Error {
	constructor() { super('Already elytra flying!'); }
}

export function fireworkFlight(firework_item) {
	return firework_item?.nbt?.value?.Fireworks?.value?.Flight?.value ?? 1;
}

async function takeOffTask(bot, task) {
	if (bot.entity.elytraFlying) { throw new AlreadyElytraFlyingError(); }
	if (bot.entity.onGround) {
		await task._waitDependent(bot.control.jumpToHighest());
		task._interuptableHere();
	}
	
	await bot.elytraFly();
	task._interuptableHere();
}

async function ascendTask(bot, task, flight, gracefulMode) {
	assert.ok(typeof flight == 'number');
	bot.control.adjustXZ();
	await bot.look(0, Math.PI / 2, true);
	task._interuptableHere();

	if (!bot.entity.elytraFlying) { await takeOffTask(bot, task); }
	await bot.waitForTicks(1);
	task._interuptableHere();

	function gracefulModePredicate() {
		return bot.entity.velocity.y >= 0.01;
	}

	function fastModePredicate() {
		return bot.fireworkRocketDuration > 0;
	}

	const predicate = gracefulMode ? gracefulModePredicate : fastModePredicate;

	let flight_pre_rocket = fireworkFlight(bot.heldItem);
	for (let i = 0; i < flight; i += flight_pre_rocket) {
		bot.activateItem();
		do {
			await bot.waitForTicks(Math.max(1, bot.fireworkRocketDuration));
			task._interuptableHere();
		} while (predicate());
	}
}

export default function inject(bot) {
	const firework_id = bot.registry.itemsByName.firework_rocket.id;
	const elytra_id = bot.registry.itemsByName.elytra.id;
	const elytra_slot = bot.getEquipmentDestSlot('torso');

	bot.flyctl = {};
	bot.flyctl.skipValidation = false;
	function beforeFlyValidation(flight_requirement = 0) {
		assert.ok(typeof flight_requirement == 'number');
		assert.ok(flight_requirement >= 0);

		if (bot.flyctl.skipValidation) {
			logger('beforeFlyValidation() skipped.');
			return;
		}

		logger(`beforeFlyValidation() elytra slot: ${elytra_slot}`);
		let elytra_slot_item = bot.inventory.slots[elytra_slot]?.type;
		if (elytra_slot_item != elytra_id) {
			logger(`beforeFlyValidation() failed: elytra slot found ${elytra_slot_item}.`);
			logger(`beforeFlyValidation() expected ${elytra_id}.`);
			throw new ElytraNotEquippedError();
		}

		if (flight_requirement > 0) {
			let rocket_item = bot.heldItem;
			if (rocket_item?.type != firework_id) {
				logger('beforeFlyValidation() failed: holding is not rocket.');
				logger(`beforeFlyValidation() found ${rocket_item?.type} expected ${firework_id} .`);
				throw new InsufficientRocketError(flight_requirement, 0);
			}

			let flight_sum = rocket_item.count * fireworkFlight(rocket_item);
			if (flight_sum < flight_requirement) {
				throw new InsufficientRocketError(flight_requirement, flight_sum);
			}
		}

		logger('beforeFlyValidation() passed.');
	}

	bot.flyctl.prepare = async () => {
		await bot.equip(elytra_id, 'torso');
		await bot.equip(firework_id);
	};

	bot.flyctl.ascend = async (flight = 1, gracefulMode = true) => {
		let task = new Task();
		queueMicrotask(async () => {
			try {
				beforeFlyValidation(flight);
				task._ready(await ascendTask(bot, task, flight, gracefulMode));
			} catch(err) {
				task._fail(err);
			}
		});
		return task;
	};

	bot.flyctl.gracefulAscend = (flight = 1) => {
		return bot.flyctl.ascend(flight, true);
	};

	bot.flyctl.fastAscend = (flight = 1) => {
		return bot.flyctl.ascend(flight, false);
	};

	bot.flyctl.takeOff = () => {
		let task = new Task();
		queueMicrotask(async () => {
			try {
				beforeFlyValidation(flight);
				task._ready(await takeOffTask(bot, task));
			} catch(err) {
				task._fail(err);
			}
		});
		return task;
	};
}
