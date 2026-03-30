-- Scribe's Quill MVP schema
-- Run in Supabase SQL editor or via supabase migration tooling.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Adventurer',
  avatar_url text,
  plan text not null default 'free',
  created_at timestamptz not null default now()
);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  invite_code uuid not null default gen_random_uuid() unique,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.campaign_members (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (campaign_id, user_id)
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  name text not null,
  session_date date,
  created_by uuid references public.profiles(id),
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.session_notes (
  session_id uuid primary key references public.sessions(id) on delete cascade,
  content_md text,
  liveblocks_id text,
  updated_at timestamptz not null default now()
);

create table if not exists public.entity_tags (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  label text not null,
  tag_type text not null check (tag_type in ('npc', 'location', 'item')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user_profile();

alter table public.profiles enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_members enable row level security;
alter table public.sessions enable row level security;
alter table public.session_notes enable row level security;
alter table public.entity_tags enable row level security;

drop policy if exists "profiles read all authenticated" on public.profiles;
create policy "profiles read all authenticated"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "profiles update own row" on public.profiles;
create policy "profiles update own row"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "campaigns create own" on public.campaigns;
create policy "campaigns create own"
  on public.campaigns for insert
  to authenticated
  with check (created_by = auth.uid() or created_by is null);

drop policy if exists "campaigns read membership" on public.campaigns;
create policy "campaigns read membership"
  on public.campaigns for select
  to authenticated
  using (
    exists (
      select 1 from public.campaign_members cm
      where cm.campaign_id = campaigns.id and cm.user_id = auth.uid()
    )
    or campaigns.created_by = auth.uid()
  );

drop policy if exists "campaigns update owner" on public.campaigns;
create policy "campaigns update owner"
  on public.campaigns for update
  to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

drop policy if exists "campaigns delete owner" on public.campaigns;
create policy "campaigns delete owner"
  on public.campaigns for delete
  to authenticated
  using (created_by = auth.uid());

drop policy if exists "campaign_members read own campaign" on public.campaign_members;
create policy "campaign_members read own campaign"
  on public.campaign_members for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.campaign_members me
      where me.campaign_id = campaign_members.campaign_id and me.user_id = auth.uid()
    )
  );

drop policy if exists "campaign_members join self" on public.campaign_members;
create policy "campaign_members join self"
  on public.campaign_members for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "sessions read campaign members" on public.sessions;
create policy "sessions read campaign members"
  on public.sessions for select
  to authenticated
  using (
    exists (
      select 1 from public.campaign_members cm
      where cm.campaign_id = sessions.campaign_id and cm.user_id = auth.uid()
    )
  );

drop policy if exists "sessions write campaign members" on public.sessions;
create policy "sessions write campaign members"
  on public.sessions for all
  to authenticated
  using (
    exists (
      select 1 from public.campaign_members cm
      where cm.campaign_id = sessions.campaign_id and cm.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.campaign_members cm
      where cm.campaign_id = sessions.campaign_id and cm.user_id = auth.uid()
    )
  );

drop policy if exists "session_notes access by session membership" on public.session_notes;
create policy "session_notes access by session membership"
  on public.session_notes for all
  to authenticated
  using (
    exists (
      select 1
      from public.sessions s
      join public.campaign_members cm on cm.campaign_id = s.campaign_id
      where s.id = session_notes.session_id and cm.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.sessions s
      join public.campaign_members cm on cm.campaign_id = s.campaign_id
      where s.id = session_notes.session_id and cm.user_id = auth.uid()
    )
  );

drop policy if exists "entity_tags access by campaign membership" on public.entity_tags;
create policy "entity_tags access by campaign membership"
  on public.entity_tags for all
  to authenticated
  using (
    exists (
      select 1 from public.campaign_members cm
      where cm.campaign_id = entity_tags.campaign_id and cm.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.campaign_members cm
      where cm.campaign_id = entity_tags.campaign_id and cm.user_id = auth.uid()
    )
  );
