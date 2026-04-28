# Supabase Edge Functions

## 📁 Estructura

```
private/supabase/
├── config.toml                    # Configuración de Supabase
├── functions/
│   └── upload-data/
│       └── index.ts              # Función para subir datos
└── README.md
```

## 🚀 Configuración

### 1. Instalar Supabase CLI

```bash
# Windows (con Scoop)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# macOS
brew install supabase/tap/supabase

# Linux
brew install supabase/tap/supabase
```

### 2. Iniciar sesión

```bash
supabase login
```

### 3. Vincular proyecto

```bash
supabase link --project-ref zpikjjcbievfpzegupmw
```

## 📊 Tablas en Supabase

### Tabla: CONFECCION

```sql
CREATE TABLE CONFECCION (
  id BIGSERIAL PRIMARY KEY,
  "OP" TEXT,
  "Ref" TEXT,
  "InvPlanta" INTEGER,
  "NombrePlanta" TEXT,
  "FSalidaConf" DATE,
  "FEntregaConf" DATE,
  "Proceso" TEXT,
  "Descripcion" TEXT,
  "Cuento" TEXT,
  "Genero" TEXT,
  "Obs" TEXT,
  "Tipo Tejido" TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Tabla: PROCESO

```sql
CREATE TABLE PROCESO (
  id BIGSERIAL PRIMARY KEY,
  "OP" TEXT,
  "Ref" TEXT,
  "InvPlanta" INTEGER,
  "NombrePlanta" TEXT,
  "FSalidaConf" DATE,
  "FEntregaConf" DATE,
  "Proceso" TEXT,
  "Descripcion" TEXT,
  "Cuento" TEXT,
  "Genero" TEXT,
  "Obs" TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 🔧 Desplegar Función

```bash
# Desplegar la función
supabase functions deploy upload-data

# Ver logs
supabase functions logs upload-data
```

## 📡 Uso de la API

### Endpoint

```
POST https://zpikjjcbievfpzegupmw.supabase.co/functions/v1/upload-data
```

### Headers

```
Authorization: Bearer YOUR_ANON_KEY
Content-Type: application/json
```

### Body

```json
{
  "data": [
    {
      "OP": "353",
      "Ref": "FE6022",
      "InvPlanta": 79,
      "NombrePlanta": "JESSICA MADELEYNE MENDOZA GUZMAN",
      "FSalidaConf": "2026-03-16",
      "FEntregaConf": "2026-03-24",
      "Proceso": "TERMINACIÓN",
      "Descripcion": "ENTERIZO",
      "Cuento": "HACEMOS MODA",
      "Genero": "DAMA",
      "Obs": "Observación"
    }
  ],
  "type": "PROCESOS"
}
```

### Response

```json
{
  "success": true,
  "message": "Successfully inserted 1 records into PROCESO",
  "data": [...]
}
```

## 🧪 Testing Local

```bash
# Iniciar Supabase localmente
supabase start

# Servir la función localmente
supabase functions serve upload-data

# Hacer request
curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/upload-data' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"data":[...],"type":"CONFECCION"}'
```

## 🔒 Seguridad

- La función valida que el usuario esté autenticado
- Solo acepta arrays de datos
- Valida el tipo (CONFECCION o PROCESOS)
- Usa Row Level Security (RLS) de Supabase

## 📝 Notas

- El proyecto ID es: `zpikjjcbievfpzegupmw`
- Las tablas son: `CONFECCION` y `PROCESO`
- Las fechas deben estar en formato ISO: `YYYY-MM-DD`
