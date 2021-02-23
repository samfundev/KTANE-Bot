declare module "langs" {
	export function all(): Language[];

	export class Language {
		name: string;
		local: string;
		"1": string;
		"2": string;
		"2T": string;
		"2B": string;
		"3": string;
	}
}