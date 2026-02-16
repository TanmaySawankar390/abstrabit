# Smart Bookmark App

## Live URL

- Add the deployed Vercel URL here after deployment.

## GitHub Repo

- Add the public GitHub repo URL here.

## Features

- Google-only authentication (Supabase Auth + Google OAuth)
- Private bookmarks per user (Supabase RLS)
- Add and delete bookmarks
- Realtime updates across tabs (Supabase Realtime)

## Tech Stack

- Next.js App Router
- Supabase (Auth, Database, Realtime)
- Tailwind CSS

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create a Supabase project and enable Google OAuth in Auth Providers.
3. Create the database table and policies in Supabase SQL editor:

```sql
create table if not exists public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  url text not null,
  inserted_at timestamptz not null default now()
);

alter table public.bookmarks enable row level security;

create policy "Users can view their bookmarks"
on public.bookmarks
for select
using (auth.uid() = user_id);

create policy "Users can insert their bookmarks"
on public.bookmarks
for insert
with check (auth.uid() = user_id);

create policy "Users can delete their bookmarks"
on public.bookmarks
for delete
using (auth.uid() = user_id);
```

4. Enable Realtime for the bookmarks table in the Supabase dashboard.
5. Add environment variables in a `.env.local` file:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

6. Start the dev server:

```bash
npm run dev
```

## Deployment (Vercel)

1. Push the repository to GitHub.
2. Import the repo in Vercel.
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to Vercel environment variables.
4. In Supabase Auth settings, add the Vercel domain to the Google OAuth redirect URLs.

## Problems Encountered and Solutions

- Realtime updates were duplicating inserts, so the client filters new rows by ID to avoid duplicates.
- Supabase OAuth required an exact redirect URL; the solution was to set the redirect URL to the Vercel domain and use `window.location.origin` locally.
- Bookmarks must remain private, so RLS policies were added for select, insert, and delete to enforce per-user access.
