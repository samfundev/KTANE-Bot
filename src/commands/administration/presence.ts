import { ApplyOptions } from "@sapphire/decorators";
import { Args } from "@sapphire/framework";
import { MixedCommand, MixedInteraction, MixedOptions } from "../../mixed-command.js";
import checkStreamingStatus from "../../check-stream.js";
import { ApplicationCommandOptionType } from "discord.js";

@ApplyOptions<MixedOptions>({
	name: "presence",
	description: "Checks someone presence to see if they're streaming.",
	runIn: "GUILD_ANY",
	slashOptions: [
		{ name: "target", type: ApplicationCommandOptionType.User, description: "The user you want to check." }
	]
})
export default class PresenceCommand extends MixedCommand {
	async run(_msg: MixedInteraction, args: Args): Promise<void> {
		const target = await args.pick({ name: "target", type: "member" });

		await checkStreamingStatus(target.presence, false);
	}
}