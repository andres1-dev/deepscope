// =========================================
// SOPORTES GRID - INFINITE SCROLL CORREGIDO
// Ahora carga todos los registros progresivamente
// =========================================

const SoportesGrid = {
  // Estado
  entregas: [],
  filteredEntregas: [],
  currentPage: 1,
  itemsPerPage: 10,
  isLoading: true,
  hasMore: true,
  isLoadingMore: false,

  // UI
  downloadBtn: null,

  // Elementos DOM
  container: null,
  loadingEl: null,
  emptyEl: null,
  sentinelEl: null,
  intersectionObserver: null,

  // Inicializar
  init: async function () {
    console.log('📱 Inicializando Soportes Grid...');
    this.container = document.getElementById('soportesGridContainer');
    this.loadingEl = document.getElementById('soportesGridLoading');
    this.emptyEl = document.getElementById('soportesGridEmpty');
    this.sentinelEl = document.getElementById('grid-sentinel');

    // Elementos del Modal
    this.modal = document.getElementById('soportesGridModal');
    this.openBtn = document.getElementById('openSoportesGridBtn');
    this.closeBtn = document.getElementById('closeSoportesGridBtn');
    this.refreshBtn = document.getElementById('refreshSoportesBtn');
    this.downloadBtn = document.getElementById('downloadSoportesBtn');

    // Filtros
    this.soportesDateFilter = document.getElementById('soportesDateFilter');
    this.resetFilterBtn = document.getElementById('resetFilterBtn');
    this.searchInput = document.getElementById('soportesGridSearch');

    // KPI
    this.kpiContainer = document.getElementById('soportesKpiContainer');
    this.kpiValoresPct = document.getElementById('kpiValoresPct');

    // Modal de Filtros
    this.filterModal = document.getElementById('soportesFilterModal');
    this.filterOverlay = document.getElementById('soportesFilterOverlay');
    this.openFiltersBtn = document.getElementById('openSoportesFiltersBtn');
    this.openKpiFiltersBtn = document.getElementById('openKpiFiltersBtn');
    this.closeFiltersBtn = document.getElementById('closeSoportesFiltersBtn');
    this.applyFiltersBtn = document.getElementById('applyFiltersBtn');

    this.bindEvents();

    // Carga inicial - Ahora se hace de inmediato para que esté listo al abrir
    this.cargarDatos();
    this.initInfiniteScroll();
  },

  bindEvents: function () {
    // Abrir/Cerrar
    if (this.openBtn) this.openBtn.addEventListener('click', () => this.open());
    if (this.closeBtn) this.closeBtn.addEventListener('click', () => this.close());

    // Refresh
    if (this.refreshBtn) {
      this.refreshBtn.addEventListener('click', () => {
        this.cargarDatos();
      });
    }

    // Download CSV
    if (this.downloadBtn) {
      this.downloadBtn.addEventListener('click', () => {
        this.downloadReport();
      });
    }

    // Filtro de Fechas con Flatpickr
    if (this.soportesDateFilter && typeof flatpickr !== 'undefined') {
      const hoy = new Date();
      // Empezar mostrando el mes actual
      const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

      this.flatpickrInstance = flatpickr(this.soportesDateFilter, {
        mode: "range",
        dateFormat: "d/m/Y",
        defaultDate: [primerDiaMes, hoy],
        locale: {
          rangeSeparator: ' a '
        },
        onChange: (selectedDates) => {
          if (selectedDates.length === 2 || selectedDates.length === 1) {
            const start = selectedDates[0];
            const end = selectedDates.length === 2 ? selectedDates[1] : selectedDates[0];
            this.triggerUnifiedFilters(start, end);
          }
        }
      });
    }

    // Eventos Modal de Filtros
    if (this.openFiltersBtn) this.openFiltersBtn.addEventListener('click', () => this.toggleFilterModal(true));
    if (this.openKpiFiltersBtn) this.openKpiFiltersBtn.addEventListener('click', () => this.toggleFilterModal(true));
    if (this.closeFiltersBtn) this.closeFiltersBtn.addEventListener('click', () => this.toggleFilterModal(false));
    if (this.filterOverlay) this.filterOverlay.addEventListener('click', () => this.toggleFilterModal(false));

    // Listeners para selects de filtros (Aplicación inmediata)
    const kpiFilterClient = document.getElementById('kpiFilterClient');
    const kpiFilterProvider = document.getElementById('kpiFilterProvider');

    if (kpiFilterClient) {
      kpiFilterClient.addEventListener('change', () => this.triggerUnifiedFilters());
    }
    if (kpiFilterProvider) {
      kpiFilterProvider.addEventListener('change', () => this.triggerUnifiedFilters());
    }

    if (this.resetFilterBtn) {
      this.resetFilterBtn.addEventListener('click', () => {
        const hoy = new Date();
        const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

        if (this.flatpickrInstance) {
          this.flatpickrInstance.setDate([primerDiaMes, hoy]);
        }

        // Resetear selects
        if (kpiFilterClient) kpiFilterClient.value = '';
        if (kpiFilterProvider) kpiFilterProvider.value = '';

        this.triggerUnifiedFilters(primerDiaMes, hoy);
        this.toggleFilterModal(false);
      });
    }

    // Toggle de KPIs Colapsables
    const toggleBtn = document.getElementById('toggleKpiBtn');
    const collapsibleArea = document.getElementById('kpiCollapsibleArea');
    const toggleIcon = document.getElementById('kpiToggleIcon');

    if (toggleBtn && collapsibleArea) {
      toggleBtn.addEventListener('click', () => {
        const isCollapsed = collapsibleArea.classList.toggle('collapsed');
        if (toggleIcon) toggleIcon.classList.toggle('collapsed', isCollapsed);
      });
    }

    // Toggle de Lista de Pendientes
    const togglePendingBtn = document.getElementById('togglePendingListBtn');
    const pendingCollapsible = document.getElementById('pendingListCollapsible');
    const pendingToggleIcon = document.getElementById('pendingListToggleIcon');

    if (togglePendingBtn && pendingCollapsible) {
      togglePendingBtn.addEventListener('click', () => {
        const isCollapsed = pendingCollapsible.classList.toggle('collapsed');
        if (pendingToggleIcon) pendingToggleIcon.classList.toggle('collapsed', isCollapsed);
      });
    }

    // Búsqueda
    if (this.searchInput) {
      this.searchInput.addEventListener('input', (e) => {
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
          this.aplicarFiltros({ busqueda: e.target.value });
        }, 300);
      });
    }

    // Tabs
    const tabs = document.querySelectorAll('.soportes-tab');
    const gridWrapper = document.getElementById('soportesGridWrapper');
    const kpiWrapper = document.getElementById('soportesKpiWrapper');
    const kpiContainer = document.getElementById('soportesKpiContainer');
    const statsBar = document.querySelector('.soportes-grid-stats');

    tabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        tabs.forEach(t => t.classList.remove('active'));
        const targetBtn = e.currentTarget;
        targetBtn.classList.add('active');

        const targetView = targetBtn.getAttribute('data-tab');
        if (targetView === 'grid') {
          if (gridWrapper) gridWrapper.style.display = 'flex';
          if (statsBar) statsBar.style.display = 'flex';
          if (kpiWrapper) kpiWrapper.style.display = 'none';
        } else if (targetView === 'kpis') {
          if (gridWrapper) gridWrapper.style.display = 'none';
          if (statsBar) statsBar.style.display = 'none';
          if (kpiWrapper) kpiWrapper.style.display = 'flex';
          if (kpiContainer) kpiContainer.style.display = ''; // Let CSS take over
        }
      });
    });
  },

  // Disparador único para aplicar filtros en Grid y KPIs simultáneamente
  triggerUnifiedFilters: function (fInicio, fFin) {
    let start = fInicio;
    let end = fFin;

    if (!start || !end) {
      if (this.flatpickrInstance && this.flatpickrInstance.selectedDates.length > 0) {
        start = this.flatpickrInstance.selectedDates[0];
        end = this.flatpickrInstance.selectedDates.length === 2 ? this.flatpickrInstance.selectedDates[1] : start;
      }
    }

    // Aplicar a la visualización del Grid (Fotos)
    this.aplicarFiltros({
      fechaInicio: start,
      fechaFin: end
    });

    // Aplicar a la visualización de KPIs (Tarjetas y Tabla)
    this.updateKPIs(start, end);
  },

  open: function () {
    if (this.modal) this.modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Disparar carga de datos de inmediato al entrar
    // Si ya hay datos, se cargan en segundo plano de forma async
    this.cargarDatos(true);
  },

  toggleFilterModal: function (show) {
    if (this.filterModal) this.filterModal.style.display = show ? 'block' : 'none';
    if (this.filterOverlay) this.filterOverlay.style.display = show ? 'block' : 'none';
  },

  close: function () {
    if (this.modal) {
      this.modal.style.display = 'none';
      document.body.style.overflow = '';
    }
  },

  // Cargar datos desde Google Sheets
  cargarDatos: async function (background = false) {
    if (this.isLoading && this.entregas.length > 0 && !background) return;

    // Si es una carga de fondo y ya está procesando una, omitir
    if (this.isLoading && background) return;

    // Solo mostramos el loader principal si no hay datos previos
    if (this.entregas.length === 0) {
      this.showLoading();
    }

    // Forzar limpieza de cache de KPIs para traer lo más reciente
    this.datosFacturadosCache = null;

    if (!background) {
      this.isLoading = true;
      this.updateStats();
    }

    try {
      if (typeof obtenerDatosSoportes !== 'function') {
        throw new Error('obtenerDatosSoportes no está disponible');
      }

      const soportesMap = await obtenerDatosSoportes();
      this.entregas = this.mapToGridItems(soportesMap);
      this.filteredEntregas = [...this.entregas];
      this.currentPage = 1;
      this.hasMore = this.filteredEntregas.length > this.itemsPerPage;

      console.log(`Total entregas: ${this.entregas.length}`);
      console.log(`Mostrando inicialmente: ${this.itemsPerPage}`);

      // Limpiar contenedor y renderizar primera página
      this.container.innerHTML = '';

      // Aplicar filtros iniciales (Mes actual o selección previa)
      this.triggerUnifiedFilters();


    } catch (error) {
      console.error('Error cargando soportes:', error);
      this.showError(error.message);
    }

    this.hideLoading();
  },

  datosFacturadosCache: null,

  // En soportes_grid.js, actualiza cargarDatosKPI

  cargarDatosKPI: async function () {
    // Si ya tenemos caché y no ha expirado (opcional, puedes ajustar el tiempo)
    if (this.datosFacturadosCache) {
      return this.datosFacturadosCache;
    }

    if (this.kpiContainer) this.kpiContainer.style.opacity = '0.5';
    try {
      if (typeof obtenerDatosFacturados === 'function') {
        const res = await obtenerDatosFacturados();
        if (res && res.success && res.data) {
          // Guardar en caché para próximas llamadas
          this.datosFacturadosCache = res.data;
          console.log(`Datos KPI cargados: ${res.data.length} documentos fuente`);
        }
      }
    } catch (e) {
      console.error('Error cargando datos para KPIs:', e);
    } finally {
      if (this.kpiContainer) this.kpiContainer.style.opacity = '1';
    }
    return this.datosFacturadosCache || [];
  },

  // En soportes_grid.js, reemplaza el método updateKPIs

  // En soportes_grid.js, reemplaza completamente el método updateKPIs

  updateKPIs: async function (fechaInicio, fechaFin) {
    if (!this.kpiContainer) return;

    let start = fechaInicio;
    let end = fechaFin;

    // Normalizar fechas
    if (start && start instanceof Date) {
      start = this.normalizarFecha(start);
    } else {
      const today = new Date();
      start = this.normalizarFecha(new Date(today.getFullYear(), today.getMonth(), 1));
    }

    if (end && end instanceof Date) {
      end = this.normalizarFecha(end);
    } else {
      end = this.normalizarFecha(new Date());
    }
    end.setHours(23, 59, 59, 999);

    const data = await this.cargarDatosKPI();

    // ===========================================
    // 1. Crear mapa de facturas únicas
    // ===========================================
    const facturasUnicasMap = new Map();

    if (data && data.length > 0) {
      data.forEach(doc => {
        if (doc.datosSiesa && Array.isArray(doc.datosSiesa)) {
          doc.datosSiesa.forEach(fact => {
            const facturaId = fact.factura;
            if (!facturaId || facturaId.trim() === '') return;

            const cant = parseFloat(fact.cantidad) || 0;
            const val = parseFloat(fact.valorBruto) || 0;

            if (!facturasUnicasMap.has(facturaId)) {
              facturasUnicasMap.set(facturaId, {
                factura: facturaId,
                fecha: fact.fecha,
                fechaEntrega: fact.fechaEntrega,
                cantidad: cant,
                valorBruto: val,
                confirmacion: fact.confirmacion || '',
                estado: fact.estado || '', // Status (Index 0)
                cliente: fact.cliente || '',
                proveedor: fact.proovedor || fact.proveedor || '',
                lote: fact.lote || '',
                referencia: fact.referencia || ''
              });
            } else {
              // Acumular cantidades y valores para facturas con múltiples ítems
              const existing = facturasUnicasMap.get(facturaId);
              existing.cantidad += cant;
              existing.valorBruto += val;
              // Mantener el lote/referencia más reciente o el primero
            }
          });
        }
      });
    }

    // ===========================================
    // 2. Filtrar por rango de fechas y calcular
    // ===========================================
    const facturasEnRango = [];
    const facturasPendientesArr = [];
    const clientesSet = new Set();
    const proveedoresSet = new Set();

    const filterClient = document.getElementById('kpiFilterClient')?.value || '';
    const filterProvider = document.getElementById('kpiFilterProvider')?.value || '';

    const facturasUnicas = Array.from(facturasUnicasMap.values());

    // Variables para cálculos
    let totalFacturas = 0;
    let totalUnidades = 0;
    let totalValor = 0;
    let entregadasFacturas = 0;
    let entregadasUnidades = 0;
    let entregadasValor = 0;
    let sumaDiasEntrega = 0;
    let facturasConFechaEntrega = 0;

    facturasUnicas.forEach(fact => {
      const fDate = this.parseFecha(fact.fecha);
      if (!fDate) return;

      const fd = this.normalizarFecha(fDate);

      // Guardar todos los clientes/proveedores en el rango para poblar los selects, sin importar si coinciden con el filtro actual
      if (fd >= start && fd <= end) {
        if (fact.cliente) clientesSet.add(fact.cliente);
        if (fact.proveedor) proveedoresSet.add(fact.proveedor);
      }

      // Validar fecha y filtros
      let valid = true;
      if (fd < start || fd > end) valid = false;
      if (filterClient && fact.cliente !== filterClient) valid = false;
      if (filterProvider && fact.proveedor !== filterProvider) valid = false;

      // Solo considerar facturas que pasan todos los filtros
      if (valid) {
        facturasEnRango.push(fact);

        totalFacturas++;

        const qty = fact.cantidad || 0;
        const val = fact.valorBruto || 0;

        totalUnidades += qty;
        totalValor += val;

        // Verificar si está entregada
        const confirmacion = fact.confirmacion || '';
        if (confirmacion === 'ENTREGADO' || confirmacion.includes('ENTREGADO')) {
          entregadasFacturas++;
          entregadasUnidades += qty;
          entregadasValor += val;

          // Calcular días para entrega (si tenemos fecha de entrega)
          if (fact.fechaEntrega) {
            const entregaDate = this.parseFecha(fact.fechaEntrega);
            if (entregaDate) {
              const diffTime = entregaDate - fDate;
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              if (diffDays >= 0) {
                sumaDiasEntrega += diffDays;
                facturasConFechaEntrega++;
              }
            }
          }
        } else {
          // Es pendiente
          facturasPendientesArr.push(fact);
        }
      }
    });

    // ===========================================
    // 3. Calcular métricas derivadas
    // ===========================================
    const pendientesFacturas = totalFacturas - entregadasFacturas;
    const pendientesUnidades = totalUnidades - entregadasUnidades;
    const pendientesValor = totalValor - entregadasValor;

    // Promedios
    const ticketPromedio = entregadasFacturas > 0 ? entregadasValor / entregadasFacturas : 0;
    const valorPorUnidad = entregadasUnidades > 0 ? entregadasValor / entregadasUnidades : 0;

    // Días en el rango para cálculo de facturas por día
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
    const facturasPorDia = totalFacturas / diffDays;

    // Porcentajes
    const pctEntregadoFacturas = totalFacturas > 0 ? (entregadasFacturas / totalFacturas) * 100 : 0;
    const pctPendienteFacturas = totalFacturas > 0 ? (pendientesFacturas / totalFacturas) * 100 : 0;

    // Rotación (porcentaje de unidades/valor entregado)
    const rotacionUnidades = totalUnidades > 0 ? (entregadasUnidades / totalUnidades) * 100 : 0;
    const rotacionValor = totalValor > 0 ? (entregadasValor / totalValor) * 100 : 0;

    // Días promedio de entrega
    const diasPromedio = facturasConFechaEntrega > 0
      ? Math.round(sumaDiasEntrega / facturasConFechaEntrega)
      : 0;

    // ===========================================
    // 4. Formatear y mostrar
    // ===========================================
    const formatPesos = (n) => {
      if (n === 0) return '$0';
      return '$' + Math.round(n).toLocaleString('es-CO');
    };

    // Debug
    console.log('📊 KPIs Detallados:', {
      entregado: {
        facturas: entregadasFacturas,
        unidades: entregadasUnidades,
        valor: formatPesos(entregadasValor),
        pct: pctEntregadoFacturas.toFixed(1) + '%'
      },
      pendiente: {
        facturas: pendientesFacturas,
        unidades: pendientesUnidades,
        valor: formatPesos(pendientesValor),
        pct: pctPendienteFacturas.toFixed(1) + '%'
      },
      promedios: {
        ticket: formatPesos(ticketPromedio),
        valorPorUnidad: formatPesos(valorPorUnidad),
        facturasPorDia: facturasPorDia.toFixed(1)
      },
      eficiencia: {
        cumplimiento: pctEntregadoFacturas.toFixed(1) + '%',
        rotacionUnidades: rotacionUnidades.toFixed(1) + '%',
        rotacionValor: rotacionValor.toFixed(1) + '%',
        diasPromedio
      }
    });

    // ===========================================
    // 5. Actualizar UI
    // ===========================================

    // ===========================================
    // 5. Actualizar UI (3 Tarjetas)
    // ===========================================

    // Tarjeta 1: ENTREGADO
    if (document.getElementById('kpiEntregadoFacturas')) {
      document.getElementById('kpiEntregadoFacturas').textContent = entregadasFacturas;
      document.getElementById('kpiEntregadoUnidades').textContent = entregadasUnidades.toLocaleString('es-CO');
      document.getElementById('kpiEntregadoValor').textContent = formatPesos(entregadasValor);
      document.getElementById('kpiEntregadoPct').textContent = pctEntregadoFacturas.toFixed(1) + '%';
      document.getElementById('kpiEntregadoBar').style.width = pctEntregadoFacturas + '%';

      // Totales para denominators
      document.getElementById('kpiTotalFacturasCard1').textContent = totalFacturas;
      document.getElementById('kpiTotalUnidadesCard1').textContent = totalUnidades.toLocaleString('es-CO');
    }

    // Tarjeta 2: PENDIENTE
    if (document.getElementById('kpiPendienteFacturas')) {
      document.getElementById('kpiPendienteFacturas').textContent = pendientesFacturas;
      document.getElementById('kpiPendienteUnidades').textContent = pendientesUnidades.toLocaleString('es-CO');
      document.getElementById('kpiPendienteValor').textContent = formatPesos(pendientesValor);
      document.getElementById('kpiPendientePct').textContent = pctPendienteFacturas.toFixed(1) + '%';
      document.getElementById('kpiPendienteBar').style.width = pctPendienteFacturas + '%';

      // Totales para denominators
      document.getElementById('kpiTotalFacturasCard2').textContent = totalFacturas;
      document.getElementById('kpiTotalUnidadesCard2').textContent = totalUnidades.toLocaleString('es-CO');

      const badge = document.getElementById('kpiGeneralBadge');
      if (badge) {
        if (pctEntregadoFacturas >= 90) {
          badge.textContent = 'Óptimo';
          badge.style.background = '#ecfdf5';
          badge.style.color = '#065f46';
        } else if (pctEntregadoFacturas >= 60) {
          badge.textContent = 'Aceptable';
          badge.style.background = '#fffbeb';
          badge.style.color = '#92400e';
        } else {
          badge.textContent = 'Alerta';
          badge.style.background = '#fef2f2';
          badge.style.color = '#991b1b';
        }
      }
    }

    // ===========================================
    // 6. Actualizar Filtros y Tabla de Pendientes
    // ===========================================
    this.facturasPendientesGlobal = facturasPendientesArr;

    // Poblar Filtros (si no se han poblado manualmente)
    const clientSelect = document.getElementById('kpiFilterClient');
    if (clientSelect) {
      const currentClient = clientSelect.value;
      clientSelect.innerHTML = '<option value="">Todos los Clientes</option>';
      [...clientesSet].sort().forEach(cliente => {
        clientSelect.innerHTML += `<option value="${cliente}">${cliente}</option>`;
      });
      clientSelect.value = currentClient || '';
    }

    const providerSelect = document.getElementById('kpiFilterProvider');
    if (providerSelect) {
      const currentProvider = providerSelect.value;
      providerSelect.innerHTML = '<option value="">Todos los Proveedores</option>';
      [...proveedoresSet].sort().forEach(prov => {
        providerSelect.innerHTML += `<option value="${prov}">${prov}</option>`;
      });
      providerSelect.value = currentProvider || '';
    }

    this.renderPendingTable();
  },

  renderPendingTable: function () {
    if (!this.facturasPendientesGlobal) return;

    const tableBody = document.querySelector('#kpiPendingTable tbody');
    if (!tableBody) return;

    // Inicializar lógica de renderizado y búsqueda/filtrado
    if (!this._kpiTableInitialized) {
      this._kpiTableInitialized = true;

      const searchInput = document.getElementById('kpiSearchInput');
      if (searchInput) {
        searchInput.addEventListener('input', () => this.renderPendingTable());
      }
    }

    const searchStr = (document.getElementById('kpiSearchInput')?.value || '').toLowerCase();
    const filterClientStr = document.getElementById('kpiFilterClient')?.value || '';
    const filterProviderStr = document.getElementById('kpiFilterProvider')?.value || '';

    // Filtrar localmente según inputs
    const filtrados = this.facturasPendientesGlobal.filter(f => {
      if (filterClientStr && f.cliente !== filterClientStr) return false;
      if (filterProviderStr && f.proveedor !== filterProviderStr) return false;

      if (searchStr) {
        const fullString = `${f.factura} ${f.referencia} ${f.lote} ${f.estado}`.toLowerCase();
        if (!fullString.includes(searchStr)) return false;
      }
      return true;
    });

    tableBody.innerHTML = '';

    const countBadge = document.getElementById('kpiPendingCount');
    if (countBadge) countBadge.textContent = `${filtrados.length} registros`;

    if (filtrados.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #64748b; padding: 40px;">No hay facturas pendientes que coincidan con los filtros</td></tr>`;
      return;
    }

    // Sort desc by number or date, but put un-matched invoices FIRST
    filtrados.sort((a, b) => {
      // Check if it's an orphaned invoice (no matched document or invalid lote)
      // Since `principal.js` added it to huerfanasSiesa, it may have `fuente === 'SIESA (Sin origen/Lote inválido)'`
      // Or we can check if `lote` has non-numeric characters, or is empty.
      // But the object built in `soportes_grid.js` `updateKPIs` maps the original API data (where it might say "SIN_DOC" for documento).
      // Wait, in `soportes_grid.js` line ~350, it only uses what's inside `doc.datosSiesa`.
      // Let's check `fuente` or `documento`. In `principal.js`, `huerfanasSiesa` sets `documento: 'SIN_DOC'`.

      const aIsOrphan = !a.lote || isNaN(Number(a.lote)) || (a.documento === 'SIN_DOC');
      const bIsOrphan = !b.lote || isNaN(Number(b.lote)) || (b.documento === 'SIN_DOC');

      if (aIsOrphan && !bIsOrphan) return -1;
      if (!aIsOrphan && bIsOrphan) return 1;

      return b.factura.localeCompare(a.factura);
    });

    filtrados.forEach(f => {
      const row = document.createElement('tr');
      // Highlight un-matched invoices with a reddish background
      const isOrphan = !f.lote || isNaN(Number(f.lote)) || (f.documento === 'SIN_DOC');
      if (isOrphan) {
        row.style.backgroundColor = '#fef2f2'; // light red background
        row.style.color = '#991b1b'; // darker red text
      }

      row.innerHTML = `
        <td ${isOrphan ? 'style="font-weight:bold;"' : ''}>
          ${f.factura}
        </td>
        <td>${f.cantidad}</td>
        <td title="${f.referencia}">${f.referencia || '-'}</td>
        <td ${isOrphan ? 'style="color:#ef4444; font-weight:bold;"' : ''}>${f.lote || '-'}</td>
        <td>
          <button class="btn-table-action" title="Editar información" onclick="SoportesGrid.openEditPendingModal('${f.factura}')">
            <i class="fas fa-edit"></i>
          </button>
        </td>
      `;
      tableBody.appendChild(row);
    });
  },

  openEditPendingModal: function (facturaId) {
    const factura = this.facturasPendientesGlobal.find(f => f.factura === facturaId);
    if (!factura) return;

    this.editingFactura = factura;

    document.getElementById('editKpiFactura').value = factura.factura;
    document.getElementById('editKpiReferencia').value = factura.referencia;
    document.getElementById('editKpiLote').value = factura.lote;
    document.getElementById('editKpiEstado').value = (factura.estado || 'En elaboración');

    // Mostrar modal
    const modal = document.getElementById('editPendingModal');
    const overlay = document.getElementById('editPendingOverlay');
    if (modal) modal.style.display = 'block';
    if (overlay) overlay.style.display = 'block';
  },

  savePendingEdit: async function () {
    const btn = document.getElementById('saveEditKpiBtn');
    const originalText = btn.innerHTML;

    const newLote = document.getElementById('editKpiLote').value;
    const nuevoEstado = document.getElementById('editKpiEstado').value;
    const facturaId = this.editingFactura.factura;

    try {
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

      // GAS URL provided by user
      const GAS_URL = 'https://script.google.com/macros/s/AKfycbzGV3mBHCxItn-ovx6yZoKr_6FwgMGP3LtQc_v_mEMSB4wWII9URr2yppKf1wEQg38Vmw/exec';

      const formData = new URLSearchParams();
      formData.append('factura', facturaId);
      formData.append('lote', newLote);
      formData.append('estado', nuevoEstado);
      formData.append('action', 'updatePending');

      const response = await fetch(GAS_URL, {
        method: 'POST',
        mode: 'no-cors', // Siguiendo el patrón común para GAS si hay problemas de CORS, aunque limita la lectura de respuesta
        body: formData
      });

      // Como usamos no-cors, no podemos leer el JSON de éxito fácilmente 
      // pero el usuario solicita la funcionalidad.

      alert('Solicitud enviada correctamente. Los cambios pueden tardar unos segundos en reflejarse.');

      // Actualizar localmente para feedback inmediato
      if (this.editingFactura) {
        this.editingFactura.lote = newLote;
        this.editingFactura.estado = nuevoEstado; // Actualizamos el estado real

        // Actualizar también en el caché global si existe
        if (this.datosFacturadosCache) {
          this.datosFacturadosCache.forEach(doc => {
            if (doc.datosSiesa) {
              doc.datosSiesa.forEach(s => {
                if (s.factura === facturaId) {
                  s.lote = newLote;
                  s.estado = nuevoEstado;
                }
              });
            }
          });
        }
      }

      this.closeEditModal();
      this.renderPendingTable();

    } catch (e) {
      console.error('Error al guardar edit:', e);
      alert('Error: ' + e.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  },

  closeEditModal: function () {
    const modal = document.getElementById('editPendingModal');
    const overlay = document.getElementById('editPendingOverlay');
    if (modal) modal.style.display = 'none';
    if (overlay) overlay.style.display = 'none';
  },

  // Convertir mapa de soportes a items del grid
  mapToGridItems: function (soportesMap) {
    const items = [];

    if (!soportesMap || typeof soportesMap !== 'object') {
      console.warn('Mapa de soportes vacío');
      return items;
    }

    console.log('Procesando soportes:', Object.keys(soportesMap).length);

    Object.keys(soportesMap).forEach(key => {
      // Saltar entradas BY_FACTURA_ y vacías
      if (key.startsWith('BY_FACTURA_') || !key || key === 'undefined') return;

      const soporte = soportesMap[key];
      if (!soporte) return;

      // Extraer datos usando la nueva estructura por FACTURA
      // El 'key' ahora es la factura
      const factura = key;
      const documento = soporte.documento || '';
      const lote = soporte.lote || '';
      const referencia = soporte.referencia || '';
      const cantidad = soporte.cantidad || '';
      const nit = soporte.nit || '';

      // Procesar fecha
      let fechaObj = null;
      let fechaFormateada = '';
      let fechaRelativa = '';

      if (soporte.fechaEntrega) {
        fechaObj = this.parseFecha(soporte.fechaEntrega);
        if (fechaObj) {
          fechaFormateada = this.formatearFecha(fechaObj);
          fechaRelativa = this.getTiempoRelativo(fechaObj);
        }
      }

      // Si no hay fecha válida, usar fecha actual
      if (!fechaObj) {
        fechaObj = new Date();
        fechaFormateada = this.formatearFecha(fechaObj);
        fechaRelativa = 'Reciente';
      }

      // Determinar color basado en el cliente
      const colorScheme = this.getColorForClient(nit || '');

      // Buscar nombre del cliente
      let nombreCliente = nit || 'SIN CLIENTE';
      if (typeof CLIENTS_MAP !== 'undefined') {
        for (const [nombre, nitCliente] of Object.entries(CLIENTS_MAP)) {
          if (nitCliente === nit) {
            nombreCliente = nombre;
            break;
          }
        }
      }

      items.push({
        id: `${factura}_${Date.now()}_${Math.random()}`,
        documento: documento || '---',
        factura: factura || soporte.factura || 'SIN FACTURA',
        lote: lote || '---',
        referencia: referencia || '---',
        cantidad: cantidad || '---',
        nit: nit,
        cliente: nombreCliente,
        ih3: soporte.imageId || '',
        fecha: fechaFormateada,
        fechaObj: fechaObj,
        fechaRelativa: fechaRelativa,
        timestamp: fechaObj ? fechaObj.getTime() : Date.now(),
        color: colorScheme.color,
        bgColor: colorScheme.bgColor,
        tieneImagen: !!soporte.imageId
      });
    });

    // Ordenar por fecha (más reciente primero)
    const ordenados = items.sort((a, b) => b.timestamp - a.timestamp);
    console.log(`${ordenados.length} entregas procesadas y ordenadas`);
    return ordenados;
  },

  // PARSEAR FECHA
  parseFecha: function (fechaStr) {
    if (!fechaStr) return null;

    try {
      if (fechaStr instanceof Date) return fechaStr;

      if (typeof fechaStr === 'string') {
        const partes = fechaStr.split(' ');
        const fechaPartes = partes[0].split('/');

        if (fechaPartes.length === 3) {
          const dia = parseInt(fechaPartes[0], 10);
          const mes = parseInt(fechaPartes[1], 10) - 1;
          const anio = parseInt(fechaPartes[2], 10);

          let hora = 0, minuto = 0, segundo = 0;

          if (partes.length > 1) {
            const tiempoPartes = partes[1].split(':');
            hora = parseInt(tiempoPartes[0] || 0, 10);
            minuto = parseInt(tiempoPartes[1] || 0, 10);
            segundo = parseInt(tiempoPartes[2] || 0, 10);
          }

          return new Date(anio, mes, dia, hora, minuto, segundo);
        }
      }

      const timestamp = Date.parse(fechaStr);
      if (!isNaN(timestamp)) return new Date(timestamp);

    } catch (e) {
      console.warn('Error parseando fecha:', fechaStr, e);
    }

    return null;
  },

  // Obtener color por cliente
  getColorForClient: function (nit) {
    const colors = [
      { color: '#2563eb', bgColor: '#dbeafe' },
      { color: '#7c3aed', bgColor: '#ede9fe' },
      { color: '#db2777', bgColor: '#fce7f3' },
      { color: '#059669', bgColor: '#d1fae5' },
      { color: '#d97706', bgColor: '#fef3c7' },
      { color: '#dc2626', bgColor: '#fee2e2' },
      { color: '#6b7280', bgColor: '#f3f4f6' }
    ];

    const index = Math.abs(this.hashCode(nit || '')) % colors.length;
    return colors[index];
  },

  hashCode: function (str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  },

  // Formatear fecha
  formatearFecha: function (date) {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) return '---';
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  },

  // Tiempo relativo
  getTiempoRelativo: function (date) {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) return 'Fecha desconocida';

    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours} h`;
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays} días`;
    if (diffDays < 30) return `Hace ${diffDays} días`;
    return date.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  },

  // =========================================
  // RENDERIZAR - CORREGIDO PARA INFINITE SCROLL
  // =========================================
  render: function () {
    if (!this.container) return;

    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = this.currentPage * this.itemsPerPage;
    const itemsToShow = this.filteredEntregas.slice(start, end);

    console.log(`Página ${this.currentPage}: mostrando items ${start}-${end} de ${this.filteredEntregas.length}`);
    console.log(`Items en esta página: ${itemsToShow.length}`);

    if (itemsToShow.length === 0) {
      console.log('No hay items para mostrar en esta página');
      return;
    }

    // Crear fragment para mejor rendimiento
    const fragment = document.createDocumentFragment();

    itemsToShow.forEach(item => {
      fragment.appendChild(this.createGridItem(item));
    });

    // APPEND (no reemplazar) - esto es clave para infinite scroll
    this.container.appendChild(fragment);

    // Animación de entrada escalonada para nuevos items
    const newItems = Array.from(this.container.children).slice(-itemsToShow.length);
    newItems.forEach((item, index) => {
      item.style.opacity = '0';
      item.style.transform = 'translateY(15px)';
      item.style.transition = 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)';

      requestAnimationFrame(() => {
        setTimeout(() => {
          item.style.opacity = '1';
          item.style.transform = 'translateY(0)';
        }, index * 40); // 40ms delay entre cada uno
      });
    });

    // Actualizar estado de "hasMore"
    this.hasMore = end < this.filteredEntregas.length;

    console.log(`   Has more: ${this.hasMore} (${end} < ${this.filteredEntregas.length})`);

    // Mostrar/ocultar sentinel
    if (this.sentinelEl) {
      this.sentinelEl.style.display = this.hasMore ? 'flex' : 'none';
    }

    // Actualizar contador
    this.updateStats();
  },

  // Crear item del grid
  createGridItem: function (item) {
    const div = document.createElement('div');
    div.className = 'grid-item';
    div.setAttribute('data-id', item.id);
    div.setAttribute('data-factura', item.factura);

    // Determinar si es ancho
    const shouldBeWide = item.tieneImagen || parseInt(item.cantidad) > 30;
    if (shouldBeWide) {
      div.classList.add('wide');
    }

    // Template del item con mejoras premium: fade-in, lazy loading y placeholders elegantes
    div.innerHTML = `
      ${item.tieneImagen ? `
        <div class="grid-item-image" onclick="SoportesGrid.previewImage('${item.ih3}', '${item.factura}')" style="background: #f1f5f9;">
          <img src="https://lh3.googleusercontent.com/d/${item.ih3}=s600-c" 
               alt="Soporte" 
               loading="lazy" 
               style="opacity: 0; transition: opacity 0.4s ease-in-out;" 
               onload="this.style.opacity='1'; this.parentElement.style.background='white';">
          <div class="image-overlay">
            <span>${item.factura}</span>
          </div>
          <div class="image-badge">
            <i class="fas fa-camera"></i>
          </div>
        </div>
      ` : `
        <div class="grid-item-noimage" style="background: ${item.bgColor};">
          <div class="noimage-content">
            <i class="fas fa-file-invoice" style="color: ${item.color}; transform: scale(1.1);"></i>
            <span class="noimage-factura" style="box-shadow: 0 4px 10px rgba(0,0,0,0.05);">${item.factura}</span>
          </div>
        </div>
      `}
      
      <div class="grid-item-content">
        <div class="grid-item-header">
          <div class="cliente-badge" style="background: ${item.bgColor}; color: ${item.color}; font-weight: 800; letter-spacing: -0.2px;" title="${item.cliente}">
            <i class="fas fa-building" style="font-size: 0.8em; margin-right: 4px;"></i>
            <span class="cliente-nombre">${item.cliente}</span>
          </div>
          <div class="item-time" style="background: rgba(0,0,0,0.03); border: 1px solid rgba(0,0,0,0.02);">
            <i class="far fa-clock"></i>
            ${item.fechaRelativa}
          </div>
        </div>
        
        <div class="grid-item-details">
          <div class="detail-chip">
            <i class="fas fa-cube"></i>
            <span>${item.lote}</span>
          </div>
          <div class="detail-chip">
            <i class="fas fa-hashtag"></i>
            <span>${item.referencia}</span>
          </div>
          <div class="detail-chip highlight">
            <i class="fas fa-box"></i>
            <span>${item.cantidad}</span>
          </div>
        </div>
        
        <div class="grid-item-footer">
          <div class="documento-badge">
            <i class="fas fa-file-alt"></i>
            ${item.documento}
          </div>
          <div class="item-actions">
            <button class="grid-action-btn" onclick="SoportesGrid.showDetails('${item.id}')" title="Ver detalles">
              <i class="fas fa-info-circle"></i>
            </button>
          </div>
        </div>
      </div>
    `;

    return div;
  },

  // =========================================
  // INFINITE SCROLL - CORREGIDO
  // =========================================
  initInfiniteScroll: function () {
    if (!this.sentinelEl) {
      console.warn('Sentinel no encontrado');
      return;
    }

    // Limpiar observer anterior si existe
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }

    console.log('Configurando Intersection Observer');

    this.intersectionObserver = new IntersectionObserver((entries) => {
      const entry = entries[0];

      console.log('Sentinel visible:', entry.isIntersecting);
      console.log('Has more:', this.hasMore);
      console.log('Is loading:', this.isLoadingMore);

      if (entry.isIntersecting && this.hasMore && !this.isLoadingMore) {
        console.log('✅ Cargando más items...');
        this.loadMore();
      }
    }, {
      root: document.getElementById('gridScrollArea'),
      threshold: 0.1,
      rootMargin: '200px' // Cargar antes de llegar al final
    });

    this.intersectionObserver.observe(this.sentinelEl);
    console.log('Observer configurado y observando sentinel');
  },

  // =========================================
  // CARGAR MÁS ITEMS - CORREGIDO
  // =========================================
  loadMore: function () {
    if (this.isLoadingMore || !this.hasMore) {
      console.log('No se puede cargar más:', {
        isLoadingMore: this.isLoadingMore,
        hasMore: this.hasMore
      });
      return;
    }

    console.log('Iniciando carga de más items...');
    this.isLoadingMore = true;

    // Mostrar indicador en el sentinel
    if (this.sentinelEl) {
      this.sentinelEl.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Cargando más entregas...';
    }

    // Simular carga async (puedes ajustar el delay o removerlo)
    setTimeout(() => {
      this.currentPage++;
      console.log(`Nueva página: ${this.currentPage}`);

      this.render();
      this.isLoadingMore = false;

      console.log(`Carga completada. Página ${this.currentPage}`);

      // Restaurar sentinel si aún hay más
      if (this.sentinelEl && this.hasMore) {
        this.sentinelEl.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Cargando más...';
      }
    }, 300);
  },

  // =========================================
  // FILTROS - CORREGIDO
  // =========================================
  aplicarFiltros: function (filtros = {}) {
    console.log('Aplicando filtros:', filtros);

    let resultados = [...this.entregas];

    // Obtener valores de los selects de la interfaz si no se pasan en 'filtros'
    const filterClient = filtros.cliente !== undefined ? filtros.cliente : (document.getElementById('kpiFilterClient')?.value || '');
    const filterProvider = filtros.proveedor !== undefined ? filtros.proveedor : (document.getElementById('kpiFilterProvider')?.value || '');

    // Filtro por fecha
    if (filtros.fechaInicio && filtros.fechaFin) {
      const inicio = this.normalizarFecha(filtros.fechaInicio);
      const fin = this.normalizarFecha(filtros.fechaFin);
      fin.setHours(23, 59, 59, 999);

      resultados = resultados.filter(item => {
        if (!item.fechaObj) return false;
        return item.fechaObj >= inicio && item.fechaObj <= fin;
      });
    }

    // Filtro por Cliente
    if (filterClient && filterClient !== '') {
      resultados = resultados.filter(item => item.cliente === filterClient);
    }

    // Filtro por Proveedor
    if (filterProvider && filterProvider !== '') {
      resultados = resultados.filter(item => {
        // En los soportes fotográficos, el proveedor a veces no está mapeado directamente.
        // Si el item tiene proveedor, filtrar. Si no, podemos intentar ignorar o buscarlo.
        return item.proveedor === filterProvider || !item.proveedor;
      });
    }

    // Filtro por búsqueda
    if (filtros.busqueda && filtros.busqueda.trim() !== '') {
      const busqueda = filtros.busqueda.toLowerCase().trim();
      resultados = resultados.filter(item =>
        item.factura.toLowerCase().includes(busqueda) ||
        item.documento.toLowerCase().includes(busqueda) ||
        item.lote.toLowerCase().includes(busqueda) ||
        item.referencia.toLowerCase().includes(busqueda) ||
        item.cliente.toLowerCase().includes(busqueda)
      );
    }

    this.filteredEntregas = resultados;
    this.currentPage = 1;
    this.hasMore = this.filteredEntregas.length > this.itemsPerPage;

    // Limpiar contenedor y renderizar desde cero
    this.container.innerHTML = '';
    this.render();

    // Mostrar/ocultar empty state
    if (this.filteredEntregas.length === 0) {
      this.showEmpty();
    } else {
      this.hideEmpty();
    }

    // Actualizar sentinel
    if (this.sentinelEl) {
      this.sentinelEl.style.display = this.hasMore ? 'flex' : 'none';
    }

    this.updateStats();
  },

  // Normalizar fecha para comparación
  normalizarFecha: function (fecha) {
    if (fecha instanceof Date) {
      return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
    }
    if (typeof fecha === 'string') {
      const date = this.parseFecha(fecha);
      if (date) {
        return new Date(date.getFullYear(), date.getMonth(), date.getDate());
      }
    }
    return new Date();
  },

  // Reset filtros
  resetFiltros: function () {
    console.log('Reseteando filtros');
    this.filteredEntregas = [...this.entregas];
    this.currentPage = 1;
    this.hasMore = this.filteredEntregas.length > this.itemsPerPage;
    this.container.innerHTML = '';
    this.render();
    this.hideEmpty();

    if (this.sentinelEl) {
      this.sentinelEl.style.display = this.hasMore ? 'flex' : 'none';
    }

    this.updateStats();
  },

  // Actualizar estadísticas
  updateStats: function () {
    const totalMostrados = Math.min(
      this.currentPage * this.itemsPerPage,
      this.filteredEntregas.length
    );

    const countEl = document.getElementById('soportesGridCount');
    if (countEl) {
      countEl.textContent = `${totalMostrados} de ${this.filteredEntregas.length} entregas`;
    }

    const badge = document.getElementById('soportesGridBadge');
    if (badge) {
      if (this.isLoading) {
        badge.innerHTML = `<i class="fas fa-sync-alt fa-spin"></i> Actualizando...`;
        badge.style.opacity = "0.7";
      } else {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
        badge.innerHTML = `<i class="fas fa-check-circle"></i> ${timeStr}`;
        badge.style.opacity = "1";
      }
    }
  },

  // Vista previa de imagen
  previewImage: function (imageId, factura) {
    if (!imageId) return;

    const url = `https://lh3.googleusercontent.com/d/${imageId}`;
    const modal = document.getElementById('soportesImageModal');
    const modalImg = document.getElementById('soportesModalImage');

    if (modal && modalImg) {
      modalImg.src = url;
      modal.style.display = 'flex';
    } else {
      window.open(url, '_blank');
    }
  },

  // Mostrar detalles
  showDetails: function (itemId) {
    const item = this.filteredEntregas.find(i => i.id === itemId);
    if (!item) return;

    alert(`
      FACTURA: ${item.factura}
      DOCUMENTO: ${item.documento}
      LOTE: ${item.lote}
      REFERENCIA: ${item.referencia}
      CANTIDAD: ${item.cantidad}
      CLIENTE: ${item.cliente}
      FECHA: ${item.fecha}
    `);
  },

  // UI Helpers
  showLoading: function () {
    this.isLoading = true;
    if (this.loadingEl) this.loadingEl.style.display = 'flex';
    if (this.sentinelEl) this.sentinelEl.style.display = 'none';
  },

  hideLoading: function () {
    this.isLoading = false;
    if (this.loadingEl) this.loadingEl.style.display = 'none';
    if (this.sentinelEl && this.hasMore) this.sentinelEl.style.display = 'flex';
  },

  showEmpty: function () {
    if (this.emptyEl) this.emptyEl.style.display = 'flex';
    if (this.sentinelEl) this.sentinelEl.style.display = 'none';
  },

  hideEmpty: function () {
    if (this.emptyEl) this.emptyEl.style.display = 'none';
  },

  showError: function (message) {
    if (this.container) {
      this.container.innerHTML = `
        <div class="grid-error">
          <i class="fas fa-exclamation-triangle"></i>
          <h4>Error al cargar</h4>
          <p>${message}</p>
          <button onclick="SoportesGrid.cargarDatos()" class="btn-retry">
            <i class="fas fa-redo"></i> Reintentar
          </button>
        </div>
      `;
    }
  },

  // Exportar a Excel (Legacy)
  exportarExcel: function () {
    if (typeof XLSX === 'undefined') {
      alert('Excel export no disponible');
      return;
    }

    try {
      const data = this.filteredEntregas.map(item => ({
        'Fecha': item.fecha,
        'Factura': item.factura,
        'Documento': item.documento,
        'Lote': item.lote,
        'Referencia': item.referencia,
        'Cantidad': item.cantidad,
        'Cliente': item.cliente,
        'NIT': item.nit,
        'Soporte': item.ih3 ? `https://lh3.googleusercontent.com/d/${item.ih3}` : ''
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'Entregas');
      XLSX.writeFile(wb, `entregas_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e) {
      console.error('Error exportando Excel:', e);
      alert('Error al exportar');
    }
  },

  // Descargar Reporte Completo (CSV con ;)
  // En soportes_grid.js, reemplaza el método downloadReport

  downloadReport: async function () {
    if (typeof obtenerDatosFacturados !== 'function') {
      alert('Función obtenerDatosFacturados no disponible');
      return;
    }

    if (!confirm('¿Desea descargar el reporte completo de todas las facturas (entregadas y pendientes)?\nEsto puede tomar unos momentos.')) {
      return;
    }

    this.showLoading();

    try {
      console.log('Iniciando descarga de reporte completo...');

      // 1. Obtener datos completos
      const resultado = await obtenerDatosFacturados();

      if (!resultado || !resultado.success) {
        throw new Error(resultado.error || 'Error al obtener datos');
      }

      const datos = resultado.data; // Array de Documentos
      console.log('Datos obtenidos para reporte:', datos.length, 'documentos');

      // ===========================================
      // 2. NUEVO: Aplanar y DEDUPLICAR por factura
      // ===========================================
      const facturasMap = new Map(); // Usar Map para garantizar unicidad por factura

      datos.forEach(doc => {
        if (doc.datosSiesa && Array.isArray(doc.datosSiesa)) {
          doc.datosSiesa.forEach(factura => {
            const facturaId = factura.factura;

            // Solo procesar si tiene factura (evitar "SIN FACTURA")
            if (!facturaId || facturaId.trim() === '') return;

            // Si la factura ya existe, NO la sobrescribimos
            // La primera aparición es la que cuenta
            if (!facturasMap.has(facturaId)) {
              facturasMap.set(facturaId, {
                factura: facturaId,
                estado: factura.estado || '',
                fecha: factura.fecha || '',
                cliente: (factura.cliente || '').replace(/;/g, ','),
                nit: factura.nit || '',
                lote: factura.lote || '',
                referencia: factura.referencia || '',
                cantidad: factura.cantidad || 0,
                valorBruto: factura.valorBruto || 0,
                confirmacion: factura.confirmacion || 'PENDIENTE',
                fechaEntrega: factura.fechaEntrega || '',
                ih3: factura.Ih3 || '',
                // Tomar el documento del primer origen donde apareció
                documentoOrigen: doc.documento || '',
                proveedor: (factura.proovedor || '').replace(/;/g, ',')
              });
            } else {
              // Opcional: Log para depuración
              console.log(`Factura duplicada omitida: ${facturaId} (ya existe en el mapa)`);
            }
          });
        }
      });

      // Convertir el Map a array para generar el CSV
      const facturasUnicas = Array.from(facturasMap.values());

      console.log(`Facturas únicas encontradas: ${facturasUnicas.length}`);
      console.log(`Facturas duplicadas omitidas: ${facturasMap.size} vs ${this.contarFacturasOriginal(datos)}`);

      if (facturasUnicas.length === 0) {
        alert('No se encontraron facturas para exportar.');
        return;
      }

      // 3. Encabezados requeridos (igual que antes)
      const encabezados = [
        'FACTURA',
        'ESTADO',
        'FECHA',
        'CLIENTE',
        'NIT',
        'LOTE',
        'REFERENCIA',
        'CANTIDAD',
        'VALOR',
        'CONFIRMACION',
        'FECHA_ENTREGA',
        'IH3',
        'DOCUMENTO_ORIGEN',
        'PROVEEDOR'
      ];

      // 4. Generar CSV con BOM
      let csvContent = '\uFEFF' + encabezados.join(';') + '\n';

      facturasUnicas.forEach(factura => {
        const row = [
          factura.factura,
          factura.estado,
          factura.fecha,
          factura.cliente,
          factura.nit,
          factura.lote,
          factura.referencia,
          factura.cantidad,
          factura.valorBruto,
          factura.confirmacion,
          factura.fechaEntrega,
          factura.ih3,
          factura.documentoOrigen,
          factura.proveedor
        ];
        csvContent += row.join(';') + '\n';
      });

      // 5. Descargar archivo
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `reporte_facturas_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log('Reporte descargado:', facturasUnicas.length, 'facturas únicas');

    } catch (error) {
      console.error('Error generando reporte:', error);
      alert('Error al generar el reporte: ' + error.message);
    } finally {
      this.hideLoading();
    }
  },

  // Función helper para depuración (opcional)
  contarFacturasOriginal: function (datos) {
    let count = 0;
    datos.forEach(doc => {
      if (doc.datosSiesa) count += doc.datosSiesa.length;
    });
    return count;
  }

};

// =========================================
// INICIALIZACIÓN CON RETRY
// =========================================
function initSoportesGrid() {
  if (typeof obtenerDatosSoportes === 'function') {
    SoportesGrid.init();
    window.SoportesGrid = SoportesGrid;
    console.log('SoportesGrid inicializado correctamente');
    return true;
  }
  console.log('Esperando obtenerDatosSoportes...');
  return false;
}

// Intentar inicializar cada 500ms hasta 10 segundos
let attempts = 0;
const maxAttempts = 20;
const initInterval = setInterval(() => {
  attempts++;
  console.log(`🔄 Intento ${attempts}/${maxAttempts} de inicialización`);

  if (initSoportesGrid() || attempts >= maxAttempts) {
    clearInterval(initInterval);
    if (attempts >= maxAttempts) {
      console.error('❌ No se pudo inicializar SoportesGrid - timeout');
    }
  }
}, 500);