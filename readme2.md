# DeepScope: Inteligencia Logística, Trazabilidad y Orquestación WMS

Bienvenido al estándar de oro en control operativo, trazabilidad avanzada y gestión integral de activos logísticos. DeepScope no es solo una aplicación; es una plataforma tecnológica diseñada bajo principios de arquitectura distribuida, alta disponibilidad y procesamiento transaccional en tiempo real, orientada a entornos WMS de misión crítica.

---

## La Propuesta de Valor

En entornos donde el OTIF (On Time In Full), la exactitud de inventario y el control de procesos definen la rentabilidad, DeepScope elimina la opacidad operacional mediante:

- Arquitectura event-driven con registro transaccional por unidad logística.
- Modelo de datos orientado a entidades (OP, referencia, pallet, HU, lote, serie).
- Sincronización resiliente bajo esquema offline-first.
- Control granular de procesos intra-logísticos y última milla.

Diseñada como PWA (Progressive Web App) bajo paradigma Zero-Latency UX, permite operar en escenarios de conectividad intermitente sin comprometer integridad, trazabilidad ni consistencia transaccional.

---

## Capacidades Operativas de Nivel Industrial

### 1. Ecosistema de Captura y Validación Multicanal

Adaptabilidad total al hardware y al entorno operativo:

- Modo PDA Láser Industrial: Integración con terminales robustas (Honeywell, Zebra) para lectura masiva de códigos 1D/2D en flujos de alta rotación.
- Visión por Computadora (QR/DataMatrix): Motor de escaneo optimizado para dispositivos móviles estándar.
- Validación Predictiva en Línea: Cruce automático de NIT, referencia, OP y reglas de negocio para reducción superior al 99 por ciento de errores de digitación y picking incorrecto.
- Control por Estados Transaccionales: Bloqueo lógico de procesos fuera de secuencia (recepción, putaway, picking, despacho).

---

### 2. Resiliencia Operativa Offline (Architecture First)

La capa de sincronización convierte cada dispositivo en un nodo transaccional autónomo:

- Persistencia local mediante IndexedDB.
- Cola inteligente de sincronización con reintentos automáticos (hasta 9999 intentos).
- Versionamiento de registros para evitar conflictos de escritura.
- Compresión y almacenamiento local de evidencia fotográfica con marca de agua automática.

Cuando la conectividad se restablece, el sistema ejecuta sincronización incremental con validación de integridad.

---

### 3. Dashboard Ejecutivo y KPIs Logísticos en Tiempo Real

Panel analítico orientado a toma de decisiones tácticas y estratégicas:

- Lead Time por Proceso (recepción, almacenamiento, alistamiento, despacho).
- Fill Rate y OTIF por cliente, ruta o centro de distribución.
- Rotación y Días de Inventario (DIO).
- Tasa de Error Operativo por operario, zona o turno.
- Valor Financiero en Tránsito y exposición de inventario.
- Evidencia digital auditable con trazabilidad por usuario, timestamp y dispositivo.

---

### 4. Seguridad y Gobernanza de Datos

- Autenticación fuerte mediante WebAuthn (Biometría) con soporte para huella dactilar y FaceID.
- Control de acceso basado en roles (RBAC) con cuatro niveles (ADMIN, MODERATOR, USER, GUEST).
- Trazabilidad de acciones (audit trail) con registro de usuario, dispositivo y timestamp.
- Encriptación en tránsito (HTTPS/TLS).
- Segmentación lógica por centro, cliente o unidad de negocio.

---

## Arquitectura Tecnológica

- Frontend: PWA optimizada, UX orientada a operación RF intensiva con feedback háptico y visual.
- Modelo de Sincronización: Event sourcing ligero con confirmación transaccional y cola persistente.
- Infraestructura: Despliegue sobre Google Apps Script (GAS) o backend desacoplado vía API REST.
- Service Workers: Gestión de tareas en segundo plano, notificaciones push y cache inteligente con estrategia Network-First.
- Escalabilidad Horizontal: Preparado para integrarse con microservicios logísticos, ERPs (SAP, Oracle, SIESA) y motores analíticos externos.
- Stack Tecnológico: JavaScript ES6, HTML5, CSS3, IndexedDB, WebRTC, WebAuthn, DataTables, SheetJS, Flatpickr.

---

## Módulos Premium para WMS Empresarial (Roadmap Estratégico)

DeepScope constituye la base de un WMS modular y escalable. Los siguientes módulos de alto rendimiento representan la evolución natural de la plataforma y están disponibles bajo licenciamiento Premium. Cada módulo ha sido diseñado siguiendo principios de Domain-Driven Design (DDD) y event-driven architecture para garantizar una integración perfecta con el núcleo existente.

---

### Módulo de Geofencing y Modelado Topológico de Almacén (Premium)

Valor de Negocio: Reducción de errores de ubicación en un 95 por ciento, optimización del espacio en un 30 por ciento y trazabilidad completa de movimientos intra-logísticos.

Especificaciones Técnicas:

- Motor de Parametrización Espacial: Sistema jerárquico de 8 niveles configurables:

  Centro, Bodega, Zona, Subzona, Pasillo, Rack, Nivel, Posición.

- Georreferenciación Híbrida:
  - Coordenadas GPS para validación de entregas en última milla (precisión inferior a 5 metros).
  - Mapeo cartesiano interno (coordenadas X, Y, Z) para posicionamiento preciso en racks y estanterías.

- Segmentación por Procesos: Asignación lógica de áreas para recepción, putaway, picking, staging, cross-docking y despacho.

- Reglas Dinámicas de Restricción (Gestión de Reglas de Negocio):
  - Por tipo de producto (peligrosos, refrigerados, de alto valor).
  - Por rotación (clasificación ABC).
  - Por compatibilidad química o física.
  - Por fecha de caducidad (FEFO).

- Validación en Tiempo Real: Verificación de movimientos contra reglas topológicas mediante dispositivos RF.

- Auditoría de Desplazamientos: Registro de toda reubicación con timestamp, usuario y motivo.

---

### Trazabilidad Multimodal de OP y Referencia (Premium)

Valor de Negocio: Reducción de lead time en un 25 por ciento, identificación de cuellos de botella en tiempo real y cumplimiento de SLA del 99.5 por ciento.

Arquitectura de Eventos:

- Modelo de Datos Temporal: Registro cronológico por entidad logística (OP, referencia, pallet, handling unit).

- Línea de Tiempo Completa con metadata enriquecida:
  - Estado operativo (RECEPCIONADO, EN_PUTAWAY, ALMACENADO, EN_PICKING, PICKING_COMPLETADO, EN_DESPACHO, DESPACHADO).
  - Usuario responsable con rol y turno.
  - Dispositivo utilizado (IMEI, MAC address).
  - Timestamp exacto con precisión de milisegundos.
  - Centro de costo asociado.
  - Evidencia digital (fotos, escaneos, firmas).

- Métricas Automatizadas:
  - Lead Time total y por subproceso.
  - Takt Time (tiempo entre unidades procesadas).
  - Throughput por hora y por turno.
  - SLA interno versus real.
  - Identificación de cuellos de botella mediante heat maps temporales.

- Motor de Alertas: Notificaciones push cuando un proceso excede el tiempo esperado.

---

### Agente de IA Logística Integrado (WMS Cognitive Engine) - Premium

Valor de Negocio: Incremento de productividad del 35 por ciento, reducción de inventario muerto en un 40 por ciento y toma de decisiones basada en datos con precisión predictiva del 92 por ciento.

Componentes del Motor Cognitivo:

1.  Optimización Dinámica de Slotting:
    - Algoritmo genético para asignación óptima de productos basado en rotación (análisis ABC), correlación de picking (productos frecuentemente pedidos juntos), restricciones físicas (peso, volumen, temperatura) y estacionalidad.
    - Re-slotting automático nocturno con sugerencias de reubicación.

2.  Priorización Inteligente de Tareas:
    - Modelo de reinforcement learning para secuenciación óptima de órdenes.
    - Balanceo de carga entre operarios.
    - Minimización de dead-head travel (desplazamientos vacíos).

3.  Detección de Anomalías en Inventario:
    - Modelos estadísticos (SARIMA, Isolation Forest) para detectar shrinkage no explicado, desviaciones en conteos cíclicos, patrones de error por operario o zona, y riesgo de obsolescencia.

4.  Predicción de Quiebres y Sobreinventario:
    - Redes LSTM (Long Short-Term Memory) para forecast de demanda.
    - Modelos de inventario de seguridad dinámicos.
    - Recomendaciones de reorden con puntos de pedido optimizados.

5.  Simulación de Escenarios (What-If Analysis):
    - Motor de simulación Monte Carlo para evaluar impacto de nuevas reglas de slotting, efecto de cambios en mix de productos, escenarios de crecimiento de volumen y dimensionamiento de fuerza laboral.

---

### Integración Bidireccional con ERPs (Premium)

Valor de Negocio: Eliminación de doble digitación, visibilidad en tiempo real del inventario ERP y reconciliación automática.

Conectores Disponibles:

- SAP ECC y S4HANA: vía RFC, BAPI, IDoc o servicios OData.
- Oracle E-Business Suite y NetSuite: vía REST o SOAP APIs.
- SIESA (nativo): Integración profunda con tablas de facturación e inventario.
- Microsoft Dynamics: vía REST APIs.
- Odoo y OpenERP: vía XML-RPC o JSON-RPC.

Capacidades de Integración:

- Sincronización automática de maestros (productos, clientes, proveedores).
- Envío de confirmaciones de picking y despacho en tiempo real.
- Recepción de órdenes de venta y órdenes de compra.
- Actualización bidireccional de inventario (transacciones WMS a ERP).
- Conciliación automática con detección de discrepancias.

---

### Módulo de Gestión de Flota y Rutas (Premium)

Valor de Negocio: Reducción de costos de transporte en un 18 por ciento, mejora en cumplimiento de ventanas de entrega del 40 por ciento.

Funcionalidades:

- Optimización de rutas dinámica (VRP - Vehicle Routing Problem) con múltiples restricciones (ventanas de tiempo, capacidad, tipo de vehículo).
- Seguimiento GPS en tiempo real de unidades de transporte.
- Geolocalización de entregas con validación por geocerca.
- Prueba de entrega electrónica (e-POD) con firma digital y foto.
- Gestión de incidencias en ruta (retrasos, averías, devoluciones).
- Cálculo automático de indicadores: costo por kilómetro, costo por entrega, eficiencia de ruta.

---

### Analítica Avanzada con Data Lake (Premium)

Valor de Negocio: Descubrimiento de patrones ocultos, inteligencia de negocio en tiempo real y reporting corporativo unificado.

Componentes:

- Exportación automática de datos operativos a Google BigQuery, Amazon Redshift o Snowflake.
- Modelo de datos dimensional (estrella) optimizado para análisis logístico.
- Conectores nativos a Power BI, Tableau y Looker Studio.
- Dashboards ejecutivos preconstruidos:
  - Cuadro de mando integral logístico.
  - Análisis de productividad por operario, turno y zona.
  - Costeo por orden y por cliente.
  - Tendencias de demanda y estacionalidad.
- APIs GraphQL para consultas analíticas personalizadas.

---

## Especificaciones Técnicas y Guía de Operación

Esta sección está dirigida a equipos de TI, integradores de sistemas y administradores de bodega. Describe la arquitectura interna, los flujos de trabajo clave y las decisiones de diseño que hacen de DeepScope una plataforma robusta y escalable.

---

### Descripción de la Arquitectura

DeepScope opera bajo un modelo Offline-First con sincronización eventual, ideal para entornos de conectividad intermitente típicos en bodegas industriales.

La arquitectura se compone de las siguientes capas:

- Capa de Presentación: Interfaz de usuario basada en HTML5, CSS3 y componentes dinámicos que se adaptan a dispositivos móviles y terminales RF.
- Capa de Negocio en Cliente: Lógica de orquestación de datos, validación de reglas y gestión de estados transaccionales.
- Capa de Persistencia Local: Almacenamiento en IndexedDB para datos operativos y cola de sincronización, más localStorage para configuración y caché.
- Service Worker: Gestión de cache de assets, sincronización en segundo plano y recepción de notificaciones push.
- Backend: Implementado sobre Google Apps Script, actuando como API Gateway hacia hojas de cálculo y Google Drive.
- Fuentes de Datos: Hojas de Google Sheets que actúan como base de datos principal para productos, órdenes y soportes.
- Almacenamiento de Archivos: Google Drive para imágenes de soportes de entrega.

---

### Fuentes de Datos y Estructura

El sistema se alimenta de múltiples hojas de Google Sheets con las siguientes responsabilidades:

- DATA2: Contiene documentos de tipo REC en formato JSON embebido.
- SIESA y SIESA_V2: Fuente principal de facturas, remisiones y sus detalles (valores, referencias, cantidades).
- REC: Fuente alternativa de documentos de despacho con filtros específicos.
- SOPORTES: Historial de entregas con timestamps, datos de la transacción e identificadores de imagen.
- vapid_keys: Almacena las claves pública y privada VAPID para notificaciones push.
- suscripciones: Registro de endpoints de suscripción push por dispositivo.

---

### Flujo de Datos y Lógica de Negocio Central

El proceso principal de obtención de datos ejecuta en paralelo la carga desde las fuentes DATA2, SIESA, REC y SOPORTES. La lógica de combinación sigue estos pasos:

1.  Procesar documentos DATA2: Cada documento se asocia con facturas de SIESA que compartan el mismo número de lote.
2.  Procesar documentos REC: Similar al paso anterior, utilizando la fuente REC.
3.  Identificar facturas huérfanas: Aquellas facturas de SIESA que no pudieron asociarse a ningún documento DATA2 o REC se agrupan en una categoría especial para su revisión.
4.  Enriquecer con soportes: Cada factura se complementa con información del historial de entregas (fecha de entrega, URL de imagen) cuando existe.

El resultado es una base de datos en memoria que relaciona documentos de despacho con sus facturas asociadas y el estado de entrega de cada una.

---

### Ciclo de Vida de una Entrega

El sistema implementa una máquina de estados para garantizar la integridad transaccional:

1.  Captura: El operador escanea un código QR con formato documento-número de identificación tributaria, o ingresa manualmente un número de lote.
2.  Visualización: El sistema muestra las facturas pendientes asociadas al documento escaneado.
3.  Toma de Evidencia: Al presionar el botón de entrega, se captura una fotografía. El sistema aplica automáticamente una marca de agua con los metadatos de la transacción (usuario, fecha, factura).
4.  Cola Local: Los datos de la entrega y la imagen (convertida a base64) se encapsulan en un trabajo y se añaden a la cola de sincronización. La interfaz actualiza inmediatamente el estado a procesando.
5.  Sincronización: Cuando hay conectividad, la cola procesa los trabajos en segundo plano, enviando la información al backend.
6.  Confirmación: Ante respuesta exitosa del servidor, el sistema actualiza el estado a entregado y persiste el cambio en la base de datos local.
7.  Eliminación (solo administradores): Los usuarios con rol de administrador pueden revertir una entrega, lo que elimina el registro del servidor, la imagen asociada y restaura el estado a pendiente.

---

### Módulos Clave y su Responsabilidad

- Módulo de Autenticación: Gestiona el inicio de sesión, la biometría y el control de acceso basado en roles.
- Módulo de Cola de Carga: Corazón de la resiliencia, gestiona trabajos offline, reintentos y persistencia local.
- Módulo de Escaneo: Abstrae el hardware de captura, manejando modos PDA, cámara y manual.
- Módulo de Soportes Grid: Visualiza la evidencia fotográfica con infinite scroll y calcula KPIs en tiempo real.
- Módulo de Historial: Proporciona reportes detallados y tablas dinámicas con filtros avanzados.
- Service Worker: Cachea assets, gestiona sincronización en segundo plano y maneja notificaciones push con deduplicación.

---

### Configuración y Despliegue para Administradores

Autenticación y Usuarios:

- Los usuarios se gestionan a través del panel de administración accesible para rol ADMIN.
- Las credenciales se almacenan en PropertiesService del script de Google Apps Script.
- Se recomienda implementar hashing de contraseñas para entornos productivos.

Fuentes de Datos:

- Las constantes con los identificadores de las hojas de cálculo deben actualizarse en el archivo de configuración principal.
- Cada hoja debe mantener la estructura de columnas esperada por el sistema.

Manejo de Archivos:

- El identificador de carpeta en Google Drive determina dónde se almacenan las imágenes de soporte.
- Las imágenes se sirven públicamente a través del dominio de Googleusercontent.

Notificaciones Push:

- Requiere un proyecto con claves VAPID configuradas.
- Las claves pública y privada se almacenan en la hoja vapid_keys.
- Las suscripciones de los clientes se guardan en la hoja suscripciones.

Variables de Entorno en PropertiesService:

- USERS: Almacena el array de usuarios en formato JSON.
- RESET_TOKENS: Guarda los tokens para recuperación de contraseña con expiración de 5 minutos.
- SESSIONS: Registra las sesiones activas con expiración de 24 horas.

---

### Integración con Backend

El backend implementado en Google Apps Script expone los siguientes servicios:

- Autenticación: Verificación de credenciales y login biométrico.
- Gestión de Usuarios: Creación, edición, listado y eliminación de usuarios.
- Transacciones: Inserción de entregas con imágenes y eliminación de registros.
- Recuperación de Contraseña: Envío de correos con enlaces de un solo uso y expiración de 5 minutos.
- Gestión de Sesiones: Tokens con validez de 24 horas.

Consideraciones de Seguridad:

- Los tokens de sesión expiran a las 24 horas.
- Los tokens de recuperación son de un solo uso y expiran en 5 minutos.
- Se implementa validación de token para todas las acciones excepto login y recuperación.

---

### KPIs Operativos y Cálculos en Tiempo Real

El módulo de KPIs calcula métricas directamente en el navegador sin consultas adicionales al servidor:

- Normalización de fechas: Convierte formatos diversos (DD/MM/AAAA, DD/MM/AAAA HH:MM:SS) a objetos Date para filtrado preciso.
- Agregación por entidad: Utiliza estructuras de mapa para deduplicar facturas y acumular métricas por cliente y proveedor.
- Cálculo de indicadores derivados: Porcentaje de entregado, rotación de unidades, días promedio de entrega, entre otros.
- Visualización dinámica: Inyección de resultados en el DOM con actualización en tiempo real.
- Edición de pendientes: Permite modificar lote y estado de facturas pendientes, actualizando la fuente original y el caché local.

---

## Conclusión

DeepScope no es únicamente una herramienta de monitoreo; es una plataforma de orquestación logística diseñada para evolucionar hacia un WMS de clase empresarial. Su arquitectura modular, su resiliencia offline-first y su capacidad de integración la convierten en la base ideal para construir una solución que transforma la operación en un entorno:

- Medible (KPIs en tiempo real, trazabilidad completa).
- Auditable (evidencia digital, registro de acciones).
- Predictivo (con la incorporación de módulos de IA).
- Escalable (desde una bodega hasta una red de distribución nacional).

Convierte la operación en un centro de inteligencia logística, donde cada unidad, cada movimiento y cada decisión están respaldados por datos confiables y accionables.

---

**Desarrollado por Andrés Mendoza**  
**© 2026 · Creado para el GrupoTDM**
