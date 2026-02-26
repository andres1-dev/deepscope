/**
 * biometry.js - Gestión de Autenticación Biométrica (WebAuthn)
 */

const BIOMETRY = {
    // Verificar si el navegador y dispositivo soportan biometría
    async isSupported() {
        return window.PublicKeyCredential &&
            await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    },

    // Registrar nueva credencial biométrica
    async register() {
        try {
            if (!await this.isSupported()) {
                throw new Error("Su dispositivo no soporta biometría o no está configurada.");
            }

            const user = JSON.parse(localStorage.getItem('user'));
            if (!user) throw new Error("Debe estar autenticado para registrar biometría.");

            // Reto aleatorio
            const challenge = new Uint8Array(32);
            window.crypto.getRandomValues(challenge);

            // ID de usuario para WebAuthn
            const userId = new TextEncoder().encode(user.id);

            const publicKeyCredentialCreationOptions = {
                challenge: challenge,
                rp: {
                    name: CONFIG.APP_NAME,
                    id: window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname,
                },
                user: {
                    id: userId,
                    name: user.id,
                    displayName: user.nombre,
                },
                pubKeyCredParams: [{ alg: -7, type: "public-key" }, { alg: -257, type: "public-key" }],
                authenticatorSelection: {
                    authenticatorAttachment: "platform",
                    userVerification: "required",
                    residentKey: "preferred"
                },
                timeout: 60000,
                attestation: "none"
            };

            const credential = await navigator.credentials.create({
                publicKey: publicKeyCredentialCreationOptions
            });

            if (credential) {
                // Guardar el ID de la credencial localmente
                // En una app real, la llave pública se enviaría al servidor.
                // Aquí usamos el ID para permitir el login rápido asumiendo que el dispositivo ya validó al usuario.
                const credentialIdB64 = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
                localStorage.setItem('biometricId', credentialIdB64);
                localStorage.setItem('userIdForBiometrics', user.id);

                return { success: true, message: "Biometría configurada correctamente." };
            }
        } catch (error) {
            console.error("Biometric Registration Error:", error);
            return { success: false, message: error.message };
        }
    },

    // Eliminar credencial registrada
    remove() {
        localStorage.removeItem('biometricId');
        localStorage.removeItem('userIdForBiometrics');
    },

    // Verificar si ya está registrado
    isRegistered() {
        return !!localStorage.getItem('biometricId');
    },

    // Detectar el tipo probable de biometría (Heurística avanzada)
    getAuthenticatorType() {
        const ua = window.navigator.userAgent.toLowerCase();
        const platform = window.navigator.platform.toLowerCase();

        // 1. Detección de iOS (FaceID vs TouchID)
        if (/iphone|ipad|ipod/.test(ua)) {
            // Heurística para dispositivos con FaceID (sin botón de inicio)
            // Modelos notch/dynamic island tienen ratios de pantalla específicos
            const ratio = window.devicePixelRatio || 1;
            const screenW = window.screen.width * ratio;
            const screenH = window.screen.height * ratio;

            // iPhone X, XS, 11, 12, 13, 14, 15 Pro Max etc (No home button)
            const isTall = (screenH / screenW > 2);
            return isTall ? 'faceid' : 'touchid';
        }

        // 2. Android (Casi siempre huella o reconocimiento facial estándar)
        if (/android/.test(ua)) {
            return 'fingerprint';
        }

        // 3. Desktop o Genérico
        if (/mac|win|linux/.test(platform)) {
            return 'key'; // Windows Hello / TouchBar Mac
        }

        return 'generic';
    },

    // Obtener el SVG correspondiente al tipo (Nivel Profesional)
    getSVGForType() {
        const type = this.getAuthenticatorType();
        const icons = {
            faceid: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-right:10px;"><path d="M7 3H5C3.89543 3 3 3.89543 3 5V7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M17 3H19C20.1046 3 21 3.89543 21 5V7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M21 17V19C21 20.1046 20.1046 21 19 21H17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M3 17V19C3 20.1046 3.89543 21 5 21H7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M9 10V11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M15 10V11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M12 11V14H14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
            fingerprint: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-right:10px;"><path d="M12 11C12 11 12.5 10 14 10C15.5 10 17 11.5 17 13.5V17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M9 13V13.5C9 15.433 10.567 17 12.5 17C14.433 17 16 15.433 16 13.5V11C16 8.79086 14.2091 7 12 7C9.79086 7 8 8.79086 8 11V17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M5 11C5 7.13401 8.13401 4 12 4C15.866 4 19 7.13401 19 11V17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M12 20C10.3431 20 9 18.6569 9 17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
            key: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-right:10px;"><path d="M21 2L11 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="7.5" cy="15.5" r="5.5" stroke="currentColor" stroke-width="2"/><path d="M15.5 7.5L18.5 10.5L22 7L19 4L15.5 7.5Z" fill="currentColor"/></svg>`,
            generic: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-right:10px;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" stroke-width="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" stroke-width="2"/></svg>`
        };
        return icons[type] || icons.generic;
    },

    // Mantener etiquetas legibles
    getLabelForType() {
        const type = this.getAuthenticatorType();
        switch (type) {
            case 'faceid': return 'FaceID';
            case 'touchid': return 'TouchID';
            case 'fingerprint': return 'Huella Digital';
            case 'key': return 'PIN / Llave';
            default: return 'Biometría';
        }
    }
};

window.BIOMETRY = BIOMETRY;
