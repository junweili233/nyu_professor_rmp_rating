# NYU Albert RMP Ratings

Chrome extension that displays Rate My Professors ratings and useful comments beside instructor rows on NYU Albert.

## Install Locally

```powershell
npm install
npm test
npm run build
```

Load `dist` as an unpacked Chrome extension after `npm run build`.

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Choose Load unpacked.
4. Select the generated `dist` folder.
5. Open or refresh an NYU Albert page.

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
```
