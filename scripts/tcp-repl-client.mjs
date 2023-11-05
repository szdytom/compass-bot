import { Readable, Writable } from 'node:stream';
import { promisify } from 'node:util';
import net from 'node:net';
import { waitEvent } from 'compass-utils';
import readline from 'node:readline';
import yargs from 'yargs';

/**
 * @param {Readable} input 
 * @param {Writable} output 
 */
function ttyServer(input, output) {
	const stdin = process.stdin;
	const stdout = process.stdout;
	stdin.setRawMode(true);

	const writePromise = promisify((data, callback) => output.write(data, 'utf-8', callback));
	async function sendData(data) {
		if (!output.writable) {
			return;
		}
		if (output.writableNeedDrain) {
			await waitEvent(output, 'darin');
		}
		await writePromise(data);
	}

	stdin.on('data', async (chunk) => {
		if (chunk.length === 1 && chunk[0] === 4) {
			stdin.emit('end');
		}
		chunk = Buffer.concat([Buffer.from([0x02]), chunk]);
		await sendData(chunk);
	});

	stdin.on('close', () => socket.destroy());

	let init_data = Buffer.alloc(6);
	init_data[0] = 0x01;
	init_data.writeUInt16BE(stdout.rows, 1);
	init_data.writeUInt16BE(stdout.columns, 3);
	init_data.writeUInt8(stdout.getColorDepth(), 5);
	sendData(init_data);

	stdout.on('resize', () => {
		let resize_data = Buffer.alloc(5);
		resize_data[0] = 0x03;
		resize_data.writeUInt16BE(stdout.rows, 1);
		resize_data.writeUInt16BE(stdout.columns, 3);
		sendData(resize_data);
	});

	stdout.on('drain', () => input.resume());
	input.on('end', () => {
		console.log('\nDisconnected (Server).');
		process.exit(0);
	});
	stdin.on('end', () => {
		input.destroy();
		output.destroy();
		console.log('\nDisconnected (Client).');
		process.exit(0);
	});
	input.on('data', (data) => {
		if (!(data instanceof Buffer)) {
			data = Buffer.from(data);
		}

		if (data[0] === 0x02) {
			if (!stdout.write(data)) { input.pause(); }
			return;
		}

		if (data[0] == 0x10) {
			// clearLine
			let res = Buffer.alloc(17);
			data.copy(res, 1, 1, 17);
			res[0] = 0x04;
			let dir = data.readInt8(17);
			stdout.clearLine(dir, () => {
				sendData(res);
			});
		} else if (data[0] == 0x11) {
			// clearScreenDown
			let res = Buffer.alloc(17);
			data.copy(res, 1, 1, 17);
			res[0] = 0x04;
			stdout.clearScreenDown(() => {
				sendData(res);
			});
		} else if (data[0] == 0x12) {
			// cursorTo
			let res = Buffer.alloc(17);
			data.copy(res, 1, 1, 17);
			res[0] = 0x04;
			let flag = data[17];
			let x = data.readUInt16BE(18);
			let y = data.readUInt16BE(20);
			if (flag) {
				stdout.cursorTo(x, () => {
					sendData(res);
				});
			} else {
				stdout.cursorTo(x, y, () => {
					sendData(res);
				});
			}
		} else if (data[0] == 0x13) {
			// moveCursor
			let res = Buffer.alloc(17);
			data.copy(res, 1, 1, 17);
			res[0] = 0x04;
			let dx = data.readUInt16BE(17);
			let dy = data.readUInt16BE(19);
			stdout.moveCursor(dx, dy, () => {
				sendData(res);
			});
		}
	});
}

async function main() {
	const args = yargs((await import('yargs/helpers')).hideBin(process.argv))
	.option('port', {
		description: 'Remote TCP REPL service port.',
		default: 2121,
	}).usage('Uasge: hostname').help().alias('help', 'h').argv;

	let socket = net.connect(args.port, args._[0]);
	await waitEvent(socket, 'connect');
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	const question = promisify(rl.question).bind(rl);
	const passcode_string = (await question('Passcode: ')).trim();
	const passcode = Buffer.from(passcode_string, 'hex');
	if (passcode.length == 0) {
		console.log('A passcode is required.');
		process.exit(1);
	}
	rl.close();

	const sendPasscode = promisify((cb) => socket.write(passcode, cb));
	await sendPasscode();
	let res = await waitEvent(socket, 'data');
	if (res[0] == 0x20) {
		console.log('Passcode incorrect.');
		process.exit(1);
	}
	console.log('Connected.');
	process.stdin.resume();
	ttyServer(socket, socket);
	console.log(process.stdin.isRaw);
}

main().catch(err => {
	console.error(`Error: ${err}`);
	process.exit(1);
});
