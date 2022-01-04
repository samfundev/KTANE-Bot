import { Command, Precondition } from "@sapphire/framework";
import { ApplyOptions } from "@sapphire/decorators";
import { Message } from "discord.js";

@ApplyOptions<Precondition.Options>({ position: 0 })
export default class ChannelPrecondition extends Precondition {
	run(message: Message, command: Command): Precondition.Result {
		const error = this.error({ message: "Commands aren't allowed in that channel." });

		// Don't block any DM commands
		if (message.guild == null || message.channel.type == "DM")
			return error;

		// Commands are allowed in these channels
		if (["bot-commands", "staff-only", "audit-log", "mod-commands", "community"].includes(message.channel.name))
			return error;

		// refresh-rolemenu can be used anywhere and agree can be used in rules
		if (command != null && (command.name == "refresh-rolemenu" || (command.name == "agree" && message.channel.name == "rules")))
			return error;

		// maintainers can be used in repo- channels
		if (command != null && (command.name == "maintainers" && message.channel.name.startsWith("repo-")))
			return error;

		return this.ok();
	}
}