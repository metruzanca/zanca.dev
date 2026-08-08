export interface Cache<T> {
	/** Returns the current cached value, if any. */
	get(): T | undefined;
	/** Fetches fresh data (dedupes concurrent calls) and updates the cache. */
	refresh(): Promise<T | undefined>;
	/** Same as refresh() but never blocks the first callers — returns the cached value. */
	peek(): T | undefined;
}

export function createCache<T>(opts: {
	fetch: () => Promise<T | undefined>;
	initial?: T;
}): Cache<T> {
	let value: T | undefined = opts.initial;
	let inFlight: Promise<T | undefined> | null = null;

	return {
		get() {
			return value;
		},
		peek() {
			return value;
		},
		refresh() {
			if (!inFlight) {
				inFlight = (async () => {
					try {
						const next = await opts.fetch();
						if (next !== undefined) value = next;
					} catch (err) {
						console.error('[data] refresh failed:', err);
					} finally {
						inFlight = null;
					}
					return value;
				})();
			}
			return inFlight;
		},
	};
}

export interface RefreshLoop {
	refresh(): Promise<void>;
	ttlMs: number;
}

let started = false;
let startPromise: Promise<void> | null = null;
const loops: RefreshLoop[] = [];

export function addRefreshLoop(loop: RefreshLoop) {
	loops.push(loop);
}

/**
 * Runs all registered refreshers in parallel once (awaiting the result the
 * very first time it's called), then schedules each one to re-run on its
 * own interval. Safe to call from middleware on every request.
 */
export function startDataServices(): Promise<void> {
	if (started) return Promise.resolve();
	if (!startPromise) {
		startPromise = (async () => {
			await Promise.allSettled(loops.map((l) => l.refresh()));
			for (const loop of loops) {
				const run = async () => {
					await loop.refresh();
					setTimeout(run, loop.ttlMs);
				};
				setTimeout(run, loop.ttlMs);
			}
			started = true;
		})();
	}
	return startPromise;
}
