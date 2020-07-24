import { Command, CommandoClient, CommandoMessage } from "discord.js-commando"
import { MessageEmbed } from "discord.js";
import { isModerator } from "bot-utils";

export = [
	class VoteCommand extends Command {
		constructor(client: CommandoClient) {
			super(client, {
				name: "vote",
				aliases: ["vote", "v"],
				group: "voting",
				memberName: "vote",
				description: "Submits a vote in a vote.",
				examples: ["vote 1 2 3", "v 1 2 3"],

				args: [
					{
						key: "vote",
						prompt: "What is your vote?",
						type: "integer",
						infinite: true
					}
				]
			});
		}

		hasPermission(msg: CommandoMessage) {
			if (msg.guild != null) {
				msg.delete();
				return "You must send the vote command in a DM.";
			}

			return true;
		}

		run(msg: CommandoMessage, args: { vote: number[] }) {
			const currentVote = msg.client.provider.get("global", "vote", null);
			if (currentVote == null) {
				return msg.reply("There is no vote running.");
			}

			if (currentVote.voted.includes(msg.author.id)) {
				return msg.reply("You have already voted.");
			}

			for (const option of args.vote) {
				if (option > currentVote.options.length || option < 1) {
					return msg.reply(`${option} is not a valid option.`);
				}
			}

			for (const option of args.vote) {
				currentVote.votes[option - 1]++;
			}

			currentVote.voted.push(msg.author.id);

			msg.client.provider.set("global", "vote", currentVote);

			return msg.reply(`Vote recorded! Voted for: ${args.vote.join(", ")}`);
		}
	},
	class CreateVoteCommand extends Command {
		constructor(client: CommandoClient) {
			super(client, {
				name: "createvote",
				aliases: ["createvote", "cv"],
				group: "voting",
				memberName: "createvote",
				description: "Creates a new vote.",
				examples: ["createvote \"Best option?\" \"Option 1\" Two Trois", "cv \"Best option?\" \"Option 1\" Two Trois"],

				args: [
					{
						key: "topic",
						prompt: "What's the topic of the vote?",
						type: "string"
					},
					{
						key: "options",
						prompt: "What are the options?",
						type: "string",
						infinite: true
					}
				]
			});
		}

		hasPermission(msg: CommandoMessage) {
			return isModerator(msg);
		}

		run(msg: CommandoMessage, args: { topic: string, options: string[] }) {
			const currentVote = msg.client.provider.get("global", "vote", null);
			if (currentVote != null) {
				return msg.reply("A vote is already running.");
			}

			msg.client.provider.set("global", "vote", {
				topic: args.topic,
				options: args.options,
				votes: new Array(args.options.length).fill(0),
				voted: []
			});

			return msg.channel.send("Vote created.")
		}
	},
	class EndVoteCommand extends Command {
		constructor(client: CommandoClient) {
			super(client, {
				name: "endvote",
				aliases: ["endvote", "ev"],
				group: "voting",
				memberName: "endvote",
				description: "Ends the current vote.",
				examples: ["endvote", "ev"]
			});
		}

		hasPermission(msg: CommandoMessage) {
			return isModerator(msg);
		}

		run(msg: CommandoMessage, args: string) {
			const currentVote = msg.client.provider.get("global", "vote", null);
			if (currentVote == null) {
				return msg.reply("There is no vote running.");
			}

			const totalVotes = currentVote.votes.reduce((a: number, b: number) => a + b, 0);
			const description = currentVote.options.map((option: string, index: number) => {
				const optionTotal = currentVote.votes[index];
				return `${index + 1}. ${option} - ${optionTotal} (${totalVotes == 0 ? 0 : Math.floor(optionTotal / totalVotes * 100)}%)`;
			}).join("\n");

			const embed = new MessageEmbed({
				title: `__${currentVote.topic}__`,
				description: `\`\`\`\n${description}\`\`\``,
				footer: {
					text: `Total votes: ${totalVotes} - Voters: ${currentVote.voted.length}`
				}
			});

			msg.client.provider.remove("global", "vote");
	
			embed.setColor("#00ff00");
	
			return msg.channel.send("", {
				disableMentions: "everyone",
				embed: embed
			});
		}
	},
];