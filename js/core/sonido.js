// Sonido generado en el navegador (Web Audio): ambientes en bucle y efectos de combate. Sin archivos ni licencias.
// El navegador solo deja sonar audio tras un clic o una pulsación del usuario; se activa en la primera.
export const AMBIENTES = { "": "Silencio", lluvia: "Lluvia", viento: "Viento", fuego: "Hoguera", mazmorra: "Mazmorra", bosque: "Bosque", taberna: "Taberna" };

let ctx = null, master = null, noiseBuf = null, amb = null, ambKey = "", want = "";
let vol = 0.6, muted = false;
try { vol = +(localStorage.getItem("lamesa:vol") ?? 0.6); muted = localStorage.getItem("lamesa:mute") === "1"; } catch (e) { /* sin almacenamiento */ }

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = muted ? 0 : vol; master.connect(ctx.destination);
    const len = ctx.sampleRate * 2; noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}
window.addEventListener("pointerdown", () => { if (want !== ambKey || ctx) { ac(); if (want !== ambKey) setAmb(want); } }, { capture: true });

const noise = () => { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.start(); return s; };
const filt = (type, f, q = 1) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
const gain = v => { const g = ctx.createGain(); g.gain.value = v; return g; };
const chain = (...n) => { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[n.length - 1]; };
function lfo(param, rate, depth, base) { const o = ctx.createOscillator(), g = gain(depth); o.frequency.value = rate; param.value = base; chain(o, g, param); o.start(); return o; }
function every(minMs, maxMs, fn) { let alive = true, h; const go = () => { if (!alive) return; fn(); h = setTimeout(go, minMs + Math.random() * (maxMs - minMs)); }; h = setTimeout(go, minMs); return () => { alive = false; clearTimeout(h); }; }
function blip(freq, dur, g0, type = "sine", dest = master, sweep) {
  const t = ctx.currentTime, o = ctx.createOscillator(), g = gain(0);
  o.type = type; o.frequency.setValueAtTime(freq, t); if (sweep) o.frequency.exponentialRampToValueAtTime(sweep, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(g0, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  chain(o, g, dest); o.start(t); o.stop(t + dur + 0.05);
}
function burst(f, q, dur, g0, type = "bandpass", dest = master, sweepTo) {
  const t = ctx.currentTime, s = ctx.createBufferSource(), b = filt(type, f, q), g = gain(0);
  s.buffer = noiseBuf; if (sweepTo) b.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  g.gain.setValueAtTime(g0, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  chain(s, b, g, dest); s.start(t, Math.random()); s.stop(t + dur + 0.05);
}

// ---------- Ambientes ----------
const BUILD = {
  lluvia() { const n = noise(), out = gain(0.22); chain(n, filt("highpass", 500), filt("lowpass", 7000), out, master); const st = every(40, 160, () => burst(3000 + Math.random() * 3000, 4, 0.03, 0.05)); return () => { n.stop(); st(); }; },
  viento() { const n = noise(), b = filt("bandpass", 500, 1.2), g = gain(0.25); chain(n, b, g, master); const l1 = lfo(b.frequency, 0.08, 300, 550), l2 = lfo(g.gain, 0.13, 0.12, 0.2); return () => { n.stop(); l1.stop(); l2.stop(); }; },
  fuego() { const n = noise(), g = gain(0.12); chain(n, filt("lowpass", 400), g, master); const st = every(30, 220, () => burst(1500 + Math.random() * 3000, 6, 0.02 + Math.random() * 0.04, 0.12 + Math.random() * 0.15)); return () => { n.stop(); st(); }; },
  mazmorra() {
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), g = gain(0.035); o1.frequency.value = 55; o2.frequency.value = 82.5; o2.detune.value = 7;
    chain(o1, g); o2.connect(g); g.connect(master); o1.start(); o2.start();
    const echo = ctx.createDelay(1), fb = gain(0.45); echo.delayTime.value = 0.32; chain(echo, fb, echo); echo.connect(master);
    const n = noise(), w = gain(0.05); chain(n, filt("lowpass", 300), w, master);
    const st = every(1500, 5000, () => blip(1400 + Math.random() * 900, 0.18, 0.12, "sine", echo, 700));
    return () => { o1.stop(); o2.stop(); n.stop(); st(); };
  },
  bosque() {
    const n = noise(), b = filt("bandpass", 700, 0.8), g = gain(0.08); chain(n, b, g, master); const l = lfo(g.gain, 0.1, 0.04, 0.08);
    const st = every(900, 3500, () => { const f = 2500 + Math.random() * 1800; for (let i = 0; i < 2 + Math.random() * 3; i++) setTimeout(() => blip(f, 0.09, 0.05, "sine", master, f * 1.35), i * 110); });
    return () => { n.stop(); l.stop(); st(); };
  },
  taberna() {
    const n = noise(), b = filt("bandpass", 450, 0.9), g = gain(0.16); chain(n, b, g, master); const l1 = lfo(b.frequency, 0.7, 150, 450), l2 = lfo(g.gain, 0.45, 0.06, 0.16);
    const st = every(1200, 4500, () => { blip(3200 + Math.random() * 1500, 0.25, 0.04, "triangle"); blip(5100, 0.2, 0.02, "sine"); });
    const fire = BUILD.fuego(); return () => { n.stop(); l1.stop(); l2.stop(); st(); fire(); };
  }
};
function setAmb(k) {
  want = k || "";
  if (!ctx || ctx.state !== "running") return; // se activará con el primer clic
  if (amb) { amb(); amb = null; }
  ambKey = want;
  if (want && BUILD[want]) amb = BUILD[want]();
}

// ---------- Efectos ----------
const SFX = {
  hit() { burst(700, 1, 0.18, 0.5, "lowpass"); blip(110, 0.2, 0.5, "sine", master, 45); },
  down() { blip(80, 0.5, 0.6, "sine", master, 35); burst(300, 1, 0.4, 0.35, "lowpass"); },
  door() { blip(150, 0.45, 0.12, "sawtooth", master, 95); setTimeout(() => burst(250, 1, 0.25, 0.4, "lowpass"), 380); },
  fireball() { burst(300, 2, 0.6, 0.3, "bandpass", master, 2400); setTimeout(() => { burst(180, 0.7, 1.4, 0.9, "lowpass"); blip(60, 1, 0.6, "sine", master, 30); }, 520); },
  magic() { [880, 1175, 1568].forEach((f, i) => setTimeout(() => blip(f, 0.35, 0.12, "triangle"), i * 90)); burst(4000, 3, 0.4, 0.05); },
  thunder() { burst(2500, 0.5, 0.12, 0.5, "highpass"); setTimeout(() => burst(120, 0.8, 1.6, 0.8, "lowpass"), 60); },
  holy() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.9, 0.08, "sine"), i * 60)); },
  heal() { [784, 988, 1175, 1568].forEach((f, i) => setTimeout(() => blip(f, 0.7, 0.07, "sine"), i * 110)); },
  dice() { for (let i = 0; i < 6; i++) setTimeout(() => burst(2500 + Math.random() * 2500, 3, 0.03, 0.25 - i * 0.03, "bandpass"), 60 + i * 90 + Math.random() * 60); },
  clack() { burst(3500 + Math.random() * 2000, 4, 0.025, 0.18, "bandpass"); blip(900 + Math.random() * 600, 0.04, 0.05, "triangle"); },
  fanfare() { [523, 659, 784, 1046, 1318].forEach((f, i) => setTimeout(() => { blip(f, 0.6, 0.1, "triangle"); blip(f * 2, 0.4, 0.03, "sine"); }, i * 90)); setTimeout(() => burst(6000, 2, 0.6, 0.06), 400); },
  fail() { [392, 330, 262, 196].forEach((f, i) => setTimeout(() => blip(f, 0.45, 0.1, "sawtooth", master, f * 0.95), i * 160)); },
  none() {},
  whoosh() { burst(700, 1.2, 0.22, 0.22, "bandpass", master, 2600); },
  twang() { blip(196, 0.22, 0.14, "triangle", master, 120); burst(3000, 2, 0.12, 0.12, "bandpass", master, 900); },
  crit() { SFX.hit(); [659, 988].forEach((f, i) => setTimeout(() => blip(f, 0.35, 0.09, "triangle"), 60 + i * 80)); },
  miss() { burst(900, 1.4, 0.2, 0.16, "bandpass", master, 300); setTimeout(() => burst(250, 1, 0.12, 0.08, "lowpass"), 150); },
  block() { [1900, 2850, 4100].forEach(f => blip(f, 0.5, 0.06, "square")); blip(320, 0.25, 0.12, "triangle", master, 180); },
  alert() { blip(880, 0.12, 0.12, "triangle"); setTimeout(() => blip(1175, 0.18, 0.12, "triangle"), 130); },
  slash() { burst(1800, 1.6, 0.16, 0.25, "bandpass", master, 600); setTimeout(() => burst(500, 1, 0.12, 0.35, "lowpass"), 90); },
  sword() { [2300, 3700, 5200].forEach(f => blip(f, 0.4, 0.05, "square")); burst(5000, 2, 0.1, 0.15); }
};
const FX_SOUND = { bola: "fireball", proyectil: "magic", rayo: "thunder", escarcha: "magic", llama: "holy", curar: "heal", escudo: "magic", trueno: "thunder" };

export const sound = {
  ambient(k) { if ((k || "") !== want) setAmb(k); },
  play(name) { if (!ac() || muted || !SFX[name]) return; try { SFX[name](); } catch (e) { /* ignorado */ } },
  fx(k) { sound.play(FX_SOUND[k]); },
  get muted() { return muted; }, get volume() { return vol; },
  setMuted(m) { muted = m; try { localStorage.setItem("lamesa:mute", m ? "1" : "0"); } catch (e) { /* */ } if (master) master.gain.value = m ? 0 : vol; },
  setVolume(v) { vol = v; try { localStorage.setItem("lamesa:vol", v); } catch (e) { /* */ } if (master && !muted) master.gain.value = v; }
};
