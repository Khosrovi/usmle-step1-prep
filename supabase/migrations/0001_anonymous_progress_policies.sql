-- Fix row level security for the anonymous, no-login study model.
--
-- WHY THIS FILE EXISTS
-- --------------------
-- The app has no authentication: every visitor is anonymous and all progress
-- belongs to a single local study profile (user_id stays NULL). The anon key is
-- the only credential the browser ever uses.
--
-- `questions` and `topic_coverage` were readable, and `bookmarks` accepted
-- inserts, but `user_progress` had no INSERT policy for the anon role. The
-- result was a silently failing write: answering a question, the dashboard
-- statistics, and the exam-results review all read from `user_progress`, so all
-- three were broken for real users while the UI still rendered as if they
-- worked. This migration makes the three write paths consistent.
--
-- Apply once in the Supabase SQL editor (or with the service role key):
--   supabase/migrations/0001_anonymous_progress_policies.sql
--
-- Note on scope: these policies grant the anon role access to the study tables
-- only. They are appropriate for a single-profile free study tool. If this
-- project ever adds real accounts, replace the `to anon` predicates below with
-- `using (auth.uid() = user_id)` so each user sees only their own rows.

begin;

-- ---------------------------------------------------------------- user_progress
alter table public.user_progress enable row level security;

drop policy if exists "anon read user_progress" on public.user_progress;
create policy "anon read user_progress"
  on public.user_progress
  for select
  to anon
  using (true);

drop policy if exists "anon insert user_progress" on public.user_progress;
create policy "anon insert user_progress"
  on public.user_progress
  for insert
  to anon
  with check (true);

drop policy if exists "anon update user_progress" on public.user_progress;
create policy "anon update user_progress"
  on public.user_progress
  for update
  to anon
  using (true)
  with check (true);

drop policy if exists "anon delete user_progress" on public.user_progress;
create policy "anon delete user_progress"
  on public.user_progress
  for delete
  to anon
  using (true);

-- -------------------------------------------------------------------- bookmarks
alter table public.bookmarks enable row level security;

drop policy if exists "anon read bookmarks" on public.bookmarks;
create policy "anon read bookmarks"
  on public.bookmarks
  for select
  to anon
  using (true);

drop policy if exists "anon insert bookmarks" on public.bookmarks;
create policy "anon insert bookmarks"
  on public.bookmarks
  for insert
  to anon
  with check (true);

drop policy if exists "anon delete bookmarks" on public.bookmarks;
create policy "anon delete bookmarks"
  on public.bookmarks
  for delete
  to anon
  using (true);

drop policy if exists "anon update bookmarks" on public.bookmarks;
create policy "anon update bookmarks"
  on public.bookmarks
  for update
  to anon
  using (true)
  with check (true);

-- -------------------------------------------------------- read-only question bank
-- Questions and the coverage plan are public reference content: everyone may
-- read them, nobody may change them through the anon key.
alter table public.questions enable row level security;

drop policy if exists "anon read questions" on public.questions;
create policy "anon read questions"
  on public.questions
  for select
  to anon
  using (true);

alter table public.topic_coverage enable row level security;

drop policy if exists "anon read topic_coverage" on public.topic_coverage;
create policy "anon read topic_coverage"
  on public.topic_coverage
  for select
  to anon
  using (true);

commit;
