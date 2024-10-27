import { ApplyOptions } from "@sapphire/decorators";
import { Args, container } from "@sapphire/framework";
import { MixedCommand, MixedInteraction, MixedOptions } from "../../mixed-command.js";
import { ApplicationCommandOptionType } from "discord.js";

@ApplyOptions<MixedOptions>({
	name: "set-steam-id",
	aliases: ["setsteamid", "setid"],
	description: "Sets a Steam ID to Discord ID pair for the announcements.",
	runIn: "GUILD_ANY",
	slashOptions: [
		{ name: "steam_id", type: ApplicationCommandOptionType.String, description: "The Steam ID you want to set." },
		{ name: "discord_id", type: ApplicationCommandOptionType.String, description: "The Discord ID you want to set." }
	]
})
export default class SetSteamIDCommand extends MixedCommand {
	async run(msg: MixedInteraction, args: Args): Promise<void> {
		const steamid = await args.pick({ name: "steam_id", type: "string" });
		const discordid = await args.pick({ name: "discord_id", type: "string" });

		container.db.database.prepare("INSERT INTO 'author_lookup' (steam_id, discord_id) VALUES(?, ?) ON CONFLICT(steam_id) DO UPDATE SET discord_id=excluded.discord_id").run(steamid, discordid);
		await msg.reply(`Set "${steamid}" to "${discordid}".`);
	}
}