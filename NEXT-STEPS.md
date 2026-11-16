# CodeNova / BASE — deployment checklist

This package contains the static BASE website and the Agent 37 Supabase Edge Function configured for Google Gemini.

## 1. Deploy Agent 37 (Gemini)

From the project folder:

```bash
supabase login
supabase link --project-ref egmekbtdurqrpikxfwee
supabase secrets set GEMINI_API_KEY=YOUR_REAL_GEMINI_API_KEY GEMINI_MODEL=gemini-3.8-flash SITE_URL=https://codenova-eight-sandy.vercel.app --project-ref egmekbtdurqrpikxfwee
supabase functions deploy agent-37 --project-ref egmekbtdurqrpikxfwee
```

Replace `YOUR_REAL_GEMINI_API_KEY` with your key from Google AI Studio. Do not paste the key into this project, `config.js`, GitHub, Vercel frontend variables, or chat. Do not include `models/`, a URL, or `:generateContent` in `GEMINI_MODEL`.

The function uses the authenticated Supabase user's JWT and workspace membership checks. Do not disable JWT verification or RLS. Supabase supplies its normal Edge Function environment variables. If teammate invitations fail specifically because the service-role key is missing, configure `SUPABASE_SERVICE_ROLE_KEY` as a server-side function secret only.

## 2. Database: do not run migrations blindly

Back up the Supabase project before running SQL. The included `supabase/schema.sql` creates/updates tables, policies, triggers and RPC functions. It includes a legacy conversion of `workspace_members.user_id` to UUID and requires every existing workspace to have a valid `created_by` Auth UUID. If your live database has text IDs that are not UUIDs, legacy ownership values, or a different column layout, the migration can stop with an error.

**Do not drop tables, disable RLS, or repeatedly rerun a failed migration.** First inspect the exact SQL error and the existing table columns in Supabase. If you already have production data, send the error and column listing before making schema changes.

## 3. Supabase Auth settings

In Supabase Dashboard → Authentication → URL Configuration:
- Site URL: `https://codenova-eight-sandy.vercel.app`
- Add redirect URL: `https://codenova-eight-sandy.vercel.app/**`
- For local testing, add `http://localhost:5500/**`

For Google OAuth, enable the provider only after the Google OAuth client ID/secret and Supabase callback URI match. The authorised redirect URI in Google Cloud must be:

`https://egmekbtdurqrpikxfwee.supabase.co/auth/v1/callback`

Never put the Google OAuth client secret in this ZIP or frontend config.

## 4. Deploy the website

Push the contents of this project folder to the GitHub repository connected to Vercel, or upload the folder to your static host. `config.js` must contain only the Supabase project URL and public anon/publishable key. Never put the service-role key or Gemini API key in browser files.

## 5. Test in this order

1. Open `https://codenova-eight-sandy.vercel.app`.
2. Sign up/sign in using Supabase Auth.
3. Create a workspace.
4. Open Agent 37 and send `Hi`.
5. Ask `Explain the review queue`.
6. Test review analysis only after adding approved source material.
7. If a request fails, open Supabase → Edge Functions → `agent-37` → Logs and share the newest error text. Never share API keys.

## Important

- A successful Edge Function deployment does not prove that the API key, model access, database schema, RLS policies or frontend deployment are correct. Test each workflow after deployment.
- Do not use `git push --force` to resolve Git conflicts.
- The app starts with an empty workspace; it does not insert fake people, reviews, sources or analytics.
