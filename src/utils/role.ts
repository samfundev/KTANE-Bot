import { Collection, Role, Snowflake } from "discord.js";
import Logger from "../log";

export function getRole(roleName: string | null, assignableData: Assignable[], guildRoles: Collection<string, Role>): { role: Role, roleData: Assignable } | null {
	const targetRole = roleName?.toLowerCase();
	for (const roleData of assignableData) {
		if (roleData.aliases.some(alias => alias.toLowerCase() == targetRole)) {
			const role = guildRoles.get(roleData.roleID);
			if (role == undefined) {
				Logger.error(`Unable to find role based on ID: ${roleData.roleID}`);
				return null;
			}

			return { role, roleData };
		}
	}

	return null;
}

export function shuffle<T>(a: T[]): T[] {
	let j, x, i;
	for (i = a.length - 1; i > 0; i--) {
		j = Math.floor(Math.random() * (i + 1));
		x = a[i];
		a[i] = a[j];
		a[j] = x;
	}
	return a;
}

export interface RoleArgument {
	role: string | null;
}

export interface Assignable {
	aliases: string[];
	roleID: Snowflake;
	prereq?: Snowflake[];
}