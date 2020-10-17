import { Message } from "discord.js";
import { inspect } from "util";

const levels: { [level: string]: any } = {
	info: console.log,
	error: console.error,
	warn: console.warn,
};

export default class Logger {
	static log(level = "log", ...data: any[]): void {
		const logMessage = `[${new Date().toISOString()}] [${level}] ${data.map(data => typeof data == "string" ? data : inspect(data)).join(" ")}`;

		levels[level](logMessage);
	}
	static info(...data: any[]): void { Logger.log("info", ...data); }
	static error(...data: any[]): void { Logger.log("error", ...data); }
	static warn(...data: any[]): void { Logger.log("warn", ...data); }
	static errorReply(reason: string, message: Message) {
		return (...data: any[]) => {
			Logger.error(...data);
			return message.reply(`Failed to ${reason}.`);
		};
	}
};