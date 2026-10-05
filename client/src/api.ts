import type { GameState, UnitType } from './types';

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        // Una clave por acción: si la solicitud se repite, el servidor no la ejecuta dos veces.
        ...(method === 'POST' ? { 'Idempotency-Key': crypto.randomUUID() } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('No se pudo contactar con el servidor. ¿Está el backend en marcha?', 'NETWORK');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(data?.error?.message ?? 'Error inesperado del servidor.', data?.error?.code ?? 'UNKNOWN');
  return data as T;
}

export const api = {
  state: () => request<GameState>('GET', '/api/state'),
  upgrade: (building: string) => request('POST', `/api/buildings/${building}/upgrade`, {}),
  workers: (assignment: Record<string, number>) => request('POST', '/api/workers', assignment),
  recruit: (unit: UnitType, quantity: number) => request('POST', '/api/recruit', { unit, quantity }),
  expedition: (camp: string, units: Partial<Record<UnitType, number>>) => request('POST', '/api/expeditions', { camp, units }),
};
