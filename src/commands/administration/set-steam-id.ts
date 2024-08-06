import { ApplyOptions } from "@sapphire/decorators";
import { Args, Command, container } from "@sapphire/framework";
import { Message } from "discord.js";

@ApplyOptions<Command.Options>({
	name: "set-steam-id",
	aliases: ["setsteamid", "setid"],
	description: "Sets a Steam ID to Discord ID pair for the announcements.",
	runIn: "GUILD_ANY",
})
export default class SetSteamIDCommand extends Command {
	usage = "<steam id> <discord id>";

	async messageRun(msg: Message, args: Args): Promise<void> {
		const steamid = await args.pick({ name: "steamid", type: "string" });
		const discordid = await args.pick({ name: "discordid", type: "string" });

		container.db.database.prepare("INSERT INTO 'author_lookup' (steam_id, discord_id) VALUES(?, ?) ON CONFLICT(steam_id) DO UPDATE SET discord_id=excluded.discord_id").run(steamid, discordid);
		await msg.reply(`Set "${steamid}" to "${discordid}".`);
	}
}