# Supabase authentication and cloud saves

The game can be played as a tab-scoped guest without Supabase. Sign-up, sign-in, username availability, and cloud saves require a Supabase project.

## 1. Create and configure a Supabase project

1. Create a project in Supabase and copy its **Project URL** and **publishable/anon key** from Project Settings → API.
2. Copy `.env.example` to `.env.local` in the repository root and set:

   ```dotenv
   VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
   ```

   These are browser-safe public values. **Never put the service-role key in a `VITE_` variable or in the browser.** Restart the Vite server after changing environment variables.

3. In Supabase Authentication → URL Configuration, add the local development URL (usually `http://localhost:5173`) and the eventual deployed site URL to the allowed redirect URLs. Configure email/password sign-up and decide whether email confirmation should be enabled. If confirmation is enabled, sign-up returns to the sign-in flow until the player verifies their email.

## 2. Apply the database migration

In the Supabase SQL Editor, open and run the complete file:

`supabase/migrations/202611050001_auth_profiles_and_cloud_saves.sql`

It creates `public.profiles`, row-level security policies, the case-insensitive unique username index, the real-time username availability RPC, and the trigger that creates a profile for each new Auth user. The database unique index is the final authority if two players try to claim the same username simultaneously.

Alternatively, if you use the Supabase CLI, link your project and run `supabase db push` from the repository root. Cross-device multiplayer also needs the separate room-directory migration documented in [`multiplayer.md`](multiplayer.md); apply that migration in the SQL Editor as well if you are not using the CLI.

## 3. Deploy username sign-in

Email sign-in works directly through Supabase Auth. Username sign-in uses the `username-login` Edge Function to look up the account's email privately and verify the password through Supabase Auth. Deploy it from the repository root with the Supabase CLI:

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy username-login --no-verify-jwt
```

This endpoint must accept a sign-in request before the player has a user session, so deployment uses `--no-verify-jwt`. It validates the request and performs password verification with Supabase Auth. Supabase supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to the Edge Function; the service-role key stays server-side and is never shipped to the game client. Do not add the service-role key to `.env.local`.

## 4. Run and verify

```sh
npm install
npm run dev
```

Use **START GAME → SIGN UP** to register. Username availability is checked against Supabase while typing, and the database also rejects case-insensitive duplicates. Test sign-in with both email and username. **CONTINUE AS GUEST** remains available even before Supabase is configured; guest profile and garage save data are kept in the current browser tab's `sessionStorage`.

A guest can use **LINK ACCOUNT / SAVE PROGRESS** in the garage profile widget, then register or sign in. The guest's active car collection, selected car, paint/customization, and garage/race settings are merged into the account save. Closing the modal leaves the guest session intact.

If the app reports that cloud accounts are not configured, check the two `VITE_` values and restart Vite. If username sign-in is unavailable, confirm the Edge Function deployment and project link. No live Supabase checks can succeed until a real project is configured.
