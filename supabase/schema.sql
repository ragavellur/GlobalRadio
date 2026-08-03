-- Global Radio Explorer — Supabase schema
-- Idempotent: safe to re-run in Supabase Dashboard -> SQL Editor

-- ============================================================================
-- FAVORITES
-- ============================================================================
create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  country_code text not null,
  city text not null,
  city_key text not null,
  station_name text not null,
  station_url text not null,
  created_at timestamptz not null default now(),
  unique (user_id, station_url)
);

alter table public.favorites enable row level security;

drop policy if exists "own select" on public.favorites;
create policy "own select" on public.favorites
  for select using (auth.uid() = user_id);

drop policy if exists "own insert" on public.favorites;
create policy "own insert" on public.favorites
  for insert with check (auth.uid() = user_id);

drop policy if exists "own delete" on public.favorites;
create policy "own delete" on public.favorites
  for delete using (auth.uid() = user_id);

-- ============================================================================
-- PROFILES
-- Public identity for signed-in users (mirrors auth.users)
-- ============================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  country text,
  city text,
  city_key text,
  station_url text,
  station_name text,
  last_active_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create a profile row when a user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'name', ''), new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture', null)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;

drop policy if exists "profiles public read" on public.profiles;
create policy "profiles public read" on public.profiles
  for select using (true);

drop policy if exists "profiles own update" on public.profiles;
create policy "profiles own update" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- ============================================================================
-- PRESENCE
-- One row per active browser/device ("listening now" = last_seen < 30s ago)
-- ============================================================================
create table if not exists public.presence (
  id uuid primary key default gen_random_uuid(),
  device_id text not null unique,
  user_id uuid references public.profiles(id) on delete cascade,
  station_url text not null,
  station_name text not null,
  city_key text not null,
  city text not null,
  country text not null,
  last_seen timestamptz not null default now()
);

create index if not exists presence_city_idx on public.presence (city_key, last_seen desc);
create index if not exists presence_station_idx on public.presence (station_url, last_seen desc);

alter table public.presence enable row level security;

drop policy if exists "presence public read" on public.presence;
create policy "presence public read" on public.presence
  for select using (true);

drop policy if exists "presence insert" on public.presence;
create policy "presence insert" on public.presence
  for insert with check (
    (user_id is null and device_id is not null)
    or (user_id = auth.uid())
  );

drop policy if exists "presence update" on public.presence;
create policy "presence update" on public.presence
  for update using (user_id is null or user_id = auth.uid())
  with check (
    (user_id is null and device_id is not null)
    or (user_id = auth.uid())
  );

-- Keep each signed-in user's last-known location & station fresh from presence.
create or replace function public.profile_geo_from_presence()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.user_id is not null then
    update public.profiles
    set country = new.country,
        city = new.city,
        city_key = new.city_key,
        station_url = new.station_url,
        station_name = new.station_name,
        last_active_at = new.last_seen,
        updated_at = now()
    where id = new.user_id
      and (
        country is distinct from new.country
        or city is distinct from new.city
        or city_key is distinct from new.city_key
        or station_url is distinct from new.station_url
        or station_name is distinct from new.station_name
        or last_active_at is null
        or new.last_seen - last_active_at > interval '5 minutes'
      );
  end if;
  return new;
end;
$$;

drop trigger if exists presence_geo on public.presence;
create trigger presence_geo
  after insert or update on public.presence
  for each row execute function public.profile_geo_from_presence();

-- Live stations rollup: stations with at least one active listener
create or replace function public.get_live_stations()
returns table (
  station_url text,
  station_name text,
  city_key text,
  city text,
  country text,
  listeners bigint
)
language sql stable
as $$
  select
    p.station_url,
    p.station_name,
    p.city_key,
    p.city,
    p.country,
    count(*)::bigint as listeners
  from public.presence p
  where p.last_seen > now() - interval '30 seconds'
  group by p.station_url, p.station_name, p.city_key, p.city, p.country
  order by count(*) desc
$$;

grant execute on function public.get_live_stations() to anon, authenticated;

-- ============================================================================
-- USER DIRECTORY
-- All signed-up users with their last-known location/station and live status.
-- Scoped by country (code), city_key ("City,CC") or station_url when provided.
-- ============================================================================
create or replace function public.get_user_directory(
  p_country text default null,
  p_city_key text default null,
  p_station_url text default null
)
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  online boolean,
  country text,
  city text,
  station_url text,
  station_name text,
  last_active_at timestamptz
)
language sql stable
security definer set search_path = public
as $$
  select
    p.id as user_id,
    p.display_name,
    p.avatar_url,
    exists (
      select 1 from public.presence pr
      where pr.user_id = p.id
        and pr.last_seen > now() - interval '30 seconds'
    ) as online,
    p.country,
    p.city,
    p.station_url,
    p.station_name,
    p.last_active_at
  from public.profiles p
  where
    (p_country is null or p.country = p_country)
    and (p_city_key is null or p.city_key = p_city_key)
    and (p_station_url is null or p.station_url = p_station_url)
  order by (p.last_active_at is not null) desc, p.last_active_at desc nulls last, p.display_name asc
  limit 1000;
$$;

revoke all on function public.get_user_directory(text, text, text) from public;
grant execute on function public.get_user_directory(text, text, text) to anon, authenticated;

-- ============================================================================
-- ROOM MESSAGES
-- Group chat for city rooms and station rooms. room_id is a hex sha-256 of
-- "city:<cityKey>" or "station:<stationUrl>" (url-safe for realtime filters).
-- ============================================================================
create table if not exists public.room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id text not null,
  room_name text not null,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

create index if not exists room_messages_room_idx on public.room_messages (room_id, created_at);

alter table public.room_messages enable row level security;

drop policy if exists "room public read" on public.room_messages;
create policy "room public read" on public.room_messages
  for select using (deleted_at is null);

drop policy if exists "room signed-in insert" on public.room_messages;
create policy "room signed-in insert" on public.room_messages
  for insert with check (auth.uid() = sender_id);

drop policy if exists "room own update" on public.room_messages;
create policy "room own update" on public.room_messages
  for update using (auth.uid() = sender_id)
  with check (auth.uid() = sender_id);

-- ============================================================================
-- DIRECT MESSAGES (1:1)
-- ============================================================================
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index if not exists conversation_participants_user_idx on public.conversation_participants (user_id);

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists direct_messages_conv_idx on public.direct_messages (conversation_id, created_at);

-- Start (or find) a 1:1 conversation with another user.
-- Security definer so it can atomically create conversation + both participants.
create or replace function public.get_or_create_dm(p_peer uuid)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  conv uuid;
begin
  if me is null then
    raise exception 'not authenticated';
  end if;
  if me = p_peer then
    raise exception 'cannot start a conversation with yourself';
  end if;
  select c.conversation_id into conv
  from public.conversation_participants c
  join public.conversation_participants d on d.conversation_id = c.conversation_id
  where c.user_id = me and d.user_id = p_peer
  limit 1;
  if conv is null then
    insert into public.conversations default values returning id into conv;
    insert into public.conversation_participants (conversation_id, user_id)
    values (conv, me), (conv, p_peer);
  end if;
  return conv;
end;
$$;

revoke execute on function public.get_or_create_dm(uuid) from public, anon;
grant execute on function public.get_or_create_dm(uuid) to authenticated;

alter table public.conversations enable row level security;

-- Helper: is the current user a participant of this conversation?
-- Security definer so RLS policies can check membership without recursing
-- into the conversation_participants policies.
create or replace function public.is_dm_participant(p_conv uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = p_conv and user_id = auth.uid()
  );
$$;

revoke all on function public.is_dm_participant(uuid) from public;
grant execute on function public.is_dm_participant(uuid) to anon, authenticated;

drop policy if exists "conv participant select" on public.conversations;
create policy "conv participant select" on public.conversations
  for select using (
    public.is_dm_participant(id)
  );

alter table public.conversation_participants enable row level security;

drop policy if exists "cp participant select" on public.conversation_participants;
create policy "cp participant select" on public.conversation_participants
  for select using (
    public.is_dm_participant(conversation_id)
  );

drop policy if exists "cp own update" on public.conversation_participants;
create policy "cp own update" on public.conversation_participants
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.direct_messages enable row level security;

drop policy if exists "dm participant select" on public.direct_messages;
create policy "dm participant select" on public.direct_messages
  for select using (
    public.is_dm_participant(conversation_id)
  );

drop policy if exists "dm participant insert" on public.direct_messages;
create policy "dm participant insert" on public.direct_messages
  for insert with check (
    sender_id = auth.uid()
    and public.is_dm_participant(conversation_id)
  );

-- ============================================================================
-- NOTIFICATIONS (in-app)
-- ============================================================================
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('dm', 'mention', 'reply', 'system')),
  title text not null,
  body text not null default '',
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

-- Notify the other participant when a DM is sent (security definer so the
-- sender can insert a notification for the recipient).
create or replace function public.notify_dm()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  other uuid;
begin
  select cp.user_id into other
  from public.conversation_participants cp
  where cp.conversation_id = new.conversation_id and cp.user_id <> new.sender_id
  limit 1;
  if other is not null then
    insert into public.notifications (user_id, type, title, body)
    values (
      other,
      'dm',
      coalesce((select display_name from public.profiles where id = new.sender_id), 'Someone'),
      left(new.body, 120)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists direct_messages_notify on public.direct_messages;
create trigger direct_messages_notify
  after insert on public.direct_messages
  for each row execute function public.notify_dm();

alter table public.notifications enable row level security;

drop policy if exists "notif own select" on public.notifications;
create policy "notif own select" on public.notifications
  for select using (auth.uid() = user_id);

drop policy if exists "notif own update" on public.notifications;
create policy "notif own update" on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- REALTIME + pg_cron
-- ============================================================================
do $$
begin
  alter publication supabase_realtime add table public.room_messages;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.direct_messages;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.conversation_participants;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end $$;

create extension if not exists pg_cron;

-- Purge stale presence rows every 2 minutes
select cron.unschedule('presence-purge') where exists (select 1 from cron.job where jobname = 'presence-purge');
select cron.schedule('presence-purge', '*/2 * * * *',
  $$delete from public.presence where last_seen < now() - interval '90 seconds'$$);

-- ============================================================================
-- HEARTBEAT
-- Single consolidated RPC: presence upsert + city listener data + unread DMs.
-- Called every ~10s while the app is active. Replaces the separate presence
-- upsert, city-listener poll, and 15s DM-inbox poll.
-- ============================================================================
create or replace function public.heartbeat(
  p_device_id text,
  p_station_url text,
  p_station_name text,
  p_city_key text,
  p_city text,
  p_country text,
  p_skip_presence boolean default false
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  cutoff timestamptz := now() - interval '30 seconds';
  city_json jsonb;
  unread_json jsonb;
begin
  if not p_skip_presence and p_device_id is not null and p_station_url <> '' then
    insert into public.presence (device_id, user_id, station_url, station_name, city_key, city, country, last_seen)
    values (p_device_id, me, p_station_url, p_station_name, p_city_key, p_city, p_country, now())
    on conflict (device_id) do update
    set user_id = excluded.user_id,
        station_url = excluded.station_url,
        station_name = excluded.station_name,
        city_key = excluded.city_key,
        city = excluded.city,
        country = excluded.country,
        last_seen = excluded.last_seen;
  end if;

  select jsonb_build_object(
    'count', (select count(*)::int from public.presence where city_key = p_city_key and last_seen > cutoff),
    'byStation', coalesce((
      select jsonb_object_agg(sq.station_url, sq.cnt)
      from (
        select station_url, count(*)::int as cnt
        from public.presence
        where city_key = p_city_key and last_seen > cutoff
        group by station_url
      ) sq
    ), '{}'::jsonb),
    'listeners', coalesce((
      select jsonb_agg(row_to_json(l)::jsonb)
      from (
        select pr.device_id, pr.user_id, pr.station_url, pr.station_name, pr.city_key,
               pf.display_name, pf.avatar_url
        from public.presence pr
        left join public.profiles pf on pf.id = pr.user_id
        where pr.city_key = p_city_key and pr.last_seen > cutoff
        order by pr.last_seen desc
        limit 200
      ) l
    ), '[]'::jsonb)
  ) into city_json;

  if me is not null then
    select coalesce(
      jsonb_agg(jsonb_build_object(
        'conversation_id', u.conversation_id,
        'unread', u.unread,
        'last_created_at', u.last_created_at
      )),
      '[]'::jsonb
    )
    into unread_json
    from (
      select cp.conversation_id, u.unread, u.last_created_at
      from public.conversation_participants cp
      cross join lateral (
        select count(*)::int as unread, max(created_at) as last_created_at
        from public.direct_messages dm
        where dm.conversation_id = cp.conversation_id
          and dm.sender_id <> me
          and dm.created_at > cp.last_read_at
      ) u
      where cp.user_id = me and u.unread > 0
    ) u;
  else
    unread_json := '[]'::jsonb;
  end if;

  return jsonb_build_object('city', city_json, 'unread', unread_json);
end;
$$;

revoke all on function public.heartbeat(text, text, text, text, text, text, boolean) from public;
grant execute on function public.heartbeat(text, text, text, text, text, text, boolean) to anon, authenticated;
