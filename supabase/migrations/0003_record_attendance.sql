-- 0003_record_attendance.sql
-- SECURITY DEFINER RPC: the ONLY write path into attendance_records
-- (RLS in 0002 deliberately grants no insert on that table).

create or replace function record_attendance(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session attendance_sessions%rowtype;
  v_settings school_settings%rowtype;
  v_open timestamptz;
  v_late timestamptz;
  v_status text;
  v_existing attendance_records%rowtype;
begin
  select s.* into v_session
  from attendance_sessions s
  where s.token = p_token;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  if v_session.teacher_id is distinct from auth.uid() then
    return jsonb_build_object('ok', false, 'reason', 'not_yours');
  end if;

  select ss.* into v_settings
  from school_settings ss
  join schedules sc on sc.school_id = ss.school_id
  where sc.id = v_session.schedule_id;

  v_open := v_session.starts_at
            - make_interval(mins => coalesce(v_settings.early_open_minutes, 15));
  v_late := v_session.starts_at
            + make_interval(mins => coalesce(v_settings.late_threshold_minutes, 15));

  if now() < v_open then
    return jsonb_build_object('ok', false, 'reason', 'too_early');
  end if;

  if now() > v_session.ends_at then
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;

  select * into v_existing from attendance_records where session_id = v_session.id;
  if found then
    return jsonb_build_object('ok', true, 'status', v_existing.status, 'duplicate', true);
  end if;

  v_status := case when now() <= v_late then 'hadir' else 'terlambat' end;

  insert into attendance_records (session_id, teacher_id, scanned_at, status)
  values (v_session.id, v_session.teacher_id, now(), v_status);

  return jsonb_build_object('ok', true, 'status', v_status, 'duplicate', false);
end;
$$;

revoke all on function record_attendance(uuid) from public;
grant execute on function record_attendance(uuid) to authenticated;
