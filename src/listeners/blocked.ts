import { ApplyOptions } from "@sapphire/decorators";
import { CommandDeniedPayload, Listener, UserError } from "@sapphire/framework";
import Logger from "../log";

@ApplyOptions<Listener.Options>({ event: "commandDenied" })
export default class CommandBlockedListener extends Listener {
	run(error: UserError, { message, command }: CommandDeniedPayload): void {
		Logger.info(`${message.author.username} was blocked from using ${command.name} because ${error.message}.`);
	}
}