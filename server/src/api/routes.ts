import express, { type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { PLANNED_BUILDINGS, isPlannedType } from '../config/districts.js';
import { BUILDING_TYPES, PRODUCTION_BUILDINGS, UNIT_TYPES } from '../config/balance.js';
import type { DB } from '../db/connection.js';
import { assignGarrison, assignWorkers, recruit, runCommand, sendExpedition, startUpgrade } from '../services/commands.js';
import { GameError } from '../services/errors.js';
import { getSnapshot } from '../services/snapshot.js';

export interface AppDeps {
  db: DB;
  cityId: number;
  /** Reloj del servidor (ms). Inyectable para las pruebas. */
  clock: () => number;
}

const qty = z
  .number({ invalid_type_error: 'La cantidad debe ser un número.', required_error: 'Falta la cantidad.' })
  .int('La cantidad debe ser un número entero.')
  .positive('La cantidad debe ser mayor que cero.');

const unitEnum = z.enum(UNIT_TYPES, { errorMap: () => ({ message: 'Unidad desconocida.' }) });

const workersBody = z
  .object(
    Object.fromEntries(
      PRODUCTION_BUILDINGS.map((b) => [
        b,
        z.number({ invalid_type_error: 'Los trabajadores deben ser un número.' }).int('Los trabajadores deben ser un número entero.').min(0, 'Los trabajadores no pueden ser negativos.').optional(),
      ]),
    ) as Record<(typeof PRODUCTION_BUILDINGS)[number], z.ZodOptional<z.ZodNumber>>,
  )
  .strict('Solo se pueden asignar trabajadores a aserradero, cantera y granja.');

const garrisonBody = z
  .object({
    archers: z
      .number({ invalid_type_error: 'La guarnición debe ser un número.', required_error: 'Falta el número de arqueros.' })
      .int('La guarnición debe ser un número entero.')
      .min(0, 'La guarnición no puede ser negativa.'),
  })
  .strict();

const recruitBody = z.object({ unit: unitEnum, quantity: qty }).strict();

const expeditionBody = z
  .object({
    camp: z.string({ required_error: 'Falta el campamento.' }).min(1),
    units: z.record(unitEnum, qty, { invalid_type_error: 'Formato de tropas inválido.' }),
  })
  .strict();

function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data);
  if (!r.success) {
    throw new GameError(400, 'INVALID_INPUT', r.error.issues[0]?.message ?? 'Datos inválidos.');
  }
  return r.data;
}

const handler =
  (fn: (req: Request, res: Response) => void) =>
  (req: Request, res: Response, next: NextFunction) => {
    try {
      fn(req, res);
    } catch (e) {
      next(e);
    }
  };

export function createApp({ db, cityId, clock }: AppDeps) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '20kb' }));

  const idemKey = (req: Request): string | undefined => {
    const k = req.header('Idempotency-Key');
    return k && k.length <= 100 ? k : undefined;
  };

  const send = <T>(res: Response, r: { status: number; body: T | unknown }) => res.status(r.status).json(r.body);

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  app.get('/api/state', handler((_req, res) => res.json(getSnapshot(db, cityId, clock()))));

  app.post('/api/buildings/:type/upgrade', handler((req, res) => {
    if (isPlannedType(String(req.params.type))) {
      const p = PLANNED_BUILDINGS.find((b) => b.type === req.params.type);
      throw new GameError(409, 'PLANNED_ONLY', `«${p?.name ?? req.params.type}» está planificado: su mecánica todavía no existe y no se puede construir.`);
    }
    const type = parse(z.enum(BUILDING_TYPES, { errorMap: () => ({ message: 'Edificio desconocido.' }) }), req.params.type);
    send(res, runCommand(db, cityId, clock(), idemKey(req), (ctx) => startUpgrade(ctx, type)));
  }));

  app.post('/api/workers', handler((req, res) => {
    const body = parse(workersBody, req.body);
    send(res, runCommand(db, cityId, clock(), idemKey(req), (ctx) => assignWorkers(ctx, body)));
  }));

  app.post('/api/garrison', handler((req, res) => {
    const body = parse(garrisonBody, req.body);
    send(res, runCommand(db, cityId, clock(), idemKey(req), (ctx) => assignGarrison(ctx, body.archers)));
  }));

  app.post('/api/recruit', handler((req, res) => {
    const body = parse(recruitBody, req.body);
    send(res, runCommand(db, cityId, clock(), idemKey(req), (ctx) => recruit(ctx, body.unit, body.quantity)));
  }));

  app.post('/api/expeditions', handler((req, res) => {
    const body = parse(expeditionBody, req.body);
    send(res, runCommand(db, cityId, clock(), idemKey(req), (ctx) => sendExpedition(ctx, body.camp, body.units)));
  }));

  app.use('/api', (_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ruta no encontrada.' } }));

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof GameError) {
      return res.status(err.status).json({ error: { code: err.code, message: err.message } });
    }
    if (err instanceof SyntaxError) {
      return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'El cuerpo de la solicitud no es JSON válido.' } });
    }
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL', message: 'Error interno del servidor.' } });
  });

  return app;
}
