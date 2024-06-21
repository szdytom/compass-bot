import assert from 'node:assert/strict';
import { Task } from 'compass-utils';
import { Vec3 } from 'vec3';
import 'enhanced-vec3';
import debug from 'debug';
const logger = debug('compass-fly-control');

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

export class FlyInterferedError extends Error {
	constructor() { super('Fly task has been interfered by an external force.'); }
};

export function fireworkFlight(firework_item) {
	return firework_item?.nbt?.value?.Fireworks?.value?.Flight?.value ?? 1;
}

async function takeOffTask(bot, task) {
	if (bot.entity.elytraFlying) { throw new AlreadyElytraFlyingError(); }
	if (bot.entity.onGround) {
		await task._waitDependent(bot.cctl.jumpToHighest());
		task._interuptableHere();
	}
	
	await bot.elytraFly();
	task._interuptableHere();
}

export function potentialHeightRequired(xz_distance) {
	return xz_distance / 9.1 + 32;
}

export function yawOfXZ(pos, target) {
	const delta = target.minus(pos);
	return Math.atan2(-delta.x, -delta.z);
}

async function cruiseTask(bot, task, target, tlimit) {
	bot.cctl.centralizeXZ();
	let start_pos = bot.entity.position.clone();
	let distance_left = target.xzDistanceTo(start_pos);
	let dy_requirement = potentialHeightRequired(distance_left);
	let delta = target.minus(start_pos);
	logger(`cruiseTask() start position=${start_pos}`);
	logger(`cruiseTask() target position=${target} delta=${delta}`);
	logger(`cruiseTask() dy_requirement=${dy_requirement}`);
	if (-delta.y < dy_requirement) {
		logger(`cruiseTask() height is insufficient: another ${dy_requirement + delta.y} meters required`);
	}

	let delta_norm_squared;
	async function updateRoute() {
		start_pos.update(bot.entity.position);
		delta = target.minus(start_pos);
		delta_norm_squared = delta.xzNormSquared();
		await bot.look(yawOfXZ(start_pos, target), 0, true);
		task._interuptableHere();
	}
	await updateRoute();

	while (true) {
		await bot.waitForTicks(1);
		task._interuptableHere();

		if (bot.entity.onGround || !bot.entity.elytraFlying) {
			logger('cruiseTask() no longer flying!');
			throw new FlyInterferedError();
		}

		const pos = bot.entity.position.clone();
		const dpos = pos.minus(start_pos);
		const progress = dpos.dotXZ(delta) / delta_norm_squared;
		const intended_pos = start_pos.plus(delta.scaled(progress));
		const error_offset = intended_pos.xzDistanceTo(pos);
		if (progress < 1 && error_offset > 6) {
			logger(`cruiseTask() departured from expected route, error offset=${error_offset}`);
			logger(`cruiseTask() progress=${progress} expected position=${intended_pos}`);
			logger(`cruiseTask() current position=${pos} to start delta=${dpos}`);
			await updateRoute();
			logger(`cruiseTask() corrocted fly route.`);
			continue;
		}

		if (progress >= 1) {
			const error_dis = pos.xzDistanceTo(target);
			const velocity = bot.entity.velocity, hspeed = velocity.xzNorm();
			if (error_dis < tlimit && hspeed < .5) {
				break;
			} else {
				logger(`cruiseTask() goal reached, adjusting. position=${pos}`);
				await updateRoute();
				logger(`cruiseTask() replanned. facing: ${bot.entity.yaw}`);
			}
		}

		if (error_offset < tlimit) {
			pos.updateXZ(intended_pos);
		}
	}

	const final_pos = bot.entity.position;
	await bot.look(yawOfXZ(final_pos, target), 0, true);
	final_pos.updateXZ(target);
}

async function gracefulLandTask(bot, task, target_y, fall_height) {
	assert.ok(typeof target_y == 'number');
	assert.ok(typeof fall_height == 'number');
	bot.cctl.centralizeXZ();
	const start_pos = bot.entity.position.clone();
	logger(`gracefulLandTask() starting position=${start_pos}`);
	await bot.look(0, Math.PI / 6);
	task._interuptableHere();
	bot.entity.velocity.set(0, 0, 0);

	logger(`gracefulLandTask() secondary position=${start_pos}`);
	bot.entity.position.updateXZ(start_pos);

	logger(`gracefulLandTask() secondary adjusted position=${start_pos}`);
	logger(`gracefulLandTask() secondary velocity=${bot.entity.velocity}`);
	const fall_y = fall_height + target_y;
	for (let phase = 1; !bot.entity.onGround && bot.entity.position.y > fall_y; phase = (phase + 1) % 3) {
		await bot.look(phase * Math.PI / 1.5, Math.PI / 6);
		task._interuptableHere();
		const pos = bot.entity.position;
		if (pos.xzDistanceTo(start_pos) > 3) {
			throw new FlyInterferedError();
		}
	}

	const ff_pos = bot.entity.position;
	logger(`gracefulLandTask() fall stage initial position=${ff_pos}`);
	let look_promise = bot.look(yawOfXZ(ff_pos, start_pos), Math.PI / 6, true);
	await bot.unequip('torso');
	task._interuptableHere();

	bot.entity.velocity.setXZ(0, 0);
	ff_pos.updateXZ(start_pos);
	logger(`gracefulLandTask() fall stage adjusted position=${ff_pos}`);

	while (!bot.entity.onGround && bot.entity.position.y > target_y) {
		if (look_promise == null) {
		await bot.waitForTicks(1);
		} else {
			await look_promise;
			look_promise = null;
		}
		task._interuptableHere();

		const pos = bot.entity.position;
		const t = new Vec3();
		if (pos.xzDistanceTo(start_pos) > 1) {
			throw new FlyInterferedError();
		}
		bot.cctl.centralizeXZ();
	}

	bot.entity.velocity.setXZ(0, 0);
	logger(`gracefulLandTask() finish position=${bot.entity.position}`);
}

async function ascendTask(bot, task, target_y, gracefulMode) {
	assert.ok(typeof target_y == 'number');
	if (target_y <= bot.entity.position.y) { return 0; }

	bot.cctl.centralizeXZ();
	await bot.look(0, Math.PI / 2, true);
	task._interuptableHere();

	if (!bot.entity.elytraFlying) { await takeOffTask(bot, task); }
	await bot.waitForTicks(1);
	task._interuptableHere();

	function gracefulModePredicate() {
		return bot.entity.velocity.y >= 0.01;
	}

	function fastModePredicate() {
		return bot.fireworkRocketDuration > 0 || bot.entity.velocity.y > 27;
	}

	const predicate = gracefulMode ? gracefulModePredicate : fastModePredicate;

	const firework_id = bot.registry.itemsByName.firework_rocket.id;
	while (bot.entity.position.y < target_y) {
		if (bot.heldItem?.type != firework_id) {
			try {
				await bot.equip(firework_id);
			} catch (err) {
				logger(`ascendTask(): equip rocket error: ${err}.`);
				throw new InsufficientRocketError();
			}
			task._interuptableHere();
		}
		bot.activateItem();
		do {
			await bot.waitForTicks(1);
			task._interuptableHere();

			if (bot.entity.onGround || !bot.entity.elytraFlying) {
				throw new FlyInterferedError();
			}
		} while (predicate());
	}
}

export default function inject(bot) {
	const firework_id = bot.registry.itemsByName.firework_rocket.id;
	const elytra_id = bot.registry.itemsByName.elytra.id;
	const elytra_slot = bot.getEquipmentDestSlot('torso');

	bot.flyctl = {};
	bot.flyctl.skipValidation = false;
	function beforeFlightValidation() {
		if (bot.flyctl.skipValidation) {
			logger('beforeFlightValidation() skipped.');
			return;
		}

		let elytra_slot_item = bot.inventory.slots[elytra_slot]?.type;
		if (elytra_slot_item != elytra_id) {
			logger(`beforeFlightValidation() failed: elytra slot found ${elytra_slot_item}.`);
			logger(`beforeFlightValidation() expected ${elytra_id}.`);
			throw new ElytraNotEquippedError();
		}

		logger('beforeFlightValidation() passed.');
	}

	bot.flyctl.prepare = async () => {
		await bot.equip(elytra_id, 'torso');
		await bot.equip(firework_id);
	};

	bot.flyctl.ascend = (target_y, gracefulMode = true) => {
		let task = new Task();
		queueMicrotask(async () => {
			try {
				task._start();
				beforeFlightValidation();
				task._ready(await ascendTask(bot, task, target_y, gracefulMode));
			} catch(err) {
				task._fail(err);
			}
		});
		return task;
	};

	bot.flyctl.gracefulAscend = (target_y) => {
		return bot.flyctl.ascend(target_y, true);
	};

	bot.flyctl.fastAscend = (target_y) => {
		return bot.flyctl.ascend(target_y, false);
	};

	bot.flyctl.gracefulLand = (target_y, fall_height=3) => {
		let task = new Task();
		queueMicrotask(async () => {
			try {
				task._start();
				await gracefulLandTask(bot, task, target_y, fall_height);
				await bot.equip(elytra_id, 'torso');
				task._ready();
			} catch(err) {
				await bot.equip(elytra_id, 'torso');
				task._fail(err);
			}
		});
		return task;
	};

	bot.flyctl.cruise = (target_raw, teleport_limit=1) => {
		let task = new Task();
		queueMicrotask(async () => {
			try {
				task._start();
				assert.ok(target_raw instanceof Vec3);
				const target = target_raw.clone();
				target.centralizeXZ();
				task._ready(await cruiseTask(bot, task, target, teleport_limit));
			} catch(err) {
				task._fail(err);
			}
		});
		return task;
	};

	bot.flyctl.autoFlyTo = (target_raw, tactic) => {
		let task = new Task();
		queueMicrotask(async () => {
			tactic = tactic ?? {};
			tactic.ascend_mode = tactic.ascend_mode ?? 'graceful';
			tactic.teleport_limit = tactic.teleport_limit ?? 2.5;
			tactic.fall_height = tactic.teleport_limit ?? 1;

			try {
				task._start();
				assert.ok(target_raw instanceof Vec3);
				const target = target_raw.clone();
				target.centralizeXZ();
				beforeFlightValidation();
				const start_pos = bot.entity.position;

				let dy = potentialHeightRequired(start_pos.xzDistanceTo(target));
				const graceful_ascend = tactic.ascend_mode === 'graceful';
				const take_off_y = Math.max(target.y + dy, start_pos.y + 2);
				await ascendTask(bot, task, take_off_y, graceful_ascend);

				await cruiseTask(bot, task, target, tactic.teleport_limit);
				await gracefulLandTask(bot, task, target.y, tactic.fall_height);
				await bot.equip(elytra_id, 'torso');
				task._ready();
			} catch(err) {
				await bot.equip(elytra_id, 'torso');
				task._fail(err);
			}
		});
		return task;
	}

	bot.flyctl.takeOff = () => {
		let task = new Task();
		queueMicrotask(async () => {
			try {
				task._start();
				beforeFlightValidation();
				task._ready(await takeOffTask(bot, task));
			} catch(err) {
				task._fail(err);
			}
		});
		return task;
	};
}
