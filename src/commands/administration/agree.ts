import { Command } from "discord-akairo";
import GuildMessage from "../../guild-message";

export default class AgreeCommand extends Command {
	constructor() {
		super("agree", {
			aliases: ["agree", "iagree", "ia"],
			category: "administration",
			description: "Accepts the rules of the server.",
			channel: "guild",
			clientPermissions: ["MANAGE_ROLES"]
		});
	}

	exec(msg: GuildMessage): void {
		if (msg.member.roles.cache.has("640569603344302107"))
			return;

		msg.member.roles.add("640569603344302107");
	}
}