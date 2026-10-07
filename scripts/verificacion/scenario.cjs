const D = require('E:/Github Repo/feudrion/node_modules/better-sqlite3');
const [db, name] = process.argv.slice(2);
const d = new D(db);
const lv = d.prepare('UPDATE buildings SET level = ?, workers = ? WHERE type = ?');
const base = () => {
  lv.run(3, 0, 'castle'); lv.run(3, 0, 'warehouse'); lv.run(5, 13, 'sawmill'); lv.run(1, 4, 'farm'); lv.run(3, 5, 'quarry'); lv.run(3, 0, 'barracks'); lv.run(0, 0, 'wall');
  d.prepare('UPDATE cities SET wood=100, stone=300, food=200, gold=600, population=60, garrison_archers=0').run();
  d.prepare("UPDATE troops SET quantity = 12 WHERE unit_type = 'arquero'").run();
  d.prepare('DELETE FROM constructions').run();
};
base();
const wall = (level, garrison) => {
  lv.run(level, 0, 'wall');
  d.prepare('UPDATE cities SET garrison_archers = ?').run(garrison);
  d.prepare("UPDATE troops SET quantity = ? WHERE unit_type = 'arquero'").run(12 - garrison);
};
if (name === 'wall2') wall(2, 6);
if (name === 'wall5') wall(5, 12 - 0 > 0 ? 12 : 0);
if (name === 'wall8') wall(8, 12);
if (name === 'wall1g0') wall(1, 0);
if (name === 'noworkers') { lv.run(0, 0, 'sawmill'); lv.run(5, 0, 'sawmill'); wall(2, 6); }
if (name === 'wall0g') { /* sin muralla, 12 arqueros libres */ }
console.log('escenario', name);
const d2 = new D(db);
const set = (t, l, w) => d2.prepare('UPDATE buildings SET level=?, workers=? WHERE type=?').run(l, w, t);
if (name === 'fresh') {
  set('castle', 1, 0); set('warehouse', 1, 0); set('farm', 1, 4); set('sawmill', 0, 0); set('quarry', 0, 0); set('barracks', 0, 0); set('wall', 0, 0);
  d2.prepare('DELETE FROM constructions').run();
  d2.prepare("UPDATE cities SET wood=300, stone=200, food=250, gold=150, population=12, garrison_archers=0").run();
  d2.prepare("UPDATE troops SET quantity = 0").run();
}
if (name === 'building') {
  base2(); function base2() { set('castle', 2, 0); set('warehouse', 2, 0); set('farm', 1, 4); set('sawmill', 1, 5); set('wall', 0, 0); }
  d2.prepare('DELETE FROM constructions').run();
  const now = Date.now();
  d2.prepare("INSERT INTO constructions (city_id,building_type,target_level,started_at,finishes_at,status) VALUES (1,'wall',1,?,?,'active')").run(now - 40000, now + 80000);
  d2.prepare("UPDATE cities SET wood=300, stone=300, food=200, gold=300, population=40, garrison_archers=0").run();
}
if (name === 'upgrading') {
  set('castle', 4, 0); set('warehouse', 3, 0); set('farm', 1, 4); set('sawmill', 3, 8); set('wall', 3, 0);
  d2.prepare('DELETE FROM constructions').run();
  const now = Date.now();
  d2.prepare("INSERT INTO constructions (city_id,building_type,target_level,started_at,finishes_at,status) VALUES (1,'wall',4,?,?,'active')").run(now - 20000, now + 200000);
  d2.prepare("UPDATE cities SET wood=200, stone=300, food=200, gold=300, population=60, garrison_archers=12").run();
  d2.prepare("UPDATE troops SET quantity = 0 WHERE unit_type='arquero'").run();
}

if (name === 'wall4') wall(4, 0);
if (name === 'wall7') wall(7, 6);
