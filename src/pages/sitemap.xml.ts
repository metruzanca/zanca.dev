import type { APIRoute } from 'astro';
import { siteDomain } from '../env';
import { getMergedPosts } from '../data/blog';
import { allProjects } from '../data/projects';
import { labs } from '../components/labs/registry';

export const GET: APIRoute = () => {
	const domain = siteDomain();
	const base = `https://${domain}`;

	const paths = new Set<string>([
		'/',
		'/about',
		'/how-i-work',
		'/projects',
		'/blog',
		'/labs',
		'/music',
		'/resume',
		'/design-system',
	]);

	for (const post of getMergedPosts()) paths.add(`/blog/${post.slug}`);
	for (const project of allProjects()) paths.add(`/projects/${project.slug}`);
	for (const lab of labs) paths.add(`/labs/${lab.meta.slug}`);

	const urls = [...paths]
		.sort()
		.map(
			(path) =>
				`  <url>\n    <loc>${base}${path === '/' ? '/' : path.replace(/\/$/, '')}</loc>\n  </url>`
		)
		.join('\n');

	const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

	return new Response(body, {
		headers: { 'Content-Type': 'application/xml' },
	});
};
