-- Run this once in Supabase: Project → SQL Editor → New query → paste all of this → Run.

-- One row per user. is_creator is the ONLY thing that grants creator access,
-- and it's only settable from the Supabase dashboard, not from anything in the site's code.
create table profiles (
  id uuid references auth.users primary key,
  email text,
  is_creator boolean default false
);

alter table profiles enable row level security;

create policy "Users can view their own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on profiles for insert
  with check (auth.uid() = id);

-- Automatically create a profile row whenever someone signs up.
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
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
  youtube_id text default '',
  context text default '',
  lines jsonb default '[]'::jsonb,
  added timestamptz default now()
);

alter table songs enable row level security;

create policy "Anyone can read published songs"
  on songs for select
  using (status = 'published');

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
