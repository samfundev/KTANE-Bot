// From: https://github.com/discord-akairo/discord-akairo/blob/16d84c6215376c279ae9148d2a9de62328af9aa5/test/commands/eval.js

import { Command } from "discord-akairo";
import { Message } from "discord.js";
import util from "util";
import Logger from "../../log";

class EvalCommand extends Command {
	constructor() {
		super("eval", {
			aliases: ["eval", "e"],
			category: "owner",
			ownerOnly: true,
			quoted: false,
			args: [
				{
					id: "code",
					match: "content"
				}
			]
		});

		this.usage = "<code>";
	}

	async exec(message: Message, { code }: { code: string }) {
		if (message.util === undefined || this.client.token === null)
			return;

		if (!code) return message.util.reply("No code provided!");

		const evaled: { message?: Message, errored?: boolean, output?: string } = {};
		const logs: string[] = [];

		const token = this.client.token.split("").join("[^]{0,2}");
		const rev = this.client.token.split("").reverse().join("[^]{0,2}");
		const tokenRegex = new RegExp(`${token}|${rev}`, "g");
		const cb = "```";

		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const print = (...a: unknown[]) => {
			const cleaned = a.map(obj => {
				if (typeof obj !== "string")
					obj = util.inspect(obj, { depth: 1 });

				if (typeof obj !== "string")
					return "Failed to convert to string.";

				return obj.replace(tokenRegex, "[TOKEN]");
			});

			if (evaled.output === undefined || evaled.message === undefined) {
				logs.push(...cleaned);
				return;
			}

			evaled.output += evaled.output.endsWith("\n") ? cleaned.join(" ") : `\n${cleaned.join(" ")}`;
			const title = evaled.errored ? "☠\u2000**Error**" : "📤\u2000**Output**";

			if (evaled.output.length + code.length > 1900) evaled.output = "Output too long.";
			evaled.message.edit([
				`📥\u2000**Input**${cb}js`,
				code,
				cb,
				`${title}${cb}js`,
				evaled.output,
				cb
			].join("\n")).catch(Logger.errorPrefix("Failed to update eval message:"));
		};

		try {
			let originalOutput = eval(code);
			if (originalOutput && typeof originalOutput.then === "function") originalOutput = await originalOutput;

			let output = typeof originalOutput !== "string" ? util.inspect(originalOutput, { depth: 0 }) : originalOutput;

			output = `${logs.join("\n")}\n${logs.length && output === "undefined" ? "" : output}`;
			output = output.replace(tokenRegex, "[TOKEN]");

			if (output.length + code.length > 1900) output = "Output too long.";

			const sent = await message.util.send([
				`📥\u2000**Input**${cb}js`,
				code,
				cb,
				`📤\u2000**Output**${cb}js`,
				output,
				cb
			].join("\n"));

			evaled.message = sent;
			evaled.errored = false;
			evaled.output = output;

			return sent;
		} catch (err) {
			if (!(err instanceof Error))
				return;

			Logger.error(err);

			let error = err.toString();
			error = `${logs.join("\n")}\n${logs.length && error === "undefined" ? "" : error}`;
			error = error.replace(tokenRegex, "[TOKEN]");

			const sent = await message.util.send([
				`📥\u2000**Input**${cb}js`,
				code,
				cb,
				`☠\u2000**Error**${cb}js`,
				error,
				cb
			].join("\n"));

			evaled.message = sent;
			evaled.errored = true;
			evaled.output = error;

			return sent;
		}
	}
}

module.exports = EvalCommand;
