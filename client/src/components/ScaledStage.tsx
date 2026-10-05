import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode, type RefObject } from 'react';
import { fitScale } from '../sceneGeometry';

interface Props {
  width: number;
  height: number;
  minScale?: number;
  /** Imagen de fondo difuminada que integra el margen cuando la proporción no coincide (nunca se deforma). */
  backdropSrc?: string | null;
  backdropColor?: string;
  frameRef: RefObject<HTMLDivElement>;
  cursor?: CSSProperties['cursor'];
  onPointerMove?: (e: PointerEvent<HTMLDivElement>) => void;
  onPointerLeave?: () => void;
  onClick?: (e: PointerEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>) => void;
  children: ReactNode;
  label: string;
}

/**
 * Lienzo de tamaño fijo (coordenadas nativas) escalado de forma uniforme para caber en su contenedor.
 * Capa artística y anclas viven dentro del mismo `.stage`, por lo que comparten un único sistema de
 * coordenadas: cambiar el tamaño de la ventana solo cambia `--s`. Los elementos que deben mantener
 * su tamaño en pantalla (etiquetas) se contraescalan con `scale(calc(1 / var(--s)))`.
 */
export function ScaledStage({ width, height, minScale = 0.55, backdropSrc, backdropColor = '#14120d', frameRef, cursor, onPointerMove, onPointerLeave, onClick, children, label }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () => setScale(fitScale(el.clientWidth, el.clientHeight, width, height, minScale));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width, height, minScale]);

  // Si el lienzo no cabe (pantallas muy pequeñas) se centra el desplazamiento horizontal inicial.
  useEffect(() => {
    const el = viewportRef.current;
    if (el && el.scrollWidth > el.clientWidth) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  }, [scale]);

  return (
    <div className="stage-viewport" ref={viewportRef} style={{ background: backdropColor }}>
      {backdropSrc && <div className="stage-backdrop" style={{ backgroundImage: `url(${backdropSrc})` }} aria-hidden />}
      <div
        className="stage-frame"
        ref={frameRef}
        style={{ width: width * scale, height: height * scale, ['--s' as string]: scale, cursor }}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        onClick={onClick}
        role="group"
        aria-label={label}
      >
        <div className="stage" style={{ width, height, transform: `scale(${scale})` }}>
          {children}
        </div>
      </div>
    </div>
  );
}
