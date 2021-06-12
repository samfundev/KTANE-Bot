import { Command } from "discord-akairo";
import { Message } from "discord.js";
import { LFG, QueryParser } from "../../lfg";

export default class LFGJoinCommand extends Command {
	constructor() {
		super("lfg-join", {
			category: "lfg",
			channel: "dm",
			args: [
				{
					id: "query",
					match: "content"
				}
			]
		});
	}

	exec(message: Message, { query }: { query: string }): void {
		const games = QueryParser.parse(query ?? "");
		// If the parser returns a string, that's an error we should show the user.
		if (typeof games === "string") {
			message.reply(games);
			return;
		}

		LFG.join(message.author.id, games);
	}
}