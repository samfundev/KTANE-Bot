// All of these are in minutes.
const durations: {[index: string]: number} = {
	h: 60,
	d: 1440,
	w: 10080,
	m: 43830,
};

export function formatDuration(number: number): string {
	for (const [short, length] of Object.entries(durations).reverse()) {
		if (length <= number) {
			return (number / length).toFixed(1) + short;
		}
	}

	return `${number}m`;
}

export function parseDuration(duration: string): number | null {
	if (duration == null)
		return null;

	const matches = /(\d+(?:\.\d+)?)([a-z])/.exec(duration);
	if (matches == null || !Object.prototype.hasOwnProperty.call(durations, matches[2]))
		return null;

	return 1000 * 60 * durations[matches[2]] * parseFloat(matches[1]);
}