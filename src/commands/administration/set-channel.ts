import { ApplyOptions } from "@sapphire/decorators";
import { Args, container } from "@sapphire/framework";
import { DBKey } from "../../db.js";
import { MixedCommand, MixedInteraction, MixedOptions } from "../../mixed-command.js";
import { ApplicationCommandOptionType } from "discord.js";

@ApplyOptions<MixedOptions>({
	name: "set-channel",
	aliases: ["setchannel"],
	description: ["Marks a channel for the bot to use.", "<type> can be requests or auditlog."].join("\n"),
	runIn: "GUILD_ANY",
	requiredClientPermissions: ["ManageRoles"],
	requiredUserPermissions: ["MuteMembers"],
	slashOptions: [
		{ name: "type", type: ApplicationCommandOptionType.String, description: "The type of channel you want to set.", choices: [{ name: "Requests", value: "requests" }, { name: "Audit Log", value: "auditlog" }] },
		{ name: "channel", type: ApplicationCommandOptionType.Channel, description: "The channel you want to set." }
	]
})
export default class SetChannelCommand extends MixedCommand {
	channelTypes: { [type: string]: DBKey | undefined } = {
		requests: DBKey.RequestsChannel,
		auditlog: DBKey.AuditLog,
	};

	async run(msg: MixedInteraction<true>, args: Args): Promise<void> {
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