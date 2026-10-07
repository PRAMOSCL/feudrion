-- Fase 2: distritos y parcelas. Migración ADITIVA: no borra ni modifica niveles, trabajadores, recursos, tropas ni informes.
-- Los edificios conservan su fila (y su ID lógico `type`); solo se les anota en qué distrito y parcela están.

ALTER TABLE buildings ADD COLUMN district_id TEXT NOT NULL DEFAULT 'fortress';
ALTER TABLE buildings ADD COLUMN plot_id TEXT;

UPDATE buildings SET district_id = 'fortress', plot_id = 'fortress:' || type WHERE plot_id IS NULL;

-- Una parcela alberga como máximo un edificio por ciudad (sin duplicaciones).
CREATE UNIQUE INDEX ux_buildings_plot ON buildings(city_id, plot_id);
