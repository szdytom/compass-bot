import fs from 'node:fs/promises';

// Reads JSON data from file, returns null if file not found or has other errors.
export async function readJsonFile(path) {
	try {
		const data = await fs.readFile(path, 'utf8');
		return JSON.parse(data);
	} catch (error) {
		return null;
	}
}

// Write JSON data into a file.
export function writeJsonFile(path, data) {
	const json_string = JSON.stringify(data);
	return fs.writeFile(path, json_string, 'utf8');
}

// Parse format "profile@host:port", port can be undefined.
export function parseLogin(url) {
	const [profile_host, port] = url.split(':');
	const [profile, host] = profile_host.split('@');
	return [profile, host, port ? parseInt(port) : undefined];
}

// Returns a promise, wait unitl the EventEmitter emits certian event next time.
export function waitEvent(em, event) {
	return new Promise((resolve, _reject) => {
		em.once(event, resolve);
	});
}

export function asyncSleep(t) {
	return new Promise((resolve, _reject) => {
		setTimeout(resolve, t);
	});
}

export function asyncTimeout(t) {
	return new Promise((_resolve, reject) => {
		setTimeout(reject, t);
	});
}

export function promiseTimeout(p, t) {
	return Promise.race([p, asyncTimeout(t)]);
}

export function yieldTask() {
	return new Promise((resolve, _reject) => {
		queueMicrotask(resolve);
	});
}

// Checks wheather an object is iterable.
export function isIterable(obj) {
	if (obj == null) { return false; }
	return typeof obj[Symbol.iterator] == 'function';
}
