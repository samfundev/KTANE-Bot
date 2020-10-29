import { Command } from "discord-akairo";
import { Message } from "discord.js";

export default class CreateVoteCommand extends Command {
	constructor() {
		super("createvote", {
			aliases: ["createvote", "cv"],
			category: "voting",
			description: "Creates a new vote.",

			args: [
				{
					id: "topic",
					type: "string"
				},
				{
					id: "options",
					type: "string",
					match: "separate"
				}
			]
		});
	}

	exec(msg: Message, args: { topic: string, options: string[] }): Promise<Message> {
		const currentVote = this.client.settings.get("global", "vote", null);
		if (currentVote != null) {
			return msg.reply("A vote is already running.");
		}

		this.client.settings.set("global", "vote", {
			topic: args.topic,
			options: args.options,
			votes: new Array(args.options.length).fill(0),
			voted: []
		});

		return msg.channel.send("Vote created.");
	}
}