import type { ParentComponent } from 'solid-js';

export type BadgeVariant = 'Online' | 'New' | 'Beta' | 'Pro' | 'Offline';

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
	Online: 'border-accent/40 bg-accent/10 text-accent',
	New: 'border-primary/40 bg-primary/10 text-primary',
	Beta: 'border-neon-purple/40 bg-neon-purple/10 text-neon-purple',
	Pro: 'border-neon-amber/40 bg-neon-amber/10 text-neon-amber',
	Offline: 'border-border bg-muted text-muted-foreground',
};

interface Props {
	variant?: BadgeVariant;
	class?: string;
}

const Badge: ParentComponent<Props> = (props) => {
	const variant = () => props.variant ?? 'Online';
	const classes = () =>
		`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs uppercase tracking-widest ${VARIANT_CLASSES[variant()]}${
			props.class ? ' ' + props.class : ''
		}`;

	return (
		<span class={classes()}>
			<span class="size-1.5 rounded-full bg-current"></span>
			{props.children}
		</span>
	);
};

export default Badge;
