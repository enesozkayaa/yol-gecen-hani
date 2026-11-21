// =============================================================
// Yol Geçen Hanı - oyun sesleri (hepsi kodla üretilir, dosya yok)
// =============================================================

const Ses = (() => {
  let ctx = null, ana = null, acik = true;
  try { acik = localStorage.getItem('or.ses') !== '0'; } catch (e) { }
  function baslat() {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); ana = ctx.createGain(); ana.gain.value = acik ? 0.5 : 0; ana.connect(ctx.destination); } catch (e) { return; } }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  }
  function degistir() { acik = !acik; if (ana) ana.gain.value = acik ? 0.5 : 0; try { localStorage.setItem('or.ses', acik ? '1' : '0'); } catch (e) { } return acik; }
  function ton(f, sure, tip = 'sine', ses = 0.3, f2 = null, gecikme = 0) {
    if (!ctx || !acik) return;
    const t = ctx.currentTime + gecikme, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = tip; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + sure);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(ses, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + sure);
    o.connect(g).connect(ana); o.start(t); o.stop(t + sure + 0.02);
  }
  let gurultuB = null;
  function gurultu(sure, ses = 0.3, fGecis = 1200, tip = 'bandpass', gecikme = 0, q = 1, f2 = null) {
    if (!ctx || !acik) return;
    if (!gurultuB) { gurultuB = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = gurultuB.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const t = ctx.currentTime + gecikme, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = gurultuB; f.type = tip; f.frequency.setValueAtTime(fGecis, t); if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + sure); f.Q.value = q;
    g.gain.setValueAtTime(ses, t); g.gain.exponentialRampToValueAtTime(0.001, t + sure);
    s.connect(f).connect(g).connect(ana); s.start(t, Math.random() * 0.5); s.stop(t + sure + 0.02);
  }

  // ---------- Motor sesi (sadece kendi araban) ----------
  let motor = null;
  function motorBaslat() {
    if (!ctx || motor) return;
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o1.type = 'sawtooth'; o2.type = 'square'; o1.frequency.value = 50; o2.frequency.value = 25;
    f.type = 'lowpass'; f.frequency.value = 600; f.Q.value = 2; g.gain.value = 0;
    const g2 = ctx.createGain(); g2.gain.value = 0.4;
    o1.connect(f); o2.connect(g2).connect(f); f.connect(g).connect(ana);
    o1.start(); o2.start();
    motor = { o1, o2, f, g };
  }
  function motorAyarla(hiz, gaz, turbo) {
    if (!motor || !ctx) return;
    const t = ctx.currentTime, k = Math.min(1.6, Math.abs(hiz) / 13);
    const fr = 45 + k * 95 + (gaz > 0 ? 12 : 0) + (turbo ? 40 : 0);
    motor.o1.frequency.setTargetAtTime(fr, t, 0.06); motor.o2.frequency.setTargetAtTime(fr / 2, t, 0.06);
    motor.f.frequency.setTargetAtTime(400 + k * 900 + (turbo ? 800 : 0), t, 0.08);
    motor.g.gain.setTargetAtTime(acik ? 0.05 + k * 0.05 + (gaz > 0 ? 0.03 : 0) : 0, t, 0.1);
  }
  function motorDurdur() {
    if (!motor) return;
    const m = motor; motor = null;
    try { m.g.gain.setTargetAtTime(0, ctx.currentTime, 0.1); setTimeout(() => { try { m.o1.stop(); m.o2.stop(); } catch (e) { } }, 500); } catch (e) { }
  }

  return {
    baslat, degistir, get acik() { return acik; }, motorBaslat, motorAyarla, motorDurdur,
    tik() { ton(1200, 0.04, 'square', 0.06); },
    kartAl() { ton(520, 0.08, 'triangle', 0.2, 900); ton(900, 0.1, 'sine', 0.15, null, 0.06); gurultu(0.08, 0.15, 3000, 'highpass'); },
    sendeSira() { [660, 880, 1100].forEach((f, i) => ton(f, 0.15, 'triangle', 0.18, null, i * 0.09)); },
    koy() { ton(140, 0.18, 'sine', 0.35, 70); gurultu(0.15, 0.25, 500, 'lowpass'); ton(600, 0.06, 'square', 0.05, null, 0.05); },
    olmaz() { ton(220, 0.15, 'square', 0.1, 160); },
    don() { ton(800, 0.05, 'triangle', 0.1, 1000); },
    sil() { gurultu(0.3, 0.3, 2500, 'bandpass', 0, 1.5, 500); ton(900, 0.2, 'sine', 0.15, 300); },
    patla() { gurultu(0.7, 0.6, 900, 'lowpass', 0, 1, 120); ton(110, 0.5, 'sine', 0.5, 40); gurultu(0.25, 0.3, 3000, 'bandpass', 0.02, 2); [0.08, 0.17, 0.27].forEach(g => gurultu(0.05, 0.25, 4000, 'highpass', g)); },
    yay() { ton(180, 0.45, 'sine', 0.3, 700); ton(360, 0.35, 'triangle', 0.12, 1200, 0.05); [0, 0.1, 0.2].forEach((g, i) => ton(300 + i * 80, 0.1, 'sine', 0.08, 500, 0.2 + g)); },
    portal() { ton(300, 0.5, 'sine', 0.2, 1600); ton(1600, 0.4, 'sine', 0.12, 400, 0.15); gurultu(0.5, 0.15, 2000, 'bandpass', 0, 3, 6000); },
    turbo() { gurultu(0.6, 0.3, 600, 'bandpass', 0, 1.5, 3500); ton(200, 0.5, 'sawtooth', 0.08, 500); },
    carp(g = 1) { const s = Math.min(1, g / 10); gurultu(0.12, 0.25 * s + 0.05, 1500, 'bandpass', 0, 2); ton(260, 0.1, 'square', 0.08 * s, 140); },
    vurdu() { ton(500, 0.12, 'square', 0.15, 200); gurultu(0.2, 0.3, 1000, 'bandpass'); ton(900, 0.3, 'sine', 0.12, 1500, 0.08); },
    indi(g) { if (g < 3) return; gurultu(0.12, Math.min(0.35, g * 0.03), 400, 'lowpass'); },
    dus() { ton(1200, 1.1, 'sine', 0.18, 200); },
    dogdu() { ton(600, 0.12, 'sine', 0.2, 1200); ton(900, 0.15, 'triangle', 0.12, 1800, 0.08); },
    kalkan() { [1200, 1600, 2000].forEach((f, i) => ton(f, 0.2, 'sine', 0.15, null, i * 0.04)); gurultu(0.3, 0.15, 5000, 'highpass'); },
    nitro() { gurultu(0.8, 0.35, 400, 'bandpass', 0, 1.2, 4000); ton(120, 0.7, 'sawtooth', 0.12, 400); },
    geriSayim() { ton(660, 0.25, 'square', 0.15); },
    basla() { ton(1320, 0.5, 'square', 0.18); ton(990, 0.5, 'triangle', 0.1); },
    bitis(birinci) { (birinci ? [523, 659, 784, 1046, 1318] : [523, 659, 784, 1046]).forEach((f, i) => ton(f, 0.3, 'triangle', 0.22, null, i * 0.1)); gurultu(0.6, 0.15, 6000, 'highpass', 0.3); },
    baskasiBitirdi() { ton(880, 0.12, 'sine', 0.12); ton(1100, 0.15, 'sine', 0.1, null, 0.08); },
    kazandi() { [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => ton(f, 0.35, 'triangle', 0.22, null, i * 0.13)); },
    kaybetti() { [392, 330, 262].forEach((f, i) => ton(f, 0.4, 'triangle', 0.2, null, i * 0.18)); },
  };
})();
