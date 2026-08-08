import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as yaml from 'js-yaml';
import { parseMarkdownToBlocks, estimateReadTime, type Block } from './content';

export interface BlogFrontmatter {
	title: string;
	description: string;
	canonical_url: string;
	timestamp: string;
	publish: boolean;
	tags: string[];
}

export interface BlogPost {
	slug: string;
	frontmatter: BlogFrontmatter;
	body: Block[];
	readTime: number;
}

function contentDir(sub: string): string {
	const candidates = [
		join(process.cwd(), 'content', sub),
		join(process.cwd(), 'dist', 'content', sub),
		fileURLToPath(new URL(`../../content/${sub}`, import.meta.url)),
	];
	for (const c of candidates) {
		try {
			if (existsSync(c)) return c;
		} catch {
			/* ignore */
		}
	}
	return candidates[0];
}

export function slugify(s: string): string {
	return s
		.toLowerCase()
		.replace(/[^a-z0-9-]/g, '-')
		.split('-')
		.filter((p) => p.length > 0)
		.join('-');
}

function extractSlug(canonicalUrl: string): string {
	const trimmed = canonicalUrl.replace(/\/+$/, '');
	return trimmed.split('/').pop() || 'unknown';
}

function splitFrontmatter(raw: string): { frontmatter: string; body: string } | null {
	let content: string;
	if (raw.startsWith('---\n')) content = raw.slice(4);
	else if (raw.startsWith('---\r\n')) content = raw.slice(6);
	else return null;

	const end = content.indexOf('\n---');
	if (end === -1) return null;

	const frontmatter = content.slice(0, end);
	let rest = content.slice(end);
	rest = rest.startsWith('\n---') ? rest.slice(4) : rest;
	rest = rest.startsWith('\n') ? rest.slice(1) : rest;
	return { frontmatter, body: rest };
}

function parseBlogPost(filename: string, raw: string): BlogPost | null {
	const split = splitFrontmatter(raw);
	if (!split) return null;

	let frontmatter: Partial<BlogFrontmatter>;
	try {
		frontmatter = (yaml.load(split.frontmatter) as Partial<BlogFrontmatter>) ?? {};
	} catch {
		return null;
	}

	const canonicalUrl = frontmatter.canonical_url ?? '';
	const slug =
		canonicalUrl.length === 0
			? slugify(basename(filename, '.md'))
			: extractSlug(canonicalUrl);

	const body = parseMarkdownToBlocks(split.body);

	return {
		slug,
		frontmatter: {
			title: frontmatter.title ?? '',
			description: frontmatter.description ?? '',
			canonical_url: canonicalUrl,
			timestamp: frontmatter.timestamp ?? '',
			publish: frontmatter.publish ?? true,
			tags: frontmatter.tags ?? [],
		},
		body,
		readTime: estimateReadTime(body),
	};
}

function readLocalPosts(): BlogPost[] {
	const dir = contentDir('blog');
	let files: string[] = [];
	try {
		files = readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
	} catch {
		return [];
	}

	const posts: BlogPost[] = [];
	for (const file of files) {
		try {
			const raw = readFileSync(join(dir, file), 'utf8');
			const post = parseBlogPost(file, raw);
			if (post) posts.push(post);
		} catch {
			/* skip unreadable file */
		}
	}

	posts.sort((a, b) => b.frontmatter.timestamp.localeCompare(a.frontmatter.timestamp));
	const seen = new Set<string>();
	return posts.filter((p) => {
		if (seen.has(p.slug)) return false;
		seen.add(p.slug);
		return true;
	});
}

let localPosts: BlogPost[] | null = null;

export function getLocalPosts(): BlogPost[] {
	if (!localPosts) localPosts = readLocalPosts();
	return localPosts;
}

// Live (ATProto) posts are injected by the refresh scheduler. Set by src/data/atproto.ts.
let livePosts: BlogPost[] = [];

export function setLivePosts(posts: BlogPost[]) {
	livePosts = posts;
}

export function publishedPosts(): BlogPost[] {
	return getLocalPosts().filter((p) => p.frontmatter.publish);
}

export function postBySlug(slug: string): BlogPost | undefined {
	return getMergedPosts().find((p) => p.slug === slug);
}

export function getMergedPosts(): BlogPost[] {
	const published = getLocalPosts().filter((p) => p.frontmatter.publish);
	const all = [...published];
	for (const live of livePosts) {
		const pos = all.findIndex((p) => p.slug === live.slug);
		if (pos !== -1) all[pos] = live;
		else all.push(live);
	}
	all.sort((a, b) => b.frontmatter.timestamp.localeCompare(a.frontmatter.timestamp));
	return all;
}

export function allTags(): [string, number][] {
	const counts = new Map<string, number>();
	for (const post of publishedPosts()) {
		for (const tag of post.frontmatter.tags) {
			counts.set(tag, (counts.get(tag) ?? 0) + 1);
		}
	}
	return [...counts.entries()];
}
