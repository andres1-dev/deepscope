# DeepScope 📦
### Professional QR Delivery System & Logistics Management

**DeepScope** is a high-performance, mobile-first Progressive Web App (PWA) designed for real-time delivery tracking and logistics management. Built with a "Zero-Friction" philosophy, it allows operators to manage deliveries, scan documents, and sync data seamlessly even in low-connectivity environments.

---

## 🛠 Tech Stack

- **Frontend**: Vanilla JavaScript (ES6+), Semantic HTML5, CSS3 with Glassmorphism.
- **Backend-as-a-Service**: Google Apps Script (GAS) leveraging Google Spreadsheets as a real-time database.
- **Persistence & Offline**: Service Workers, IndexedDB, and LocalStorage.
- **Security**: WebAuthn Biometrics (Fingerprint/FaceID), JWT-based session checks.
- **Reporting**: DataTables integration for high-performance grid rendering.
- **Core Libraries**:
  - `html5-qrcode` for professional-grade camera scanning.
  - `SheetJS (XLSX)` for local Excel/CSV processing.
  - `Flatpickr` for intuitive date management.

---

## 🚀 Key Features

### 1. Multi-Mode Scanner Engine
DeepScope adapts to your hardware, offering three distinct scanning workflows:
- **PDA / Laser Mode**: Optimized for industrial devices with hardware scanners. Includes persistent focus and high-speed processing.
- **Camera / QR Mode**: Uses the device's camera with advanced light and focus controls for mobile operators.
- **Manual Mode**: A sleek interface for manual data entry with predictive validation.

### 2. Intelligent Offline Queue (`upload_queue.js`)
Never lose data. If the app detects a connection drop:
- Entries are automatically diverted to an **IndexedDB** queue.
- Re-sync attempts are made automatically when back online.
- Manual retry control with collision detection.

### 3. Real-Time Analytics & KPIs
A comprehensive dashboard provides:
- **Dynamic Summaries**: Real-time calculation of "Delivered" vs "Pending" invoices.
- **Financial Insights**: Total value, unit counts, and optimized delivery percentages.
- **Infinite Scroll Desktop**: High-performance grid for viewing delivery proofs and photos.

### 4. Enterprise-Grade Security
- **Biometric Access**: Secure login using hardware-backed biometrics (Biometry API).
- **Client-Side Validation**: Dynamic NIT/Company mapping to prevent cross-client data entry errors.

### 5. Smart Notifications
- **Hybrid System**: Real-time Push Notifications via Service Workers (iOS/Android compatible) combined with Background Polling fallback.
- **Administrator Broadcasts**: Ability to notify all operators of system status or urgent updates.

---

## 📂 Architecture Overview

```text
├── css/                   # Modular Design System
│   ├── core/              # Base, Layout, and Design Tokens
│   └── modules/           # Module-specific styles (Scanner, Admin, Siesa)
├── js/
│   ├── core/              # Foundational logic (Database, Auth, Config)
│   ├── modules/           # Feature-specific controllers (Queue, Siesa, Grid)
│   └── ui/                # UI rendering and Interaction logic
├── sw.js                  # Advanced Service Worker (Caching + Notifications)
├── manifest.json          # PWA Configuration (Maskable Icons, Theming)
└── index.html             # High-performance SPA Entry Point
```

---

## 🔧 Installation & Deployment

1. **Clone the Repo**:
   ```bash
   git clone https://github.com/your-repo/deepscope.git
   ```
2. **Backend Setup**:
   - Deploy the provided `doPostGoogleAppScript.txt` code to a Google Apps Script project.
   - Link the script to a Google Spreadsheet.
3. **Configure**:
   - Update `API_URL_POST` and `API_URL_NOTIF` in `js/core/config.js` with your GAS Web App URL.
4. **Host**:
   - Deploy to any HTTPS-enabled static host (GitHub Pages, Vercel, Netlify).

---

## 📈 Final Impact
DeepScope transforms traditional logistics into a digitized, predictable workflow. It eliminates manual paperwork, reduces human error through automated validation, and provides 100% visibility over the delivery chain from any mobile device.

---
**Developed by Andrés Mendoza**
*© 2026 · Supported by GrupoTDM*
