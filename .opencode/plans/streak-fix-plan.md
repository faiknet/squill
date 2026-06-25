# Streak System — Requirements vs Current Implementation

## Requirements Summary

1. **Cadence-based periods:** weekly, biweekly, monthly (accommodates different gaming schedules)
2. **Streak actions** (any triggers streak update):
   - Creating a new session
   - Editing session notes (triggers `edit_document` activity)
   - Adding a journal entity (`entity_tags` INSERT)
3. **Streak behavior on action:**
   - **No active streak** → start at 1
   - **Same cadence period** → nothing changes (no increment, no-op)
   - **Next consecutive cadence period** → increment (+1)
   - **Gap > 1 period** → streak expires to 0, display disappears
4. **After expiry:** next streak action starts fresh at 1

---

## Issues Found

### Issue 1: Same-Period Actions Increment (Bug)

**File:** `supabase/migrations/20260615_fix_streak_expire_logic.sql:36-41`

The latest `apply_campaign_streak_for_date` increments streak on same-period activity:

```sql
elsif v_new_period_start = v_last_period_start then
    v_new_streak_count := (select c.streak_count + 1 ...);
```

Creates a session + edits notes in the same week → streak increments twice instead of once.

**Original 20260405 version had this correct** as `RETURN` (no-op). The 20260615 fix introduced this regression.

---

### Issue 2: No Streak Trigger on `session_notes`

Editing session notes upserts `session_notes`. There is no trigger on this table for streaks. Note edits are invisible to the streak system.

---

### Issue 3: No Streak Trigger on `entity_tags`

Inserting a journal entity goes to `entity_tags`. No trigger exists. Entity additions do not affect streaks.

---

### Issue 4: Expired Streak Doesn't Reset `last_period_start` to NULL

When streak expires to 0, `last_period_start` is set to the new activity's period. This means:
- Action after expiry → streak=0, last_period=week13
- Next action in same period → no-op (streak stays 0, no display)
- Action in week14 → streak=1

The first action post-expiry shows 0 instead of starting the streak at 1. Requirement says "when they take any streak action, the streak will start (increment to 1)."

---

### Issue 5: Backfill Only Corrects Streaks ≤ 1

`20260615_fix_streak_expire_logic.sql` backfill only updates campaigns where the recalculated streak is 0 or 1. Inflated streaks from the old bug (e.g., 10 instead of correct 3) are never corrected.

---

### Issue 6: Three Divergent Versions of Core Function

| Source | Same Period | Gap > 1 Period |
|--------|-------------|----------------|
| `20260405_campaign_streaks.sql` | `RETURN` (no-op) | `streak := 1` |
| `aws/rds/schema.sql` | `RETURN` (no-op) | `streak := 1` |
| `20260615_fix_streak_expire_logic.sql` | `streak += 1` | `streak := 0` |

None are fully correct. The correct behavior: no-op on same period, streak=0 + NULL last_period on expiry.

---

## Fix Plan

### Step 1: Rewrite `apply_campaign_streak_for_date`

**File:** New migration (e.g., `20260625_fix_streak_logic.sql`)

Corrected function:

```sql
create or replace function public.apply_campaign_streak_for_date(
  p_campaign_id uuid,
  p_activity_date date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cadence text;
  v_last_period_start date;
  v_new_period_start date;
  v_new_streak_count integer;
begin
  select c.streak_cadence, c.streak_last_period_start
    into v_cadence, v_last_period_start
  from public.campaigns c
  where c.id = p_campaign_id
  for update;

  if not found then
    return;
  end if;

  v_new_period_start := public.campaign_period_start(
    coalesce(p_activity_date, current_date), v_cadence
  );

  -- No prior activity → start streak at 1
  if v_last_period_start is null then
    v_new_streak_count := 1;

  -- Same period → no change
  elseif v_new_period_start = v_last_period_start then
    return;

  -- Consecutive period → increment
  elseif v_new_period_start = public.next_campaign_period_start(
    v_last_period_start, v_cadence
  ) then
    v_new_streak_count := (
      select c.streak_count + 1 from public.campaigns c where c.id = p_campaign_id
    );

  -- Gap > 1 period → expired, reset to 0 with null last_period
  elseif v_new_period_start > v_last_period_start then
    perform set_config('app.allow_streak_write', '1', true);
    update public.campaigns c
    set
      streak_count = 0,
      streak_last_period_start = null
    where c.id = p_campaign_id;
    return;

  -- Past activity → no-op
  else
    return;
  end if;

  perform set_config('app.allow_streak_write', '1', true);

  update public.campaigns c
  set
    streak_count = coalesce(v_new_streak_count, 0),
    streak_last_period_start = v_new_period_start
  where c.id = p_campaign_id;
end;
$$;
```

Key changes from current:
- Same period → `RETURN` (was `streak += 1`)
- Gap > 1 period → sets `streak_count = 0, streak_last_period_start = null` (was keeping last_period_start set)

---

### Step 2: Add Trigger Function for `session_notes`

New function to bridge `session_notes` → `campaign_id`:

```sql
create or replace function public.apply_campaign_streak_on_session_note()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign_id uuid;
begin
  select campaign_id into v_campaign_id
  from public.sessions
  where id = new.session_id;

  if v_campaign_id is not null then
    perform public.apply_campaign_streak_for_date(
      v_campaign_id, current_date
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_apply_campaign_streak_on_session_note on public.session_notes;
create trigger trg_apply_campaign_streak_on_session_note
  after insert or update on public.session_notes
  for each row
  execute function public.apply_campaign_streak_on_session_note();
```

Note: Uses `current_date` since note edits are real-time actions, not scheduled dates.

---

### Step 3: Add Trigger Function for `entity_tags`

```sql
create or replace function public.apply_campaign_streak_on_entity_tag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.apply_campaign_streak_for_date(
    new.campaign_id, current_date
  );
  return new;
end;
$$;

drop trigger if exists trg_apply_campaign_streak_on_entity_tag on public.entity_tags;
create trigger trg_apply_campaign_streak_on_entity_tag
  after insert on public.entity_tags
  for each row
  execute function public.apply_campaign_streak_on_entity_tag();
```

Uses `current_date` since entity additions are real-time.

---

### Step 4: Fix Session Update Trigger

The existing update trigger (`20260615_add_streak_update_trigger.sql`) reuses `apply_campaign_streak_on_session_insert` which uses `session_date` or `created_at`. This is fine for session metadata changes (name, date, archive). No change needed here — the existing trigger correctly calls the wrapper.

---

### Step 5: Fix Backfill in the Same Migration

Replace the backfill `DO` block to correctly recalculate all streaks from scratch:

```sql
do $$
declare
  v_campaign record;
  v_periods date[];
  v_len integer;
  v_idx integer;
  v_streak integer;
begin
  for v_campaign in
    select c.id, c.streak_cadence
    from public.campaigns c
  loop
    select array_agg(p.period_start order by p.period_start desc)
      into v_periods
    from (
      select distinct public.campaign_period_start(
        coalesce(s.session_date, (s.created_at at time zone 'utc')::date),
        v_campaign.streak_cadence
      ) as period_start
      from public.sessions s
      where s.campaign_id = v_campaign.id
        and not s.archived
    ) p;

    v_len := coalesce(array_length(v_periods, 1), 0);

    perform set_config('app.allow_streak_write', '1', true);

    if v_len = 0 then
      update public.campaigns c
      set streak_count = 0, streak_last_period_start = null
      where c.id = v_campaign.id;
      continue;
    end if;

    -- Check if streak is still active (gap from most recent period to now)
    v_streak := 1;
    for v_idx in 2..v_len loop
      exit when v_periods[v_idx - 1] <> public.next_campaign_period_start(
        v_periods[v_idx], v_campaign.streak_cadence
      );
      v_streak := v_streak + 1;
    end loop;

    -- Check if streak has expired (gap between last period and current period)
    if public.next_campaign_period_start(v_periods[1], v_campaign.streak_cadence) < current_date then
      v_streak := 0;
    end if;

    update public.campaigns c
    set
      streak_count = v_streak,
      streak_last_period_start = case when v_streak > 0 then v_periods[1] else null end
    where c.id = v_campaign.id;
  end loop;
end $$;
```

---

### Step 6: Update `recalculate_campaign_streak`

The `recalculate_campaign_streak` function (called when cadence changes) already uses `DISTINCT` period starts and walks backward, so it correctly de-duplicates same-period activities. However, it also needs the expiry check:

```sql
-- After the loop, check if the streak has expired
if public.next_campaign_period_start(v_periods[1], v_cadence) < current_date then
  v_streak := 0;
end if;
```

And when v_streak = 0, set `streak_last_period_start = null`:

```sql
if v_streak = 0 then
  update public.campaigns c
  set streak_count = 0, streak_last_period_start = null
  where c.id = p_campaign_id;
else
  update public.campaigns c
  set streak_count = v_streak, streak_last_period_start = v_periods[1]
  where c.id = p_campaign_id;
end if;
```

---

### Step 7: Remove Old Migration Files (Cleanup)

The divergent `aws/rds/schema.sql` and `aws/rds/post_import.sql` should be updated to match the final corrected function. These files appear to be copies used for RDS deployments — they should reference the same logic to avoid confusion.

---

## Summary of Changes

| # | Change | Type |
|---|--------|------|
| 1 | Fix same-period from increment to no-op | Bug fix |
| 2 | Reset `last_period_start` to null on expiry | Bug fix |
| 3 | Add `session_notes` trigger for streaks | New feature |
| 4 | Add `entity_tags` trigger for streaks | New feature |
| 5 | Fix backfill to handle all cases | Bug fix |
| 6 | Add expiry check to `recalculate_campaign_streak` | Bug fix |
| 7 | Sync `aws/rds/` schema files with corrected logic | Cleanup |
