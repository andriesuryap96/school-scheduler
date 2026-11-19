-- 0002_rls.sql
-- Row Level Security policies for all 10 tables + JWT helper functions.
--
-- Role matrix (per task brief):
--   superadmin      -> all on schools, school_settings, academic_years, users,
--                      subjects, classes
--   kepala_sekolah  -> select on all 10 tables; all on schedules and
--                      schedule_exceptions
--   guru            -> select on schedules (own rows only),
--                      attendance_sessions (own), attendance_records (own)
--   all roles       -> select on subjects, classes, academic_years
--                      (needed to render schedules)
--
-- NOTE: there is deliberately NO insert policy on attendance_records —
-- writes go exclusively through the record_attendance() RPC (0003).

-- =====================================================================
-- Helpers: role & school_id from JWT app_metadata
-- =====================================================================

-- helper: role & school dari JWT
create or replace function auth_role() returns text
language sql stable as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')
$$;

create or replace function auth_school_id() returns uuid
language sql stable as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'school_id', '')::uuid
$$;

-- =====================================================================
-- Enable RLS on all 10 tables
-- =====================================================================

alter table schools             enable row level security;
alter table school_settings     enable row level security;
alter table academic_years      enable row level security;
alter table users               enable row level security;
alter table subjects            enable row level security;
alter table classes             enable row level security;
alter table schedules           enable row level security;
alter table schedule_exceptions enable row level security;
alter table attendance_sessions enable row level security;
alter table attendance_records  enable row level security;

-- =====================================================================
-- schools: superadmin all; kepala_sekolah select
-- =====================================================================

create policy schools_superadmin_all on schools
  for all to authenticated
  using (auth_role() = 'superadmin')
  with check (auth_role() = 'superadmin');

create policy schools_kepala_sekolah_select on schools
  for select to authenticated
  using (auth_role() = 'kepala_sekolah');

-- =====================================================================
-- school_settings: superadmin all; kepala_sekolah select
-- =====================================================================

create policy school_settings_superadmin_all on school_settings
  for all to authenticated
  using (auth_role() = 'superadmin')
  with check (auth_role() = 'superadmin');

create policy school_settings_kepala_sekolah_select on school_settings
  for select to authenticated
  using (auth_role() = 'kepala_sekolah');

-- =====================================================================
-- academic_years: superadmin all; all roles select (kepala_sekolah, guru)
-- =====================================================================

create policy academic_years_superadmin_all on academic_years
  for all to authenticated
  using (auth_role() = 'superadmin')
  with check (auth_role() = 'superadmin');

create policy academic_years_kepala_sekolah_select on academic_years
  for select to authenticated
  using (auth_role() = 'kepala_sekolah');

create policy academic_years_guru_select on academic_years
  for select to authenticated
  using (auth_role() = 'guru');

-- =====================================================================
-- users: superadmin all; kepala_sekolah select
-- =====================================================================

create policy users_superadmin_all on users
  for all to authenticated
  using (auth_role() = 'superadmin')
  with check (auth_role() = 'superadmin');

create policy users_kepala_sekolah_select on users
  for select to authenticated
  using (auth_role() = 'kepala_sekolah');

-- =====================================================================
-- subjects: superadmin all; all roles select (kepala_sekolah, guru)
-- =====================================================================

create policy subjects_superadmin_all on subjects
  for all to authenticated
  using (auth_role() = 'superadmin')
  with check (auth_role() = 'superadmin');

create policy subjects_kepala_sekolah_select on subjects
  for select to authenticated
  using (auth_role() = 'kepala_sekolah');

create policy subjects_guru_select on subjects
  for select to authenticated
  using (auth_role() = 'guru');

-- =====================================================================
-- classes: superadmin all; all roles select (kepala_sekolah, guru)
-- =====================================================================

create policy classes_superadmin_all on classes
  for all to authenticated
  using (auth_role() = 'superadmin')
  with check (auth_role() = 'superadmin');

create policy classes_kepala_sekolah_select on classes
  for select to authenticated
  using (auth_role() = 'kepala_sekolah');

create policy classes_guru_select on classes
  for select to authenticated
  using (auth_role() = 'guru');

-- =====================================================================
-- schedules: kepala_sekolah all; guru select (own rows only)
-- =====================================================================

create policy schedules_kepala_sekolah_all on schedules
  for all to authenticated
  using (auth_role() = 'kepala_sekolah')
  with check (auth_role() = 'kepala_sekolah');

create policy schedules_guru_select_own on schedules
  for select to authenticated
  using (auth_role() = 'guru' and teacher_id = auth.uid());

-- =====================================================================
-- schedule_exceptions: kepala_sekolah all
-- =====================================================================

create policy schedule_exceptions_kepala_sekolah_all on schedule_exceptions
  for all to authenticated
  using (auth_role() = 'kepala_sekolah')
  with check (auth_role() = 'kepala_sekolah');

-- =====================================================================
-- attendance_sessions: kepala_sekolah select; guru select (own only)
-- =====================================================================

create policy attendance_sessions_kepala_sekolah_select on attendance_sessions
  for select to authenticated
  using (auth_role() = 'kepala_sekolah');

create policy attendance_sessions_guru_select_own on attendance_sessions
  for select to authenticated
  using (auth_role() = 'guru' and teacher_id = auth.uid());

-- =====================================================================
-- attendance_records: kepala_sekolah select; guru select (own only)
-- NO insert policy — writes only via record_attendance() RPC (0003)
-- =====================================================================

create policy attendance_records_kepala_sekolah_select on attendance_records
  for select to authenticated
  using (auth_role() = 'kepala_sekolah');

create policy attendance_records_guru_select_own on attendance_records
  for select to authenticated
  using (auth_role() = 'guru' and teacher_id = auth.uid());
