import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfm } from 'micromark-extension-gfm';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import type { Root, Node } from 'mdast';
import { createHighlighter } from 'shiki';
import type { Highlighter } from 'shiki';
import base16OceanDark from '../themes/base16-ocean-dark.json';

// ── Inline content types ─────────────────────────────────────────────

export type Inline =
	| { type: 'text'; text: string }
	| { type: 'strong'; children: Inline[] }
	| { type: 'emphasis'; children: Inline[] }
	| { type: 'inlineCode'; code: string }
	| { type: 'link'; url: string; children: Inline[] }
	| { type: 'image'; alt: string; src: string }
	| { type: 'lineBreak' };

// ── Block-level content types ────────────────────────────────────────

export type Block =
	| { type: 'heading'; level: number; children: Inline[] }
	| { type: 'paragraph'; children: Inline[] }
	| { type: 'code'; language: string; code: string }
	| { type: 'unorderedList'; items: Inline[][] }
	| { type: 'orderedList'; items: Inline[][] }
	| { type: 'blockquote'; children: Block[] }
	| { type: 'thematicBreak' }
	| { type: 'raw'; raw: string };

// ── mdast conversion (markdown source files) ─────────────────────────

type MdastNode = Node;

export function fromMdast(root: Root | MdastNode): Block[] {
	if (root.type === 'root') {
		return (root as Root).children.map(blockFromMdast).filter((b): b is Block => b !== null);
	}
	const block = blockFromMdast(root as MdastNode);
	return block ? [block] : [];
}

function blocksFromMdast(nodes: MdastNode[]): Block[] {
	return nodes.map(blockFromMdast).filter((b): b is Block => b !== null);
}

function blockFromMdast(node: MdastNode): Block | null {
	switch (node.type) {
		case 'heading': {
			const depth = (node as { depth?: number }).depth ?? 1;
			return { type: 'heading', level: depth, children: inlinesFromNodes((node as { children?: MdastNode[] }).children ?? []) };
		}
		case 'paragraph':
			return { type: 'paragraph', children: inlinesFromNodes((node as { children?: MdastNode[] }).children ?? []) };
		case 'code': {
			const n = node as { lang?: string | null; value?: string };
			return { type: 'code', language: n.lang ?? '', code: n.value ?? '' };
		}
		case 'thematicBreak':
			return { type: 'thematicBreak' };
		case 'blockquote': {
			const children = blocksFromMdast((node as { children?: MdastNode[] }).children ?? []);
			if (children.length === 0) return null;
			return { type: 'blockquote', children };
		}
		case 'list': {
			const list = node as { ordered?: boolean; children?: MdastNode[] };
			const items = (list.children ?? [])
				.map((child) => {
					if (child.type !== 'listItem') return null;
					const inlines = inlinesFromNodes((child as { children?: MdastNode[] }).children ?? []);
					return inlines.length === 0 ? null : inlines;
				})
				.filter((i): i is Inline[] => i !== null);
			if (items.length === 0) return null;
			return list.ordered ? { type: 'orderedList', items } : { type: 'unorderedList', items };
		}
		case 'html':
			return { type: 'raw', raw: (node as { value?: string }).value ?? '' };
		default:
			return null;
	}
}

function inlinesFromNodes(nodes: MdastNode[]): Inline[] {
	return nodes.map(inlineFromMdast).filter((i): i is Inline => i !== null);
}

function inlineFromMdast(node: MdastNode): Inline | null {
	switch (node.type) {
		case 'text':
			return { type: 'text', text: (node as { value?: string }).value ?? '' };
		case 'strong':
			return { type: 'strong', children: inlinesFromNodes((node as { children?: MdastNode[] }).children ?? []) };
		case 'emphasis':
			return { type: 'emphasis', children: inlinesFromNodes((node as { children?: MdastNode[] }).children ?? []) };
		case 'inlineCode':
			return { type: 'inlineCode', code: (node as { value?: string }).value ?? '' };
		case 'link':
			return {
				type: 'link',
				url: (node as { url?: string }).url ?? '',
				children: inlinesFromNodes((node as { children?: MdastNode[] }).children ?? []),
			};
		case 'image':
			return {
				type: 'image',
				alt: (node as { alt?: string }).alt ?? '',
				src: (node as { url?: string }).url ?? '',
			};
		case 'break':
			return { type: 'lineBreak' };
		case 'delete':
			return { type: 'strong', children: inlinesFromNodes((node as { children?: MdastNode[] }).children ?? []) };
		default:
			return null;
	}
}

export function parseMarkdownToBlocks(markdown: string): Block[] {
	const root = fromMarkdown(markdown, {
		extensions: [gfm()],
		mdastExtensions: [gfmFromMarkdown()],
	});
	return fromMdast(root);
}

// ── Syntax highlighting ──────────────────────────────────────────────

let highlighterPromise: Promise<Highlighter> | null = null;

function getHighlighter(): Promise<Highlighter> {
	if (!highlighterPromise) {
		highlighterPromise = createHighlighter({
			themes: [base16OceanDark as any],
			langs: ['*'],
		});
	}
	return highlighterPromise;
}

// ── HTML rendering ───────────────────────────────────────────────────

export async function renderBlocks(blocks: Block[], assetPrefix: string): Promise<string> {
	let html = '';
	for (const block of blocks) {
		switch (block.type) {
			case 'heading': {
				const inner = await renderInlines(block.children, assetPrefix);
				html += `<h${block.level}>${inner}</h${block.level}>\n`;
				break;
			}
			case 'paragraph': {
				const inner = await renderInlines(block.children, assetPrefix);
				html += `<p>${inner}</p>\n`;
				break;
			}
			case 'code':
				html += (await renderCodeBlock(block.language, block.code)) + '\n';
				break;
			case 'unorderedList': {
				html += '<ul>\n';
				for (const item of block.items) {
					html += `<li>${await renderInlines(item, assetPrefix)}</li>\n`;
				}
				html += '</ul>\n';
				break;
			}
			case 'orderedList': {
				html += '<ol>\n';
				for (const item of block.items) {
					html += `<li>${await renderInlines(item, assetPrefix)}</li>\n`;
				}
				html += '</ol>\n';
				break;
			}
			case 'blockquote': {
				const inner = await renderBlocks(block.children, assetPrefix);
				html += `<blockquote>\n${inner}</blockquote>\n`;
				break;
			}
			case 'thematicBreak':
				html += '<hr>\n';
				break;
			case 'raw':
				html += block.raw + '\n';
				break;
		}
	}
	return html;
}

async function renderInlines(inlines: Inline[], assetPrefix: string): Promise<string> {
	let out = '';
	for (const inline of inlines) {
		switch (inline.type) {
			case 'text':
				out += htmlEscape(inline.text);
				break;
			case 'strong':
				out += `<strong>${await renderInlines(inline.children, assetPrefix)}</strong>`;
				break;
			case 'emphasis':
				out += `<em>${await renderInlines(inline.children, assetPrefix)}</em>`;
				break;
			case 'inlineCode':
				out += `<code>${htmlEscape(inline.code)}</code>`;
				break;
			case 'link': {
				const inner = await renderInlines(inline.children, assetPrefix);
				out += `<a href="${htmlEscape(inline.url)}">${inner}</a>`;
				break;
			}
			case 'image': {
				const rewritten = rewriteImageSrc(inline.src, assetPrefix);
				out += `<img src="${htmlEscape(rewritten)}" alt="${htmlEscape(inline.alt)}" />`;
				break;
			}
			case 'lineBreak':
				out += '<br>\n';
				break;
		}
	}
	return out;
}

async function renderCodeBlock(language: string, code: string): Promise<string> {
	let highlighted: string;
	try {
		const highlighter = await getHighlighter();
		highlighted = highlighter.codeToHtml(code, {
			lang: language || 'plaintext',
			theme: 'base16-ocean-dark',
		});
		// Extract the inner <pre><code>...</code></pre> produced by shiki so it
		// matches the custom wrapper structure used by the site's prose CSS.
		const match = highlighted.match(/<pre[^>]*><code[^>]*>([\s\S]*)<\/code><\/pre>/);
		highlighted = match ? match[1] : highlighted;
	} catch {
		highlighted = htmlEscape(code);
	}

	const langLabel =
		language.length === 0
			? ''
			: `<div class="code-lang">${htmlEscape(language)}</div>`;

	if (language.length === 0 && highlighted === htmlEscape(code)) {
		return `<pre><code>${highlighted}</code></pre>`;
	}

	return `<div class="code-block-wrapper">${langLabel}<pre><code class="language-${htmlEscape(
		language
	)}">${highlighted}</code></pre></div>`;
}

function rewriteImageSrc(src: string, assetPrefix: string): string {
	if (src.startsWith('./_assets/')) {
		return `/assets/${assetPrefix}/${src.slice('./_assets/'.length)}`;
	}
	return src;
}

function htmlEscape(s: string): string {
	let out = '';
	for (const c of s) {
		switch (c) {
			case '<':
				out += '&lt;';
				break;
			case '>':
				out += '&gt;';
				break;
			case '&':
				out += '&amp;';
				break;
			case '"':
				out += '&quot;';
				break;
			case "'":
				out += '&#39;';
				break;
			default:
				out += c;
		}
	}
	return out;
}

// ── Plain text extraction (read time) ────────────────────────────────

export function blocksToPlainText(blocks: Block[]): string {
	let text = '';
	for (const block of blocks) {
		switch (block.type) {
			case 'heading':
			case 'paragraph':
				text += inlinesToPlainText(block.children) + ' ';
				break;
			case 'blockquote':
				text += blocksToPlainText(block.children) + ' ';
				break;
			case 'code':
				text += block.code + ' ';
				break;
			case 'unorderedList':
			case 'orderedList':
				for (const item of block.items) {
					text += inlinesToPlainText(item) + ' ';
				}
				break;
			default:
				break;
		}
	}
	return text;
}

function inlinesToPlainText(inlines: Inline[]): string {
	let text = '';
	for (const inline of inlines) {
		switch (inline.type) {
			case 'text':
			case 'inlineCode':
				text += inline.type === 'text' ? inline.text : inline.code;
				break;
			case 'strong':
			case 'emphasis':
			case 'link':
				text += inlinesToPlainText(inline.children);
				break;
			case 'image':
				text += inline.alt;
				break;
			case 'lineBreak':
				text += ' ';
				break;
		}
	}
	return text;
}

export function estimateReadTime(blocks: Block[]): number {
	const words = blocksToPlainText(blocks);
	return Math.max(1, Math.floor(words.split(/\s+/).filter((w) => w.length > 0).length / 200));
}
