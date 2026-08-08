import type { JSX } from 'solid-js';

type IconProps = JSX.SVGElementTags['svg'];

function base(props: IconProps): IconProps {
	return {
		xmlns: 'http://www.w3.org/2000/svg',
		width: 24,
		height: 24,
		viewBox: '0 0 24 24',
		fill: 'none',
		stroke: 'currentColor',
		'stroke-width': 2,
		'stroke-linecap': 'round',
		'stroke-linejoin': 'round',
		...props,
	};
}

export const Zap = (props: IconProps) => (
	<svg {...base(props)}>
		<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
	</svg>
);

export const ArrowRight = (props: IconProps) => (
	<svg {...base(props)}>
		<path d="M5 12h14" />
		<path d="m12 5 7 7-7 7" />
	</svg>
);

export const Heart = (props: IconProps) => (
	<svg {...base(props)}>
		<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
	</svg>
);

export const Play = (props: IconProps) => (
	<svg {...base(props)}>
		<polygon points="6 3 20 12 6 21 6 3" />
	</svg>
);

export const Plus = (props: IconProps) => (
	<svg {...base(props)}>
		<path d="M5 12h14" />
		<path d="M12 5v14" />
	</svg>
);

export const MusicNote = (props: IconProps) => (
	<svg {...base(props)}>
		<path d="M9 18V5l12-2v13" />
		<circle cx="6" cy="18" r="3" />
		<circle cx="18" cy="16" r="3" />
	</svg>
);
