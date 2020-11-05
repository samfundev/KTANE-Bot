import { exec, ExecException } from "child_process";
import { AkairoClient } from "discord-akairo";
import { Message, MessageEmbed } from "discord.js";
import { createWriteStream, unlink } from "fs";
import got from "got";
import path from "path";
import stream from "stream";
import { promisify } from "util";
import { update } from "./bot-utils";
import tokens from "./get-tokens";
import Logger from "./log";
import TaskManager from "./task-manager";

const pipeline = promisify(stream.pipeline);

function pluralize(count: number, noun: string) {
	return `${count} ${noun}${count !== 0 ? "s" : ""}`;
}

// https://stackoverflow.com/a/54024653
// input: h in [0,360] and s,v in [0,1] - output: r,g,b in [0,255]
function hsv2rgb(h: number, s: number, v: number): [number, number, number] {
	const f = (n: number, k=(n+h/60)%6) => v - v*s*Math.max( Math.min(k,4-k,1), 0);
	return [f(5) * 255, f(3) * 255, f(1) * 255];
}

export default async function lintMessage(message: Message, client: AkairoClient): Promise<void> {
	const zip = Array.from(message.attachments.values()).find(attachment => attachment.name?.endsWith(".zip"));
	if (zip === undefined || zip.name === null)
		return;

	const fileName = message.id + ".zip";
	try {
		await pipeline(
			got.stream(zip.url),
			createWriteStream(fileName)
		);

		const report = await lintZip(message, fileName, zip.name);
		if (report === null)
			await message.react("👍");
		else if (message.guild !== null)
			await update<Record<string, string>>(client.settings, message.guild.id, "reportMessages", {}, (value) => {
				value[message.id] = report.id;
				return value;
			});
	} catch (error) {
		Logger.error("Linting failed. Error: ", error);
		TaskManager.sendOwnerMessage("An error ocurred while linting. Check the logs.");
	} finally {
		unlink(fileName, Logger.error);
	}
}

function lintZip(message: Message, zipPath: string, originalName: string): Promise<Message | null> {
	return new Promise((resolve, reject) => {
		exec(`dotnet run -c Release --no-build ${path.resolve(zipPath)}`, { cwd: tokens.repoLintPath }, (error: ExecException | null, stdout: string, stderr: string) => {
			if (error !== null || stderr !== "") {
				reject(error ?? stderr);
				return;
			}

			const files = [];
			let file: { name: string, problems: string[] } | null = null;
			for (const line of stdout.split("\n")) {
				if (line === "")
					continue;

				if (!line.startsWith("    ")) {
					file = { name: line, problems: [] };
					files.push(file);
				} else if (file !== null) {
					file.problems.push(line);
				}
			}

			const totalProblems = files.map(file => file.problems.length).reduce((a, b) => a + b, 0);

			if (totalProblems === 0)
			{
				resolve(null);
				return;
			}

			const embed = new MessageEmbed()
				.setTitle("Linting Completed")
				.setURL(message.url)
				.setDescription(`Found ${pluralize(totalProblems, "problem")} in ${pluralize(files.length, "file")}.`)
				.setFooter(originalName)
				.setColor(hsv2rgb((1 - Math.min(totalProblems, 15) / 15) * 120, 1, 1))
				.addFields(files.map(file => { return { name: file.name, value: file.problems.join("\n").substring(0, 1024) }; }));

			const report = message.channel.send(embed);
			resolve(report);
		});
	});
}
