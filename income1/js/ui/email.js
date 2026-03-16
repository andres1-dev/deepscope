/**
 * Email Sending Logic - Outlook Compatible
 */

async function sendEmailReport() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingText = document.getElementById('loadingText');
    const emailBtn = document.getElementById('emailBtn');

    try {
        if (loadingOverlay) loadingOverlay.classList.add('active');
        if (loadingText) loadingText.textContent = "Preparando correo...";
        if (emailBtn) emailBtn.style.pointerEvents = 'none';

        const emailContent = generateEmailContent();
        
        if (loadingText) loadingText.textContent = "Enviando correo...";
        
        const result = await sendEmail(emailContent);
        
        if (result.success) {
            alert('Correo enviado exitosamente');
        } else {
            alert('Error al enviar el correo: ' + (result.message || 'Error desconocido'));
        }

    } catch (e) {
        console.error("Error al enviar email:", e);
        alert("Error al enviar el correo electrónico.");
    } finally {
        if (emailBtn) emailBtn.style.pointerEvents = 'auto';
        if (loadingOverlay) loadingOverlay.classList.remove('active');
    }
}

function generateEmailContent() {
    if (!currentReportData) return { subject: "", body: "" };

    const diaData = currentReportData.dia.actual;
    const mesData = currentReportData.mes.actual;
    const añoData = currentReportData.año.actual;
    const fechaObj = parseDate(diaData.fecha);
    
    const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    
    const diaNombre = dias[fechaObj.getDay()];
    const diaNumero = fechaObj.getDate();
    const mesNombre = meses[fechaObj.getMonth()];
    const año = fechaObj.getFullYear();
    
    const semanaActual = getWeekNumber(fechaObj);
    const semanaAnterior = semanaActual - 1 > 0 ? semanaActual - 1 : 52;
    
    let comparativoAnterior = '';
    if (currentReportData.dia.anterior) {
        const fechaAnterior = parseDate(currentReportData.filtros.anterior);
        comparativoAnterior = `(vs ${fechaAnterior.getDate()} ${meses[fechaAnterior.getMonth()]} ${año - 1})`;
    }
    
    let flechaGestion = '';
    if (diaData.gestion) {
        const valorGestion = parseFloat(diaData.gestion);
        flechaGestion = valorGestion < 0 ? '↓' : '↑';
    }
    
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
    
    const subject = `Informe de Ingresos - ${diaNombre}, ${diaNumero} de ${mesNombre} del ${año}`;
    
    const body = `
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 800px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f9fafb;">
            <tr>
                <td style="padding: 20px;">
                    
                    <!-- Header -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #2563eb; border-radius: 12px; margin-bottom: 20px;">
                        <tr>
                            <td style="padding: 30px; text-align: center;">
                                <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #ffffff;">Informe de Ingresos de Marca Propia</h1>
                                <p style="margin: 10px 0 0 0; font-size: 18px; color: #ffffff;">${diaNombre}, ${diaNumero} de ${mesNombre} del ${año}</p>
                            </td>
                        </tr>
                    </table>
                    
                    <!-- Resumen del Día -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; margin-bottom: 20px;">
                        <tr>
                            <td style="padding: 25px;">
                                <h2 style="color: #2563eb; margin-top: 0; font-size: 22px; border-bottom: 3px solid #2563eb; padding-bottom: 10px; margin-bottom: 15px;">Resumen del Día</h2>
                                <table width="100%" cellpadding="12" cellspacing="0" style="border-collapse: collapse;">
                                    <tr style="background-color: #f8fafc;">
                                        <td style="border-bottom: 1px solid #e5e7eb; font-weight: 600;">Ingreso Actual:</td>
                                        <td style="border-bottom: 1px solid #e5e7eb; text-align: right; font-size: 18px; color: #2563eb; font-weight: 700;">${formatoCantidad(diaData.ingreso)} unidades</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">Meta Diaria:</td>
                                        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-size: 18px;">${formatoCantidad(diaData.meta)} unidades</td>
                                    </tr>
                                    <tr style="background-color: #f8fafc;">
                                        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">Diferencia:</td>
                                        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-size: 18px;">${formatoCantidad(diaData.diferencia)} unidades</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">Cumplimiento:</td>
                                        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #2563eb; font-weight: 700; font-size: 20px;">${diaData.porcentaje}</td>
                                    </tr>
                                    <tr style="background-color: #f8fafc;">
                                        <td style="padding: 12px; font-weight: 600;">Tendencia:</td>
                                        <td style="padding: 12px; text-align: right; font-size: 16px; font-weight: 600;">${textoTendencia}</td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                    
                    <!-- Estadísticas Semanales -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; margin-bottom: 20px;">
                        <tr>
                            <td style="padding: 25px;">
                                <h3 style="color: #2563eb; margin-top: 0; font-size: 20px; border-bottom: 3px solid #2563eb; padding-bottom: 10px; margin-bottom: 15px;">Muestra Semanal (S${semanaActual}/S${semanaAnterior})</h3>
                                <table width="100%" cellpadding="10" cellspacing="0" style="border-collapse: collapse;">
                                    <tr style="background-color: #f8fafc;">
                                        <td style="border-bottom: 1px solid #e5e7eb; font-weight: 600;">Gestión Anual:</td>
                                        <td style="border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">${flechaGestion} ${diaData.gestion || 'N/A'} ${comparativoAnterior}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">Promedio:</td>
                                        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatoCantidad(diaData.promedio)}</td>
                                    </tr>
                                    <tr style="background-color: #f8fafc;">
                                        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">Promedio Ponderado:</td>
                                        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatoCantidad(diaData.ponderado)}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">Desviación Estándar:</td>
                                        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatoCantidad(diaData.desvest)}</td>
                                    </tr>
                                    <tr style="background-color: #f8fafc;">
                                        <td style="padding: 10px; font-weight: 600;">Máximo:</td>
                                        <td style="padding: 10px; text-align: right; color: #059669; font-weight: 700;">${formatoCantidad(diaData.max)}</td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                    
                    <!-- Resumen Mensual -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; margin-bottom: 20px;">
                        <tr>
                            <td style="padding: 25px;">
                                <h2 style="color: #059669; margin-top: 0; font-size: 22px; border-bottom: 3px solid #059669; padding-bottom: 10px; margin-bottom: 15px;">Resumen Mensual - ${mesNombre}</h2>
                                <table width="100%" cellpadding="12" cellspacing="0" style="border-collapse: collapse;">
                                    <tr style="background-color: #f0fdf4;">
                                        <td style="border-bottom: 1px solid #e5e7eb; font-weight: 600;">Ingreso Actual:</td>
                                        <td style="border-bottom: 1px solid #e5e7eb; text-align: right; font-size: 18px; color: #059669; font-weight: 700;">${formatoCantidad(mesData.ingreso)} unidades</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">Meta Mensual:</td>
                                        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-size: 18px;">${formatoCantidad(mesData.meta)} unidades</td>
                                    </tr>
                                    <tr style="background-color: #f0fdf4;">
                                        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">Diferencia:</td>
                                        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-size: 18px;">${formatoCantidad(mesData.diferencia)} unidades</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">Cumplimiento:</td>
                                        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #059669; font-weight: 700; font-size: 20px;">${mesData.porcentaje}</td>
                                    </tr>
                                    <tr style="background-color: #f0fdf4;">
                                        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">Promedio:</td>
                                        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatoCantidad(mesData.promedio)}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">Promedio Ponderado:</td>
                                        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatoCantidad(mesData.ponderado)}</td>
                                    </tr>
                                    <tr style="background-color: #f0fdf4;">
                                        <td style="padding: 12px; font-weight: 600;">Gestión Anual:</td>
                                        <td style="padding: 12px; text-align: right; font-weight: 600;">${mesData.gestion || 'N/A'}</td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                    
                    <!-- Resumen Anual -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; margin-bottom: 20px;">
                        <tr>
                            <td style="padding: 25px;">
                                <h2 style="color: #d97706; margin-top: 0; font-size: 22px; border-bottom: 3px solid #d97706; padding-bottom: 10px; margin-bottom: 15px;">Resumen Anual ${año}</h2>
                                <table width="100%" cellpadding="12" cellspacing="0" style="border-collapse: collapse;">
                                    <tr style="background-color: #fef3c7;">
                                        <td style="border-bottom: 1px solid #e5e7eb; font-weight: 600;">Ingreso Actual:</td>
                                        <td style="border-bottom: 1px solid #e5e7eb; text-align: right; font-size: 18px; color: #d97706; font-weight: 700;">${formatoCantidad(añoData.ingreso)} unidades</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">Meta Anual:</td>
                                        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-size: 18px;">${formatoCantidad(añoData.meta)} unidades</td>
                                    </tr>
                                    <tr style="background-color: #fef3c7;">
                                        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">Diferencia:</td>
                                        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-size: 18px;">${formatoCantidad(añoData.diferencia)} unidades</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">Cumplimiento:</td>
                                        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #d97706; font-weight: 700; font-size: 20px;">${añoData.porcentaje}</td>
                                    </tr>
                                    <tr style="background-color: #fef3c7;">
                                        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">Promedio:</td>
                                        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatoCantidad(añoData.promedio)}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 12px; font-weight: 600;">Gestión:</td>
                                        <td style="padding: 12px; text-align: right; font-weight: 600;">${añoData.gestion || 'N/A'}</td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                    
                    <!-- Enlaces -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; margin-bottom: 20px;">
                        <tr>
                            <td style="padding: 25px;">
                                <h3 style="color: #2563eb; margin-top: 0; font-size: 20px; border-bottom: 3px solid #2563eb; padding-bottom: 10px; margin-bottom: 15px;">Acceso a la Aplicación</h3>
                                <table cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td style="background-color: #2563eb; border-radius: 8px; padding: 12px 24px;">
                                            <a href="https://andres1-dev.github.io/four/income/index.html" 
                                               style="color: #ffffff; text-decoration: none; font-weight: 600; display: block;">
                                                Abrir Sistema de Ingresos
                                            </a>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                    
                    <!-- Footer -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px;">
                        <tr>
                            <td style="padding: 20px; text-align: center;">
                                <p style="margin: 5px 0; color: #6b7280; font-size: 14px;">Quedo atento a sus comentarios.</p>
                                <p style="margin: 15px 0 5px 0; font-weight: 600; color: #2563eb; font-size: 14px;">Ingresos de Marca Propia</p>
                                <p style="margin: 5px 0; color: #6b7280; font-size: 14px;">Andrés Mendoza © 2026</p>
                            </td>
                        </tr>
                    </table>
                    
                </td>
            </tr>
        </table>
    `;
    
    return { subject, body };
}

/*async function sendEmail(emailContent) {
    try {
        const formData = new FormData();
        formData.append('action', 'sendEmail');
        formData.append('to', 'nixandres2@gmail.com,coordinadorlogistico@eltemplodelamoda.com.co,planeadorproduccion@tceluniverso.com,directorproduccion@tceluniverso.com');
        formData.append('subject', emailContent.subject);
        formData.append('body', emailContent.body);
        
        console.log('Enviando email...');
        
        const response = await fetch('https://script.google.com/macros/s/AKfycbz6sUS28Xza02Kjwg-Eez1TPn4BBj2XcZGF8gKxEHr4Fsxz4eqYoQYHCqx5NWaOP1OR8g/exec', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        console.log('Respuesta del servidor:', result);
        
        return result;
    } catch (error) {
        console.error('Error al enviar email:', error);
        return { success: false, message: error.message };
    }
}*/

async function sendEmail(emailContent) {
    try {
        const formData = new FormData();
        formData.append('action', 'sendEmail');
        
        // Destinatarios principales (TO)
        formData.append('to', [
            'ceo@grupotdm.co',                                // Leonardo Manrique - CEO
            'jairzuluaga@eltemplodelamoda.com.co',            // Jair Zuluaga - Gerencia - Comercial
            'directorproduccion@tceluniverso.com',            // Esteban Correa - Director de Producción - Universo
            'gerencia@tclosangeles.com'                       // Diana Quiceno - Gerencia - Angeles
        ].join(','));
        
        // Destinatarios en copia (CC)
        formData.append('cc', [
            'planeadorproduccion@tceluniverso.com',           // Cesar Sanchez - Planeador de Producción
            'auditorinterno@tceluniverso.com',                // Maribel Garcia - Auditor Interno
            'gestorproduccionintima@tceluniverso.com',        // Kelly Zuluaga - Gestor - Íntima
            'auxiliar3@tceluniverso.com',                     // Juan Zuluaga - Gestor - Especiales y Bogota
            'produccionbasico@tceluniverso.com',              // Cesar Lopez - Gestor - Básico
            'gestor1@tceluniverso.com',                       // Fabian Marin - Gestor Moda Fresca
            'gestorproduccionurbano@tceluniverso.com',        // Maryi Gonzalez - Gestor - Urbano
            'gestorproducciondeportivo@tceluniverso.com',     // Stefany Espinoza - Gestor - Deportivo
            'coordinadorcorte@tceluniverso.com',              // Allison Mosquera - Coordinador - Corte
            'coordinadorinsumos@tceluniverso.com',            // Sebastian Bonilla - Coordinador - Insumos
            'analistadecompras@tceluniverso.com',             // Leidy - Coordinador - Compras
            'coordinadorinventario@tceluniverso.com',         // Fernanda Millan - Coordinador - Telas
            'coordinadordespacho@tceluniverso.com',           // Edwar Jaimes - Coordinador - Despacho
            'asistentedeproduccion@tclosangeles.com',         // Luis Villamizar - Gestor - Angeles
            'asistenteadministrativo@tclosangeles.com'        // Lina Erazo - Asistente - Angeles
        ].join(','));
        
        // Destinatarios en copia oculta (BCC)
        formData.append('bcc', [
            'coordinadorlogistico@eltemplodelamoda.com.co',   // Coordinador Logístico - Universo
            'nixandres2@gmail.com'                            // Coordinador Logístico - Universo
        ].join(','));
        
        formData.append('subject', emailContent.subject);
        formData.append('body', emailContent.body);
        
        console.log('Enviando email...');
        console.log('TO:', formData.get('to'));
        console.log('CC:', formData.get('cc'));
        console.log('BCC:', formData.get('bcc'));
        
        const response = await fetch('https://script.google.com/macros/s/AKfycbz6sUS28Xza02Kjwg-Eez1TPn4BBj2XcZGF8gKxEHr4Fsxz4eqYoQYHCqx5NWaOP1OR8g/exec', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        console.log('Respuesta del servidor:', result);
        
        return result;
    } catch (error) {
        console.error('Error al enviar email:', error);
        return { success: false, message: error.message };
    }
}

// Inicializar el botón de email
function initEmailButton() {
    const emailBtn = document.getElementById('emailBtn');
    if (emailBtn) {
        emailBtn.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Verificar contraseña antes de enviar
            if (checkPassword()) {
                sendEmailReport();
            }
        });
    }
}

// Llamar a la inicialización cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEmailButton);
} else {
    initEmailButton();
}
