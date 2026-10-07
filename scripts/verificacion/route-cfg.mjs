// node route-cfg.mjs <salida.json> <png> <wall 0-3> <nombres separados por coma> [clip x,y,w,h] [grid]
// Genera la configuración de routes-img.mjs leyendo las rutas REALES de liveConfig.ts.
import fs from 'node:fs';
import path from 'node:path';

const [outJson, png, wall, names, clipArg = '', grid = ''] = process.argv.slice(2);
const src = fs.readFileSync(path.resolve('work/client/src/live/liveConfig.ts'), 'utf8');
const grab = (name) => {
  const m = src.match(new RegExp('export const ' + name + '[^=]*= ([\\s\\S]*?);\\n'));
  return Function('return ' + m[1])();
};
const palette = { VILLAGER_ROAD: '#ff00ff', 'PATROL_ROUTES.1': '#ffd400', 'PATROL_ROUTES.2': '#00e5ff', 'PATROL_ROUTES.3': '#7cff00', STATIONS: '#ff8a00' };
const routes = [];
for (const n of names.split(',')) {
  if (n === 'VILLAGER_ROAD') routes.push({ color: palette[n], pts: grab(n) });
  else if (n.startsWith('PATROL_ROUTES.')) routes.push({ color: palette[n], pts: grab('PATROL_ROUTES')[n.split('.')[1]] });
  else if (n === 'STATIONS') {
    const st = grab('STATIONS');
    for (const specs of Object.values(st)) for (const s of specs) if (s.path) routes.push({ color: palette.STATIONS, pts: s.path });
  } else if (n === 'RIVER_LINES') for (const pts of grab('RIVER_LINES')) routes.push({ color: '#ff3030', pts });
}
const clip = clipArg ? (([x, y, width, height]) => ({ x, y, width, height }))(clipArg.split(',').map(Number)) : undefined;
fs.writeFileSync(outJson, JSON.stringify({ out: path.resolve(png), wall: Number(wall), routes, clip, grid: grid ? Number(grid) : 0 }));
