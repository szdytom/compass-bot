import { waitEvent } from 'compass-utils';
import { randomBytes } from 'node:crypto';
import { Duplex } from 'node:stream';
import { promisify } from 'node:util';

import debug from 'debug';
const logger = debug('compass-repl:RemoteTTY');

const kSource = Symbol('kSource');

export class RemoteTTY extends Duplex {
	#rows
	#cols
	#color_depths
	#tty_ready
	#tty_ready_resolve
	#event_callbacks
	constructor(options, input, output) {
		super(options);
		this[kSource] = {
			input: input,
			output: output,
		};
		this.#tty_ready = new Promise(resolve => {
			this.#tty_ready_resolve = resolve;
		});
		this.#event_callbacks = new Map();
		this[kSource].input.on('close', () => this.push(null));
		this[kSource].input.on('data', (data) => {
			try {
				if (!(data instanceof Buffer)) {
					data = Buffer.from(data);
				}

				if (data[0] === 0x02) {
					if (!this.push(data.slice(1))) {
						this[kSource].input.pause();
					}
					return;
				}

				if (data[0] === 0x01) {
					// Initialize data
					this.#rows = data.readUInt16BE(1);
					this.#cols = data.readUInt16BE(3);
					this.#color_depths = data.readUInt8(5);
					if (this.#tty_ready_resolve) {
						this.#tty_ready_resolve();
						this.#tty_ready_resolve = null;
					}
				} else if (data[0] == 0x03) {
					// Resize event
					this.#rows = data.readUInt16BE(1);
					this.#cols = data.readUInt16BE(3);
					this.emit('resize');
				} else if (data[0] == 0x04) {
					// Callback
					let id = (data.readBigUInt64BE(1) << 64n) + data.readBigUInt64BE(9);
					if (this.#event_callbacks.has(id)) {
						logger(`Rescived callback ${data.toString('hex')}`);
						this.#event_callbacks.get(id)();
						this.#event_callbacks.delete(id);
					}
				}
			} catch (err) {
				//
			}
		});
	}

	get rows() {
		return this.#rows;
	}

	get columns() {
		return this.#cols;
	}

	getWindowSize() {
		return [this.#rows, this.#cols];
	}

	getColorDepth() {
		return this.#color_depths;
	}

	hasColors(count = 16) {
		return (1 << this.#color_depths) >= count;
	}

	#registerCallback(data, callback) {
		let cbid = randomBytes(16);
		let cbid_v = (cbid.readBigUInt64BE(0) << 64n) + cbid.readBigUInt64BE(8);
		if (callback) {
			logger(`Registered callback ${cbid.toString('hex')}`);
			this.#event_callbacks.set(cbid_v, callback);
		}
		cbid.copy(data, 1);
	}

	clearLine(dir, callback) {
		logger('clearLine');
		let data = Buffer.alloc(18);
		data[0] = 0x10;
		data.writeInt8(dir, 17);
		this.#registerCallback(data, callback);
		this.#sendData(data);
		return this.writableNeedDrain;
	}

	clearScreenDown(callback) {
		logger('clearScreenDown');
		let data = Buffer.alloc(17);
		data[0] = 0x11;
		this.#registerCallback(data, callback);
		this.#sendData(data);
		return this.writableNeedDrain;
	}

	cursorTo(x, y, callback) {
		logger('cursorTo');
		let data = Buffer.alloc(22);
		if (typeof y !== 'number') {
			callback = y;
			y = 0;
			data[17] = 0x01;
		} else {
			data[17] = 0x00;
		}
		data[0] = 0x12;
		data.writeUInt16BE(x, 18);
		data.writeUInt16BE(y, 20);

		this.#registerCallback(data, callback);
		this.#sendData(data);
		return this.writableNeedDrain;
	}

	moveCursor(dx, dy, callback) {
		logger('moveCursor');
		let data = Buffer.alloc(21);
		data[0] = 0x13;
		data.writeUInt16BE(dx, 17);
		data.writeUInt16BE(dy, 19);

		this.#registerCallback(data, callback);
		this.#sendData(data);
		return this.writableNeedDrain;
	}

	async #sendData(data) {
		if (this[kSource].output.writableNeedDrain) {
			await waitEvent(this[kSource].output, 'darin');
		}
		const writePromise = promisify((data, callback) =>
			this[kSource].output.write(data, 'utf-8', callback));
		await writePromise(data);
	}

	_construct(callback) {
		callback();
	}

	_write(chunk, encoding, callback) {
		if (!(chunk instanceof Buffer)) {
			chunk = Buffer.from(chunk, encoding);
		}
		chunk = Buffer.concat([Buffer.from([0x02]), chunk]);
		this.#sendData(chunk).then(() => callback(null)).catch(err => callback(err))
	}

	_destroy(err, callback) {
		this[kSource].input.destory(err);
		this[kSource].output.destory(err);
		callback();
	}

	_read(_size) {
		this[kSource].input.resume();
	}

	setRawMode() {
		return this;
	}

	get isRaw() {
		return true;
	}

	get isTTY() {
		return true;
	}

	ttyReady() {
		return this.#tty_ready;
	}
};
