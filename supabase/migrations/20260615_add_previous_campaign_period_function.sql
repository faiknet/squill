-- Add previous_campaign_period_start function for streak backfill

create or replace function public.previous_campaign_period_start(
  p_period_start date,
  p_cadence text
)
returns date
language plpgsql
immutable
as $$
begin
  if p_cadence = 'monthly' then
    return (p_period_start - interval '1 month')::date;
  end if;

  if p_cadence = 'biweekly' then
    return p_period_start - 14;
  end if;

  return p_period_start - 7;
end;
$$;
