import * as authlib from './auth/authlib.mjs';
import mineflayer from 'mineflayer';
import yargs from 'yargs';
import { parseLogin, waitEvent } from 'compass-utils';
import repl from 'node:repl';
import debug from 'debug';

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
	}).option('no-repl', {
		description: 'Disable bot REPL control.',
		type: "boolean",
	}).option('credentials-lib', {
		description: 'Credentials\' library file.',
		type: "string",
		default: "credentials.json",
	}).option('offline', {
		description: 'Login without credentials.',
		type: 'boolean',
	}).usage('Uasge: profile@host:port').help().alias('help', 'h').argv;

	let login_info = args._[0];
	if (login_info == null) { return; }
	const [name, host, port] = parseLogin(login_info);

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
		host, port, version: args.protocal,
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
	await bot.waitEvent('spawn');

	async function loadReplContextModules(context) {
		context.lib = {
			utils: await import('compass-utils'),
			control: await import('mineflayer-control'),
		};
		context.bot = bot;
		context.Vec3 = (await import('vec3')).Vec3;
		context.mineflayer = mineflayer;
		context.owner = () => {
			if (!args.owner) { return null; }
			return bot.players[args.owner];
		};

		context.sc = {};
		context.sc.pos = () => bot.entity.position;
		context.sc.debug_enable = (module) => debug.enable(module);
		context.sc.debug_disable = (module) => debug.disable(module);
	}

	if (!args.noRepl) {
		let r = repl.start({
			prompt: 'local > ',
			input: process.stdin,
			output: process.stdout,
			color: true,
			terminal: true,
			ignoreUndefined: true,
		});
		loadReplContextModules(r.context);
	}
}

main().catch(err => {
	console.error('Error: ', err);
	process.exit(1);
});
