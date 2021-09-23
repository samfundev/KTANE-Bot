import { Command } from "discord-akairo";
import { Message } from "discord.js";
import path from "path";
import * as sqlite from "sqlite";
import sqlite3 from "sqlite3";
import Logger from "../../log";

export default class SetSteamIDCommand extends Command {
	constructor() {
		super("set-steam-id", {
			aliases: ["setsteamid", "setid"],
			category: "administration",
			description: "Sets a Steam ID to Discord ID pair for the announcements.",
			channel: "guild",

			args: [
				{
					id: "steamid",
					type: "string"
				},
				{
					id: "discordid",
					type: "string"
				}
			]
		});

		this.usage = "<steam id> <discord id>";
	}

	exec(msg: Message, args: { steamid: string, discordid: string }): Promise<Message> {
		// eslint-disable-next-line @typescript-eslint/unbound-method
		return sqlite.open({ filename: path.join(__dirname, "..", "..", "..", "database.sqlite3"), driver: sqlite3.cached.Database })
			.then(db => db.run("INSERT INTO 'author_lookup' (steam_id, discord_id) VALUES(?, ?) ON CONFLICT(steam_id) DO UPDATE SET discord_id=excluded.discord_id", args.steamid, args.discordid))
			.then(() => msg.reply(`Set "${args.steamid}" to "${args.discordid}".`))
			.catch(Logger.errorReply("set steam ID", msg));
	}
}