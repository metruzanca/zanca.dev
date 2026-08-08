import { createCache, addRefreshLoop } from './cache';
import { slugify, setLivePosts, type BlogPost } from './blog';
import { estimateReadTime, type Block, type Inline } from './content';
import { atprotoHandle } from '../env';

const ATPROTO_REFRESH_MS = 60 * 60 * 1000;
const DOCUMENT_NSID = 'site.standard.document';

// ── Handle & PDS resolution (ports atcrab's handle.rs + did.rs) ──────

async function resolveHandle(handle: string): Promise<string | undefined> {
	try {
		const res = await fetch(`https://${handle}/.well-known/atproto-did`, {
			redirect: 'follow',
			signal: AbortSignal.timeout(10_000),
		});
		if (res.ok) {
			const did = (await res.text()).trim();
			if (did.startsWith('did:')) return did;
		}
	} catch {
		/* fall through to bsky resolver */
	}
	try {
		const res = await fetch(
			`https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`,
			{ signal: AbortSignal.timeout(10_000) }
		);
		if (res.ok) {
			const data = (await res.json()) as { did?: string };
			if (data.did) return data.did;
		}
	} catch {
		/* ignore */
	}
	return undefined;
}

async function resolvePds(did: string): Promise<string | undefined> {
	try {
		let doc: { service?: { type?: string; serviceEndpoint?: string }[] };
		if (did.startsWith('did:plc:')) {
			const res = await fetch(`https://plc.directory/${did}`, { signal: AbortSignal.timeout(10_000) });
			if (!res.ok) return undefined;
			doc = (await res.json()) as typeof doc;
		} else if (did.startsWith('did:web:')) {
			const domain = did.slice('did:web:'.length);
			const res = await fetch(`https://${domain}/.well-known/did.json`, { signal: AbortSignal.timeout(10_000) });
			if (!res.ok) return undefined;
			doc = (await res.json()) as typeof doc;
		} else {
			return undefined;
		}
		const pds = doc.service?.find((s) => s.type === 'AtprotoPersonalDataServer')?.serviceEndpoint;
		return pds?.replace(/\/+$/, '');
	} catch {
		return undefined;
	}
}

interface RecordValue {
	$type?: string;
	uri: string;
	cid: string;
	value: unknown;
}

async function fetchAllRecords(did: string, pds: string, collection: string): Promise<RecordValue[]> {
	const records: RecordValue[] = [];
	let cursor: string | undefined;
	for (;;) {
		const url = `${pds}/xrpc/com.atproto.repo.listRecords?repo=${encodeURIComponent(
			did
		)}&collection=${collection}&limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
		const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
		if (!res.ok) break;
		const page = (await res.json()) as { records?: RecordValue[]; cursor?: string };
		records.push(...(page.records ?? []));
		cursor = page.cursor;
		if (!cursor) break;
	}
	return records;
}

// ── ATProto block → Block conversion (ports blog/mod.rs live module) ─

function blocksToBody(
	content: unknown,
	textContent: string | undefined,
	did: string,
	pds: string
): Block[] {
	if (content === null || typeof content !== 'object') return [];

	const contentObj = content as Record<string, unknown>;
	const pages = Array.isArray(contentObj.pages) ? (contentObj.pages as Record<string, unknown>[]) : [];

	const blocks: Block[] = [];
	for (const page of pages) {
		const pageBlocks = Array.isArray(page.blocks) ? (page.blocks as Record<string, unknown>[]) : [];
		for (const blockValue of pageBlocks) {
			if (typeof blockValue !== 'object' || blockValue === null) continue;
			const block = (blockValue as Record<string, unknown>).block as Record<string, unknown> | undefined;
			if (!block) continue;
			const converted = atprotoBlock(block, did, pds);
			if (converted) blocks.push(converted);
		}
	}

	if (blocks.length === 0 && textContent) {
		blocks.push({ type: 'paragraph', children: [{ type: 'text', text: textContent }] });
	}

	return blocks;
}

function atprotoBlock(block: Record<string, unknown>, did: string, pds: string): Block | null {
	const blockType = typeof block.$type === 'string' ? block.$type : '';
	const plaintext = typeof block.plaintext === 'string' ? block.plaintext : '';

	// Image
	if (blockType.endsWith('.blocks.image')) {
		const image = block.image as Record<string, unknown> | undefined;
		const ref = image?.ref as Record<string, unknown> | undefined;
		const cid = typeof ref?.$link === 'string' ? ref.$link : undefined;
		if (!cid) return null;
		const alt = typeof block.alt === 'string' ? block.alt : '';
		return {
			type: 'paragraph',
			children: [{ type: 'image', alt, src: blobUrl(pds, did, cid) }],
		};
	}

	// Button
	if (blockType.endsWith('.blocks.button')) {
		const text = typeof block.text === 'string' ? block.text : plaintext;
		const url = typeof block.url === 'string' ? block.url : '';
		if (url.length === 0) {
			return { type: 'paragraph', children: applyFacetsToInlines(text, block.facets) };
		}
		return {
			type: 'paragraph',
			children: [{ type: 'link', url, children: [{ type: 'text', text }] }],
		};
	}

	// Header
	if (blockType.endsWith('.blocks.header')) {
		const level = typeof block.level === 'number' ? block.level : 1;
		return { type: 'heading', level, children: applyFacetsToInlines(plaintext, block.facets) };
	}

	// Text
	if (blockType.endsWith('.blocks.text')) {
		return { type: 'paragraph', children: applyFacetsToInlines(plaintext, block.facets) };
	}

	// Bullet / list item
	if (blockType.endsWith('.blocks.bullet') || blockType.endsWith('.blocks.list_item')) {
		return { type: 'unorderedList', items: [applyFacetsToInlines(plaintext, block.facets)] };
	}

	// Blockquote / quote
	if (blockType.endsWith('.blocks.blockquote') || blockType.endsWith('.blocks.quote')) {
		return { type: 'blockquote', children: [{ type: 'paragraph', children: applyFacetsToInlines(plaintext, block.facets) }] };
	}

	// Horizontal rule
	if (blockType.endsWith('.blocks.horizontalRule')) {
		return { type: 'thematicBreak' };
	}

	// Unordered / ordered list
	if (blockType.endsWith('.blocks.unorderedList') || blockType.endsWith('.blocks.orderedList')) {
		const numbered = blockType.endsWith('.blocks.orderedList');
		const children = Array.isArray(block.children) ? (block.children as Record<string, unknown>[]) : [];
		const items: Inline[][] = [];
		for (const child of children) {
			const content = child.content as Record<string, unknown> | undefined;
			if (!content) continue;
			const itemText = typeof content.plaintext === 'string' ? content.plaintext : '';
			const inlines = applyFacetsToInlines(itemText, content.facets);
			if (inlines.length > 0) items.push(inlines);
		}
		if (items.length === 0) return null;
		return numbered ? { type: 'orderedList', items } : { type: 'unorderedList', items };
	}

	// Fallback
	if (plaintext.length > 0) {
		return { type: 'paragraph', children: [{ type: 'text', text: plaintext }] };
	}
	return null;
}

function blobUrl(pds: string, did: string, cid: string): string {
	return `${pds.replace(/\/+$/, '')}/xrpc/com.atproto.sync.getBlob?did=${did}&cid=${cid}`;
}

function applyFacetsToInlines(text: string, facets: unknown): Inline[] {
	const facetList = Array.isArray(facets) ? (facets as Record<string, unknown>[]) : [];
	if (facetList.length === 0) return [{ type: 'text', text }];

	const sorted = [...facetList].sort((a, b) => {
		const aStart = (a.index as Record<string, unknown> | undefined)?.byteStart;
		const bStart = (b.index as Record<string, unknown> | undefined)?.byteStart;
		return (typeof aStart === 'number' ? aStart : 0) - (typeof bStart === 'number' ? bStart : 0);
	});

	const result: Inline[] = [];
	let lastEnd = 0;
	const textLen = text.length;

	for (const facet of sorted) {
		const index = facet.index as Record<string, unknown> | undefined;
		if (!index) continue;
		const byteStart = typeof index.byteStart === 'number' ? index.byteStart : 0;
		const byteEnd = typeof index.byteEnd === 'number' ? index.byteEnd : 0;
		const start = byteToUtf16(text, byteStart);
		const end = byteToUtf16(text, byteEnd);

		if (start >= textLen || end > textLen || start >= end) continue;

		const uri = Array.isArray(facet.features)
			? (facet.features as Record<string, unknown>[]).find((f) => typeof f.uri === 'string')?.uri
			: undefined;

		if (start > lastEnd) {
			const seg = text.slice(lastEnd, start);
			if (seg.length > 0) result.push({ type: 'text', text: seg });
		}

		const segment = text.slice(start, end);
		if (segment.length > 0) {
			if (typeof uri === 'string') {
				result.push({ type: 'link', url: uri, children: [{ type: 'text', text: segment }] });
			} else {
				result.push({ type: 'text', text: segment });
			}
		}

		lastEnd = end;
	}

	if (lastEnd < textLen) {
		const seg = text.slice(lastEnd);
		if (seg.length > 0) result.push({ type: 'text', text: seg });
	}

	return result;
}

function byteToUtf16(text: string, byteIndex: number): number {
	let bytes = 0;
	for (let i = 0; i < text.length; i++) {
		if (bytes >= byteIndex) return i;
		bytes += Buffer.byteLength(text[i]);
	}
	return text.length;
}

function documentToPost(
	doc: {
		title?: string;
		description?: string | null;
		publishedAt?: string;
		tags?: string[] | null;
		content?: unknown;
		textContent?: string | null;
		coverImage?: { blob?: { ref?: { $link?: string } } } | null;
	},
	did: string,
	pds: string
): BlogPost | null {
	if (typeof doc.title !== 'string' || doc.title.length === 0) return null;

	const body = blocksToBody(doc.content, doc.textContent ?? undefined, did, pds);

	if (doc.coverImage?.blob?.ref?.$link) {
		body.unshift({
			type: 'paragraph',
			children: [{ type: 'image', alt: doc.title, src: blobUrl(pds, did, doc.coverImage.blob.ref.$link) }],
		});
	}

	const title = doc.title;
	return {
		slug: slugify(title),
		frontmatter: {
			title,
			description: doc.description ?? '',
			canonical_url: '',
			timestamp: doc.publishedAt ?? '',
			publish: true,
			tags: doc.tags ?? [],
		},
		body,
		readTime: estimateReadTime(body),
	};
}

// ── Live refresh ─────────────────────────────────────────────────────

export async function fetchLivePosts(): Promise<BlogPost[]> {
	const handle = atprotoHandle();
	const did = await resolveHandle(handle);
	if (!did) return [];
	const pds = await resolvePds(did);
	if (!pds) return [];

	const records = await fetchAllRecords(did, pds, DOCUMENT_NSID);

	const posts: BlogPost[] = [];
	for (const record of records) {
		if (typeof record.value !== 'object' || record.value === null) continue;
		const post = documentToPost(record.value as Parameters<typeof documentToPost>[0], did, pds);
		if (post) posts.push(post);
	}

	return posts;
}

export const livePostsCache = createCache<BlogPost[]>({
	fetch: async () => {
		const posts = await fetchLivePosts();
		if (posts) setLivePosts(posts);
		return posts;
	},
});

addRefreshLoop({
	ttlMs: ATPROTO_REFRESH_MS,
	refresh: async () => {
		await livePostsCache.refresh();
	},
});
