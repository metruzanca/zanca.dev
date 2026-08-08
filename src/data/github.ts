import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCache, addRefreshLoop } from './cache';

export interface GithubRepo {
	name: string;
	description: string;
	url: string;
	homepage?: string;
	stars: number;
	commit_count: number;
	language?: string;
	language_color?: string;
	topics: string[];
	committed_date?: string;
}

export interface ContributionCell {
	level: number;
	count: number;
	date: string;
}

export interface GithubSnapshot {
	pinned: GithubRepo[];
	all: GithubRepo[];
	contributionTotal: number;
	contributionCells: ContributionCell[];
}

export const GITHUB_USERNAME = 'metruzanca';

const GITHUB_REFRESH_MS = 6 * 60 * 60 * 1000;

const QUERY = `query($login: String!) {
  user(login: $login) {
    pinnedItems(first: 6, types: REPOSITORY) {
      nodes {
        ... on Repository {
          name description url homepageUrl stargazerCount
          primaryLanguage { name color }
          repositoryTopics(first: 10) { nodes { topic { name } } }
          defaultBranchRef { target { ... on Commit { history { totalCount } } } }
        }
      }
    }
    repositories(first: 100, orderBy: { field: PUSHED_AT, direction: DESC }, affiliations: [OWNER]) {
      nodes {
        name description url homepageUrl stargazerCount
        primaryLanguage { name color }
        repositoryTopics(first: 10) { nodes { topic { name } } }
        defaultBranchRef { target { ... on Commit { committedDate history { totalCount } } } }
        isFork isPrivate
      }
    }
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { contributionCount date } }
      }
    }
  }
}`;

// ── Token resolution ─────────────────────────────────────────────────

export function getGithubToken(): string | undefined {
	const env = process.env.GITHUB_TOKEN?.trim();
	if (env && env.length > 0) return env;
	try {
		const out = execSync('gh auth token', { encoding: 'utf8' }).trim();
		if (out.length > 0) return out;
	} catch {
		/* gh not available */
	}
	return undefined;
}

// ── Snapshot (committed fallback, written by scripts/fetch-github.mjs) ─

function snapshotPath(): string {
	const candidates = [
		join(process.cwd(), 'data', 'github.snapshot.json'),
		join(process.cwd(), 'dist', 'data', 'github.snapshot.json'),
		fileURLToPath(new URL('../../data/github.snapshot.json', import.meta.url)),
	];
	for (const c of candidates) {
		if (existsSync(c)) return c;
	}
	return candidates[0];
}

function readSnapshot(): GithubSnapshot | undefined {
	try {
		return JSON.parse(readFileSync(snapshotPath(), 'utf8')) as GithubSnapshot;
	} catch {
		return undefined;
	}
}

// ── GraphQL fetch (ports build.rs) ───────────────────────────────────

interface GraphQLRepo {
	name: string;
	description: string | null;
	url: string;
	homepageUrl?: string | null;
	stargazerCount: number;
	primaryLanguage?: { name: string; color?: string | null } | null;
	repositoryTopics?: { nodes: { topic: { name: string } }[] } | null;
	defaultBranchRef?: { target?: { committedDate?: string | null; history: { totalCount: number } } } | null;
	isFork: boolean;
	isPrivate: boolean;
}

function graphqlToRepo(r: GraphQLRepo): GithubRepo {
	return {
		name: r.name,
		description: r.description ?? '',
		url: r.url,
		homepage: r.homepageUrl || undefined,
		stars: r.stargazerCount,
		commit_count: r.defaultBranchRef?.target?.history.totalCount ?? 0,
		language: r.primaryLanguage?.name ?? undefined,
		language_color: r.primaryLanguage?.color || undefined,
		topics: (r.repositoryTopics?.nodes ?? []).map((n) => n.topic.name),
		committed_date: r.defaultBranchRef?.target?.committedDate ?? undefined,
	};
}

function contributionLevel(count: number): number {
	if (count === 0) return 0;
	if (count <= 9) return 1;
	if (count <= 19) return 2;
	if (count <= 29) return 3;
	return 4;
}

function formatContributionDate(iso: string): string {
	if (iso.length < 10) return iso;
	const months = [
		'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
		'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
	];
	const month = months[parseInt(iso.slice(5, 7), 10) - 1] ?? '';
	const year = iso.slice(0, 4);
	const day = iso.slice(8, 10);
	return `${month} ${day}, ${year}`;
}

export async function fetchGithubSnapshot(): Promise<GithubSnapshot | undefined> {
	const token = getGithubToken();
	if (!token) return undefined;

	try {
		const res = await fetch('https://api.github.com/graphql', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${token}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ query: QUERY, variables: { login: GITHUB_USERNAME } }),
			signal: AbortSignal.timeout(20_000),
		});
		if (!res.ok) {
			console.error(`[github] GraphQL request failed: ${res.status}`);
			return undefined;
		}

		const json = (await res.json()) as {
			data?: {
				user?: {
					pinnedItems?: { nodes: GraphQLRepo[] };
					repositories?: { nodes: GraphQLRepo[] };
					contributionsCollection?: {
						contributionCalendar?: {
							totalContributions: number;
							weeks: { contributionDays: { contributionCount: number; date: string }[] }[];
						};
					};
				};
			};
		};

		const user = json.data?.user;
		if (!user) return undefined;

		const pinned = (user.pinnedItems?.nodes ?? []).map(graphqlToRepo);

		const all = (user.repositories?.nodes ?? [])
			.filter((r) => !r.isFork && !r.isPrivate && r.description)
			.map(graphqlToRepo);

		all.sort((a, b) => {
			if (a.committed_date && b.committed_date) return b.committed_date.localeCompare(a.committed_date);
			if (a.committed_date) return -1;
			if (b.committed_date) return 1;
			return a.name.localeCompare(b.name);
		});

		const cal = user.contributionsCollection?.contributionCalendar;
		const contributionTotal = cal?.totalContributions ?? 0;
		const contributionCells: ContributionCell[] = (cal?.weeks ?? [])
			.flatMap((w) => w.contributionDays)
			.map((d) => ({
				level: contributionLevel(d.contributionCount),
				count: d.contributionCount,
				date: formatContributionDate(d.date),
			}))
			.slice(0, 52 * 7);

		return { pinned, all, contributionTotal, contributionCells };
	} catch (err) {
		console.error('[github] fetch failed:', err);
		return undefined;
	}
}

// ── Cache ────────────────────────────────────────────────────────────

export const githubCache = createCache<GithubSnapshot>({
	initial: readSnapshot(),
	fetch: fetchGithubSnapshot,
});

addRefreshLoop({
	ttlMs: GITHUB_REFRESH_MS,
	refresh: async () => {
		await githubCache.refresh();
	},
});
