import { createHash } from "crypto";
import { AkairoClient } from "discord-akairo";
import { Message, MessageEmbed, Snowflake } from "discord.js";
import { joinLimit } from "./bot-utils";
import { compareLanguage } from "./language";
import Logger from "./log";

export class LFG {
	static client: AkairoClient;
	static players: Player[];

	static loadPlayers(): void {
		this.players = this.client.settings.get("global", "lfg_players", []).map(Player.fromData);
	}

	static async savePlayers(): Promise<void> {
		await this.client.settings.set("global", "lfg_players", this.players);
	}

	static join(user: Snowflake, games: Game[]): void {
		const oldPlayer = this.players.find(player => player.user == user);
		if (oldPlayer === undefined) {
			const newPlayers = this.players.filter(player => player.user != user);
			newPlayers.push(new Player(user, games));
			this.players = newPlayers;
		} else {
			oldPlayer.games = games;
		}

		this.updateMessages().catch(Logger.errorPrefix("Failed to update LFG messages:"));
	}

	static leave(user: Snowflake): void {
		this.players = this.players.filter(player => player.user != user);
		this.updateMessages().catch(Logger.errorPrefix("Failed to update LFG messages:"));
	}

	static async invite(message: Message, playerNumbers: number[]): Promise<void> {
		const player = this.players.find(player => player.user == message.author.id);
		if (player == undefined) {
			await message.reply("You need to run `!lfg join` first.");
			return;
		}

		const matched = this.players.filter(otherPlayer => player.matches(otherPlayer, this.client));
		if (matched.length == 0) {
			await message.reply("Wait for another player to matched up with you.");
			return;
		}

		if (playerNumbers.some(number => number < 1 || number > matched.length)) {
			await message.reply(`Players should by specified by a number between 1-${matched.length}.`);
			return;
		}

		const ids = [];
		for (const number of playerNumbers) {
			const id = matched[number - 1].user;
			const user = await this.client.users.fetch(id);
			await user.send(`<@${message.author.id}> wants to play with you!`);

			ids.push(id);
		}

		await message.reply(`Invited ${ids.map(id => `<@${id}>`).join(", ")}.`);
	}

	static async updateMessages(): Promise<void> {
		for (const player of this.players) {
			const matched = this.players.filter(otherPlayer => player.matches(otherPlayer, this.client));
			const hasMatch = matched.length > 0;

			const embed = new MessageEmbed({
				title: hasMatch ? "Found a Game!" : "Looking for a Game...",
				footer: {
					text: "Use `!lfg leave` when you're done." + (hasMatch ? " Use `!lfg invite 1 3 5` to send an invite to those numbered users." : "")
				}
			});

			if (hasMatch) embed.addField("Players:", joinLimit(matched.map(match => `<@${match.user}> - ${match.getQuery()}`), "\n", 1024));
			embed.addField("Query:", player.getQuery());

			embed.setColor(hasMatch ? "GREEN" : "RED");

			// To prevent us from sending the embed to the user, we hash it and compare it to the hash of the last embed we sent.
			const embedHash = createHash("md5").update(JSON.stringify(embed.toJSON())).digest("hex");
			if (embedHash == player.hash)
				continue;

			const user = await this.client.users.fetch(player.user);
			if (player.message != null && user.dmChannel != null) {
				const oldMessage = await user.dmChannel.messages.fetch(player.message);
				const response = await oldMessage.delete().catch(() => null);

				// If we failed to delete a message we sent to a user, they're probably not accepting DMs. Let's just remove them from LFG.
				if (response == null) {
					LFG.leave(player.user);
					continue;
				}
			}

			const message = await user.send(embed).catch(() => null);

			// Or if we failed to send a message to a user, they're also probably not accepting DMs.
			if (message === null) {
				LFG.leave(player.user);
				continue;
			}

			player.message = message.id;
			player.hash = embedHash;
		}

		await this.savePlayers();
	}
}

class Player {
	user: Snowflake;
	games: Game[];
	message: Snowflake | null;
	hash: string | null;

	constructor(user: Snowflake, games: Game[]) {
		this.user = user;
		this.games = games;
		this.message = null;
		this.hash = null;
	}

	matches(otherPlayer: Player, client: AkairoClient): boolean {
		/* Check that:
		1. They aren't the same player.
		2. They speak a language in common.
		3. They have a game they both want to play. */
		return this.user != otherPlayer.user &&
			compareLanguage(this.user, otherPlayer.user, client) &&
			this.games.some(game => otherPlayer.games.some(otherGame => game.matches(otherGame)));
	}

	static fromData(data: any): Player {
		const player = new Player(data.user, data.games.map(Game.fromData));
		player.message = data.message;
		player.hash = data.hash;
		return player;
	}

	getQuery(): string {
		return this.games.map(game => game.stringify()).join("; ");
	}
}

export class Game {
	name: string;
	tags: string[];

	constructor(name: string) {
		this.name = name;
		this.tags = [];
	}

	matches(otherGame: Game): boolean {
		if (this.name != otherGame.name)
			return false;

		return this.compareTags(otherGame.tags) && otherGame.compareTags(this.tags);
	}

	compareTags(otherTags: string[]): boolean {
		for (const tag of this.tags) {
			const otherHasTag = otherTags.includes(tag);

			// Don't match with people who have explicitly specified the opposite tag.
			if (tag == "modded" || tag == "vanilla")
				return !otherTags.includes(tag == "modded" ? "vanilla" : "modded");

			// Don't match with people who explicitly don't want mixed.
			if (tag == "mixed")
				return !otherTags.includes("modded") && !otherTags.includes("vanilla");

			// If a user marks them self as a defuser or expert, don't match them with people the same role.
			if ((tag == "defuser" || tag == "expert") && otherHasTag)
				return false;

			// Otherwise, just if the tag isn't present with the other game.
			if (!otherHasTag)
				return false;
		}

		return true;
	}

	stringify(): string {
		return this.tags.length == 0 ? this.name : `${this.name}: ${this.tags.join(", ")}`;
	}

	static fromData(data: any): Game {
		const game = new Game(data.name);
		game.tags = data.tags;
		return game;
	}
}

export class QueryParser {
	static parse(query: string): Game[] | string {
		const games: Game[] = [];
		let currentGame;
		for (const tag of query.toLowerCase().split(" ")) {
			if (tag === "")
				continue;

			const gameTag = this.normalize(tag, this.games);
			if (gameTag != null) {
				currentGame = new Game(gameTag);
				games.push(currentGame);
				continue;
			}

			const normalTag = this.normalize(tag, this.tags);
			if (normalTag != null) {
				if (currentGame == null) {
					return "You must specify a game before giving it tags.";
				}

				currentGame.tags.push(normalTag);
				continue;
			}

			return `${tag} is an unknown tag.`;
		}

		if (games.length == 0) {
			return "You must specify a game.";
		}

		return games;
	}

	static normalize(tag: string, tags: string[][]): string | null {
		for (const aliases of tags) {
			if (aliases.includes(tag)) {
				return aliases[0];
			}
		}

		return null;
	}

	static stringify(tags: string[][]): string {
		return tags.map(aliases => aliases.length == 1 ? aliases[0] : `${aliases[0]} (${aliases.slice(1).join(" ")})`).join(", ");
	}

	static games: string[][] = [
		["keep_talking_and_nobody_explodes", "ktane"],
		["overwatch", "ow"],
		["challenge_and_contact", "challenge_&_contact", "cac", "c&c"],
		["table_top_simulator", "tts"],
		["mao"],
		["tac"],
		["social_deduction", "secret_role", "sd", "sr"],
		["secret_hitler", "sh"],
		["among_us", "au"],
		["mafia", "maf"],
		["town_of_salem", "tos"],
		["betrayal_at_the_house_on_the_hill", "bhh"],
		["team_fortress_2", "tf2"],
		["teeworlds", "tw"],
	];
	static tags: string[][] = [
		["vanilla", "van"],
		["modded", "mod"],
		["mixed", "mix"],
		["defuser", "def"],
		["expert", "exp"]
	];
}