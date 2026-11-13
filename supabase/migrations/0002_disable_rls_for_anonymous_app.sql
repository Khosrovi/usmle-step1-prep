-- ============================================================================
--  FIX: enable progress / statistics / exam review for the anonymous app
-- ============================================================================
--
--  Copy everything below into the Supabase SQL editor and press Run:
--    Supabase dashboard → your project → SQL Editor → New query → paste → Run
--
--  What was wrong
--  --------------
--  The app has no login: every visitor is anonymous, and all study data
--  (answers, statistics, difficult-question marks) belongs to that one local
--  profile. `user_progress` had row level security enabled but *no policy*
--  allowing the `anon` role to INSERT, so every write was rejected with
--  "new row violates row-level security policy for table user_progress".
--  Reading worked, so the UI loaded but progress never accumulated.
--
--  What this script does
--  ---------------------
--  It DISABLES row level security on the four study tables, which removes the
--  check entirely — no policy can block a read or a write afterwards. This is
--  what "turn the permission check off" means in practice.
--
--  ⚠ Read this before running
--  --------------------------
--  With RLS off, anyone who has the anon key (it ships in the browser bundle,
--  so it is effectively public) can read AND modify ALL rows in these tables.
--  Questions and the coverage plan are public content, so for them that is
--  harmless. For `user_progress` and `bookmarks` it means any visitor could
--  read or wipe the study history.
--
--  That is an acceptable trade for a single-user personal study tool running on
--  a private URL. It is NOT acceptable once you share the site publicly, add
--  accounts, or store anything sensitive. When that day comes, re-enable RLS
--  and use the "per-user" variant at the very bottom of this file instead.
--
--  Idempotent: safe to run more than once.
-- ============================================================================

begin;

-- Study data written by the browser.
alter table public.user_progress disable row level security;
alter table public.bookmarks     disable row level security;

-- Reference content that is already public and read-only in the UI.
alter table public.questions      disable row level security;
alter table public.topic_coverage disable row level security;

-- Remove the leftover policies so nothing contradicts the disabled state.
do $$
declare
  pol record;
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('user_progress', 'bookmarks', 'questions', 'topic_coverage')
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      pol.policyname, pol.schemaname, pol.tablename
    );
  end loop;
end
$$;

commit;

-- ============================================================================
--  Verification — run this afterwards; both counts must be 0
-- ============================================================================
--
--   select tablename, rowsecurity
--   from pg_tables
--   where schemaname = 'public'
--     and tablename in ('user_progress','bookmarks','questions','topic_coverage');
--
--   select count(*) as remaining_policies
--   from pg_policies
--   where schemaname = 'public'
--     and tablename in ('user_progress','bookmarks','questions','topic_coverage');
--
-- ============================================================================
--  LATER, IF YOU EVER ADD REAL USER ACCOUNTS
-- ============================================================================
--
--  Re-enable RLS and scope every row to its owner:
--
--   alter table public.user_progress enable row level security;
--   create policy "own rows" on public.user_progress
--     for all to authenticated
--     using (auth.uid() = user_id) with check (auth.uid() = user_id);
--
--  The app must then write `user_id` on insert and sign users in, so treat
--  this as a follow-up project rather than a one-line change.
-- ============================================================================
