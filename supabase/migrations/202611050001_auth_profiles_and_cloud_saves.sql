-- City of Speedrunners account profiles and cloud garage saves.
-- Run this migration in the Supabase SQL editor or with the Supabase CLI.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  display_name text not null,
  level integer not null default 1 check (level between 1 and 99),
  rank text not null default 'ROOKIE',
  save_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[A-Za-z0-9_]{3,20}$')
);

create unique index if not exists profiles_username_lower_unique
  on public.profiles (lower(username));

alter table public.profiles enable row level security;
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (display_name, save_data) on table public.profiles to authenticated;

drop policy if exists "Profiles are readable by their owner" on public.profiles;
create policy "Profiles are readable by their owner"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "Profiles are editable by their owner" on public.profiles;
create policy "Profiles are editable by their owner"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create or replace function public.is_username_available(candidate text)
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select candidate ~ '^[A-Za-z0-9_]{3,20}$'
    and not exists (
      select 1 from public.profiles
      where lower(username) = lower(trim(candidate))
    );
$$;

revoke all on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to anon, authenticated;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  requested_username text := trim(coalesce(new.raw_user_meta_data ->> 'username', ''));
  requested_display_name text := trim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  requested_save jsonb := new.raw_user_meta_data -> 'save_data';
begin
  if requested_username !~ '^[A-Za-z0-9_]{3,20}$' then
    raise exception 'Username must be 3-20 letters, numbers, or underscores.';
  end if;

  insert into public.profiles (id, username, display_name, level, rank, save_data)
  values (
    new.id,
    requested_username,
    coalesce(nullif(requested_display_name, ''), requested_username),
    1,
    'ROOKIE',
    case when jsonb_typeof(requested_save) = 'object' then requested_save else '{}'::jsonb end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute procedure public.handle_new_auth_user();

create or replace function public.touch_profile_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
before update on public.profiles
for each row execute procedure public.touch_profile_updated_at();
