# CodeNova / BASE deployment checklist

This folder is the updated CodeNova project.

## A. Finish the database setup

1. Open Supabase project `egmekbtdurqrpikxfwee`.
2. Open SQL Editor and create a new query.
3. Open `supabase/schema.sql` from this project, copy the entire file, paste it into SQL Editor and click Run.
4. Wait for `Success`. The schema does not insert demo records.
5. If SQL Editor reports an error, stop and send the exact error text. Do not disable RLS or delete tables.

The schema is an additive compatibility migration for the actual existing tables. It adds `brand_sources.name/body/owner_id`, `reviews.owner_uid/channel`, `review_events.actor_uid`, and `review_comments.user_id`, backfilling from the old columns where possible. It deliberately does not cast `brand_sources.created_by`, `reviews.submitted_by`, `review_events.actor_id`, or `review_comments.author_id` from text to UUID, and it does not drop existing tables. New app writes use the signed-in Supabase Auth UUID in text form for owner/actor fields. `workspace_members.user_id` and `workspaces.created_by` remain UUIDs.

## B. Confirm Supabase Auth

In Supabase Dashboard:
- Authentication → URL Configuration:
  - Site URL: `https://codenova-eight-sandy.vercel.app`
  - Add redirect URL `https://codenova-eight-sandy.vercel.app/**`
  - For local testing, add `http://localhost:5500/**`
- Authentication → Providers:
  - Enable Email.
  - Enable Google only after its OAuth client ID/secret and Supabase callback URI match.

For Google OAuth, the authorised redirect URI in Google Cloud must be exactly:
`https://egmekbtdurqrpikxfwee.supabase.co/auth/v1/callback`

Never put the Google OAuth client secret in this ZIP or frontend config.

## C. Deploy Agent 37

Install the Supabase CLI if it is not installed, then open Terminal in the `CodeNova--main` project folder and run:

```bash
supabase login
supabase link --project-ref egmekbtdurqrpikxfwee
supabase functions deploy agent-37 --project-ref egmekbtdurqrpikxfwee
```

Set the OpenAI secret and model:

```bash
supabase secrets set OPENAI_API_KEY=YOUR_REAL_OPENAI_API_KEY --project-ref egmekbtdurqrpikxfwee
supabase secrets set OPENAI_MODEL=gpt-6.1-sol --project-ref egmekbtdurqrpikxfwee
supabase secrets set SITE_URL=https://codenova-eight-sandy.vercel.app --project-ref egmekbtdurqrpikxfwee
```

Replace `YOUR_REAL_OPENAI_API_KEY` with the key from your OpenAI API account. Do not put it in `config.js`, Vercel frontend variables, GitHub, or chat. The Edge Function reads Supabase's server-side publishable/secret-key runtime variables (and supports the legacy anon/service-role variables). Invitation sending needs the server-side secret key; never expose it in the browser.

## D. Deploy the website

Upload/push the contents of `CodeNova--main` to the existing GitHub repository connected to Vercel. Keep `config.js` limited to the Supabase project URL and public publishable/anon key. Vercel should build the static website; no server-side environment variable is needed for the frontend.

## E. Test in this order

1. Open `https://codenova-eight-sandy.vercel.app`.
2. Sign up/sign in using Supabase Auth.
3. Confirm a row appears in `public.profiles` for the signed-in user's UUID.
4. Create a workspace. Confirm one row appears in `public.workspaces` and one matching row in `public.workspace_members`.
5. Send Agent 37: `Explain the review queue`.
6. Try creating a review, but confirm the proposed action only if the details are correct.
7. Check Supabase → Edge Functions → `agent-37` → Logs if any request fails.

## Important

- Do not disable Row Level Security.
- Do not use a Firebase Auth UID with Supabase RLS. The app must use Supabase Auth because `auth.uid()` comes from the Supabase JWT.
- Do not share API keys, OAuth client secrets, service-role keys, or screenshots that reveal them.
- The app starts with an empty workspace. No sample/demo data is inserted.
