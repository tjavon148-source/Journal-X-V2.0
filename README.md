# Personal NQ/MNQ Journal

A trading journal for NQ and MNQ futures across five views — Dashboard,
Calendar, History, Video Recaps and Notes — over an obsidian starfield. Vite +
React + TypeScript + Tailwind v4, shadcn/ui for the form primitives, Recharts
for charts.

```bash
npm install
cp .env.example .env.local   # Supabase URL + publishable key, Cloudinary cloud + preset
npm run dev                  # http://localhost:5173
npm run build
```

Run `supabase/schema.sql` in the Supabase SQL editor first: it creates the
`trades`, `daily_notes`, `tags` and `video_recaps` tables, the
`trade-attachments` storage bucket, and the RLS policies. **Read the RLS comment
in that file before deploying** — with no auth, the policies grant the anonymous
role full read/write.

`video_recaps` is additive: a project still on the earlier schema keeps working
and simply shows a library with no uploaded recordings in it, rather than an
error page. Re-run the file to add the table.

Video does **not** go to Supabase. Recordings are uploaded straight from the
browser to Cloudinary with an unsigned preset, and only the returned
`secure_url` is stored in Postgres — see [Attachments](#attachments).

## Layout

```
src/
  hooks/useJournalData.ts  loads trades + notes from Supabase, owns all mutations
  lib/supabase.ts      client, config validation, bucket name
  lib/cloudinary.ts    unsigned video uploads, byte progress, error messages
  lib/storage.ts       routes each file to Supabase or Cloudinary
  lib/media.ts         what may be attached, and image vs. video classification
  lib/rows.ts          snake_case row <-> camelCase domain mapping
  lib/recaps.ts        merges uploaded recaps with ones derived from trades
  lib/metrics.ts       day grouping, dashboard aggregates, month grid
  lib/format.ts        currency / duration / date formatting
  lib/instruments.ts   point values + the net points / net P&L math
  lib/tags.ts          default tag vocabulary (the live one lives in App state)
  components/          Header, Card + Stat, charts, modals, thumbnails,
                       TradeGalleryCard (shared by History and Notes)
  components/ui/       shadcn primitives (dialog, form, input, badge, ...)
  views/               Dashboard, CalendarView, History, VideoRecaps, Notes
  theme.ts             chart + P&L color tokens
```

## Data

Every row comes from Supabase; video files come from Cloudinary.
`useJournalData` fetches the tables once on mount and owns every mutation, so a
trade inserted in the Log Trade dialog appears on the dashboard, calendar and
history without a refetch.

`trades`, `daily_notes`, `tags` and `video_recaps` are stored. The recap library
mixes two kinds of entry: **derived** ones that `lib/recaps.ts` aggregates from
live trades, pulling each recap's notes from that day's journal entry, and
**uploaded** ones backed by a row in `video_recaps` and a real recording in
storage. An upload replaces the derived entry for the same period, since the
recording is the better artefact and two cards for one day would overstate how
much review exists.

Even for an uploaded recap the trade count, net P&L and equity curve are
computed from `trades` at render time rather than stored, so a recap can never
disagree with the trades it reviews.

Four load states are handled explicitly and all five views render with zero
rows: `unconfigured`, `loading`, `error` (with retry) and `ready`.

### Column names

The database uses `asset`/`side`/`contracts`/`net_pnl`/`execution_time` and
`tags.name`/`tags.category`, not the symbol/direction/lots/pnl the UI speaks
internally. `lib/rows.ts` is the only place that knows both vocabularies.

Two columns the UI could use do not exist, and the app degrades rather than
faking them — `supabase/schema.sql` has the one-line ALTERs if you want them:

- **no `trades.exit_time`** → holding time is unknown, so the three duration
  cards read `—` instead of `0s`.
- **no `daily_notes.title`** → the note heading is derived from the date and
  rendered as static text, rather than an input that would silently discard
  what you type.

### Key safety

`VITE_` variables are compiled into the client bundle and served to every
visitor, so only the **publishable** (`sb_publishable_…`) key belongs in
`VITE_SUPABASE_ANON_KEY`. `lib/supabase.ts` refuses to construct a client from
an `sb_secret_…` key and shows an explanatory screen instead — a secret key
bypasses row-level security entirely. The URL is also normalised, since pasting
the `/rest/v1/` REST endpoint from the dashboard would 404 every request. Roughly 196 trades over 54 sessions: ~50% win rate, winners held ~34m
against ~12m on losers, and an opening drawdown to about -$4.5k before the
curve recovers to +$6.6k.

Swapping in real trades means replacing the `TRADES` export with anything
matching the `Trade` interface in `src/types.ts` — nothing downstream reads the
generator directly.

## Views

All five read from the same seeded fixture, so a number in one view reconciles
with every other.

- **Dashboard** — aggregate metrics and the two P&L charts, on a 12-column bed
  so 4-, 3- and 2-across rows all divide evenly. The top row carries the edge
  metrics: win rate, average R:R, and the average winner/loser they come from.
  R:R guards its divide — a sample with no losing trades has no ratio and shows
  `—` rather than `Infinity`.
- **Calendar** — daily net P&L by month, with weekly totals.
- **History** — a Notion-style gallery of cover cards. A trade with media shows
  its first attachment cropped to a fixed band — a still for a screenshot, the
  poster frame plus a play badge for a recording; one without gets a gradient
  plate carrying the instrument as a watermark, so card heights stay uniform
  either way. Filterable by asset,
  direction and tag. Clicking a card opens a detail modal with the full
  execution grid (entry, exit, contracts, duration, gross, fees, net), the
  setups and mistakes recorded against it, and the attachment viewer. Gross is
  recovered as `net + commission` rather than recomputed, so the two figures in
  the grid can never disagree.
- **Video Recaps** — the daily/weekly session-review library, filterable by
  type and sortable by recency or runtime. Derived entries use the period's
  *own equity curve* as the poster frame rather than decoration — the shape of
  the session is the most informative thing a thumbnail can show, and it is
  drawn from the same trades the recap describes. **Upload Video Recap** adds a
  stand-alone review: the recording goes to the `trade-attachments` bucket under
  `recaps/`, and its card plays back in the detail modal.

- **Notes** — the daily journalling workspace, and the only surface that reads
  *and* writes. A context banner above the editors computes the day's net P&L,
  trade count, win rate and a Recharts equity sparkline from the selected note's
  date; below the write-up, "Trades Taken This Session" renders the History
  gallery cards filtered to that date, each opening the same Trade Detail modal.
  Note state lives in `App` rather than the view, so edits survive tab switches
  instead of resetting on unmount.

## Tags

Setup and mistake/emotion tags are editable at runtime through the Tag Manager
(the gear in the header). The live vocabulary lives in `App` state; `lib/tags.ts`
only supplies the defaults. The Log Trade form and the History tag-search
suggestions both read that state, so a tag added in one place is immediately
usable in the others.

Deleting a tag removes it from *future* selection only — trades already carrying
it keep it, and stay findable by search. Renames and deletes are staged in the
dialog and committed on Save, so an accidental delete can be abandoned with
Cancel. Duplicates are rejected case-insensitively.

## Auto-resizing editors

`AutoTextarea` measures in a **layout effect keyed on the value**, not on the
change event — switching notes replaces the text without any typing, and a
change-handler-only version would leave the previous note's height behind. It
adds the border width back onto `scrollHeight`: that property covers content and
padding but not the border, so under `border-box` sizing the border eats into
the content area and clips the last line.

## Background

`CosmicBackground` paints a fixed, `-z-10` backdrop: a black base, three faint
neutral depth gradients, three parallax star layers and a vignette. It is
deliberately **colourless** — the only hues on screen belong to data (green/red
P&L, blue/magenta direction), so the background never competes with them. Each
layer
is **one element carrying a long `box-shadow` list**, not one element per star —
several hundred DOM nodes for a decorative backdrop is not a trade worth making.
Positions come from a fixed seed so the sky never reshuffles on re-render, and
the twinkle animation is disabled under `prefers-reduced-motion`.

Cards use a single shared `GLASS` token (`bg-zinc-900/80 backdrop-blur-md
border-zinc-800`) so every surface reads consistently over the starfield. The
shadcn dark tokens in `index.css` are zero-chroma for the same reason.

## Color

P&L polarity uses `#0ca30c` / `#d03b3b`. That green/red pair is weak under
deuteranopia (CVD dE 4.1), so polarity is **never carried by hue alone**: every
value renders with an explicit `+`/`-` sign, and the daily bars encode sign by
position above or below the zero baseline.

The direction donut deliberately avoids red/green — it uses blue `#3987e5` and
magenta `#d55181` (CVD dE 15.9) so that identity never reads as polarity, with
a legend and direct percentage labels alongside.

## Log Trade

A react-hook-form + zod dialog. Execution fields on the left, qualitative tags
and the attachment dropzone on the right, with a live P&L card that recomputes
on every keystroke:

    netPoints = (exit - entry) * (Long ? 1 : -1)
    netPnl    = netPoints * contracts * multiplier - fees

Prices and size are held as **strings** in form state, not numbers, so a blank
field stays distinguishable from a zero — `Number('')` is `0`, which would
otherwise make an empty price look like a valid fill. Save stays disabled until
entry, exit and contracts are all non-blank.

## Attachments

Screenshots and screen recordings share one dropzone but **not** one backend:

| Kind | Goes to | Stored as |
| --- | --- | --- |
| `image/*` | Supabase `trade-attachments` bucket, under `trades/` | public object URL |
| video | Cloudinary, unsigned preset | `secure_url` |

Video is split off because Cloudinary transcodes and streams it, which Supabase
Storage does not, and because a screen capture is easily hundreds of megabytes
against a bucket limit sized for screenshots. Both paths return a plain URL into
the same `attachments` `text[]`, so nothing downstream has to know which service
an attachment came from. `lib/storage.ts` is the only place that routes.

The picker accepts `image/*` plus `video/mp4`, `video/webm` and
`video/quicktime`; a file dropped with an empty MIME type — which is what some
file managers hand over — falls back to its extension, so a `.MOV` is not
mistaken for an unsupported file. Anything else is refused by name in an inline
note rather than dropped silently.

On save the files upload **before** the row is inserted, sequentially, so a
trade never points at an upload that failed. The two services differ in what
they will tell you, and the indicator reflects that honestly: Cloudinary is
uploaded over `XMLHttpRequest` purely for `upload.onprogress`, so a video gets a
real filling bar and a percentage, while supabase-js exposes no byte counts at
all, so an image gets a sweeping bar and a lifecycle label instead of a number
that would be invented.

### Classifying a stored attachment

A viewer sees only a URL, so `lib/media.ts` classifies by URL shape and every
surface shares that one function:

- a Cloudinary URL whose path contains `/video/upload/` — the resource type is a
  path segment, and a transformed delivery URL may not end in `.mp4` at all
- anything ending `.mp4`, `.webm` or `.mov`, case-insensitively

Those render as `<video controls className="w-full rounded-lg">`; everything
else renders as a full-resolution image. A Cloudinary `/image/upload/` URL is
deliberately *not* a match. Only the image is wrapped in an open-in-a-tab link —
a link around a `<video>` would swallow clicks meant for the transport controls.

Upload failures are reported inline, named, with the fix: a recording over the
Cloudinary account's cap, a preset that was never switched to unsigned, a
cloud name that does not resolve. The dialog keeps every field either way,
because the notes are the expensive part of the form.

## Gotcha: typechecking

`npx tsc --noEmit` at the repo root checks **zero files** — the root tsconfig is
solution-style (`"files": []` plus references), so it has nothing to check and
exits 0 on a file with a syntax error in it. Use `npm run build` or `npx tsc -b`,
which walk the referenced projects (~635 files).

## Not built yet

Trades, notes, tags and uploaded recaps all persist. The Tag Manager stages
edits and, on Save, issues one insert/update/delete per actual change rather
than rewriting the table, so tag ids stay stable. Notes auto-save on a 900ms
debounce; the indicator reports the real outcome, including failures.

What is still missing:

- **No editing or deleting.** Attachments can be added to a trade only when it
  is first logged, and neither a trade nor an uploaded recap can be changed or
  removed from the UI afterwards.
- **A failed insert can orphan an upload.** Files go up before the row goes in,
  which is the right order — but if the insert then fails, the objects stay in
  the bucket (or in Cloudinary) with nothing referencing them. Nothing cleans
  them up, and deleting a Cloudinary asset would need a signed request the
  browser cannot make.
- **Derived recaps have no recording**, and say so rather than implying one
  exists. Their runtime is an estimate from trade count; an uploaded recap
  reports the real duration read off the file.
- **Poster frames for uploaded recaps are still the equity curve**, not a frame
  from the video — Cloudinary can generate one from the same public id, but
  nothing requests it yet.
