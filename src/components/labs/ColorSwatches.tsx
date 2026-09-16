import { createEffect, createMemo, createSignal, onMount, Show } from 'solid-js';
import Button from '../ui/Button';

// ── Types ────────────────────────────────────────────────────────────────

interface RGB {
	r: number;
	g: number;
	b: number;
}

interface Group {
	id: string;
	name: string;
	colors: string[];
}

interface PersistState {
	history: string[];
	groups: Group[];
}

// ── Constants ────────────────────────────────────────────────────────────

const STORAGE_KEY = 'color-swatches:v2';
const LEGACY_STORAGE_KEY = 'color-swatches:v1';
const MAX_HISTORY = 50;
const FAVORITES_ID = 'favorites';
const ZANCA_DEV_ID = 'zanca-dev';
const HISTORY_DEBOUNCE_MS = 300;
const SAVE_DEBOUNCE_MS = 400;

const ZANCA_DEV_COLORS = [
	'#ff2fae', // primary / neon pink
	'#00e2ed', // accent / neon cyan
	'#9b61ea', // neon purple
	'#ff9c3b', // neon amber
	'#0c091f', // background
	'#f0ecfa', // foreground
	'#171330', // card
	'#f5184c', // destructive
];

// ── Color math ───────────────────────────────────────────────────────────

function clamp01(n: number): number {
	return Math.min(1, Math.max(0, n));
}

function hexToRgb(hex: string): RGB | null {
	let h = hex.trim().replace(/^#/, '');
	if (/^[0-9a-f]{6}$/i.test(h)) {
		return {
			r: parseInt(h.slice(0, 2), 16),
			g: parseInt(h.slice(2, 4), 16),
			b: parseInt(h.slice(4, 6), 16),
		};
	}
	if (/^[0-9a-f]{3}$/i.test(h)) {
		return {
			r: parseInt(h[0] + h[0], 16),
			g: parseInt(h[1] + h[1], 16),
			b: parseInt(h[2] + h[2], 16),
		};
	}
	return null;
}

function rgbToHex(rgb: RGB): string {
	const to = (n: number) =>
		Math.min(255, Math.max(0, Math.round(n)))
			.toString(16)
			.padStart(2, '0');
	return `#${to(rgb.r)}${to(rgb.g)}${to(rgb.b)}`;
}

function hueFromRgb(r: number, g: number, b: number, max: number, d: number): number {
	let h = 0;
	if (d !== 0) {
		switch (max) {
			case r:
				h = (g - b) / d + (g < b ? 6 : 0);
				break;
			case g:
				h = (b - r) / d + 2;
				break;
			default:
				h = (r - g) / d + 4;
		}
		h *= 60;
	}
	return Math.round(h);
}

function rgbToHsl(rgb: RGB): { h: number; s: number; l: number } {
	const r = rgb.r / 255;
	const g = rgb.g / 255;
	const b = rgb.b / 255;
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const l = (max + min) / 2;
	const d = max - min;
	let s = 0;
	if (d !== 0) {
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
	}
	return { h: hueFromRgb(r, g, b, max, d), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToRgb(h: number, s: number, l: number): RGB {
	const hh = (((h % 360) + 360) % 360) / 360;
	const ss = clamp01(s / 100);
	const ll = clamp01(l / 100);
	if (ss === 0) {
		const v = Math.round(ll * 255);
		return { r: v, g: v, b: v };
	}
	const hue2rgb = (p: number, q: number, t: number) => {
		if (t < 0) t += 1;
		if (t > 1) t -= 1;
		if (t < 1 / 6) return p + (q - p) * 6 * t;
		if (t < 1 / 2) return q;
		if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
		return p;
	};
	const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
	const p = 2 * ll - q;
	return {
		r: Math.round(hue2rgb(p, q, hh + 1 / 3) * 255),
		g: Math.round(hue2rgb(p, q, hh) * 255),
		b: Math.round(hue2rgb(p, q, hh - 1 / 3) * 255),
	};
}

function rgbToHsv(rgb: RGB): { h: number; s: number; v: number } {
	const r = rgb.r / 255;
	const g = rgb.g / 255;
	const b = rgb.b / 255;
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const d = max - min;
	const s = max === 0 ? 0 : d / max;
	return { h: hueFromRgb(r, g, b, max, d), s, v: max };
}

function hsvToRgb(h: number, s: number, v: number): RGB {
	const hh = (((h % 360) + 360) % 360) / 60;
	const ss = clamp01(s);
	const vv = clamp01(v);
	const c = vv * ss;
	const x = c * (1 - Math.abs((hh % 2) - 1));
	const m = vv - c;
	let r = 0;
	let g = 0;
	let b = 0;
	if (hh < 1) {
		r = c;
		g = x;
	} else if (hh < 2) {
		r = x;
		g = c;
	} else if (hh < 3) {
		g = c;
		b = x;
	} else if (hh < 4) {
		g = x;
		b = c;
	} else if (hh < 5) {
		r = x;
		b = c;
	} else {
		r = c;
		b = x;
	}
	return {
		r: Math.round((r + m) * 255),
		g: Math.round((g + m) * 255),
		b: Math.round((b + m) * 255),
	};
}

function rgbToHwb(rgb: RGB): { h: number; w: number; b: number } {
	const h = rgbToHsl(rgb).h;
	const r = rgb.r / 255;
	const g = rgb.g / 255;
	const b = rgb.b / 255;
	const min = Math.min(r, g, b);
	const max = Math.max(r, g, b);
	return { h, w: Math.round(min * 100), b: Math.round((1 - max) * 100) };
}

function hwbToRgb(h: number, w: number, b: number): RGB {
	let ww = clamp01(w / 100);
	let bb = clamp01(b / 100);
	const sum = ww + bb;
	if (sum > 1) {
		ww /= sum;
		bb /= sum;
	}
	const hue = hslToRgb(h, 100, 50);
	const hr = hue.r / 255;
	const hg = hue.g / 255;
	const hb = hue.b / 255;
	return {
		r: Math.round((hr * (1 - ww - bb) + ww) * 255),
		g: Math.round((hg * (1 - ww - bb) + ww) * 255),
		b: Math.round((hb * (1 - ww - bb) + ww) * 255),
	};
}

function formatRgbString(rgb: RGB): string {
	return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}

function formatHslString(hsl: { h: number; s: number; l: number }): string {
	return `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
}

function formatHwbString(hwb: { h: number; w: number; b: number }): string {
	return `hwb(${hwb.h} ${hwb.w}% ${hwb.b}%)`;
}

function isLight(hex: string): boolean {
	const rgb = hexToRgb(hex);
	if (!rgb) return true;
	return (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255 > 0.6;
}

// ── Format parsing ───────────────────────────────────────────────────────

function parseRgb(raw: string): RGB | null {
	const m = raw.match(/\d+/g);
	if (!m || m.length < 3) return null;
	const [r, g, b] = m.slice(0, 3).map((n) => parseInt(n, 10));
	if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
	if (r > 255 || g > 255 || b > 255) return null;
	return { r, g, b };
}

function parseHsl(raw: string): { h: number; s: number; l: number } | null {
	const m = raw.match(/-?\d+(?:\.\d+)?/g);
	if (!m || m.length < 3) return null;
	const [h, s, l] = m.slice(0, 3).map(Number);
	if (Number.isNaN(h) || Number.isNaN(s) || Number.isNaN(l)) return null;
	if (s < 0 || s > 100 || l < 0 || l > 100) return null;
	return { h, s, l };
}

function parseHwb(raw: string): { h: number; w: number; b: number } | null {
	const m = raw.match(/-?\d+(?:\.\d+)?/g);
	if (!m || m.length < 3) return null;
	const [h, w, b] = m.slice(0, 3).map(Number);
	if (Number.isNaN(h) || Number.isNaN(w) || Number.isNaN(b)) return null;
	if (w < 0 || w > 100 || b < 0 || b > 100) return null;
	return { h, w, b };
}

// ── Persistence / helpers ────────────────────────────────────────────────

function makeId(): string {
	try {
		return crypto.randomUUID();
	} catch {
		return Math.random().toString(36).slice(2) + Date.now().toString(36);
	}
}

function normalizeGroupName(name: string): string {
	return name.toLowerCase().replace(/[^a-z0-9_-]/g, '');
}

function normalizeGroups(raw: unknown): Group[] {
	let favorites: Group = { id: FAVORITES_ID, name: 'favorites', colors: [] };
	const others: Group[] = [];
	const seen = new Set<string>(['favorites']);
	if (Array.isArray(raw)) {
		for (const g of raw) {
			if (!g || typeof g !== 'object') continue;
			const group = g as Record<string, unknown>;
			if (!Array.isArray(group.colors)) continue;
			const colors = (group.colors as unknown[]).filter(
				(c): c is string => typeof c === 'string' && !!hexToRgb(c),
			);
			if (group.id === FAVORITES_ID) {
				favorites = { id: FAVORITES_ID, name: 'favorites', colors };
			} else if (typeof group.name === 'string') {
				const name = normalizeGroupName(group.name);
				if (name && !seen.has(name)) {
					seen.add(name);
					others.push({
						id: typeof group.id === 'string' && group.id ? group.id : makeId(),
						name,
						colors,
					});
				}
			}
		}
	}
	return [favorites, ...others];
}

function parseHistory(raw: unknown): string[] {
	return Array.isArray(raw)
		? (raw as unknown[]).filter((h): h is string => typeof h === 'string' && !!hexToRgb(h))
		: [];
}

function zancaDevGroup(): Group {
	return { id: ZANCA_DEV_ID, name: 'zanca-dev', colors: ZANCA_DEV_COLORS };
}

function defaultGroups(): Group[] {
	return [
		{ id: FAVORITES_ID, name: 'favorites', colors: [] },
		zancaDevGroup(),
	];
}

function ensureGroup(groups: Group[], group: Group): Group[] {
	return groups.some((g) => g.id === group.id) ? groups : [...groups, group];
}

function loadState(): PersistState {
	try {
		const current = localStorage.getItem(STORAGE_KEY);
		if (current) {
			const parsed = JSON.parse(current) as Record<string, unknown>;
			return { history: parseHistory(parsed.history), groups: normalizeGroups(parsed.groups) };
		}
		const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
		if (legacy) {
			const parsed = JSON.parse(legacy) as Record<string, unknown>;
			const groups = ensureGroup(normalizeGroups(parsed.groups), zancaDevGroup());
			return { history: parseHistory(parsed.history), groups };
		}
	} catch {
		// fall through to defaults
	}
	return { history: [], groups: defaultGroups() };
}

function parseShareParams(): { group: string; colors: string[] } {
	const params = new URLSearchParams(window.location.search);
	const colors: string[] = [];
	for (const raw of (params.get('c') ?? '').split(',')) {
		const hex = `#${raw.trim().replace(/^#/, '')}`;
		if (hexToRgb(hex) && !colors.includes(hex.toLowerCase())) colors.push(hex.toLowerCase());
	}
	return { group: (params.get('group') ?? '').trim(), colors };
}

// ── Small UI pieces ──────────────────────────────────────────────────────

function StarIcon(props: { filled: boolean; class?: string }) {
	return (
		<svg
			class={props.class}
			viewBox="0 0 24 24"
			fill={props.filled ? 'currentColor' : 'none'}
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
		</svg>
	);
}

function FormatField(props: {
	label: string;
	value: string;
	onCommit: (raw: string) => boolean;
	copied: boolean;
	onCopy: () => void;
}) {
	const [draft, setDraft] = createSignal(props.value);
	let editing = false;

	createEffect(() => {
		if (!editing) setDraft(props.value);
	});

	const commit = () => {
		if (editing) {
			props.onCommit(draft());
			setDraft(props.value);
			editing = false;
		}
	};

	return (
		<div class="flex items-center gap-2">
			<span class="w-10 shrink-0 font-mono text-[10px] font-semibold uppercase tracking-widest text-accent">
				{props.label}
			</span>
			<div class="relative flex-1">
				<input
					class="h-9 w-full rounded-md border border-input bg-background pr-16 pl-2.5 font-mono text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:shadow-glow-pink"
					value={draft()}
					spellcheck={false}
					onInput={(e) => {
						editing = true;
						setDraft(e.currentTarget.value);
					}}
					onBlur={commit}
					onKeyDown={(e) => {
						if (e.key === 'Enter') e.currentTarget.blur();
					}}
				/>
				<button
					type="button"
					class="absolute top-1/2 right-1 flex h-7 -translate-y-1/2 items-center rounded-md px-2 font-mono text-[10px] uppercase tracking-widest text-accent transition-colors hover:bg-muted hover:text-primary"
					onClick={props.onCopy}
				>
					{props.copied ? 'Copied' : 'Copy'}
				</button>
			</div>
		</div>
	);
}

function SvBox(props: {
	color: RGB;
	onSelect: (s: number, v: number) => void;
	onRelease: () => void;
}) {
	let ref: HTMLDivElement | undefined;
	let dragging = false;

	const hsv = createMemo(() => rgbToHsv(props.color));
	const hue = () => hsv().h;

	const update = (e: PointerEvent) => {
		const el = ref;
		if (!el) return;
		const rect = el.getBoundingClientRect();
		const x = clamp01((e.clientX - rect.left) / rect.width);
		const y = clamp01((e.clientY - rect.top) / rect.height);
		props.onSelect(x, 1 - y);
	};

	return (
		<div
			ref={ref}
			class="relative h-44 w-full cursor-crosshair touch-none select-none overflow-hidden rounded-lg border border-border"
			style={{
				background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, hsl(${hue()} 100% 50%), #fff)`,
			}}
			onPointerDown={(e) => {
				dragging = true;
				e.currentTarget.setPointerCapture(e.pointerId);
				update(e);
			}}
			onPointerMove={(e) => {
				if (dragging) update(e);
			}}
			onPointerUp={(e) => {
				dragging = false;
				try {
					e.currentTarget.releasePointerCapture(e.pointerId);
				} catch {
					// ignore
				}
				props.onRelease();
			}}
		>
			<div
				class="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md"
				style={{ left: `${hsv().s * 100}%`, top: `${(1 - hsv().v) * 100}%` }}
			/>
		</div>
	);
}

function HueSlider(props: { hue: number; onSelect: (h: number) => void; onRelease: () => void }) {
	let ref: HTMLDivElement | undefined;
	let dragging = false;

	const update = (e: PointerEvent) => {
		const el = ref;
		if (!el) return;
		const rect = el.getBoundingClientRect();
		const h = Math.round(clamp01((e.clientX - rect.left) / rect.width) * 360);
		props.onSelect(h);
	};

	return (
		<div
			ref={ref}
			class="relative h-4 w-full cursor-ew-resize touch-none select-none rounded-full border border-border"
			style={{
				background:
					'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
			}}
			onPointerDown={(e) => {
				dragging = true;
				e.currentTarget.setPointerCapture(e.pointerId);
				update(e);
			}}
			onPointerMove={(e) => {
				if (dragging) update(e);
			}}
			onPointerUp={(e) => {
				dragging = false;
				try {
					e.currentTarget.releasePointerCapture(e.pointerId);
				} catch {
					// ignore
				}
				props.onRelease();
			}}
		>
			<div
				class="pointer-events-none absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md"
				style={{ left: `${props.hue / 360 * 100}%` }}
			/>
		</div>
	);
}

function Swatch(props: {
	hex: string;
	favorite: boolean;
	onPick: () => void;
	onStar: () => void;
	onRemove?: () => void;
	onDragStart?: (e: DragEvent) => void;
	onDragEnd?: () => void;
}) {
	const text = () => (isLight(props.hex) ? 'text-[#16141c]' : 'text-white');

	return (
		<div
			class="group relative flex h-16 w-16 shrink-0 cursor-grab flex-col items-center justify-center rounded-lg border border-border/60 font-mono text-[9px] transition-transform select-none active:cursor-grabbing"
			style={{ 'background-color': props.hex }}
			draggable
			onDragStart={props.onDragStart}
			onDragEnd={props.onDragEnd}
			onClick={props.onPick}
			title={props.hex.toUpperCase()}
		>
			<span class={text()}>{props.hex.slice(1).toUpperCase()}</span>
			<div class="absolute right-0.5 top-0.5 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
				<button
					type="button"
					class="flex size-4 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm transition-colors hover:bg-black/50"
					aria-label={props.favorite ? 'Remove from favorites' : 'Add to favorites'}
					onClick={(e) => {
						e.stopPropagation();
						props.onStar();
					}}
				>
					<StarIcon filled={props.favorite} class="size-3" />
				</button>
			</div>
			<Show when={props.onRemove}>
				<div class="absolute bottom-0.5 right-0.5 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
					<button
						type="button"
						class="flex size-4 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm transition-colors hover:bg-black/50"
						aria-label="Remove from group"
						onClick={(e) => {
							e.stopPropagation();
							props.onRemove?.();
						}}
					>
						<svg class="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M18 6 6 18" />
							<path d="m6 6 12 12" />
						</svg>
					</button>
				</div>
			</Show>
		</div>
	);
}

function GroupCard(props: {
	group: Group;
	isProtected: boolean;
	isSelected: boolean;
	dragOver: boolean;
	favorites: Set<string>;
	onSelect: () => void;
	onDelete: () => void;
	onShare: () => void;
	onDrop: () => void;
	onDragOver: () => void;
	onDragLeave: () => void;
	onPick: (hex: string) => void;
	onRemoveColor: (hex: string) => void;
	onStar: (hex: string) => void;
	onSwatchDragStart: (hex: string) => (e: DragEvent) => void;
	onSwatchDragEnd: () => void;
}) {
	return (
		<div
			class={`rounded-xl border p-4 transition-colors ${
				props.isSelected ? 'border-accent/50 bg-card' : 'border-border bg-card'
			}`}
			onClick={props.onSelect}
		>
			<div class="mb-3 flex items-center gap-2">
				<span class="truncate font-display text-sm font-bold uppercase tracking-tight text-foreground">
					{props.group.name}
				</span>
				<span class="shrink-0 rounded-full border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
					{props.group.colors.length}
				</span>
				<div class="ml-auto flex shrink-0 items-center gap-1">
					<button
						type="button"
						class="flex h-6 items-center gap-1 rounded-md border border-border px-2 font-mono text-[10px] uppercase tracking-widest text-accent transition-colors hover:bg-muted"
						onClick={(e) => {
							e.stopPropagation();
							props.onShare();
						}}
					>
						Share
					</button>
					<Show when={!props.isProtected}>
						<button
							type="button"
							class="flex size-6 items-center justify-center rounded-md border border-border font-mono text-xs text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
							aria-label="Delete group"
							onClick={(e) => {
								e.stopPropagation();
								props.onDelete();
							}}
						>
							×
						</button>
					</Show>
				</div>
			</div>
			<div
				class={`flex min-h-[80px] flex-wrap gap-2 rounded-lg border border-dashed p-2 transition-colors ${
					props.dragOver ? 'border-accent/70 bg-accent/5' : 'border-border'
				}`}
				onDrop={(e) => {
					e.preventDefault();
					e.stopPropagation();
					props.onDrop();
				}}
				onDragOver={(e) => {
					e.preventDefault();
					e.stopPropagation();
					props.onDragOver();
				}}
				onDragLeave={props.onDragLeave}
			>
				{props.group.colors.map((hex) => (
					<Swatch
						hex={hex}
						favorite={props.favorites.has(hex)}
						onPick={() => props.onPick(hex)}
						onStar={() => props.onStar(hex)}
						onRemove={() => props.onRemoveColor(hex)}
						onDragStart={props.onSwatchDragStart(hex)}
						onDragEnd={props.onSwatchDragEnd}
					/>
				))}
				<Show when={props.group.colors.length === 0}>
					<div class="flex w-full items-center justify-center py-4 text-center font-mono text-xs text-muted-foreground">
						Drop colors here
					</div>
				</Show>
			</div>
		</div>
	);
}

// ── App ──────────────────────────────────────────────────────────────────

const ColorSwatches = () => {
	const [color, setColorSignal] = createSignal('#e45f9e');
	const [history, setHistory] = createSignal<string[]>([]);
	const [groups, setGroups] = createSignal<Group[]>([]);
	const [selectedGroup, setSelectedGroup] = createSignal<string>(FAVORITES_ID);
	const [dragging, setDragging] = createSignal<string | null>(null);
	const [dragOverId, setDragOverId] = createSignal<string | null>(null);
	const [newGroupName, setNewGroupName] = createSignal('');
	const [toast, setToast] = createSignal<string | null>(null);
	const [copied, setCopied] = createSignal<string | null>(null);
	const [ready, setReady] = createSignal(false);

	let toastTimer: number | undefined;
	let copiedTimer: number | undefined;
	let historyTimer: number | undefined;
	let saveTimer: number | undefined;

	const rgb = createMemo(() => hexToRgb(color()) ?? { r: 0, g: 0, b: 0 });
	const hsl = createMemo(() => rgbToHsl(rgb()));
	const hwb = createMemo(() => rgbToHwb(rgb()));
	const hsv = createMemo(() => rgbToHsv(rgb()));
	const favoritesSet = createMemo(
		() => new Set(groups().find((g) => g.id === FAVORITES_ID)?.colors ?? []),
	);

	const setColorPreview = (hex: string): string | null => {
		const norm = hexToRgb(hex) ? hex : null;
		if (norm) setColorSignal(norm);
		return norm;
	};

	const pushHistory = (norm: string) => {
		setHistory((h) => {
			if (h[h.length - 1] === norm) return h;
			const next = [...h, norm];
			return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
		});
	};

	const setColor = (hex: string, immediate = false) => {
		const norm = setColorPreview(hex);
		if (!norm) return;
		window.clearTimeout(historyTimer);
		if (immediate) pushHistory(norm);
		else historyTimer = window.setTimeout(() => pushHistory(norm), HISTORY_DEBOUNCE_MS);
	};

	onMount(() => {
		const state = loadState();
		setHistory(state.history);
		setGroups(state.groups);

		const { group, colors } = parseShareParams();
		const shareName = normalizeGroupName(group);
		if (shareName && colors.length > 0) {
			let gs = state.groups;
			const existing = gs.find((g) => g.name === shareName);
			if (existing) {
				const merged = existing.colors;
				for (const c of colors) if (!merged.includes(c)) merged.push(c);
				gs = gs.map((g) => (g.id === existing.id ? { ...g, colors: merged } : g));
				setColorSignal(colors[colors.length - 1]);
				setSelectedGroup(existing.id);
			} else {
				const created: Group = { id: makeId(), name: shareName, colors };
				gs = [...gs, created];
				setColorSignal(colors[0]);
				setSelectedGroup(created.id);
			}
			setGroups(gs);
			for (const c of colors) pushHistory(c);
		} else if (state.groups.length > 0) {
			setSelectedGroup(state.groups[0].id);
		}
		setReady(true);
	});

	createEffect(() => {
		if (!ready()) return;
		const payload = JSON.stringify({ history: history(), groups: groups() } satisfies PersistState);
		window.clearTimeout(saveTimer);
		saveTimer = window.setTimeout(() => {
			try {
				localStorage.setItem(STORAGE_KEY, payload);
			} catch {
				// storage unavailable — ignore
			}
		}, SAVE_DEBOUNCE_MS);
	});

	const showToast = (msg: string) => {
		setToast(msg);
		window.clearTimeout(toastTimer);
		toastTimer = window.setTimeout(() => setToast(null), 2200);
	};

	const flashCopied = (key: string) => {
		setCopied(key);
		window.clearTimeout(copiedTimer);
		copiedTimer = window.setTimeout(() => setCopied(null), 1400);
	};

	const copyValue = async (key: string, text: string) => {
		try {
			await navigator.clipboard.writeText(text);
			flashCopied(key);
		} catch {
			showToast('Copy failed');
		}
	};

	const shareGroup = async (g: Group) => {
		const params = `group=${encodeURIComponent(g.name)}&c=${g.colors
			.map((c) => c.slice(1))
			.join(',')}`;
		const url = `${window.location.origin}${window.location.pathname}?${params}`;
		try {
			await navigator.clipboard.writeText(url);
			showToast(`Copied ${g.name} link`);
		} catch {
			showToast('Copy failed');
		}
	};

	// ── Format commit handlers ─────────────────────────────────────────

	const commitHex = (raw: string): boolean => {
		const parsed = hexToRgb(raw);
		if (!parsed) return false;
		setColor(rgbToHex(parsed));
		return true;
	};

	const commitRgb = (raw: string): boolean => {
		const parsed = parseRgb(raw);
		if (!parsed) return false;
		setColor(rgbToHex(parsed));
		return true;
	};

	const commitHsl = (raw: string): boolean => {
		const parsed = parseHsl(raw);
		if (!parsed) return false;
		setColor(rgbToHex(hslToRgb(parsed.h, parsed.s, parsed.l)));
		return true;
	};

	const commitHwb = (raw: string): boolean => {
		const parsed = parseHwb(raw);
		if (!parsed) return false;
		setColor(rgbToHex(hwbToRgb(parsed.h, parsed.w, parsed.b)));
		return true;
	};

	const onSvSelect = (s: number, v: number) => {
		setColorPreview(rgbToHex(hsvToRgb(hsv().h, s, v)));
	};

	const onHueSelect = (h: number) => {
		setColorPreview(rgbToHex(hsvToRgb(h, hsv().s, hsv().v)));
	};

	const onSliderRelease = () => {
		const cur = color();
		if (cur) setColor(cur, true);
	};

	// ── Group handlers ──────────────────────────────────────────────────

	const createGroup = () => {
		const name = normalizeGroupName(newGroupName());
		if (!name) {
			showToast('Name can only use letters, numbers, - and _');
			return;
		}
		if (groups().some((g) => g.name === name)) {
			showToast('A group with that name already exists');
			return;
		}
		const g: Group = { id: makeId(), name, colors: [] };
		setGroups((gs) => [...gs, g]);
		setSelectedGroup(g.id);
		setNewGroupName('');
	};

	const deleteGroup = (id: string) => {
		if (id === FAVORITES_ID || id === ZANCA_DEV_ID) return;
		setGroups((gs) => gs.filter((g) => g.id !== id));
		if (selectedGroup() === id) setSelectedGroup(FAVORITES_ID);
	};

	const addToGroup = (id: string, hex: string) => {
		if (!hexToRgb(hex)) return;
		setGroups((gs) =>
			gs.map((g) =>
				g.id === id && !g.colors.includes(hex) ? { ...g, colors: [...g.colors, hex] } : g,
			),
		);
	};

	const removeFromGroup = (id: string, hex: string) => {
		setGroups((gs) =>
			gs.map((g) => (g.id === id ? { ...g, colors: g.colors.filter((c) => c !== hex) } : g)),
		);
	};

	const toggleFavorite = (hex: string) => {
		if (favoritesSet().has(hex)) removeFromGroup(FAVORITES_ID, hex);
		else addToGroup(FAVORITES_ID, hex);
	};

	const pickGroupColor = (id: string, hex: string) => {
		setColor(hex);
		setSelectedGroup(id);
	};

	// ── Drag & drop ─────────────────────────────────────────────────────

	const makeSwatchDragStart = (hex: string) => (e: DragEvent) => {
		setDragging(hex);
		if (e.dataTransfer) {
			e.dataTransfer.setData('text/plain', hex);
			e.dataTransfer.effectAllowed = 'copy';
		}
	};

	const clearDragging = () => {
		setDragging(null);
		setDragOverId(null);
	};

	const dropToGroup = (id: string) => {
		const hex = dragging();
		if (hex) addToGroup(id, hex);
		clearDragging();
	};

	return (
		<div class="space-y-6">
			{/* Picker + formats */}
			<div class="flex flex-col items-center gap-6 lg:flex-row lg:justify-center">
				<div class="w-full max-w-[260px] space-y-3">
					<SvBox color={rgb()} onSelect={onSvSelect} onRelease={onSliderRelease} />
					<HueSlider hue={hsv().h} onSelect={onHueSelect} onRelease={onSliderRelease} />
				</div>

				<div class="w-full max-w-md space-y-3">
					<FormatField
						label="HEX"
						value={color().toUpperCase()}
						onCommit={commitHex}
						copied={copied() === 'hex'}
						onCopy={() => copyValue('hex', color().toUpperCase())}
					/>
					<FormatField
						label="RGB"
						value={formatRgbString(rgb())}
						onCommit={commitRgb}
						copied={copied() === 'rgb'}
						onCopy={() => copyValue('rgb', formatRgbString(rgb()))}
					/>
					<FormatField
						label="HSL"
						value={formatHslString(hsl())}
						onCommit={commitHsl}
						copied={copied() === 'hsl'}
						onCopy={() => copyValue('hsl', formatHslString(hsl()))}
					/>
					<FormatField
						label="HWB"
						value={formatHwbString(hwb())}
						onCommit={commitHwb}
						copied={copied() === 'hwb'}
						onCopy={() => copyValue('hwb', formatHwbString(hwb()))}
					/>
					<label
						class="flex h-9 w-full cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-2.5"
						title="System color picker"
					>
						<span class="relative block h-6 w-6 shrink-0 overflow-hidden rounded border border-border">
							<input
								type="color"
								value={color()}
								onInput={(e) => setColor(e.currentTarget.value)}
								class="absolute -inset-1 size-full cursor-pointer border-0 bg-transparent"
								aria-label="System color picker"
							/>
						</span>
						<span class="font-mono text-xs text-muted-foreground">System picker</span>
					</label>
				</div>
			</div>

			{/* History */}
			<div class="rounded-xl border border-border bg-background/60 p-4">
				<div class="mb-3 flex items-center justify-between">
					<h2 class="font-display text-sm font-bold uppercase tracking-tight text-foreground">
						History
					</h2>
					<Show when={history().length > 0}>
						<button
							type="button"
							class="font-mono text-xs text-muted-foreground transition-colors hover:text-destructive"
							onClick={() => setHistory([])}
						>
							Clear
						</button>
					</Show>
				</div>
				<Show
					when={history().length > 0}
					fallback={
						<p class="font-mono text-xs text-muted-foreground">
							No colors yet — pick one to start your history.
						</p>
					}
				>
					<div class="flex flex-wrap gap-2.5">
						{history()
							.slice()
							.reverse()
							.map((hex) => (
								<Swatch
									hex={hex}
									favorite={favoritesSet().has(hex)}
									onPick={() => setColor(hex)}
									onStar={() => toggleFavorite(hex)}
									onDragStart={makeSwatchDragStart(hex)}
									onDragEnd={clearDragging}
								/>
							))}
					</div>
				</Show>
			</div>

			{/* Groups */}
			<div class="space-y-4">
				<div class="flex flex-wrap items-center justify-between gap-3">
					<h2 class="font-display text-sm font-bold uppercase tracking-tight text-foreground">
						Groups
					</h2>
					<div class="flex items-center gap-2">
						<input
							value={newGroupName()}
							onInput={(e) => setNewGroupName(e.currentTarget.value)}
							onKeyDown={(e) => {
								if (e.key === 'Enter') createGroup();
							}}
							placeholder="my-colors"
							class="h-8 w-44 rounded-md border border-input bg-background px-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-accent focus:shadow-glow-cyan"
						/>
						<Button variant="outline" size="sm" onClick={createGroup}>
							+ New
						</Button>
					</div>
				</div>

				<div class="grid gap-4 md:grid-cols-2">
					{groups().map((g) => (
						<GroupCard
							group={g}
							isProtected={g.id === FAVORITES_ID || g.id === ZANCA_DEV_ID}
							isSelected={selectedGroup() === g.id}
							dragOver={dragOverId() === g.id}
							favorites={favoritesSet()}
							onSelect={() => setSelectedGroup(g.id)}
							onDelete={() => deleteGroup(g.id)}
							onShare={() => shareGroup(g)}
							onDrop={() => dropToGroup(g.id)}
							onDragOver={() => setDragOverId(g.id)}
							onDragLeave={() => setDragOverId((id) => (id === g.id ? null : id))}
							onPick={(hex) => pickGroupColor(g.id, hex)}
							onRemoveColor={(hex) => removeFromGroup(g.id, hex)}
							onStar={(hex) => toggleFavorite(hex)}
							onSwatchDragStart={makeSwatchDragStart}
							onSwatchDragEnd={clearDragging}
						/>
					))}
				</div>
			</div>

			{/* Toast */}
			<Show when={toast()}>
				<div class="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
					<div class="rounded-lg border border-accent/40 bg-popover px-4 py-2 text-sm text-foreground shadow-glow-cyan">
						{toast()}
					</div>
				</div>
			</Show>
		</div>
	);
};

export default ColorSwatches;
