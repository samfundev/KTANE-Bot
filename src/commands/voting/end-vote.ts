import { Command } from "discord-akairo";
import { Message, MessageEmbed } from "discord.js";

export default class EndVoteCommand extends Command {
	constructor() {
		super("endvote", {
			aliases: ["endvote", "ev"],
			category: "voting",
			description: "Ends the current vote.",
		});
	}

	async exec(msg: Message): Promise<Message> {
		const currentVote = this.client.settings.get("global", "vote", null);
		if (currentVote == null) {
			return msg.reply("There is no vote running.");
		}

		const totalVotes = currentVote.votes.reduce((a: number, b: number) => a + b, 0);
		const description = currentVote.options.map((option: string, index: number) => {
			const optionTotal = currentVote.votes[index];
			return `${index + 1}. ${option} - ${optionTotal} (${totalVotes == 0 ? 0 : Math.floor(optionTotal / totalVotes * 100)}%)`;
		}).join("\n");

		const embed = new MessageEmbed({
			title: `__${currentVote.topic}__`,
			description: `\`\`\`\n${description}\`\`\``,
			footer: {
				text: `Total votes: ${totalVotes} - Voters: ${currentVote.voted.length}`
			}
		});

		await this.client.settings.delete("global", "vote");

		embed.setColor("#00ff00");

		return msg.channel.send({
			embeds: [embed]
		});
	}
}