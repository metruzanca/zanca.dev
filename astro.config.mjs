// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import solid from '@astrojs/solid-js';
import tailwindcss from '@tailwindcss/vite';
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const domain =
	process.env.SITE_DOMAIN || process.env.RAILWAY_PUBLIC_DOMAIN || 'metru.dev';

// https://astro.build/config
export default defineConfig({
	site: `https://${domain}`,
	output: 'server',
	adapter: node({ mode: 'standalone' }),
	integrations: [
		solid(),
		{
			name: 'copy-content',
			hooks: {
				'astro:build:done': async ({ dir }) => {
					// Make markdown content available to the standalone SSR server.
					const root = join(dir.pathname, '..');
					for (const sub of ['blog', 'projects']) {
						const src = join(process.cwd(), 'content', sub);
						const dest = join(root, 'content', sub);
						let files;
						try {
							files = readdirSync(src).filter((f) => f.endsWith('.md'));
						} catch (err) {
							console.error(`[copy-content] read ${sub} failed:`, err);
							continue;
						}
						mkdirSync(dest, { recursive: true });
						for (const f of files) copyFileSync(join(src, f), join(dest, f));
					}
				},
			},
		},
	],
	vite: {
		plugins: [tailwindcss()],
	},
});
