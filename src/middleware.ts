import { startDataServices } from './data/cache';
import './data/github';
import './data/lastfm';
import './data/resume';
import './data/atproto';
import type { MiddlewareHandler } from 'astro';

export const onRequest: MiddlewareHandler = async (_context, next) => {
	// Kick off the data warm-up (fresh fetch of every source, then staggered
	// refresh loops) on the first request without blocking it. Pages that
	// depend on a specific source await their own cache when empty.
	startDataServices();
	return next();
};
