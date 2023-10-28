const authlib = require('./authlib');
const mineflayer = require('mineflayer');
const { pathfinder, Movements } = require('mineflayer-pathfinder');
const { GoalNear } = require('mineflayer-pathfinder').goals
const repl = require('repl');
const domain = require('domain');
const yargs = require('yargs');
const { parseURL } = require('./utils');

const args = yargs.option('protocal', {
	description: 'minecraft server version',
	type: 'string',
	requiresArg: false,
}).option('owner', {
	description: 'bot owner name',
	type: 'string',
	requiresArg: false
}).help().alias('help', 'h').argv;

const [host, port] = parseURL(args._[0]);
const version = args.protocal;

const repl_domain = domain.create();

repl_domain.on('error', (err) => {
  console.error('Caught error:', err);
});

async function main() {
	let authinfo = await authlib.mineflayer();
	let bot = mineflayer.createBot({
		host, port, version,
		...authinfo,
	});
	bot.loadPlugin(pathfinder);

	bot.on('kicked', console.warn);
	bot.on('error', console.warn);

	bot.once('spawn', () => {
		repl_domain.run(() => {
			let r = repl.start({
				prompt: "bot > ",
				input: process.stdin,
				output: process.stdout,
				color: true,
				terminal: true,
			});
	
			const deafult_tactic = new Movements(bot);
			const peaceful_tactic = new Movements(bot);
			peaceful_tactic.canDig = false;
			peaceful_tactic.scafoldingBlocks = [];
	
			r.context.deafult_tactic = deafult_tactic;
			r.context.peaceful_tactic = peaceful_tactic;
			r.context.bot = bot;
			r.context.authinfo = authinfo;
			r.context.Movements = Movements;
			r.context.GoalNear = GoalNear;
			r.context.mineflayer = mineflayer;
			r.context.owner = () => {
				if (!args.owner) {
					return null;
				}
				return bot.players[args.owner];
			};
			r.context.control = require('./control');
			r.context.Vec3 = require('vec3').Vec3;
		});
	});
}

main();

