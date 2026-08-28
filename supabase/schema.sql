-- Schema for the Personal NQ/MNQ Journal.
--
-- This file documents the schema AS IT EXISTS in the live project — the column
-- names were read back off the database, not invented. The app maps to these
-- names in src/lib/rows.ts. If you are provisioning a fresh project, run this
-- as-is; if you already have the tables, nothing here should change them.

-- ---------------------------------------------------------------- trades

create table if not exists public.trades (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  -- One timestamp per trade. There is no separate exit time, so the app
  -- reports holding time as "not recorded" rather than inventing one.
  execution_time  timestamptz not null,
  asset           text        not null check (asset in ('NQ', 'MNQ')),
  side            text        not null check (side in ('Long', 'Short')),
  contracts       integer     not null check (contracts >= 1),
  entry_price     numeric     not null,
  exit_price      numeric     not null,
  fees            numeric     not null default 0,
  -- Signed index points: (exit - entry) * (Long ? 1 : -1).
  net_points      numeric     not null,
  -- Net of fees, matching what the app computes and displays.
  net_pnl         numeric     not null,
  setups          text[]      not null default '{}',
  mistakes        text[]      not null default '{}',
  -- Attachment URLs, from either service: images are public URLs in the
  -- trade-attachments bucket, videos are Cloudinary secure_urls. The app
  -- classifies them by URL shape when rendering (src/lib/media.ts).
  attachments     text[]      not null default '{}'
);

create index if not exists trades_execution_time_idx
  on public.trades (execution_time desc);

-- ----------------------------------------------------------- daily_notes

create table if not exists public.daily_notes (
  id                uuid primary key default gen_random_uuid(),
  -- UNIQUE is required: the app upserts with onConflict: 'date'.
  date              date not null unique,
  sentiment         text not null default 'Trending',
  pre_market_plan   text not null default '',
  execution_review  text not null default '',
  lessons_learned   text not null default ''
);

create index if not exists daily_notes_date_idx on public.daily_notes (date desc);

-- ------------------------------------------------------------------ tags

create table if not exists public.tags (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,
  category  text not null check (category in ('setup', 'mistake')),
  unique (category, name)
);

-- ---------------------------------------------------------- video_recaps
--
-- Stand-alone daily and weekly review recordings, uploaded from the Video
-- Recaps tab. Only the recording and what the reviewer wrote are stored: trade
-- count, net P&L and the equity curve are computed from `trades` at render
-- time, so a recap can never disagree with the trades it reviews.
--
-- The rest of the library is derived from trades and has no row here.

create table if not exists public.video_recaps (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  kind          text not null check (kind in ('Daily', 'Weekly')),
  -- The session date, or the Monday of the week under review.
  date          date not null,
  -- Weekly recaps only; null for a daily one.
  end_date      date,
  title         text not null,
  notes         text not null default '',
  -- Runtime read off the file in the browser at upload time; 0 when the
  -- container could not be decoded there.
  duration_sec  integer not null default 0,
  -- Cloudinary secure_url for the recording.
  video_url     text not null
);

create index if not exists video_recaps_date_idx on public.video_recaps (date desc);

-- ------------------------------------------------- optional enhancements
--
-- The app degrades honestly without these, but they unlock features that are
-- currently inert. Each is safe to run on the existing tables.

-- Holding-time metrics. Without exit_time the dashboard's three duration
-- cards read "—" and the trade detail modal omits duration entirely.
--   alter table public.trades add column if not exists exit_time timestamptz;

-- An editable note heading. Without it the Notes editor derives a title from
-- the date and shows it as static text rather than an input that would
-- silently discard what you type.
--   alter table public.daily_notes add column if not exists title text not null default '';

-- ------------------------------------------------------------------ RLS
--
-- READ THIS BEFORE DEPLOYING.
--
-- The app talks to Supabase with the publishable key from the browser and has
-- no sign-in, so these policies grant the anonymous role full read and write.
-- Anyone who opens the site can read, insert and modify every row.
--
-- Fine for a local single-user journal; NOT fine on a public URL. To secure it,
-- add Supabase Auth, put a `user_id uuid references auth.users` column on each
-- table, and replace `using (true)` with `using (auth.uid() = user_id)`.

alter table public.trades        enable row level security;
alter table public.daily_notes   enable row level security;
alter table public.tags          enable row level security;
alter table public.video_recaps  enable row level security;

drop policy if exists trades_anon_all on public.trades;
create policy trades_anon_all on public.trades
  for all to anon, authenticated using (true) with check (true);

drop policy if exists daily_notes_anon_all on public.daily_notes;
create policy daily_notes_anon_all on public.daily_notes
  for all to anon, authenticated using (true) with check (true);

drop policy if exists tags_anon_all on public.tags;
create policy tags_anon_all on public.tags
  for all to anon, authenticated using (true) with check (true);

drop policy if exists video_recaps_anon_all on public.video_recaps;
create policy video_recaps_anon_all on public.video_recaps
  for all to anon, authenticated using (true) with check (true);

-- -------------------------------------------------------------- storage
--
-- Bucket `trade-attachments`, PUBLIC — the app stores public URLs and renders
-- them in <img> tags. Trade screenshots live under trades/.
--
-- IMAGES ONLY. Video attachments do not pass through here: they are uploaded
-- straight from the browser to Cloudinary, which transcodes and streams them,
-- and only the returned secure_url is stored in Postgres. So the bucket's file
-- size limit never has to accommodate a screen recording, and there is nothing
-- to configure here for video.
--
-- `allowed_mime_types` is left null (everything permitted) on purpose — the
-- browser-side accept rule in src/lib/media.ts is the one place that decides
-- what may be attached, and a second list here would drift out of step with it.

insert into storage.buckets (id, name, public)
values ('trade-attachments', 'trade-attachments', true)
on conflict (id) do nothing;

drop policy if exists trade_attachments_read on storage.objects;
create policy trade_attachments_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'trade-attachments');

drop policy if exists trade_attachments_write on storage.objects;
create policy trade_attachments_write on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'trade-attachments');
