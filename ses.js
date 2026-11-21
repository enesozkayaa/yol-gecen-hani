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
  addEventListener('storage', e => { if (e.key === 'or.ses') { acik = e.newValue !== '0'; if (ana) ana.gain.value = acik ? 0.5 : 0; } });
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
  // Gerçek motor gibi: silindir patlamaları (darbeli dalga), egzoz hırıltısı (patlamalarla titreyen gürültü),
  // hafif bozulma (homurtu), devir + vites. Birkaç motor tipi var; oyuncu bekleme odasında seçer.
  // Tek motor sesi: aile arabası (4 silindir) — kullanıcı bunu seçti
  const MOTOR = { sil: 4, rolanti: 850, kirmizi: 6000, filtre: [600, 2200], gurultu: 0.18, sert: 1.6, alt: 0.08, turbo: 0, ses: 1 };
  let motor = null;
  const darbeDalgasi = {};
  function dalgaAl(sert) {
    // silindir patlaması: kısa, sert bir darbe; çok harmonikli
    const k = sert.toFixed(1); if (darbeDalgasi[k]) return darbeDalgasi[k];
    const n = 40, re = new Float32Array(n), im = new Float32Array(n);
    for (let i = 1; i < n; i++) { const a = Math.pow(i, -0.75) * Math.exp(-i / (10 + sert * 4)); re[i] = a * Math.cos(i * 0.7); im[i] = a * Math.sin(i * 0.7); }
    return (darbeDalgasi[k] = ctx.createPeriodicWave(re, im, { disableNormalization: false }));
  }
  function bozucu(miktar) {
    const n = 1024, e = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; e[i] = Math.tanh(x * miktar) / Math.tanh(miktar); }
    return e;
  }
  function motorBaslat() {
    if (!ctx || motor) return;
    const P = MOTOR;
    const ana2 = ctx.createGain(); ana2.gain.value = 0;
    const karisim = ctx.createGain();
    // ana patlama sesi
    const o = ctx.createOscillator(); o.setPeriodicWave(dalgaAl(P.sert));
    const og = ctx.createGain(); og.gain.value = 0.55; o.connect(og).connect(karisim);
    // krank yarı-frekansı: V8 gibi motorlarda "lub-dub" düzensizliği
    const alt = ctx.createOscillator(); alt.type = 'triangle';
    const ag = ctx.createGain(); ag.gain.value = P.alt; alt.connect(ag).connect(karisim);
    // egzoz hırıltısı: patlamalarla aynı ritimde titreyen gürültü
    if (!gurultuB) { gurultuB = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const dd = gurultuB.getChannelData(0); for (let i = 0; i < dd.length; i++) dd[i] = Math.random() * 2 - 1; }
    const n = ctx.createBufferSource(); n.buffer = gurultuB; n.loop = true;
    const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.Q.value = 0.8; nf.frequency.value = 400;
    const ng = ctx.createGain(); ng.gain.value = P.gurultu * 0.5;
    const ritim = ctx.createOscillator(); ritim.type = 'square';
    const ritimG = ctx.createGain(); ritimG.gain.value = P.gurultu * 0.5;
    ritim.connect(ritimG).connect(ng.gain);
    n.connect(nf).connect(ng).connect(karisim);
    // turbo ıslığı
    const tu = ctx.createOscillator(); tu.type = 'sine'; tu.frequency.value = 2200;
    const tg = ctx.createGain(); tg.gain.value = 0; tu.connect(tg).connect(karisim);
    // homurtu (yumuşak bozulma) + gövde filtresi + kabin tınısı
    const boz = ctx.createWaveShaper(); boz.curve = bozucu(P.sert); boz.oversample = '2x';
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.9; lp.frequency.value = P.filtre[0];
    const govde = ctx.createBiquadFilter(); govde.type = 'peaking'; govde.frequency.value = 160; govde.Q.value = 0.9; govde.gain.value = 5;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 30;
    karisim.connect(boz).connect(lp).connect(govde).connect(hp).connect(ana2).connect(ana);
    [o, alt, ritim, tu].forEach(x => x.start()); n.start();
    motor = { P, o, alt, ritim, n, nf, ng, tu, tg, lp, ana2, devir: P.rolanti };
    motorAyarla(0, 0, false);
  }
  // hiz: m/sn, gaz: -1..1
  function motorAyarla(hiz, gaz, turbo) {
    if (!motor || !ctx) return;
    const P = motor.P, t = ctx.currentTime, k = Math.min(1.8, Math.abs(hiz) / 15);
    // vitesler: her viteste devir yükselir, vites atınca düşer
    const vitesler = [0, 0.22, 0.42, 0.62, 0.84, 1.08, 9];
    let v = 0; while (k > vitesler[v + 1]) v++;
    const oran = (k - vitesler[v]) / (vitesler[v + 1] - vitesler[v]);
    let hedef = v === 0 ? P.rolanti + (P.kirmizi - P.rolanti) * 0.7 * oran : P.rolanti + (P.kirmizi - P.rolanti) * (0.38 + 0.6 * Math.min(1, oran));
    if (v >= 5) hedef = P.rolanti + (P.kirmizi - P.rolanti) * Math.min(1, 0.5 + 0.4 * oran);
    if (gaz > 0 && k < 0.05) hedef = P.rolanti + (P.kirmizi - P.rolanti) * 0.35;   // dururken gaza basınca kükrer
    if (turbo) hedef = Math.min(P.kirmizi * 1.02, hedef + 600);
    motor.devir += (hedef - motor.devir) * 0.35;
    const ates = motor.devir / 60 * P.sil / 2;   // saniyedeki patlama sayısı
    const yuk = gaz > 0 ? 1 : 0.35;
    motor.o.frequency.setTargetAtTime(ates, t, 0.04);
    motor.alt.frequency.setTargetAtTime(ates / 2, t, 0.04);
    motor.ritim.frequency.setTargetAtTime(ates, t, 0.04);
    motor.nf.frequency.setTargetAtTime(220 + ates * 3, t, 0.06);
    const dv = (motor.devir - P.rolanti) / (P.kirmizi - P.rolanti);
    motor.lp.frequency.setTargetAtTime(P.filtre[0] + (P.filtre[1] - P.filtre[0]) * Math.min(1, dv * 0.8 + yuk * 0.25), t, 0.06);
    motor.tg.gain.setTargetAtTime(P.turbo * Math.max(0, dv) * (gaz > 0 ? 1 : 0.2) + (turbo ? P.turbo : 0), t, 0.15);
    motor.tu.frequency.setTargetAtTime(1800 + dv * 2600, t, 0.1);
    motor.ana2.gain.setTargetAtTime(acik ? (0.07 + 0.06 * dv + 0.05 * (yuk - 0.35)) * P.ses : 0, t, 0.08);
  }
  function motorDurdur() {
    if (!motor) return;
    const m = motor; motor = null;
    try { m.ana2.gain.setTargetAtTime(0, ctx.currentTime, 0.1); setTimeout(() => { try { [m.o, m.alt, m.ritim, m.tu, m.n].forEach(x => x.stop()); } catch (e) { } }, 500); } catch (e) { }
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
