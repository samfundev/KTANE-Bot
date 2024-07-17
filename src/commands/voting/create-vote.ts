import { ApplyOptions } from "@sapphire/decorators";
import { Args, Command, container } from "@sapphire/framework";
import { Message } from "discord.js";
import { DB } from "../../db.js";

@ApplyOptions<Command.Options>({
	name: "createvote",
	aliases: ["cv"],
	description: "Creates a new vote.",
})
export default class CreateVoteCommand extends Command {
	usage = "<topic> <option ...>";

	async messageRun(msg: Message, args: Args): Promise<Message> {
		const topic = await args.pick("string");
		const options = await args.repeat("string");

		const currentVote = container.db.get(DB.global, "vote", null);
		if (currentVote != null) {
			return msg.reply("A vote is already running.");
		}

		container.db.set(DB.global, "vote", {
			topic,
			options,
			votes: new Array(options.length).fill(0),
			voted: []
		});

		return msg.channel.send("Vote created.");
	}
}