#!/usr/bin/env node
// Build-time GitHub data fetcher — ports build.rs's fetch_github_data().
// Writes data/github.snapshot.json which is committed and used as the
// server-start fallback. At runtime the server refreshes this data itself.
import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const USERNAME = 'metruzanca';
const OUT = join(process.cwd(), 'data', 'github.snapshot.json');

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

function getToken() {
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

function contributionLevel(count) {
	if (count === 0) return 0;
	if (count <= 9) return 1;
	if (count <= 19) return 2;
	if (count <= 29) return 3;
	return 4;
}

function formatContributionDate(iso) {
	if (iso.length < 10) return iso;
	const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const month = months[parseInt(iso.slice(5, 7), 10) - 1] ?? '';
	return `${month} ${iso.slice(8, 10)}, ${iso.slice(0, 4)}`;
}

function repo(r) {
	return {
		name: r.name,
		description: r.description ?? '',
		url: r.url,
		homepage: r.homepageUrl || undefined,
		stars: r.stargazerCount,
		commit_count: r.defaultBranchRef?.target?.history?.totalCount ?? 0,
		language: r.primaryLanguage?.name ?? undefined,
		language_color: r.primaryLanguage?.color || undefined,
		topics: (r.repositoryTopics?.nodes ?? []).map((n) => n.topic.name),
		committed_date: r.defaultBranchRef?.target?.committedDate ?? undefined,
	};
}

async function main() {
	const token = getToken();
	if (!token) {
		console.error('No GITHUB_TOKEN or gh auth available — skipping GitHub snapshot.');
		process.exit(0);
	}

	const res = await fetch('https://api.github.com/graphql', {
		method: 'POST',
		headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
		body: JSON.stringify({ query: QUERY, variables: { login: USERNAME } }),
	});
	if (!res.ok) {
		console.error(`GraphQL request failed: ${res.status} ${res.statusText}`);
		process.exit(1);
	}

	const json = await res.json();
	const user = json?.data?.user;
	if (!user) {
		console.error('No user data in GraphQL response');
		process.exit(1);
	}

	const pinned = (user.pinnedItems?.nodes ?? []).map(repo);

	const all = (user.repositories?.nodes ?? [])
		.filter((r) => !r.isFork && !r.isPrivate && r.description)
		.map(repo);
	all.sort((a, b) => {
		if (a.committed_date && b.committed_date) return b.committed_date.localeCompare(a.committed_date);
		if (a.committed_date) return -1;
		if (b.committed_date) return 1;
		return a.name.localeCompare(b.name);
	});

	const cal = user.contributionsCollection?.contributionCalendar;
	const contributionCells = (cal?.weeks ?? [])
		.flatMap((w) => w.contributionDays)
		.map((d) => ({
			level: contributionLevel(d.contributionCount),
			count: d.contributionCount,
			date: formatContributionDate(d.date),
		}))
		.slice(0, 52 * 7);

	const snapshot = {
		pinned,
		all,
		contributionTotal: cal?.totalContributions ?? 0,
		contributionCells,
	};

	mkdirSync(join(process.cwd(), 'data'), { recursive: true });
	writeFileSync(OUT, JSON.stringify(snapshot, null, 2) + '\n');
	console.log(`Wrote ${OUT} (${pinned.length} pinned, ${all.length} repos, ${snapshot.contributionTotal} contributions)`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
