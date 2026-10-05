import type { GameState } from '../types';
import { CloseButton } from './ui';

export function RulesModal({ state, onClose }: { state: GameState; onClose: () => void }) {
  const r = state.rules;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-label="Reglas del juego" onClick={(e) => e.stopPropagation()}>
        <header className="insp-head">
          <h2>Reglas del señorío</h2>
          <CloseButton onClick={onClose} />
        </header>
        <div className="rules">
          <h3>Población y trabajo</h3>
          <ul>
            <li>El castillo fija el <b>límite de habitantes</b>. La villa gana {r.populationGrowthPerMinute} habitantes por minuto hasta alcanzarlo.</li>
            <li>Asigna <b>trabajadores</b> al aserradero, la cantera y la granja desde el panel de cada edificio. Cada edificio tiene un máximo de puestos que crece con su nivel.</li>
            <li>Un edificio productivo recién construido recibe automáticamente a los habitantes libres que quepan.</li>
            <li>Los <b>habitantes libres</b> (sin puesto) generan {r.goldPerFreeInhabitantPerMinute} de oro por minuto cada uno, además del ingreso base del castillo.</li>
            <li>En esta versión no hay hambre, muerte de población ni mantenimiento militar.</li>
          </ul>
          <h3>Almacén</h3>
          <ul>
            <li>El almacén limita cuánto puedes guardar de cada recurso. Al llenarse, la producción se detiene y el botín que no quepa se pierde.</li>
          </ul>
          <h3>Construcción</h3>
          <ul>
            <li>Solo puede haber <b>una construcción activa</b> por ciudad. Los recursos se pagan al empezar.</li>
            <li>Los niveles van del 1 al {r.maxLevel}. Mejorar exige un nivel mínimo de castillo (y, en obras grandes, de almacén para poder guardar su costo).</li>
            <li>El servidor lleva la cuenta del tiempo: la obra termina aunque cierres el navegador.</li>
          </ul>
          <h3>Ejército y expediciones</h3>
          <ul>
            <li>El cuartel desbloquea unidades por nivel y las entrena por tiempo. Los pedidos se entrenan en cola (máx. {r.recruitMaxQueue}).</li>
            <li>Las tropas enviadas no están disponibles hasta regresar. Marchan al ritmo de la unidad más lenta; la vuelta tarda lo mismo que la ida.</li>
            <li>
              <b>Combate (sin azar):</b> ataque propio = Σ unidades × ataque. Si ese ataque ≥ la defensa del campamento, ganas.
              Bajas al ganar = 0,9 · ataque_NPC / (ataque_NPC + defensa_propia) / razón^1,5 (entre 3 % y 90 %). Al perder se pierde entre el 50 % y el 95 % del ejército.
            </li>
            <li>Si ganas, el botín del campamento queda limitado por la capacidad de carga de los supervivientes y se entrega al regresar, respetando el almacén.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
