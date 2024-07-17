import { ApplyOptions } from "@sapphire/decorators";
import { Args, Command } from "@sapphire/framework";
import tokens from "../../get-tokens.js";
import GuildMessage from "../../guild-message.js";
import { getRole, shuffle } from "#utils/role";

@ApplyOptions<Command.Options>({
	name: "who-has",
	aliases: ["whohasrole", "whr", "whohas", "wh", "who", "w"],
	description: "Lists of (at most 10) users who have the specified role.",
	runIn: "GUILD_ANY",
})
export class WhoHasRoleCommand extends Command {
	usage = "<role>";

	async messageRun(msg: GuildMessage, args: Args): Promise<void> {
		const roleString = await args.pick("string");
		const roleInf = getRole(roleString, tokens.roleIDs.assignable, msg.guild.roles.cache);
		if (roleInf === null) {
			await msg.reply("Unknown role.");
			return;
		}

		const { role } = roleInf;
		const members = shuffle(Array.from(role.members.values())).filter((_, index) => index < 10);
		await msg.channel.send(`Here is ${members.length} (of ${role.members.size}) users with the ${role.name} role:\n${members.map(member => ` - ${member.user.username}#${member.user.discriminator}`).join("\n")}`);
	}
}