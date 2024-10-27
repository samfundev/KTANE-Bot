import { ApplyOptions } from "@sapphire/decorators";
import { Args, container } from "@sapphire/framework";
import { DB } from "../../db.js";
import { MixedCommand, MixedInteraction, MixedOptions } from "../../mixed-command.js";
import { ApplicationCommandOptionType } from "discord.js";

@ApplyOptions<MixedOptions>({
	name: "createvote",
	aliases: ["cv"],
	description: "Creates a new vote.",
	slashOptions: [
		{ name: "topic", type: ApplicationCommandOptionType.String, description: "The topic of the vote." },
		{ name: "options", type: ApplicationCommandOptionType.String, description: "The options for the vote." }
	]
})
export default class CreateVoteCommand extends MixedCommand {
	async run(msg: MixedInteraction, args: Args): Promise<void> {
		const topic = await args.pick({ name: "topic", type: "string" });
		const options = await args.repeat({ name: "options", type: "string" });

		const currentVote = container.db.get(DB.global, "vote", null);
		if (currentVote != null) {
			await msg.reply("A vote is already running.");
		}

		container.db.set(DB.global, "vote", {
			topic,
			options,
			votes: new Array(options.length).fill(0),
			voted: []
		});

		await msg.reply("Vote created.");
	}
}