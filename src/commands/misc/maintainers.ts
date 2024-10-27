import { ApplyOptions } from "@sapphire/decorators";
import { Args } from "@sapphire/framework";
import { ChannelType } from "discord.js";
import tokens from "../../get-tokens.js";
import { MixedCommand, MixedInteraction, MixedOptions } from "../../mixed-command.js";
import { ApplicationCommandOptionType } from "discord.js";

@ApplyOptions<MixedOptions>({
	name: "maintainers",
	aliases: ["maintainer"],
	description: "Sends a ping to other maintainers.",
	runIn: ChannelType.GuildText,
	slashOptions: [
		{ name: "content", type: ApplicationCommandOptionType.String, description: "The content of the message to send." }
	]
})
export default class MaintainersCommand extends MixedCommand {
	async run(message: MixedInteraction<true>, args: Args): Promise<void> {
		if (!message.channel || !(message.member?.roles.cache.has(tokens.roleIDs.maintainer) ?? false) || message.channel.isThread()) {
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