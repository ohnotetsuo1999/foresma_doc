const { chromium } = require('playwright') /* npm i -D playwright */;
const { execFileSync } = require('child_process');
const URL0 = 'http://localhost:3100';
const hub = q => execFileSync('su',['postgres','-c',`psql -h /var/tmp/deskpg -p 55432 -d hubdb -Atc "${q}"`]).toString().trim();
const desk = q => execFileSync('su',['postgres','-c',`psql -h /var/tmp/deskpg -p 55432 -d deskdb -Atc "${q}"`]).toString().trim();
async function login(b, email, pw){
  const ctx = await b.newContext({viewport:{width:1280,height:1100}}); const p = await ctx.newPage();
  p.errs=[]; p.on('pageerror',e=>p.errs.push(e.message)); p.on('console',m=>{ if(m.type()==='error') p.errs.push(m.text()); });
  await p.goto(URL0); await p.waitForURL('**/login');
  await p.fill('#email', email); await p.fill('#password', pw); await p.click('#go');
  await p.waitForURL(URL0+'/'); await p.waitForTimeout(800); return p;
}
(async()=>{
 const b = await chromium.launch();
 // 0) 管理者でログイン → メンバー追加
 const A = await login(b, 'admin@example.com', 'admin-pass-123');
 console.log('A me:', await A.textContent('#me-name'), '| members link visible:', await A.isVisible('#members-link'));
 const M = await A.context().newPage(); await M.goto(URL0+'/members'); await M.waitForTimeout(500);
 await M.fill('#m-name','スイッチ 坂口'); await M.fill('#m-company','スイッチ'); await M.fill('#m-email','sakaguchi@example.com'); await M.fill('#m-pw','agent-pass-123'); await M.click('#add button');
 await M.waitForTimeout(500); console.log('member add:', await M.textContent('#msg'));
 // wrong password
 const W = await (await b.newContext()).newPage(); await W.goto(URL0+'/login'); await W.fill('#email','sakaguchi@example.com'); await W.fill('#password','wrong-password'); await W.click('#go'); await W.waitForTimeout(900); console.log('wrong pw:', await W.textContent('#err'));
 // 1) 管理者が予約（トスアップは後で）
 await A.fill('#q','09011112222'); await A.click('#search-btn'); await A.waitForTimeout(600);
 console.log('tossup history:', (await A.textContent('#verify')).includes('以前のトスアップ'));
 await A.click('#v-ok');
 const slot = await A.getAttribute('#props .prop >> nth=0','data-t');
 await A.click('#props .prop >> nth=0'); await A.waitForTimeout(400);
 console.log('hold row:', desk("select held_by from desk_slot_holds"));
 await A.click('#book'); console.log('confirm:', await A.textContent('#book'));
 await A.click('#book'); await A.waitForTimeout(1200);
 console.log('done:', await A.textContent('#done-box h3'));
 console.log('hub row:', hub("select title||' | '||to_char(end_at-start_at,'MI')||'min | rt='||reminder_type_id||' | tag='||tag||' | getter='||appointment_getter_id||' | users_id='||users_id||' | line='||line_user_id||' | staff='||coalesce(is_staff_id::text,'null')||' | memo='||memo from interview_bookings"));
 console.log('desk row:', desk("select hub_status||' | tossed='||tossed||' | by='||booked_by from desk_bookings"), '| holds left:', desk("select count(*) from desk_slot_holds"));
 hub("update interview_bookings set is_staff_id='22222222-2222-2222-2222-222222222222', google_calendar_event_id='g1'; insert into interview_booking_reminders (interview_booking_id, reminder_timing) select id,'on_booking' from interview_bookings");
 await A.waitForTimeout(7000); console.log('steps:', await A.textContent('.hubsteps'));
 await (await A.$('#done-box')).screenshot({path:'app_done.png'});
 // 2) 架電担当がログイン：同じ枠を2件目→OK、3件目→満席
 const B = await login(b, 'sakaguchi@example.com', 'agent-pass-123');
 console.log('B me:', await B.textContent('#me-name'), '| members link visible:', await B.isVisible('#members-link'));
 await B.click('#tab-toss'); console.log('B toss list:', await B.textContent('#toss-body'));
 // B tosses A's booking
 await B.click('#toss-body [data-toss]');
 for (const [k,v] of [['kana','しけん たろう'],['birth','1998-01-02'],['home','東京都'],['area','東京都'],['timing','すぐ']]) await B.fill('#f-'+k, v);
 await B.click('#book'); await B.waitForTimeout(700); console.log('B toss done:', await B.textContent('#done-box h3'), '| db:', desk("select tossed||' by '||tossed_by from desk_bookings"));
 await B.click('#next-call');
 // B books the same slot for 試験 花子 (blocked LINE) -> 2nd booking allowed
 await B.fill('#q','080-3333-4444'); await B.click('#search-btn'); await B.waitForTimeout(600); await B.click('#v-ok');
 await B.click('[data-sv="cal"]'); await B.click(`#cal [data-t="${slot}"]`); await B.waitForTimeout(400);
 await B.click('#book'); await B.click('#book'); await B.waitForTimeout(1200);
 console.log('B 2nd booking:', await B.textContent('#done-box h3'), '| notice SMS:', (await B.textContent('#done-box')).includes('SMS'));
 // 3rd at same slot via API directly -> 409 from Hub capacity trigger
 const r = await B.evaluate(async (s) => { const x = await fetch('/api/bookings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({hubUserId:'33333333-3333-3333-3333-333333333333',start:new Date(+s).toISOString(),method:'電話',fmt:{name:'試験 太郎'}})}); return x.status+' '+(await x.json()).error; }, slot);
 console.log('3rd booking:', r);
 // 4) 再電話メモ
 await B.click('#next-call'); await B.fill('#q','09011112222'); await B.click('#search-btn'); await B.waitForTimeout(600);
 await B.click('[data-o="再電話"]'); await B.fill('#o-memo','（テスト）夜なら話せる'); await B.click('#o-save'); await B.waitForTimeout(500);
 console.log('log db:', desk("select outcome||' | '||memo||' | '||logged_by from desk_call_logs"));
 // agent cannot open members API
 console.log('agent members api:', await B.evaluate(async () => (await fetch('/api/members')).status));
 // A sees B's recall after sync
 await A.reload(); await A.waitForTimeout(900); await A.click('#tab-recall'); console.log('A recall:', await A.textContent('#recall-body'));
 // logout
 await B.click('#logout'); await B.waitForURL('**/login'); console.log('logout ok');
 console.log('errs', A.errs, B.errs);
 await b.close();
})();
