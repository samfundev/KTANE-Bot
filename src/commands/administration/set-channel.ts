import { ApplyOptions } from "@sapphire/decorators";
import { Args, Command, container } from "@sapphire/framework";
import { DBKey } from "../../db";
import GuildMessage from "../../guild-message";

@ApplyOptions<Command.Options>({
	name: "set-channel",
	aliases: ["setchannel"],
	description: ["Marks a channel for the bot to use.", "<type> can be requests or auditlog."].join("\n"),
	runIn: "GUILD_ANY",
	requiredClientPermissions: ["ManageRoles"],
	requiredUserPermissions: ["MuteMembers"],
})
export default class SetChannelCommand extends Command {
	usage = "<type> <channel>";

	channelTypes: { [type: string]: DBKey | undefined } = {
		requests: DBKey.RequestsChannel,
		auditlog: DBKey.AuditLog,
	};

	async messageRun(msg: GuildMessage, args: Args): Promise<void> {
		const type = await args.peek("enum", {
			enum: Object.keys(this.channelTypes)
		});
		const channel = await args.peek("guildChannel");

		const channelType = this.channelTypes[type];
		if (channelType === undefined) {
			await msg.reply(`Unknown channel type ${type}.`);
			return;
		}

		container.db.set(msg.guild, channelType, channel.id);
		await msg.reply(`Set ${channel.name} to ${type}.`);
	}
}