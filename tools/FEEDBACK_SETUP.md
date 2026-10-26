# Bug reports and ideas: one-time setup

The Feedback button (game pages), the "Report a bug" footer link, the dynasty Settings box and the
About page "Send" button all write to a Supabase table called `feedback`. Anyone can send (no sign-in);
only the admin emails below can read or update. Until this table exists, reports fall back to email.

1. Open the Supabase project (ioeylazercmmafxutouj) > SQL Editor > New query.
2. Paste and run:

```sql
create table if not exists public.feedback (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind text not null default 'bug' check (kind in ('bug','idea','fix','other')),
  area text check (char_length(area) <= 200),
  message text not null check (char_length(message) between 3 and 4000),
  contact text check (char_length(contact) <= 200),
  page text check (char_length(page) <= 300),
  meta jsonb,
  status text not null default 'new' check (status in ('new','seen','fixed','wontfix'))
);
alter table public.feedback enable row level security;
grant insert on public.feedback to anon, authenticated;
grant select, update on public.feedback to authenticated;
-- anyone can send a report (it always arrives as "new")
create policy "anyone can send" on public.feedback for insert to anon, authenticated with check (status = 'new');
-- only the admin can read and update (change the email if you sign in with another)
create policy "admin reads" on public.feedback for select to authenticated using ((auth.jwt() ->> 'email') = 'thevolindex@gmail.com');
create policy "admin updates" on public.feedback for update to authenticated using ((auth.jwt() ->> 'email') = 'thevolindex@gmail.com');
```

3. Read reports at volindex.net/about/inbox after signing in on My games with that email
   (or in Supabase > Table Editor > feedback).

Optional: email alerts for each new report: Supabase > Database > Webhooks, or check the inbox daily.
