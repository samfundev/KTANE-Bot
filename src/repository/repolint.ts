import child_process, { ExecException } from "child_process";
import { container } from "@sapphire/framework";
import { Message, EmbedBuilder, ChannelType } from "discord.js";
import { createWriteStream } from "fs";
import got from "../utils/got-traces.js";
import path from "path";
import { pipeline } from "stream/promises";
import { promisify } from "util";
import { joinLimit, update } from "../bot-utils.js";
import tokens from "../get-tokens.js";
import Logger from "../log.js";
import TaskManager from "../task-manager.js";
import { mkdir, rm } from "fs/promises";

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

export default async function lintMessage(message: Message): Promise<void> {
	const extensions = [".zip", ".rar", ".7z", ".html", ".svg", ".json"];
	const files = Array.from(message.attachments.values()).filter(file => file.name !== null && extensions.some(extension => file.name?.endsWith(extension)));
	if (files.length === 0 || message.author.bot)
		return;

	const directory = `lint_${message.id}`;
	await mkdir(directory, { recursive: true });

	const notInDM = message.channel.type !== ChannelType.DM;
	if (notInDM) await message.react("💭");

	try {
		let report: Message | null = null;
		const results = [];
		for (const file of files) {
			if (file.name === null) continue;

			const filePath = path.join(directory, file.name);
			await pipeline(
				got.stream(file.url),
				createWriteStream(filePath)
			);

			const lintResult = await lintFile(filePath);
			if (typeof lintResult === "string") {
				// There was an error with the user's input.
				// Reporting partial results isn't currently supported.
				report = await message.reply(lintResult);
				break;
			} else {
				results.push(...lintResult);
			}
		}

		// If we got this far, we can generate the report for all the files.
		if (report === null) {
			report = await generateReport(message, results);
		}

		if (report === null)
			await message.react("👍");
		else {
			const reportID = report.id;
			await update<Record<string, string>>(container.db, message.guild !== null ? message.guild.id : message.channel.id, "reportMessages", {}, (value) => {
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

	const embed = new EmbedBuilder()
		.setTitle("Linting Completed")
		.setDescription(`Found ${pluralize(total, "problem")} in ${pluralize(files.length, "file")}.`)
		.setColor(hsv2rgb((1 - Math.min(total, 15) / 15) * 120, 1, 1));

	for (let i = 0; i < Math.min(files.length, 25); i++) {
		const file = files[i];
		const field = { name: file.name, value: joinLimit(file.problems, "\n", 1024) };

		if (embed.length + field.name.length + field.value.length > 6000)
			break;

		embed.addFields(field);
	}

	return await message.reply({ embeds: [embed] });
}