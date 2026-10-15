-- テスト用：Hub（lreach_hub）のうちアプリが使うテーブルの最小コピー。データはすべて架空
create table users (id uuid primary key, created_at timestamptz default now(), updated_at timestamptz, users_line_id text);
create table user_profiles (id text primary key, name text, phone_number text, birthday date, gender text, residence text, desired_work_location text, desired_time text,
  is_blocked boolean default false, is_line_added boolean default true, line_name text, created_at timestamptz default now());
create table is_staff (id uuid primary key, name varchar, is_external_partner boolean default false);
create table is_staff_assignment_settings (id uuid default gen_random_uuid(), is_staff_id uuid, priority int, is_active boolean);
create table slot_capacity_logs (id bigserial, brand text, calculated_at timestamptz, slots jsonb, slot_count int, mismatch_count int, scope text);
create table interview_bookings (id uuid not null default gen_random_uuid() primary key, created_at timestamptz not null default now(), booker_name text, title text,
  start_at timestamptz, end_at timestamptz, line_user_id text, meeting_url text, form_id uuid, is_canceled boolean default false, google_calendar_event_id text,
  reminder_type_id bigint, tag text, status_id bigint, users_id uuid, reminder_responses jsonb, is_staff_id uuid, memo text, appointment_getter_id uuid, block_detected_at timestamptz);
create table interview_booking_reminders (id uuid default gen_random_uuid(), sent_at timestamptz default now(), interview_booking_id uuid, line_user_id text, messages jsonb, reminder_timing text, reminder_type_id bigint);
-- 本物の enforce_interview_booking_slot_capacity と同じく、満席は 23514 で拒否（テストは1枠2件まで）
create function cap() returns trigger language plpgsql as $$ declare n int; begin
  select count(*) into n from interview_bookings where coalesce(is_canceled,false)=false and start_at=new.start_at and id is distinct from new.id;
  if n >= 2 then raise exception 'この枠は上限(%)件に達しています: %', 2, new.start_at using errcode='23514'; end if; return new; end $$;
create trigger trg_cap before insert on interview_bookings for each row execute function cap();

insert into is_staff values ('22222222-2222-2222-2222-222222222222','テストIS 青木',false), ('22222222-2222-2222-2222-333333333333','テストIS 石田',false),
  ('e8f6242e-4032-4b50-a336-9d9444bc3710','スイッチ',false);
insert into is_staff_assignment_settings (is_staff_id, priority, is_active) values ('22222222-2222-2222-2222-222222222222',0,true),('22222222-2222-2222-2222-333333333333',1,true);
insert into user_profiles (id, name, phone_number, birthday, gender, residence, desired_work_location, desired_time, line_name, is_blocked) values
  ('Utest0001','試験 太郎','090-1111-2222','1998-01-02','male','東京都世田谷区','東京都','3カ月以内','taro',false),
  ('Utest0002','試験 花子','08033334444','2000-05-06','female','大阪府大阪市','大阪府','すぐに','hana',true);
insert into users (id, users_line_id) values ('33333333-3333-3333-3333-333333333333','Utest0001'), ('44444444-4444-4444-4444-444444444444','Utest0002');
-- 空き枠：今日から9日分、9:00〜22:30、各枠2名
insert into slot_capacity_logs (brand, calculated_at, scope, slots)
select 'deaeru', now() - interval '1 minute', 'full', jsonb_object_agg(to_char(t at time zone 'Asia/Tokyo','YYYY-MM-DD"T"HH24:MI'),
  jsonb_build_object('available',2,'availableStaff',jsonb_build_array('テストIS 青木','テストIS 石田')))
from generate_series(date_trunc('day', now() at time zone 'Asia/Tokyo') at time zone 'Asia/Tokyo' + interval '9 hours',
                     date_trunc('day', now() at time zone 'Asia/Tokyo') at time zone 'Asia/Tokyo' + interval '8 days 22 hours 30 minutes', interval '30 minutes') t
where extract(hour from t at time zone 'Asia/Tokyo') between 9 and 22;
