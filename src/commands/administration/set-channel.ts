import { ApplyOptions } from "@sapphire/decorators";
import { Args, Command, container } from "@sapphire/framework";
import { DBKey } from "../../db.js";
import GuildMessage from "../../guild-message.js";

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
		const type = await args.peek({
			name: "type",
			type: "enum",
			enum: Object.keys(this.channelTypes)
		});
		const channel = await args.peek({ name: "channel", type: "guildChannel" });

		const channelType = this.channelTypes[type];
		if (channelType === undefined) {
			await msg.reply(`Unknown channel type ${type}.`);
			return;
		}

		container.db.set(msg.guild, channelType, channel.id);
		await msg.reply(`Set ${channel.name} to ${type}.`);
	}
}