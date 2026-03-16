(function () {
    const canvas = document.getElementById('particlesCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // ── Paleta dark permanente ────────────────────────────────────────────────
    const PALETTE = [
        { r: 96,  g: 165, b: 250 },  // azul
        { r: 52,  g: 211, b: 153 },  // verde
        { r: 167, g: 139, b: 250 },  // violeta
        { r: 251, g: 191, b: 36  },  // ámbar
        { r: 56,  g: 189, b: 248 },  // sky
        { r: 248, g: 113, b: 113 },  // rojo suave
    ];

    let W, H;
    function resize() {
        W = canvas.width  = window.innerWidth;
        H = canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', () => { resize(); init(); });

    const STAR_COUNT   = () => window.innerWidth < 768 ? 45 : 90;
    const CONNECT_DIST = () => window.innerWidth < 768 ? 110 : 160;
    const SPEED        = 0.18;
    const TWINKLE_SPD  = 0.018;

    // Grupos de constelación
    const CONSTELLATION_GROUPS = 3;

    let stars = [];
    let constellations = []; // array de arrays de índices

    function makeStar(isAnchor = false) {
        const c = PALETTE[Math.floor(Math.random() * PALETTE.length)];
        const giant = isAnchor || Math.random() < 0.1;
        return {
            x:     Math.random() * W,
            y:     Math.random() * H,
            vx:    (Math.random() - 0.5) * SPEED,
            vy:    (Math.random() - 0.5) * SPEED,
            r:     giant ? (Math.random() * 2 + 2) : (Math.random() * 1.2 + 0.4),
            giant,
            anchor: isAnchor,
            color: c,
            phase:  Math.random() * Math.PI * 2,
            speed:  TWINKLE_SPD * (0.5 + Math.random()),
            alphaBase: giant ? 0.75 : (Math.random() * 0.35 + 0.2),
            alphaAmp:  giant ? 0.25 : 0.15,
            group: -1, // asignado después
        };
    }

    function init() {
        const total = STAR_COUNT();
        stars = Array.from({ length: total }, () => makeStar());

        constellations = [];
        const groupSize = () => 4 + Math.floor(Math.random() * 4); // 4-7 estrellas

        for (let g = 0; g < CONSTELLATION_GROUPS; g++) {
            const cx = Math.random() * W;
            const cy = Math.random() * H;
            const spread = 60 + Math.random() * 90; // radio del grupo

            const group = [];
            const count = groupSize();

            for (let i = 0; i < count; i++) {
                const angle = (Math.PI * 2 / count) * i + Math.random() * 0.8;
                const dist  = spread * (0.3 + Math.random() * 0.7);
                const s = makeStar(i === 0);
                s.x = cx + Math.cos(angle) * dist;
                s.y = cy + Math.sin(angle) * dist;
                s.group = g;
                // Velocidad muy lenta para mantener la forma
                s.vx = (Math.random() - 0.5) * SPEED * 0.4;
                s.vy = (Math.random() - 0.5) * SPEED * 0.4;
                stars.push(s);
                group.push(stars.length - 1);
            }
            constellations.push(group);
        }
    }
    init();

    let frame = 0;

    function draw() {
        ctx.clearRect(0, 0, W, H);
        frame++;

        // Mover estrellas
        stars.forEach(s => {
            s.x += s.vx;
            s.y += s.vy;
            if (s.x < -10) s.x = W + 10;
            if (s.x > W + 10) s.x = -10;
            if (s.y < -10) s.y = H + 10;
            if (s.y > H + 10) s.y = -10;
            s.phase += s.speed;
        });

        // ── Líneas de constelación (fijas por grupo, más brillantes) ──────────
        constellations.forEach(group => {
            for (let i = 0; i < group.length; i++) {
                const a = stars[group[i]];
                // Conectar cada estrella con la siguiente y con la ancla (índice 0)
                const targets = [group[(i + 1) % group.length]];
                if (i > 1) targets.push(group[0]); // conexión a la ancla

                targets.forEach(ti => {
                    const b = stars[ti];
                    const dx = a.x - b.x, dy = a.y - b.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist > 280) return; // no conectar si se alejaron mucho

                    const twinkle = (Math.sin(a.phase) + Math.sin(b.phase)) * 0.25 + 0.5;
                    const lineAlpha = twinkle * 0.28;
                    const { r, g, b: bl } = a.color;

                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(b.x, b.y);
                    ctx.strokeStyle = `rgba(${r},${g},${bl},${lineAlpha})`;
                    ctx.lineWidth = 0.7;
                    ctx.stroke();
                });
            }
        });

        // ── Líneas de fondo entre estrellas cercanas (constelaciones difusas) ──
        const CONN = CONNECT_DIST();
        for (let i = 0; i < stars.length; i++) {
            const a = stars[i];
            for (let j = i + 1; j < stars.length; j++) {
                const b = stars[j];
                // No redibujar líneas de constelación ya trazadas
                if (a.group !== -1 && a.group === b.group) continue;

                const dx = a.x - b.x, dy = a.y - b.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > CONN) continue;

                const proximity = 1 - dist / CONN;
                const twinkle   = (Math.sin(a.phase) + Math.sin(b.phase)) * 0.25 + 0.5;
                const lineAlpha = proximity * twinkle * 0.14;

                const { r, g, b: bl } = a.color;
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.strokeStyle = `rgba(${r},${g},${bl},${lineAlpha})`;
                ctx.lineWidth = proximity * 0.8;
                ctx.stroke();
            }
        }

        // ── Estrellas ─────────────────────────────────────────────────────────
        stars.forEach(s => {
            const twinkle = Math.sin(s.phase);
            const alpha   = s.alphaBase + twinkle * s.alphaAmp;
            const radius  = s.r * (1 + twinkle * 0.25);
            const { r, g, b } = s.color;

            if (s.giant) {
                const halo = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, radius * 7);
                halo.addColorStop(0,   `rgba(${r},${g},${b},${alpha * 0.3})`);
                halo.addColorStop(0.5, `rgba(${r},${g},${b},${alpha * 0.1})`);
                halo.addColorStop(1,   `rgba(${r},${g},${b},0)`);
                ctx.beginPath();
                ctx.arc(s.x, s.y, radius * 7, 0, Math.PI * 2);
                ctx.fillStyle = halo;
                ctx.fill();

                const corona = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, radius * 3);
                corona.addColorStop(0,   `rgba(${r},${g},${b},${alpha * 0.8})`);
                corona.addColorStop(0.6, `rgba(${r},${g},${b},${alpha * 0.25})`);
                corona.addColorStop(1,   `rgba(${r},${g},${b},0)`);
                ctx.beginPath();
                ctx.arc(s.x, s.y, radius * 3, 0, Math.PI * 2);
                ctx.fillStyle = corona;
                ctx.fill();

                // Destellos en cruz
                ctx.save();
                ctx.globalAlpha = alpha * 0.5;
                ctx.strokeStyle = `rgba(${r},${g},${b},1)`;
                ctx.lineWidth = 0.6;
                const spike = radius * 5 * (1 + twinkle * 0.3);
                ctx.beginPath();
                ctx.moveTo(s.x - spike, s.y); ctx.lineTo(s.x + spike, s.y);
                ctx.moveTo(s.x, s.y - spike); ctx.lineTo(s.x, s.y + spike);
                ctx.stroke();
                ctx.restore();
            } else {
                const halo = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, radius * 4);
                halo.addColorStop(0,   `rgba(${r},${g},${b},${alpha * 0.5})`);
                halo.addColorStop(0.5, `rgba(${r},${g},${b},${alpha * 0.12})`);
                halo.addColorStop(1,   `rgba(${r},${g},${b},0)`);
                ctx.beginPath();
                ctx.arc(s.x, s.y, radius * 4, 0, Math.PI * 2);
                ctx.fillStyle = halo;
                ctx.fill();
            }

            ctx.beginPath();
            ctx.arc(s.x, s.y, radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${r},${g},${b},${Math.min(alpha * 1.3, 0.9)})`;
            ctx.fill();
        });

        requestAnimationFrame(draw);
    }

    draw();
})();
