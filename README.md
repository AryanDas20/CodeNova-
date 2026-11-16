# BASE — Brand Assurance & Source Evidence
**CodeZen · Phoenix Coders · WeCodeCoders**

A polished frontend prototype for the Round 2 BASE brand-governance MVP. It demonstrates the workflow described in the Phoenix Coders Round 1 plan: approved source library → content intake → extraction/checks → evidence-linked findings → creator revision → human approval → version/audit history → governance insights.

## Run locally
1. Extract the ZIP.
2. Open a terminal in this folder and run `python -m http.server 5500` (or use VS Code Live Server).
3. Visit `http://localhost:5500`.
4. The UI runs in demo mode without credentials. Demo analytics and seeded reviews are illustrative, not measured results.

## Configure Firebase Authentication
1. Create a Firebase project and enable Authentication providers (Email/Password and Google).
2. Add your local/deployed domain to Firebase Authentication → Settings → Authorized domains.
3. Copy the web app config into `config.js`.
4. Firebase client config is public by design; security comes from Auth rules and server-side authorization, not hiding the web API key.

## Configure Supabase
1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL Editor.
3. Create private Storage buckets for uploads; do not make confidential source files public.
4. Put the project URL and anon key in `config.js`. The anon key is intended for browser use with correctly configured RLS.
5. Add workspace membership bootstrap and invitation flows through a trusted Edge Function/server endpoint. Do not allow users to self-assign reviewer/admin roles.

## Important prototype boundaries
- Local demo checks are simple transparent pattern checks, not an LLM, legal fact-checker, or production AI review.
- PDF/image file upload controls are shown, but this prototype does not yet extract their contents. Implement extraction in a server-side service (e.g. Python FastAPI with PyMuPDF/Pillow/OCR).
- Production AI review should run server-side, retrieve only approved tenant sources, return structured findings with source IDs, confidence and uncertainty, and log the model/provider/version used.
- Never expose service-role keys, Firebase Admin credentials, or model API keys in browser code.
- Keep human approval mandatory. Do not auto-publish or silently rewrite content.
- Audit records should be append-only and written by a trusted backend. The demo's history is local/in-memory and can be cleared by refreshing.
- Add tests for tenant isolation, object-level authorization, role escalation, upload validation, prompt injection in uploaded content, retention/deletion and reviewer separation-of-duties before production.

## Proposed next implementation milestones
1. Authenticated workspace creation and secure member invitations.
2. Private file upload + extraction pipeline for TXT/PDF/PNG/JPG.
3. Rule engine for required/forbidden terms, fact expiry, logo references and accessibility prompts.
4. Server-side AI adapter for tone/meaning analysis with structured output and source citations.
5. Immutable review snapshots, comments, approval events and measured governance analytics.

## Team
- Aryan Das — Team leader, product and integration
- Manas Kumar — Backend, data and security
- Prince Sahu — AI pipeline, evaluation and testing
- Chandan Singh — Frontend and user experience

Disclose reused assets, libraries, APIs and AI assistance in accordance with CodeZen rules. Build-window and contribution evidence should reflect the team's actual work.
