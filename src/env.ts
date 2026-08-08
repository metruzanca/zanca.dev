/**
 * Read an environment variable. In dev, `.env` files are loaded into
 * `import.meta.env` by Vite/Astro; in production the process environment is
 * authoritative (set by the Node adapter --env-file flag or the hosting
 * platform) and `import.meta.env` only holds values baked in at build time.
 */
export function getEnv(name: string): string | undefined {
	const meta = (import.meta as unknown as Record<string, unknown>).env as Record<string, unknown> | undefined;
	const fromMeta = typeof meta?.[name] === 'string' ? (meta[name] as string) : undefined;

	const isDev = meta?.DEV === true;
	if (isDev) {
		return fromMeta ?? process.env[name];
	}
	return process.env[name] ?? fromMeta;
}

export function siteDomain(): string {
	const domain = getEnv('SITE_DOMAIN') || getEnv('RAILWAY_PUBLIC_DOMAIN');
	if (domain && domain.length > 0) return domain;
	return 'metru.dev';
}

export function atprotoHandle(): string {
	return getEnv('ATPROTO_HANDLE') || 'metru.dev';
}
