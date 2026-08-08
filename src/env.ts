export function siteDomain(): string {
	const domain = process.env.SITE_DOMAIN || process.env.RAILWAY_PUBLIC_DOMAIN;
	if (domain && domain.length > 0) return domain;
	return 'metru.dev';
}

export function atprotoHandle(): string {
	return process.env.ATPROTO_HANDLE || 'metru.dev';
}
