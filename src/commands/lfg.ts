import { ApplyOptions } from "@sapphire/decorators";
import { Args } from "@sapphire/framework";
import { Subcommand } from "@sapphire/plugin-subcommands";
import { escapeMarkdown, Message } from "discord.js";
import { LFG, QueryParser } from "../lfg.js";
import Logger from "../log.js";

@ApplyOptions<Subcommand.Options>({
	name: "lfg",
	runIn: "DM",
	subcommands: [
		{ name: "help", messageRun: "help", default: true },
		{ name: "invite", messageRun: "invite" },
		{ name: "join", messageRun: "join" },
		{ name: "leave", messageRun: "leave" }
	],
})
export default class LFGBaseCommand extends Subcommand {
	topics: Record<string, string> = {
		basics: "LFG basics:\n- `!lfg join <games>` searches for other players who want to play those games. After a game you can optionally specify tags to filter down who you're looking for. Example: `!lfg join ktane modded among_us` will look for someone who wants to play modded KTANE or Among Us.\n- `!lfg leave` stops looking for another players.\n- `!lfg help <topic>` gives you more information on a topic. Available topics: games, tags and languages.",
		games: "Games let you specify what you want to play. Games cannot use spaces and are case-insensitive.\nAvailable games: " + escapeMarkdown(QueryParser.stringify(QueryParser.games)),
		tags: "Tags let you filter a game to be something more specific. Tags cannot use spaces and are case-insensitive.\nAvailable tags: " + escapeMarkdown(QueryParser.stringify(QueryParser.tags)),
		languages: "You can specify what languages you can speak with the `!languages` command."
	}

	async help(msg: Message, args: Args): Promise<void> {
		const topic = await args.pick("string").catch(() => "basics");
		if (!Object.keys(this.topics).includes(topic)) {
			await msg.reply(`Unknown topic: ${topic}. Available topics: ${Object.keys(this.topics).join(", ")}.`);
			return;
		}

		await msg.reply(this.topics[topic]);
	}

	async invite(message: Message, args: Args): Promise<void> {
		const players = await args.repeat("number");

		LFG.invite(message, players).catch(Logger.errorReply("invite users", message));
	}

	async join(message: Message, args: Args): Promise<void> {
		const query = await args.rest("string");

		const games = QueryParser.parse(query ?? "");
		// If the parser returns a string, that's an error we should show the user.
		if (typeof games === "string") {
			await message.reply(games);
			return;
		}

		LFG.join(message.author, games);
	}

	async leave(message: Message): Promise<void> {
		for (const player of LFG.players) {
			if (player.user == message.author.id) {
				if (player.message != null) {
					const lfgMessage = await message.channel.messages.fetch(player.message);
					await lfgMessage.delete();
				}

				break;
			}
		}

		LFG.leave(message.author.id);
	}
}