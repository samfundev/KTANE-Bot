/* eslint-disable @typescript-eslint/no-unsafe-return */

import { Snowflake } from "discord.js";
import Database from "better-sqlite3";
import { join } from "path";

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
		this.database = new Database(join(__dirname, "..", "database.sqlite3"));
	}

	private getRow(object: DiscordObject): { settings: string } | undefined {
		return this.database.prepare("SELECT settings FROM settings WHERE id = ?").get(object.id) as { settings: string } | undefined;
	}

	get<V>(object: DiscordObject, key: DBKey | string, defaultValue: V): V {
		const json = JSON.parse(this.getRow(object)?.settings ?? "{}") as { [key: string]: V };
		return json[key] ?? defaultValue;
	}

	getOrUndefined<V>(object: DiscordObject, key: DBKey | string): V | undefined {
		const json = JSON.parse(this.getRow(object)?.settings ?? "{}") as { [key: string]: V };
		return json[key];
	}

	set<V>(object: DiscordObject, key: DBKey | string, value: V): void {
		const row = this.getRow(object);
		if (row === undefined) {
			this.database.prepare("INSERT INTO settings (id, settings) VALUES (?, ?)").run(object.id, { [key]: value });
		} else {
			const json = JSON.parse(row.settings) as { [key: string]: V };
			json[key] = value;
			this.database.prepare("UPDATE settings SET settings = ? WHERE id = ?").run(JSON.stringify(json), object.id);
		}
	}

	delete(object: DiscordObject, key: DBKey | string): void {
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