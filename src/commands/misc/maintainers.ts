import { Command } from "discord-akairo";
import { Message } from "discord.js";
import tokens from "../../get-tokens";

export default class MaintainersCommand extends Command {
	constructor() {
		super("maintainers", {
			aliases: ["maintainers", "maintainer"],
			category: "misc",
			description: "Sends a ping to other maintainers.",
			channel: "guild"
		});
	}

	public condition(message: Message): boolean {
		return message.member?.roles.cache.has(tokens.roleIDs.maintainer) ?? false;
	}

	async exec(msg: Message): Promise<void> {
		await msg.channel.send({ content: `<@${tokens.roleIDs.maintainer}> ` + msg.content, allowedMentions: { roles: [ tokens.roleIDs.maintainer ] } });
		await msg.delete();
	}
}