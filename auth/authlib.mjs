import axios from 'axios';
import { readJsonFile, writeJsonFile } from 'compass-utils';

export class NoCredentialError extends Error {
	constructor(profile) {
		super(`No credentials configured for profile ${profile}.`);
	}
};

export class ProfileNotSelectedError extends Error {
	constructor() {
		super('No profile was selected.');
	}
};

export class ProfileAlreadySelectedError extends Error {
	constructor(profile) {
		super(`Profile was already selected to ${profile}.`);
	}
};

export class YggdrasilEndpoint {
	constructor(endpoint, endpoint_auth, endpoint_session) {
		this.endpoint = endpoint;
		this.endpoint_auth = endpoint_auth || this.endpoint + '/authserver';
		this.endpoint_session = endpoint_session || this.endpoint + '/sessionserver';
	}

	auth_url(path) {
		return this.endpoint_auth + '/' + path;
	}
};

export class Account {
	constructor(handle, password) {
		this.handle = handle;
		this.password = password;
	}

	async auth(endpoint) {
		let auth_info = (await axios.post(endpoint.auth_url('authenticate'), {
			username: this.handle,
			password: this.password,
		})).data;

		return new YggdrasilSession(auth_info.accessToken, auth_info.clientToken
			, auth_info.selectedProfile, auth_info.availableProfiles);
	}

	toString() {
		return this.handle;
	}
};

export class Credentials {
	constructor(options) {
		this.endpoint = new YggdrasilEndpoint(options.endpoint, options.endpoint_auth, options.endpoint_session);

		this.profiles = new Map();
		this.accounts = [];
		for (let account_option of options.accounts) {
			let account = new Account(account_option.handle || account_option.profiles[0]
				, account_option.password);
			this.accounts.push(account);
			for (let profile of account_option.profiles) {
				this.profiles.set(profile, account);
			}
		}
	}

	credentialOf(profile) {
		return this.profiles.get(profile);
	}

	static async fromFile(path) {
		let options = await readJsonFile(path);
		return new Credentials(options);
	}

	async authProfile(profile) {
		let sc = await YggdrasilSession.load(profile);
		if (sc != null && !(await sc.validate(this.endpoint))) { sc = null; }

		if (sc == null) {
			let account = this.credentialOf(profile);
			if (account == null) { throw new NoCredentialError(profile); }
			sc = await account.auth(this.endpoint);
			await sc.selectProfile(this.endpoint, profile);
			await sc.store();
		}
		return sc;
	}
};

export class YggdrasilSession {
	constructor(accessToken, clientToken, selectedProfile, availableProfiles) {
		this.accessToken = accessToken;
		this.clientToken = clientToken;
		this.selectedProfile = selectedProfile;
		this.availableProfiles = availableProfiles;
	}

	name() {
		return this.selectedProfile.name;
	}

	session() {
		return {
			accessToken: this.accessToken,
			clientToken: this.clientToken,
			selectedProfile: this.selectedProfile,
		};
	}

	async store() {
		if (this.selectedProfile == null) { throw new ProfileNotSelectedError(); }
		await writeJsonFile(`.cache/${this.name()}.json`, this.session());
	}

	static async load(profile) {
		let cache_data = await readJsonFile(`.cache/${profile}.json`);
		if (cache_data == null) { return null; }
		return new YggdrasilSession(cache_data.accessToken, cache_data.clientToken, cache_data.selectedProfile);
	}

	async validate(endpoint) {
		let vres = await axios.post(endpoint.auth_url('validate'), {
			accessToken: this.accessToken,
			clientToken: this.clientToken,
		}, { validateStatus: (status) => (status === 403 || status === 204) });
		return vres.status == 204;
	}

	async selectProfile(endpoint, profile) {
		if (this.selectedProfile != null) {
			if (this.name() != profile) {
				throw new ProfileAlreadySelectedError(this.name());
			} else { return; }
		}

		if (this.availableProfiles == null) {
			throw new NoCredentialError(profile);
		}

		let profile_info = null;
		for (let info of this.availableProfiles) {
			if (info.name == profile) {
				profile_info = info;
				break;
			}
		}

		if (profile_info == null) { throw new NoCredentialError(profile); }

		let session_info = (await axios.post(endpoint.auth_url('refresh'), {
			accessToken: this.accessToken,
			clientToken: this.clientToken,
			selectedProfile: profile_info,
		})).data;
		this.selectedProfile = session_info.selectedProfile;
		this.accessToken = session_info.accessToken;
		this.availableProfiles = null;
	}

	mineflayer(endpoint) {
		if (this.selectedProfile == null) { throw new ProfileNotSelectedError(); }

		return {
			username: this.name(),
			authServer: endpoint.endpoint_auth,
			sessionServer: endpoint.endpoint_session,
			auth: (client, options) => {
				client.username = this.name();
				client.session = this.session();
				options.accessToken = this.accessToken;
				options.clientToken = this.clientToken;
				options.haveCredentials = true;
				client.emit('session', client.session);
				options.connect(client);
			},
		};
	}
};

export class OfflineSession {
	constructor(username) {
		this.username = username;
	}

	name() { return this.username; }
	session() { return null; }
	async store() {}
	static async load(profile) { return new OfflineSession(profile); }
	async validate() { return true; }
	async selectProfile(profile) { this.username = profile; }

	mineflayer() {
		if (this.username == null) { throw new ProfileNotSelectedError(); }

		return {
			username: this.name(),
			auth: 'offline',
		};
	}
}
