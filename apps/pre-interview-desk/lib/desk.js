import { hub, desk } from "./db.js";
import { bad } from "./api.js";

/* LREACH Hub の実値（出会えるエージェントのLINE予約と同じ設定） */
export const SWITCH_STAFF_ID = "e8f6242e-4032-4b50-a336-9d9444bc3710"; // is_staff「スイッチ」＝アポ取得者
export const HUB_TAG = "架電代行_スイッチ";
export const MEET_MIN = 15;
export const LEAD_MIN = 30;
export const HOLD_SEC = 300;
export const FORMS = {
  "電話": { id: "787091ef-2a77-435a-ac5a-edd2ac51ac1c", name: "出会えるエージェント エージェント相談(電話)", reminder: 8, label: "電話面談" },
  "オンライン": { id: "35c8040f-b366-4749-80e8-d8b01ba96389", name: "出会えるエージェント エージェント相談(オンライン面談)", reminder: 9, label: "オンライン面談" }
};
export const OUTCOMES = ["再電話", "既往歴", "時期NG", "不通", "対象外"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = v => UUID.test(String(v || ""));
const str = (v, max = 4000) => String(v ?? "").slice(0, max);

/* ---------- 空き枠・IS ---------- */
export async function latestSlots() {
  const [row] = await hub(`select calculated_at, slots from slot_capacity_logs where brand = 'deaeru' and scope = 'full' order by calculated_at desc limit 1`);
  const slots = {};
  const raw = row?.slots ? (typeof row.slots === "string" ? JSON.parse(row.slots) : row.slots) : {};
  for (const [k, v] of Object.entries(raw)) slots[k] = { available: Number(v?.available) || 0, staff: v?.availableStaff || [] };
  return { slots, slotsAt: row?.calculated_at || null };
}
export async function staffList() {
  return hub(`select s.id::text id, s.name, a.priority from is_staff s join is_staff_assignment_settings a on a.is_staff_id = s.id where a.is_active order by a.priority`);
}

/* ---------- ユーザー ---------- */
const USER_SELECT = `select u.id::text uid, p.id line_uid, p.name, p.line_name, regexp_replace(coalesce(p.phone_number,''),'\\D','','g') phone, p.birthday::text birthday, p.gender,
  p.residence, p.desired_work_location, p.desired_time, p.is_blocked, p.is_line_added, p.created_at,
  (select count(*) from user_profiles p2 where regexp_replace(coalesce(p2.phone_number,''),'\\D','','g') = regexp_replace(coalesce(p.phone_number,''),'\\D','','g'))::int phone_cnt,
  (select coalesce(json_agg(json_build_object('start_at',b.start_at,'status_id',b.status_id,'is_canceled',b.is_canceled,'staff',s.name,'tag',b.tag) order by b.start_at desc),'[]'::json)
     from (select * from interview_bookings b0 where b0.users_id = u.id order by b0.start_at desc limit 5) b left join is_staff s on s.id = b.is_staff_id) bookings
  from user_profiles p join users u on u.users_line_id = p.id`;

export function normPhone(s) {
  let d = String(s || "").normalize("NFKC").replace(/\D/g, "");
  if (d.startsWith("81") && (d.length === 11 || d.length === 12)) d = "0" + d.slice(2);
  return d;
}
export async function searchUsers(q) {
  const p = normPhone(q);
  if (p.length < 4) throw bad("電話番号を4桁以上入れてください");
  if (p.length <= 4) return hub(`${USER_SELECT} where right(regexp_replace(coalesce(p.phone_number,''),'\\D','','g'), 4) = $1 order by p.created_at desc limit 20`, [p]);
  return hub(`${USER_SELECT} where regexp_replace(coalesce(p.phone_number,''),'\\D','','g') = $1 order by p.created_at desc limit 20`, [p]);
}
async function userById(uid) {
  if (!isUuid(uid)) throw bad("ユーザーを選び直してください");
  const [u] = await hub(`${USER_SELECT} where u.id = $1::uuid limit 1`, [uid]);
  if (!u) throw bad("Hubにこのユーザーが見つかりません");
  return u;
}
export async function tossups(uid) {
  if (!isUuid(uid)) return [];
  return desk(`select user_id, posted_at, is_name, age, desired_area, home_pref, overall_grade, left(intro, 400) intro, permalink
    from tossup_info where user_id = $1 order by posted_at desc limit 5`, [uid]);
}

/* ---------- Hubの予約一覧 ---------- */
export function hubList() {
  return hub(`select b.id::text id, b.booker_name, b.start_at, b.status_id, b.is_canceled, b.tag, b.reminder_type_id, s.name staff, g.name getter
    from interview_bookings b left join is_staff s on s.id = b.is_staff_id left join is_staff g on g.id = b.appointment_getter_id
    where b.appointment_getter_id = $1::uuid or b.tag ilike '%スイッチ%' order by b.start_at desc limit 50`, [SWITCH_STAFF_ID]);
}

/* ---------- 共有データ ---------- */
export async function shared() {
  const [bookings, logs, holds, settings] = await Promise.all([
    desk(`select id::text, hub_user_id, user_name, phone, line_uid, start_at, method, staff_name, staff_id::text, booked_by, verify_note, notice, hub_status, hub_booking_id::text,
      fmt, tossed, tossed_at, tossed_by, created_at from desk_bookings where hub_status <> 'canceled' and (start_at > now() - interval '14 days' or not tossed) order by start_at limit 300`),
    desk(`select id::text, hub_user_id, user_name, phone, outcome, call_state, contact_pref, memo, callback_at, done, logged_by, created_at from desk_call_logs
      where created_at > now() - interval '60 days' or (outcome = '再電話' and not done) order by created_at desc limit 500`),
    desk(`select id::text, slot_start, held_by, hub_user_id, expires_at from desk_slot_holds where expires_at > now()`),
    desk(`select key, value from desk_settings`)
  ]);
  return { bookings, logs, holds, settings };
}

/* ---------- 仮押さえ ---------- */
export async function acquireHold(me, slotStart, hubUserId) {
  const t = new Date(slotStart);
  if (isNaN(t)) throw bad("枠の日時が正しくありません");
  const { slots } = await latestSlots();
  const s = slots[slotKeyJst(t)];
  if (!s) throw bad("この時間は受付していません");
  const rows = await desk(`with taken as (
      select (select count(*) from desk_slot_holds where slot_start = $1 and expires_at > now() and held_by <> $2)
           + (select count(*) from desk_bookings where start_at = $1 and hub_status = 'draft') n)
    insert into desk_slot_holds (slot_start, held_by, hub_user_id, expires_at)
    select $1, $2, $3, now() + make_interval(secs => $4) from taken where n < $5 returning id::text, expires_at`,
    [t.toISOString(), me.name, str(hubUserId, 64), HOLD_SEC, s.available]);
  if (!rows[0]) throw bad("ほかの担当がこの枠を押さえました。ほかの枠を選んでください。", 409);
  return rows[0];
}
export async function releaseHold(me, id) {
  if (!isUuid(id)) return;
  await desk(`delete from desk_slot_holds where (id = $1::uuid and held_by = $2) or expires_at < now() - interval '1 day'`, [id, me.name]);
}

/* 日本時間の枠キー（slot_capacity_logs と同じ "YYYY-MM-DDTHH:MM"） */
export function slotKeyJst(d) {
  const j = new Date(d.getTime() + 9 * 3600e3);
  const p = n => String(n).padStart(2, "0");
  return `${j.getUTCFullYear()}-${p(j.getUTCMonth() + 1)}-${p(j.getUTCDate())}T${p(j.getUTCHours())}:${p(j.getUTCMinutes())}`;
}
export const hubTitle = (method, name) => `【${method === "電話" ? "電話面談" : "オンライン面談"}】${name}様　出会えるエージェント`;
const FMT_KEYS = ["name","kana","sex","birth","phone","mail","home","area","child","med","timing","edu","emp","type","cos","years","job","want","ng","inc","winc","comment","agents","other","method"];
const TOSS_REQ = ["name","kana","birth","home","area","timing"];
const cleanFmt = f => Object.fromEntries(FMT_KEYS.map(k => [k, str(f?.[k], 4000)]));
const isTossed = f => TOSS_REQ.every(k => String(f[k] || "").trim());

/* ---------- 予約：Hubの interview_bookings に登録し、控えとトスアップを desk_bookings に ---------- */
export async function createBooking(me, input) {
  const method = input.method;
  if (!FORMS[method]) throw bad("面談方法を選んでください");
  const t = new Date(input.start);
  if (isNaN(t)) throw bad("枠の日時が正しくありません");
  if (t < new Date(Date.now() + LEAD_MIN * 60e3)) throw bad(`開始${LEAD_MIN}分前を切った枠は予約できません`);
  const { slots } = await latestSlots();
  if (!slots[slotKeyJst(t)]) throw bad("この時間は受付していません");
  const u = await userById(input.hubUserId);
  const fmt = cleanFmt({ ...input.fmt, method });
  const name = str(fmt.name || u.name, 100).trim();
  if (!name) throw bad("名前を入れてください");
  const verifyNote = str(input.verifyNote, 500);
  const notice = u.is_blocked || u.is_line_added === false ? "SMS" : "LINE";
  const f = FORMS[method];
  const end = new Date(t.getTime() + MEET_MIN * 60e3);
  const memo = `架電代行：${me.name}${verifyNote ? "／本人確認：" + verifyNote : ""}`;
  const insert = {
    text: `insert into interview_bookings (booker_name, title, start_at, end_at, line_user_id, users_id, form_id, reminder_type_id, tag, appointment_getter_id, memo)
           values ($1, $2, $3, $4, $5, $6::uuid, $7::uuid, $8, $9, $10::uuid, $11) returning id::text`,
    values: [name, hubTitle(method, name), t.toISOString(), end.toISOString(), u.line_uid || null, u.uid, f.id, f.reminder, HUB_TAG, SWITCH_STAFF_ID, memo]
  };

  let hubId = null, hubError = null;
  if (process.env.HUB_WRITE_DISABLED === "1") hubError = "設定（HUB_WRITE_DISABLED=1）によりHubへの書き込みを止めています";
  else {
    try { hubId = (await hub(insert.text, insert.values))[0]?.id || null; }
    catch (e) {
      // Hubの満席チェック（enforce_interview_booking_slot_capacity）は 23514 で拒否する
      if (e.code === "23514") throw bad("この枠はHub上で満席になりました。ほかの枠を選んでください。", 409);
      console.error("hub insert failed", e);
      hubError = e.code === "42501" ? "Hubへの書き込み権限がありません" : "Hubに登録できませんでした";
    }
  }
  const tossed = isTossed(fmt);
  const [row] = await desk(`insert into desk_bookings (hub_user_id, user_name, phone, line_uid, start_at, method, booked_by, verify_note, notice, hub_status, hub_booking_id, fmt, tossed, tossed_at, tossed_by)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::uuid, $12::jsonb, $13, case when $13 then now() end, case when $13 then $7 end) returning id::text, created_at`,
    [u.uid, name, u.phone, u.line_uid || "", t.toISOString(), method, me.name, verifyNote, notice, hubId ? "registered" : "draft", hubId, JSON.stringify(fmt), tossed]);
  await desk(`update desk_call_logs set done = true where hub_user_id = $1 and outcome = '再電話' and not done`, [u.uid]);
  await desk(`delete from desk_slot_holds where slot_start = $1 and held_by = $2`, [t.toISOString(), me.name]);
  return { id: row.id, createdAt: row.created_at, hubBookingId: hubId, hubStatus: hubId ? "registered" : "draft", hubError, tossed, notice,
    title: hubTitle(method, name), sql: insert.text.replace(/\s+/g, " ") };
}
export async function hubStatus(hubId) {
  if (!isUuid(hubId)) throw bad("予約IDが正しくありません");
  const [r] = await hub(`select s.name staff, b.is_staff_id is not null assigned, b.google_calendar_event_id is not null gcal, b.meeting_url is not null url, b.is_canceled,
      exists(select 1 from interview_booking_reminders r where r.interview_booking_id = b.id and r.reminder_timing = 'on_booking') sent
    from interview_bookings b left join is_staff s on s.id = b.is_staff_id where b.id = $1::uuid`, [hubId]);
  if (r?.staff) await desk(`update desk_bookings set staff_name = $1, updated_at = now() where hub_booking_id = $2::uuid and staff_name is distinct from $1`, [r.staff, hubId]);
  return r || null;
}
export async function saveToss(me, id, fmtIn) {
  if (!isUuid(id)) throw bad("予約を選び直してください");
  const [cur] = await desk(`select method from desk_bookings where id = $1::uuid`, [id]);
  if (!cur) throw bad("予約が見つかりません", 404);
  const fmt = cleanFmt({ ...fmtIn, method: cur.method });
  if (!isTossed(fmt)) throw bad("トスアップに必要な項目（名前・ふりがな・生年月日・お住まい・希望勤務地・転職希望時期）を入れてください");
  await desk(`update desk_bookings set fmt = $1::jsonb, tossed = true, tossed_at = now(), tossed_by = $2, updated_at = now() where id = $3::uuid`, [JSON.stringify(fmt), me.name, id]);
  return { ok: true };
}
export async function addLog(me, l) {
  if (!OUTCOMES.includes(l.outcome)) throw bad("結果を選んでください");
  if (!isUuid(l.hubUserId)) throw bad("ユーザーを選び直してください");
  let callbackAt = null;
  if (l.outcome === "再電話") {
    callbackAt = new Date(l.callbackAt);
    if (isNaN(callbackAt)) throw bad("再電話の日時を入れてください");
    await desk(`update desk_call_logs set done = true where hub_user_id = $1 and outcome = '再電話' and not done`, [l.hubUserId]);
  }
  const [row] = await desk(`insert into desk_call_logs (hub_user_id, user_name, phone, outcome, call_state, contact_pref, memo, callback_at, logged_by)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id::text, created_at`,
    [l.hubUserId, str(l.userName, 100), str(l.phone, 20), l.outcome, str(l.callState, 50), str(l.contactPref, 200), str(l.memo, 4000), callbackAt && callbackAt.toISOString(), me.name]);
  return row;
}
export async function setSetting(me, key, value) {
  if (key !== "line_add_url") throw bad("変更できない設定です");
  const v = str(value, 500).trim();
  if (v && !/^https:\/\//.test(v)) throw bad("https:// から始まるURLを入れてください");
  await desk(`insert into desk_settings (key, value, updated_by, updated_at) values ($1, $2, $3, now())
    on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now()`, [key, v, me.name]);
  return { ok: true };
}
