import { createMemo, createSignal } from 'solid-js';

const WordCount = () => {
	const [text, setText] = createSignal('');

	const wordCount = createMemo(() => {
		const t = text().trim();
		return t.length === 0 ? 0 : t.split(/\s+/).length;
	});
	const charCount = createMemo(() => Array.from(text().trim()).length);

	return (
		<div class="space-y-4">
			<textarea
				class="h-48 w-full resize-y rounded-xl border border-border bg-card p-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
				placeholder="Paste or type text here..."
				onInput={(e) => setText(e.currentTarget.value)}
			/>
			<div class="flex gap-6 font-mono text-sm">
				<div>
					<span class="text-muted-foreground">Words: </span>
					<span class="font-semibold text-primary">{wordCount()}</span>
				</div>
				<div>
					<span class="text-muted-foreground">Characters: </span>
					<span class="font-semibold text-primary">{charCount()}</span>
				</div>
			</div>
		</div>
	);
};

export default WordCount;
