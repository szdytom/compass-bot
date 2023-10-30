export class QueueEmptyError extends Error {
	constructor() { super('Queue is empty'); }
}

export class Queue {
	constructor() {
		this.data = [];
		this.head = 0;
	}

	front() {
		return this.data[this.head];
	}

	back() {
		return this.data[this.data.length - 1];
	}

	popBack() {
		if (this.data.length == this.head) {
			throw new QueueEmptyError();
		}
		this.data.length -= 1;
	}

	empty() {
		return this.data.length == this.head;
	}

	size() {
		return this.data.length - this.head;
	}

	get length() {
		return this.size();
	}

	push() {
		this.data.push.apply(this.data, arguments);
	}

	popFront() {
		if (this.empty()) { throw new QueueEmptyError();}

		this.head += 1;
		if (this.head == this.data.length) {
			this.data = [];
			this.head = 0;
			return;
		}
		if (this.head >= this.data.length >> 1 && this.head >= 16) {
			this.data = this.data.slice(this.head);
			this.head = 0;
		}
	}

	*[Symbol.iterator]() {
		for (let i = this.head; i < this.data.length; i += 1) {
			yield this.data[i];
		}
	}
}
