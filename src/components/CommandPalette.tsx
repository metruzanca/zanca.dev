import { createEffect, createMemo, createSignal, For, onCleanup, Show } from 'solid-js';

export interface CommandPageItem {
	title: string;
	description: string;
	url: string;
	section: string;
}

function fuzzyMatch(query: string, text: string): boolean {
	const q = query.toLowerCase();
	const t = text.toLowerCase();
	let qi = 0;
	for (let i = 0; i < t.length; i++) {
		if (qi < q.length && t[i] === q[qi]) qi++;
	}
	return qi === q.length;
}

function matchScore(query: string, item: CommandPageItem): number | null {
	if (query.length === 0) return 0;
	if (fuzzyMatch(query, item.title)) return 0;
	if (fuzzyMatch(query, item.description)) return 1;
	return null;
}

interface Props {
	items: CommandPageItem[];
}

export default function CommandPalette(props: Props) {
	const [open, setOpen] = createSignal(false);
	const [query, setQuery] = createSignal('');
	const [selected, setSelected] = createSignal(0);
	let inputRef: HTMLInputElement | undefined;

	const filtered = createMemo(() => {
		const q = query().trim();
		return props.items
			.map((item, i) => ({ score: matchScore(q, item), item, i }))
			.filter((x): x is { score: number; item: CommandPageItem; i: number } => x.score !== null)
			.sort((a, b) => a.score - b.score);
	});

	const close = () => {
		setOpen(false);
		setQuery('');
		setSelected(0);
	};

	const navigate = (url: string) => {
		window.location.assign(url);
	};

	createEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
				e.preventDefault();
				setOpen((o) => !o);
			}
		};
		document.addEventListener('keydown', handler);
		onCleanup(() => document.removeEventListener('keydown', handler));
	});

	createEffect(() => {
		if (open()) {
			setTimeout(() => inputRef?.focus(), 0);
		}
	});

	createEffect(() => {
		if (open()) {
			const el = document.querySelector<HTMLElement>(`[data-cmd-item="${selected()}"]`);
			el?.scrollIntoView({ block: 'nearest' });
		}
	});

	const items = filtered();
	const sel = selected();

	return (
		<Show when={open()}>
			<div
				class="fixed inset-0 z-50"
				onKeyDown={(e) => {
					if (e.key === 'Escape') {
						e.preventDefault();
						close();
					}
				}}
			>
				<div class="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => close()}></div>
				<div class="pointer-events-none fixed inset-0 overflow-y-auto">
					<div class="flex min-h-full items-start justify-center p-4 pt-[15vh]">
						<div
							class="pointer-events-auto w-full max-w-xl overflow-hidden rounded-xl border border-border bg-card shadow-glow-pink"
							onClick={(e) => e.stopPropagation()}
						>
							<div class="flex items-center border-b border-border px-4">
								<svg
									class="size-4 shrink-0 text-muted-foreground"
									xmlns="http://www.w3.org/2000/svg"
									fill="none"
									viewBox="0 0 24 24"
									stroke-width="1.5"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
									/>
								</svg>
								<input
									ref={inputRef}
									class="h-12 flex-1 bg-transparent px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
									placeholder="Search pages and posts..."
									data-cmd-input="true"
									value={query()}
									onInput={(e) => {
										setQuery(e.currentTarget.value);
										setSelected(0);
									}}
									onKeyDown={(e) => {
										if (e.key === 'ArrowDown') {
											e.preventDefault();
											if (items.length > 0 && selected() + 1 < items.length) setSelected(selected() + 1);
										} else if (e.key === 'ArrowUp') {
											e.preventDefault();
											if (selected() > 0) setSelected(selected() - 1);
										} else if (e.key === 'Enter') {
											e.preventDefault();
											const item = items[selected()];
											if (item) navigate(item.item.url);
										} else if (e.key === 'Escape') {
											e.preventDefault();
											close();
										}
									}}
								/>
								<kbd class="ml-2 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
									esc
								</kbd>
							</div>

							<div class="max-h-80 overflow-y-auto p-2">
								<Show
									when={items.length > 0 || query().trim().length === 0}
									fallback={
										<div class="px-4 py-8 text-center text-sm text-muted-foreground">No results found.</div>
									}
								>
									<For each={items}>
										{(entry, i) => {
											const showHeader = i() === 0 || items[i() - 1].item.section !== entry.item.section;
											return (
												<div>
													<Show when={showHeader}>
														<div class="pt-3 pb-1 first:pt-0">
															<div class="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
																{entry.item.section}
															</div>
														</div>
													</Show>
													<button
														type="button"
														data-cmd-item={entry.i}
														class={`w-full rounded-lg px-4 py-3 text-left transition-colors ${
															entry.i === sel ? 'bg-accent/10' : 'hover:bg-muted'
														}`}
														onMouseEnter={() => setSelected(entry.i)}
														onMouseDown={(e) => e.preventDefault()}
														onClick={() => navigate(entry.item.url)}
													>
														<div class="flex items-start justify-between gap-4">
															<div class="min-w-0 flex-1">
																<div class="truncate text-sm font-medium">{entry.item.title}</div>
																<Show when={entry.item.description.length > 0}>
																	<div class="mt-0.5 truncate text-xs text-muted-foreground">
																		{entry.item.description}
																	</div>
																</Show>
															</div>
															<div class="shrink-0 pt-0.5 font-mono text-[11px] text-accent/70">
																{entry.item.url}
															</div>
														</div>
													</button>
												</div>
											);
										}}
									</For>
								</Show>
							</div>

							<div class="flex items-center justify-between border-t border-border px-4 py-2">
								<span class="font-mono text-[10px] text-muted-foreground">Navigate with arrow keys</span>
								<span class="font-mono text-[10px] text-muted-foreground">Enter to select</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</Show>
	);
}
