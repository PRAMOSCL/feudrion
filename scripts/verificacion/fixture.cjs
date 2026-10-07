const D = require('E:/Github Repo/feudrion/node_modules/better-sqlite3');
const d = new D(process.argv[2]);
const now = Date.now();
d.prepare("update buildings set level=3 where type='barracks'").run();
d.prepare("update buildings set level=2 where type='castle'").run();
d.prepare("update buildings set level=2, workers=5 where type='sawmill'").run();
d.prepare("update cities set wood=300, stone=200, food=420, gold=360, population=30").run();
const t = d.prepare("update troops set quantity=? where unit_type=?");
t.run(12,'lancero'); t.run(6,'arquero'); t.run(4,'espadachin');
const rq = d.prepare("insert into recruitments (city_id,unit_type,quantity,started_at,finishes_at,status) values (1,?,?,?,?,'active')");
rq.run('arquero',15,now-60000,now+5*60000+12000); rq.run('lancero',10,now+5*60000+12000,now+12*60000+47000);
const ex = d.prepare("insert into expeditions (city_id,camp_key,status,sent_at,travel_seconds,arrive_at,return_at,result,resolved_at,completed_at,loot_json,delivered_json) values (1,?,?,?,?,?,?,?,?,?,?,?)");
const eu = d.prepare("insert into expedition_units (expedition_id,unit_type,sent,lost) values (?,?,?,?)");
const rp = d.prepare("insert into reports (city_id,expedition_id,camp_key,result,created_at,sent_json,lost_json,survivors_json,loot_json,delivered_json,delivered_at,details_json) values (1,?,?,?,?,?,?,?,?,?,?,?)");
const U = (a,b,c,e)=>JSON.stringify({lancero:a,arquero:b,espadachin:c,ballestero:e});
const L = (w,s,f,g)=>JSON.stringify({wood:w,stone:s,food:f,gold:g});
const det = (a,dd,ca,cd,r,lf,cc)=>JSON.stringify({ourAttack:a,ourDefense:dd,campAttack:ca,campDefense:cd,ratio:r,lossFraction:lf,carryCapacity:cc});
const H=3600000;
// victoria hoy
let r = ex.run('bandidos','completed',now-H,60,now-H+60000,now-H+120000,'victory',now-H+60000,now-H+120000,L(120,60,0,85),L(120,60,0,85));
eu.run(r.lastInsertRowid,'lancero',12,2); eu.run(r.lastInsertRowid,'arquero',6,1);
rp.run(r.lastInsertRowid,'bandidos','victory',now-H+60000,U(12,6,0,0),U(2,1,0,0),U(10,5,0,0),L(120,60,0,85),L(120,60,0,85),now-H+120000,det(138,198,35,55,2.5,0.17,150));
// derrota hoy (antes)
r = ex.run('fortin','completed',now-5*H,105,now-5*H+105000,now-5*H+210000,'defeat',now-5*H+105000,now-5*H+210000,L(0,0,0,0),L(0,0,0,0));
eu.run(r.lastInsertRowid,'lancero',8,6); eu.run(r.lastInsertRowid,'arquero',4,3);
rp.run(r.lastInsertRowid,'fortin','defeat',now-5*H+105000,U(8,4,0,0),U(6,3,0,0),U(2,1,0,0),L(0,0,0,0),L(0,0,0,0),now-5*H+210000,det(92,88,110,170,0.54,0.73,30));
// victoria ayer
r = ex.run('bandidos','completed',now-30*H,60,now-30*H+60000,now-30*H+120000,'victory',now-30*H+60000,now-30*H+120000,L(90,60,80,60),L(90,60,70,60));
eu.run(r.lastInsertRowid,'lancero',15,3);
rp.run(r.lastInsertRowid,'bandidos','victory',now-30*H+60000,U(15,0,0,0),U(3,0,0,0),U(12,0,0,0),L(90,60,80,60),L(90,60,70,60),now-30*H+120000,det(90,135,35,55,1.64,0.2,120));
// expedición activa (regresando)
r = ex.run('bandidos','returning',now-90000,60,now-30000,now+30000,'victory',now-30000,null,L(80,50,60,40),null);
eu.run(r.lastInsertRowid,'lancero',10,1);
rp.run(r.lastInsertRowid,'bandidos','victory',now-30000,U(10,0,0,0),U(1,0,0,0),U(9,0,0,0),L(80,50,60,40),null,null,det(60,90,35,55,1.09,0.1,90));
d.close(); console.log('fixture listo');
