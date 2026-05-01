import { ApplyOptions } from "@sapphire/decorators";
import { EmbedBuilder } from "discord.js";
import { settings } from "../../db.js";
import {
	MixedCommand,
	MixedInteraction,
	MixedOptions,
} from "../../mixed-command.js";

@ApplyOptions<MixedOptions>({
	name: "endvote",
	aliases: ["ev"],
	description: "Ends the current vote.",
	slashOptions: [],
})
export default class EndVoteCommand extends MixedCommand {
	async run(msg: MixedInteraction): Promise<void> {
		const currentVote = settings.read.global.vote;
		if (currentVote === undefined) {
			await msg.reply("There is no vote running.");
			return;
		}

		const totalVotes = currentVote.votes.reduce(
			(a: number, b: number) => a + b,
			0,
		);
		const description = currentVote.options
			.map((option: string, index: number) => {
				const optionTotal = currentVote.votes[index];
				return `${index + 1}. ${option} - ${optionTotal} (${totalVotes == 0 ? 0 : Math.floor((optionTotal / totalVotes) * 100)}%)`;
			})
			.join("\n");

		const embed = new EmbedBuilder({
			title: `__${currentVote.topic}__`,
			description: `\`\`\`\n${description}\`\`\``,
			footer: {
				text: `Total votes: ${totalVotes} - Voters: ${currentVote.voted.length}`,
			},
		});

		delete settings.write.global.vote;

		embed.setColor("#00ff00");

		await msg.reply({
			embeds: [embed],
		});
	}
}
