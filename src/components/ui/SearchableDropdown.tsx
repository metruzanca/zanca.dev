import { Show } from 'solid-js';

interface Props {
	search: string;
	setSearch: (value: string) => void;
	items: [string, string][];
	placeholder?: string;
	onSelect: (value: string) => void;
	onClose: () => void;
	origin?: { x: number; y: number } | null;
}

const SearchableDropdown = (props: Props) => {
	const ph = () => props.placeholder ?? 'Search...';

	const style = () =>
		props.origin ? `position: fixed; left: ${props.origin.x}px; top: ${props.origin.y}px; z-index: 30;` : '';

	return (
		<>
			<div class="fixed inset-0 z-20" onClick={() => props.onClose()}></div>
			<div
				class="w-72 overflow-hidden rounded-lg border border-border bg-popover shadow-xl"
				style={style()}
			>
				<div class="p-2">
					<input
						class="h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:shadow-glow-pink"
						placeholder={ph()}
						value={props.search}
						onInput={(e) => props.setSearch(e.currentTarget.value)}
					/>
				</div>
				<div class="max-h-64 divide-y divide-border/20 overflow-y-auto">
					{props.items.map(([display, value]) => (
						<div
							class="flex cursor-pointer items-center px-3 py-1.5 text-sm text-foreground/80 transition-colors hover:bg-muted"
							onClick={() => props.onSelect(value)}
						>
							{display}
						</div>
					))}
					<Show when={props.items.length === 0 && props.search.length > 0}>
						<div class="px-3 py-3 text-center text-sm text-muted-foreground">No results found</div>
					</Show>
				</div>
			</div>
		</>
	);
};

export default SearchableDropdown;
