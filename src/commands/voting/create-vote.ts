import { ApplyOptions } from "@sapphire/decorators";
import { Args, Command, container } from "@sapphire/framework";
import { DB } from "../../db.js";
import { MixedCommand, MixedInteraction } from "../../mixed-command.js";

@ApplyOptions<Command.Options>({
	name: "createvote",
	aliases: ["cv"],
	description: "Creates a new vote.",
})
export default class CreateVoteCommand extends MixedCommand {
	usage = "<topic> <option ...>";

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