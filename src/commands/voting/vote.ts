import { ApplyOptions } from "@sapphire/decorators";
import { Args, container } from "@sapphire/framework";
import { InteractionResponse, Message } from "discord.js";
import { DB } from "../../db.js";
import { VoteData } from "#utils/voting";
import { MixedCommand, MixedInteraction, MixedOptions } from "../../mixed-command.js";
import { ApplicationCommandOptionType } from "discord.js";

@ApplyOptions<MixedOptions>({
	name: "vote",
	aliases: ["v"],
	description: "Submits a vote in a vote.",
	runIn: "GUILD_ANY",
	requiredClientPermissions: ["ManageRoles"],
	requiredUserPermissions: ["MuteMembers"],
	slashOptions: [
		{ name: "option", type: ApplicationCommandOptionType.String, description: "The options you want to vote for." }
	]
})
export default class VoteCommand extends MixedCommand {
	async run(msg: MixedInteraction, args: Args): Promise<Message | InteractionResponse> {
		const vote = await args.repeat({ name: "vote", type: "number" });

		if (msg.guild !== null) {
			await msg.delete();

			return msg.reply("You should only vote in DMs.");
		}

		const currentVote = container.db.getOrUndefined<VoteData>(DB.global, "vote");
		if (currentVote === undefined) {
			return msg.reply("There is no vote running.");
		}

		if (currentVote.voted.includes(msg.author.id)) {
			return msg.reply("You have already voted.");
		}

		for (const option of vote) {
			if (option > currentVote.options.length || option < 1) {
				return msg.reply(`${option} is not a valid option.`);
			}
		}

		for (const option of vote) {
			currentVote.votes[option - 1]++;
		}

		currentVote.voted.push(msg.author.id);

		container.db.set(DB.global, "vote", currentVote);

		return msg.reply(`Vote recorded! Voted for: ${vote.join(", ")}`);
	}
}