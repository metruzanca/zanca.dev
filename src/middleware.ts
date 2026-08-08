import { startDataServices } from './data/cache';
import './data/github';
import './data/lastfm';
import './data/resume';
import './data/atproto';
import type { MiddlewareHandler } from 'astro';

export const onRequest: MiddlewareHandler = async (_context, next) => {
	// On the first request this awaits the initial refresh of all data
	// sources; afterwards it resolves immediately.
	await startDataServices();
	return next();
};
