// =========================================
// INICIALIZACIÓN CORREGIDA - SOPORTES GRID
// =========================================
document.addEventListener('DOMContentLoaded', function () {
    console.log('🚀 Inicializando eventos del Grid');

    // Elementos DOM
    const openBtn = document.getElementById('openSoportesGridBtn');
    const closeBtn = document.getElementById('closeSoportesGridBtn');
    const modal = document.getElementById('soportesGridModal');
    const overlay = document.getElementById('soportesGridOverlay');
    const searchInput = document.getElementById('soportesGridSearch');
    const filterToday = document.getElementById('filterTodayBtn');
    const filterWeek = document.getElementById('filterWeekBtn');
    const resetFilter = document.getElementById('resetFilterBtn');

    // =========================================
    // ABRIR MODAL
    // =========================================
    if (openBtn) {
        openBtn.onclick = function (e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Abriendo modal de entregas');

            modal.style.display = 'flex';
            overlay.style.display = 'block';

            // Resetear búsqueda
            if (searchInput) searchInput.value = '';

            // Resetear filtros activos
            if (filterToday) filterToday.classList.remove('active');
            if (filterWeek) filterWeek.classList.remove('active');

            // Cargar datos si no se han cargado
            if (window.SoportesGrid) {
                if (SoportesGrid.entregas.length === 0) {
                    SoportesGrid.cargarDatos();
                } else {
                    // Resetear filtros y recargar
                    SoportesGrid.resetFiltros();
                }
            }
        };
    }

    // =========================================
    // CERRAR MODAL
    // =========================================
    const closeModal = function () {
        modal.style.display = 'none';
        overlay.style.display = 'none';
    };

    if (closeBtn) closeBtn.onclick = closeModal;
    if (overlay) overlay.onclick = closeModal;

    // =========================================
    // BÚSQUEDA EN TIEMPO REAL
    // =========================================
    if (searchInput) {
        let debounceTimer;
        searchInput.oninput = function (e) {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                if (window.SoportesGrid) {
                    console.log('Buscando:', e.target.value);
                    SoportesGrid.aplicarFiltros({ busqueda: e.target.value });
                }
            }, 400); // Delay para mejor rendimiento
        };
    }

    // =========================================
    // FILTRO DE HOY - CORREGIDO
    // =========================================
    if (filterToday) {
        filterToday.onclick = function (e) {
            e.preventDefault();
            console.log('Filtrar por HOY');

            const today = new Date();
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            today.setHours(0, 0, 0, 0);
            tomorrow.setHours(0, 0, 0, 0);

            if (window.SoportesGrid) {
                SoportesGrid.aplicarFiltros({
                    fechaInicio: today,
                    fechaFin: tomorrow
                });
            }

            // UI feedback
            filterToday.classList.add('active');
            if (filterWeek) filterWeek.classList.remove('active');
            if (resetFilter) resetFilter.classList.remove('active');

            // Limpiar búsqueda
            if (searchInput) searchInput.value = '';
        };
    }

    // =========================================
    // FILTRO DE SEMANA - CORREGIDO
    // =========================================
    if (filterWeek) {
        filterWeek.onclick = function (e) {
            e.preventDefault();
            console.log('Filtrar por ÚLTIMA SEMANA');

            const today = new Date();
            const weekAgo = new Date(today);
            weekAgo.setDate(weekAgo.getDate() - 7);

            today.setHours(23, 59, 59, 999);
            weekAgo.setHours(0, 0, 0, 0);

            if (window.SoportesGrid) {
                SoportesGrid.aplicarFiltros({
                    fechaInicio: weekAgo,
                    fechaFin: today
                });
            }

            // UI feedback
            filterWeek.classList.add('active');
            if (filterToday) filterToday.classList.remove('active');
            if (resetFilter) resetFilter.classList.remove('active');

            // Limpiar búsqueda
            if (searchInput) searchInput.value = '';
        };
    }

    // =========================================
    // RESET FILTROS
    // =========================================
    if (resetFilter) {
        resetFilter.onclick = function (e) {
            e.preventDefault();
            console.log('Resetear filtros');

            if (window.SoportesGrid) {
                SoportesGrid.resetFiltros();
            }

            // UI feedback
            filterToday.classList.remove('active');
            filterWeek.classList.remove('active');
            resetFilter.classList.remove('active');

            // Limpiar búsqueda
            if (searchInput) searchInput.value = '';
        };
    }

    // =========================================
    // MODAL DE IMAGEN
    // =========================================
    const downloadBtn = document.getElementById('downloadImageBtn');
    if (downloadBtn) {
        downloadBtn.onclick = function () {
            const img = document.getElementById('soportesModalImage');
            if (img && img.src) {
                const a = document.createElement('a');
                a.href = img.src;
                a.download = 'soporte_' + new Date().getTime() + '.jpg';
                a.click();
            }
        };
    }

    // =========================================
    // CERRAR MODAL DE IMAGEN CON ESC
    // =========================================
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            const imageModal = document.getElementById('soportesImageModal');
            if (imageModal) imageModal.style.display = 'none';
        }
    });

    // =========================================
    // CERRAR AL HACER CLICK FUERA DE LA IMAGEN
    // =========================================
    const imageModal = document.getElementById('soportesImageModal');
    if (imageModal) {
        imageModal.onclick = function (e) {
            if (e.target === imageModal) {
                imageModal.style.display = 'none';
            }
        };
    }

    // =========================================
    // EXPORTAR EXCEL (opcional)
    // =========================================
    const exportBtn = document.getElementById('exportSoportesBtn');
    if (exportBtn && window.SoportesGrid) {
        exportBtn.onclick = function () {
            SoportesGrid.exportarExcel();
        };
    }

    console.log('✅ Eventos del Grid configurados');
});
