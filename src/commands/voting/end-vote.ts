import { ApplyOptions } from "@sapphire/decorators";
import { Command, container } from "@sapphire/framework";
import { Message, MessageEmbed } from "discord.js";
import { DB } from "../../db";
import { VoteData } from "#utils/voting";

@ApplyOptions<Command.Options>({
	name: "endvote",
	aliases: ["ev"],
	description: "Ends the current vote.",
})
export default class EndVoteCommand extends Command {
	async messageRun(msg: Message): Promise<Message> {
		const currentVote = container.db.getOrUndefined<VoteData>(DB.global, "vote");
		if (currentVote === undefined) {
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

		container.db.delete(DB.global, "vote");

		embed.setColor("#00ff00");

		return msg.channel.send({
			embeds: [embed]
		});
	}
}