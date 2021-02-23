import { Command, Flag } from "discord-akairo";

export default class LFGBaseCommand extends Command {
	constructor() {
		super("lfg-base", {
			aliases: ["lfg"],
			category: "lfg",
			channel: "dm"
		});
	}

	*args(): Generator {
		const sub = yield {
			type: ["help", "join", "leave", "invite"],
			default: "help"
		};

		if (typeof sub !== "string")
			return;

		return Flag.continue("lfg-" + sub);
	}
}