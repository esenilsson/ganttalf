-- Ganttalf schema: per-user charts + tokenized live sharing.
-- Apply in the Supabase SQL editor (or `supabase db push`).

create table public.charts (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (length(trim(name)) between 1 and 200),
  data        jsonb not null check (jsonb_typeof(data -> 'rows') = 'array'),
  share_token text unique check (share_token is null or length(share_token) >= 16),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index charts_owner_updated_idx on public.charts (owner, updated_at desc);

alter table public.charts enable row level security;

-- Owners see and manage only their own charts. No policies for anon at all.
create policy "select own" on public.charts
  for select to authenticated
  using (owner = (select auth.uid()));

create policy "insert own" on public.charts
  for insert to authenticated
  with check (owner = (select auth.uid()));

create policy "update own" on public.charts
  for update to authenticated
  using (owner = (select auth.uid()))
  with check (owner = (select auth.uid()));

create policy "delete own" on public.charts
  for delete to authenticated
  using (owner = (select auth.uid()));

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger charts_set_updated_at
  before update on public.charts
  for each row execute function public.set_updated_at();

-- The ONLY anonymous read path: exact-token lookup, definer bypasses RLS.
-- Returns 0 or 1 rows; never exposes id or owner, and shared charts are not listable.
create or replace function public.get_shared_chart(p_token text)
returns table (name text, data jsonb, updated_at timestamptz)
language sql
security definer
set search_path = ''
stable
as $$
  select c.name, c.data, c.updated_at
  from public.charts c
  where c.share_token = p_token
    and p_token is not null
    and length(p_token) >= 16
$$;

revoke all on function public.get_shared_chart(text) from public;
grant execute on function public.get_shared_chart(text) to anon, authenticated;
