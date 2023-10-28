const axios = require('axios');
const { readJsonFile, writeJsonFile } = require('./utils');

async function readCredentials() {
	let credentials = await readJsonFile('credential.json');
	if (!credentials.endpoint_auth) {
		credentials.endpoint_auth = credentials.endpoint + '/authserver';
	}

	if (!credentials.endpoint_session) {
		credentials.endpoint_session = credentials.endpoint + '/sessionserver';
	}

	if (!credentials.handle) {
		credentials.handle = credentials.username;
	}

	return credentials;
}

async function readSessionCache() {
	return readJsonFile('session.json');
}

async function storeSessionCache(data) {
	return writeJsonFile('session.json', data);
}

async function yggdrailLogin(credentials) {
	let account_info = (await axios.post(`${credentials.endpoint_auth}/authenticate`, {
		username: credentials.handle,
		password: credentials.password,
	})).data;

	let profile_info = null;
	for (let info of account_info.availableProfiles) {
		if (info.name == credentials.username) {
			profile_info = info;
			break;
		}
	}

	let session_info = (await axios.post(`${credentials.endpoint_auth}/refresh`, {
		accessToken: account_info.accessToken,
		clientToken: account_info.clientToken,
		selectedProfile: profile_info,
	})).data;

	return {
		accessToken: session_info.accessToken,
		clientToken: session_info.clientToken,
		selectedProfile: session_info.selectedProfile,
	};
}

async function yggdrasilAuth(credentials) {
	if (credentials == null) {
		credentials = await readCredentials();
	}

	let cache = await readSessionCache();
	if (cache != null && cache.selectedProfile?.name != credentials.username) {
		cache = null;
	}

	if (cache != null) {
		let vres = await axios.post(`${credentials.endpoint_auth}/validate`, {
			accessToken: cache.accessToken,
			clientToken: cache.clientToken,
		}, {
			validateStatus: function (status) {
				return status === 403 || status === 204;
			}
		});

		if (vres.status == 403) {
			cache = null;
		}
	}

	let session_info = cache;
	if (session_info == null) {
		session_info = await yggdrailLogin(credentials);
		storeSessionCache(session_info);
	}

	return session_info;
}

async function mineflayer() {
	let credentials = await readCredentials();
	let session_info = await yggdrasilAuth(credentials);
	return {
		username: credentials.username,
		authServer: credentials.endpoint_auth,
		sessionServer: credentials.endpoint_session,
		auth: (client, options) => {
			client.username = credentials.username;
			client.session = session_info;
			options.accessToken = session_info.accessToken;
			options.clientToken = session_info.clientToken;
			options.haveCredentials = true;
			client.emit('session', session_info);
			options.connect(client);
		},
	};
}

module.exports = { readCredentials, yggdrasilAuth, mineflayer };
