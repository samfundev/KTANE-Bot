import { ApplyOptions } from "@sapphire/decorators";
import { Args } from "@sapphire/framework";
import {
	MixedCommand,
	MixedInteraction,
	MixedOptions,
} from "../../mixed-command.js";
import { setupVideoTask, VideoChannel } from "../../video.js";
import { ApplicationCommandOptionType } from "discord.js";
import { settings } from "../../db.js";

@ApplyOptions<MixedOptions>({
	name: "yt-channel",
	aliases: ["channel", "ytchannel"],
	description: [
		"Adds / removes a YouTube channel to the bot.",
		"<user> is the user whose channel is being added.",
		"<channel id> should be a YT channel ID: UC_x5XG1OV2P6uZZ5FSM9Ttw",
	].join("\n"),
	runIn: "GUILD_ANY",
	slashOptions: [
		{
			type: ApplicationCommandOptionType.Subcommand,
			name: "add",
			description: "Adds a YouTube channel to the bot.",
			required: false,
			options: [
				{
					name: "user",
					type: ApplicationCommandOptionType.User,
					description: "The user whose channel you want to add.",
				},
				{
					name: "channel_id",
					type: ApplicationCommandOptionType.String,
					description: "The channel ID of the user.",
				},
			],
		},
		{
			type: ApplicationCommandOptionType.Subcommand,
			name: "remove",
			description: "Removes a YouTube channel from the bot.",
			required: false,
			options: [
				{
					name: "user",
					type: ApplicationCommandOptionType.User,
					description: "The user whose channel you want to remove.",
				},
			],
		},
	],
})
export default class YTChannelCommand extends MixedCommand {
	async run(msg: MixedInteraction, args: Args): Promise<void> {
		const user = await args.pick({ name: "user", type: "user" });

		if (msg.subcommand === "add") {
			const id = await args.pick({ name: "channel_id", type: "string" });
			const channel: VideoChannel = {
				name: user.username,
				mention: user.toString(),
				id,
			};

			if (!/^U[CU][0-9A-Za-z_-]+[AQgw]$/.test(channel.id)) {
				await msg.reply("Invalid YT channel ID.");
				return;
			}

			if (channel.id.startsWith("UC"))
				channel.id = `UU${channel.id.substring(2)}`;

			const channels = settings.read.global.videoChannels ?? [];
			channels.push(channel);
			settings.write.global.videoChannels = channels;

			await msg.reply("Added channel successfully.");
		} else if (msg.subcommand === "remove") {
			const channels = settings.read.global.videoChannels ?? [];
			const index = channels.findIndex((channel) => channel.mention === user.toString());
			if (index !== -1) {
				channels.splice(index, 1);
				settings.write.global.videoChannels = channels;
				await msg.reply("Removed channel successfully.");
			} else {
				await msg.reply("User has no channel added.");
			}
		}

		setupVideoTask();
	}
}
