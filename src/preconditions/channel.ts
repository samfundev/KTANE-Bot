import { Precondition } from "@sapphire/framework";
import { ApplyOptions } from "@sapphire/decorators";
import { ChannelType, ChatInputCommandInteraction, Message } from "discord.js";
import { MixedCommand } from "../mixed-command";

@ApplyOptions<Precondition.Options>({ position: 0 })
export default class ChannelPrecondition extends Precondition {
	run(message: Message | ChatInputCommandInteraction, command: MixedCommand): Precondition.Result {
		if (!message.channel)
			return this.error({ message: "Command must be in a channel." });

		// Don't block any DM commands
		if (message.guild == null || message.channel.type == ChannelType.DM)
			return this.ok();

		// Commands are allowed in these channels
		if (["bot-commands", "staff-only", "audit-log", "mod-commands", "community"].includes(message.channel.name))
			return this.ok();

		// refresh-rolemenu can be used anywhere and agree can be used in rules
		if (command != null && (command.name == "refresh-rolemenu" || (command.name == "agree" && message.channel.name == "rules")))
			return this.ok();

		// maintainers can be used in repo- channels
		if (command != null && (command.name == "maintainers" && message.channel.name.startsWith("repo-")))
			return this.ok();

		// ephemeral commands can be used in any channel if it's an interaction
		if (command != null && command.options.ephemeral) {
			if (message instanceof ChatInputCommandInteraction)
				return this.ok();

			return this.error({ message: "That command can be used as a slash command or go to <#394275199509594113>." });
		}

		return this.error({ message: "That command isn't allowed in this channel. Go to <#394275199509594113>." });
	}

	messageRun(messsage: Message, command: MixedCommand): Precondition.Result {
		return this.run(messsage, command);
	}

	chatInputRun(interaction: ChatInputCommandInteraction, command: MixedCommand): Precondition.Result {
		return this.run(interaction, command);
	}
}