# Database migration notes — CodeNova / BASE

The included `supabase/schema.sql` is a compatibility-sensitive schema script, not a guaranteed one-click migration for every historical BASE database.

## What the included SQL expects

- `workspace_members.user_id` must be convertible to a Supabase Auth UUID. The script currently casts this column to `uuid`; non-UUID legacy values will cause the migration to stop.
- Every existing workspace must have a valid Auth UUID in `created_by`, or in the legacy `owner_id` field where that field is text and contains a UUID belonging to `auth.users`.
- The app-facing tables and columns used by `app.js` and Agent 37 must match the schema definitions.

## Before applying

1. Back up the Supabase project.
2. Inspect the existing table definitions and sample identifier formats.
3. If the live project contains non-UUID text identifiers or different legacy columns, do not run the script unchanged. Map those records deliberately first.
4. Run the script in Supabase SQL Editor only after confirming the assumptions above.
5. If SQL reports an error, stop. Do not drop tables, disable RLS, or repeatedly rerun the migration. Preserve the full error message.

This package has not been executed against the hosted production database. Static code checks cannot validate the live schema, existing data, OAuth configuration, RLS policies or API secrets.
