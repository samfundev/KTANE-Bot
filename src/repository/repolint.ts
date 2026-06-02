import { ExecException } from "child_process";
import { Message, EmbedBuilder, ChannelType } from "discord.js";
import { createWriteStream } from "fs";
import got from "../utils/got-traces.js";
import path from "path";
import { pipeline } from "stream/promises";
import { joinLimit } from "../bot-utils.js";
import Logger from "../log.js";
import TaskManager from "../task-manager.js";
import { mkdir, readFile, rm } from "fs/promises";
import { settings } from "../db.js";
import { FileProblems, lintFiles } from "ktane-lint";
import _7z from '7zip-min';
import { mkdtemp } from 'fs/promises';

function pluralize(count: number, noun: string) {
	return `${count} ${noun}${count !== 1 ? "s" : ""}`;
}

// https://stackoverflow.com/a/54024653
// input: h in [0,360] and s,v in [0,1] - output: r,g,b in [0,255]
function hsv2rgb(h: number, s: number, v: number): [number, number, number] {
	const f = (n: number, k = (n + h / 60) % 6) =>
		v - v * s * Math.max(Math.min(k, 4 - k, 1), 0);
	return [f(5) * 255, f(3) * 255, f(1) * 255];
}

export default async function lintMessage(message: Message): Promise<void> {
	const extensions = [".zip", ".rar", ".7z", ".html", ".svg", ".json"];
	const files = Array.from(message.attachments.values()).filter(
		(file) =>
			file.name !== null &&
			extensions.some((extension) => file.name?.endsWith(extension)),
	);
	if (files.length === 0 || message.author.bot) return;

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
			await pipeline(got.stream(file.url), createWriteStream(filePath));

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

		if (report === null) await message.react("👍");
		else {
			const reportID = report.id;
			const id = message.guild !== null ? message.guild.id : message.channel.id;
			settings.write[id].reportMessages ??= {};
			settings.write[id].reportMessages[message.id] = reportID;
		}
	} catch (error) {
		Logger.error("Linting failed.", error);
		TaskManager.sendOwnerMessage(
			"An error ocurred while linting. Check the logs.",
		);

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

function isExecException(
	error: unknown,
): error is ExecException & { stderr: string } {
	return (
		error instanceof Error && typeof (error as ExecException).code === "number"
	);
}

async function lintFile(zipPath: string): Promise<FileProblems[] | string> {
	let files: Record<string, string> = {};
	try {
		const list = await _7z.list(zipPath);
		const total = list.reduce((total, file) => total + parseInt(file.size!), 0);
		if (total > 100000000) {
			return "The total size of the files in the archive must be less than 100 MB.";
		}

		const temp = await mkdtemp("lint-");
		await _7z.unpack(zipPath, temp);
		for (const file of list) {
			files[file.name] = await readFile(path.join(temp, file.name), "utf-8");
		}
	} catch (error) {
		// 7z will use error code 2 to represent an error with the user input.
		if (isExecException(error) && error.code == 2 && error.stderr.includes("Can not open the file as archive")) {
			files = {
				[path.basename(zipPath)]: await readFile(zipPath, "utf-8"),
			}
		} else {
			throw error;
		}
	}

	return lintFiles(files);
}

async function generateReport(
	message: Message,
	files: FileProblems[],
): Promise<Message | null> {
	const total = files
		.map((file) => file.count)
		.reduce((a, b) => a + b, 0);
	if (total === 0) {
		return null;
	}

	const embed = new EmbedBuilder()
		.setTitle("Linting Completed")
		.setDescription(
			`Found ${pluralize(total, "problem")} in ${pluralize(files.length, "file")}.`,
		)
		.setColor(hsv2rgb((1 - Math.min(total, 15) / 15) * 120, 1, 1));

	for (let i = 0; i < Math.min(files.length, 25); i++) {
		const file = files[i];
		const field = {
			name: file.name,
			value: joinLimit(file.problems.map(problem => `${problem.text} (${problem.rule})`), "\n", 1024),
		};

		if (embed.length + field.name.length + field.value.length > 6000) break;

		embed.addFields(field);
	}

	return await message.reply({ embeds: [embed] });
}
