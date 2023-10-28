const fs = require('fs/promises');

async function readJsonFile(path) {
	try {
		const data = await fs.readFile(path, 'utf8');
		return JSON.parse(data);
	} catch (error) {
		return null;
	}
}

function writeJsonFile(path, data) {
	const json_string = JSON.stringify(data);
	return fs.writeFile(path, json_string, 'utf8');
}

function parseURL(url) {
	const [host, port] = url.split(':');
	return [host, port ? parseInt(port) : undefined];
}

module.exports = { readJsonFile, writeJsonFile, parseURL };
