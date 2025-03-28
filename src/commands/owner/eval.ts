// From: https://github.com/discord-akairo/discord-akairo/blob/16d84c6215376c279ae9148d2a9de62328af9aa5/test/commands/eval.js

import { ApplyOptions } from "@sapphire/decorators";
import { Args, container } from "@sapphire/framework";
import { ApplicationCommandOptionType, Message } from "discord.js";
import util from "util";
import Logger from "../../log.js";
import { MixedCommand, MixedInteraction, MixedOptions } from "../../mixed-command.js";

@ApplyOptions<MixedOptions>({
	name: "eval",
	aliases: ["e"],
	description: "Evalutes some code.",
	preconditions: ["OwnerOnly"],
	slashOptions: [
		{ name: "code", type: ApplicationCommandOptionType.String, description: "The code you want to evaluate." }
	]
})
class EvalCommand extends MixedCommand {
	async run(message: MixedInteraction, args: Args) {
		const code = await args.rest({ name: "code", type: "string" });

		const { client } = container;
		if (client.token === null || message.channel === null)
			return;

		if (!code) return message.reply("No code provided!");

		const evaled: { message?: Message, errored?: boolean, output?: string } = {};
		const logs: string[] = [];

		const token = client.token.split("").join("[^]{0,2}");
		const rev = client.token.split("").reverse().join("[^]{0,2}");
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

			const sent = await message.channel.send([
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

			const sent = await message.channel.send([
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
