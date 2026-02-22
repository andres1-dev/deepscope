// ============================================
// NotificationManager — Adaptado para usar GAS r1 (VAPID/JWT)
// ============================================
class NotificationManager {
    constructor() {
        this.swRegistration = null;
        this.isSubscribed = false;
        this.vapidPublicKey = null; // Se obtiene dinámicamente de r1
        this.lastNotificationTimestamp = 0;

        // URL del GAS de notificaciones r1
        this.notifApiUrl = (typeof API_URL_NOTIF !== 'undefined')
            ? API_URL_NOTIF
            : 'https://script.google.com/macros/s/AKfycbwreGMo-ZITm8PUkGJfMVu1cwKMsnUhfD1BZO18qFBa9CFcWd50VzBDKwDMKCubYhg5Cg/exec';

        console.log('🔔 NotificationManager Constructor iniciado (r1 API)');
        this.setupUI();
        this.init();
    }

    async init() {
        console.log('🔔 NotificationManager.init() ejecutándose...');

        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            console.warn('❌ Notificaciones Push no soportadas por este navegador');
            this.updateUIForState('unsupported');
            return;
        }

        try {
            this.swRegistration = await navigator.serviceWorker.getRegistration() || await navigator.serviceWorker.ready;

            if (this.swRegistration) {
                console.log('✅ Service Worker vinculado a Notificaciones');
                this.updateUIForState(Notification.permission);

                // Enviar la URL de r1 al SW para polling
                this.sendPollingConfigToSW();

                if ('periodicSync' in this.swRegistration) {
                    try {
                        const status = await navigator.permissions.query({
                            name: 'periodic-background-sync',
                        });
                        if (status.state === 'granted') {
                            await this.swRegistration.periodicSync.register('check-notif', {
                                minInterval: 60 * 60 * 1000,
                            });
                            console.log('✅ Periodic Sync registrado');
                        }
                    } catch (e) {
                        console.warn('Periodic Sync no disponible:', e.message);
                    }
                }

                if (Notification.permission === 'granted') {
                    this.subscribeToPush();
                }
            } else {
                console.warn('⚠️ No se encontró Service Worker registrado.');
            }
        } catch (e) {
            console.error('❌ Error en NotificationManager.init():', e);
        }
    }

    setupUI() {
        console.log('🔔 Configurando UI de notificaciones...');
        const notifToggle = document.getElementById('notifToggle');
        const summaryBtn = document.getElementById('sendSummaryBtn');

        if (notifToggle) {
            notifToggle.onchange = (e) => {
                if (notifToggle.checked) {
                    this.requestPermission(true);
                } else {
                    alert('Para desactivar totalmente las notificaciones, debes quitarlas desde la configuración del sitio en tu navegador.');
                }
            };
        }

        if (summaryBtn) {
            summaryBtn.onclick = (e) => {
                e.preventDefault();
                this.sendDailySummary();
            };
        }

        setTimeout(() => this.applyRolePermissions(), 1000);
    }

    applyRolePermissions() {
        const adminNotifSection = document.getElementById('adminNotifSection');
        if (adminNotifSection) adminNotifSection.style.display = 'none';

        let role = null;
        if (window.currentUser && window.currentUser.rol) {
            role = window.currentUser.rol.toUpperCase();
        } else {
            const stored = localStorage.getItem('user');
            if (stored) {
                try {
                    const parsed = JSON.parse(stored);
                    const rawRole = parsed.user ? parsed.user.rol : parsed.rol;
                    if (rawRole) role = rawRole.toUpperCase();
                } catch (e) { }
            }
        }

        console.log(`🔔 NotificationManager: Verificando acceso para rol [${role}]`);
    }

    // ============================================
    // Llamar al GAS de Notificaciones (VAPID/JWT)
    // ============================================
    async callNotifAPI(action, method = 'GET', data = null) {
        if (method === 'GET') {
            const res = await fetch(this.notifApiUrl + '?action=' + action, { mode: 'cors' });
            const text = await res.text();
            try { return JSON.parse(text); } catch { return text; }
        }

        const form = new URLSearchParams();
        form.append('action', action);
        if (data) {
            form.append('data', JSON.stringify(data));
            if (data.endpoint) form.append('endpoint', data.endpoint);
            if (data.keys) {
                if (data.keys.p256dh) form.append('p256dh', data.keys.p256dh);
                if (data.keys.auth) form.append('auth', data.keys.auth);
            }
            if (data.title) form.append('title', data.title);
            if (data.body) form.append('body', data.body);
            if (data.icon) form.append('icon', data.icon);
            if (data.url) form.append('url', data.url);
        }

        const res = await fetch(this.notifApiUrl, {
            method: 'POST', mode: 'cors', body: form,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        const text = await res.text();
        try { return JSON.parse(text); } catch { return text; }
    }

    // ============================================
    // Obtener la clave VAPID pública desde r1
    // ============================================
    async fetchVapidKey() {
        try {
            const res = await fetch(this.notifApiUrl + '?action=vapid-public-key', { mode: 'cors' });
            const text = (await res.text()).trim();

            if (text.startsWith('{')) {
                const obj = JSON.parse(text);
                throw new Error(obj.error || obj.message || 'Error VAPID');
            }
            if (text.length > 20) {
                this.vapidPublicKey = text;
                console.log('✅ Clave VAPID obtenida de r1');
                return true;
            }
            throw new Error('Clave VAPID inválida');
        } catch (err) {
            console.error('❌ Error obteniendo VAPID key:', err.message);
            return false;
        }
    }

    // ============================================
    // ENVIAR REPORTE DIARIO → usa r1 send-notification
    // ============================================
    async sendDailySummary(targetDateStr = null) {
        const btn = document.getElementById('sendSummaryBtn');
        const originalHtml = btn ? btn.innerHTML : 'Reporte';

        let confirmMsg = '¿Deseas generar y enviar el resumen de entregas?';
        if (targetDateStr) {
            confirmMsg = `¿Deseas generar y enviar el resumen de entregas para la fecha ${targetDateStr}?`;
        } else {
            confirmMsg += '\n(Se enviará el reporte del último día con datos registrados)';
        }

        if (!confirm(confirmMsg)) return;

        try {
            if (btn) {
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analizando...';
                btn.disabled = true;
            }

            const result = await window.obtenerDatosFacturados();
            if (!result || !result.success) throw new Error('No se pudieron obtener los datos');

            console.log(`🔍 Analizando ${result.data.length} documentos para el reporte...`);

            // Helper para parsear fechas de Google Sheets (DD/MM/YYYY HH:mm:ss o similar)
            const parseDate = (str) => {
                if (!str) return null;
                // Intentar DD/MM/YYYY HH:mm:ss
                const match = str.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
                if (match) {
                    const day = parseInt(match[1]);
                    const month = parseInt(match[2]) - 1; // 0-indexed
                    const year = parseInt(match[3]);
                    const hour = parseInt(match[4] || 0);
                    const min = parseInt(match[5] || 0);
                    const sec = parseInt(match[6] || 0);
                    return new Date(year, month, day, hour, min, sec);
                }
                // Fallback a Date nativo
                const d = new Date(str);
                return isNaN(d.getTime()) ? null : d;
            };

            const formatCurrency = (val) => new Intl.NumberFormat('es-CO', {
                style: 'currency', currency: 'COP', minimumFractionDigits: 0
            }).format(val);

            // 1. Recopilar todas las entregas
            const allDeliveries = [];
            result.data.forEach(item => {
                const itemsAProcesar = item.datosSiesa || (item.factura ? [item] : []);
                itemsAProcesar.forEach(f => {
                    const esEntregado = f.confirmacion && f.confirmacion.includes('ENTREGADO');
                    if (!esEntregado) return;

                    const rawDateStr = f.fechaEntrega || f.fecha || "";
                    const dateObj = parseDate(rawDateStr);
                    if (!dateObj) return;

                    allDeliveries.push({
                        ...f,
                        dateObj,
                        dateVal: (dateObj.getFullYear() * 10000) + ((dateObj.getMonth() + 1) * 100) + dateObj.getDate(),
                        dateStr: `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()}`
                    });
                });
            });

            if (allDeliveries.length === 0) {
                alert('No se encontraron registros de entregas en el sistema.');
                return;
            }

            // 2. Determinar fecha objetivo
            let finalDateStr = "";
            let finalDateVal = 0;
            let finalDateObj = null;

            if (targetDateStr) {
                // targetDateStr viene de <input type="date"> -> YYYY-MM-DD
                const parts = targetDateStr.split('-');
                finalDateVal = (parseInt(parts[0]) * 10000) + (parseInt(parts[1]) * 100) + parseInt(parts[2]);
                finalDateStr = `${parts[2]}/${parts[1]}/${parts[0]}`;
                finalDateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            } else {
                // Buscar la fecha más reciente
                allDeliveries.forEach(d => {
                    if (d.dateVal > finalDateVal) {
                        finalDateVal = d.dateVal;
                        finalDateStr = d.dateStr;
                        finalDateObj = d.dateObj;
                    }
                });
            }

            // 3. Filtrar entregas del día
            const dayDeliveries = allDeliveries.filter(d => d.dateVal === finalDateVal);

            if (dayDeliveries.length === 0) {
                alert(`No se encontraron entregas para la fecha ${finalDateStr}.`);
                return;
            }

            // 4. Consolidar inteligentemente
            // Agrupar por cliente
            const clientGroups = {};
            dayDeliveries.forEach(d => {
                const client = d.cliente || "CLIENTE DESCONOCIDO";
                if (!clientGroups[client]) clientGroups[client] = [];
                clientGroups[client].push(d);
            });

            let totalUnidades = 0;
            let totalValor = 0;
            const facturasUnicas = new Set();
            let bodyDetalle = "";

            // Para cada cliente, identificar "sesiones" de entrega
            Object.keys(clientGroups).sort().forEach(clientName => {
                const deliveries = clientGroups[clientName];
                // Ordenar por hora
                deliveries.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

                const sessions = [];
                let currentSession = null;

                deliveries.forEach(d => {
                    facturasUnicas.add(d.factura);
                    const cant = parseFloat(d.cantidad) || 0;
                    const val = parseFloat(d.valorBruto) || 0;
                    totalUnidades += cant;
                    totalValor += val;

                    if (!currentSession) {
                        currentSession = {
                            start: d.dateObj,
                            last: d.dateObj,
                            unidades: cant,
                            facturas: new Set([d.factura]),
                            valor: val
                        };
                        sessions.push(currentSession);
                    } else {
                        // Si ha pasado más de 1 hora (3600000 ms), es nueva sesión
                        const diff = d.dateObj.getTime() - currentSession.last.getTime();
                        if (diff > 3600 * 1000) {
                            currentSession = {
                                start: d.dateObj,
                                last: d.dateObj,
                                unidades: cant,
                                facturas: new Set([d.factura]),
                                valor: val
                            };
                            sessions.push(currentSession);
                        } else {
                            currentSession.last = d.dateObj;
                            currentSession.unidades += cant;
                            currentSession.facturas.add(d.factura);
                            currentSession.valor += val;
                        }
                    }
                });

                // Construir string para este cliente
                const clientHeader = `\n👤 *${clientName}*`;
                let sessionInfo = "";
                sessions.forEach((s, idx) => {
                    const timeStr = s.start.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
                    sessionInfo += `\n   - Entrega ${idx + 1} (${timeStr}): ${s.facturas.size} fac, ${s.unidades.toLocaleString('es-CO')} und, ${formatCurrency(s.valor)}`;
                });

                bodyDetalle += clientHeader + sessionInfo;
            });

            console.log(`✅ Reporte inteligente generado: ${finalDateStr}`);

            const titulo = `Proceso de Entregas`;
            const headerResumen = `*Consolidado del Día:*
            Facturas: ${facturasUnicas.size}
            Unidades: ${totalUnidades.toLocaleString('es-CO')}
            Total: ${formatCurrency(totalValor)}
            ----------------------------`;

            const cuerpoCompleto = headerResumen + bodyDetalle;

            // Simple body for the push notification
            const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
            const diaNombre = diasSemana[finalDateObj.getDay()];
            const cuerpoSimple = `Reporte Entregas del día ${diaNombre} ${finalDateStr}: Facturas: ${facturasUnicas.size} Unidades: ${totalUnidades.toLocaleString('es-CO')} Total: ${formatCurrency(totalValor)}`;

            // ⭐ Enviar al GAS de r1 con action=send-notification
            const resData = await this.callNotifAPI('send-notification', 'POST', {
                title: titulo,
                body: cuerpoSimple,
                icon: '',
                url: `./?showReport=${finalDateVal}`
            });

            if (resData && resData.success) {
                alert(`✅ Reporte enviado correctamente.\nFecha: ${finalDateStr}`);
                if (this.swRegistration && this.swRegistration.active) {
                    this.swRegistration.active.postMessage({ type: 'CHECK_NOW' });
                }
            } else {
                throw new Error(resData.message || resData.error || 'Error desconocido');
            }

        } catch (e) {
            console.error(e);
            alert('❌ Error al generar resumen: ' + e.message);
        } finally {
            if (btn) {
                btn.innerHTML = originalHtml;
                btn.disabled = false;
            }
        }
    }

    updateUIForState(state) {
        const notifToggle = document.getElementById('notifToggle');
        const notifDesc = document.getElementById('notifDesc');
        if (!notifToggle) return;

        console.log('🔔 Actualizando UI de notificaciones: ' + state);
        if (state === 'granted') {
            notifToggle.checked = true;
            if (notifDesc) notifDesc.innerText = 'Estado: Activo';
        } else if (state === 'denied') {
            notifToggle.checked = false;
            if (notifDesc) notifDesc.innerText = 'Estado: Bloqueado';
        } else {
            notifToggle.checked = false;
            if (notifDesc) notifDesc.innerText = 'Estado: Desactivado';
        }
    }

    async requestPermission(isManual = false) {
        try {
            console.log('🔔 Solicitando permisos de notificación...');
            const permission = await Notification.requestPermission();
            this.updateUIForState(permission);

            if (permission === 'granted' && isManual) {
                this.sendTestNotification('¡Notificaciones activadas correctamente!');
                await this.subscribeToPush();
            }
            return permission === 'granted';
        } catch (e) {
            console.error('Error solicitando permiso:', e);
        }
        return false;
    }

    // ============================================
    // Suscribir — usa r1 (VAPID key dinámica + subscribe)
    // ============================================
    async subscribeToPush() {
        if (!this.swRegistration) return;

        try {
            // Obtener la clave VAPID de r1 si no la tenemos
            if (!this.vapidPublicKey) {
                const ok = await this.fetchVapidKey();
                if (!ok) {
                    console.warn('⚠️ No se pudo obtener VAPID key, push no disponible');
                    return;
                }
            }

            const applicationServerKey = this.urlBase64ToUint8Array(this.vapidPublicKey);
            const subscription = await this.swRegistration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: applicationServerKey
            });

            this.isSubscribed = true;

            // ⭐ Guardar suscripción en r1 con action=subscribe
            const subJSON = subscription.toJSON();
            const result = await this.callNotifAPI('subscribe', 'POST', subJSON);

            if (result && result.success) {
                console.log('✅ Suscripción guardada en r1:', result.message);
            } else {
                console.warn('⚠️ Respuesta de r1 al suscribir:', result);
            }

        } catch (e) {
            console.warn('Push subscribe error:', e.message);
        }
    }

    // ============================================
    // Enviar configuración de polling al SW → apunta a r1
    // ============================================
    sendPollingConfigToSW() {
        const userId = window.currentUser ? window.currentUser.id : 'anonimo';

        if (this.swRegistration && this.swRegistration.active) {
            this.swRegistration.active.postMessage({
                type: 'SET_POLLING_CONFIG',
                url: this.notifApiUrl,       // ⭐ Ahora apunta a r1
                userId: userId,
                lastTs: this.lastNotificationTimestamp
            });
            console.log('🔔 Polling configurado → r1 API');
        }
    }

    sendTestNotification(msg = 'Prueba de notificación local') {
        if (Notification.permission === 'granted') {
            if (this.swRegistration) {
                this.swRegistration.showNotification(CONFIG.APP_NAME, {
                    body: msg,
                    icon: 'icons/icon-192.png',
                    badge: 'icons/icon-192.png',
                    vibrate: [100, 50, 100],
                    tag: 'test-notification'
                });
            } else {
                new Notification(CONFIG.APP_NAME, { body: msg });
            }
        } else {
            this.requestPermission(false);
        }
    }

    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
        return outputArray;
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.notificationManager = new NotificationManager();
    });
} else {
    window.notificationManager = new NotificationManager();
}