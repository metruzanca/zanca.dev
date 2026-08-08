export type InputGlow = 'pink' | 'cyan';

interface Props {
	id: string;
	label?: string;
	value: string;
	onInput: (value: string) => void;
	glow?: InputGlow;
	class?: string;
	placeholder?: string;
}

const Input = (props: Props) => {
	const glow = () => props.glow ?? 'pink';
	const placeholder = () => props.placeholder ?? '';

	const inputClasses = () => {
		let c =
			'h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors';
		c += glow() === 'pink' ? ' focus:border-primary focus:shadow-glow-pink' : ' focus:border-accent focus:shadow-glow-cyan';
		if (props.class) c += ' ' + props.class;
		return c;
	};

	return (
		<div class="flex flex-col gap-2">
			{props.label ? (
				<label class="font-mono text-xs uppercase tracking-widest text-muted-foreground" for={props.id}>
					{props.label}
				</label>
			) : null}
			<input
				id={props.id}
				class={inputClasses()}
				placeholder={placeholder()}
				value={props.value}
				onInput={(e) => props.onInput(e.currentTarget.value)}
			/>
		</div>
	);
};

export default Input;
