// QR Scanner Module - VERSIÓN MEJORADA ROBUSTA
class QRScanner {
  constructor() {
    this.scanner = null;
    this.isScanning = false;
    this.currentCameraId = null;
    this.cameras = [];
    this.cameraIndex = 0;
    this.lightWarningShown = false;
    this.scanTimeout = null;

    this.initElements();
    this.initEventListeners();

    console.log("QR Scanner Module Initialized - Robust Version");
  }

  initElements() {
    this.qrScannerIcon = document.getElementById('inputIcon');
    this.qrScannerModal = document.getElementById('qrScannerModal');
    this.qrScannerOverlay = document.getElementById('qrScannerOverlay');
    this.qrReader = document.getElementById('qrReader');
    this.closeQrScanner = document.getElementById('closeQrScanner');
    this.cancelQrScan = document.getElementById('cancelQrScan');
    this.toggleCameraBtn = document.getElementById('toggleCameraBtn');
    this.toggleFlashBtn = document.getElementById('toggleFlashBtn');
    this.barcodeInput = document.getElementById('barcode');
    this.scanMessage = document.getElementById('scanMessage');

    // Hacer el icono de QR más atractivo
    if (this.qrScannerIcon) {
      this.qrScannerIcon.style.cursor = 'pointer';
      this.qrScannerIcon.title = 'Escanear código QR';
    }

    // Preparar botón de cambiar cámara
    if (this.toggleCameraBtn) {
      this.toggleCameraBtn.innerHTML = `
        <i class="fas fa-camera"></i>
        <span>Cambiar cámara</span>
      `;
    }
  }

  initEventListeners() {
    // Icono QR para abrir escáner
    if (this.qrScannerIcon) {
      this.qrScannerIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof window.APP_MODE !== 'undefined' && window.APP_MODE === 'CAMERA') {
          this.openScanner();
        }
      });
    }

    // Botones para cerrar
    if (this.closeQrScanner) {
      this.closeQrScanner.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeScanner();
      });
    }

    if (this.cancelQrScan) {
      this.cancelQrScan.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeScanner();
      });
    }

    // Botón para cambiar cámara
    if (this.toggleCameraBtn) {
      this.toggleCameraBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleCamera();
      });
    }

    // Botón de Linterna
    if (this.toggleFlashBtn) {
      this.toggleFlashBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleFlash();
      });
    }

    // Cerrar al hacer clic fuera (si existe el overlay)
    if (this.qrScannerOverlay) {
      this.qrScannerOverlay.addEventListener('click', (e) => {
        if (e.target === this.qrScannerOverlay) {
          this.closeScanner();
        }
      });
    }

    // Manejar tecla ESC para cerrar
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isScanning) {
        this.closeScanner();
      }
    });
  }

  // Compatibilidad con app.js
  scanQRCode() {
    this.openScanner();
  }

  async openScanner() {
    try {
      // Mostrar modal y overlay
      if (this.qrScannerModal) {
        this.qrScannerModal.style.display = 'flex';
        this.qrScannerModal.classList.add('active');
      }
      if (this.qrScannerOverlay) {
        this.qrScannerOverlay.style.display = 'block';
        this.qrScannerOverlay.classList.add('active');
      }

      // Ocultar teclado si está visible
      if (this.barcodeInput) this.barcodeInput.blur();

      // Limpiar contenedor anterior
      if (this.qrReader) {
        this.qrReader.innerHTML = '';
        this.qrReader.style.backgroundColor = '#000';
      }

      // Reset warnings
      this.lightWarningShown = false;

      // Mostrar loading
      this.showLoading();

      // Inicializar escáner después de un breve retraso
      setTimeout(async () => {
        try {
          await this.initScanner();
        } catch (error) {
          console.error('Error al iniciar escáner:', error);
          this.showErrorMessage('Error al iniciar la cámara: ' + error.message);
          setTimeout(() => this.closeScanner(), 2000);
        }
      }, 300);

    } catch (error) {
      console.error('Error al abrir escáner:', error);
      this.showErrorMessage('No se pudo abrir el escáner');
      this.closeScanner();
    }
  }

  async initScanner() {
    try {
      if (!this.qrReader) throw new Error("No qrReader element found");

      // DETECCIÓN DE MODO PWA / SAFARI WEBAPP
      const isPWA = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

      let config;

      if (isPWA && isIOS) {
        // ⚠️ CONFIGURACIÓN SEGURA PARA IOS PWA (Evitar OverconstrainedError y Memory Limits)
        console.log("Modo IOS PWA detectado: Usando configuración simplificada");
        config = {
          fps: 25, // Aumentar FPS para mejorar velocidad (antes 15)
          qrbox: 270, // Tamaño mejorado
          aspectRatio: 1.0, // Ratio cuadrado estándar
          disableFlip: false,
          videoConstraints: {
            facingMode: "environment", // String simple, no objeto
            width: { ideal: 1080 } // Intentar más resolución (antes 720)
          }
        };
      } else {
        // ✅ CONFIGURACIÓN SUPER ROBUSTA (Para Navegadores Completos y Android)
        config = {
          fps: 30,  // MÁXIMA VELOCIDAD
          qrbox: function (viewfinderWidth, viewfinderHeight) {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            return {
              width: Math.floor(minEdge * 0.85),
              height: Math.floor(minEdge * 0.85)
            };
          },
          aspectRatio: 1.333333,
          disableFlip: false,
          rememberLastUsedCamera: true,
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true
          },
          videoConstraints: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
            facingMode: { ideal: "environment" }
          }
        };
      }

      // Obtener cámaras disponibles
      const devices = await Html5Qrcode.getCameras();

      if (devices && devices.length > 0) {
        this.cameras = devices;

        // ✅ ALGORITMO MEJORADO PARA DETECTAR CÁMARA TRASERA
        let cameraId = null;
        let cameraIndex = 0;

        // 1. Buscar por facingMode environment
        const environmentCamera = devices.find(device =>
          device.label.toLowerCase().includes('environment') ||
          (device.label.toLowerCase().includes('back') && !device.label.toLowerCase().includes('backfacing')) ||
          device.label.toLowerCase().includes('rear')
        );

        // 2. Buscar por patrones comunes
        if (!environmentCamera) {
          const backCamPatterns = [
            /back/i, /rear/i, /environment/i, /traser/i, /posterior/i,
            /0$/i,  // Muchos dispositivos terminan con 0 para trasera
            /cam.*1$/i, /cam.*2$/i  // Cámara 2 suele ser trasera
          ];

          const backCamera = devices.find(device =>
            backCamPatterns.some(pattern => pattern.test(device.label))
          );

          if (backCamera) {
            cameraId = backCamera.id;
            cameraIndex = devices.findIndex(d => d.id === backCamera.id);
          }
        } else {
          cameraId = environmentCamera.id;
          cameraIndex = devices.findIndex(d => d.id === environmentCamera.id);
        }

        // 3. Si no encuentra, usar la primera cámara NO frontal
        if (!cameraId) {
          const nonFrontalCameras = devices.filter(device =>
            !device.label.toLowerCase().includes('front') &&
            !device.label.toLowerCase().includes('user') &&
            !device.label.toLowerCase().includes('selfie')
          );

          if (nonFrontalCameras.length > 0) {
            cameraId = nonFrontalCameras[0].id;
            cameraIndex = devices.findIndex(d => d.id === nonFrontalCameras[0].id);
          } else {
            cameraId = devices[0].id;  // Último recurso
          }
        }

        this.currentCameraId = cameraId;
        this.cameraIndex = cameraIndex;

        // Quitar loading
        this.hideLoading();

        // ✅ CONFIGURACIÓN FINAL
        // Si es PWA, respetamos la configuración simplificada
        const enhancedConfig = (isPWA && isIOS) ? config : {
          ...config,
          // Ajustes adicionales para códigos difíciles (solo en navegadores completos)
          qrbox: { width: 300, height: 300 }
        };

        // Crear nuevo escáner
        // Crear nuevo escáner OPTIMIZADO PARA QR
        // Restringir formatos mejora drásticamente el rendimiento
        this.scanner = new Html5Qrcode(this.qrReader.id, {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false
        });

        // Iniciar escaneo
        await this.startScanning(cameraId, enhancedConfig);

      } else {
        throw new Error('No se encontraron cámaras disponibles');
      }

    } catch (error) {
      console.error('Error al inicializar escáner:', error);
      this.hideLoading();

      // ✅ INTENTO DE RECUPERACIÓN: usar facingMode genérico
      if (error.toString().includes('constraint') || error.toString().includes('NotFoundError')) {
        console.log('Intentando configuración alternativa...');
        await this.initWithFallbackConfig();
      } else {
        throw error;
      }
    }
  }

  // ✅ MÉTODO DE RESPALDO SI FALLA LA CONFIGURACIÓN EXACTA
  async initWithFallbackConfig() {
    try {
      // Configuración más permisiva (IOS SAFE)
      const fallbackConfig = {
        fps: 15,
        qrbox: 250,
        aspectRatio: 1.0,
        disableFlip: false,
        videoConstraints: {
          facingMode: "environment" // Simple string works best as fallback
        }
      };

      // Limpiar contenedor
      if (this.qrReader) {
        this.qrReader.innerHTML = '';
        this.qrReader.style.backgroundColor = '#000';
      }

      // Crear nuevo escáner (Fallback)
      this.scanner = new Html5Qrcode(this.qrReader.id, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE]
      });

      // Usar facingMode como string directamente
      await this.scanner.start(
        { facingMode: "environment" },  // Formato simplificado
        fallbackConfig,
        (decodedText) => this.onScanSuccess(decodedText),
        (errorMessage) => this.onScanError(errorMessage)
      );

      this.isScanning = true;
      this.updateCameraStatus();
      this.checkCapabilities();

    } catch (fallbackError) {
      console.error('Error en configuración de respaldo:', fallbackError);
      this.showErrorMessage('No se pudo acceder a la cámara trasera. Verifica los permisos.');
      throw fallbackError;
    }
  }

  async startScanning(cameraId, config) {
    try {
      // ✅ ANTES DE INICIAR: Optimizar contenedor
      if (this.qrReader) {
        this.qrReader.style.backgroundColor = '#000';

        // Añadir overlay de guía SOLO con esquinas (sin fondo oscuro)
        const guideOverlay = document.createElement('div');
        guideOverlay.className = 'qr-guide-overlay';
        guideOverlay.innerHTML = `
          <div class="qr-corner tl"></div>
          <div class="qr-corner tr"></div>
          <div class="qr-corner bl"></div>
          <div class="qr-corner br"></div>
          <div class="qr-guide-text">Alinea el código QR dentro del marco</div>
        `;
        this.qrReader.appendChild(guideOverlay);
      }

      await this.scanner.start(
        cameraId,
        config,
        (decodedText) => this.onScanSuccess(decodedText),
        (errorMessage) => {
          // ✅ MANEJO AVANZADO DE ERRORES
          if (!errorMessage.includes('No QR code found')) {
            console.warn('Error de escaneo:', errorMessage);

            // Posibles ajustes dinámicos
            if ((errorMessage.includes('brightness') || errorMessage.includes('dark')) && !this.lightWarningShown) {
              this.suggestIncreaseLight();
            }
          }
        }
      );

      this.isScanning = true;
      this.updateCameraStatus();
      this.checkCapabilities();

      // ✅ TIMEOUT DE SEGURIDAD
      if (this.scanTimeout) clearTimeout(this.scanTimeout);
      this.scanTimeout = setTimeout(() => {
        if (this.isScanning) {
          console.log('Scanner timeout - still active');
        }
      }, 30000); // 30 segundos timeout

    } catch (error) {
      console.error('Error al iniciar escaneo:', error);

      // GESTIÓN DE CONFLICTOS: Si la cámara está ocupada (posiblemente por camara.js manteniendo el stream)
      if (error.name === 'NotReadableError' || error.toString().includes('NotReadableError') || error.toString().includes('Could not start video source')) {
        console.warn('Cámara ocupada. Liberando stream global de camara.js y reintentando...');

        if (typeof window.cameraStream !== 'undefined' && window.cameraStream) {
          // Detener completamente el stream global para liberar el hardware
          window.cameraStream.getTracks().forEach(track => track.stop());
          window.cameraStream = null;

          // Reintentar escaneo después de un breve respiro
          setTimeout(() => this.startScanning(cameraId, config), 200);
          return;
        }
      }

      // Si falla con cameraId, intentar con facingMode
      if (error.toString().includes('NotFoundError') || error.toString().includes('OverconstrainedError')) {
        console.log('Intentando con facingMode simple...');
        await this.scanner.start(
          "environment",
          config,
          (decodedText) => this.onScanSuccess(decodedText),
          (errorMessage) => this.onScanError(errorMessage)
        );
        this.isScanning = true;
        this.updateCameraStatus();
        this.checkCapabilities();
      } else {
        throw error;
      }
    }
  }

  onScanSuccess(decodedText) {
    console.log('✅ QR escaneado:', decodedText);

    // 1. CERRAR ESCÁNER INMEDIATAMENTE (Prioridad Máxima)
    this.closeScanner().catch(err => console.warn("Error background closing:", err));

    // 2. Limpiar timeout
    if (this.scanTimeout) clearTimeout(this.scanTimeout);

    // 3. Insertar código en el input INMEDIATAMENTE
    if (this.barcodeInput) {
      this.barcodeInput.value = decodedText;
    }

    // 4. Reproducir sonido y feedback visual (sin bloquear)
    this.playScanSuccessSound();

    // 5. Procesar el código (Pequeño delay para permitir que el UI se renderice cerrado)
    setTimeout(() => {
      if (this.barcodeInput) {
        // Disparar eventos
        const inputEvent = new Event('input', { bubbles: true });
        this.barcodeInput.dispatchEvent(inputEvent);

        // Enfocar para siguiente lectura
        this.barcodeInput.focus();

        // Limpiar input visualmente (opcional, depende de lógica de negocio)
        // setTimeout(() => { this.barcodeInput.value = ''; }, 100); 
      }
    }, 50);
  }

  onScanError(errorMessage) {
    // Ignorar errores comunes de "no code found"
    if (errorMessage && !errorMessage.includes('No QR code found')) {
      console.log('Scanner error:', errorMessage);
    }
  }

  showScanSuccessEffect() {
    const corners = document.querySelectorAll('.qr-corner');
    corners.forEach(corner => {
      corner.style.borderColor = '#00ff00';
      corner.style.boxShadow = '0 0 10px #00ff00';
    });

    setTimeout(() => {
      corners.forEach(corner => {
        corner.style.borderColor = '';
        corner.style.boxShadow = '';
      });
    }, 500);
  }

  async toggleCamera() {
    if (!this.cameras || this.cameras.length < 2) {
      this.showMessage('Solo hay una cámara disponible', 2000);
      return;
    }

    try {
      // Mostrar indicador de cambio
      this.showMessage('Cambiando cámara...', 1000);

      // Detener escáner actual
      if (this.scanner && this.isScanning) {
        await this.scanner.stop();
        this.isScanning = false;
      }

      // Cambiar a siguiente cámara
      this.cameraIndex = (this.cameraIndex + 1) % this.cameras.length;
      const nextCameraId = this.cameras[this.cameraIndex].id;
      this.currentCameraId = nextCameraId;

      // Reiniciar escaneo con nueva cámara
      const config = {
        fps: 15,
        qrbox: { width: 300, height: 300 },
        aspectRatio: 1.333333,
        videoConstraints: {
          facingMode: this.cameraIndex === 0 ? { ideal: "environment" } : { ideal: "user" }
        }
      };

      // Limpiar UI
      if (this.qrReader) {
        this.qrReader.innerHTML = '';
        this.qrReader.style.backgroundColor = '#000';
      }

      await this.startScanning(nextCameraId, config);

    } catch (error) {
      console.error('Error al cambiar cámara:', error);
      this.showErrorMessage('Error al cambiar de cámara');

      // Revertir índice si falla
      this.cameraIndex = (this.cameraIndex - 1 + this.cameras.length) % this.cameras.length;
    }
  }

  async closeScanner() {
    try {
      // Limpiar timeout
      if (this.scanTimeout) clearTimeout(this.scanTimeout);

      // Detener escáner si está activo
      if (this.scanner && this.isScanning) {
        await this.scanner.stop();
        this.isScanning = false;
      }

      // Limpiar escáner
      this.scanner = null;

      // Limpiar contenedor
      if (this.qrReader) {
        this.qrReader.innerHTML = '';
        this.qrReader.style.backgroundColor = '';
      }

      // Ocultar modal
      if (this.qrScannerModal) {
        this.qrScannerModal.style.display = 'none';
        this.qrScannerModal.classList.remove('active');
      }
      if (this.qrScannerOverlay) {
        this.qrScannerOverlay.style.display = 'none';
        this.qrScannerOverlay.classList.remove('active');
      }

      // Remover alertas de luz
      const lightAlert = document.querySelector('.qr-light-alert');
      if (lightAlert) lightAlert.remove();

      // Reset warnings
      this.lightWarningShown = false;

      // Restaurar foco al input después de un breve retraso
      setTimeout(() => {
        if (this.barcodeInput) {
          this.barcodeInput.focus();
        }
      }, 400);

    } catch (error) {
      console.error('Error al cerrar escáner:', error);
      // Forzar cierre visual
      if (this.qrScannerModal) {
        this.qrScannerModal.style.display = 'none';
        this.qrScannerModal.classList.remove('active');
      }
    }
  }

  showLoading() {
    if (this.qrReader) {
      this.qrReader.innerHTML = `
        <div class="qr-scanner-loading">
          <i class="fas fa-spinner fa-spin"></i>
          <p>Iniciando cámara...</p>
        </div>
      `;
    }
  }

  hideLoading() {
    // Se limpia al iniciar el scan
    const loading = document.querySelector('.qr-scanner-loading');
    if (loading) loading.remove();
  }

  playScanSuccessSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.frequency.value = 1200;
      gain.gain.value = 0.1;

      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.1);
      osc.stop(ctx.currentTime + 0.1);
    } catch (e) {
      // Silenciar error de audio
    }
  }

  // ✅ ACTUALIZAR INDICADOR DE CÁMARA
  updateCameraStatus() {
    if (this.toggleCameraBtn && this.cameras.length > 0) {
      const currentCamera = this.cameras[this.cameraIndex];
      let cameraType = 'Trasera';

      if (currentCamera.label.toLowerCase().includes('front') ||
        currentCamera.label.toLowerCase().includes('user') ||
        currentCamera.label.toLowerCase().includes('selfie')) {
        cameraType = 'Frontal';
      }

      this.toggleCameraBtn.innerHTML = `
        <i class="fas fa-camera${cameraType === 'Trasera' ? '' : '-retro'}"></i>
        <span>Cambiar (${cameraType})</span>
      `;
      this.toggleCameraBtn.title = `Cámara actual: ${currentCamera.label || cameraType}`;
    }
  }

  // ✅ SUGERIR MÁS LUZ
  suggestIncreaseLight() {
    if (!this.lightWarningShown && this.qrScannerModal) {
      const lightAlert = document.createElement('div');
      lightAlert.className = 'qr-light-alert';
      lightAlert.innerHTML = `
        <i class="fas fa-lightbulb"></i>
        <span>Baja iluminación detectada. Mejora la luz para mejor escaneo.</span>
        <button class="close-light-alert">&times;</button>
      `;

      this.qrScannerModal.appendChild(lightAlert);

      setTimeout(() => {
        lightAlert.style.opacity = '1';
        lightAlert.style.transform = 'translateX(-50%) translateY(0)';
      }, 100);

      // Auto-ocultar después de 5 segundos
      setTimeout(() => {
        if (lightAlert.parentNode) {
          lightAlert.style.opacity = '0';
          lightAlert.style.transform = 'translateX(-50%) translateY(-20px)';
          setTimeout(() => {
            if (lightAlert.parentNode) lightAlert.remove();
          }, 300);
        }
      }, 5000);

      // Botón para cerrar
      lightAlert.querySelector('.close-light-alert').addEventListener('click', () => {
        lightAlert.style.opacity = '0';
        lightAlert.style.transform = 'translateX(-50%) translateY(-20px)';
        setTimeout(() => lightAlert.remove(), 300);
      });

      this.lightWarningShown = true;
    }
  }

  // ✅ MOSTRAR MENSAJES
  showMessage(text, duration = 3000) {
    if (!this.scanMessage) return;

    this.scanMessage.textContent = text;
    this.scanMessage.style.display = 'block';
    this.scanMessage.style.opacity = '1';

    setTimeout(() => {
      if (this.scanMessage) {
        this.scanMessage.style.opacity = '0';
        setTimeout(() => {
          if (this.scanMessage) this.scanMessage.style.display = 'none';
        }, 300);
      }
    }, duration);
  }

  showErrorMessage(text) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'qr-error-message';
    errorDiv.innerHTML = `
      <i class="fas fa-exclamation-circle"></i>
      <span>${text}</span>
    `;

    if (this.qrScannerModal) {
      this.qrScannerModal.appendChild(errorDiv);
      setTimeout(() => errorDiv.remove(), 3000);
    }
  }

  // ✅ NUEVAS FUNCIONES PARA LINTERNA
  checkCapabilities() {
    if (this.toggleFlashBtn) this.toggleFlashBtn.style.display = 'none';
    this.isFlashOn = false;

    try {
      if (this.scanner) {
        const capabilities = this.scanner.getRunningTrackCameraCapabilities();

        // Verificar soporte de linterna
        if (capabilities.torchFeature().isSupported()) {
          console.log('Linterna soportada');
          if (this.toggleFlashBtn) {
            this.toggleFlashBtn.style.display = 'inline-flex';
            this.updateFlashButton();
          }
        }
      }
    } catch (err) {
      console.warn('No se pudieron obtener capacidades de cámara:', err);
    }
  }

  async toggleFlash() {
    if (!this.scanner || !this.isScanning) return;

    try {
      this.isFlashOn = !this.isFlashOn;

      await this.scanner.applyVideoConstraints({
        advanced: [{ torch: this.isFlashOn }]
      });

      this.updateFlashButton();

    } catch (err) {
      console.error('Error al cambiar linterna:', err);
      this.isFlashOn = !this.isFlashOn; // Revertir estado
      this.showErrorMessage('No se pudo activar la linterna');
    }
  }

  updateFlashButton() {
    if (!this.toggleFlashBtn) return;

    if (this.isFlashOn) {
      this.toggleFlashBtn.classList.add('active');
      this.toggleFlashBtn.innerHTML = '<i class="fas fa-bolt"></i> Apagar';
      this.toggleFlashBtn.style.backgroundColor = '#ffc107'; // Warning color override
      this.toggleFlashBtn.style.color = '#000';
    } else {
      this.toggleFlashBtn.classList.remove('active');
      this.toggleFlashBtn.innerHTML = '<i class="fas fa-bolt"></i> Linterna';
      this.toggleFlashBtn.style.backgroundColor = '';
      this.toggleFlashBtn.style.color = '';
    }
  }
}

// Inicialización Global
document.addEventListener('DOMContentLoaded', () => {
  // Verificar si la biblioteca Html5Qrcode está cargada
  if (typeof Html5Qrcode === 'undefined') {
    console.error('Html5Qrcode library not loaded!');
    return;
  }

  setTimeout(() => {
    try {
      window.qrScanner = new QRScanner();
      window.qrScannerModule = window.qrScanner; // Alias
      console.log('QR Scanner initialized successfully');
    } catch (error) {
      console.error('Failed to initialize QR Scanner:', error);
    }
  }, 500);
});
