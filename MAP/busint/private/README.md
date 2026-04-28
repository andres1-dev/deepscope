# Private - Servidor

Código del lado del servidor para Access Busints.

##  Estructura

\\\
private/
 supabase/              # Supabase Edge Functions
    config.toml       # Configuración
    functions/
       upload-data/  # Función para subir datos
    migrations/       # Migraciones SQL
    README.md
 gas/                   # Google Apps Script (futuro)
 package.json
\\\

##  Supabase

Ver [supabase/README.md](./supabase/README.md) para instrucciones detalladas.

### Quick Start

\\\ash
# Vincular proyecto
supabase link --project-ref zpikjjcbievfpzegupmw

# Aplicar migraciones
supabase db push

# Desplegar función
supabase functions deploy upload-data
\\\

##  Google Apps Script (Futuro)

Integración con Google Sheets para importar/exportar datos.
