import { createEffect, createMemo, createSignal, For, onMount, Show } from 'solid-js';
import SearchableDropdown from '../ui/SearchableDropdown';

const COMMON_TIMEZONES = [
	'Pacific/Pago_Pago',
	'Pacific/Honolulu',
	'America/Anchorage',
	'America/Los_Angeles',
	'America/Phoenix',
	'America/Denver',
	'America/Chicago',
	'America/New_York',
	'America/Halifax',
	'America/St_Johns',
	'America/Sao_Paulo',
	'America/Argentina/Buenos_Aires',
	'America/Nuuk',
	'Atlantic/Azores',
	'UTC',
	'Europe/London',
	'Europe/Berlin',
	'Europe/Paris',
	'Europe/Madrid',
	'Europe/Rome',
	'Europe/Amsterdam',
	'Europe/Stockholm',
	'Europe/Prague',
	'Europe/Warsaw',
	'Europe/Budapest',
	'Europe/Vienna',
	'Europe/Copenhagen',
	'Europe/Oslo',
	'Europe/Zurich',
	'Europe/Belgrade',
	'Europe/Sofia',
	'Europe/Bucharest',
	'Europe/Athens',
	'Europe/Helsinki',
	'Europe/Kyiv',
	'Europe/Minsk',
	'Europe/Moscow',
	'Europe/Istanbul',
	'Asia/Dubai',
	'Asia/Tehran',
	'Asia/Kabul',
	'Asia/Karachi',
	'Asia/Kolkata',
	'Asia/Kathmandu',
	'Asia/Dhaka',
	'Asia/Bangkok',
	'Asia/Jakarta',
	'Asia/Singapore',
	'Asia/Shanghai',
	'Asia/Tokyo',
	'Asia/Seoul',
	'Australia/Eucla',
	'Australia/Adelaide',
	'Australia/Sydney',
	'Australia/Lord_Howe',
	'Pacific/Norfolk',
	'Pacific/Auckland',
	'Pacific/Chatham',
	'Pacific/Kiritimati',
];

// ── Browser helpers ──────────────────────────────────────────────────

function getSearchParams(): string {
	return window.location.search.replace(/^\?/, '');
}

function setSearchParams(params: string) {
	const path = window.location.pathname;
	const url = params.length === 0 ? path : `${path}?${params}`;
	window.history.replaceState(null, '', url);
}

function detectLocalTz(): string | undefined {
	return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function prefers12h(): boolean {
	const dtf = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: 'numeric' });
	return /[aApP][mM]/.test(dtf.format(new Date()));
}

function getPickerOrigin(): { x: number; y: number } | null {
	const el = document.getElementById('add-tz-btn');
	if (!el) return null;
	const rect = el.getBoundingClientRect();
	return { x: rect.left, y: rect.top + rect.height + 4 };
}

// ── Timezone helpers ─────────────────────────────────────────────────

function parseTz(name: string): string | null {
	try {
		new Intl.DateTimeFormat('en-US', { timeZone: name });
		return name;
	} catch {
		return null;
	}
}

function formatOffset(tz: string): string {
	const dtf = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' });
	const parts = dtf.formatToParts(new Date());
	const tzName = parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
	if (tzName === 'GMT') return '+00:00';
	const m = tzName.match(/GMT([+-])(\d{2}):(\d{2})/);
	if (!m) return '+00:00';
	return `${m[1]}${m[2]}:${m[3]}`;
}

function localTimeForUtcHour(tz: string, utcHour: number): [number, number] {
	const now = new Date();
	const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
	const dt = new Date(today + utcHour * 3_600_000);

	const dtf = new Intl.DateTimeFormat('en-US', {
		timeZone: tz,
		hour: '2-digit',
		hourCycle: 'h23',
		day: '2-digit',
		month: '2-digit',
	});
	const parts = dtf.formatToParts(dt);
	const get = (t: string) => parseInt(parts.find((p) => p.type === t)?.value ?? '0', 10);

	const hour = get('hour');
	const localDay = get('month') * 100 + get('day');
	const utcDay = (dt.getUTCMonth() + 1) * 100 + dt.getUTCDate();
	let dayDiff = localDay - utcDay;
	if (dayDiff > 1) dayDiff = -1;
	else if (dayDiff < -1) dayDiff = 1;
	return [hour, dayDiff];
}

function currentUtcHour(): number {
	return new Date().getUTCHours();
}

function parseSearchParams(search: string): { timezones: string[]; selected: number | null } {
	const timezones: string[] = [];
	let selected: number | null = null;

	for (const pair of search.split('&').filter((s) => s.length > 0)) {
		const idx = pair.indexOf('=');
		const key = idx === -1 ? pair : pair.slice(0, idx);
		const val = idx === -1 ? '' : pair.slice(idx + 1);

		if (key === 'tz') {
			for (const tzName of val.split(',').filter((s) => s.length > 0)) {
				const decoded = decodeURIComponent(tzName.trim());
				if (parseTz(decoded) && !timezones.includes(decoded)) {
					timezones.push(decoded);
				}
			}
		} else if (key === 'selected') {
			const h = parseInt(val, 10);
			if (!Number.isNaN(h) && h >= 0 && h < 24) selected = h;
		}
	}

	return { timezones, selected };
}

function formatSearchParams(timezones: string[], selected: number | null): string {
	const parts: string[] = [];
	if (timezones.length > 0) parts.push(`tz=${timezones.join(',')}`);
	if (selected !== null) parts.push(`selected=${selected}`);
	return parts.join('&');
}

function timezoneDisplayName(name: string): string {
	const tz = parseTz(name);
	if (tz) {
		const short = name.split('/').pop()!.replace(/_/g, ' ');
		return `${short} (${formatOffset(tz)})`;
	}
	return name.replace(/_/g, ' ');
}

function timezoneAbbrev(name: string): string {
	return name.split('/').pop()!.replace(/_/g, ' ');
}

function isNighttime(tz: string, utcHour: number): boolean {
	const [localHour] = localTimeForUtcHour(tz, utcHour);
	return localHour < 7 || localHour >= 22;
}

function format12h(hour: number): string {
	const h12 = hour % 12 === 0 ? 12 : hour % 12;
	const suffix = hour < 12 ? 'AM' : 'PM';
	return `${h12}:00 ${suffix}`;
}

function formatHour(hour: number, use12h: boolean): string {
	return use12h ? format12h(hour) : `${String(hour).padStart(2, '0')}:00`;
}

function formatCurrentTime(tz: string, use12h: boolean): string {
	const dtf = new Intl.DateTimeFormat('en-US', {
		timeZone: tz,
		hour: '2-digit',
		minute: '2-digit',
		hour12: use12h,
		hourCycle: use12h ? 'h12' : 'h23',
	});
	const parts = dtf.formatToParts(new Date());
	const get = (t: string) => parseInt(parts.find((p) => p.type === t)?.value ?? '0', 10);
	const h = get('hour');
	const m = get('minute');
	if (use12h) {
		const h12 = h % 12 === 0 ? 12 : h % 12;
		const suffix = h < 12 ? 'AM' : 'PM';
		return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
	}
	return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ── Sub-components ───────────────────────────────────────────────────

function TimezoneCell(props: {
	tz: string;
	utcHour: number;
	isSelected: boolean;
	isCurrent: boolean;
	use12h: boolean;
}) {
	const [localHour, dayOffset] = localTimeForUtcHour(props.tz, props.utcHour);
	const night = isNighttime(props.tz, props.utcHour);

	const bg = props.isSelected ? 'bg-accent/15' : props.isCurrent ? 'bg-primary/[0.06]' : '';
	const fg = props.isSelected
		? 'text-accent-foreground'
		: props.isCurrent
			? 'text-primary font-medium'
			: night
				? 'text-muted-foreground/35'
				: 'text-foreground/80';

	const label =
		dayOffset === 0
			? formatHour(localHour, props.use12h)
			: `${formatHour(localHour, props.use12h)}${dayOffset > 0 ? '+' : ''}${dayOffset}`;

	return (
		<div class={`flex h-8 items-center justify-center border-b border-border/25 font-mono text-xs transition-colors ${bg} ${fg}`}>
			{label}
		</div>
	);
}

function TimeLabel(props: { utcHour: number; isSelected: boolean; isCurrent: boolean; use12h: boolean }) {
	const txt = props.isSelected
		? 'text-accent font-semibold'
		: props.isCurrent
			? 'text-primary font-semibold'
			: 'text-muted-foreground';

	const display = formatHour(props.utcHour, props.use12h);

	return (
		<div class={`sticky left-0 z-10 flex h-8 items-center justify-end border-b border-border/25 bg-card pr-3 font-mono text-xs ${txt}`}>
			{display}
		</div>
	);
}

function ColumnHeader(props: { tzName: string; onRemove: () => void; use12h: boolean }) {
	const display = timezoneAbbrev(props.tzName);
	const offset = parseTz(props.tzName) ? formatOffset(props.tzName) : '';
	const current = parseTz(props.tzName) ? formatCurrentTime(props.tzName, props.use12h) : '';

	return (
		<div class="flex shrink-0 flex-col items-center gap-0.5 border-b border-border/50 bg-card px-1.5 py-2">
			<div class="flex items-center gap-1">
				<span class="max-w-[90px] truncate text-sm font-semibold text-foreground">{display}</span>
				<button
					type="button"
					class="flex size-4 shrink-0 items-center justify-center rounded-full text-xs leading-none text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
					onClick={props.onRemove}
				>
					×
				</button>
			</div>
			<div class="flex items-center gap-1.5">
				<span class="font-mono text-[10px] text-muted-foreground">{offset}</span>
				<span class="font-mono text-xs text-primary">{current}</span>
			</div>
		</div>
	);
}

// ── App ──────────────────────────────────────────────────────────────

const Timezones = () => {
	const [timezones, setTimezones] = createSignal<string[]>([]);
	const [selectedHour, setSelectedHour] = createSignal<number | null>(null);
	const [showPicker, setShowPicker] = createSignal(false);
	const [search, setSearch] = createSignal('');
	const [use12h, setUse12h] = createSignal(false);
	const [pickerOrigin, setPickerOrigin] = createSignal<{ x: number; y: number } | null>(null);
	const [ready, setReady] = createSignal(false);

	onMount(() => {
		const { timezones: tzs, selected } = parseSearchParams(getSearchParams());
		if (tzs.length === 0) {
			const local = detectLocalTz();
			setTimezones(local ? [local] : ['UTC']);
		} else {
			setTimezones(tzs);
		}
		setSelectedHour(selected);
		setUse12h(prefers12h());
		setReady(true);
	});

	createEffect(() => {
		if (!ready()) return;
		setSearchParams(formatSearchParams(timezones(), selectedHour()));
	});

	const nowHour = currentUtcHour();

	const rows = createMemo(() => {
		const sel = selectedHour();
		return Array.from({ length: 24 }, (_, h) => {
			const isCurrent = h === nowHour;
			const isSelected = sel === h;
			const bg = isSelected ? 'bg-accent/8' : isCurrent ? 'bg-primary/[0.03]' : '';
			return { hour: h, isCurrent, isSelected, bg };
		});
	});

	const tzItems = createMemo<[string, string][]>(() => {
		const q = search().trim().toLowerCase();
		const list = q.length === 0 ? COMMON_TIMEZONES : COMMON_TIMEZONES.filter((tz) => tz.toLowerCase().includes(q));
		return list.map((tz) => [timezoneDisplayName(tz), tz]);
	});

	const toggleSelected = (hour: number) => {
		const current = selectedHour();
		setSelectedHour(current === hour ? null : hour);
	};

	const removeTz = (tzName: string) => {
		let current = timezones().filter((t) => t !== tzName);
		if (current.length === 0) {
			const local = detectLocalTz();
			current = local ? [local] : ['UTC'];
		}
		setTimezones(current);
	};

	return (
		<div class="space-y-3">
			<div class="relative overflow-x-auto rounded-lg border border-border bg-card">
				<div class="min-w-[480px]">
					<div class="flex items-center">
						<div class="w-[72px] shrink-0"></div>
						<For each={timezones()}>
							{(tzName) => (
								<div class="w-[120px] shrink-0">
									<ColumnHeader tzName={tzName} onRemove={() => removeTz(tzName)} use12h={use12h()} />
								</div>
							)}
						</For>
						<div class="ml-auto flex items-center gap-2 px-3">
							<div class="relative">
								<button
									id="add-tz-btn"
									type="button"
									class="inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-lg border border-border bg-background px-2.5 text-xs font-medium text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
									onClick={() => {
										setShowPicker((s) => !s);
										if (showPicker()) setPickerOrigin(getPickerOrigin());
									}}
								>
									+ Add Timezone
								</button>
							</div>
						</div>
					</div>
					<div class="relative">
						<For each={rows()}>
							{(row) => (
								<div
									class={`flex cursor-pointer transition-colors hover:bg-muted/20 ${row.bg}`}
									onClick={() => toggleSelected(row.hour)}
								>
									<TimeLabel
										utcHour={row.hour}
										isSelected={row.isSelected}
										isCurrent={row.isCurrent}
										use12h={use12h()}
									/>
									<For each={timezones()}>
										{(tzName) => (
											<div class="w-[120px] shrink-0">
												<Show when={parseTz(tzName)}>
													{(tz) => (
														<TimezoneCell
															tz={tz()}
															utcHour={row.hour}
															isSelected={row.isSelected}
															isCurrent={row.isCurrent}
															use12h={use12h()}
														/>
													)}
												</Show>
											</div>
										)}
									</For>
								</div>
							)}
						</For>
					</div>
				</div>
			</div>

			<Show when={showPicker()}>
				<SearchableDropdown
					search={search()}
					setSearch={setSearch}
					items={tzItems()}
					placeholder="Search timezones..."
					onSelect={(tz) => {
						const current = timezones();
						if (!current.includes(tz)) {
							setTimezones([...current, tz]);
						}
						setShowPicker(false);
						setSearch('');
					}}
					onClose={() => {
						setShowPicker(false);
						setSearch('');
					}}
					origin={pickerOrigin()}
				/>
			</Show>
		</div>
	);
};

export default Timezones;
