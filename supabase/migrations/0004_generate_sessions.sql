-- 0004_generate_sessions.sql
-- Generates attendance_sessions rows for a given date, from active schedules
-- matching the day-of-week, within the academic year, minus exceptions.
-- Scheduled daily at 17:00 UTC (00:00 WIB) for the NEXT day's sessions.
--
-- NOTE (checkpoint risk, deferred to DB-apply checkpoint): on Supabase cloud
-- pg_cron lives in the `extensions` schema; `create extension if not exists
-- pg_cron` may fail or install outside `extensions` there — it may need
-- `with schema extensions`. Transcribed verbatim from the task brief per
-- controller ruling; verify at the final DB-apply checkpoint. No live DB here.

create extension if not exists pg_cron;

create or replace function generate_sessions_for_date(p_date date)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := 0;
  r record;
  v_tz int;
  v_starts timestamptz;
  v_ends timestamptz;
begin
  for r in
    select sc.*, s.timezone_offset_minutes
    from schedules sc
    join schools s on s.id = sc.school_id
    where sc.is_active
      and sc.day_of_week = extract(dow from p_date)::int
      and p_date between (select start_date from academic_years ay where ay.id = sc.academic_year_id)
                    and (select end_date   from academic_years ay where ay.id = sc.academic_year_id)
      and not exists (
        select 1 from schedule_exceptions e
        where e.school_id = sc.school_id
          and e.date = p_date
          and (e.affects_all or e.schedule_id = sc.id)
      )
  loop
    v_starts := ((p_date::text || ' ' || r.start_time::text)::timestamp
                 - make_interval(mins => r.timezone_offset_minutes)) at time zone 'UTC';
    v_ends   := ((p_date::text || ' ' || r.end_time::text)::timestamp
                 - make_interval(mins => r.timezone_offset_minutes)) at time zone 'UTC';

    insert into attendance_sessions (schedule_id, teacher_id, date, starts_at, ends_at)
    values (r.id, r.teacher_id, p_date, v_starts, v_ends)
    on conflict (schedule_id, date) do nothing;

    if found then v_count := v_count + 1; end if;
  end loop;

  return v_count;
end;
$$;

-- 17:00 UTC = 00:00 WIB, membuat sesi untuk hari berikutnya.
select cron.schedule('generate-sessions-daily', '0 17 * * *',
  $$select generate_sessions_for_date((now() at time zone 'Asia/Jakarta')::date + 1)$$);

-- SECURITY DEFINER function defaults to PUBLIC execute (incl. anon).
-- Match the 0003 pattern: revoke from public/anon, grant to authenticated.
-- pg_cron runs the scheduled statement as the job owner (postgres/superuser,
-- which bypasses revokes), so the cron job above is unaffected.
revoke execute on function generate_sessions_for_date(date) from public;
revoke execute on function generate_sessions_for_date(date) from anon;
grant execute on function generate_sessions_for_date(date) to authenticated;
