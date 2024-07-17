import { Argument } from "@sapphire/framework";
import { parseDuration } from "../duration.js";

export class DurationArgument extends Argument<number> {
	public run(parameter: string): Argument.Result<number> {
		const duration = parseDuration(parameter);
		if (duration === null) return this.error({ parameter, message: "The provided argument could not resolved to a duration." });

		return this.ok(duration);
	}
}

declare module "@sapphire/framework" {
	interface ArgType {
		duration: number;
	}
}