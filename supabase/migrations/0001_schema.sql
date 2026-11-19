create extension if not exists "pgcrypto";

create table schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  timezone_offset_minutes int not null default 420,
  created_at timestamptz not null default now()
);

create table school_settings (
  school_id uuid primary key references schools(id) on delete cascade,
  early_open_minutes int not null default 15,
  late_threshold_minutes int not null default 15,
  session_token_ttl_minutes int not null default 15
);

create table academic_years (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  is_active boolean not null default false
);

create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid not null references schools(id) on delete cascade,
  name text not null,
  email text not null,
  role text not null check (role in ('superadmin','kepala_sekolah','guru')),
  created_at timestamptz not null default now()
);

create table subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  name text not null,
  code text
);

create table classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  name text not null,
  level int
);

create table schedules (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  academic_year_id uuid not null references academic_years(id) on delete cascade,
  teacher_id uuid not null references users(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6), -- 0=Minggu
  start_time time not null,
  end_time time not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);

create table schedule_exceptions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  date date not null,
  type text not null check (type in ('libur_nasional','ulangan_umum','event')),
  description text,
  affects_all boolean not null default true,
  schedule_id uuid references schedules(id) on delete cascade,
  check (affects_all or schedule_id is not null)
);

create table attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references schedules(id) on delete cascade,
  teacher_id uuid not null references users(id) on delete cascade,
  date date not null,
  token uuid not null unique default gen_random_uuid(),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (schedule_id, date)
);

create table attendance_records (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references attendance_sessions(id) on delete cascade,
  teacher_id uuid not null references users(id) on delete cascade,
  scanned_at timestamptz not null default now(),
  status text not null check (status in ('hadir','terlambat')),
  unique (session_id)
);

create index on attendance_sessions (date);
create index on attendance_sessions (teacher_id, date);
create index on attendance_records (teacher_id);
create index on schedules (academic_year_id, day_of_week);
