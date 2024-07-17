/* eslint-disable @typescript-eslint/no-unsafe-return */

import { Snowflake } from "discord.js";
import Database from "better-sqlite3";
import { join } from "path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

type DiscordObject = { id: Snowflake };

export enum DBKey {
	RequestsChannel,
	AuditLog,
}

// TODO: Rename to Database
// TODO: Consider using prisma
export class DB {
	database: Database.Database;
	static global: DiscordObject = { id: "global" };

	constructor() {
		const __dirname = dirname(fileURLToPath(import.meta.url));
		this.database = new Database(join(__dirname, "..", "database.sqlite3"));
	}

	private getRow(object: DiscordObject): { settings: string } | undefined {
		return this.database.prepare("SELECT settings FROM settings WHERE id = ?").get(object.id) as { settings: string } | undefined;
	}

	private getKey(key: DBKey | string): string {
		return (typeof key === "string") ? key : DBKey[key];
	}

	get<V>(object: DiscordObject, key: DBKey | string, defaultValue: V): V {
		key = this.getKey(key);

		const json = JSON.parse(this.getRow(object)?.settings ?? "{}") as { [key: string]: V };
		return json[key] ?? defaultValue;
	}

	getOrUndefined<V>(object: DiscordObject, key: DBKey | string): V | undefined {
		key = this.getKey(key);

		const json = JSON.parse(this.getRow(object)?.settings ?? "{}") as { [key: string]: V };
		return json[key];
	}

	set<V>(object: DiscordObject, key: DBKey | string, value: V): void {
		key = this.getKey(key);

		const row = this.getRow(object);
		if (row === undefined) {
			this.database.prepare("INSERT INTO settings (id, settings) VALUES (?, ?)").run(object.id, JSON.stringify({ [key]: value }));
		} else {
			const json = JSON.parse(row.settings) as { [key: string]: V };
			json[key] = value;
			this.database.prepare("UPDATE settings SET settings = ? WHERE id = ?").run(JSON.stringify(json), object.id);
		}
	}

	delete(object: DiscordObject, key: DBKey | string): void {
		key = this.getKey(key);

		const row = this.getRow(object);
		if (row === undefined) {
			return;
		}

		const json = JSON.parse(row.settings) as { [key: string]: unknown };
		delete json[key];
		this.database.prepare("UPDATE settings SET settings = ? WHERE id = ?").run(JSON.stringify(json), object.id);
	}

	clear(object: DiscordObject): void {
		this.database.prepare("DELETE FROM settings WHERE id = ?").run(object.id);
	}
}