import { ART } from '../artManifest';
import { GROUND_SRC, SCENE_H, SCENE_W, SLOTS, SPRITE_SRC, spriteBox } from '../sceneConfig';
import type { PlotBuilding } from '../types';
import { GuardTracker, OCCLUSION, buildLocalMask, type GuardPose, type LocalMask } from './guards';
import {
  AMBIENT,
  CHOP_ORDER,
  GUARD_CYCLE_HEIGHTS,
  GUARD_SPEED,
  STATIONS,
  VILLAGER_DWELL_SECONDS,
  VILLAGER_ROAD,
  VILLAGER_STOPS,
  type FigureSpec,
} from './liveConfig';
import type { LiveModel } from './liveModel';
import { PATROL_CIRCUITS } from './patrolCircuit';
import { pingPong, type Pt } from './routes';
import { WATER_MAX_FPS, makeWaterFlow, type WaterFlow } from './waterFlow';
import { loadAtlas, loadAtlasV2, scaledFrame, type Atlas, type SheetV2Key } from './spriteAtlas';

type SheetKey = 'chop' | 'carry' | 'archer' | 'villager' | 'villagerWoman';

interface Actor {
  sheet: SheetKey;
  height: number;
  /** Posición fija (tala) o ruta a recorrer. */
  at?: Pt;
  route?: Pt[];
  speed: number;
  /** Desplazamiento temporal para que cada figura tenga su propia fase. */
  phase: number;
  flip: boolean;
  order?: readonly number[];
  stops?: readonly number[];
  dwell?: number;
}

const FPS = 6; // flipbook de seis poses (leñador)
/** Hoja v2 ↔ clave del atlas. */
const ATLAS_V2_KEY: Record<'carry' | 'villager' | 'villagerWoman', SheetV2Key> = {
  carry: 'worker_carry_sheet_v2',
  villager: 'villager_walk_sheet_v2',
  villagerWoman: 'villager_woman_sheet_v2',
};
/** Distancia (en alturas del personaje) que recorre un ciclo completo de 8 poses: ajusta el paso visible al desplazamiento. */
const CYCLE_HEIGHTS = 1.1;
const ACTOR_INTERVAL = 1000 / 30;
const WATER_INTERVAL = 1000 / WATER_MAX_FPS;
/** Reloj del agua: continuo entre montajes del renderer (cambio de distrito) para conservar la fase de la corriente. */
const WATER_EPOCH = performance.now();
const SCRATCH = 128;
const GUARD_TILE = 96;
const GUARD_FEET_X = GUARD_TILE / 2;
const GUARD_FEET_Y = GUARD_TILE - 12;
/** Resolución interna de los personajes respecto al lienzo (2×: figuras de ~30 px nítidas en pantallas grandes). */
const ACTOR_RES = 2;

interface Layers {
  water: HTMLCanvasElement;
  actors: HTMLCanvasElement;
  guardsBack: HTMLCanvasElement;
  guardsFront: HTMLCanvasElement;
}

/**
 * Capa dinámica de la ciudad: agua, personajes de suelo y GUARDIAS, sobre canvases del lienzo 1536×1024. UN solo bucle (RAF).
 *
 * Orden (de abajo arriba): terreno → agua → cuerpo trasero de la muralla → guardias «back» (con su máscara local) → edificios y personajes
 * de suelo → cuerpo delantero de la muralla (oculta a los ciudadanos que cruzan el portón) → guardias «front» (con su máscara local) → etiquetas.
 *
 * - Bucle con deltaTime acotado; se detiene con la pestaña oculta; modo estático sin movimiento.
 * - No toca React ni el servidor: recibe un `LiveModel` ya derivado del estado real y solo lo representa.
 * - Los canvases ignoran el ratón (pointer-events: none): la selección sigue siendo por silueta.
 */
export class LiveRenderer {
  private water: CanvasRenderingContext2D;
  private actors: CanvasRenderingContext2D;
  private gBack: CanvasRenderingContext2D;
  private gFront: CanvasRenderingContext2D;
  private scratch = document.createElement('canvas');
  private sctx: CanvasRenderingContext2D;
  private guardTile = document.createElement('canvas');
  private gtx: CanvasRenderingContext2D;
  private atlases: Partial<Record<SheetKey, Atlas>> = {};
  /** Hojas con formato v2 (8 poses, fase por distancia). */
  private v2 = new Set<SheetKey>();
  private buildingImgs: Partial<Record<PlotBuilding, HTMLImageElement>> = {};
  private flow: WaterFlow | null = null;
  private wallImgs: Partial<Record<1 | 2 | 3, HTMLImageElement>> = {};
  /** Máscaras locales por etapa y tramo (se construyen una vez por etapa). */
  private masks: Partial<Record<1 | 2 | 3, Record<string, LocalMask>>> = {};
  private guards = new GuardTracker();
  private guardPoses: GuardPose[] = [];
  private model: LiveModel = { workers: [], guards: 0, ambient: 0, wallStage: 0, built: [] };
  private list: Actor[] = [];
  private animate = false;
  private waterOn = true;
  private ready = false;
  private raf = 0;
  private t = 0;
  private last = 0;
  private lastActors = 0;
  private lastWater = 0;
  private disposed = false;
  private debug = false;
  /** Dibuja las rutas de calibración (solo con `senorios.debugPaths=1`; la bandera `debugLive` únicamente expone el gancho de pruebas). */
  private debugPaths = false;
  /** Frames dibujados por cada capa (para verificar rendimiento en pruebas manuales). */
  readonly stats = { actorFrames: 0, waterFrames: 0 };

  constructor(layers: Layers) {
    this.water = layers.water.getContext('2d')!;
    const hi = (c: HTMLCanvasElement) => {
      c.width = SCENE_W * ACTOR_RES;
      c.height = SCENE_H * ACTOR_RES;
      const x = c.getContext('2d')!;
      x.setTransform(ACTOR_RES, 0, 0, ACTOR_RES, 0, 0);
      return x;
    };
    this.actors = hi(layers.actors);
    this.gBack = hi(layers.guardsBack);
    this.gFront = hi(layers.guardsFront);
    this.scratch.width = this.scratch.height = SCRATCH * ACTOR_RES;
    this.sctx = this.scratch.getContext('2d')!;
    this.guardTile.width = this.guardTile.height = GUARD_TILE * ACTOR_RES;
    this.gtx = this.guardTile.getContext('2d')!;
    try {
      this.debug = localStorage.getItem('senorios.debugLive') === '1';
      this.debugPaths = localStorage.getItem('senorios.debugPaths') === '1';
    } catch {
      /* sin almacenamiento: sin depuración */
    }
    document.addEventListener('visibilitychange', this.onVisibility);
    // Gancho de verificación (solo con la bandera de depuración): permite comprobar desde el navegador qué se está representando.
    if (this.debug) (window as unknown as { __senoriosLive?: LiveRenderer }).__senoriosLive = this;
  }

  async init(): Promise<void> {
    const sheets = ART.sheets;
    const load = (src: string) =>
      new Promise<HTMLImageElement | null>((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
      });
    const jobs: Promise<void>[] = (Object.keys(sheets) as SheetKey[]).map(async (k) => {
      const v2 = (ART.sheetsV2 as Record<string, string | undefined>)[k];
      if (v2) {
        this.atlases[k] = await loadAtlasV2(v2, ATLAS_V2_KEY[k as 'carry' | 'villager' | 'villagerWoman']);
        this.v2.add(k);
        return;
      }
      const src = sheets[k];
      if (src) this.atlases[k] = await loadAtlas(src);
    });
    for (const t of Object.keys(SPRITE_SRC) as PlotBuilding[]) {
      jobs.push(load(SPRITE_SRC[t]).then((img) => void (img && (this.buildingImgs[t] = img))));
    }
    for (const s of [1, 2, 3] as const) {
      const src = ART.walls[s];
      if (src) jobs.push(load(src).then((img) => void (img && (this.wallImgs[s] = img))));
    }
    const [terrain, mask] = await Promise.all([load(GROUND_SRC), ART.riverMask ? load(ART.riverMask) : Promise.resolve(null)]);
    await Promise.all(jobs);
    if (this.disposed) return;
    if (terrain && mask) this.flow = makeWaterFlow(terrain, mask);
    this.ready = true;
    this.rebuild();
    this.apply();
  }

  setModel(model: LiveModel): void {
    this.model = model;
    if (this.ready) this.rebuild();
    this.apply();
  }

  /** `animate`: el usuario no desactivó las animaciones y no hay prefers-reduced-motion. */
  setMode(animate: boolean, water = true): void {
    this.animate = animate;
    this.waterOn = water;
    this.apply();
  }

  /** Resumen de lo que se representa y de si el bucle corre (para depuración y pruebas manuales). */
  snapshot() {
    const count = (s: SheetKey) => this.list.filter((a) => a.sheet === s).length;
    return {
      running: this.raf !== 0,
      animate: this.animate,
      model: this.model,
      actors: this.list.length,
      chop: count('chop'),
      carry: count('carry'),
      archers: this.guards.count,
      guards: this.guardPoses.map((g) => ({ x: g.x, y: g.y, visible: g.visible, layer: g.layer, segment: g.segment.id, distance: g.distance })),
      villagers: count('villager') + count('villagerWoman'),
      actorFrames: this.stats.actorFrames,
      waterFrames: this.stats.waterFrames,
      time: this.t,
    };
  }

  /** Solo depuración/pruebas: posición de los habitantes ambientales en el instante `t` (por defecto, el actual). */
  villagerPoses(t = this.t) {
    return this.list
      .filter((a) => a.sheet === 'villager' || a.sheet === 'villagerWoman')
      .map((a) => {
        const p = pingPong(a.route!, t + a.phase, a.speed, { stops: a.stops, dwell: a.dwell });
        return { x: p.x, y: p.y, moving: p.moving, walked: p.walked };
      });
  }

  /** Solo depuración/pruebas: detiene el bucle y dibuja el instante `t` (permite tiras de fotogramas deterministas). */
  seek(t: number): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.t = t;
    this.drawActors(t);
    if (this.waterOn) this.drawWater(t);
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    document.removeEventListener('visibilitychange', this.onVisibility);
  }

  /* ---------- Bucle ---------- */

  private onVisibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    } else this.apply();
  };

  private apply(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (!this.ready || this.disposed) return;
    if (this.animate && !document.hidden) {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.loop);
    } else {
      // Modo estático: un solo fotograma de personajes y guardias, y sin agua en movimiento.
      this.water.clearRect(0, 0, SCENE_W, SCENE_H);
      this.drawActors(0);
    }
  }

  private loop = (now: number) => {
    if (this.disposed) return;
    const dt = Math.max(0, Math.min((now - this.last) / 1000, 0.05)); // rAF puede entregar una marca anterior a performance.now()
    this.last = now;
    this.t += dt;
    if (now - this.lastActors >= ACTOR_INTERVAL) {
      this.lastActors = now;
      this.drawActors(this.t);
      this.stats.actorFrames++;
    }
    if (now - this.lastWater >= WATER_INTERVAL) {
      this.lastWater = now;
      if (this.waterOn) this.drawWater((now - WATER_EPOCH) / 1000);
      else this.water.clearRect(0, 0, SCENE_W, SCENE_H);
      this.stats.waterFrames++;
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  /* ---------- Actores de suelo ---------- */

  private rebuild(): void {
    const list: Actor[] = [];
    const m = this.model;
    let n = 0;
    for (const w of m.workers) {
      const specs = (STATIONS[w.building] ?? []).slice(0, w.figures);
      specs.forEach((s: FigureSpec, i) => {
        list.push({
          sheet: s.kind === 'chop' ? 'chop' : 'carry',
          height: s.height,
          at: s.at,
          route: s.path,
          speed: s.speed ?? 18,
          phase: n * 0.37 + i * 0.23,
          flip: !!s.flip,
          order: s.kind === 'chop' ? CHOP_ORDER : undefined,
        });
        n++;
      });
    }
    const ambient = Math.min(AMBIENT.max, m.ambient);
    for (let i = 0; i < ambient; i++) {
      list.push({
        sheet: i % 2 ? 'villager' : 'villagerWoman',
        height: 26,
        route: VILLAGER_ROAD,
        speed: 22 + (i % 3) * 3,
        phase: i * 31,
        flip: false,
        stops: VILLAGER_STOPS,
        dwell: VILLAGER_DWELL_SECONDS,
      });
    }
    this.list = list;
    // Guardias: solo con muralla vigente y arqueros asignados (el modelo ya lo decide); el progreso se conserva entre refrescos.
    this.guards.sync(m.wallStage, m.guards, PATROL_CIRCUITS, this.t, GUARD_SPEED);
    if (m.wallStage > 0) this.ensureMasks(m.wallStage as 1 | 2 | 3);
  }

  private ensureMasks(stage: 1 | 2 | 3): void {
    if (this.masks[stage]) return;
    const wall = this.wallImgs[stage];
    if (!wall) return;
    const out: Record<string, LocalMask> = {};
    for (const [id, o] of Object.entries(OCCLUSION[String(stage)] ?? {})) out[id] = buildLocalMask(wall, o.polygon as Pt[], SCENE_W, SCENE_H);
    this.masks[stage] = out;
  }

  private drawActors(t: number): void {
    const ctx = this.actors;
    ctx.clearRect(0, 0, SCENE_W, SCENE_H); // (la transformación 2× ya está aplicada)
    const placed = this.list.map((a) => {
      if (a.at) return { a, x: a.at[0], y: a.at[1], flip: a.flip, moving: false, walked: 0 };
      const pose = pingPong(a.route!, t + a.phase, a.speed, { stops: a.stops, dwell: a.dwell });
      return { a, x: pose.x, y: pose.y, flip: pose.flip, moving: pose.moving, walked: pose.walked };
    });
    placed.sort((p, q) => p.y - q.y);
    for (const p of placed) this.drawActor(p.a, p.x, p.y, p.flip, p.moving, t, p.walked);
    this.drawGuards(t);
    if (this.debugPaths) this.drawDebug();
  }

  private drawActor(a: Actor, x: number, y: number, flip: boolean, moving: boolean, t: number, walked = 0): void {
    const atlas = this.atlases[a.sheet];
    if (!atlas) return;
    let idx = (((Math.floor((t + a.phase) * FPS) % 6) + 6) % 6);
    if (a.order) idx = a.order[idx];
    else if (!moving && !a.at) idx = 0; // quieto: pose fija en paradas y giros
    // Caminata v2: la fase depende de la DISTANCIA recorrida (los pies siguen el suelo); al detenerse se congela la pose.
    if (this.v2.has(a.sheet)) idx = Math.floor((walked / (a.height * CYCLE_HEIGHTS)) * 8) % 8;
    if (!atlas.items[idx]) return;
    const sf = scaledFrame(atlas, a.sheet, idx, a.height * ACTOR_RES);
    const px = SCRATCH / 2;
    const py = SCRATCH - 12;

    const sc = this.sctx;
    sc.setTransform(1, 0, 0, 1, 0, 0);
    sc.clearRect(0, 0, SCRATCH * ACTOR_RES, SCRATCH * ACTOR_RES);
    sc.save();
    sc.setTransform(ACTOR_RES, 0, 0, ACTOR_RES, 0, 0);
    sc.translate(px, py);
    if (flip) sc.scale(-1, 1);
    sc.drawImage(sf.canvas, -sf.px / ACTOR_RES, -sf.py / ACTOR_RES, sf.canvas.width / ACTOR_RES, sf.canvas.height / ACTOR_RES);
    sc.restore();

    // Oclusión: se borra del actor lo que tape la silueta de un edificio cuya base está delante de sus pies.
    sc.setTransform(ACTOR_RES, 0, 0, ACTOR_RES, 0, 0);
    sc.globalCompositeOperation = 'destination-out';
    for (const type of this.model.built) {
      const slot = SLOTS[type];
      if (slot.y <= y) continue;
      const img = this.buildingImgs[type];
      if (!img) continue;
      const box = spriteBox(type);
      if (box.left > x + px || box.left + box.size < x - px || box.top > y + 12 || box.top + box.size < y - py) continue;
      sc.drawImage(img, box.left - (x - px), box.top - (y - py), box.size, box.size);
    }
    sc.globalCompositeOperation = 'source-over';
    this.actors.drawImage(this.scratch, x - px, y - py, SCRATCH, SCRATCH);
  }

  /* ---------- Guardias (circuito completo) ---------- */

  /**
   * Cada guardia se dibuja en su capa («back»: tras edificios; «front»: sobre el cuerpo delantero de la muralla) con SU máscara local:
   * polígono del tramo ∩ alfa del PNG de esa muralla. En tramos ocultos (torres) no se dibuja, pero su distancia sigue avanzando.
   */
  private drawGuards(t: number): void {
    this.gBack.clearRect(0, 0, SCENE_W, SCENE_H);
    this.gFront.clearRect(0, 0, SCENE_W, SCENE_H);
    const stage = this.model.wallStage;
    if (stage === 0) {
      this.guardPoses = [];
      return;
    }
    const circuit = PATROL_CIRCUITS[stage as 1 | 2 | 3];
    this.guardPoses = this.guards.poses(circuit, t, GUARD_SPEED);
    const atlas = this.atlases.archer;
    const masks = this.masks[stage as 1 | 2 | 3];
    if (!atlas || !masks) return;
    for (const g of this.guardPoses) {
      if (!g.visible) continue;
      const cycle = g.height * GUARD_CYCLE_HEIGHTS;
      const idx = ((Math.floor((g.distance / cycle) * 6) % 6) + 6) % 6;
      const sf = scaledFrame(atlas, 'archer', idx, g.height * ACTOR_RES);
      const tc = this.gtx;
      tc.setTransform(1, 0, 0, 1, 0, 0);
      tc.clearRect(0, 0, GUARD_TILE * ACTOR_RES, GUARD_TILE * ACTOR_RES);
      tc.setTransform(ACTOR_RES, 0, 0, ACTOR_RES, 0, 0);
      tc.save();
      tc.translate(GUARD_FEET_X, GUARD_FEET_Y);
      if (g.flip) tc.scale(-1, 1);
      tc.drawImage(sf.canvas, -sf.px / ACTOR_RES, -sf.py / ACTOR_RES, sf.canvas.width / ACTOR_RES, sf.canvas.height / ACTOR_RES);
      tc.restore();
      const m = masks[g.segment.id];
      if (m) {
        tc.globalCompositeOperation = 'destination-out';
        tc.drawImage(m.canvas, m.x - (g.x - GUARD_FEET_X), m.y - (g.y - GUARD_FEET_Y));
        tc.globalCompositeOperation = 'source-over';
      }
      (g.layer === 'back' ? this.gBack : this.gFront).drawImage(this.guardTile, g.x - GUARD_FEET_X, g.y - GUARD_FEET_Y, GUARD_TILE, GUARD_TILE);
    }
  }

  /* ---------- Agua ---------- */

  /**
   * Corriente y espuma (`waterFlow.ts`): textura de agua desplazada con dos fases cruzadas y espuma descendente en las cascadas, recortadas
   * por el alfa de `river_mask_v3_1.png`. `time` en segundos. Se dibuja sobre el terreno y bajo muros, edificios y actores.
   */
  private drawWater(time: number): void {
    const ctx = this.water;
    ctx.clearRect(0, 0, SCENE_W, SCENE_H);
    this.flow?.draw(ctx, time);
  }

  /* ---------- Depuración de calibración ---------- */

  private drawDebug(): void {
    const ctx = this.gFront;
    ctx.save();
    ctx.lineWidth = 2;
    const stage = this.model.wallStage;
    if (stage > 0) {
      for (const s of PATROL_CIRCUITS[stage as 1 | 2 | 3].segments) {
        ctx.strokeStyle = s.visibility === 'hidden' ? '#ffbe53' : '#53efff';
        ctx.setLineDash(s.visibility === 'hidden' ? [5, 5] : []);
        ctx.beginPath();
        s.feet.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    ctx.strokeStyle = '#ff3df5';
    ctx.beginPath();
    VILLAGER_ROAD.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    ctx.strokeStyle = '#ff8a00';
    for (const specs of Object.values(STATIONS)) {
      for (const s of specs ?? []) {
        if (!s.path) continue;
        ctx.beginPath();
        s.path.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
      }
    }
    ctx.fillStyle = '#fff';
    for (const specs of Object.values(STATIONS)) for (const s of specs ?? []) if (s.at) ctx.fillRect(s.at[0] - 3, s.at[1] - 3, 6, 6);
    ctx.restore();
  }
}
