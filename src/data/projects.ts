import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as yaml from 'js-yaml';
import { parseMarkdownToBlocks, type Block } from './content';
import { slugify } from './blog';

export interface ProjectFrontmatter {
	title: string;
	company?: string;
	description: string;
	timestamp: string;
	tags: string[];
	github: string;
}

export interface ProjectPost {
	slug: string;
	frontmatter: ProjectFrontmatter;
	body: Block[];
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

function parseProjectPost(filename: string, raw: string): ProjectPost | null {
	const split = splitFrontmatter(raw);
	if (!split) return null;

	let fm: Partial<ProjectFrontmatter>;
	try {
		fm = (yaml.load(split.frontmatter) as Partial<ProjectFrontmatter>) ?? {};
	} catch {
		return null;
	}

	const body = parseMarkdownToBlocks(split.body);

	return {
		slug: slugify(basename(filename, '.md')),
		frontmatter: {
			title: fm.title ?? '',
			company: fm.company,
			description: fm.description ?? '',
			timestamp: fm.timestamp ?? '',
			tags: fm.tags ?? [],
			github: fm.github ?? '',
		},
		body,
	};
}

let projects: ProjectPost[] | null = null;

export function allProjects(): ProjectPost[] {
	if (projects) return projects;

	const dir = contentDir('projects');
	let files: string[] = [];
	try {
		files = readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
	} catch {
		projects = [];
		return projects;
	}

	const list: ProjectPost[] = [];
	for (const file of files) {
		try {
			const raw = readFileSync(join(dir, file), 'utf8');
			const post = parseProjectPost(file, raw);
			if (post) list.push(post);
		} catch {
			/* skip unreadable file */
		}
	}

	list.sort((a, b) => b.frontmatter.timestamp.localeCompare(a.frontmatter.timestamp));
	projects = list;
	return projects;
}

export function projectBySlug(slug: string): ProjectPost | undefined {
	return allProjects().find((p) => p.slug === slug);
}
