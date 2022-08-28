import { ApplyOptions } from "@sapphire/decorators";
import { Command } from "@sapphire/framework";
import { Message } from "discord.js";
import tokens from "../../get-tokens";

@ApplyOptions<Command.Options>({
	name: "maintainers",
	aliases: ["maintainer"],
	description: "Sends a ping to other maintainers.",
	runIn: "GUILD_ANY",
})
export default class MaintainersCommand extends Command {
	async messageRun(message: Message): Promise<void> {
		if (!(message.member?.roles.cache.has(tokens.roleIDs.maintainer) ?? false)) {
			return;
		}

		await message.channel.send({ content: `<@&${tokens.roleIDs.maintainer}> ` + message.content, allowedMentions: { roles: [tokens.roleIDs.maintainer] } });
		await message.delete();
	}
}