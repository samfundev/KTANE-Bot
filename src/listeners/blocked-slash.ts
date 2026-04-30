import { ApplyOptions } from "@sapphire/decorators";
import {
	Listener,
	UserError,
	ChatInputCommandDeniedPayload,
} from "@sapphire/framework";
import Logger from "../log";

@ApplyOptions<Listener.Options>({ event: "chatInputCommandDenied" })
export default class SlashCommandBlockedListener extends Listener {
	async run(
		error: UserError,
		{ interaction, command }: ChatInputCommandDeniedPayload,
	): Promise<void> {
		Logger.info(
			`${interaction.user.username} was blocked from using ${command.name} because ${error.message}.`,
		);
		await interaction.reply({ content: error.message, ephemeral: true });
	}
}
