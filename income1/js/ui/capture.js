/**
 * UI Capture and Sharing Logic
 * Matching backup.html exactly
 */

async function captureAndDownloadCards() {
    const cardsContainer = document.querySelector('.cards-container');
    const captureBtn = document.getElementById('captureBtn');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingText = document.getElementById('loadingText');

    try {
        if (loadingOverlay) loadingOverlay.classList.add('active');
        if (loadingText) loadingText.textContent = "Procesando informe visual...";
        if (captureBtn) captureBtn.classList.add('hidden');

        // 1. Abrir todas las tarjetas y guardar estado original
        const cardHeaders = document.querySelectorAll('.card-header');
        const originalStates = [];
        
        cardHeaders.forEach(header => {
            const cardContent = header.nextElementSibling;
            originalStates.push(cardContent.classList.contains('expanded'));
            if (!cardContent.classList.contains('expanded')) {
                cardContent.classList.add('expanded');
                const indicator = header.querySelector('.collapse-indicator');
                if (indicator) indicator.classList.add('expanded');
            }
        });

        await new Promise(resolve => setTimeout(resolve, 500));

        // 2. Configuración para captura
        const isMobile = window.matchMedia("(max-width: 768px)").matches;
        
        // Ocultar elementos temporales
        const elementsToHide = document.querySelectorAll('.date-selector-container, .social-links');
        elementsToHide.forEach(el => el.style.visibility = 'hidden');

        // Guardar estilos originales
        const originalStyles = {
            width: cardsContainer.style.width,
            overflow: cardsContainer.style.overflow,
            margin: cardsContainer.style.margin,
            transform: cardsContainer.style.transform,
            zoom: document.body.style.zoom
        };

        // Ajustar para captura - FORZAR ANCHO 1800px (más amplio)
        cardsContainer.style.width = '1800px';
        cardsContainer.style.maxWidth = '1800px';
        cardsContainer.style.minWidth = '1800px';
        cardsContainer.style.overflow = 'visible';
        cardsContainer.style.margin = '0 auto';
        
        if (isMobile) {
            document.body.style.zoom = '1';
        }

        // 3. Capturar con html2canvas
        const canvasOptions = {
            scale: isMobile ? 3 : 2,
            logging: false,
            useCORS: true,
            allowTaint: true,
            scrollX: 0,
            scrollY: 0,
            windowWidth: isMobile ? 3000 : 1800,
            windowHeight: cardsContainer.scrollHeight,
            backgroundColor: '#f9fafb'
        };

        await new Promise(resolve => setTimeout(resolve, 300));
        const canvas = await html2canvas(cardsContainer, canvasOptions);

        // 4. Restaurar todo al estado original
        elementsToHide.forEach(el => el.style.visibility = 'visible');
        Object.assign(cardsContainer.style, originalStyles);
        document.body.style.zoom = originalStyles.zoom;
        
        // Restaurar estado de las tarjetas
        cardHeaders.forEach((header, index) => {
            const cardContent = header.nextElementSibling;
            const indicator = header.querySelector('.collapse-indicator');
            
            if (!originalStates[index]) {
                cardContent.classList.remove('expanded');
                if (indicator) indicator.classList.remove('expanded');
            }
        });

        // 5. Convertir canvas a Blob
        if (loadingText) loadingText.textContent = "Generando imagen...";
        
        const blob = await new Promise(resolve => {
            canvas.toBlob(resolve, 'image/jpeg', 0.85);
        });
        
        console.log('Imagen generada - Tamaño:', blob.size, 'bytes');

        // 6. Crear archivo y descargar
        const fileName = `Informe_Ingresos_${formatDate(new Date()).replace(/\//g, '-')}.jpg`;
        downloadImage(blob, fileName);
        
        // 7. Esperar un momento para que se descargue
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 8. Generar mensaje y abrir WhatsApp
        if (loadingText) loadingText.textContent = "Abriendo WhatsApp...";
        const whatsappText = generateWhatsAppMessage();
        openWhatsAppWithText(whatsappText);

    } catch (e) {
        console.error("Capture error:", e);
        alert("Error al generar el informe visual.");
    } finally {
        if (captureBtn) captureBtn.classList.remove('hidden');
        if (loadingOverlay) loadingOverlay.classList.remove('active');
    }
}

function openAllCards() {
    document.querySelectorAll('.card-header').forEach(header => {
        const cardContent = header.nextElementSibling;
        const indicator = header.querySelector('.collapse-indicator');

        if (cardContent && !cardContent.classList.contains('expanded')) {
            cardContent.classList.add('expanded');
            if (indicator) indicator.classList.add('expanded');
        }
    });
}

// Función para mostrar notificación toast
function showToast(message, duration = 5000) {
    // Crear elemento toast si no existe
    let toast = document.getElementById('custom-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'custom-toast';
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #2563eb;
            color: white;
            padding: 16px 24px;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 100000;
            max-width: 90%;
            text-align: center;
            font-size: 14px;
            line-height: 1.5;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        document.body.appendChild(toast);
    }
    
    // Actualizar mensaje y mostrar
    toast.innerHTML = message;
    toast.style.opacity = '1';
    
    // Ocultar después del tiempo especificado
    setTimeout(() => {
        toast.style.opacity = '0';
    }, duration);
}

// WhatsApp message - matching backup.html exactly
function generateWhatsAppMessage(imageUrl = "") {
    if (!currentReportData) return "";

    const diaData = currentReportData.dia.actual;
    const mesData = currentReportData.mes.actual;
    const fechaObj = parseDate(diaData.fecha);

    // Formatear fechas
    const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

    const diaNombre = dias[fechaObj.getDay()];
    const diaNumero = fechaObj.getDate();
    const mesNombre = meses[fechaObj.getMonth()];
    const año = fechaObj.getFullYear();

    // Datos de semanas
    const semanaActual = getWeekNumber(fechaObj);
    const semanaAnterior = semanaActual - 1 > 0 ? semanaActual - 1 : 52;

    // Preparar comparativo
    let comparativoAnterior = '';
    if (currentReportData.dia.anterior) {
        const fechaAnterior = parseDate(currentReportData.filtros.anterior);
        comparativoAnterior = `(vs ${fechaAnterior.getDate()} ${meses[fechaAnterior.getMonth()]} ${año - 1})`;
    }

    // Determinar flecha de gestión
    let flechaGestion = '';
    if (diaData.gestion) {
        const valorGestion = parseFloat(diaData.gestion);
        flechaGestion = valorGestion < 0 ? '↓' : '↑';
    }

    // Obtener la tendencia global
    const tendenciaGlobal = getGlobalTrend();
    let textoTendencia = '';

    switch (tendenciaGlobal) {
        case 'positive':
            textoTendencia = '↑ Tendencia a la alza';
            break;
        case 'negative':
            textoTendencia = '↓ Tendencia a la baja';
            break;
        default:
            textoTendencia = 'Tendencia Estable';
    }

    // Construir el mensaje base
    let mensaje = `¡Bendiciones para todos!

Adjunto el Cierre de Ingresos del Día:
\`${diaNombre}, ${diaNumero} de ${mesNombre} del ${año}\`

*${formatoCantidad(diaData.ingreso)}* unidades | Cumplimiento *${diaData.porcentaje}*
Meta: *${formatoCantidad(diaData.meta)}* ${comparativoAnterior}

${textoTendencia}

Muestra Semanal (S${semanaActual}/S${semanaAnterior}) Gestión ${flechaGestion} *${diaData.gestion || 'N/A'}*
* Promedio: *${formatoCantidad(diaData.promedio)}*
* Ponderado: *${formatoCantidad(diaData.ponderado)}*
* Desviación: *${formatoCantidad(diaData.desvest)}*
* Máximo: *${formatoCantidad(diaData.max)}*`;

    // Agregar enlace a la aplicación
    mensaje += `\n\n☆ Link a la aplicación: https://andres1-dev.github.io/four/income/index.html`;

    // Solo agregar link de imagen si existe (para compatibilidad con código antiguo)
    if (imageUrl) {
        mensaje += `\n★ Resumen visual: ${imageUrl}`;
    }

    // Cierre del mensaje
    mensaje += `\n\nQuedo atento a sus comentarios.`;

    return mensaje;
}

// Función para descargar la imagen
function downloadImage(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    console.log('✓ Imagen descargada:', fileName);
}

// Función para abrir WhatsApp solo con texto
function openWhatsAppWithText(message) {
    const phoneNumber = "573168007979";
    const encodedMessage = encodeURIComponent(message);
    const url = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;

    // Detectar si estamos en iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isInStandaloneMode = ('standalone' in window.navigator) && (window.navigator.standalone);

    console.log('Abriendo WhatsApp - iOS:', isIOS, 'PWA:', isInStandaloneMode);

    if (isIOS && isInStandaloneMode) {
        // En iOS PWA, usar window.open es más confiable
        try {
            const newWindow = window.open(url, '_blank');
            if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
                window.location.href = url;
            }
        } catch (e) {
            console.error('Error abriendo WhatsApp:', e);
            window.location.href = url;
        }
    } else {
        // Para otros navegadores y plataformas
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
    }
}

