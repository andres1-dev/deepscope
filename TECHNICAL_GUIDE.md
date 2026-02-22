# Guía Técnica: Arquitectura de DeepScope 🧠

Esta guía detalla el funcionamiento interno de los módulos core de la aplicación, explicando cómo interactúan para lograr una experiencia logística de alto nivel.

---

## 1. Núcleo de Energía: Service Worker (`sw.js`)
El Service Worker es el corazón de la PWA. Implementa:
- **Estrategia de Cache**: *Network-First* para archivos críticos y assets externos, asegurando que el usuario siempre tenga la última versión del sistema.
- **Background Polling**: Un sistema de consulta en segundo plano que verifica nuevas notificaciones cada 2 minutos, funcionando incluso cuando la app está cerrada.
- **Gestión de Notificaciones Push**: Recibe *ticks* desde Google Apps Script y gestiona la visualización unificada para evitar duplicados mediante un sistema de bloqueo por ID.

## 2. Motor de Sincronización: Cola de Carga (`upload_queue.js`)
El sistema de persistencia offline utiliza **IndexedDB** para manejar grandes volúmenes de datos (incluyendo fotos base64).
- **Flujo de Fallback**: Si el `fetch` a la API falla, el objeto de carga se serializa y se guarda en IndexedDB.
- **Auto-Sync**: Al recuperar conexión, el sistema recorre la cola y reintenta las cargas de forma secuencial para mantener el orden cronológico.
- **Estrategia de Chunks**: Los datos se dividen en fragmentos manejables (configurados en `MAX_CHUNK_SIZE`) para evitar saturar el servidor de Google Apps Script.

## 3. Lógica de Escaneo Profesional (`scanner_logic.js` & `scanner_camera.js`)
El módulo de escaneo es una máquina de estados que gestiona:
- **Foco Persistente**: Evita que el teclado virtual se oculte en dispositivos PDA, manteniendo el input de texto siempre activo para el láser de hardware.
- **Manejo de Cámara**: Capas de abstracción sobre `html5-qrcode` para gestionar resoluciones dinámicas, zoom y acceso a la cámara trasera por defecto.
- **Validación Predictiva**: Antes de enviar, el sistema valida la estructura del código leído contra la base de datos descargada localmente para dar feedback instantáneo (sonido de éxito/error).

## 4. Ingeniería de Datos y Reporting (`database.js` & `soportes_grid.js`)
- **Compresión de Imagen**: Antes de subir soportes fotográficos, las imágenes se redimensionan en el cliente (`canvas` API) a un ancho máximo de 800px para optimizar el ancho de banda.
- **Infinite Scroll**: El visualizador de soportes utiliza un patrón de *Sentinel* e `IntersectionObserver` para cargar imágenes dinámicamente, permitiendo navegar por miles de registros sin degradar el rendimiento del DOM.
- **Cálculo de KPIs**: La lógica en el cliente calcula porcentajes de entrega y valores totales mediante acumuladores de alta eficiencia, evitando sobrecargar el servidor con consultas pesadas.

## 5. Backend: Integración con Google Apps Script
El servidor actúa como un **API RESTful** ligero:
- **Action Router**: El `doPost` identifica la acción (`login`, `upload`, `get-data`, `broadcast`) y la direcciona al controlador correspondiente.
- **Data Lake**: Utiliza Google Spreadsheets como almacenamiento estructurado, permitiendo que el personal administrativo vea los datos en tiempo real sin herramientas adicionales.

---

## Estructura de Datos (Core)
El sistema maneja tres entidades principales:
1. **Facturas**: El documento maestro a entregar.
2. **Soportes**: La evidencia física (fotos/firmas) vinculada a la factura.
3. **Usuarios**: Credenciales y niveles de acceso (Admin/User).

---
*Este documento es parte de la documentación técnica oficial de DeepScope v7.3.*
