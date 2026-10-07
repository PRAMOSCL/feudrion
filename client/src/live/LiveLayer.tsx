import { useEffect, useMemo, useRef, useState } from 'react';
import { SCENE_H, SCENE_W } from '../sceneConfig';
import { LiveRenderer } from './liveRenderer';
import type { LiveModel } from './liveModel';

interface Props {
  model: LiveModel;
  /** El usuario no desactivó las animaciones y el sistema no pide reducir movimiento. */
  animate: boolean;
}

/**
 * Dos canvases (agua y personajes) dentro del lienzo escalado de la ciudad. Ignoran el ratón: la selección de edificios sigue
 * siendo por silueta. El bucle de dibujo es imperativo (no hay estado de React por fotograma ni consultas al servidor por fotograma).
 */
export function LiveLayer({ model, animate }: Props) {
  const waterRef = useRef<HTMLCanvasElement>(null);
  const actorsRef = useRef<HTMLCanvasElement>(null);
  const guardsBackRef = useRef<HTMLCanvasElement>(null);
  const guardsFrontRef = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<LiveRenderer | null>(null);

  useEffect(() => {
    const r = new LiveRenderer({ water: waterRef.current!, actors: actorsRef.current!, guardsBack: guardsBackRef.current!, guardsFront: guardsFrontRef.current! });
    renderer.current = r;
    void r.init();
    return () => {
      r.dispose();
      renderer.current = null;
    };
  }, []);

  // El modelo solo cambia cuando cambian los datos reales (no en cada refresco del servidor).
  const key = JSON.stringify(model);
  const stable = useMemo(() => model, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => renderer.current?.setModel(stable), [stable]);
  useEffect(() => renderer.current?.setMode(animate, true), [animate]);

  return (
    <>
      <canvas ref={waterRef} className="live-water" width={SCENE_W} height={SCENE_H} aria-hidden />
      <canvas ref={guardsBackRef} className="live-guards-back" aria-hidden />
      <canvas ref={actorsRef} className="live-actors" aria-hidden />
      <canvas ref={guardsFrontRef} className="live-guards-front" aria-hidden />
    </>
  );
}

/** `prefers-reduced-motion: reduce` como booleano reactivo. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => (typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)').matches : false));
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const q = matchMedia('(prefers-reduced-motion: reduce)');
    const on = (e: MediaQueryListEvent) => setReduced(e.matches);
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, []);
  return reduced;
}
