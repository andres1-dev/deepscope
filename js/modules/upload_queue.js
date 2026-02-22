// Clase para gestionar la cola de carga - VERSION MEJORADA
class UploadQueue {
  constructor() {
    this.queue = this.loadQueue();
    this.isProcessing = false;
    this.completedCount = 0;
    this.initEventListeners();
    this.updateQueueUI();
    this.processQueue(); // Intentar procesar cola al iniciar

    // Inicializar eventos para la nueva UI
    const queueCounter = document.getElementById('queueCounter');
    if (queueCounter) queueCounter.addEventListener('click', this.toggleQueueModal.bind(this));

    // Nuevo contador en la barra de estado
    const statusCounter = document.getElementById('upload-status-counter');
    if (statusCounter) {
      statusCounter.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleQueueModal();
      });
    }



    const closeQueueModal = document.getElementById('closeQueueModal');
    if (closeQueueModal) closeQueueModal.addEventListener('click', this.hideQueueModal.bind(this));

    const processQueueBtn = document.getElementById('processQueueBtn');
    if (processQueueBtn) processQueueBtn.addEventListener('click', () => this.processQueue());

    const retryFailedBtn = document.getElementById('retryFailedBtn');
    if (retryFailedBtn) retryFailedBtn.addEventListener('click', () => this.retryFailedJobs());

    // Cerrar modal al hacer clic fuera
    document.addEventListener('click', (e) => {
      const modal = document.getElementById('queueModal');
      const counter = document.getElementById('queueCounter');
      const statusCounter = document.getElementById('upload-status-counter');

      if (modal && modal.style.display === 'block' &&
        e.target !== modal &&
        !modal.contains(e.target) &&
        counter && e.target !== counter &&
        !counter.contains(e.target) &&
        statusCounter && e.target !== statusCounter &&
        !statusCounter.contains(e.target)) {
        this.hideQueueModal();
      }

    });

    // Delegación segura para el botón móvil (funciona aunque se renderice tarde)
    document.addEventListener('click', (e) => {
      const mobileBtn = e.target.closest('#mobileQueueBtn');
      if (mobileBtn) {
        e.preventDefault(); // Prevenir cualquier comportamiento default
        e.stopPropagation(); // Prevenir propagación
        this.toggleQueueModal();
      }
    });
  }

  loadQueue() {
    try {
      const saved = localStorage.getItem(UPLOAD_QUEUE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Error al cargar la cola:", e);
      return [];
    }
  }

  saveQueue() {
    localStorage.setItem(UPLOAD_QUEUE_KEY, JSON.stringify(this.queue));
  }

  addJob(job) {
    // Check local database for existing confirmation
    const factura = job.factura;
    if (job.type === 'photo' && factura) {
      // Remover trabajos previos de la misma factura
      this.queue = this.queue.filter(q => q.factura !== factura);
    }

    this.queue.push({
      ...job,
      id: Date.now() + Math.random().toString(36).substr(2, 9),
      retries: 0,
      timestamp: new Date().toISOString(),
      status: 'pending',
      addedAt: new Date().toLocaleTimeString()
    });
    this.saveQueue();
    this.updateQueueUI();
    this.processQueue();

    // Notificación eliminada por petición del usuario para no saturar UI
    // this.showNotification('Elemento agregado a la cola', 'info');
  }

  initEventListeners() {
    window.addEventListener('online', () => {
      if (this.queue.length > 0) {
        this.processQueue();
        // this.showNotification('Conexión restablecida, procesando cola...', 'success');
      }
    });

    window.addEventListener('offline', () => {
      // this.showNotification('Sin conexión, los elementos se guardarán en cola', 'warning');
    });
  }

  updateQueueUI() {
    const counter = document.getElementById('queueCounter');
    const statusCounter = document.getElementById('upload-status-counter');
    const statusCountText = document.getElementById('upload-count');

    const badge = counter ? counter.querySelector('.queue-counter-badge') : null;
    const icon = counter ? counter.querySelector('i') : null;
    const statusBadge = document.querySelector('.queue-status-text');
    const pendingStat = document.querySelector('.stat-item:nth-child(1) .stat-value');
    const processingStat = document.querySelector('.stat-item:nth-child(2) .stat-value');
    const completedStat = document.querySelector('.stat-item:nth-child(3) .stat-value');

    const pendingJobs = this.queue.filter(job => job.status === 'pending').length;
    const processingJobs = this.queue.filter(job => job.status === 'processing').length;
    const totalActive = pendingJobs + processingJobs;

    // Actualizar Nuevo Contador en Barra de Estado (Prioritario para paridad con PC)
    if (statusCounter && statusCountText) {
      if (totalActive > 0) {
        statusCounter.style.display = 'flex';
        statusCountText.textContent = totalActive;
        if (this.isProcessing) {
          statusCounter.classList.add('processing');
        } else {
          statusCounter.classList.remove('processing');
        }
      } else {
        statusCounter.style.display = 'none';
      }
    }

    // Actualizar también el botón del menú móvil para consistencia
    const mobileBtn = document.getElementById('mobileQueueBtn');
    if (mobileBtn) {
      const mobileBadge = mobileBtn.querySelector('.mobile-queue-badge');
      if (mobileBadge) {
        mobileBadge.textContent = totalActive;
        mobileBadge.style.display = totalActive > 0 ? 'flex' : 'none';

        // Cambiar color/icono si está procesando
        const mobileIcon = mobileBtn.querySelector('i');
        if (mobileIcon) {
          if (this.isProcessing) {
            mobileIcon.className = 'fas fa-sync-alt fa-spin';
            mobileIcon.style.color = 'var(--primary)';
          } else {
            mobileIcon.className = 'fas fa-cloud-upload-alt';
            mobileIcon.style.color = '';
          }
        }
      }
    }

    // Actualizar contador flotante antiguo (si aún existe y es visible)
    if (counter && badge && statusBadge) {
      badge.textContent = totalActive;

      if (this.queue.length === 0) {
        counter.classList.add('empty');
        counter.classList.remove('processing');
        if (icon) icon.style.color = '';
        statusBadge.textContent = 'Sin actividad';
      } else {
        counter.classList.remove('empty');
        if (this.isProcessing) {
          counter.classList.add('processing');
          if (icon) icon.style.color = 'var(--primary)';
          statusBadge.textContent = 'Procesando';
        } else {
          counter.classList.remove('processing');
          if (icon) icon.style.color = '';
          statusBadge.textContent = `${pendingJobs} pendientes`;
        }
      }
    }

    // Actualizar estadísticas solo si existen
    if (pendingStat) pendingStat.textContent = pendingJobs;
    if (processingStat) processingStat.textContent = processingJobs;
    if (completedStat) completedStat.textContent = this.completedCount;

    // Actualizar lista de items
    this.updateQueueItemsList();
  }

  updateQueueItemsList() {
    const queueItemsList = document.getElementById('queueItemsList');
    if (!queueItemsList) return;

    if (this.queue.length === 0) {
      queueItemsList.innerHTML = `
      <div class="queue-empty-state">
        <i class="fas fa-check-circle"></i>
        <p>Cola de carga despejada</p>
      </div>
    `;
      return;
    }

    queueItemsList.innerHTML = '';

    this.queue.forEach((item, index) => {
      const itemElement = document.createElement('div');

      let statusClass = '';
      let statusIcon = '';
      let statusText = '';

      if (item.status === 'processing') {
        statusClass = 'processing';
        statusIcon = '<div class="queue-spinner"></div>';
        statusText = 'Procesando...';
      } else if (item.retries >= MAX_RETRIES) {
        statusClass = 'error';
        statusIcon = '<i class="fas fa-exclamation-triangle"></i>';
        statusText = 'Error crítico';
      } else if (item.status === 'retrying') {
        statusClass = 'retrying';
        statusIcon = '<i class="fas fa-redo-alt"></i>';
        statusText = `Reintentando (${item.retries}/${MAX_RETRIES})`;
      } else {
        statusClass = 'pending';
        statusIcon = '<i class="fas fa-clock"></i>';
        statusText = 'En espera';
      }

      itemElement.className = `queue-item-card ${statusClass}`;

      let previewHtml = '';
      if (item.type === 'photo' && item.data.fotoBase64) {
        previewHtml = `<div class="queue-item-thumb">
          <img src="data:image/jpeg;base64,${item.data.fotoBase64}" alt="Thumb">
        </div>`;
      } else {
        previewHtml = `<div class="queue-item-thumb empty">
          <i class="fas fa-${item.type === 'photo' ? 'camera' : 'file-alt'}"></i>
        </div>`;
      }

      const titleText = item.factura || (item.data && item.data.documento) || 'Elemento sin ID';
      const detailText = item.type === 'photo' ? 'Soporte fotográfico' : 'Documento de datos';

      itemElement.innerHTML = `
        <div class="queue-item-main">
          ${previewHtml}
          <div class="queue-item-content">
            <div class="queue-item-title-row">
              <span class="queue-item-title">${titleText}</span>
              <span class="queue-item-badge">${statusText}</span>
            </div>
            <div class="queue-item-info">
              <span class="queue-item-type">${detailText}</span>
              <span class="queue-item-dot">•</span>
              <span class="queue-item-time">${item.addedAt}</span>
            </div>
          </div>
          <div class="queue-item-status-icon">${statusIcon}</div>
        </div>
      `;

      queueItemsList.appendChild(itemElement);
    });
  }

  toggleQueueModal() {
    console.log('toggleQueueModal called');
    const modal = document.getElementById('queueModal');
    if (!modal) {
      console.error('queueModal not found');
      return;
    }

    const isVisible = modal.style.display === 'block' || getComputedStyle(modal).display === 'block';
    console.log('Modal visibility:', isVisible);

    if (isVisible) {
      this.hideQueueModal();
    } else {
      this.showQueueModal();
    }
  }

  showQueueModal() {
    const modal = document.getElementById('queueModal');
    const overlay = document.getElementById('queueModalOverlay');

    if (modal) modal.style.display = 'block';
    if (overlay) overlay.style.display = 'block';

    // Actualizar UI antes de mostrar
    this.updateQueueUI();
  }

  hideQueueModal() {
    const modal = document.getElementById('queueModal');
    const overlay = document.getElementById('queueModalOverlay');

    if (modal) modal.style.display = 'none';
    if (overlay) overlay.style.display = 'none';
  }

  showNotification(message, type = 'info') {
    // Crear notificación toast
    const toast = document.createElement('div');
    toast.className = `queue-toast ${type}`;
    toast.innerHTML = `
      <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
      <span>${message}</span>
    `;

    document.body.appendChild(toast);

    // Mostrar
    setTimeout(() => toast.classList.add('show'), 10);

    // Ocultar después de 3 segundos
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        if (toast.parentNode) {
          document.body.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }

  async processQueue() {
    if (this.isProcessing || this.queue.length === 0 || !navigator.onLine) {
      return;
    }

    this.isProcessing = true;
    this.updateQueueUI();

    while (this.queue.length > 0 && navigator.onLine) {
      const job = this.queue[0];

      // Marcar como procesando
      job.status = 'processing';
      this.updateQueueUI();

      try {
        if (job.type === 'photo') {
          await this.processPhotoJob(job);
        } else if (job.type === 'data') {
          await this.processDataJob(job);
        }

        // Éxito - eliminar trabajo completado
        this.queue.shift();
        this.completedCount++;
        this.saveQueue();

        // Notificación de éxito individual silenciada
        // this.showNotification(`Carga completada: ${job.factura || 'Elemento'}`, 'success');
      } catch (error) {
        console.error("Error al procesar trabajo:", error);

        // Manejar error
        job.retries++;
        job.lastError = error.message;
        job.lastAttempt = new Date().toISOString();
        job.status = 'pending'; // Volver a pendiente para reintento

        if (job.retries >= MAX_RETRIES) {
          // Máximo de reintentos alcanzado - eliminar
          this.queue.shift();
          this.showNotification(`Error máximo en: ${job.factura || 'Elemento'}`, 'error');
        } else {
          // Mover al final de la cola para reintentar más tarde
          this.queue.push(this.queue.shift());
          job.status = 'retrying';
          this.showNotification(`Reintentando: ${job.factura || 'Elemento'} (${job.retries}/${MAX_RETRIES})`, 'warning');
        }

        this.saveQueue();
        break; // Pausar procesamiento temporalmente
      }

      this.updateQueueUI();

      // Pequeña pausa entre trabajos
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    this.isProcessing = false;
    this.updateQueueUI();

    if (this.queue.length === 0) {
      // this.showNotification('Todas las cargas completadas', 'success');
    }
  }

  retryFailedJobs() {
    let retried = 0;
    this.queue.forEach(job => {
      if (job.retries > 0 && job.retries < MAX_RETRIES) {
        job.retries = 0;
        job.status = 'pending';
        retried++;
      }
    });

    if (retried > 0) {
      this.saveQueue();
      this.updateQueueUI();
      this.showNotification(`${retried} trabajos reiniciados para reintento`, 'info');
      this.processQueue();
    }
  }

  async processPhotoJob(job) {
    console.log(`[UploadQueue] Procesando trabajo: ${job.factura} de tipo ${job.type}`);
    console.log(`[UploadQueue] API URL: ${API_URL_POST}`);

    const formData = new FormData();
    Object.keys(job.data).forEach(key => {
      // No enviar la propiedad esSinFactura al servidor
      if (key !== 'esSinFactura') {
        formData.append(key, job.data[key]);
      }
    });

    // Log keys being sent
    // for(let pair of formData.entries()) { console.log(pair[0]); } 

    // Añadir token de sesión
    const token = sessionStorage.getItem('token') || '';
    formData.append('token', token);

    const response = await fetch(API_URL_POST, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || "Error en la respuesta del servidor");
    }

    // Actualizar UI si el elemento todavía está visible
    if (job.btnElementId) {
      // Buscar el elemento por data-factura (puede ser button o div ahora)
      const element = document.querySelector(`[data-factura="${job.btnElementId}"]`);

      // Solo actualizar si el elemento existe y no es una entrega sin factura
      if (element && !job.esSinFactura) {
        // Comprobar rol de admin para mostrar botón de eliminar
        const isAdmin = (typeof currentUser !== 'undefined' && currentUser && currentUser.rol === 'ADMIN');
        const displayStyle = isAdmin ? 'flex' : 'none';

        // HTML para el contenedor de acciones (Delete + Check)
        const newContent = `
              <button class="action-btn-mini btn-delete contextual" style="display: ${displayStyle}; background: transparent; box-shadow: none;" onclick="event.stopPropagation(); eliminarEntrega('${job.btnElementId}')" title="Eliminar entrega">
                  <i class="fas fa-trash-alt"></i>
              </button>
              <div class="status-icon-only success"><i class="fas fa-check-circle"></i></div>
          `;

        if (element.tagName === 'BUTTON') {
          // Crear contenedor si era un botón
          const statusContainer = document.createElement('div');
          statusContainer.className = 'status-actions';
          statusContainer.setAttribute('data-factura', job.btnElementId);
          statusContainer.innerHTML = newContent;

          if (element.parentNode) {
            element.parentNode.replaceChild(statusContainer, element);
          }
        } else {
          // Si ya es un div/icono, reemplazamos su contenido o el elemento entero
          // Mejor reemplazar el elemento entero para asegurar la estructura correcta
          const statusContainer = document.createElement('div');
          statusContainer.className = 'status-actions';
          statusContainer.setAttribute('data-factura', job.btnElementId);
          statusContainer.innerHTML = newContent;

          if (element.parentNode) {
            // Si el elemento es parte de un status-actions ya existente, reemplazamos el contenedor padre
            if (element.classList.contains('status-actions')) {
              element.innerHTML = newContent;
            } else if (element.parentNode.classList.contains('status-actions')) {
              element.parentNode.innerHTML = newContent;
            } else {
              element.parentNode.replaceChild(statusContainer, element);
            }
          }
        }

        // ACTUALIZACIÓN VISUAL TARJETA: Cambiar a VERDE (Entregado)
        const card = document.querySelector(`[data-factura="${job.btnElementId}"]`).closest('.siesa-item');
        if (card) {
          card.classList.remove('status-processing', 'status-pendiente', 'status-nofacturado');
          card.classList.add('status-entregado');
          // Forzar estilo verde por si acaso CSS falla
          card.style.background = '#f0fdf4';
          card.style.borderColor = '#bbf7d0';
        }
      }
    }

    // Actualizar base de datos local para persistencia inmediata (sin recarga)
    this.updateLocalDatabase(job.factura);

    // Iniciar recarga silenciosa de datos desde Sheets
    if (typeof silentReloadData === 'function') {
      silentReloadData();
    }
  }

  async processDataJob(job) {
    // Implementación para trabajos de datos
    throw new Error("Trabajos de datos no implementados");
  }

  // Método para actualizar la BD local en memoria y caché
  updateLocalDatabase(factura) {
    if (typeof database !== 'undefined' && Array.isArray(database)) {
      let updated = false;
      for (const doc of database) {
        if (doc.datosSiesa && Array.isArray(doc.datosSiesa)) {
          const item = doc.datosSiesa.find(s => s.factura === factura);
          if (item) {
            item.confirmacion = "ENTREGADO"; // Marcamos como entregado
            updated = true;
            break;
          }
        }
      }

      // Si hubo cambios, invalidar/actualizar caché
      if (updated && typeof cacheData === 'function') {
        console.log("Base de datos local actualizada para factura:", factura);
        cacheData(database);
      }
    }
  }
}

// Inicialización de la cola de carga (GLOBAL)
// Inicialización de la cola de carga (GLOBAL)
document.addEventListener('DOMContentLoaded', () => {
  window.uploadQueue = new UploadQueue();
  console.log("UploadQueue initialized globally");

  // Helper global para botones onclick
  window.toggleQueue = function () {
    if (window.uploadQueue) window.uploadQueue.toggleQueueModal();
  };
});