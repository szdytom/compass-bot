import debug from 'debug';
import { Queue, Task, isIterable } from 'compass-utils';
import { Vec3 } from 'vec3';
import assert from 'node:assert/strict';
const logger = debug('mineflayer-control');

// yaw = axis * Math.PI / 2
// name = "ZX"[axis % 2]
export const AXIS = {
	'-Z': 0,
	'-X': 1,
	'+Z': 2,
	'+X': 3,
	NORTH: 0,
	WEST: 1,
	SOUTH: 2,
	EAST: 3,
	0: 0,
	1: 1,
	2: 2,
	3: 3,
};

export const AXIS_UNIT = {
	0: new Vec3(0, 0, -1),
	1: new Vec3(-1, 0, 0),
	2: new Vec3(0, 0, 1),
	3: new Vec3(1, 0, 0),
};

export const AXIS_NAME = {
	0: '-Z',
	1: '-X',
	2: '+Z',
	3: '+X',
};

export const MOVE_LEVEL = {
	WALK: 1,
	SPRINT: 2,
	// TODO: SPRINT_JUMP
};

export class ControlState {
	constructor() {
		this.clear();
		for (let key of arguments) { this[key] = true; }
	}

	clear() {
		for (let key of ControlState.CONTROLS) { this[key] = false; }
	}

	update(cs) {
		for (let key of ControlState.CONTROLS) {
			this[key] = cs[key] || false;
		}
	}

	static from(cs) {
		let res = new ControlState();
		res.update(cs);
		return res;
	}

	apply(bot) {
		for (let key of ControlState.CONTROLS) {
			bot.setControlState(key, this[key]);
		}
	}

	enable(c) {
		for (let key of arguments) { this[key] = true; }
	}

	disable(c) {
		for (let key of arguments) { this[key] = false; }
	}
};

ControlState.CONTROLS = ['forward', 'back', 'left', 'right', 'jump', 'sprint', 'sneak'];

function adjust05(x) {
	return Math.floor(x) + .5;
}

function adjustXZ(vec) {
	vec.x = adjust05(vec.x);
	vec.z = adjust05(vec.z);
}

export class MoveInterferedError extends Error {
	constructor() { super('Move task has been interfered by an external force.'); }
};

export class MovePathBlockedError extends Error {
	constructor() { super('Move path is possiblely blocked.'); }
};

export class NotOnGroundError extends Error {
	constructor() { super('bot is not on ground, cannot jump'); }
};

async function moveAxisTask(bot, task, axis_raw, target_raw, level) {
	const axis = AXIS[axis_raw];
	assert.equal(typeof axis, 'number', 'axis');
	assert.ok(0 <= axis && axis <= 3, 'axis');
	assert.equal(typeof level, 'number', 'level');
	assert.ok(target_raw instanceof Vec3, 'target');
	const stable_axis = "xz"[axis % 2];
	const target = target_raw.clone();
	adjustXZ(target);

	bot.clearControlStates();
	bot.control.adjustXZ();

	let pos = bot.entity.position;
	const delta = target.minus(pos);
	let remaining_dis = delta.dot(AXIS_UNIT[axis]);

	logger(`moveAxisTask() source: ${pos}.`);
	logger(`moveAxisTask() target: ${target}.`);
	logger(`moveAxisTask() delta: ${delta}.`);
	logger(`moveAxisTask() distance: ${remaining_dis}.`);
	logger(`moveAxisTask() stable_axis: ${stable_axis}.`);
	logger(`moveAxisTask() Condition: ${delta[stable_axis]} ${delta.y}.`);
	if (Math.abs(delta.y) > 0.5 + Number.EPSILON
		|| Math.abs(delta[stable_axis]) > Number.EPSILON) {
		throw new Error('Invalid Argument: target');
	}

	if (remaining_dis < 0) {
		throw new Error('Invalid Argument: axis argument should reverse its sign.');
	}

	const stable_axis_value = target[stable_axis];

	logger('moveAxisTask() pre adjust look angle');
	await bot.look(axis * Math.PI / 2, 0, true);
	logger('moveAxisTask() post adjust look angle');
	task._interuptableHere();

	const controls = new ControlState('forward');
	if (level >= MOVE_LEVEL.SPRINT) { controls.sprint = true; }
	logger('moveAxisTask() control', controls);
	controls.apply(bot);
	logger('moveAxisTask() started.');

	let time_used = 0, pos_queue = new Queue();
	const TRACK_TICKS = 5;
	pos_queue.push(pos.clone());
	while (true) {
		await bot.waitForTicks(1);
		task._interuptableHere();

		controls.apply(bot);
		time_used += 1;
		pos = bot.entity.position;
		if (Math.abs(pos[stable_axis] - stable_axis_value) > 1.2) {
			logger('moveAxisTask() stable axis changed.');
			logger(`moveAxisTask() target.${stable_axis}: ${stable_axis_value}.`);
			logger(`moveAxisTask() pos.${stable_axis}: ${pos[stable_axis]}.`);
			throw new MoveInterferedError();
		}

		if (Math.abs(pos.y - target.y) > 0.5 + Number.EPSILON) {
			logger('moveAxisTask() y changed to much.');
			logger(`moveAxisTask() target.y=${target.y} vs. pos.y=${pos.y}`);
			throw new MoveInterferedError();
		}

		pos[stable_axis] = stable_axis_value;
		pos_queue.push(pos.clone());
		if (pos_queue.size() > TRACK_TICKS) { pos_queue.popFront(); }

		if (pos_queue.size() == 5) {
			let pos5t = pos_queue.front();
			if (pos.distanceSquared(pos5t) < Number.EPSILON) {
				logger('moveAxisTask() position changed too little.');
				logger(`moveAxisTask() position ${TRACK_TICKS} ticks ago: ${pos5t}.`);
				logger(`moveAxisTask() position now: ${pos}.`);
				throw new MovePathBlockedError();
			}
		}

		delta.update(target.minus(pos));
		remaining_dis = delta.dot(AXIS_UNIT[axis]);
		if (Math.abs(remaining_dis) <= 0.5) {
			logger(`moveAxisTask() very close! remain: ${remaining_dis}.`);
			pos.x = target.x;
			pos.z = target.z;
			bot.entity.velocity.x = 0;
			bot.entity.velocity.z = 0;
			break;
		}

		if (remaining_dis < -0.5) {
			logger('moveAxisTask() went past target.');
			throw new MoveInterferedError();
		}
	}
	bot.clearControlStates();
	task._ready(time_used);
}

async function ladderAscendTask(bot, task, target_y) {
	assert.equal(typeof target_y, 'number', 'target_y');
	bot.control.adjustXZ();
	const start_pos = bot.entity.position.clone();
	logger(`ladderAscendTask() initial position: ${start_pos}.`);
	logger(`ladderAscendTask() target y: ${target_y}.`);
	
	if (start_pos.y > target_y) {
		throw new Error('Invalid Argument: target_y is smaller than current y.');
	}

	let controls = new ControlState('jump');
	controls.apply(bot);
	logger('ladderAscendTask() started.');

	const TRACK_TICKS = 10;
	let time_used = 0,  last_y = start_pos.y;
	while (true) {
		await bot.waitForTicks(1);
		task._interuptableHere();
		time_used += 1;

		const pos = bot.entity.position;
		if (pos.xzDistanceTo(start_pos) > 1) { throw new MoveInterferedError(); }
		bot.control.adjustXZ();

		if (Math.abs(pos.y - target_y) < 0.2) {
			logger('ladderAscendTask() reached.');
			bot.clearControlStates();
			pos.y = target_y;
			break;
		}

		if (pos.y - target_y > 0.4) {
			logger('ladderAscendTask() went past target.');
			throw new MoveInterferedError();
		}

		if (time_used % TRACK_TICKS == 0) {
			let now_y = pos.y;
			if (Math.abs(now_y - last_y) < 0.3) {
				logger(`ladderAscendTask() move too little in past ${TRACK_TICKS} ticks!`);
				logger(`ladderAscendTask() now pos.y=${now_y}`);
				logger(`ladderAscendTask() ${TRACK_TICKS} ticks ago pos.y=${last_y}`);
				throw new MovePathBlockedError();
			}
			last_y = now_y;
		}
	}
	task._ready(time_used);
}

export default function inject(bot) {
	bot.control = {};
	bot.control.getState = () => { return ControlState.from(bot.controlState); };
	bot.control.adjustXZ = () => { adjustXZ(bot.entity.position); };

	bot.control.moveAxis = (axis, target, level = MOVE_LEVEL.SPRINT) => {
		let task = new Task();
		queueMicrotask(async () => {
			try {
				task._start();
				await moveAxisTask(bot, task, axis, target, level);
			} catch(err) {
				bot.clearControlStates();
				task._fail(err);
			};
		});
		return task;
	};

	bot.control.jumpUp = async (axis_raw, time=5) => {
		const axis = AXIS[axis_raw];
		assert.ok(typeof axis == 'number');
		assert.ok(0 <= axis && axis <= 3);
		assert.ok(typeof time == 'number');
		if (!bot.entity.onGround) {
			throw new NotOnGroundError();
		}
		bot.control.adjustXZ();
		await bot.look(axis * Math.PI / 2, 0, true);
		let controls = new ControlState('forward', 'jump');
		let pos = bot.entity.position;
		controls.apply(bot);
		await bot.waitForTicks(time);
		bot.clearControlStates();
		bot.entity.position.update(pos.plus(AXIS_UNIT[axis]).offset(0, 1, 0));
		bot.entity.velocity.x = 0;
		bot.entity.velocity.z = 0;
		await bot.waitForTicks(1);
	};

	bot.control.jumpForward = async (axis_raw, dis=2, tactic) => {
		if (tactic == null) { tactic = {}; }
		if (tactic.sprint == null) { tactic.sprint = dis > 3; }
		if (tactic.speed == null) { tactic.speed = tactic.sprint ? .355 : .216; }
		assert.ok(typeof axis == 'number');
		assert.ok(0 <= axis && axis <= 3);
		assert.ok(typeof dis == 'number');
		assert.ok(typeof tactic.sprint == 'boolean');
		assert.ok(typeof tactic.speed == 'number');
		if (!bot.entity.onGround) {
			throw new NotOnGroundError();
		}

		const axis = AXIS[axis_raw];
		bot.control.adjustXZ();
		let target = bot.entity.position.plus(AXIS_UNIT[axis].scaled(dis));
		logger(`jumpForward() axis: ${"zx"[axis % 2]}`);
		logger(`jumpForward() target: ${target}`);
		logger(`jumpForward() tactic: sprint=${tactic.sprint}, speed=${tactic.speed}`);
		await bot.look(axis * Math.PI / 2, 0, true);

		let controls = new ControlState('forward', 'jump');
		controls.sprint = tactic.sprint;
		controls.apply(bot);
		bot.entity.velocity.add(AXIS_UNIT[axis].scaled(tactic.speed));

		await bot.waitForTicks(1);
		controls.jump = false;
		controls.apply(bot);
		logger(`jumpForward() ${bot.entity.velocity}`);

		await bot.waitForTicks(Math.floor((dis / tactic.speed) - 1));
		bot.clearControlStates();

		let pos = bot.entity.position;
		logger(`jumpForward() done at ${pos}.`);
		if (pos.distanceTo(target) > 1) {
			throw new MoveInterferedError();
		}
		pos.x = target.x;
		pos.z = target.z;
		bot.entity.velocity.x = 0;
		bot.entity.velocity.z = 0;
	}

	bot.control.jump = async () => {
		if (!bot.entity.onGround) {
			throw new NotOnGroundError();
		}
		bot.setControlState('jump', true);
		await bot.waitForTicks(1);
		bot.setControlState('jump', false);
	};

	bot.control.jumpToHighest = () => {
		let task = new Task();
		queueMicrotask(async () => {
			try {
				task._start();

				if (!bot.entity.onGround) {
					throw new NotOnGroundError();
				}

				let controls = new ControlState('jump');
				controls.apply(bot);

				let time_used = 0;
				while (true) {
					await bot.waitForTicks(1);
					task._interuptableHere();

					time_used += 1;
					if (time_used == 1) {
						controls.jump = false;
						controls.apply(bot);
					}
					if (bot.entity.velocity.y < 0) {
						break;
					} 
				}
				task._ready(time_used);
			} catch(err) {
				bot.clearControlStates();
				task._fail(err);
			}
		});
		return task;
	};

	bot.control.ladderAscend = (target_y) => {
		let task = new Task();
		queueMicrotask(async () => {
			try {
				task._start();
				await ladderAscendTask(bot, task, target_y);
			} catch(err) {
				bot.clearControlStates();
				task._fail(err);
			}
		});
		return task;
	};
}
