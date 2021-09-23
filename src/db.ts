/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Provider } from "discord-akairo";
import { Snowflake } from "discord.js";

type DiscordObject = { id: Snowflake };

export enum DBKey {
	RequestsChannel,
	AuditLog,
}

export class DB {
	provider: Provider;

	constructor(provider: Provider) {
		this.provider = provider;
	}

	async get<V>(object: DiscordObject, key: DBKey, defaultValue?: V): Promise<V | undefined> {
		return await this.provider.get(object.id, DBKey[key], defaultValue);
	}

	async set<V>(object: DiscordObject, key: DBKey, value: V): Promise<void> {
		await this.provider.set(object.id, DBKey[key], value);
	}

	async delete(object: DiscordObject, key: DBKey): Promise<boolean> {
		return await this.provider.delete(object.id, DBKey[key]);
	}

	async clear(object: DiscordObject): Promise<boolean> {
		return await this.provider.clear(object.id);
	}
}