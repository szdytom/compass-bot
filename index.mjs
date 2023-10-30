import * as authlib from './auth/authlib.mjs';
import mineflayer from 'mineflayer';
import yargs from 'yargs';
import { parseLogin, waitEvent } from 'compass-utils';
import repl from 'node:repl';
import vm from 'node:vm';

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
	}).usage('Uasge: profile@host:port').help().alias('help', 'h').argv;

	let login_info = args._[0];
	if (login_info == null) { return; }
	const [name, host, port] = parseLogin(login_info);
	const credential_info = await authlib.Credentials.fromFile(args.credentialsLib);
	if (credential_info == null) {
		throw new Error(`Cannot load credential ${args.credentialsLib}`);
	}

	const session = await credential_info.authProfile(name);
	const bot = mineflayer.createBot({
		host, port, version: args.protocal,
		...session.mineflayer(credential_info.endpoint)
	});
	bot.on('error', console.error);
	bot.on('kicked', console.log);

	await waitEvent(bot, 'inject_allowed');
	bot.loadPlugin((await import('mineflayer-event-promise')).default);
	bot.loadPlugin((await import('mineflayer-control')).default);
	await bot.waitEvent('spawn');

	let context = vm.createContext();
	context.bot = bot;
	context.Vec3 = (await import('vec3')).Vec3;
	context.mineflayer = mineflayer;
	context.owner = () => {
		if (!args.owner) { return null; }
		return bot.players[args.owner];
	};
	if (!args.noRepl) {
		let r = repl.start({
			prompt: 'local > ',
			input: process.stdin,
			output: process.stdout,
			color: true,
			terminal: true,
			ignoreUndefined: true,
		});
		r.context = context;
	}
}

main().catch(err => {
	console.error('Error: ', err);
	process.exit(1);
});
