import { ApplyOptions } from "@sapphire/decorators";
import { Listener, MessageCommandDeniedPayload, UserError } from "@sapphire/framework";
import Logger from "../log";

@ApplyOptions<Listener.Options>({ event: "messageCommandDenied" })
export default class CommandBlockedListener extends Listener {
	run(error: UserError, { message, command }: MessageCommandDeniedPayload): void {
		Logger.info(`${message.author.username} was blocked from using ${command.name} because ${error.message}.`);
	}
}