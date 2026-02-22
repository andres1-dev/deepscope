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
    }
};

window.BIOMETRY = BIOMETRY;
