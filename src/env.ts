/**
 * Read an environment variable in both dev (import.meta.env, loaded from
 * .env files by Vite/Astro) and production (process.env, set by the Node
 * adapter --env-file flag or the hosting platform).
 */
export function getEnv(name: string): string | undefined {
	const meta = (import.meta as unknown as Record<string, unknown>).env as Record<string, unknown> | undefined;
	const fromMeta = meta?.[name];
	if (typeof fromMeta === 'string' && fromMeta.length > 0) return fromMeta;
	return process.env[name];
}

export function siteDomain(): string {
	const domain = getEnv('SITE_DOMAIN') || getEnv('RAILWAY_PUBLIC_DOMAIN');
	if (domain && domain.length > 0) return domain;
	return 'metru.dev';
}

export function atprotoHandle(): string {
	return getEnv('ATPROTO_HANDLE') || 'metru.dev';
}
