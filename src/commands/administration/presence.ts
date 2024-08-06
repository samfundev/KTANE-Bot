import { ApplyOptions } from "@sapphire/decorators";
import { Args, Command } from "@sapphire/framework";
import { Message } from "discord.js";
import checkStreamingStatus from "../../check-stream.js";

@ApplyOptions<Command.Options>({
	name: "presence",
	description: "Checks someone presence to see if they're streaming.",
	runIn: "GUILD_ANY"
})
export default class PresenceCommand extends Command {
	usage = "<target>";

	async messageRun(_msg: Message, args: Args): Promise<void> {
		const target = await args.pick({ name: "target", type: "member" });

		await checkStreamingStatus(target.presence, false);
	}
}