-- Ciudad viva: muralla construible y guarnición de arqueros. Migración ADITIVA: no borra ni reinicia datos.

-- Arqueros asignados a la guarnición. Se RESTAN de `troops` (disponibles en casa) al asignarlos y se devuelven al liberarlos,
-- así no pueden reclutarse de nuevo ni salir en expedición mientras estén reservados.
ALTER TABLE cities ADD COLUMN garrison_archers INTEGER NOT NULL DEFAULT 0 CHECK (garrison_archers >= 0);

-- La muralla es un edificio más (tipo 'wall', sin parcela): las ciudades existentes empiezan en nivel 0.
-- Sus edificios, recursos y tropas actuales no se tocan.
INSERT INTO buildings (city_id, type, level, workers)
SELECT c.id, 'wall', 0, 0 FROM cities c
WHERE NOT EXISTS (SELECT 1 FROM buildings b WHERE b.city_id = c.id AND b.type = 'wall');
