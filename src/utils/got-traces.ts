import got from "got";

// Enables detailed async stack traces for got
// https://github.com/sindresorhus/got/blob/main/documentation/async-stack-traces.md#conclusion
export default got.extend({
	handlers: [
		(options, next) => {
			options.context = { stack: new Error().stack };
			return next(options);
		}
	],
	hooks: {
		beforeError: [
			error => {
				// eslint-disable-next-line @typescript-eslint/ban-ts-comment
				// @ts-ignore
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
				error.source = error.options.context.stack.split("\n");
				return error;
			}
		]
	}
});