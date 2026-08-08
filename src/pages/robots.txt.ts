import type { APIRoute } from 'astro';
import { siteDomain } from '../env';

export const GET: APIRoute = () => {
	const body = `User-agent: *\nAllow: /\nDisallow: /design-system\nSitemap: https://${siteDomain()}/sitemap.xml\n`;
	return new Response(body, {
		headers: { 'Content-Type': 'text/plain' },
	});
};
