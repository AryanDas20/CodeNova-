# Database migration notes — CodeNova / BASE

This ZIP replaces the previous schema migration with an additive compatibility migration based on the actual column listing supplied for the existing Supabase project.

## What changed

- No `ALTER COLUMN ... TYPE uuid` is performed on legacy text identity fields.
- `brand_sources` receives `name`, `body`, and `owner_id`, backfilled from `title`, `content`, and `created_by`.
- `reviews` receives `owner_uid` and `channel`, with `owner_uid` backfilled from `submitted_by`.
- `review_events` receives `actor_uid`, backfilled from `actor_id`.
- `review_comments` receives `user_id` (UUID). Existing `author_id` values are mapped only when they have UUID syntax; other legacy values are preserved in `author_id`.
- Browser and Agent 37 inserts populate both new app-facing columns and the legacy NOT NULL columns where needed.
- RLS policies compare text owner/actor values to `auth.uid()::text`; workspace membership continues to use UUIDs.

## Apply

1. Back up the Supabase project before changing its schema.
2. Open Supabase → SQL Editor → New query.
3. Run the complete `supabase/schema.sql` file once.
4. If Supabase reports any error, stop and share the exact error. Do not run the old migration and do not drop tables.

This migration has been checked against the supplied column listing and the frontend JavaScript passed `node --check`. It has not been executed against the hosted Supabase database, so the live project may still reveal constraints or policies not visible in the supplied column listing.
