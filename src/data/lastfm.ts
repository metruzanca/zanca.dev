import sharp from 'sharp';
import { createCache, addRefreshLoop } from './cache';

export interface Track {
	name: string;
	artist: { text: string };
	album: { text: string };
	url: string;
	image: { text: string; size: string }[];
	date?: { text: string; uts: string };
	attr?: { nowplaying: string };
	formatted_time?: string;
}

export interface NowPlayingData {
	now_playing?: Track;
	recent_tracks: Track[];
	dominant_color?: string;
	total_scrobbles: number;
	scrobbles_today: number;
}

const LASTFM_BASE = 'https://ws.audioscrobbler.com/2.0/';
const LASTFM_REFRESH_MS = 5 * 60 * 1000;

function relativeTime(uts: number, now: number): string {
	const diff = now - uts;
	if (diff < 60) return 'just now';
	if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
	if (diff < 7200) return '1h ago';
	if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
	if (diff < 172800) return 'yesterday';
	if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
	if (diff < 2592000) return `${Math.floor(diff / 604800)}w ago`;
	return `${Math.floor(diff / 2592000)}mo ago`;
}

async function extractDominantColor(imageUrl: string): Promise<string | undefined> {
	try {
		const res = await fetch(imageUrl, { signal: AbortSignal.timeout(12_000) });
		if (!res.ok) return undefined;
		const buf = Buffer.from(await res.arrayBuffer());
		const { data, info } = await sharp(buf).resize(10, 10, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });

		let r = 0, g = 0, b = 0;
		const channels = info.channels;
		const count = info.width * info.height;
		for (let i = 0; i < count; i++) {
			r += data[i * channels];
			g += data[i * channels + 1];
			b += data[i * channels + 2];
		}
		if (count === 0) return undefined;
		const toHex = (v: number) => v.toString(16).padStart(2, '0');
		return `#${toHex(Math.round(r / count))}${toHex(Math.round(g / count))}${toHex(Math.round(b / count))}`;
	} catch (err) {
		console.error('[lastfm] dominant color failed:', err);
		return undefined;
	}
}

function trackLargestImage(track: Track): string | undefined {
	const last = track.image[track.image.length - 1];
	const first = track.image[0];
	return (last?.text && last.text.length > 0 ? last : first)?.text || undefined;
}

async function colorTrack(nowPlaying: Track | undefined, recent: Track[]): Promise<string | undefined> {
	const track = nowPlaying ?? recent[0];
	if (!track) return undefined;
	const imgUrl = trackLargestImage(track);
	if (!imgUrl) return undefined;
	return extractDominantColor(imgUrl);
}

export async function fetchLastfmData(): Promise<NowPlayingData | undefined> {
	const apiKey = process.env.LASTFM_API_KEY;
	const username = process.env.LASTFM_USERNAME;
	if (!apiKey || !username) return undefined;

	const nowTs = Math.floor(Date.now() / 1000);
	const todayStart = nowTs - (nowTs % 86400);

	const recentUrl = `${LASTFM_BASE}?method=user.getrecenttracks&user=${encodeURIComponent(
		username
	)}&api_key=${apiKey}&format=json&limit=200`;
	const userUrl = `${LASTFM_BASE}?method=user.getinfo&user=${encodeURIComponent(username)}&api_key=${apiKey}&format=json`;

	try {
		const [recentRes, userRes] = await Promise.all([
			fetch(recentUrl, { signal: AbortSignal.timeout(12_000) }),
			fetch(userUrl, { signal: AbortSignal.timeout(12_000) }),
		]);
		if (!recentRes.ok || !userRes.ok) return undefined;

		const recentBody = await recentRes.text();
		const userBody = await userRes.text();

		let recentResponse: { recenttracks?: { track: Track[] } };
		try {
			recentResponse = JSON.parse(recentBody);
		} catch {
			return undefined;
		}

		let totalScrobbles = 0;
		try {
			const userInfo = JSON.parse(userBody) as { user?: { playcount?: string } };
			totalScrobbles = parseInt(userInfo.user?.playcount ?? '0', 10) || 0;
		} catch {
			/* ignore */
		}

		const allTracks = recentResponse.recenttracks?.track ?? [];

		const scrobblesToday = allTracks.filter((t) => {
			const uts = parseInt(t.date?.uts ?? '', 10);
			return !Number.isNaN(uts) && uts >= todayStart;
		}).length;

		const nowPlaying = allTracks.find((t) => t.attr?.nowplaying === 'true');
		const recentStart = nowPlaying ? 1 : 0;

		const recentTracks = allTracks
			.slice(recentStart, recentStart + 10)
			.map((t) => {
				const uts = parseInt(t.date?.uts ?? '', 10);
				if (!Number.isNaN(uts)) {
					return { ...t, formatted_time: relativeTime(uts, nowTs) };
				}
				return t;
			});

		const dominantColor = await colorTrack(nowPlaying, recentTracks);

		return {
			now_playing: nowPlaying,
			recent_tracks: recentTracks,
			dominant_color: dominantColor,
			total_scrobbles: totalScrobbles,
			scrobbles_today: scrobblesToday,
		};
	} catch (err) {
		console.error('[lastfm] fetch failed:', err);
		return undefined;
	}
}

export const lastfmCache = createCache<NowPlayingData>({
	fetch: fetchLastfmData,
});

addRefreshLoop({
	ttlMs: LASTFM_REFRESH_MS,
	refresh: async () => {
		await lastfmCache.refresh();
	},
});
