import { Command } from "discord-akairo";
import { Message } from "discord.js";

export default class VoteCommand extends Command {
	constructor() {
		super("vote", {
			aliases: ["vote", "v"],
			category: "voting",
			description: "Submits a vote in a vote.",

			args: [
				{
					id: "vote",
					type: "integer",
					match: "separate"
				}
			]
		});
	}

	async exec(msg: Message, args: { vote: number[] }): Promise<Message> {
		if (msg.guild !== null) {
			await msg.delete();

			return msg.reply("You should only vote in DMs.");
		}

		const currentVote = this.client.settings.get("global", "vote", null);
		if (currentVote == null) {
			return msg.reply("There is no vote running.");
		}

		if (currentVote.voted.includes(msg.author.id)) {
			return msg.reply("You have already voted.");
		}

		for (const option of args.vote) {
			if (option > currentVote.options.length || option < 1) {
				return msg.reply(`${option} is not a valid option.`);
			}
		}

		for (const option of args.vote) {
			currentVote.votes[option - 1]++;
		}

		currentVote.voted.push(msg.author.id);

		await this.client.settings.set("global", "vote", currentVote);

		return msg.reply(`Vote recorded! Voted for: ${args.vote.join(", ")}`);
	}
}