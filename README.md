# BASE — Brand Assurance & Source Evidence

**Phoenix Coders · CodeZen · WeCodeCoders**

BASE is a source-backed brand-governance workspace. The app opens on a public product landing page with light/dark controls, email/Google sign-in, and a guest-demo entry. Guest mode loads clearly labelled illustrative sample records in memory so visitors can inspect reviews, sources, insights, team roles and history. Demo records are never written to Supabase; real workspace data remains account-scoped.

For the exact deployment sequence for this Supabase project, follow **[NEXT-STEPS.md](NEXT-STEPS.md)**.

## What is included

- **Guest demo:** explore the full dashboard with illustrative sample reviews, approved sources, insights, team roles and audit events. Sample records exist only in browser memory and are not saved to Supabase.
- **Authentication:** Google OAuth, email/password sign-up and sign-in, email confirmation and password-reset flow through Supabase Auth.
- **Workspace setup:** create private workspaces, switch between every workspace your account belongs to, and remember the selected workspace on that device. The creator becomes the first administrator. No example data is seeded.
- **Review queue:** create and save text reviews, search and filter them, inspect source-linked findings, add discussion comments, record human decisions and delete eligible records.
- **Brand source library:** save approved facts, policies, terminology and guidelines with a source owner and optional review date. Source write permissions are enforced by RLS.
- **Team & roles:** view actual workspace membership and roles. Admins can send email invitations through the protected Agent 37 function.
- **Insights:** category, severity and approval counts are computed from real saved review records. Empty workspaces remain empty.
- **Audit history:** append-only-from-browser activity records and CSV export.
- **Settings:** update the current user's display name, theme, reduced-motion preference, account session and JSON workspace export.
- **Agent 37:** prominent floating assistant launcher, larger chat panel, quick prompts, natural greeting/help responses in guest preview, and AI assistant for authenticated workspace questions and supported actions. It can navigate pages and propose username updates, review/source creation, review decisions, teammate invitations, comments, deletions and workspace renames. Every data-changing action is displayed as a proposal and requires explicit confirmation.
- **Responsible review:** AI findings must point to a source in the active workspace or be labelled unverified. The AI cannot approve or publish content itself.
- **Responsive interface:** mobile navigation, adaptive layouts, dialogs, loading states, keyboard access and polished motion with a reduced-motion preference.

## Run locally

This is a static ES-module website with a Vercel API route. Do not open `index.html` directly from the file system.

For a local UI preview, including the guest demo, run:

```bash
python -m http.server 5500
```

Then open `http://localhost:5500`. This simple static preview does not run the `/api/agent-37` backend.

To test the full app and Agent 37 locally, install the dependencies, link the Vercel project, pull its development environment variables into `.env.local`, then run `npx vercel dev`. Open the local URL printed by Vercel.

The guest assistant handles greetings, product help and local page navigation. Authenticated AI answers and workspace actions require sign-in and the deployed (or locally running) Vercel API route. Guest sample records are illustrative only; guest changes do not persist.

## 1. Create and configure Supabase

1. Create a Supabase project.
2. Open **SQL Editor** and run the full `supabase/schema.sql` script in this ZIP. It creates the tables, indexes, profile bootstrap trigger, RPC functions and row-level security policies. It includes a compatibility repair for the earlier prototype (`workspace_members.user_id` text, `workspaces.owner_id` text, and missing `profiles`). It does not seed demo data. If you already ran the short repair SQL supplied during setup, this full script is designed to be safe to run afterward; do not run it while any workspace rows have a missing/invalid owner mapping.
3. In **Project Settings → API**, copy the Project URL and the anon/publishable key.
4. Put those two public values in `config.js`:

```js
export const supabaseConfig = {
  url: 'https://egmekbtdurqrpikxfwee.supabase.co',
  anonKey: 'YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY'
};
```

5. In **Authentication → URL Configuration**, set your local/deployed site URL and add the exact redirect URLs you use (for example `http://localhost:5500/**` and your deployed domain).
6. In **Authentication → Providers**, enable Email and Google.
7. For Google OAuth, create a Google OAuth Web application, set the Supabase callback URL shown in the Google provider settings as an authorised redirect URI, and add the deployed site domain to the authorised JavaScript origins. Paste the Google client ID and client secret into Supabase's Google provider settings. Do not put the Google client secret in this project.
8. For production invitations and email confirmation, configure Supabase SMTP / Auth email delivery and use a verified sender domain.

### Identity and database security

The project uses **Supabase Auth for both Google and email sign-in**. This is deliberate: Supabase Auth JWTs are the identity used by the database's `auth.uid()` RLS rules. The previous starter mixed Firebase Auth with Supabase RLS; those two user IDs do not automatically match, which can cause permission failures even when the Firebase login succeeds.

Do not enable public/anonymous read access to workspace tables. Do not disable RLS to “fix” permission errors. The browser contains only the Supabase anon/publishable key; the database policies remain the security boundary.

## 2. Connect Agent 37 Cloud on Vercel

Agent 37 now runs as a Vercel server-side API route at `/api/agent-37`. The browser sends the signed-in Supabase access token to this route. The route verifies the user with Supabase Auth, checks workspace membership and permissions, then calls your Agent 37 Cloud Hermes instance at `https://{AGENT37_INSTANCE_ID}.agent37.app/v1/responses`. It authenticates with the server-side `X-Agent37-Key` header. The Agent 37 key and Supabase service-role key remain server-side and are never placed in `app.js` or `config.js`.

### Vercel Environment Variables

In Vercel, open **Project → Settings → Environment Variables** and add:

| Variable | Required | Value |
|---|---|---|
| `AGENT37_INSTANCE_ID` | Yes | `0pudhehb78` (your BASE instance) |
| `AGENT37_INSTANCE_URL` | No | `https://0pudhehb78.agent37.app` |
| `AGENT37_API_KEY` | Yes | Your Agent 37 Cloud `sk_live_...` key |
| `SUPABASE_URL` | Yes | `https://egmekbtdurqrpikxfwee.supabase.co` |
| `SUPABASE_ANON_KEY` | Yes | The Supabase anon/publishable key from Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Only for invitations | Supabase service-role/secret key; keep private |
| `SITE_URL` | Recommended | Your deployed Vercel site URL, used for invitation redirects |

Apply the variables to **Production**, **Preview**, and **Development** as appropriate. After saving or changing environment variables, redeploy the Vercel project so the deployment receives them.

Create or copy your Agent 37 Cloud API key from [Agent 37 API keys](https://www.agent37.com/dashboard/cloud/api-keys). Keep it server-side in Vercel. Never commit it, put it in `config.js`, expose it in browser code, or paste it into chat. The `.env.example` file documents the names only; it contains placeholders, not working secrets.

### Deploy

The repository root should contain `index.html`, `app.js`, `config.js`, `styles.css`, `package.json`, and the `api/` folder. Vercel detects `api/agent-37.ts` as a server-side function. No Supabase CLI command or Supabase Edge Function secret is required for Agent 37.

1. Import the GitHub repository into Vercel (or open the existing Vercel project connected to it).
2. Set **Root Directory** to the folder containing `index.html` and `api/agent-37.ts`.
3. Leave the Framework Preset as **Other**. No build command is required; the website is static and Vercel serves the API route from `api/`.
4. Add the environment variables above.
5. Deploy or redeploy.

The website continues to use Supabase Auth and the Supabase database for login, workspaces, reviews, sources, roles and audit records. Only the Agent 37 AI endpoint moves to Vercel. The old Supabase Edge Function can remain deployed but the updated frontend no longer calls it.

### Test Agent 37

1. Open the deployed Vercel site and sign in.
2. Open Agent 37 and send: `Explain the review queue`.
3. If it fails, open Vercel → Project → **Logs** or **Functions** and inspect `/api/agent-37`.
4. A missing Agent 37 Cloud or Supabase variable is reported as a configuration error. Agent 37 Cloud errors are returned as visible messages instead of leaving the chat spinner running indefinitely.

### Security and behaviour

- Every request must include a valid Supabase Auth access token.
- Workspace membership and role checks remain server-side.
- Mutating Agent 37 actions remain proposals until the user confirms them; the server checks permissions again before applying them.
- `SUPABASE_SERVICE_ROLE_KEY` is optional and is only needed for admin invitation emails. It must never be exposed to the browser.
- `AGENT37_API_KEY` is only read from Vercel's server environment and is sent to the instance using `X-Agent37-Key`.
- The API has a 60-second Vercel function maximum duration and a bounded 55-second request timeout for Agent 37 Cloud.

## What is not represented as complete yet

These boundaries are intentional; the interface does not pretend they are ready:

- **PDF/image extraction:** only text input and `.txt` attachment reading are supported. PDF/image parsing, OCR, antivirus scanning and file retention need a backend ingestion pipeline and private Storage policies.
- **Publishing integrations:** BASE records a human review decision but does not post to social networks, email platforms or CMS systems.
- **External browsing and computer control:** Agent 37 only operates the listed BASE website tools.
- **Compliance certification:** AI findings and insight summaries assist reviewers; they do not certify legal, security or regulatory compliance.
- **Tamper-proof audit:** the browser can append but not update/delete events through the included RLS policies. Regulated use should add database triggers / trusted server-only audit writes and a retention policy.
- **Invitation email delivery:** requires Supabase Auth email/SMTP configuration and the Vercel `SUPABASE_SERVICE_ROLE_KEY` environment variable. The invited person is added to membership after signing in with the invited email.

## Important production checks

Before using real confidential or regulated content, add automated tests for tenant isolation, privilege escalation, reviewer separation of duties, invite abuse, prompt injection through uploaded/source text, file validation, retention/deletion, rate limiting, abuse monitoring and audit integrity. Keep human approval mandatory and never expose service-role or model API keys to the browser.

## Project layout

```text
index.html
styles.css
app.js
config.js
package.json
.env.example
api/
  agent-37.ts
supabase/
  schema.sql
```
