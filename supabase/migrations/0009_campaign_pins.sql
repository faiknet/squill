-- Per-user pinned campaigns.

create table if not exists public.campaign_pins (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  pinned_at timestamptz not null default now(),
  primary key (campaign_id, user_id)
);

alter table public.campaign_pins enable row level security;

drop policy if exists "campaign_pins read own" on public.campaign_pins;
create policy "campaign_pins read own"
  on public.campaign_pins for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "campaign_pins upsert own membership" on public.campaign_pins;
create policy "campaign_pins upsert own membership"
  on public.campaign_pins for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.campaigns c
      where c.id = campaign_pins.campaign_id
        and (
          c.created_by = auth.uid()
          or exists (
            select 1
            from public.campaign_members cm
            where cm.campaign_id = c.id
              and cm.user_id = auth.uid()
          )
        )
    )
  );

drop policy if exists "campaign_pins delete own" on public.campaign_pins;
create policy "campaign_pins delete own"
  on public.campaign_pins for delete
  to authenticated
  using (user_id = auth.uid());
