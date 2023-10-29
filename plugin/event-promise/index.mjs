import debug from 'debug';
const log = debug('mineflayer-event-promise');

export default function inject(bot) {
	debug('Injected!');
	bot.waitEvent = (event) => {
		return new Promise((resolve, _reject) => {
			bot.once(event, resolve);
		});
	};
}
