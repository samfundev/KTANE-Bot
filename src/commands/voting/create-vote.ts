import { ApplyOptions } from "@sapphire/decorators";
import { Args } from "@sapphire/framework";
import {
	MixedCommand,
	MixedInteraction,
	MixedOptions,
} from "../../mixed-command.js";
import { ApplicationCommandOptionType } from "discord.js";
import { settings } from "../../db.js";

@ApplyOptions<MixedOptions>({
	name: "createvote",
	aliases: ["cv"],
	description: "Creates a new vote.",
	slashOptions: [
		{
			name: "topic",
			type: ApplicationCommandOptionType.String,
			description: "The topic of the vote.",
		},
		{
			name: "options",
			type: ApplicationCommandOptionType.String,
			description: "The options for the vote.",
		},
	],
})
export default class CreateVoteCommand extends MixedCommand {
	async run(msg: MixedInteraction, args: Args): Promise<void> {
		const topic = await args.pick({ name: "topic", type: "string" });
		const options = await args.repeat({ name: "options", type: "string" });

		const currentVote = settings.read.global.vote ?? null;
		if (currentVote != null) {
			await msg.reply("A vote is already running.");
		}

		settings.write.global.vote = {
			topic,
			options,
			votes: new Array<number>(options.length).fill(0),
			voted: [],
		};

		await msg.reply("Vote created.");
	}
}
