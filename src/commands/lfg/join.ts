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

	async exec(message: Message, { query }: { query: string }): Promise<void> {
		const games = QueryParser.parse(query ?? "");
		// If the parser returns a string, that's an error we should show the user.
		if (typeof games === "string") {
			await message.reply(games);
			return;
		}

		LFG.join(message.author, games);
	}
}