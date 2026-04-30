import { ApplyOptions } from "@sapphire/decorators";
import {
	Listener,
	MessageCommandDeniedPayload,
	UserError,
} from "@sapphire/framework";
import Logger from "../log.js";

@ApplyOptions<Listener.Options>({ event: "messageCommandDenied" })
export default class CommandBlockedListener extends Listener {
	async run(
		error: UserError,
		{ message, command }: MessageCommandDeniedPayload,
	): Promise<void> {
		Logger.info(
			`${message.author.username} was blocked from using ${command.name} because ${error.message}.`,
		);
		await message.author.send(error.message);
	}
}
