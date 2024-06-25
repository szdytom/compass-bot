import repl from 'node:repl';
import net from 'node:net';
import { Buffer } from 'node:buffer';
import { timingSafeEqual } from 'node:crypto';
import { waitEvent } from 'compass-utils';
import { RemoteTTY } from './remote-tty.mjs';

import debug from 'debug';
const logger = debug('compass-repl');

export function createRepl(istream, ostream, prompt, contextLoader) {
	let r = repl.start({
		prompt: `${prompt} > `,
		input: istream,
		output: ostream,
		color: true,
		terminal: true,
		ignoreUndefined: true,
	});
	r.on('SIGCONT', () => { });
	r.on('SIGTSTP', () => {});
	contextLoader(r.context);
	return r;
}

export function createLocalRepl(contextLoader) {
	return createRepl(process.stdin, process.stdout, 'local', contextLoader);
}

export function createTcpReplServer(port, passcode, contextLoader) {
	const connect_repl_sockets = new Set();
	let server = net.createServer(socket => {
		logger('New TCP connection');
		function verifyPasscode(data) {
			let pdata = Buffer.from(data);
			logger(`Got passcode: ${pdata.toString('hex')}`);
			let flag = true;
			if (pdata.length != passcode.length) {
				flag = false;
				pdata = passcode;
			}
			if (timingSafeEqual(passcode, pdata) && flag) {
				logger('Passcode correct, 0x21!');
				socket.write(Buffer.from([0x21]));
				let tty = new RemoteTTY({}, socket, socket);
				tty.ttyReady().then(() => {
					logger('Remote TTY is ready, starting REPL');
					let r = createRepl(tty, tty, 'tcp', contextLoader);
					r.on('exit', () => {
						connect_repl_sockets.delete(socket);
						socket.destroy();
					});
					connect_repl_sockets.add(socket);
				}).catch(err => {
					logger(`TTY Ready Error: ${err}`);
					socket.destroy();
				});
			} else {
				logger('Passcode incorrect, 0x20!');
				socket.write(Buffer.from([0x20]));
				socket.destroy();
			}
		}

		try {
			socket.once('data', (data) => verifyPasscode(data));

			socket.on('close', () => {
				logger('Disconnected');
				connect_repl_sockets.delete(socket);
			});
		} catch(err) {
			logger(`Remote Connect Error: ${err}`);
			connect_repl_sockets.delete(socket);
			socket.destroy();
		}
	});
	server.listen(port, '127.0.0.1');
	process.on('exit', () => {
		for (const socket of connect_repl_sockets) {
			socket.destroy();
		}
	});
	return server;
}
