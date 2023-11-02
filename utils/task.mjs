import assert from 'node:assert/strict';

export class TaskInteruptedError extends Error {
	constructor() { super('Task has been interupted.'); }
};

let task_id = 0;

export class Task {
	#promise;
	#resolve;
	#reject;
	#dependent_tasks

	constructor() {
		this.id = ++task_id;
		this.status = Task.STATUS.pending;
		this.error = null;
		this.result = null;
		this.#promise = new Promise((resolve, reject) => {
			this.#resolve = resolve;
			this.#reject = reject;
		});
		this.#dependent_tasks = null;
	}

	isDone() {
		return this.#promise == null;
	}

	_ready(result) {
		if (this.isDone()) { return; }
		this.result = result;
		this.status = Task.STATUS.ready;
		this.#resolve(this.result);
		this.#promise = null;
	}

	_fail(error) {
		if (this.isDone()) { return; }
		this.error = error;
		this.status = Task.STATUS.failed;
		this.#reject(this.error);
		this.#promise = null;
	}

	_start() {
		if (this.status != Task.STATUS.pending) {
			throw new Error('_start() called twice');
		}
		this.status = Task.STATUS.running;
	}

	finally() {
		if (this.isDone()) { return Promise.resolve(); }
		return this.#promise.finally();
	}

	interupt() {
		if (this.status == Task.STATUS.pending) {
			this._confirmInterupt();
			return Promise.resolve();
		}

		if (this.#promise == null) { return Promise.resolve(); }
		this.status = Task.STATUS.interupting;
		if (this.#dependent_tasks) {
			for (let dependent of this.#dependent_tasks) {
				dependent.interupt();
			}
		}
		return this.#promise.finally();
	}

	async _waitDependent(dependent) {
		assert.equal(this.#dependent_tasks, null);
		if (dependent instanceof Task) { this.#dependent_tasks = [dependent]; }
		else { this.#dependent_tasks = dependent; }
		await Promise.allSettled(this.#dependent_tasks.map(t => t.finally()));
		this.#dependent_tasks = null;
		if (dependent instanceof Task) {
			return await dependent.get();
		}
		return dependent.map(async t => await t.get());
	}

	_shouldInterupt() {
		return this.status == Task.STATUS.interupting;
	}

	_confirmInterupt() {
		assert.equal(this.#dependent_tasks, null);
		this.status = Task.STATUS.interupted;
		this.error = new TaskInteruptedError();
		this.#reject(this.error);
		this.#promise = null;
	}

	_interuptableHere() {
		if (this._shouldInterupt()) {
			this._confirmInterupt();
			throw this.error;
		}
	}

	get() {
		if (this.status == Task.STATUS.ready) { return Promise.resolve(this.result); }
		if (this.status == Task.STATUS.failed || this.status == Task.STATUS.interupted) {
			return Promise.reject(this.error);
		}

		return this.#promise;
	}

	valueOf() {
		return {
			id: this.id,
			status: Task.STATUS_NAME[this.status],
			result: this.result,
			error: this.error,
		};
	}

	toString() {
		return `[Task ${this.id}: ${Task.STATUS_NAME[this.status]}]`;
	}
};

Task.STATUS_NAME = {
	0: 'Pending',
	1: 'Running',
	2: 'Interupting',
	3: 'Ready',
	4: 'Interupted',
	5: 'Failed',
};

Task.STATUS = {
	pending: 0,
	running: 1,
	interupting: 2,
	ready: 3,
	interupted: 4,
	failed: 5,
};
