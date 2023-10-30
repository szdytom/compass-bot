import debug from 'debug';
const logger = debug('mineflayer-event-promise');

export default function inject(bot) {
	logger('Injected!');
	bot.waitEvent = (event) => {
		return new Promise((resolve, _reject) => {
			bot.once(event, resolve);
		});
	};

	bot.timeoutTick = (t) => {
		return new Promise((_resolve, reject) => {
			bot.waitForTicks(t).then(reject);
		});
	};
}
