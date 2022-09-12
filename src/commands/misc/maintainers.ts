import { ApplyOptions } from "@sapphire/decorators";
import { Args, Command } from "@sapphire/framework";
import { Message } from "discord.js";
import tokens from "../../get-tokens";

@ApplyOptions<Command.Options>({
	name: "maintainers",
	aliases: ["maintainer"],
	description: "Sends a ping to other maintainers.",
	runIn: "GUILD_TEXT",
})
export default class MaintainersCommand extends Command {
	async messageRun(message: Message, args: Args): Promise<void> {
		if (!(message.member?.roles.cache.has(tokens.roleIDs.maintainer) ?? false) || message.channel.type === "DM" || message.channel.isThread()) {
			return;
		}

		const content = await args.rest("string");

		const author = message.author;
		const webhook = await message.channel.createWebhook(author.username, {
			avatar: author.displayAvatarURL(),
			reason: "Mimicing user for maintainers command."
		});

		await webhook.send({ content: `<@&${tokens.roleIDs.maintainer}> ` + content, allowedMentions: { roles: [tokens.roleIDs.maintainer] } });
		await message.delete();
		await webhook.delete();
	}
}