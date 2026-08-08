import { createCache, addRefreshLoop } from './cache';

const RESUME_URL =
	'https://gist.githubusercontent.com/metruzanca/751361e5ba58ad06f361ebd430ae6e10/raw/resume.json';
const RESUME_REFRESH_MS = 24 * 60 * 60 * 1000;

export interface ResumeData {
	basics: Basics;
	work: Work[];
	skills: Skill[];
}

export interface Basics {
	name: string;
	label: string;
	email: string;
	phone: string;
	url: string;
	location?: Location;
	profiles: Profile[];
}

export interface Location {
	city: string;
	countryCode: string;
	region: string;
}

export interface Profile {
	network: string;
	username: string;
	url: string;
}

export interface Work {
	name: string;
	position: string;
	startDate: string;
	endDate: string;
	url: string;
	location?: string;
	highlights: string[];
}

export interface Skill {
	name: string;
	keywords: string[];
}

export async function fetchResume(): Promise<ResumeData | undefined> {
	try {
		const res = await fetch(RESUME_URL, { signal: AbortSignal.timeout(15_000) });
		if (!res.ok) return undefined;
		const data = (await res.json()) as ResumeData;
		return {
			basics: data.basics ?? {},
			work: data.work ?? [],
			skills: data.skills ?? [],
		};
	} catch (err) {
		console.error('[resume] fetch failed:', err);
		return undefined;
	}
}

export const resumeCache = createCache<ResumeData>({
	fetch: fetchResume,
});

addRefreshLoop({
	ttlMs: RESUME_REFRESH_MS,
	refresh: async () => {
		await resumeCache.refresh();
	},
});
