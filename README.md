# zanca.dev

Personal portfolio and blog built with [Astro](https://astro.build) and a Synthwave-inspired design system with Geist + Orbitron fonts and a dark-only color scheme.

Port of the original [metru.dev](https://github.com/metruzanca/metru.dev) (Dioxus + Rust) to Astro + SolidJS. Same pages, same design, same Tailwind styling.

## How it works

An **Astro SSR** app running on the Node adapter (`output: 'server'`). At runtime the server renders pages and hydrates the interactive islands on the client:

- **Blog posts** are read from `content/blog/*.md` (GFM → a custom block model → HTML) and merged with **ATProto** posts published to `metru.dev` (refreshed hourly).
- **GitHub data** (pinned repos, all repos, contribution graph) is fetched from the GitHub GraphQL API at server start and refreshed every 6h, with a committed snapshot (`data/github.snapshot.json`) as fallback.
- **Last.fm** data is fetched and cached for 5 minutes; the `/music` page shows your currently playing track, recent scrobbles, and total/today counts. Album-art dominant color is extracted server-side with `sharp`.
- **Resume** is fetched from a JSON gist and cached for 24h.

All data sources fetch fresh when the server starts (first request), then re-fetch on staggered intervals, so nothing goes stale without a redeploy.

**Labs** are client-only SolidJS islands (`client:only="solid"`): the timezones grid and the word counter.

## Development

Set these environment variables before running:

```bash
export GITHUB_TOKEN="gh_your_token"     # or if authenticated via gh, this isn't needed
export LASTFM_API_KEY="your_api_key"    # from https://www.last.fm/api/account/create
export LASTFM_USERNAME="your_username"  # your Last.fm username
export SITE_DOMAIN="metru.dev"          # defaults to metru.dev
```

```bash
pnpm install
pnpm dev        # start the dev server (background mode: pnpm astro dev --background)
```

## Building & running

```bash
pnpm build      # fetches the GitHub snapshot, then builds to ./dist
pnpm start      # runs the standalone SSR server (dist/server/entry.mjs)
```

## Scripts

| Command        | Action                                       |
| :------------- | :------------------------------------------- |
| `pnpm dev`     | Start the dev server at `localhost:4321`     |
| `pnpm build`   | Build the production site to `./dist/`       |
| `pnpm start`   | Run the built SSR server                     |
| `pnpm check`   | Type-check with `astro check`                |
| `pnpm astro …` | Run other Astro CLI commands                 |
