-- Create session_activity_logs table for tracking history
create table if not exists public.session_activity_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  action_type text not null, -- 'edit_document', 'join_session', etc.
  details jsonb, -- e.g. { "entity_type": "npc", "entity_name": "Goblin" }
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.session_activity_logs enable row level security;

-- Policies
create policy "Anyone can read activity logs for campaigns they are in"
  on public.session_activity_logs for select
  using (
    exists (
      select 1 from public.sessions s
      join public.campaign_members cm on s.campaign_id = cm.campaign_id
      where s.id = session_activity_logs.session_id
      and cm.user_id = auth.uid()
    )
  );

create policy "Users can insert their own activity"
  on public.session_activity_logs for insert
  with check (
    auth.uid() = user_id
  );
