-- Shared cross-device multiplayer room directory.
-- All writes go through narrowly-scoped RPCs; the browser anon key cannot
-- directly modify room rows or read host capabilities.

create table if not exists public.rooms (
  room_code text primary key check (room_code ~ '^[A-Z0-9]{6}$'),
  host_id text not null,
  host_name text not null check (length(host_name) between 1 and 40),
  map text not null check (length(map) between 1 and 64),
  weather smallint not null check (weather between 0 and 2),
  player_count integer not null default 1 check (player_count between 1 and 4),
  max_players integer not null default 4 check (max_players between 1 and 4),
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '20 seconds')
);

create index if not exists rooms_active_public_idx
  on public.rooms (is_public, created_at desc)
  where is_public = true;

create table if not exists public.room_host_secrets (
  room_code text primary key references public.rooms (room_code) on delete cascade,
  host_token text not null
);

create table if not exists public.room_members (
  room_code text not null references public.rooms (room_code) on delete cascade,
  player_id text not null,
  joined_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  primary key (room_code, player_id)
);

alter table public.rooms enable row level security;
alter table public.room_host_secrets enable row level security;
alter table public.room_members enable row level security;

revoke all on table public.rooms from anon, authenticated;
revoke all on table public.room_host_secrets from anon, authenticated;
revoke all on table public.room_members from anon, authenticated;
grant select (room_code, host_id, host_name, map, weather, player_count, max_players, is_public, created_at, updated_at, expires_at)
  on table public.rooms to anon, authenticated;

drop policy if exists "Active public rooms are visible to everyone" on public.rooms;
create policy "Active public rooms are visible to everyone"
  on public.rooms for select
  to anon, authenticated
  using (is_public and expires_at > now());

create or replace function public.create_public_room(
  p_room_code text,
  p_host_id text,
  p_host_name text,
  p_map text,
  p_weather smallint,
  p_host_token text
)
returns setof public.rooms
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_code text := upper(trim(p_room_code));
  normalized_name text := trim(p_host_name);
  created public.rooms%rowtype;
begin
  if normalized_code !~ '^[A-Z0-9]{6}$' then raise exception 'Room code must contain six letters or numbers.'; end if;
  if coalesce(length(trim(p_host_id)), 0) < 8 or length(trim(p_host_id)) > 128 then raise exception 'Invalid host identifier.'; end if;
  if coalesce(length(normalized_name), 0) < 1 or length(normalized_name) > 40 then raise exception 'Host name must be 1-40 characters.'; end if;
  if coalesce(length(trim(p_map)), 0) < 1 or length(trim(p_map)) > 64 then raise exception 'Invalid track map.'; end if;
  if p_weather not between 0 and 2 then raise exception 'Invalid weather selection.'; end if;
  if coalesce(length(p_host_token), 0) < 48 or length(p_host_token) > 256 then raise exception 'Invalid host capability.'; end if;

  -- Remove expired rows so room codes can be safely reused after their lease ends.
  delete from public.rooms as stale where stale.expires_at <= now();

  insert into public.rooms (room_code, host_id, host_name, map, weather, player_count, max_players, is_public, expires_at)
  values (normalized_code, trim(p_host_id), normalized_name, trim(p_map), p_weather, 1, 4, true, now() + interval '20 seconds')
  returning * into created;

  insert into public.room_host_secrets (room_code, host_token) values (normalized_code, p_host_token);
  insert into public.room_members (room_code, player_id) values (normalized_code, trim(p_host_id));
  return next created;
end;
$$;

create or replace function public.join_room_by_code(p_room_code text, p_player_id text)
returns setof public.rooms
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_code text := upper(trim(p_room_code));
  normalized_player text := trim(p_player_id);
  room public.rooms%rowtype;
  already_joined boolean;
  current_count integer;
begin
  if normalized_code !~ '^[A-Z0-9]{6}$' or coalesce(length(normalized_player), 0) < 8 or length(normalized_player) > 128 then
    raise exception 'Enter a valid room code and player identifier.';
  end if;
  select * into room from public.rooms as r where r.room_code = normalized_code and r.expires_at > now() for update;
  if not found then raise exception 'That room is no longer active.'; end if;

  delete from public.room_members as m
    where m.room_code = normalized_code and m.last_seen < now() - interval '20 seconds';
  select exists(select 1 from public.room_members as m where m.room_code = normalized_code and m.player_id = normalized_player)
    into already_joined;
  select count(*)::integer into current_count from public.room_members as m where m.room_code = normalized_code;
  if not already_joined and current_count >= room.max_players then raise exception 'That room is full.'; end if;

  insert into public.room_members (room_code, player_id, last_seen)
  values (normalized_code, normalized_player, now())
  on conflict (room_code, player_id) do update set last_seen = now();
  update public.rooms as r
    set player_count = (select count(*)::integer from public.room_members as m where m.room_code = normalized_code),
        updated_at = now()
    where r.room_code = normalized_code
    returning r.* into room;
  return next room;
end;
$$;

create or replace function public.heartbeat_public_room(
  p_room_code text,
  p_player_id text,
  p_host_token text default null,
  p_host_name text default null,
  p_map text default null,
  p_weather smallint default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_code text := upper(trim(p_room_code));
  normalized_player text := trim(p_player_id);
  room public.rooms%rowtype;
  is_host boolean;
  member_exists boolean;
  current_count integer;
begin
  select * into room from public.rooms as r where r.room_code = normalized_code and r.expires_at > now() for update;
  if not found then raise exception 'That room has expired.'; end if;

  is_host := normalized_player = room.host_id;
  if is_host and not exists (
    select 1 from public.room_host_secrets as s where s.room_code = normalized_code and s.host_token = p_host_token
  ) then raise exception 'Host authorization failed.'; end if;

  delete from public.room_members as m
    where m.room_code = normalized_code and m.player_id <> normalized_player and m.last_seen < now() - interval '20 seconds';
  select exists(select 1 from public.room_members as m where m.room_code = normalized_code and m.player_id = normalized_player)
    into member_exists;
  select count(*)::integer into current_count from public.room_members as m where m.room_code = normalized_code;
  if not member_exists and current_count >= room.max_players then raise exception 'That room is full.'; end if;

  insert into public.room_members (room_code, player_id, last_seen)
  values (normalized_code, normalized_player, now())
  on conflict (room_code, player_id) do update set last_seen = now();
  update public.rooms as r
    set player_count = (select count(*)::integer from public.room_members as m where m.room_code = normalized_code),
        host_name = case when is_host and p_host_name is not null then left(trim(p_host_name), 40) else r.host_name end,
        map = case when is_host and p_map is not null then left(trim(p_map), 64) else r.map end,
        weather = case when is_host and p_weather between 0 and 2 then p_weather else r.weather end,
        updated_at = now(),
        expires_at = case when is_host then now() + interval '20 seconds' else r.expires_at end
    where r.room_code = normalized_code;
end;
$$;

create or replace function public.leave_public_room(p_room_code text, p_player_id text, p_host_token text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_code text := upper(trim(p_room_code));
  normalized_player text := trim(p_player_id);
  room public.rooms%rowtype;
begin
  select * into room from public.rooms as r where r.room_code = normalized_code for update;
  if not found then return; end if;

  if normalized_player = room.host_id then
    if not exists (
      select 1 from public.room_host_secrets as s where s.room_code = normalized_code and s.host_token = p_host_token
    ) then raise exception 'Host authorization failed.'; end if;
    delete from public.rooms as r where r.room_code = normalized_code;
    return;
  end if;

  delete from public.room_members as m where m.room_code = normalized_code and m.player_id = normalized_player;
  update public.rooms as r
    set player_count = greatest(1, (select count(*)::integer from public.room_members as m where m.room_code = normalized_code)),
        updated_at = now()
    where r.room_code = normalized_code;
end;
$$;

revoke all on function public.create_public_room(text, text, text, text, smallint, text) from public;
revoke all on function public.join_room_by_code(text, text) from public;
revoke all on function public.heartbeat_public_room(text, text, text, text, text, smallint) from public;
revoke all on function public.leave_public_room(text, text, text) from public;
grant execute on function public.create_public_room(text, text, text, text, smallint, text) to anon, authenticated;
grant execute on function public.join_room_by_code(text, text) to anon, authenticated;
grant execute on function public.heartbeat_public_room(text, text, text, text, text, smallint) to anon, authenticated;
grant execute on function public.leave_public_room(text, text, text) to anon, authenticated;
