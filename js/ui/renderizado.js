// Lógica de Renderizado y Formato de Vistas

function displayFullResult(item, qrParts) {
    const resultsDiv = document.getElementById('results');
    if (!resultsDiv) return;

    const totalRegistros = item.datosSiesa ? item.datosSiesa.length : 0;

    // Renderizar
    let html = `<div class="result-item">`;

    // 1. Cabecera Principal (Datos del Documento)
    html += `
    <div class="result-header-main">
      <div class="document-title">
        <i class="fas fa-file-invoice animated-result-icon"></i> Documento REC
      </div>
      <div class="document-id">${item.documento || qrParts.documento}</div>
      <div class="main-details-grid">
  `;

    // Campos Clave Principales
    const mainFields = ['lote', 'referencia'];
    mainFields.forEach(key => {
        if (item[key]) {
            html += `
         <div class="detail-box">
           <div class="detail-box-label">${key}</div>
           <div class="detail-box-value">${item[key]}</div>
         </div>
       `;
        }
    });

    html += `</div></div>`; // Cierre grid y header

    // 2. Lista de Facturas
    if (item.datosSiesa && Array.isArray(item.datosSiesa)) {
        const count = item.datosSiesa.length;
        html += `
       <div class="siesa-list-header">
         Facturas Relacionadas <span class="badge-count">${count}</span>
       </div>
    `;

        item.datosSiesa.forEach((siesa, index) => {
            const tieneFactura = siesa.factura && siesa.factura.trim() !== "";
            const referencia = siesa.referencia || item.referencia || 'Sin referencia';
            const cantidad = siesa.cantidad || 0;

            // Verificar si hay imagen IH3 (Soporta Google Drive, Blob o Data URL)
            const tieneIh3 = siesa.Ih3 && siesa.Ih3.trim() !== '';

            // Estado Lógica
            let estadoConf = "PENDIENTE";
            let statusClass = "status-pendiente";
            let isProcessing = false;

            // Verificar si está en cola de subida
            // uploadQueue debe estar disponible globalmente
            const inQueue = (typeof uploadQueue !== 'undefined') ? uploadQueue.queue.find(q => q.factura === siesa.factura) : null;
            if (inQueue) {
                isProcessing = true;
                estadoConf = "PROCESANDO";
                statusClass = "status-processing";
            } else if (siesa.confirmacion && siesa.confirmacion.trim() === "ENTREGADO") {
                estadoConf = "ENTREGADO";
                statusClass = "status-entregado";
            } else if (!tieneFactura) {
                estadoConf = "NO FACTURADO";
                statusClass = "status-nofacturado";
            } else if (siesa.confirmacion && siesa.confirmacion.includes("PENDIENTE FACTURA")) {
                estadoConf = "PENDIENTE FACTURA";
                statusClass = "status-pendiente";
            }

            // Nombre Proveedor Clean
            let proveedor = siesa.proovedor || "Desconocido";
            if (proveedor.length > 20) proveedor = proveedor.substring(0, 20) + "...";

            html += `
        <div class="siesa-item collapsed ${statusClass}" id="siesa-item-${index}">
           <!-- Solapa de Estado (Barra superior) -->
           <div class="status-solapa"></div>

           <!-- Header Clickable -->
           <div class="card-header">
              <div class="factura-main-click" onclick="toggleSiesaItem(${index})" style="flex:1;">
                  <div class="factura-info">
                     <div class="factura-id">${tieneFactura ? siesa.factura : 'SIN FACTURA'}</div>
                     <div class="factura-meta-line">
                        <span class="meta-item"><i class="fas fa-box"></i> ${cantidad}</span>
                        <span class="meta-separator">•</span>
                        <span class="meta-item"><i class="fas fa-tags"></i><span class="reference-highlight">${referencia}</span></span>
                        ${tieneIh3 ? `<span class="meta-separator">•</span><span class="meta-item"><i class="fas fa-image"></i> Soporte</span>` : ''}
                     </div>
                  </div>
              </div>
              
              <div class="card-header-actions">
                 ${isProcessing ?
                    `<div class="status-icon-only processing contextual" data-factura="${siesa.factura}"><div class="premium-spinner"></div></div>` :
                    estadoConf === "ENTREGADO" ?
                        `<div class="status-actions" data-factura="${siesa.factura}">
                            <button class="action-btn-mini btn-delete contextual" style="display: ${(typeof currentUser !== 'undefined' && currentUser && currentUser.rol === 'ADMIN') ? 'flex' : 'none'}; background: transparent; box-shadow: none;" onclick="event.stopPropagation(); eliminarEntrega('${siesa.factura}')" title="Eliminar entrega">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                            <div class="status-icon-only success"><i class="fas fa-check-circle"></i></div>
                        </div>` :
                        estadoConf === "NO FACTURADO" ?
                            `<div class="status-icon-only error"><i class="fas fa-exclamation-triangle"></i></div>` :
                            estadoConf === "PENDIENTE" ?
                                `<button class="action-btn-mini btn-scan" 
                        data-factura="${siesa.factura}" 
                        onclick="event.stopPropagation(); procesarEntrega('${item.documento}', '${siesa.lote || item.lote}', '${siesa.referencia}', '${siesa.cantidad}', '${siesa.factura}', '${siesa.nit || qrParts.nit}', this)">
                        <i class="fas fa-camera"></i>
                     </button>` : ''
                }
                 
                 <i class="fas fa-chevron-down card-chevron" onclick="toggleSiesaItem(${index})"></i>
              </div>
           </div>

           <!-- Content Grid -->
           <div class="collapsible-content">
              <div class="details-grid adaptive">
      `;

            // Renderizar TODOS los campos disponibles del objeto siesa
            const priorityKeys = ['proovedor', 'cliente', 'nit', 'lote', 'referencia', 'cantidad', 'fecha', 'valorBruto'];
            const hiddenKeys = ['factura', 'confirmacion', 'Ih3', 'estado'];

            priorityKeys.forEach(key => {
                if (siesa[key]) {
                    const esTextoLargo = key === 'cliente' || key === 'proovedor';
                    const valor = formatSiesaValue(siesa[key]);

                    html += `
            <div class="mini-detail ${esTextoLargo ? 'full-width' : ''}">
               <div class="mini-label">${key}</div>
               <div class="mini-value">${valor}</div>
            </div>
          `;
                }
            });

            // Campos adicionales
            for (const key in siesa) {
                if (!priorityKeys.includes(key) && !hiddenKeys.includes(key) && siesa[key]) {
                    const esTextoLargo = key.toLowerCase().includes('nombre') ||
                        key.toLowerCase().includes('descripcion') ||
                        siesa[key].length > 30;

                    html += `
            <div class="mini-detail ${esTextoLargo ? 'full-width' : ''}">
               <div class="mini-label">${formatKey(key)}</div>
               <div class="mini-value">${formatSiesaValue(siesa[key])}</div>
            </div>
          `;
                }
            }

            if (tieneIh3) {
                let thumbnailUrl;
                // Si es URL de Google Drive
                if (siesa.Ih3.includes('googleusercontent.com/d/')) {
                    const imageId = siesa.Ih3.split('/').pop();
                    thumbnailUrl = `https://lh3.googleusercontent.com/d/${imageId}=s200`;
                }
                // Si es Blob o Data URL (Local) o URL directa
                else {
                    thumbnailUrl = siesa.Ih3;
                }

                html += `
          <div class="ih3-thumbnail-container">
            <img src="${thumbnailUrl}" 
                 class="ih3-thumbnail" 
                 alt="Comprobante de entrega"
                 onclick="mostrarImagenCompleta('${siesa.Ih3}')">
          </div>
        `;
            }

            html += `
              </div>
              <div style="height: 10px;"></div>
           </div>
        </div>`;
        });
    }

    html += `</div>`;
    resultsDiv.innerHTML = html;
}

function formatKey(key) {
    return key
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase())
        .replace(/_/g, ' ')
        .replace('columna', '')
        .trim();
}

function formatValue(value, key = '') {
    if (value === null || value === undefined) {
        return '<span class="no-data">N/A</span>';
    }

    if (typeof value === 'object') {
        return '<span class="no-data">[Datos complejos]</span>';
    }

    if (typeof value === 'number') {
        if (key.toLowerCase().includes('valor') || key.toLowerCase().includes('suma')) {
            return `<span class="numeric-value">${value.toLocaleString('es-CO')}</span>`;
        }
        return value.toString();
    }

    if (typeof value === 'boolean') {
        return value ? 'Sí' : 'No';
    }

    return value.toString();
}

function formatSiesaValue(val) {
    if (typeof val === 'number') return val.toLocaleString('es-CO');
    return val;
}

function showError(barcode, message = "Código no encontrado") {
    const resultsDiv = document.getElementById('results');
    if (resultsDiv) {
        resultsDiv.innerHTML = `
        <div class="error">
        <i class="fas fa-times-circle"></i> ${message}: <strong>${barcode}</strong>
        </div>
    `;
    }
}
