import child_process, { ExecException } from "child_process";
import { AkairoClient } from "discord-akairo";
import { Message, MessageEmbed } from "discord.js";
import { createWriteStream } from "fs";
import got from "../utils/got-traces";
import path from "path";
import stream from "stream";
import { promisify } from "util";
import { joinLimit, update } from "../bot-utils";
import tokens from "../get-tokens";
import Logger from "../log";
import TaskManager from "../task-manager";
import { mkdir, rm } from "fs/promises";

const pipeline = promisify(stream.pipeline);
const exec = promisify(child_process.exec);

function pluralize(count: number, noun: string) {
	return `${count} ${noun}${count !== 1 ? "s" : ""}`;
}

// https://stackoverflow.com/a/54024653
// input: h in [0,360] and s,v in [0,1] - output: r,g,b in [0,255]
function hsv2rgb(h: number, s: number, v: number): [number, number, number] {
	const f = (n: number, k = (n + h / 60) % 6) => v - v * s * Math.max(Math.min(k, 4 - k, 1), 0);
	return [f(5) * 255, f(3) * 255, f(1) * 255];
}

export default async function lintMessage(message: Message, client: AkairoClient): Promise<void> {
	const extensions = [".zip", ".rar", ".7z", ".html", ".svg", ".json"];
	const file = Array.from(message.attachments.values()).find(attachment => extensions.some(extension => attachment.name?.endsWith(extension)));
	if (file === undefined || file.name === null || message.author.bot)
		return;

	const directory = `lint_${message.id}`;
	await mkdir(directory, { recursive: true });

	const notInDM = message.channel.type !== "DM";
	if (notInDM) await message.react("💭");

	try {
		const filePath = path.join(directory, file.name);
		await pipeline(
			got.stream(file.url),
			createWriteStream(filePath)
		);

		const lintResult = await lintFile(filePath);
		let report: Message | null;
		if (typeof lintResult === "string") {
			// There was an error with the user's input.
			report = await message.reply(lintResult);
		} else {
			report = await generateReport(message, lintResult);
		}

		if (report === null)
			await message.react("👍");
		else {
			const reportID = report.id;
			await update<Record<string, string>>(client.settings, message.guild !== null ? message.guild.id : message.channel.id, "reportMessages", {}, (value) => {
				value[message.id] = reportID;
				return value;
			});
		}
	} catch (error) {
		Logger.error("Linting failed.", error);
		TaskManager.sendOwnerMessage("An error ocurred while linting. Check the logs.");

		await message.react("⚠️");
	} finally {
		try {
			await rm(directory, { recursive: true, force: true });
		} catch (error) {
			Logger.error("rm -rf failed:", error);
		}

		if (notInDM) await message.reactions.cache.get("💭")?.remove();
	}
}

type FileProblems = { name: string, problems: string[], total: number };

function isExecException(error: unknown): error is ExecException & { stderr: string } {
	return error instanceof Error && typeof (error as ExecException).code === "number";
}

async function lintFile(zipPath: string): Promise<FileProblems[] | string> {
	try {
		const { stdout } = await exec(`dotnet run -c Release --no-build ${path.resolve(zipPath)}`, { cwd: tokens.repoLintPath });

		const files = [];
		let file: FileProblems | null = null;
		for (let line of stdout.split("\n")) {
			line = line.trimEnd();
			if (line === "")
				continue;

			if (!line.startsWith("    ")) {
				file = { name: line, problems: [], total: 0 };
				files.push(file);

				const match = /\((\d+) problems?\)$/.exec(line);
				if (match == null) {
					Logger.error("Unable to match problem count:", line);
					continue;
				}

				file.total += parseInt(match[1]);
			} else if (file !== null) {
				file.problems.push(line);
			}
		}

		return files;
	} catch (error) {
		// RepoLint will use error code 2 to represent an error with the user input.
		if (isExecException(error) && error.code == 2 && error.stderr !== "") {
			return error.stderr;
		}

		throw error;
	}
}

async function generateReport(message: Message, files: FileProblems[]): Promise<Message | null> {
	const total = files.map(problem => problem.total).reduce((a, b) => a + b, 0);
	if (total === 0) {
		return null;
	}

	const embed = new MessageEmbed()
		.setTitle("Linting Completed")
		.setDescription(`Found ${pluralize(total, "problem")} in ${pluralize(files.length, "file")}.`)
		.setColor(hsv2rgb((1 - Math.min(total, 15) / 15) * 120, 1, 1));

	for (let i = 0; i < Math.min(files.length, 25); i++) {
		const file = files[i];
		const field = { name: file.name, value: joinLimit(file.problems, "\n", 1024) };

		if (embed.length + field.name.length + field.value.length > 6000)
			break;

		embed.addField(field.name, field.value);
	}

	return await message.reply({ embeds: [embed] });
}