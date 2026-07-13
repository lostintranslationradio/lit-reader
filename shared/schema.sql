-- Run this once in Supabase: Project → SQL Editor → New query → paste all of this → Run.

-- One row per user. is_creator is the ONLY thing that grants creator access,
-- and it's only settable from the Supabase dashboard, not from anything in the site's code.
create table profiles (
  id uuid references auth.users primary key,
  email text,
  username text unique,
  is_creator boolean default false
);

alter table profiles enable row level security;

create policy "Users can view their own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on profiles for insert
  with check (auth.uid() = id);

-- Automatically create a profile row whenever someone signs up, pulling the
-- username straight from the signup metadata so it's set immediately —
-- this runs at the database level and doesn't depend on the person having
-- an active session yet (e.g. while email confirmation is still pending).
create function public.handle_new_user()
returns trigger as $$
begin
  begin
    insert into public.profiles (id, email, username)
    values (new.id, new.email, new.raw_user_meta_data->>'username');
  exception when unique_violation then
    -- requested username was already taken — create the profile anyway,
    -- just without a username; the person can set one after signing in.
    insert into public.profiles (id, email)
    values (new.id, new.email);
  end;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- One row per saved word per user. RLS means a user can only ever
-- see or change their own rows — enforced by the database, not the page.
create table saved_words (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users not null,
  kind text default 'word',
  hanzi text not null,
  pinyin text,
  gloss jsonb default '[]'::jsonb,
  hsk int default 0,
  sources jsonb default '[]'::jsonb,
  created_at timestamp default now(),
  unique (user_id, hanzi)
);

alter table saved_words enable row level security;

create policy "Users manage their own saved words"
  on saved_words for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Songs table: this is the real content store. Published rows are public;
-- draft rows are only visible to whoever the database says is_creator = true.
-- This is enforced by Postgres itself, not by anything in the site's code.
create table songs (
  id text primary key,
  zh text not null,
  en text,
  artist text,
  status text default 'draft',
  tags jsonb default '[]'::jsonb,
  year int,
  youtube_id text default '',
  context text default '',
  lines jsonb default '[]'::jsonb,
  constructions jsonb default '[]'::jsonb,
  cover_url text default '',
  publish_at timestamptz,
  added timestamptz default now()
);

alter table songs enable row level security;

-- A song is publicly visible if it's marked published outright, OR if it's a
-- draft with a scheduled release time that has already passed. This means
-- scheduled songs go live automatically the moment anyone's query runs after
-- that time — no cron job or background process needed to "flip" anything.
create policy "Anyone can read published songs"
  on songs for select
  using (status = 'published' or (status = 'draft' and publish_at is not null and publish_at <= now()));

-- Deliberately minimal: exposes only that a scheduled release exists and when
-- it's coming, so the library can show a "something's coming" teaser without
-- leaking the title, lyrics, cover art, or anything else about a song before
-- its scheduled time. This view has its own grants, independent of the songs
-- table's RLS above, so it can be safely public even though the underlying
-- draft rows themselves stay hidden.
create view upcoming_releases as
  select publish_at
  from songs
  where status = 'draft' and publish_at is not null and publish_at > now()
  order by publish_at asc;

grant select on upcoming_releases to anon, authenticated;

create policy "Creator can read all songs"
  on songs for select
  using (exists (select 1 from profiles where id = auth.uid() and is_creator = true));

create policy "Creator can insert songs"
  on songs for insert
  with check (exists (select 1 from profiles where id = auth.uid() and is_creator = true));

create policy "Creator can update songs"
  on songs for update
  using (exists (select 1 from profiles where id = auth.uid() and is_creator = true));

create policy "Creator can delete songs"
  on songs for delete
  using (exists (select 1 from profiles where id = auth.uid() and is_creator = true));

-- Lets the sign-in and forgot-password flows resolve "username" -> the real
-- email Supabase needs, without exposing the rest of anyone's profile data.
-- SECURITY DEFINER means it runs with elevated rights internally, but it only
-- ever returns a single email string for a single username lookup.
create or replace function public.get_login_email(p_username text)
returns text
language sql
security definer
set search_path = public
as $$
  select email from public.profiles where lower(username) = lower(p_username) limit 1;
$$;

grant execute on function public.get_login_email(text) to anon, authenticated;

-- Private notes any signed-in user can leave on a word, visible only to them.
-- The creator's own notes are different — those live inside songs.lines itself
-- (public, part of the song content), not in this table.
create table word_notes (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users not null,
  song_id text references songs not null,
  hanzi text not null,
  note text not null,
  created_at timestamptz default now(),
  unique (user_id, song_id, hanzi)
);

alter table word_notes enable row level security;

create policy "Users manage their own notes"
  on word_notes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Words a user already knows, so their pinyin/gloss can be hidden by default
-- regardless of HSK level. Deliberately separate from saved_words — saving a
-- word means "help me learn this," known_words means the opposite. Global
-- per-user, not per-song, since knowing a word isn't tied to which song you
-- met it in.
create table known_words (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users not null,
  hanzi text not null,
  created_at timestamptz default now(),
  unique (user_id, hanzi)
);

alter table known_words enable row level security;

create policy "Users manage their own known words"
  on known_words for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Flashcard spaced-repetition progress. "box" is a simple fixed-interval
-- scheme (1=review tomorrow, up to 5=review in a month); Remembered moves up
-- a box, Vaguely Remember repeats the same box's interval, Completely Forgot
-- drops back to box 1. Global per-user, not per-song, matching known_words.
-- "aspect" tracks which SKILL is being tested independently — knowing a
-- word's sound doesn't mean you know its written form, so quizzing yourself
-- on listening today shouldn't use up your chance to quiz the characters
-- later the same day.
create table flashcard_progress (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users not null,
  hanzi text not null,
  aspect text not null default 'h', -- 'h'=characters, 'p'=pinyin, 'g'=definition, 's'=sound
  box int not null default 1,
  next_review timestamptz not null default now(),
  last_reviewed timestamptz,
  unique (user_id, hanzi, aspect)
);

alter table flashcard_progress enable row level security;

create policy "Users manage their own flashcard progress"
  on flashcard_progress for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Opt-in on-site reminders for due flashcard reviews (shown as a banner when
-- signed in, not emailed — no email quota to worry about). threshold=1 means
-- "remind me as soon as anything is due"; higher numbers mean "wait until
-- this many words have piled up." last_reminder_sent_at enforces a minimum
-- gap between reminders so it can't nag more than once a day, regardless of
-- what threshold someone picks.
create table review_reminder_prefs (
  user_id uuid primary key references auth.users on delete cascade,
  enabled boolean not null default false,
  threshold int not null default 1,
  last_reminder_sent_at timestamptz
);

alter table review_reminder_prefs enable row level security;

create policy "Users manage their own reminder prefs"
  on review_reminder_prefs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Manual override for "Song of the Day." Absence of a row for a given date
-- means the picker falls back to a deterministic random pick, seeded by that
-- date, so everyone sees the same song without needing a row for every day —
-- this table only needs a row when the creator wants to hand-pick one.
create table song_of_day_overrides (
  date date primary key,
  song_id text references songs(id) on delete cascade
);

alter table song_of_day_overrides enable row level security;

create policy "Anyone can read song of day overrides"
  on song_of_day_overrides for select
  using (true);

create policy "Creator can manage song of day overrides"
  on song_of_day_overrides for all
  using (exists (select 1 from profiles where id = auth.uid() and is_creator = true))
  with check (exists (select 1 from profiles where id = auth.uid() and is_creator = true));

-- Cover art storage: a public bucket, but only the creator can upload to it.
insert into storage.buckets (id, name, public)
values ('covers', 'covers', true)
on conflict (id) do nothing;

create policy "Anyone can view cover art"
  on storage.objects for select
  using (bucket_id = 'covers');

create policy "Creator can upload cover art"
  on storage.objects for insert
  with check (
    bucket_id = 'covers'
    and exists (select 1 from public.profiles where id = auth.uid() and is_creator = true)
  );

create policy "Creator can replace cover art"
  on storage.objects for update
  using (
    bucket_id = 'covers'
    and exists (select 1 from public.profiles where id = auth.uid() and is_creator = true)
  );
