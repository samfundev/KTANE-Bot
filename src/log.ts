const { inspect } = require("util");

const levels: { [level: string]: any } = {
	info: console.log,
	error: console.error,
	warn: console.warn,
};

const logger = {
	log: (level = "log", ...data: any[]) => {
		const logMessage = `[${new Date().toISOString()}] [${level}] ${data.map(data => typeof data == "string" ? data : inspect(data)).join(" ")}`;

		levels[level](logMessage);
	 },
	 info: function(...data: any[]) { logger.log("info", ...data); },
	 error: function(...data: any[]) { logger.log("error", ...data); },
	 warn: function(...data: any[]) { logger.log("warn", ...data); }
};

export default logger;