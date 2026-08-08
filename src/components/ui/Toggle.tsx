interface Props {
	checked: boolean;
	onToggle: () => void;
	class?: string;
}

const Toggle = (props: Props) => {
	const classes = () => {
		let c = 'relative h-6 w-11 shrink-0 rounded-full border transition-colors';
		c += props.checked ? ' border-primary bg-primary/30 shadow-glow-pink' : ' border-border bg-muted';
		if (props.class) c += ' ' + props.class;
		return c;
	};

	const knobClasses = () =>
		props.checked
			? 'absolute top-0.5 size-4 rounded-full transition-all left-[22px] bg-primary'
			: 'absolute top-0.5 size-4 rounded-full transition-all left-0.5 bg-muted-foreground';

	return (
		<button
			type="button"
			role="switch"
			aria-checked={props.checked}
			aria-label="Toggle"
			class={classes()}
			onClick={props.onToggle}
		>
			<span class={knobClasses()}></span>
		</button>
	);
};

export default Toggle;
