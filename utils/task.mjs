export class TaskInteruptedError {
	constructor() { super('Task has been interupted.'); }
};

export class Task {
	constructor() {
		this.status = Task.STATUS.pending;
		this.error = null;
		this.result = null;
		this.result_listeners = [];
	}

	_ready(result) {
		this.result = result;
		this.status = Task.STATUS.ready;
		this.#notifySuccess();
	}

	_fail(error) {
		if (this.status == Task.STATUS.interupted) { return; }
		this.error = error;
		this.status = Task.STATUS.failed;
		this.#notifyFailure();
	}

	_start() {
		if (this.status != Task.STATUS.pending) {
			throw new Error('Task has already left pending stage');
		}
		this.status = Task.STATUS.running;
	}

	interupt() {
		if (this.status == Task.STATUS.pending) { this._confirmInterupt(); }
		else { this.status = Task.STATUS.interupting; }
	}

	_shouldInterupt() {
		return this.status == Task.STATUS.interupting;
	}

	_confirmInterupt() {
		this.status = Task.STATUS.interupted;
		this.error = new TaskInteruptedError();
		this.#notifyFailure();
	}

	get() {
		if (this.status == Task.STATUS.ready) { return Promise.resolve(this.result); }
		if (this.status == Task.STATUS.failed || this.status == Task.STATUS.interupted) {
			return Promise.reject(this.error);
		}

		return new Promise((resolve, reject) => {
			this.result_listeners.push([resolve, reject]);
		});
	}

	#notifyFailure() {
		for (let [_resolve, reject] of this.result_listeners) {
			reject(this.error);
		}
		this.result_listeners = [];
	}

	#notifySuccess() {
		for (let [resolve, _reject] of this.result_listeners) {
			resolve(this.result);
		}
		this.result_listeners = [];
	}
};

Task.STATUS = {
	pending: 0,
	running: 1,
	interupting: 2,
	ready: 3,
	interupted: 4,
	failed: 5,
};
