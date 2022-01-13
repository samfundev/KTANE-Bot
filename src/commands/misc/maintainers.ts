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

	async exec(message: Message): Promise<void> {
		if (!(message.member?.roles.cache.has(tokens.roleIDs.maintainer) ?? false)) {
			return;
		}

		await message.channel.send({ content: `<@&${tokens.roleIDs.maintainer}> ` + message.content, allowedMentions: { roles: [ tokens.roleIDs.maintainer ] } });
		await message.delete();
	}
}