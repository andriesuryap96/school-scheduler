-- 0005_school_scoping.sql
-- School-scoped RLS policies for kepala_sekolah on schedules and
-- schedule_exceptions, superseding the permissive role-only policies
-- from 0002_rls.sql (kept here as immutable history; not modified).
--
-- Controller ruling: this file is created NOW and applied at the DB-apply
-- checkpoint. 0002 remains untouched.
--
-- auth_school_id() (defined in 0002) returns the school_id from JWT
-- app_metadata; previously dead code, now used here.
--
-- After the drops below, the surviving policies on these tables are:
--   schedules:            kepala_sekolah all (school-scoped),
--                         guru select (own rows)
--   schedule_exceptions:  kepala_sekolah all (school-scoped)
--
-- Note: superadmin has no policy on schedules/schedule_exceptions in 0002
-- either; superadmin management flows through these two tables only as
-- kepala_sekolah in this app. No superadmin policy added here (scope of
-- the finding is kepala_sekolah scoping only).

-- =====================================================================
-- schedules: drop permissive kepala_sekolah policy, replace school-scoped
-- =====================================================================

drop policy if exists schedules_kepala_sekolah_all on schedules;

create policy schedules_kepala_sekolah_all on schedules
  for all to authenticated
  using (auth_role() = 'kepala_sekolah' and school_id = auth_school_id())
  with check (auth_role() = 'kepala_sekolah' and school_id = auth_school_id());

-- =====================================================================
-- schedule_exceptions: drop permissive policy, replace school-scoped
-- =====================================================================

drop policy if exists schedule_exceptions_kepala_sekolah_all on schedule_exceptions;

create policy schedule_exceptions_kepala_sekolah_all on schedule_exceptions
  for all to authenticated
  using (auth_role() = 'kepala_sekolah' and school_id = auth_school_id())
  with check (auth_role() = 'kepala_sekolah' and school_id = auth_school_id());
