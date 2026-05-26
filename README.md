# NYU Albert RMP Ratings

Chrome extension that displays Rate My Professors ratings and useful comments beside instructor rows on NYU Albert.

## Install Locally

```powershell
npm install
npm test
npm run build
npm run verify:package
```

Load `dist` as an unpacked Chrome extension after `npm run build`.

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Choose Load unpacked.
4. Select the generated `dist` folder.
5. Run `npm run verify:chrome-profile` to confirm Chrome has the unpacked extension enabled from `dist`.
6. Run `npm run verify:live` to confirm the extension package and Chrome profile are ready for Albert.
7. Open or refresh Albert, then use the popup status to confirm the page is connected.

## Albert Workflow

- Detects Albert instructor labels in the page DOM.
- Looks up matching NYU professors through the Rate My Professors GraphQL endpoint.
- Injects compact rating cards with score, difficulty, take-again percentage, tags, and useful comments from a lookup that samples 20 recent RMP ratings.
- Shows a radar fit score and pick recommendation so students can judge a professor without opening RMP, including a comment signal when useful RMP comments or tags are available.
- Highlights CS201-relevant comments with a course-match badge that counts every CS201-matched useful comment, including comments hidden in the compact view.
- Normalizes padded Albert course numbers such as `CSCI-UA 0201` so they still match RMP comments tagged `CSCI-UA 201`.
- Matches common Albert course titles and shorthands such as Operating Systems, NLP, Calculus III, and Linear Algebra when RMP comments omit formal course codes.
- Keeps long useful comments compact with a Show more control and lets students reveal extra useful comments with Show more comments without leaving Albert.
- Shows the RMP department, cache update date, and a Fuzzy RMP match note when the RMP professor name differs from Albert.
- Adds Refresh to bypass cached data for a professor.
- Adds Search RMP when no automatic match is found or when a lookup fails.
- Times out slow RMP requests so cards can show the retry state instead of loading indefinitely.

## Popup Controls

- Show ratings on Albert toggles the overlay on already-open and future Albert pages.
- Clear cached ratings removes stored professor lookup results.
- The popup shows how many professor lookups are cached locally.

## Development Checks

```powershell
npm test
npm run build
npm run verify:package
npm run verify:chrome-profile
npm run verify:live
```

To check a specific Chrome user-data folder, pass it after `dist`:

```powershell
node scripts/verify-live-readiness.js dist "%LOCALAPPDATA%\Google\Chrome\User Data" "D:\NYU-Professor-RMP-Rating\dist"
```

## Live Albert Verification Troubleshooting

If `npm run verify:live` reports that NYU Albert RMP Ratings is not installed from `dist`, Chrome is not running the built extension from this checkout yet.

1. Run `npm run build`.
2. Open the same Chrome profile you use for Albert and go to `chrome://extensions`.
3. Remove or disable older copies of NYU Albert RMP Ratings.
4. Enable Developer mode.
5. Choose Load unpacked and select this repository's `dist` folder.
6. Confirm the extension details show the path ending in `D:\NYU-Professor-RMP-Rating\dist`.
7. Run `npm run verify:chrome-profile`.
8. Run `npm run verify:live`.
9. Refresh Albert after both verifiers pass. Do not click enrollment, cart, or class-selection controls while testing the overlay.
