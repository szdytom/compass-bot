import debug from 'debug';
import { Task } from 'compass-utils';
import { Vec3 } from 'vec3';
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

AXIS_UNIT['-Z'] = AXIS_UNIT['NORTH'] = AXIS_UNIT[0];
AXIS_UNIT['-X'] = AXIS_UNIT['WEST'] = AXIS_UNIT[1];
AXIS_UNIT['+Z'] = AXIS_UNIT['SOUTH'] = AXIS_UNIT[2];
AXIS_UNIT['+X'] = AXIS_UNIT['EAST'] = AXIS_UNIT[3];

export const MOVE_LEVEL = {
	WALK: 1,
	SPRINT: 2,
	// TODO: SPRINT_JUMP
};

export class ControlState {
	constructor() {
		for (let key of ControlState.CONTROLS) {
			this[key] = false;
		}
	}

	set(cs) {
		for (let key of ControlState.CONTROLS) {
			this[key] = cs[key] || false;
		}
	}

	static from(cs) {
		let res = new ControlState();
		res.set(cs);
		return res;
	}

	apply(bot) {
		for (let key of ControlState.CONTROLS) {
			bot.setControlState(key, this[key]);
		}
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

async function moveAxisTask(bot, task, axis_raw, target_raw, level) {
	const axis = AXIS[axis_raw];
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
	if (Math.abs(delta.y) > Number.EPSILON || Math.abs(delta[stable_axis]) > Number.EPSILON) {
		throw new Error('Invalid Argument: target');
	}

	if (remaining_dis < 0) {
		throw new Error('Invalid Argument: axis argument should reverse its sign.');
	}

	const stable_axis_value = target[stable_axis];

	logger('moveAxisTask() pre adjust look angle');
	await bot.look(axis * Math.PI / 2, 0);
	logger('moveAxisTask() post adjust look angle');
	task._interuptableHere();

	const controls = new ControlState();
	controls.forward = true;
	if (level >= MOVE_LEVEL.SPRINT) { controls.sprint = true; }
	logger('moveAxisTask() control', controls);
	controls.apply(bot);
	logger('moveAxisTask() started.');

	let time_used = 0;
	do {
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
		pos[stable_axis] = stable_axis_value;

		delta.update(target.minus(pos));
		remaining_dis = delta.dot(AXIS_UNIT[axis]);
		if (Math.abs(remaining_dis) <= 0.5) {
			logger('moveAxisTask() very close to target now.');
			pos.update(target);
			bot.entity.velocity.x = 0;
			bot.entity.velocity.z = 0;
			break;
		}

		if (remaining_dis < -0.5) {
			logger('moveAxisTask() went past target.');
			throw new MoveInterferedError();
		}
	} while (true);
	bot.clearControlStates();
	task._ready(time_used);
}

export default function inject(bot) {
	bot.control = {};
	bot.control.getState = () => { return ControlState.from(bot.controlState); };
	bot.control.adjustXZ = () => { adjustXZ(bot.entity.position); };

	bot.control.moveAxis = (axis, target, level = MOVE_LEVEL.SPRINT) => {
		let task = new Task();
		queueMicrotask(() => {
			task._start();
			moveAxisTask(bot, task, axis, target, level).catch(err => {
				bot.clearControlStates();
				task._fail(err);
			});
		});
		return task;
	};

	bot.control.jump = async () => {
		bot.setControlState('jump', true);
		await bot.waitForTicks(1);
		bot.setControlState('jump', false);
	};
}
