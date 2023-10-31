export class TaskInteruptedError extends Error {
	constructor() { super('Task has been interupted.'); }
};

export class Task {
	#promise;
	#resolve;
	#reject;

	constructor() {
		this.status = Task.STATUS.pending;
		this.error = null;
		this.result = null;
		this.#promise = new Promise((resolve, reject) => {
			this.#resolve = resolve;
			this.#reject = reject;
		});
	}

	_ready(result) {
		if (this.#promise == null) { return; }
		this.result = result;
		this.status = Task.STATUS.ready;
		this.#resolve(this.result);
		this.#promise = null;
	}

	_fail(error) {
		if (this.#promise == null) { return; }
		this.error = error;
		this.status = Task.STATUS.failed;
		this.#reject(this.error);
		this.#promise = null;
	}

	_start() {
		if (this.status != Task.STATUS.pending) {
			throw new Error('Task has already left pending stage');
		}
		this.status = Task.STATUS.running;
	}

	interupt() {
		if (this.status == Task.STATUS.pending) {
			this._confirmInterupt();
			return Promise.resolve();
		}

		if (this.#promise == null) { return Promise.resolve(); }
		this.status = Task.STATUS.interupting;
		return this.#promise.finally();
	}

	_shouldInterupt() {
		return this.status == Task.STATUS.interupting;
	}

	_confirmInterupt() {
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
			status: Task.STATUS_NAME[this.status],
			result: this.result,
			error: this.error,
		};
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
