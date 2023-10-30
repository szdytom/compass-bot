import { Queue } from './queue.mjs';

export class AsyncLock {
	constructor() {
		this.pending_queue = new Queue();
		this.state = false;
		this.lock_id = 0;
	}

	query() {
		return this.state;
	}

	acquire() {
		if (!this.state) {
			this.state = true;
			this.lock_id += 1;
			return Promise.resolve(this.lock_id);
		}
		return new Promise((resolve, _reject) => this.pending_queue.push(resolve));
	}

	release(lock_id) {
		if (lock_id != this.lock_id) { return; }
		if (this.pending_queue.empty()) {
			this.state = false;
			return;
		}

		let resolve = this.pending_queue.front();
		this.pending_queue.popFront();
		this.lock_id += 1;
		resolve(lock_id);
	}
};
