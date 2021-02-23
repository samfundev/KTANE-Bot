import { Command } from "discord-akairo";
import { Message, Util } from "discord.js";
import { QueryParser } from "../../lfg";

export default class LFGHelpCommand extends Command {
	constructor() {
		super("lfg-help", {
			category: "lfg",
			channel: "dm",
			args: [
				{
					id: "topic",
					type: "string",
					default: "basics"
				}
			]
		});
	}

	topics: Record<string, string> = {
		basics: "LFG basics:\n- `!lfg join <games>` searches for other players who want to play those games. After a game you can optionally specify tags to filter down who you're looking for. Example: `!lfg join ktane modded among_us` will look for someone who wants to play modded KTANE or Among Us.\n- `!lfg leave` stops looking for another players.\n- `!lfg help <topic>` gives you more information on a topic. Available topics: games, tags and languages.",
		games: "Games let you specify what you want to play. Games cannot use spaces and are case-insensitive.\nAvailable games: " + Util.escapeMarkdown(QueryParser.stringify(QueryParser.games)),
		tags: "Tags let you filter a game to be something more specific. Tags cannot use spaces and are case-insensitive.\nAvailable tags: " + Util.escapeMarkdown(QueryParser.stringify(QueryParser.tags)),
		languages: "You can specify what languages you can speak with the `!languages` command."
	}

	exec(msg: Message, { topic }: { topic: string }): void {
		if (!Object.keys(this.topics).includes(topic)) {
			msg.reply(`Unknown topic: ${topic}. Available topics: ${Object.keys(this.topics).join(", ")}.`);
			return;
		}

		msg.reply(this.topics[topic]);
	}
}