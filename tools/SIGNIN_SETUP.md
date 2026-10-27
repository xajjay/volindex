# Turning on sign-in for "My games"

The site works without accounts: streaks and results are saved in each browser, and the My games page has a
transfer code for moving progress between devices. Sign-in adds automatic syncing. It uses Supabase (free tier):
email magic links, no passwords to store.

1. Create a free account and a new project at https://supabase.com (you do this; it needs your email).
2. In the project: **SQL editor** → run:

   ```sql
   create table public.progress (
     user_id uuid primary key references auth.users on delete cascade,
     data jsonb not null default '{}'::jsonb,
     updated_at timestamptz not null default now()
   );
   alter table public.progress enable row level security;
   create policy "own row read"   on public.progress for select using (auth.uid() = user_id);
   create policy "own row insert" on public.progress for insert with check (auth.uid() = user_id);
   create policy "own row update" on public.progress for update using (auth.uid() = user_id);
   ```

3. **Authentication → URL configuration**: set Site URL to `https://www.volindex.net` and add
   `https://www.volindex.net/me` to the redirect URLs. To test sign-in on the local preview, also add
   `http://127.0.0.1:8765/**` (otherwise the email link sends you to the live site).
4. **Project settings → API**: copy the Project URL and the `anon` public key into `assets/auth-config.js`.
5. Deploy. The My games page now shows "Email me a sign-in link"; after signing in, progress merges and syncs
   after every finished daily.

6. **Dynasty cloud saves** (football, hoops, baseball, softball). In the **SQL editor**, run once:

   ```sql
   create table public.dynasty_saves (
     user_id uuid not null references auth.users on delete cascade,
     game text not null,             -- football, mbb, wbb, baseball, softball
     slot int not null,              -- 1 to 3
     data text not null,             -- the gzip-compressed save, base64
     meta jsonb not null default '{}'::jsonb,
     updated_at timestamptz not null default now(),
     primary key (user_id, game, slot)
   );
   alter table public.dynasty_saves enable row level security;
   create policy "own saves read"   on public.dynasty_saves for select using (auth.uid() = user_id);
   create policy "own saves insert" on public.dynasty_saves for insert with check (auth.uid() = user_id);
   create policy "own saves update" on public.dynasty_saves for update using (auth.uid() = user_id);
   create policy "own saves delete" on public.dynasty_saves for delete using (auth.uid() = user_id);
   ```

   Signed-in players' saves then back up automatically (a few seconds after each save, and when they leave the
   page), and each dynasty's start page lists the saves in their account with a Load button.
