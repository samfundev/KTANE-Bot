import { ApplyOptions } from "@sapphire/decorators";
import { Args, Command } from "@sapphire/framework";
import { ChannelType, Message } from "discord.js";
import tokens from "../../get-tokens.js";

@ApplyOptions<Command.Options>({
	name: "maintainers",
	aliases: ["maintainer"],
	description: "Sends a ping to other maintainers.",
	runIn: ChannelType.GuildText,
})
export default class MaintainersCommand extends Command {
	async messageRun(message: Message, args: Args): Promise<void> {
		if (!(message.member?.roles.cache.has(tokens.roleIDs.maintainer) ?? false) || message.channel.type === ChannelType.DM || message.channel.isThread()) {
			return;
		}

		const content = await args.rest({ name: "content", type: "string" });

		const author = message.author;
		const webhook = await message.channel.createWebhook({
			name: author.username,
			avatar: author.displayAvatarURL(),
			reason: "Mimicing user for maintainers command."
		});

		await webhook.send({ content: `<@&${tokens.roleIDs.maintainer}> ` + content, allowedMentions: { roles: [tokens.roleIDs.maintainer] } });
		await message.delete();
		await webhook.delete();
	}
}