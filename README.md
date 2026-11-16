# BASE — Brand Assurance & Source Evidence

**Phoenix Coders · CodeZen · WeCodeCoders**

BASE is a source-backed brand-governance workspace. This build removes seeded/demo records and replaces them with a real, account-scoped Supabase data model. The no-login preview is deliberately read-only and empty: it demonstrates the interface and feature explanations without inventing people, reviews, sources, analytics or activity.

For the exact deployment sequence for this Supabase project, follow **[NEXT-STEPS.md](NEXT-STEPS.md)**.

## What is included

- **Guest preview:** explore every page and the detailed feature guide without creating an account. No sample records are inserted or displayed.
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

This is a static ES-module website. Do not open `index.html` directly from the file system; serve it over HTTP.

```bash
python -m http.server 5500
```

Then open `http://localhost:5500`.

The website runs in the empty guest preview until Supabase is configured. The guest assistant handles greetings, product help and local page navigation; authenticated AI answers and workspace actions require signing in and deploying the Edge Function. No records are generated locally or inserted as placeholders.

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

## 2. Set up Agent 37 (AI)

Agent 37 runs in a Supabase Edge Function so the model API key and privileged invitation credentials never reach the browser. In guest preview, the assistant can greet visitors, explain the product and navigate locally; it does not call the private AI model or access workspace records until a user signs in. This avoids exposing an unauthenticated public AI endpoint.

Install the Supabase CLI, log in and link your project from this folder. Then deploy the function:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy agent-37 --project-ref egmekbtdurqrpikxfwee
```

Set the function secrets (the default model is GPT-6.1 Sol; choose a model enabled for your API account):

```bash
supabase secrets set OPENAI_API_KEY=YOUR_OPENAI_API_KEY
supabase secrets set OPENAI_MODEL=gpt-6.1-sol
supabase secrets set SITE_URL=https://your-deployed-domain.example
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and the Edge Function's service-role environment are supplied by the Supabase runtime in normal hosted deployment. For teammate invitations, ensure `SUPABASE_SERVICE_ROLE_KEY` is available as an Edge Function secret in your project. Never add it to `config.js`.

After deployment, open **Supabase → Edge Functions → agent-37 → Logs** and keep the logs visible while testing. Sign in to the website, create a workspace, then send Agent 37 a simple message such as “Explain the review queue”. If it fails, copy the exact Edge Function log error; do not expose or paste any API keys.

The function has three modes:

- `chat`: answers questions using the active workspace context and may propose an allowlisted website operation.
- `execute`: performs a supported operation only when the request includes `confirmed: true`, the user is authenticated, the user belongs to the workspace and the required role is present.
- `analyze`: checks a text draft against approved sources in the active workspace. If no sources exist, it returns no findings and explains why.

### Agent 37 confirmation model

A tool call from the AI is only a **proposal**. The frontend displays the proposed change, the user can cancel it, and the server independently validates the action and the user's role when the user confirms. The supported allowlist is intentionally limited to BASE operations; it cannot control the user's computer, send arbitrary external messages, publish content, change other accounts or run arbitrary code.

Actions currently supported:

- Navigate to an internal BASE page.
- Update the signed-in user's display name.
- Create a review or approved source.
- Change an existing review status using the reviewer RPC (including separation-of-duties checks for approval).
- Invite a teammate by email (workspace admin only).
- Add a comment, delete an eligible review, or rename the workspace.

The Agent 37 model can be changed with the `OPENAI_MODEL` Edge Function secret. GPT-6.1 Sol is the default for complex tool-using work; the function uses the Responses API and medium reasoning effort by default. You may override that with `OPENAI_REASONING_EFFORT` (for example `high`). The API key is only stored server-side.

## 3. Deploy the website

Upload the contents of this folder to any static host that supports HTTPS and ES modules, such as Netlify, Vercel static hosting, Cloudflare Pages or GitHub Pages. Configure the same site URL in Supabase Auth redirect settings and the `SITE_URL` Edge Function secret. Keep `config.js` limited to the Supabase project URL and anon/publishable key.

## What is not represented as complete yet

These boundaries are intentional; the interface does not pretend they are ready:

- **PDF/image extraction:** only text input and `.txt` attachment reading are supported. PDF/image parsing, OCR, antivirus scanning and file retention need a backend ingestion pipeline and private Storage policies.
- **Publishing integrations:** BASE records a human review decision but does not post to social networks, email platforms or CMS systems.
- **External browsing and computer control:** Agent 37 only operates the listed BASE website tools.
- **Compliance certification:** AI findings and insight summaries assist reviewers; they do not certify legal, security or regulatory compliance.
- **Tamper-proof audit:** the browser can append but not update/delete events through the included RLS policies. Regulated use should add database triggers / trusted server-only audit writes and a retention policy.
- **Invitation email delivery:** requires Supabase Auth email/SMTP configuration and the Edge Function service-role secret. The invited person is added to membership after signing in with the invited email.

## Important production checks

Before using real confidential or regulated content, add automated tests for tenant isolation, privilege escalation, reviewer separation of duties, invite abuse, prompt injection through uploaded/source text, file validation, retention/deletion, rate limiting, abuse monitoring and audit integrity. Keep human approval mandatory and never expose service-role or model API keys to the browser.

## Project layout

```text
index.html
styles.css
app.js
config.js
README.md
supabase/
  schema.sql
  functions/
    agent-37/
      index.ts
```
