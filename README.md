# WAYFARER AI — Travel discovery, planning & sharing

Wayfarer is the primary website served from the project root. It provides a public landing page, guest access, Supabase authentication, destination discovery, itinerary planning, private activity history, downloadable travel picture cards, theme controls, and an interactive feature tour.

The original **BASE — Brand Assurance & Source Evidence** app has been preserved in `/base/` and is still available at `/base/` after deployment. Its existing source files and Agent 37 API are retained.

## What's implemented

- **Landing page:** responsive marketing page with detailed feature explanations, soft dotted background, destination imagery, and public log-in / sign-up / guest entry.
- **Authentication:** Google OAuth and email/password sign-in or registration through the Supabase project configured in `config.js`.
- **Guest mode:** destination discovery, itinerary creation, and picture-card sharing work without an account. Guest activity is not written to permanent history.
- **Discover:** searchable destination catalogue with mood filters, sorting, destination detail sheets, and direct planning hand-off.
- **Trip planner:** configurable destination, date range, group size, budget style, interests, and notes. It builds a day-by-day itinerary, a directional cost estimate, and packing reminders.
- **Travel history:** signed-in searches, generated plans, and share-card activity are stored per user in Supabase. The UI includes filters and plan reopening.
- **Travel share cards:** client-side PNG image generation, download, native share when supported, and a shareable URL that opens a shared trip preview.
- **Guide tour:** navigates through real dashboard sections, highlights the relevant interface area, and explains each feature.
- **Themes:** Evening and Daylight modes use muted, layered colours rather than pure black/white contrast. The theme control is available on both the landing page and dashboard.
- **Account controls:** account settings and sign-out. Signing out returns to the landing page.

## Run locally

The site is static HTML/CSS/JavaScript and loads Supabase JS as an ES module from jsDelivr. From the project folder run a local static server, for example:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`. Do not open `index.html` as a `file://` URL because browser ES modules and OAuth redirects need an HTTP origin.

## Supabase setup

`config.js` contains the existing project's public Supabase URL and publishable key. These are browser-safe values; never add a service-role key to `config.js`.

1. Open the Supabase project configured in `config.js`.
2. In **SQL Editor**, run the full contents of `supabase/wayfarer-history.sql`. This creates `public.wayfarer_activity`, enables row-level security, and grants each signed-in user access only to their own records.
3. In **Authentication → Providers**, enable Google if you want the Google button to work. Configure the Google OAuth client in Supabase.
4. In **Authentication → URL Configuration**, add your local URL (for example `http://localhost:8000`) and deployed site URL to the allowed redirect URLs / site URL configuration.
5. Email/password registration is available through Supabase Auth. Depending on your email confirmation settings, new users may need to confirm their email before logging in.

The app degrades gracefully if the migration has not yet been run: discovery and planning still work, but the History page explains that the migration is required and saved activity cannot be synced until it exists.

## Deploy

Deploy the project root as a static site on Vercel or another static host. Keep the project root as the deployment root so `index.html`, `app.js`, `styles.css`, and `config.js` resolve correctly. The original `/api/agent-37` route is retained for the preserved BASE app, but Wayfarer currently does not depend on it.

## Important behaviour and limitations

- The current itinerary builder is a deterministic, preference-driven planning framework with curated activity patterns. It does **not** call a live generative-AI provider, search live inventory, make reservations, or verify real-time prices/hours. The UI labels cost estimates as indicative and prompts travellers to verify local details.
- The destination collection is a curated starter dataset. It can be expanded with licensed imagery and verified destination content.
- Share links encode the chosen itinerary summary in the URL. Anyone holding the link can view those details; do not put private or sensitive notes into a card.
- The PNG card is generated locally in the browser. A remote destination image may be omitted by the browser if its image host does not permit canvas cross-origin use; the card still renders with a designed gradient background.
- Guest travel activity is deliberately not persisted. Only the appearance preference is stored locally.

## Project layout

```text
index.html                    Wayfarer landing page and dashboard
app.js                        Wayfarer interactions, auth, planner, history, sharing, tour
styles.css                    Responsive Wayfarer design system
config.js                     Public Supabase browser configuration
supabase/wayfarer-history.sql  Wayfarer activity table + row-level security
base/                         Preserved BASE application and its existing API/schema
api/agent-37.ts               Existing BASE Agent 37 API route
```

## Original BASE application

Open `/base/` to use the preserved BASE app. Its original documentation is in `base/README-BASE.md`, with its migration notes and next steps alongside it.
