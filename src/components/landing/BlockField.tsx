import { useEffect, useRef } from "react";

interface BlockFieldProps {
  className?: string;
  style?: React.CSSProperties;
}

/* ─────────────────────────────────────────────────────────────────────────────
   BlockField — Campo holográfico de cubos 3D com logos de marcas

   Perspectiva oblíqua (como a imagem de referência): os cubos são vistos
   levemente de cima e de frente, não em isometria pura. Isso cria a sensação
   de profundidade dramática com logos visíveis na face frontal.

   Cada cubo tem:
   - Face frontal: logo/iniciais da marca em destaque com neon glow
   - Face superior: gradiente iluminado
   - Face lateral: info secundária (domínio/handle)
   - Partículas de energia orbitando os cubos ativos
   - Altura Z variável e animação de respiração/flutuação
───────────────────────────────────────────────────────────────────────────── */

// Logos / letras de marcas simuladas
const BRANDS = [
  { letter: "G", color: "#4285F4", glow: "#4285F4" },
  { letter: "X", color: "#ffffff", glow: "#e2e8f0" },
  { letter: "A", color: "#FF9900", glow: "#FFAA00" },
  { letter: "◆", color: "#F0B90B", glow: "#F0C030" },  // Binance-style
  { letter: "N", color: "#E50914", glow: "#FF2020" },
  { letter: "D", color: "#FF6600", glow: "#FF8800" },
  { letter: "⚡", color: "#00D4FF", glow: "#00FFFF" },
  { letter: "M", color: "#7C3AED", glow: "#A855F7" },
  { letter: "●", color: "#00C896", glow: "#00FFB8" },
  { letter: "S", color: "#1DB954", glow: "#1DB954" },
  { letter: "T", color: "#26A5E4", glow: "#26A5E4" },
  { letter: "Y", color: "#FF0000", glow: "#FF3333" },
  { letter: "R", color: "#FF4500", glow: "#FF6633" },
  { letter: "P", color: "#E60023", glow: "#FF1744" },
  { letter: "◉", color: "#6366F1", glow: "#818CF8" },
];

// Paletas de cubo com cor dominante neon
const CUBE_PALETTES = [
  { edge: "#a855f7", top: "#7c3aed", side: "#4c1d95", glow: "#c084fc", bg: "#1a0533" },   // violeta
  { edge: "#10b981", top: "#065f46", side: "#064e3b", glow: "#34d399", bg: "#002216" },   // esmeralda
  { edge: "#f0c14b", top: "#b45309", side: "#78350f", glow: "#fcd34d", bg: "#1a1000" },   // dourado
  { edge: "#06b6d4", top: "#0e7490", side: "#164e63", glow: "#67e8f9", bg: "#001a20" },   // ciano
  { edge: "#c026d3", top: "#7e22ce", side: "#4a044e", glow: "#e879f9", bg: "#1a0020" },   // magenta
];

type Particle = {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  color: string; size: number;
  alpha: number;
};

type Cube = {
  // posição em grade
  col: number; row: number;
  // posição em canvas (calculada no build)
  cx: number; cy: number;
  // visual
  pal: typeof CUBE_PALETTES[0];
  brand: typeof BRANDS[0];
  // animação
  phase: number;          // fase de respiração
  heightPhase: number;    // fase de flutuação Z
  baseZ: number;          // altura Z base em px
  lit: boolean;
  // efeito ao longo do tempo
  spawnTime: number;
  flickerPhase: number;
};

export function BlockField({ className, style }: BlockFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const pointerRef = useRef({ x: 0.5, y: 0.5 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let cubes: Cube[] = [];
    let particles: Particle[] = [];
    let dpr = 1;
    let W = 0, H = 0;

    // ── Parâmetros de perspectiva oblíqua ─────────────────────────────────
    // Os cubos são vistos ~30° de cima, inclinados ~45° lateralmente
    // Fator de projeção oblíqua: face lateral aparece na diagonal
    const OBL_X = 0.5;   // deslocamento X por unidade de profundidade
    const OBL_Y = -0.35; // deslocamento Y por unidade de profundidade (sobe)

    // ── Tamanho dos cubos ─────────────────────────────────────────────────
    // Dinâmico: adapta ao tamanho da tela, cubos grandes e imponentes
    const getCubeSize = () => Math.max(70, Math.min(110, Math.floor(W / dpr / 10)));

    // ── Build / Resize ────────────────────────────────────────────────────
    const build = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.max(1, Math.round(rect.width * dpr));
      H = Math.max(1, Math.round(rect.height * dpr));
      canvas.width = W;
      canvas.height = H;

      const S = getCubeSize();
      const GAP = S * 1.55; // espaçamento generoso entre cubos

      // Grid de cubos em perspectiva oblíqua
      // Origem: canto superior esquerdo com offset para centrar visualmente
      const COLS = Math.ceil(rect.width / GAP) + 2;
      const ROWS = Math.ceil(rect.height / (GAP * 0.6)) + 2;

      const startX = -GAP * 0.5;
      const startY = -GAP * 0.2;

      cubes = [];
      const now = performance.now();

      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
          const cx = startX + col * GAP + (row % 2 === 1 ? GAP * 0.5 : 0);
          const cy = startY + row * GAP * 0.55;

          const lit = Math.random() < 0.55; // ~55% dos cubos ativos

          cubes.push({
            col, row, cx, cy,
            pal: CUBE_PALETTES[Math.floor(Math.random() * CUBE_PALETTES.length)],
            brand: BRANDS[Math.floor(Math.random() * BRANDS.length)],
            phase: Math.random() * Math.PI * 2,
            heightPhase: Math.random() * Math.PI * 2,
            baseZ: lit ? S * (0.5 + Math.random() * 0.7) : S * 0.15,
            lit,
            spawnTime: now - Math.random() * 3000,
            flickerPhase: Math.random() * Math.PI * 2,
          });
        }
      }

      // Partículas iniciais
      if (particles.length === 0) {
        for (let i = 0; i < 80; i++) {
          particles.push(spawnParticle(Math.random() * rect.width, Math.random() * rect.height));
        }
      }
    };

    const spawnParticle = (x: number, y: number, color?: string): Particle => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.4 + Math.random() * 1.2;
      const pal = CUBE_PALETTES[Math.floor(Math.random() * CUBE_PALETTES.length)];
      return {
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.3,
        life: 0,
        maxLife: 60 + Math.random() * 100,
        color: color ?? pal.glow,
        size: 0.7 + Math.random() * 2.5,
        alpha: 0,
      };
    };

    // ── Utilitário de glow ────────────────────────────────────────────────
    const setGlow = (color: string, blur: number) => {
      ctx.shadowColor = color;
      ctx.shadowBlur = blur;
    };
    const clearGlow = () => { ctx.shadowBlur = 0; };

    // ── Desenho de um cubo em perspectiva oblíqua ─────────────────────────
    const drawCube = (
      cube: Cube,
      S: number,
      zH: number,       // altura Z em pixels (face de cima)
      alpha: number,    // opacidade geral
      glowStr: number,  // intensidade do glow (0–1)
      t: number
    ) => {
      const { cx, cy, pal, brand, phase, flickerPhase } = cube;

      const radius = (S * 0.55) + (zH * 0.15); 
      const centerX = cx + S / 2;
      const centerY = cy; // usar cy como centro para a bolha bater melhor com o grid e flutuação

      const breatheAlpha = reduced ? 1 : 0.75 + 0.25 * Math.sin(t * 0.9 + phase);
      const faceAlpha = Math.min(1, alpha * breatheAlpha);

      ctx.globalAlpha = faceAlpha;

      // Glow da bolha
      if (glowStr > 0.2) {
        setGlow(pal.glow, 20 * glowStr);
      }

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fillStyle = pal.bg + "ee"; 
      ctx.fill();

      // Borda neon
      ctx.strokeStyle = pal.edge;
      ctx.lineWidth = glowStr > 0.4 ? 1.5 : 1;
      if (glowStr > 0.3) setGlow(pal.glow, 12 * glowStr);
      ctx.stroke();
      clearGlow();

      // Reflexo interno 3D suave (glass)
      ctx.globalAlpha = Math.min(1, faceAlpha * 0.85);
      const gradInside = ctx.createLinearGradient(centerX, centerY - radius, centerX, centerY + radius);
      gradInside.addColorStop(0, pal.top + "aa");
      gradInside.addColorStop(0.4, "transparent");
      gradInside.addColorStop(1, "#000000bb");
      ctx.fillStyle = gradInside;
      ctx.fill();

      // Bloom aditivo extra no centro
      if (glowStr > 0.5 && !reduced) {
        ctx.globalAlpha = Math.min(0.3, glowStr * 0.4);
        const radGlow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
        radGlow.addColorStop(0, pal.glow + "90");
        radGlow.addColorStop(1, "transparent");
        ctx.fillStyle = radGlow;
        ctx.fill();
      }

      // ── Logo / Letra da marca ─────────────────────────
      if (cube.lit && radius > 10) {
        const flicker = reduced ? 1 : 0.85 + 0.15 * Math.sin(t * 4.1 + flickerPhase);
        const logoAlpha = Math.min(1, faceAlpha * flicker * 0.95);

        ctx.globalAlpha = logoAlpha;

        const logoSize = radius * 1.1;
        
        // Fundo circular do ícone
        ctx.fillStyle = brand.color + "1a";
        ctx.beginPath();
        ctx.arc(centerX, centerY, logoSize / 2, 0, Math.PI * 2);
        ctx.fill();

        // Letra/ícone principal
        const fontSize = Math.max(14, radius * 0.8);
        ctx.font = `900 ${fontSize}px "Space Grotesk", "Inter", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = brand.color;
        setGlow(brand.glow, 15 * Math.max(0.5, glowStr));
        ctx.fillText(brand.letter, centerX, centerY);

        // Segundo passe: brilho extra
        ctx.globalAlpha = logoAlpha * 0.5;
        setGlow(brand.glow, 35 * Math.max(0.4, glowStr));
        ctx.fillText(brand.letter, centerX, centerY);
        clearGlow();
      }

      ctx.globalAlpha = 1;
    };

    // ── Loop de renderização ──────────────────────────────────────────────
    const draw = (time: number) => {
      const rect = canvas.getBoundingClientRect();
      const rw = rect.width;
      const rh = rect.height;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, rw, rh);

      const t = reduced ? 0 : time / 1000;
      const S = getCubeSize();

      // Posição do ponteiro em coordenadas de canvas
      const px = pointerRef.current.x * rw;
      const py = pointerRef.current.y * rh;

      // ── Ordenar cubos: mais distantes primeiro (painter's algorithm) ──
      // Em perspectiva oblíqua: row crescente = mais próximo; col crescente = mais próximo
      const sorted = [...cubes].sort((a, b) => (a.row + a.col) - (b.row + b.col));

      // ── Desenhar cubos ────────────────────────────────────────────────
      for (const cube of sorted) {
        const { cx, cy } = cube;

        // Cull: skip se totalmente fora da tela
        const margin = S * 2;
        if (cx < -margin || cx > rw + margin || cy < -margin || cy > rh + margin * 2) continue;

        // Distância ao cursor
        const cubeCenter = { x: cx + S / 2, y: cy - cube.baseZ / 2 };
        const dist = Math.hypot(cubeCenter.x - px, cubeCenter.y - py);
        const proximity = Math.max(0, 1 - dist / (rw * 0.32));

        if (cube.lit) {
          // Altura Z animada: flutua suavemente
          const floatAnim = reduced ? 1 : 0.65 + 0.35 * Math.sin(t * 0.75 + cube.heightPhase);
          const hoverBoost = proximity * S * 0.3;
          const zH = (cube.baseZ + hoverBoost) * floatAnim;

          const breathe = reduced ? 0.8 : 0.6 + 0.4 * Math.sin(t * 0.85 + cube.phase);
          const baseAlpha = 0.55 + breathe * 0.45;
          const finalAlpha = Math.min(1, baseAlpha + proximity * 0.3);
          const glowStr = 0.3 + proximity * 0.7 + breathe * 0.2;

          drawCube(cube, S, zH, finalAlpha, glowStr, t);

          // Spawn de partículas perto do cursor
          if (!reduced && proximity > 0.2 && Math.random() < 0.15) {
            const spawnX = cx + Math.random() * S;
            const spawnY = cy - Math.random() * cube.baseZ;
            particles.push(spawnParticle(spawnX, spawnY, cube.pal.glow));
          }

        } else {
          // Cubo apagado: contorno quase invisível para manter textura de espaço
          const dimZ = S * 0.12 + proximity * S * 0.1;
          const dimAlpha = 0.06 + proximity * 0.08;
          const dimPal = { bg: "#050508", top: "#0a0a14", side: "#060609", edge: "#1a1a30", glow: "#222244" };
          const dimCube = { ...cube, pal: dimPal, brand: cube.brand, lit: false };
          drawCube(dimCube, S, dimZ, dimAlpha, 0, t);
        }
      }

      // ── Partículas de energia ─────────────────────────────────────────
      if (!reduced) {
        // Partículas globais aleatórias
        if (particles.length < 150 && Math.random() < 0.4) {
          particles.push(spawnParticle(Math.random() * rw, Math.random() * rh));
        }

        ctx.save();
        particles = particles.filter(p => p.life < p.maxLife);

        for (const p of particles) {
          p.x += p.vx;
          p.y += p.vy;
          p.vy -= 0.012; // flutuação para cima
          p.life++;

          const ratio = p.life / p.maxLife;
          const a = ratio < 0.15 ? ratio / 0.15 : ratio > 0.75 ? (1 - ratio) / 0.25 : 1;
          const size = p.size * (1 - ratio * 0.4);

          ctx.globalAlpha = a * 0.9;
          ctx.fillStyle = p.color;
          setGlow(p.color, size * 6);
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0.3, size), 0, Math.PI * 2);
          ctx.fill();
        }

        clearGlow();
        ctx.restore();

        // Limita buffer de partículas
        if (particles.length > 250) particles = particles.slice(-250);
      }

      ctx.globalAlpha = 1;
      clearGlow();
      rafRef.current = requestAnimationFrame(draw);
    };

    // ── Event listeners ───────────────────────────────────────────────────
    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointerRef.current = {
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
      };
    };

    const ro = new ResizeObserver(() => {
      particles = [];
      build();
    });

    build();
    rafRef.current = requestAnimationFrame(draw);
    ro.observe(canvas);
    window.addEventListener("pointermove", onPointerMove, { passive: true });

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-hidden="true"
      style={{ display: "block", width: "100%", height: "100%", ...style }}
    />
  );
}

export default BlockField;
