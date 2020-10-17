import { Command } from "discord-akairo";
import { GuildMember, Message } from "discord.js";
import checkStreamingStatus from "../../check-stream";

export default class PresenceCommand extends Command {
	constructor() {
		super("presence", {
			aliases: ["presence"],
			category: "administration",
			description: "",
			channel: "guild",

			args: [
				{
					id: "target",
					type: "member"
				}
			]
		});
	}

	exec(_msg: Message, { target }: { target: GuildMember }): void {
		checkStreamingStatus(target.presence);
	}
}