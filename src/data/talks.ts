import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as yaml from 'js-yaml';
import { parseMarkdownToBlocks, type Block } from './content';
import { slugify } from './blog';
import { todayInZone } from '../utils/datetime';

export interface TalkFrontmatter {
	title: string;
	event: string;
	event_url: string;
	date: string;
	timezone: string;
	location: string;
	venue: string;
	description: string;
	tags: string[];
}

export interface Talk {
	slug: string;
	frontmatter: TalkFrontmatter;
	body: Block[];
}

export type TalkStatus = 'upcoming' | 'today' | 'past';

const DEFAULT_TIMEZONE = 'UTC';

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

function parseTalk(filename: string, raw: string): Talk | null {
	const split = splitFrontmatter(raw);
	if (!split) return null;

	let fm: Partial<TalkFrontmatter> & { slug?: string };
	try {
		fm = (yaml.load(split.frontmatter) as Partial<TalkFrontmatter> & { slug?: string }) ?? {};
	} catch {
		return null;
	}

	const body = parseMarkdownToBlocks(split.body);
	const slug = fm.slug ? slugify(String(fm.slug)) : slugify(basename(filename, '.md'));

	return {
		slug,
		frontmatter: {
			title: fm.title ?? '',
			event: fm.event ?? '',
			event_url: fm.event_url ?? '',
			date: String(fm.date ?? ''),
			timezone: fm.timezone ?? DEFAULT_TIMEZONE,
			location: fm.location ?? '',
			venue: fm.venue ?? '',
			description: fm.description ?? '',
			tags: fm.tags ?? [],
		},
		body,
	};
}

let talks: Talk[] | null = null;

/** All talks, sorted soonest-first by date. */
export function allTalks(): Talk[] {
	if (talks) return talks;

	const dir = contentDir('talks');
	let files: string[] = [];
	try {
		files = readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
	} catch {
		talks = [];
		return talks;
	}

	const list: Talk[] = [];
	for (const file of files) {
		try {
			const raw = readFileSync(join(dir, file), 'utf8');
			const talk = parseTalk(file, raw);
			if (talk) list.push(talk);
		} catch {
			/* skip unreadable file */
		}
	}

	list.sort((a, b) => a.frontmatter.date.localeCompare(b.frontmatter.date));
	talks = list;
	return talks;
}

export function talkBySlug(slug: string): Talk | undefined {
	return allTalks().find((t) => t.slug === slug);
}

/**
 * Derived on every call rather than stored, so the status flips by itself
 * when the calendar day in the talk's timezone changes. The site renders
 * per request, so no rebuild or content edit is needed.
 */
export function talkStatus(talk: Talk): TalkStatus {
	const day = talk.frontmatter.date.split('T')[0] ?? '';
	const today = todayInZone(talk.frontmatter.timezone || DEFAULT_TIMEZONE);
	if (day.length === 0) return 'past';
	if (day === today) return 'today';
	return day > today ? 'upcoming' : 'past';
}

/** Today's talk plus all upcoming ones, soonest first. */
export function upcomingTalks(): Talk[] {
	return allTalks().filter((talk) => talkStatus(talk) !== 'past');
}

/** Past talks, most recent first. */
export function pastTalks(): Talk[] {
	return allTalks()
		.filter((talk) => talkStatus(talk) === 'past')
		.reverse();
}
