-- Crear tabla CONFECCION
CREATE TABLE IF NOT EXISTS CONFECCION (
  id BIGSERIAL PRIMARY KEY,
  OP TEXT,
  Ref TEXT,
  InvPlanta INTEGER,
  NombrePlanta TEXT,
  FSalidaConf DATE,
  FEntregaConf DATE,
  Proceso TEXT,
  Descripcion TEXT,
  Cuento TEXT,
  Genero TEXT,
  Obs TEXT,
  TipoTejido TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear tabla PROCESO
CREATE TABLE IF NOT EXISTS PROCESO (
  id BIGSERIAL PRIMARY KEY,
  OP TEXT,
  Ref TEXT,
  InvPlanta INTEGER,
  NombrePlanta TEXT,
  FSalidaConf DATE,
  FEntregaConf DATE,
  Proceso TEXT,
  Descripcion TEXT,
  Cuento TEXT,
  Genero TEXT,
  Obs TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_confeccion_op ON CONFECCION(OP);
CREATE INDEX IF NOT EXISTS idx_confeccion_ref ON CONFECCION(Ref);
CREATE INDEX IF NOT EXISTS idx_confeccion_fecha_salida ON CONFECCION(FSalidaConf);

CREATE INDEX IF NOT EXISTS idx_proceso_op ON PROCESO(OP);
CREATE INDEX IF NOT EXISTS idx_proceso_ref ON PROCESO(Ref);
CREATE INDEX IF NOT EXISTS idx_proceso_fecha_salida ON PROCESO(FSalidaConf);

-- Habilitar Row Level Security
ALTER TABLE CONFECCION ENABLE ROW LEVEL SECURITY;
ALTER TABLE PROCESO ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad (ajustar según necesidades)
-- Permitir lectura a usuarios autenticados
CREATE POLICY "Allow authenticated read access" ON CONFECCION
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read access" ON PROCESO
  FOR SELECT TO authenticated USING (true);

-- Permitir inserción a usuarios autenticados
CREATE POLICY "Allow authenticated insert access" ON CONFECCION
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated insert access" ON PROCESO
  FOR INSERT TO authenticated WITH CHECK (true);
