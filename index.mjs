import * as authlib from './auth/authlib.mjs';
import mineflayer from 'mineflayer';
import yargs from 'yargs';
import { asyncSleep, parseLogin, waitEvent } from 'compass-utils';
import repl from 'node:repl';
import 'enhanced-vec3';
import debug from 'debug';
import { createLocalRepl, createTcpReplServer } from './repl/index.mjs';
import { randomBytes } from 'node:crypto';

async function main() {
	const args = yargs((await import('yargs/helpers')).hideBin(process.argv))
	.option('protocal', {
		description: 'Minecraft server version',
		type: 'string',
		requiresArg: false,
	}).option('owner', {
		description: 'Bot\'s owner name.',
		type: 'string',
		requiresArg: false,
	}).option('no-local-repl', {
		description: 'Disable bot REPL control in current stdin/stdout.',
		type: "boolean",
	}).option('credentials-lib', {
		description: 'Credentials\' library file.',
		type: "string",
		default: "credentials.json",
	}).option('offline', {
		description: 'Login without credentials.',
		type: 'boolean',
	}).option('enable-tcp-repl', {
		description: 'Enable bot REPL control as a TCP service.',
		type: 'boolean',
	}).option('tcp-repl-port', {
		description: 'Telnet REPL service port.',
		type: 'number',
		default: 2121,
	}).option('remote-repl-passcode-length', {
		description: 'Length of remote REPL passcode in bytes',
		type: 'number',
		default: 8,
	}).usage('Uasge: profile@hostname[:port]').help().alias('help', 'h').argv;

	let login_info = args._[0];
	if (login_info == null) { return; }
	const [name, hostname, port] = parseLogin(login_info);

	let session, endpoint = null;
	if (args.offline) {
		session = new authlib.OfflineSession(name);
	} else {
		const credential_info = await authlib.Credentials.fromFile(args.credentialsLib);
		if (credential_info == null) {
			throw new Error(`Cannot load credential ${args.credentialsLib}`);
		}
		session = await credential_info.authProfile(name);
		endpoint = credential_info.endpoint;
	}

	const bot = mineflayer.createBot({
		host: hostname, port, version: args.protocal,
		...session.mineflayer(endpoint)
	});
	bot.on('error', console.error);
	bot.on('kicked', console.log);
	bot.on('end', () => {
		console.log('Disconnected. Exiting...');
		process.exit(0);
	});

	await waitEvent(bot, 'inject_allowed');
	bot.loadPlugin((await import('mineflayer-event-promise')).default);
	bot.loadPlugin((await import('mineflayer-control')).default);
	bot.loadPlugin((await import('mineflayer-fly-control')).default);
	await bot.waitEvent('spawn');

	const context_shared = {};
	async function loadReplContextModules(context) {
		context.lib = {
			utils: await import('compass-utils'),
			control: await import('mineflayer-control'),
			flyctl: await import('mineflayer-fly-control'),
		};
		context.bot = bot;
		context.Vec3 = (await import('vec3')).Vec3;
		context.mineflayer = mineflayer;
		context.owner = () => {
			if (!args.owner) { return null; }
			return bot.players[args.owner];
		};

		context.PI = Math.PI;
		context.debug = debug;
		context.bb = context_shared;
		context.sc = {};
		context.sc.pos = () => bot.entity.position;
		context.sc.debug_mfc = () => debug.enable('mineflayer-control');
		context.sc.debug_mff = () => debug.enable('mineflayer-fly-control');
		context.sc.sleep = asyncSleep;
		context.sc.tossHeld = () => bot.tossStack(bot.heldItem);
	}

	if (args.enableTcpRepl) {
		const passcode = randomBytes(args.remoteReplPasscodeLength);
		console.log('Remote REPL Passcode:', passcode.toString('hex'));
		let server = createTcpReplServer(args.tcpReplPort, passcode, loadReplContextModules);
		process.on('exit', () => server.close());
	}

	if (!args.noLocalRepl) {
		let repl_local = createLocalRepl(loadReplContextModules);
		repl_local.on('exit', () => bot.quit());
	}
}

main().catch(err => {
	console.error(`Error: ${err}`);
	process.exit(1);
});
