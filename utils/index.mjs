import fs from 'node:fs/promises';

export async function readJsonFile(path) {
	try {
		const data = await fs.readFile(path, 'utf8');
		return JSON.parse(data);
	} catch (error) {
		return null;
	}
}

export function writeJsonFile(path, data) {
	const json_string = JSON.stringify(data);
	return fs.writeFile(path, json_string, 'utf8');
}

export function parseLogin(url) {
	const [profile_host, port] = url.split(':');
	const [profile, host] = profile_host.split('@');
	return [profile, host, port ? parseInt(port) : undefined];
}

export function waitEvent(em, event) {
	return new Promise((resolve, _reject) => {
		em.once(event, resolve);
	});
}

export default { readJsonFile, writeJsonFile, parseLogin, waitEvent };
