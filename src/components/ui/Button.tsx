import type { JSX, ParentComponent } from 'solid-js';

export type ButtonVariant = 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'link';
export type ButtonSize = 'default' | 'xs' | 'sm' | 'lg' | 'icon' | 'iconXs' | 'iconSm' | 'iconLg';

interface Props {
	variant?: ButtonVariant;
	size?: ButtonSize;
	class?: string;
	onClick?: () => void;
	disabled?: boolean;
	ariaLabel?: string;
	type?: JSX.ButtonHTMLAttributes<HTMLButtonElement>['type'];
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
	default: ' bg-primary text-primary-foreground hover:bg-primary/80',
	outline: ' border-border bg-background hover:bg-muted hover:text-foreground',
	secondary: ' bg-secondary text-secondary-foreground hover:bg-secondary/80',
	ghost: ' hover:bg-muted hover:text-foreground',
	destructive: ' bg-destructive/20 text-destructive hover:bg-destructive/30 focus-visible:ring-destructive/40',
	link: ' text-primary underline-offset-4 hover:underline',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
	default: ' h-8 gap-1.5 px-2.5',
	xs: ' h-6 gap-1 rounded-md px-2 text-xs [&_svg]:size-3',
	sm: ' h-7 gap-1 rounded-md px-2.5 text-[0.8rem] [&_svg]:size-3.5',
	lg: ' h-9 gap-1.5 px-2.5',
	icon: ' size-8',
	iconXs: ' size-6 rounded-md [&_svg]:size-3',
	iconSm: ' size-7 rounded-md',
	iconLg: ' size-9',
};

const Button: ParentComponent<Props> = (props) => {
	const variant = () => props.variant ?? 'default';
	const size = () => props.size ?? 'default';
	const disabled = () => props.disabled ?? false;

	const classes = () => {
		let c =
			'inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none';
		if (variant() === 'link') {
			c += ' focus-visible:ring-0 focus-visible:border-0';
		} else {
			c += ' focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px';
		}
		if (disabled()) c += ' pointer-events-none opacity-50';
		c += ' [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-4';
		c += VARIANT_CLASSES[variant()];
		c += SIZE_CLASSES[size()];
		if (props.class) c += ' ' + props.class;
		return c;
	};

	return (
		<button
			type={props.type ?? 'button'}
			class={classes()}
			disabled={disabled()}
			aria-label={props.ariaLabel}
			onClick={props.onClick}
		>
			{props.children}
		</button>
	);
};

export default Button;
