# CodeNova / BASE — deployment steps

This build keeps **Supabase for authentication and database storage** and runs **Agent 37 on Vercel**. You do not need to deploy Agent 37 as a Supabase Edge Function.

## 1. Keep the existing Supabase database and authentication

The website still uses your existing Supabase project:

- Project ref: `egmekbtdurqrpikxfwee`
- Project URL: `https://egmekbtdurqrpikxfwee.supabase.co`

Do not delete your Supabase project or database. Keep the existing schema, Auth providers, redirect URLs and RLS policies.

If you have not applied `supabase/schema.sql` yet, back up your database first, then inspect and apply the migration carefully. Do not rerun or modify a live schema just for this Agent 37 hosting change.

## 2. Add Vercel Environment Variables

1. Open your Vercel dashboard and select the CodeNova project.
2. Go to **Settings → Environment Variables**.
3. Add the following variables:

| Name | Value |
|---|---|
| `GEMINI_API_KEY` | Your private Gemini API key from Google AI Studio |
| `GEMINI_MODEL` | `gemini-3.8-flash` |
| `GEMINI_FALLBACK_MODEL` | `gemini-3.5-flash-lite` |
| `SUPABASE_URL` | `https://egmekbtdurqrpikxfwee.supabase.co` |
| `SUPABASE_ANON_KEY` | Your Supabase anon/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional; only needed for Agent 37 invitation emails |
| `SITE_URL` | `https://codenova-eight-sandy.vercel.app` |

Set the variables for Production and any Preview/Development environments you use. Save them. Do not paste secret values into GitHub, `config.js`, frontend code or chat.

Get the Gemini key at https://aistudio.google.com/apikey. Treat the Supabase service-role key as highly sensitive; it must only exist in Vercel server environment variables.

## 3. Deploy the updated project to Vercel

1. Extract this ZIP.
2. Make sure the Vercel project root is the folder containing `index.html`, `app.js`, `config.js`, `package.json` and `api/agent-37.ts`.
3. Push these updated files to the GitHub repository connected to Vercel, or upload/import the project through Vercel.
4. In Vercel Project Settings → General, use **Other** as the Framework Preset.
5. No build command is required for this static site. Vercel installs the package listed in `package.json` and deploys `api/agent-37.ts` as a server-side function.
6. Trigger a new deployment after adding or changing environment variables.

## 4. Test Agent 37

1. Open `https://codenova-eight-sandy.vercel.app`.
2. Sign in with your existing Supabase account.
3. Open Agent 37 and send: `Explain the review queue`.
4. If it fails, open Vercel → Project → Logs/Functions and inspect `/api/agent-37`.

The updated frontend calls `/api/agent-37` on Vercel. It no longer calls the Supabase `agent-37` Edge Function. The old Supabase deployment may remain there unused; you do not need to delete it.

## 5. Important behaviour

- Supabase remains responsible for sign-in, workspace membership, RLS and database records.
- Agent 37 validates the Supabase access token on the Vercel server.
- Gemini is called from the Vercel server; the API key is never sent to the browser.
- Proposed data changes still require explicit confirmation and server-side permission checks.
- `SUPABASE_SERVICE_ROLE_KEY` is optional and only required for teammate invitation emails.
- Gemini requests have a 20-second per-model timeout. If the primary model is overloaded or times out, Agent 37 tries the configured lighter fallback model (`GEMINI_FALLBACK_MODEL`). Both attempts fit within the Vercel function budget; if both models fail, Agent 37 returns a clear error rather than loading indefinitely.

