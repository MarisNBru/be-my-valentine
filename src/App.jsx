import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { jsPDF } from "jspdf";

const Heart = ({ className = "", filled = true, style }) => (
  <svg
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={style}
    aria-hidden
  >
    <path
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.5"
      d="M11.993 21s-8.243-5.28-9.74-10.15C1.33 7.31 3.27 4.5 6.11 4.5c1.84 0 3.21 1.04 3.97 2.33.76-1.29 2.13-2.33 3.97-2.33 2.84 0 4.78 2.81 3.86 6.35C20.235 15.72 11.993 21 11.993 21Z"
    />
  </svg>
);

function useFloatingHearts(count = 28) {
  return useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        size: 12 + Math.random() * 20,
        delay: Math.random() * 5,
        duration: 10 + Math.random() * 12,
        opacity: 0.15 + Math.random() * 0.25,
        rotate: (Math.random() * 40 - 20).toFixed(2),
      })),
    [count]
  );
}

export default function ValentinesAsk() {
  const containerRef = useRef(null);
  const playRef = useRef(null);
  const yesRef = useRef(null);
  const [yesScale, setYesScale] = useState(1);
  const [target, setTarget] = useState(null);
  const [remaining, setRemaining] = useState(null);
  const [trail, setTrail] = useState([]);
  const lastTrailRef = useRef(0);
  const [name, setName] = useState("Aleida Pérez Méndez");
  const [question, setQuestion] = useState("¿Quieres ser mi cita en San Valentín?");
  const [accepted, setAccepted] = useState(false);
  const [noPos, setNoPos] = useState({ x: 0, y: 0 });
  const [noRuns, setNoRuns] = useState(0);
  const [ticketImg, setTicketImg] = useState(null);
  const DEFAULT_TICKET_IMAGE = new URL('ticket.jpg', document.baseURI).toString();
  const GMT6_MS = 6 * 60 * 60 * 1000;
  const [heartCount, setHeartCount] = useState(30);
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      setHeartCount(w >= 1280 ? 50 : w >= 1024 ? 40 : 30);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const hearts = useFloatingHearts(heartCount);

  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const src = sp.get("img") || DEFAULT_TICKET_IMAGE;
      if (src) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => setTicketImg(img);
        img.onerror = () => console.warn("ticket image failed to load", src);
        img.src = src;
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const n = sp.get("name");
      const q = sp.get("question") || sp.get("q");
      const d = sp.get("date");
      if (n) setName(n);
      if (q) setQuestion(q);
      if (d) {
        const td = new Date(d);
        if (!isNaN(td.getTime())) setTarget(td);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!target) setTarget(nextValentines());
  }, []);

  useEffect(() => {
    if (!target) return;
    const tick = () => {
      const diff = target - new Date();
      if (diff <= 0) {
        setRemaining({ d: 0, h: 0, m: 0, s: 0, done: true });
        return;
      }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining({ d, h, m, s, done: false });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);

  function nextValentines() {
    const now = new Date();
    const y = now.getUTCFullYear();
    let d = new Date(Date.UTC(y, 1, 14, 19 + 6, 0, 0));
    if (d < now) d = new Date(Date.UTC(y + 1, 1, 14, 19 + 6, 0, 0));
    return d;
  }

  const pad2 = (n) => String(n).padStart(2, "0");

  function toLocalInputValue(date) {
    const t = new Date(date.getTime() - GMT6_MS);
    const y = t.getUTCFullYear();
    const m = pad2(t.getUTCMonth() + 1);
    const d = pad2(t.getUTCDate());
    const hh = pad2(t.getUTCHours());
    const mm = pad2(t.getUTCMinutes());
    return `${y}-${m}-${d}T${hh}:${mm}`;
  }

  function fromLocalInputValue(v) {
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
    if (!m) return null;
    const y = +m[1];
    const mo = +m[2];
    const dd = +m[3];
    const hh = +m[4];
    const mm = +m[5];
    return new Date(Date.UTC(y, mo - 1, dd, hh + 6, mm));
  }

  useEffect(() => {
    moveNoButton();
    confetti({ particleCount: 40, spread: 70, origin: { y: 0.6 } });
  }, []);

  useEffect(() => {
    try {
      const now = new Date();
      const round = fromLocalInputValue(toLocalInputValue(now));
      if (round) {
        console.assert(Math.abs(round.getTime() - now.getTime()) < 60000, "Roundtrip failed");
      }
      const nv = nextValentines();
      console.assert(nv instanceof Date && nv.getTime() > now.getTime(), "nextValentines invalid");
      const cnv = createTicketCanvas(ticketImg);
      console.assert(cnv && cnv.width === 1200 && cnv.height === 600, "ticket canvas size");
      try {
        const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
        const dataUrl = cnv.toDataURL('image/png');
        doc.addImage(dataUrl, 'PNG', 10, 10, 100, 50);
      } catch (e) {
        console.warn('PDF test skipped/failed', e);
      }
    } catch {}
  }, []);

  function moveNoButton() {
    const wrap = playRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const padding = 12;
    const btnW = 110;
    const btnH = 48;
    const maxX = Math.max(0, rect.width - btnW - padding);
    const maxY = Math.max(0, rect.height - btnH - padding);
    const nx = padding + Math.random() * maxX;
    const ny = padding + Math.random() * maxY;
    setNoPos({ x: nx, y: ny });
  }

  function fireCelebration() {
    const end = Date.now() + 800;
    const colors = ["#ff90b5", "#ff4d6d", "#ffd6e8", "#ff8fab", "#ffc2d1"];
    (function frame() {
      confetti({
        particleCount: 8,
        angle: 60,
        spread: 65,
        startVelocity: 35,
        origin: { x: 0, y: 0.8 },
        colors,
      });
      confetti({
        particleCount: 8,
        angle: 120,
        spread: 65,
        startVelocity: 35,
        origin: { x: 1, y: 0.8 },
        colors,
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    })();
  }

  function handlePointerMove(e) {
    const el = yesRef.current;
    if (!el) return;
    const { clientX: x, clientY: y } = e;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dist = Math.hypot(x - cx, y - cy);
    const maxScale = 1.6;
    const minScale = 1;
    const threshold = 260;
    const t = Math.min(1, Math.max(0, dist / threshold));
    const s = maxScale - (maxScale - minScale) * t;
    setYesScale(parseFloat(s.toFixed(3)));
    const area = playRef.current;
    if (area) {
      const areaRect = area.getBoundingClientRect();
      const xRel = x - areaRect.left;
      const yRel = y - areaRect.top;
      const now = Date.now();
      if (now - lastTrailRef.current > 45) {
        lastTrailRef.current = now;
        const id = now + Math.random();
        setTrail((arr) => {
          const next = [...arr.slice(-30), { id, x: xRel, y: yRel, rot: (Math.random() * 60 - 30).toFixed(1) }];
          return next;
        });
      }
    }
  }

  const yesBase = Math.min(1 + noRuns * 0.06, 1.8);
  const noScale = Math.max(0.5, 1 - noRuns * 0.06);

  function formatDateGmt6(d) {
    const t = new Date(d.getTime() - GMT6_MS);
    const months = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
    const day = t.getUTCDate();
    const mon = months[t.getUTCMonth()];
    const year = t.getUTCFullYear();
    const hh = String(t.getUTCHours()).padStart(2, '0');
    const mm = String(t.getUTCMinutes()).padStart(2, '0');
    return `${day} ${mon} ${year}, ${hh}:${mm} GMT-6`;
  }

  function createTicketCanvas(img) {
    const w = 1200, h = 600;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d'); if (!ctx) return null;

    function rrect(x, y, ww, hh, r) {
      const rr = Math.min(r, ww/2, hh/2);
      ctx.beginPath();
      ctx.moveTo(x + rr, y);
      ctx.arcTo(x + ww, y, x + ww, y + hh, rr);
      ctx.arcTo(x + ww, y + hh, x, y + hh, rr);
      ctx.arcTo(x, y + hh, x, y, rr);
      ctx.arcTo(x, y, x + ww, y, rr);
      ctx.closePath();
    }

    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#ffd7c7');
    bg.addColorStop(1, '#ffb3c1');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.shadowColor = 'rgba(255,77,109,0.25)';
    ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
    rrect(32, 32, w - 64, h - 64, 24);
    ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fill();
    ctx.restore();

    ctx.strokeStyle = '#ff7aa5'; ctx.lineWidth = 3;
    rrect(48, 48, w - 96, h - 96, 18); ctx.stroke();

    const midX = w / 2;
    ctx.setLineDash([6, 12]); ctx.strokeStyle = 'rgba(255,122,165,0.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(midX, 88); ctx.lineTo(midX, h - 88); ctx.stroke(); ctx.setLineDash([]);

    const ribbonX = 72, ribbonW = w - 144, ribbonY = 84, ribbonH = 64;
    const ribbonGrad = ctx.createLinearGradient(ribbonX, ribbonY, ribbonX + ribbonW, ribbonY + ribbonH);
    ribbonGrad.addColorStop(0, '#ff5c7a'); ribbonGrad.addColorStop(1, '#ff3b6a');
    ctx.fillStyle = ribbonGrad; rrect(ribbonX, ribbonY, ribbonW, ribbonH, 16); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '700 38px sans-serif';
    ctx.fillText('Pase de Cita — San Valentín', w / 2, ribbonY + ribbonH / 2);

    const leftX = 92, rightX = midX + 32;
    let yy = 208;
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#222';
    ctx.font = '700 36px sans-serif'; ctx.fillText('Para: ' + name, leftX, yy);
    yy += 26; ctx.font = '26px sans-serif';
    const wrap = function(text, x, y0, maxW, lineH){ var words = String(text).split(' '); var line = ''; var yLocal = y0; for (var i=0;i<words.length;i++){ var test = line ? line + ' ' + words[i] : words[i]; if (ctx.measureText(test).width > maxW && line){ ctx.fillText(line, x, yLocal); line = words[i]; yLocal += lineH; } else { line = test; } } if (line) ctx.fillText(line, x, yLocal); return yLocal; };
    yy = wrap(question, leftX, yy + 26, midX - 128, 32) + 20;
    ctx.font = '30px sans-serif';
    ctx.fillText('Fecha: ' + (target ? formatDateGmt6(target) : 'por confirmar'), leftX, yy + 34);
    ctx.fillText('Lugar: Monterrey', leftX, yy + 70);

    const photoX = rightX + 8, photoY = 188, photoW = w - photoX - 72, photoH = 320, rad = 22;
    ctx.save(); rrect(photoX, photoY, photoW, photoH, rad); ctx.clip();
    ctx.fillStyle = '#fbe0e6'; ctx.fillRect(photoX, photoY, photoW, photoH);

    if (img && img.width && img.height) {
      const scale = Math.max(photoW / img.width, photoH / img.height);
      const dw = img.width * scale, dh = img.height * scale;
      const dx = photoX + (photoW - dw) / 2; const dy = photoY + (photoH - dh) / 2;
      ctx.drawImage(img, dx, dy, dw, dh);
    } else {
      ctx.fillStyle = '#ff8fab';
      for (let i=0;i<16;i++){ const sx = photoX + 16 + Math.random()*(photoW-32); const sy = photoY + 16 + Math.random()*(photoH-32); ctx.beginPath(); const r=9+Math.random()*14; ctx.moveTo(sx, sy); ctx.bezierCurveTo(sx-r, sy-r, sx-2*r, sy+r/2, sx, sy+2*r); ctx.bezierCurveTo(sx+2*r, sy+r/2, sx+r, sy-r, sx, sy); ctx.fill(); }
    }
    ctx.restore();
    ctx.strokeStyle = '#ff9bb0'; ctx.lineWidth = 3; rrect(photoX, photoY, photoW, photoH, rad); ctx.stroke();

    ctx.globalAlpha = 0.09; ctx.fillStyle = '#ff4d6d';
    for (let i=0;i<24;i++){ const hx = 72 + Math.random()*(w-144); const hy = 148 + Math.random()*(h-236); ctx.beginPath(); const r=8+Math.random()*14; ctx.moveTo(hx, hy); ctx.bezierCurveTo(hx-r, hy-r, hx-2*r, hy+r/2, hx, hy+2*r); ctx.bezierCurveTo(hx+2*r, hy+r/2, hx+r, hy-r, hx, hy); ctx.fill(); }
    ctx.globalAlpha = 1;

    const code = Math.random().toString(36).slice(2,8).toUpperCase();
    const pillX = rightX + 34, pillY = photoY + photoH + 18, pillW = w - pillX - 68, pillH = 56;
    ctx.fillStyle = '#ffe2ea'; rrect(pillX, pillY, pillW, pillH, 14); ctx.fill();
    ctx.font = '700 24px monospace'; ctx.fillStyle = '#ff4d6d'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Código: ' + code, pillX + pillW / 2, pillY + pillH / 2);

    return canvas;
  }

  function downloadDateTicket() {
    const canvas = createTicketCanvas(ticketImg);
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url; a.download = 'date-ticket.png';
    document.body.appendChild(a); a.click(); a.remove();
  }

  function downloadDateTicketPdf() {
    const canvas = createTicketCanvas(ticketImg);
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 36;
    const maxW = pageW - margin * 2;
    const maxH = pageH - margin * 2;
    const scale = Math.min(maxW / canvas.width, maxH / canvas.height);
    const renderW = canvas.width * scale;
    const renderH = canvas.height * scale;
    const x = (pageW - renderW) / 2;
    const y = (pageH - renderH) / 2;
    doc.addImage(dataUrl, 'PNG', x, y, renderW, renderH);
    doc.save('date-ticket.pdf');
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-rose-100 via-pink-50 to-rose-200">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-rose-300/40 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-pink-300/40 blur-3xl" />
      </div>

      <div aria-hidden className="pointer-events-none absolute inset-0">
        {hearts.map((h) => (
          <motion.div
            key={h.id}
            initial={{ y: "100vh", x: `${h.x}vw`, rotate: 0, opacity: 0 }}
            animate={{
              y: "-10vh",
              x: [`${h.x}vw`, `${(h.x + 5 - Math.random() * 10).toFixed(2)}vw`],
              rotate: [0, parseFloat(h.rotate)],
              opacity: h.opacity,
            }}
            transition={{
              duration: h.duration,
              delay: h.delay,
              repeat: Infinity,
              ease: "easeOut",
            }}
            className="absolute"
          >
            <Heart className="text-rose-400/70" style={{ width: h.size, height: h.size }} />
          </motion.div>
        ))}
      </div>

      <div className="relative z-10 flex items-center justify-center p-4">
        <div
          ref={containerRef}
          className="relative mx-auto mt-16 md:mt-20 w-full max-w-5xl overflow-hidden rounded-3xl bg-white/70 p-6 sm:p-8 lg:p-12 shadow-2xl backdrop-blur-md ring-1 ring-white/60"
        >
          <div className="mb-8 flex items-center justify-center gap-3">
            <Heart className="h-7 w-7 text-rose-500" />
            <h1 className="text-center text-3xl font-extrabold leading-tight text-rose-700 sm:text-4xl md:text-5xl lg:text-6xl">
              Hola mi amor, 
              <br className="hidden sm:block" /> {question}
            </h1>
            <Heart className="h-7 w-7 text-rose-500" />
          </div>

          {target && remaining && !remaining.done && (
            <p className="mb-4 text-center text-sm text-rose-600">
              Faltan <span className="font-semibold">{remaining.d}</span> días {pad2(remaining.h)}:{pad2(remaining.m)}:{pad2(remaining.s)} para nuestra cita 💘
            </p>
          )}

          <div
            ref={playRef}
            onMouseMove={handlePointerMove}
            onPointerMove={handlePointerMove}
            onMouseLeave={() => setYesScale(1)}
            onPointerLeave={() => setYesScale(1)}
            className="relative mx-auto grid h-[320px] sm:h-[380px] md:h-[440px] lg:h-[520px] xl:h-[580px] w-full place-items-center rounded-2xl bg-white/60 ring-1 ring-rose-100 backdrop-blur-sm"
          >
            <motion.button
              ref={yesRef}
              onClick={() => {
                setAccepted(true);
                fireCelebration();
              }}
              animate={{ scale: yesScale * yesBase }}
              transition={{ type: "spring", stiffness: 200, damping: 18 }}
              whileTap={{ scale: 0.98 }}
              className="z-10 rounded-full bg-rose-500 px-8 py-4 text-lg md:px-10 md:py-5 md:text-xl lg:px-12 lg:py-6 lg:text-2xl font-semibold text-white shadow-lg transition hover:bg-rose-600 focus:outline-none focus:ring-4 focus:ring-rose-300"
            >
              SÍ
            </motion.button>

            <motion.button
              onMouseEnter={() => {
                moveNoButton();
                setNoRuns((c) => c + 1);
              }}
              onPointerDown={() => {
                moveNoButton();
                setNoRuns((c) => c + 1);
              }}
              onMouseMove={() => { if (noRuns >= 4) { moveNoButton(); setNoRuns((c)=>c+1);} }}
              aria-label="No"
              className="absolute left-0 top-0 rounded-full border border-rose-300 bg-white/80 px-5 py-3 md:px-6 md:py-3.5 text-rose-500 shadow-md backdrop-blur-md"
              animate={{ x: noPos.x, y: noPos.y, scale: noScale, rotate: noRuns % 2 ? 3 : -3 }}
              transition={{ type: "spring", stiffness: 120, damping: 12 }}
            >
              no :(
            </motion.button>

            <div className="pointer-events-none absolute inset-0">
              {trail.map((h) => (
                <motion.div
                  key={h.id}
                  initial={{ opacity: 0.9, scale: 0.6, x: h.x, y: h.y, rotate: 0 }}
                  animate={{ opacity: 0, scale: 1, y: h.y - 20, rotate: parseFloat(h.rot) }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="absolute"
                >
                  <Heart className="h-4 w-4 text-rose-400/80" />
                </motion.div>
              ))}
            </div>
          </div>

          <p className="mt-2 text-center text-xs text-rose-400">
            {noRuns < 2 ? "psst… el botón de \"no\" es tímido" : "jeje, ¡te pillé!"}
          </p>
        </div>
      </div>

      <AnimatePresence>
        {accepted && (
          <motion.div
            className="fixed inset-0 z-50 grid place-items-center bg-white/80 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 120, damping: 14 }}
              className="mx-4 w-full max-w-lg lg:max-w-xl xl:max-w-2xl rounded-3xl bg-gradient-to-br from-rose-50 to-pink-50 p-8 text-center shadow-2xl ring-1 ring-white/60"
            >
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-500 text-white shadow-lg">
                <Heart className="h-8 w-8" />
              </div>
              <h2 className="mb-2 text-3xl font-extrabold text-rose-700">Wooohoooo! 💞</h2>
              <p className="mb-6 text-rose-600">Babbbyy, ¡me hace mucha ilusión! ¡Nuestro San Valentín será mágico! ✨</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <button
                  onClick={downloadDateTicket}
                  className="rounded-2xl border border-rose-200 bg-white/80 px-5 py-3 font-semibold text-rose-600 shadow-sm transition hover:bg-white"
                >
                  Descargar Ticket 💌
                </button>
                <button
                  onClick={downloadDateTicketPdf}
                  className="rounded-2xl border border-rose-200 bg-white/80 px-5 py-3 font-semibold text-rose-600 shadow-sm transition hover:bg-white"
                >
                  Descargar PDF 📄
                </button>
                <button
                  onClick={() => setAccepted(false)}
                  className="rounded-2xl bg-rose-500 px-5 py-3 font-semibold text-white shadow-md transition hover:bg-rose-600"
                >
                  Ver otra vez
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        * { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
      `}</style>
    </div>
  );
}
