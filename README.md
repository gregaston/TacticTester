# TacticTester

A phone-first sandbox for placing a football shape and comparing it with recorded team-seasons.

This first slice is the pitch: drag players, snap them into bands, and see which recorded side the shape is nearest. Roles and match samples come later.

## Run

```sh
npm install
npm run dev
```

Open the URL Vite prints. On a phone-width window, drag a player and switch formations.

```sh
npm test
npm run build
```

## Layout

Rules stay out of React so they can be tested without a browser.

- `src/tactics/` — coordinates, position names, snap, templates, board edits
- `src/compare/` — shape features and nearest-side ranking
- `src/data/` — the shipped lineup fingerprints
- `src/pitch/` — the SVG pitch and dragging
- `src/ui/` — formation bar and the comparison card
- `scripts/build-shape-library.ts` — rebuilds `src/data/shape-library.json`

Raw StatsBomb files are cached under `.cache/` and are not committed.

## Data

Starting shapes come from [StatsBomb open data](https://github.com/statsbomb/open-data). The complete league seasons are the 2015/16 Premier League, La Liga, Serie A, and Ligue 1, plus the 2023/24 FA Women's Super League, Frauen-Bundesliga, Liga F, and Serie A Women. Arsenal's 2003/04 Premier League season and Bayer Leverkusen's 2015/16 and 2023/24 Bundesliga seasons are included because those files contain every league match that club played. A side is included only when the file has at least 15 of their matches.

The open data has no 2024/25 or 2025/26 season, and no full men's league after 2015/16 except those two Leverkusen seasons. Later La Liga and Ligue 1 files are one club and short of a season, so the missing results are not filled in.

Line height in this slice is the named starting position. It is not a measured defensive line. Rebuild with `npm run library`.

## Phone

GitHub Actions publishes the static build to GitHub Pages on pushes to `main` and `cursor/**`. Turn Pages on once for this repo, with GitHub Actions as the source. The URL is [gregaston.github.io/TacticTester](https://gregaston.github.io/TacticTester/).
