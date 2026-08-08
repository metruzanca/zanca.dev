import type { ParentComponent } from 'solid-js';

export type CardVariant = 'default' | 'featured' | 'grid';

const VARIANT_CLASSES: Record<CardVariant, string> = {
	default: ' border border-border bg-card p-6 transition-colors hover:border-primary/50',
	featured: ' border border-primary/40 bg-card p-6 shadow-glow-pink',
	grid: ' relative overflow-hidden border border-border bg-card p-6 synth-grid',
};

interface Props {
	variant?: CardVariant;
	class?: string;
}

const Card: ParentComponent<Props> = (props) => {
	const variant = () => props.variant ?? 'default';
	const classes = () =>
		`rounded-xl${VARIANT_CLASSES[variant()]}${props.class ? ' ' + props.class : ''}`;

	return <div class={classes()}>{props.children}</div>;
};

export default Card;
