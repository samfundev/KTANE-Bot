import { Command, Inhibitor } from "discord-akairo";
import { Message } from "discord.js";

export default class ModeratorInhibitor extends Inhibitor {
	constructor() {
		super("channel", {
			reason: "commands aren't allowed in that channel"
		});
	}

	exec(message: Message, command: Command): boolean {
		// Don't block any DM commands
		if (message.guild == null || message.channel.type == "DM")
			return false;

		// Commands are allowed in these channels
		if (["bot-commands", "staff-only", "audit-log", "mod-commands", "community"].includes(message.channel.name))
			return false;

		// refresh-rolemenu can be used anywhere and agree can be used in rules
		if (command != null && (command.id == "refresh-rolemenu" || (command.id == "agree" && message.channel.name == "rules")))
			return false;

		return true;
	}
}