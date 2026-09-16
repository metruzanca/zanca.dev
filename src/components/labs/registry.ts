import type { Component } from 'solid-js';
import WordCount from './WordCount';
import Timezones from './Timezones';
import ColorSwatches from './ColorSwatches';

export interface LabMeta {
	slug: string;
	name: string;
	description: string;
	tags: string[];
	wide?: boolean;
}

export interface LabInfo {
	meta: LabMeta;
	component: Component;
}

export const labs: LabInfo[] = [
	{
		meta: {
			slug: 'word-count',
			name: 'Word Counter',
			description: 'Paste text to count words, characters, and sentences.',
			tags: ['tool', 'text'],
		},
		component: WordCount,
	},
	{
		meta: {
			slug: 'tz',
			name: 'Timezones',
			description: 'Compare timezones side-by-side — add multiple timezones, click to snap to an hour, and share the link.',
			tags: ['tool', 'time', 'calendar'],
		},
		component: Timezones,
	},
	{
		meta: {
			slug: 'color-swatches',
			name: 'Color Swatches',
			description: 'Pick a color, edit it in any format (hex, rgb, hsl, hwb), and organize swatches into shareable groups.',
			tags: ['tool', 'design', 'color'],
			wide: true,
		},
		component: ColorSwatches,
	},
];

export function labBySlug(slug: string): LabInfo | undefined {
	return labs.find((l) => l.meta.slug === slug);
}
