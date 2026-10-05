-- Señoríos V1: esquema inicial. SQLite es la fuente de verdad.
-- Todos los instantes son milisegundos Unix del reloj del servidor.

CREATE TABLE players (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  is_demo     INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL
);

CREATE TABLE cities (
  id             INTEGER PRIMARY KEY,
  player_id      INTEGER NOT NULL REFERENCES players(id),
  name           TEXT NOT NULL,
  -- Instante hasta el cual la simulación ya fue aplicada.
  last_update_at INTEGER NOT NULL,
  -- Recursos y población con precisión fraccionaria (la UI muestra el entero).
  wood           REAL NOT NULL,
  stone          REAL NOT NULL,
  food           REAL NOT NULL,
  gold           REAL NOT NULL,
  population     REAL NOT NULL,
  created_at     INTEGER NOT NULL,
  CHECK (wood >= 0 AND stone >= 0 AND food >= 0 AND gold >= 0 AND population >= 0)
);

CREATE TABLE buildings (
  city_id  INTEGER NOT NULL REFERENCES cities(id),
  type     TEXT NOT NULL,
  level    INTEGER NOT NULL DEFAULT 0 CHECK (level BETWEEN 0 AND 10),
  workers  INTEGER NOT NULL DEFAULT 0 CHECK (workers >= 0),
  PRIMARY KEY (city_id, type)
);

CREATE TABLE constructions (
  id            INTEGER PRIMARY KEY,
  city_id       INTEGER NOT NULL REFERENCES cities(id),
  building_type TEXT NOT NULL,
  target_level  INTEGER NOT NULL,
  started_at    INTEGER NOT NULL,
  finishes_at   INTEGER NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'done'))
);
-- Una única construcción activa por ciudad (garantizado por la base de datos).
CREATE UNIQUE INDEX ux_constructions_one_active ON constructions(city_id) WHERE status = 'active';

CREATE TABLE recruitments (
  id          INTEGER PRIMARY KEY,
  city_id     INTEGER NOT NULL REFERENCES cities(id),
  unit_type   TEXT NOT NULL,
  quantity    INTEGER NOT NULL CHECK (quantity > 0),
  started_at  INTEGER NOT NULL,
  finishes_at INTEGER NOT NULL,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'done'))
);
CREATE INDEX ix_recruitments_city_status ON recruitments(city_id, status);

CREATE TABLE troops (
  city_id   INTEGER NOT NULL REFERENCES cities(id),
  unit_type TEXT NOT NULL,
  quantity  INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  PRIMARY KEY (city_id, unit_type)
);

CREATE TABLE expeditions (
  id             INTEGER PRIMARY KEY,
  city_id        INTEGER NOT NULL REFERENCES cities(id),
  camp_key       TEXT NOT NULL,
  -- outbound -> returning (combate resuelto) -> completed (supervivientes y botín entregados)
  status         TEXT NOT NULL CHECK (status IN ('outbound', 'returning', 'completed')),
  sent_at        INTEGER NOT NULL,
  travel_seconds INTEGER NOT NULL,
  arrive_at      INTEGER NOT NULL,
  return_at      INTEGER NOT NULL,
  result         TEXT CHECK (result IN ('victory', 'defeat')),
  resolved_at    INTEGER,
  completed_at   INTEGER,
  loot_json      TEXT,
  delivered_json TEXT
);
CREATE INDEX ix_expeditions_city_status ON expeditions(city_id, status);

CREATE TABLE expedition_units (
  expedition_id INTEGER NOT NULL REFERENCES expeditions(id),
  unit_type     TEXT NOT NULL,
  sent          INTEGER NOT NULL CHECK (sent > 0),
  lost          INTEGER NOT NULL DEFAULT 0 CHECK (lost >= 0),
  PRIMARY KEY (expedition_id, unit_type)
);

CREATE TABLE reports (
  id             INTEGER PRIMARY KEY,
  city_id        INTEGER NOT NULL REFERENCES cities(id),
  expedition_id  INTEGER NOT NULL UNIQUE REFERENCES expeditions(id),
  camp_key       TEXT NOT NULL,
  result         TEXT NOT NULL CHECK (result IN ('victory', 'defeat')),
  created_at     INTEGER NOT NULL,
  sent_json      TEXT NOT NULL,
  lost_json      TEXT NOT NULL,
  survivors_json TEXT NOT NULL,
  loot_json      TEXT NOT NULL,
  -- Se completa una sola vez cuando las tropas regresan.
  delivered_json TEXT,
  delivered_at   INTEGER,
  details_json   TEXT NOT NULL
);
CREATE INDEX ix_reports_city_created ON reports(city_id, created_at DESC);

-- Claves de idempotencia: una solicitud repetida devuelve la respuesta original.
CREATE TABLE idempotency_keys (
  key         TEXT NOT NULL,
  city_id     INTEGER NOT NULL,
  status      INTEGER NOT NULL,
  response    TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (key, city_id)
);
