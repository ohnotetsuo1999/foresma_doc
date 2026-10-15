-- プレ面談予約デスク：全員で共有する保存先（Supabase / ohno_project = xgfhmyuvdtwbqjtyumre）
-- Supabase の SQL Editor でこのファイルをそのまま実行してください。
-- Hub（lreach_hub）にはテーブルを作りません。Hub に書くのは interview_bookings への予約登録だけです。

begin;

-- トスアップ（送客FMT）と予約の控え。予約の正本は Hub の interview_bookings（hub_booking_id で紐づく）。
-- hub_status = 'registered' は Hub 登録済み、'draft' は Hub に書けなかった予約
create table if not exists public.desk_bookings (
  id uuid primary key default gen_random_uuid(),
  hub_user_id text,                      -- lreach_hub users.id
  user_name text not null,
  phone text,
  line_uid text,                         -- lreach_hub user_profiles.id（LINEユーザーID）
  start_at timestamptz not null,
  method text not null check (method in ('電話','オンライン')),
  staff_name text,                       -- 割り当てたIS
  staff_id uuid,                         -- lreach_hub is_staff.id
  booked_by text not null,               -- 予約した架電担当
  verify_note text,                      -- 名前が違ったが本人と確認した理由
  notice text check (notice in ('LINE','SMS')),
  hub_status text not null default 'draft' check (hub_status in ('draft','registered','canceled')),
  hub_booking_id uuid,                   -- Hub登録後の interview_bookings.id
  fmt jsonb not null default '{}'::jsonb,-- 送客FMTの各項目
  tossed boolean not null default false,
  tossed_at timestamptz,
  tossed_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.desk_bookings is 'プレ面談予約デスク: 架電代行が取ったプレ面談予約とトスアップ（送客FMT）。hub_status=draft はHub未登録。hub_user_id=lreach_hub users.id';
create index if not exists desk_bookings_start_idx on public.desk_bookings (start_at);
create index if not exists desk_bookings_user_idx on public.desk_bookings (hub_user_id);
create index if not exists desk_bookings_untossed_idx on public.desk_bookings (start_at) where not tossed;

-- 予約に至らなかった架電の結果とメモ。outcome='再電話' かつ done=false が再電話リスト
create table if not exists public.desk_call_logs (
  id uuid primary key default gen_random_uuid(),
  hub_user_id text,
  user_name text not null,
  phone text,
  outcome text not null check (outcome in ('再電話','既往歴','時期NG','不通','対象外')),
  call_state text,                       -- 本人と話せた / 留守電に残した / 出なかった など
  contact_pref text,                     -- 次に連絡しやすい時間帯
  memo text,
  callback_at timestamptz,
  done boolean not null default false,
  logged_by text not null,
  created_at timestamptz not null default now()
);
comment on table public.desk_call_logs is 'プレ面談予約デスク: 予約に至らなかった架電の結果・メモ・再電話予定（outcome=再電話 かつ done=false が再電話リスト）';
create index if not exists desk_call_logs_user_idx on public.desk_call_logs (hub_user_id);
create index if not exists desk_call_logs_recall_idx on public.desk_call_logs (callback_at) where outcome = '再電話' and not done;

-- 枠の5分仮押さえ。expires_at を過ぎた行は無効
create table if not exists public.desk_slot_holds (
  id uuid primary key default gen_random_uuid(),
  slot_start timestamptz not null,
  held_by text not null,
  hub_user_id text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
comment on table public.desk_slot_holds is 'プレ面談予約デスク: 枠の5分仮押さえ。expires_at を過ぎた行は無効';
create index if not exists desk_slot_holds_slot_idx on public.desk_slot_holds (slot_start, expires_at);

-- 共有設定（line_add_url = SMSで送る公式LINEの友だち追加URL）
create table if not exists public.desk_settings (
  key text primary key,
  value text,
  updated_by text,
  updated_at timestamptz not null default now()
);
comment on table public.desk_settings is 'プレ面談予約デスク: 共有設定（line_add_url など）';

-- ログインできるメンバー（スイッチ社の架電担当・foresmaの管理者）
create table if not exists public.desk_members (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text not null,                    -- 画面と記録に出る名前（例：スイッチ 荒木）
  role text not null default 'agent' check (role in ('agent','admin')),
  company text,
  password_hash text not null,           -- scrypt
  active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists desk_members_email_idx on public.desk_members (lower(email));
comment on table public.desk_members is 'プレ面談予約デスク: アプリにログインできるメンバー';
alter table public.desk_members enable row level security;

-- 公開キー（anon）からは読み書きさせない。アプリはサーバー側の接続文字列（DESK_DATABASE_URL）で読み書きする
alter table public.desk_bookings   enable row level security;
alter table public.desk_call_logs  enable row level security;
alter table public.desk_slot_holds enable row level security;
alter table public.desk_settings   enable row level security;

commit;
