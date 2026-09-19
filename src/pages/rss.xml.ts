import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { getMergedPosts } from '../data/blog';
import { renderBlocks } from '../data/content';

export const GET: APIRoute = async (context) => {
	const posts = getMergedPosts();

	const items = await Promise.all(
		posts.map(async (post) => {
			let content: string | undefined;
			try {
				content = await renderBlocks(post.body, 'blog');
			} catch {
				content = undefined;
			}

			return {
				title: post.frontmatter.title,
				pubDate: new Date(post.frontmatter.timestamp),
				description: post.frontmatter.description,
				link: `/blog/${post.slug}`,
				content,
				customData:
					post.frontmatter.tags.length > 0
						? post.frontmatter.tags.map((tag) => `<category>${tag}</category>`).join('')
						: undefined,
			};
		})
	);

	return rss({
		title: 'Blog — Sam Zanca',
		description: 'Posts on development, tools, and systems.',
		site: context.site ?? `https://${context.url.host}`,
		items,
		customData: '<language>en-us</language>',
	});
};