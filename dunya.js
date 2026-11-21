// =============================================================
// Yol Geçen Hanı - dünya: pist zinciri (yol parçaları peş peşe), tuzaklar, araba fiziği, botların sürüşü.
// Bu dosya hem tarayıcıda hem Node'da (test) çalışır. Three.js kullanmaz.
// Yön kuralı: açı a için ileri yön (cos a, sin a) [x, z]; sağ taraf (-sin a, cos a). a artınca araba sağa döner.
// =============================================================

const Dunya = (() => {
  const PI = Math.PI;
  const G = 22;              // yerçekimi
  const ARABA_R = 0.95;      // arabanın çarpışma yarıçapı
  const AZAMI_HIZ = 15;
  const GENIS = 7;           // normal yol genişliği
  const ZEMIN_Y = -16;       // pistin altındaki yer (çimen)
  const BAS_UZ = 22, BIT_UZ = 14;

  const ORTAMLAR = {
    vadi: { ad: 'Yeşil Vadi', emoji: '🌲' },
    kanyon: { ad: 'Çöl Kanyonu', emoji: '🏜️' },
  };

  // ---------- Yol kartları ----------
  // seg: L (uzunluk), dh (yükselme), don (derece, + sağ), R (viraj yarıçapı), w (genişlik), rampa, bosluk
  const YOLLAR = {
    duz:      { ad: 'Düz Yol',          emoji: '⬆️', agirlik: 7, acik: '12 metre dümdüz yol.', seg: [{ L: 12 }] },
    uzun:     { ad: 'Uzun Düzlük',      emoji: '⏫', agirlik: 4, acik: '22 metre: gaza bas!', seg: [{ L: 22 }] },
    sag:      { ad: 'Sağa Viraj',       emoji: '↪️', agirlik: 8, acik: 'Keskin sağa dönüş (90°).', seg: [{ don: 90, R: 11 }], ayna: 'sol' },
    sol:      { ad: 'Sola Viraj',       emoji: '↩️', agirlik: 8, acik: 'Keskin sola dönüş (90°).', seg: [{ don: -90, R: 11 }], ayna: 'sag' },
    sagHafif: { ad: 'Hafif Sağ',        emoji: '↗️', agirlik: 6, acik: 'Yumuşak sağa dönüş (45°).', seg: [{ don: 45, R: 15 }], ayna: 'solHafif' },
    solHafif: { ad: 'Hafif Sol',        emoji: '↖️', agirlik: 6, acik: 'Yumuşak sola dönüş (45°).', seg: [{ don: -45, R: 15 }], ayna: 'sagHafif' },
    sViraj:   { ad: 'S Viraj',          emoji: '〰️', agirlik: 5, acik: 'Önce sağa sonra sola kıvrılır.', seg: [{ don: 50, R: 10 }, { don: -50, R: 10 }], ayna: 'sVirajTers' },
    sVirajTers: { ad: 'Ters S Viraj',   emoji: '〰️', agirlik: 4, acik: 'Önce sola sonra sağa kıvrılır.', seg: [{ don: -50, R: 10 }, { don: 50, R: 10 }], ayna: 'sViraj' },
    yokus:    { ad: 'Yokuş Yukarı',     emoji: '⛰️', agirlik: 6, acik: '5 metre tırmanır.', seg: [{ L: 16, dh: 5 }] },
    inis:     { ad: 'Yokuş Aşağı',      emoji: '🎢', agirlik: 5, acik: '5 metre iner. Hızlanırsın!', seg: [{ L: 16, dh: -5 }] },
    sagSpiral:{ ad: 'Yükselen Sağ',     emoji: '🌀', agirlik: 4, acik: 'Tırmanarak sağa döner.', seg: [{ don: 90, R: 12, dh: 4 }], ayna: 'solSpiral' },
    solSpiral:{ ad: 'Yükselen Sol',     emoji: '🌀', agirlik: 4, acik: 'Tırmanarak sola döner.', seg: [{ don: -90, R: 12, dh: 4 }], ayna: 'sagSpiral' },
    atlama:   { ad: 'Atlama Rampası',   emoji: '🛫', agirlik: 5, acik: 'Rampadan uç, boşluğun karşısına kon!', seg: [{ L: 6, dh: 1.6, rampa: true }, { L: 7, dh: -1.6, bosluk: true }, { L: 9 }] },
    tumsek:   { ad: 'Tümsekli Yol',     emoji: '〽️', agirlik: 3, acik: 'Küçük tümsekler: hızlıysan hoplarsın.', seg: [{ L: 16, dalga: { n: 3, A: 0.35 } }], engebe: true },
    dalga:    { ad: 'Dalgalı Yol',      emoji: '🌊', agirlik: 2, acik: 'Büyük dalgalar: tepede havalanırsın!', seg: [{ L: 24, dalga: { n: 2, A: 1.0 } }], engebe: true },
    kasis:    { ad: 'Kasis',            emoji: '🔺', agirlik: 2, acik: 'Ortada sert bir tümsek. Hızla geçersen zıplarsın.', seg: [{ L: 10, kasis: { A: 0.5, gen: 2.6 } }], engebe: true },
    delikli:  { ad: 'Delikli Yol',      emoji: '🕳️', agirlik: 3, acik: 'Ortasında kare bir delik var. Sağından ya da solundan geç!', seg: [{ L: 18, delik: 3, delikUz: 5 }], nadir: 2 },
    dar:      { ad: 'Dar Köprü',        emoji: '🌉', agirlik: 4, acik: 'Sadece 3.6 metre genişlik. Dikkat!', seg: [{ L: 14, w: 3.6 }] },
  };
  const YOL_KARTLARI = Object.keys(YOLLAR).filter(k => k !== 'sVirajTers');

  // ---------- Tuzak kartları ----------
  const TURLER = {
    duvar:    { ad: 'Beton Bariyer',    emoji: '🧱', kat: 'engel',  agirlik: 8, acik: 'Yolun bir kısmını kapatan beton blok.' },
    pervane:  { ad: 'Dönen Kol',        emoji: '🌀', kat: 'engel',  agirlik: 7, acik: 'Durmadan döner. Çarpanı savurur.' },
    cekic:    { ad: 'Yıkım Güllesi',    emoji: '🔨', kat: 'engel',  agirlik: 6, acik: 'Sağa sola sallanır, çarptığını fırlatır.' },
    blok:     { ad: 'Kayan Blok',       emoji: '🟧', kat: 'engel',  agirlik: 6, acik: 'Yolun üstünde ileri geri kayar.' },
    yag:      { ad: 'Yağ Birikintisi',  emoji: '🛢️', kat: 'kaygan', agirlik: 7, acik: 'Kayarsın! Direksiyon tutmaz.' },
    bal:      { ad: 'Çamur',            emoji: '🟫', kat: 'kaygan', agirlik: 7, acik: 'Araba çamura saplanıp çok yavaşlar.' },
    mayin:    { ad: 'Mayın',            emoji: '💥', kat: 'patlar', agirlik: 8, acik: 'Üstüne basan havaya uçar. Sonra yeniden kurulur.' },
    yay:      { ad: 'Zıplatıcı',        emoji: '🦘', kat: 'patlar', agirlik: 6, acik: 'Arabayı yükseğe zıplatır.' },
    turbo:    { ad: 'Hız Şeridi',       emoji: '⏩', kat: 'fayda',  agirlik: 6, acik: 'Üstünden geçen bir anlığına çok hızlanır.' },
    korkuluk: { ad: 'Çelik Korkuluk',   emoji: '🚧', kat: 'fayda',  agirlik: 6, acik: 'Yol kenarına konur, düşmeni önler.' },
    silgi:    { ad: 'Söküm',            emoji: '🔧', kat: 'fayda',  agirlik: 6, acik: 'Konmuş bir tuzağı söker.' },
    bomba:    { ad: 'Bomba',            emoji: '💣', kat: 'fayda',  agirlik: 4, acik: 'Çevresindeki bütün tuzakları patlatır.' },
    kalkan:   { ad: 'Kalkan',           emoji: '🛡️', kat: 'fayda',  agirlik: 4, acik: 'Sonraki yarışta ilk tuzak sana işlemez.', kisisel: true },
    nitro:    { ad: 'Nitro',            emoji: '🔥', kat: 'fayda',  agirlik: 4, acik: 'Sonraki yarışta nitro deposu çok daha dolu.', kisisel: true },
  };
  const KATLAR = {
    yol: { ad: 'Yol', renk: '#3a6ad8' }, engel: { ad: 'Engel', renk: '#e0603a' },
    kaygan: { ad: 'Kaygan', renk: '#b8862a' }, patlar: { ad: 'Patlayan', renk: '#d03a8a' },
    fayda: { ad: 'Fayda', renk: '#2aa860' },
  };
  const SILGI_R = 2, BOMBA_R = 7;

  // ---------- Yardımcılar ----------
  const yerel = (cx, cz, r, x, z) => { const dx = x - cx, dz = z - cz, c = Math.cos(r), s = Math.sin(r); return [dx * c + dz * s, -dx * s + dz * c]; };
  const dunyaya = (cx, cz, r, u, v) => { const c = Math.cos(r), s = Math.sin(r); return [cx + u * c - v * s, cz + u * s + v * c]; };
  function karma(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; }
  const aciFark = (a, b) => { let f = (b - a) % (2 * PI); if (f > PI) f -= 2 * PI; if (f < -PI) f += 2 * PI; return f; };

  // ---------- Pist inşası ----------
  // dizi: yol kartı türleri (sırayla). Başlangıç ve bitiş kendiliğinden eklenir.
  function yolKur(dizi) {
    const c = { x: 0, y: 0, z: 0, a: 0 };
    const yuzey = [], cizgi = [], segmentler = [], delikler = [];
    function parca(tur, tanim) {
      const si = segmentler.length, rects = [];
      for (const s of tanim) {
        const w = s.w || GENIS;
        let dh = s.dh || 0;
        if (c.y + dh < 0) dh = -c.y;
        if (c.y + dh > 36) dh = 36 - c.y;
        if (!s.don && s.delik) {
          // ortası kare delikli düz yol: deliğin önü, arkası ve iki yanı yol
          const L = s.L, D2 = s.delik / 2, U2 = (s.delikUz || s.delik) / 2, ux = Math.cos(c.a), uz = Math.sin(c.a), sx = -uz, sz = ux;
          const u0 = L / 2 - U2, u1 = L / 2 + U2, yan = (w / 2 + D2) / 2, yanG = (w / 2 - D2) / 2;
          const ekle = (um, vm, hu, hv) => { const r = { cx: c.x + ux * um + sx * vm, cz: c.z + uz * um + sz * vm, r: c.a, hu, hv, h0: c.y, h1: c.y, si }; yuzey.push(r); rects.push(r); };
          ekle(u0 / 2, 0, u0 / 2 + 0.1, w / 2);
          ekle((u1 + L) / 2, 0, (L - u1) / 2 + 0.1, w / 2);
          ekle(L / 2, yan, U2 + 0.05, yanG); ekle(L / 2, -yan, U2 + 0.05, yanG);
          delikler.push({ cx: c.x + ux * L / 2, cz: c.z + uz * L / 2, y: c.y, r: c.a, hu: U2, hv: D2 });
          for (let t = 0; t < L - 1e-6; t += 0.5) cizgi.push({ x: c.x + ux * t, y: c.y, z: c.z + uz * t, a: c.a, w, si, delik: t > u0 + 0.01 && t < u1 - 0.01, delikYakin: t > u0 - 2 && t < u1 + 2 });
          c.x += ux * L; c.z += uz * L;
        } else if (!s.don && (s.dalga || s.kasis)) {
          // tümsekli düz yol: 0.5 m'lik küçük eğimli parçalardan oluşur
          const L = s.L, ux = Math.cos(c.a), uz = Math.sin(c.a), y0 = c.y;
          const prof = t => s.dalga ? s.dalga.A * (1 - Math.cos(2 * PI * s.dalga.n * t / L)) / 2
            : (Math.abs(t - L / 2) < s.kasis.gen / 2 ? s.kasis.A * Math.sin(PI * (t - (L / 2 - s.kasis.gen / 2)) / s.kasis.gen) : 0);
          const yy = t => y0 + dh * t / L + prof(t);
          const ad = 0.5;
          for (let t = 0; t < L - 1e-6; t += ad) {
            const r = { cx: c.x + ux * (t + ad / 2), cz: c.z + uz * (t + ad / 2), r: c.a, hu: ad / 2 + 0.06, hv: w / 2, h0: yy(t), h1: yy(t + ad), si, tumsek: true };
            yuzey.push(r); rects.push(r);
            cizgi.push({ x: c.x + ux * t, y: yy(t), z: c.z + uz * t, a: c.a, w, si, tumsek: true });
          }
          c.x += ux * L; c.z += uz * L; c.y += dh;
        } else if (!s.don) {
          const L = s.L, ux = Math.cos(c.a), uz = Math.sin(c.a);
          if (!s.bosluk) { const r = { cx: c.x + ux * L / 2, cz: c.z + uz * L / 2, r: c.a, hu: L / 2 + 0.2, hv: w / 2, h0: c.y, h1: c.y + dh, rampa: !!s.rampa, si }; yuzey.push(r); rects.push(r); }
          for (let t = 0; t < L; t += 1) cizgi.push({ x: c.x + ux * t, y: c.y + dh * t / L, z: c.z + uz * t, a: c.a, w, si, bosluk: !!s.bosluk, rampa: !!s.rampa });
          c.x += ux * L; c.z += uz * L; c.y += dh;
        } else {
          const th = s.don * PI / 180, R = s.R, sg = Math.sign(th);
          const n = Math.max(2, Math.ceil(Math.abs(th) / (PI / 14))), D = th / n;
          const a0 = c.a, x0 = c.x, z0 = c.z, y0 = c.y;
          const mx = x0 - Math.sin(a0) * R * sg, mz = z0 + Math.cos(a0) * R * sg;   // dönüş merkezi
          let px = x0, pz = z0, a = a0, py = y0;
          for (let k = 0; k < n; k++) {
            const am = a + D / 2, kiris = 2 * R * Math.sin(Math.abs(D) / 2);
            const nx = px + Math.cos(am) * kiris, nz = pz + Math.sin(am) * kiris;
            const r = { cx: (px + nx) / 2, cz: (pz + nz) / 2, r: am, hu: (R + w / 2) * Math.sin(Math.abs(D) / 2) + 0.15, hv: w / 2, h0: py, h1: py + dh / n, si, viraj: true };
            yuzey.push(r); rects.push(r);
            px = nx; pz = nz; a += D; py += dh / n;
          }
          const uzunluk = R * Math.abs(th), m = Math.max(2, Math.round(uzunluk));
          for (let j = 0; j < m; j++) {
            const f = a0 + th * j / m;
            cizgi.push({ x: mx + Math.sin(f) * R * sg, y: y0 + dh * j / m, z: mz - Math.cos(f) * R * sg, a: f, w, si, viraj: true });
          }
          c.x = px; c.z = pz; c.a = a0 + th; c.y = y0 + dh;
        }
      }
      segmentler.push({ tur, si, rects });
    }
    parca('baslangic', [{ L: BAS_UZ }]);
    dizi.forEach(t => parca(t, (YOLLAR[t] || YOLLAR.duz).seg));
    parca('bitis', [{ L: BIT_UZ }]);
    cizgi.push({ x: c.x, y: c.y, z: c.z, a: c.a, w: GENIS, si: segmentler.length - 1 });
    let bitisI = cizgi.length - 1;
    while (bitisI > 0 && cizgi[bitisI].si === segmentler.length - 1) bitisI--;
    bitisI += 5;   // bitiş çizgisi, bitiş parçasının 5. metresi
    // Yol kenarı korkulukları: bazı yollarda boydan boya, bazılarında yer yer, bazılarında hiç yok
    const korkuluk = [];
    segmentler.forEach((seg, si) => {
      let mod;
      if (seg.tur === 'baslangic' || seg.tur === 'bitis') mod = 'tam';
      else if (seg.tur === 'dar') mod = 'yok';
      else { const h = karma('k' + si + seg.tur); mod = h < 0.35 ? 'tam' : h < 0.72 ? 'parca' : 'yok'; }
      seg.korkuluk = mod;
      if (mod === 'yok') return;
      let yerel0 = -1;
      for (let i = 0; i < cizgi.length - 1; i++) {
        const p = cizgi[i], n = cizgi[i + 1];
        if (p.si !== si) continue;
        if (yerel0 < 0) yerel0 = i;
        if (p.bosluk || p.rampa || n.bosluk) continue;
        for (const yan of [-1, 1]) {
          if (mod === 'parca' && karma(si + ':' + yan + ':' + Math.floor((i - yerel0) / 5)) > 0.4) continue;
          const o = p.w / 2 + 0.18;
          const x1 = p.x - Math.sin(p.a) * o * yan, z1 = p.z + Math.cos(p.a) * o * yan, x2 = n.x - Math.sin(n.a) * o * yan, z2 = n.z + Math.cos(n.a) * o * yan;
          korkuluk.push({ x: (x1 + x2) / 2, z: (z1 + z2) / 2, y: (p.y + n.y) / 2, a: Math.atan2(z2 - z1, x2 - x1), L: Math.hypot(x2 - x1, z2 - z1), dy: n.y - p.y, yan });
        }
      }
    });
    return { yuzey, cizgi, segmentler, bitisI, korkuluk, delikler, son: { ...c } };
  }

  // İki döndürülmüş dikdörtgen (yükseklikleriyle) çakışıyor mu?
  function kutuKesisir(a, b) {
    const ayA = [Math.min(a.h0, a.h1), Math.max(a.h0, a.h1)], ayB = [Math.min(b.h0, b.h1), Math.max(b.h0, b.h1)];
    if (ayA[0] - ayB[1] > 3.2 || ayB[0] - ayA[1] > 3.2) return false;   // biri ötekinin üstünden geçiyor
    const eks = [a.r, a.r + PI / 2, b.r, b.r + PI / 2];
    const kose = k => [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([su, sv]) => dunyaya(k.cx, k.cz, k.r, su * (k.hu - 0.3), sv * (k.hv - 0.3)));
    const ka = kose(a), kb = kose(b);
    for (const e of eks) {
      const ex = Math.cos(e), ez = Math.sin(e);
      const pa = ka.map(([x, z]) => x * ex + z * ez), pb = kb.map(([x, z]) => x * ex + z * ez);
      if (Math.max(...pa) < Math.min(...pb) || Math.max(...pb) < Math.min(...pa)) return false;
    }
    return true;
  }
  // dizi'nin sonuna 'ekler' eklenince yeni parçalar eskilerle çakışıyor mu?
  function cakisma(dizi, ekler) {
    const Y = yolKur([...dizi, ...ekler]);
    const ilkYeni = 1 + dizi.length;   // 0 başlangıç
    const eski = Y.segmentler.slice(0, ilkYeni - 1).flatMap(s => s.rects);
    const onceki = Y.segmentler[ilkYeni - 1].rects;
    const yeni = Y.segmentler.slice(ilkYeni).flatMap(s => s.rects);
    for (const r of yeni) { for (const e of eski) if (kutuKesisir(r, e)) return true; }
    // hemen önceki parçayla sadece uzaktaki kısımlar çakışabilir (spiral vb.)
    const sonYeni = Y.segmentler.slice(ilkYeni + 1).flatMap(s => s.rects);
    for (const r of sonYeni) for (const e of onceki) if (kutuKesisir(r, e)) return true;
    return false;
  }
  // Seçilen yolu ekle; çakışırsa yukarı kaldır ya da çevir
  function uygunYol(dizi, tur) {
    const ayna = YOLLAR[tur]?.ayna;
    const denemeler = [[tur, ''], [`yokus,${tur}`, 'yukarı kaldırıldı'], [`yokus,yokus,${tur}`, 'yukarı kaldırıldı'], [`duz,${tur}`, 'biraz uzatıldı']];
    if (ayna) denemeler.push([ayna, 'ters yöne çevrildi'], [`yokus,${ayna}`, 'yukarı kaldırılıp ters çevrildi'], [`yokus,yokus,${ayna}`, 'yukarı kaldırılıp ters çevrildi']);
    denemeler.push(['yokus,yokus', 'sığmadı, yokuş kondu'], ['yokus,yokus,yokus', 'sığmadı, yokuş kondu']);
    for (const [d, not] of denemeler) { const ekler = d.split(','); if (!cakisma(dizi, ekler)) return { ekler, not }; }
    return { ekler: ['yokus', 'yokus', 'yokus', 'yokus'], not: 'çok yukarı çıkarıldı' };
  }

  // ---------- Tuzakların fiziksel karşılığı ----------
  function parcaSekli(p) {
    const { x, z, r } = p, y = p.y || 0, S = { yuzey: [], engel: [], hareketli: [], alan: [] };
    const faz = karma(p.id) * 6.283;
    switch (p.tur) {
      case 'duvar': S.engel.push({ cx: x, cz: z, r, hu: 2.2, hv: 0.55, ust: 1.3, y0: y }); break;
      case 'korkuluk': S.engel.push({ cx: x, cz: z, r, hu: 3, hv: 0.2, ust: 0.9, y0: y, alcak: true }); break;
      case 'pervane': S.engel.push({ cx: x, cz: z, r: 0, hu: 0.45, hv: 0.45, ust: 2.5, y0: y }); S.hareketli.push({ tip: 'pervane', cx: x, cz: z, r, faz, y0: y, yon: karma(p.id + 'y') < 0.5 ? 1 : -1 }); break;
      case 'cekic': {
        for (const v of [-3.6, 3.6]) { const [a, b] = dunyaya(x, z, r, 0, v); S.engel.push({ cx: a, cz: b, r, hu: 0.3, hv: 0.3, ust: 5, y0: y, direk: true }); }
        S.hareketli.push({ tip: 'cekic', cx: x, cz: z, r, faz, y0: y }); break;
      }
      case 'blok': S.hareketli.push({ tip: 'blok', cx: x, cz: z, r, faz, y0: y }); break;
      case 'yag': S.alan.push({ tip: 'yag', x, z, y, yr: 2.3 }); break;
      case 'bal': S.alan.push({ tip: 'bal', x, z, y, yr: 2.3 }); break;
      case 'mayin': S.alan.push({ tip: 'mayin', x, z, y, yr: 0.9, pid: p.id }); break;
      case 'yay': S.alan.push({ tip: 'yay', x, z, y, yr: 1.3 }); break;
      case 'turbo': S.alan.push({ tip: 'turbo', x, z, y, r, hu: 2, hv: 1.5 }); break;
    }
    return S;
  }

  function kur(ortam, dizi, parcalar) {
    const yol = yolKur(dizi || []);
    const d = { ortam: ORTAMLAR[ortam] ? ortam : 'vadi', dizi: dizi || [], yol, cizgi: yol.cizgi, yuzey: yol.yuzey.slice(), engel: [], hareketli: [], alan: [], parcalar: parcalar || [], mayinKapali: new Map(), bitisI: yol.bitisI };
    yol.korkuluk.forEach(k => d.engel.push({ cx: k.x, cz: k.z, r: k.a, hu: k.L / 2 + 0.06, hv: 0.15, ust: 0.95, y0: k.y, alcak: true, kenar: true }));
    d.parcalar.forEach(p => { const S = parcaSekli(p); for (const k in S) S[k].forEach(o => { o.pid = p.id; d[k].push(o); }); });
    return d;
  }

  // ---------- Zemin ----------
  function yuzeyYuk(y, u) { return y.h0 === y.h1 ? y.h0 : y.h0 + (u + y.hu) / (2 * y.hu) * (y.h1 - y.h0); }
  function zemin(d, x, z, y = 99, pay = 0.25) {
    let en = null, enH = -1e9;
    for (const s of d.yuzey) {
      const [u, v] = yerel(s.cx, s.cz, s.r, x, z);
      if (Math.abs(u) > s.hu + pay || Math.abs(v) > s.hv + pay) continue;
      const hh = yuzeyYuk(s, Math.max(-s.hu, Math.min(s.hu, u)));
      if (hh <= y + 0.7 && hh > enH) { enH = hh; en = s; }
    }
    return en ? { h: enH, s: en } : null;
  }

  // ---------- Hareketli tuzakların o anki yeri ----------
  function hareketliDurum(m, t) {
    if (m.tip === 'pervane') return { aci: m.r + m.yon * (t * 1.1 + m.faz) };
    if (m.tip === 'cekic') { const s = Math.sin(t * 1.9 + m.faz); const [x, z] = dunyaya(m.cx, m.cz, m.r, 0, s * 3.2); return { x, z, s, hiz: Math.cos(t * 1.9 + m.faz) }; }
    if (m.tip === 'blok') { const off = Math.sin(t * 1.2 + m.faz) * 2.4; const [x, z] = dunyaya(m.cx, m.cz, m.r, off, 0); return { x, z, hiz: Math.cos(t * 1.2 + m.faz) }; }
    return {};
  }

  function daireKutu(x, z, rad, cx, cz, r, hu, hv) {
    const [u, v] = yerel(cx, cz, r, x, z);
    const qu = Math.max(-hu, Math.min(hu, u)), qv = Math.max(-hv, Math.min(hv, v));
    let du = u - qu, dv = v - qv, dd = Math.hypot(du, dv);
    if (dd >= rad) return null;
    let nu, nv, der;
    if (dd > 1e-6) { nu = du / dd; nv = dv / dd; der = rad - dd; }
    else { const pu = hu - Math.abs(u), pv = hv - Math.abs(v); if (pu < pv) { nu = Math.sign(u) || 1; nv = 0; der = pu + rad; } else { nu = 0; nv = Math.sign(v) || 1; der = pv + rad; } }
    const c = Math.cos(r), s = Math.sin(r);
    return { nx: nu * c - nv * s, nz: nu * s + nv * c, der };
  }

  // ---------- Pistte ilerleme ----------
  // (x,y,z) noktasına en yakın orta çizgi noktası; ipucu verilirse onun çevresinde arar
  function ilerlemeBul(d, x, y, z, ipucu = -1, ileri = 40) {
    const C = d.cizgi;
    let i0 = 0, i1 = C.length - 1;
    if (ipucu >= 0) { i0 = Math.max(0, ipucu - 12); i1 = Math.min(C.length - 1, ipucu + ileri); }
    let en = -1, ed = 1e9;
    for (let i = i0; i <= i1; i++) {
      const p = C[i], dy = Math.abs(p.y - y);
      if (dy > 3) continue;
      const dd = (p.x - x) ** 2 + (p.z - z) ** 2 + dy * dy * 4;
      if (dd < ed) { ed = dd; en = i; }
    }
    if (en < 0 && ipucu >= 0) return ilerlemeBul(d, x, y, z, -1);
    return en < 0 || ed > (C[en].w / 2 + 3) ** 2 ? -1 : en;
  }

  // ---------- Araba ----------
  function yeniAraba(x, y, z, a) {
    return { x, y, z, a, vx: 0, vz: 0, vy: 0, vyT: 0, havada: false, dus: 0, dusT: 0, turboT: 0, nitro: 0, kalkan: 0,
      ci: 0, enIleri: 0, sonY: y, spin: 0, spinV: 0, sersem: 0, bitti: false, kayiyor: 0, yerde: 'yol', rampada: false };
  }
  function yenidenDog(a, d) {
    const C = d.cizgi;
    let i = Math.max(0, Math.min(a.enIleri, C.length - 1) - 4);
    const tehlikeli = j => C[j].bosluk || C[j].rampa || C[j].delikYakin || d.alan.some(al => al.tip !== 'turbo' && Math.hypot(al.x - C[j].x, al.z - C[j].z) < (al.yr || 2) + 2 && Math.abs(al.y - C[j].y) < 2)
      || d.hareketli.some(m => Math.hypot(m.cx - C[j].x, m.cz - C[j].z) < 5.5 && Math.abs(m.y0 - C[j].y) < 2)
      || d.engel.some(e => !e.alcak && !e.direk && Math.hypot(e.cx - C[j].x, e.cz - C[j].z) < 3 && Math.abs(e.y0 - C[j].y) < 2);
    for (let k = 0; k < 40 && i > 0 && tehlikeli(i); k++) i--;
    const p = C[i];
    Object.assign(a, { x: p.x, z: p.z, y: p.y + 0.6, a: p.a, vx: 0, vz: 0, vy: 0, vyT: 0, havada: true, dus: 0, dusT: 0, spin: 0, spinV: 0, sersem: 0, turboT: 0, ci: i, sonY: p.y, rampada: false });
  }
  function vur(a, nx, nz, guc, yuk, ol, tip) {
    if (a.kalkan > 0) { a.kalkan = 0; a.vx = nx * 5; a.vz = nz * 5; ol.push({ tip: 'kalkan' }); return; }
    a.vx = nx * guc; a.vz = nz * guc; a.vy = yuk; a.havada = true; a.spinV = (Math.random() < 0.5 ? -1 : 1) * (8 + Math.random() * 6); a.sersem = 0.4;
    ol.push({ tip: tip || 'vurdu' });
  }

  // Bir adım. g = { gaz: -1..1, don: -1..1, turbo }. t = yarış zamanı. ol: olay listesi
  function adim(a, g, d, t, dt, ol = []) {
    if (a.bitti && !a.havada && Math.hypot(a.vx, a.vz) < 0.3) return ol;
    a.sersem -= dt; a.turboT -= dt;
    if (a.dus > 0) {   // düşüyor: aşağıdaki çimene çakılınca yeniden doğar
      if (a.y > ZEMIN_Y + 0.5) { a.vy -= G * dt; a.y += a.vy * dt; a.x += a.vx * dt * 0.7; a.z += a.vz * dt * 0.7; a.spin += a.spinV * dt; if (a.y <= ZEMIN_Y + 0.5) { a.y = ZEMIN_Y + 0.5; ol.push({ tip: 'cakildi', x: a.x, z: a.z }); } }
      else { a.dusT += dt; if (a.dusT > 0.7) { yenidenDog(a, d); ol.push({ tip: 'dogdu' }); } }
      return ol;
    }
    let fx = Math.cos(a.a), fz = Math.sin(a.a);
    let tutus = 7, hizCarp = 1, ivme = 1;
    a.kayiyor = 0; a.yerde = 'yol';
    for (const al of d.alan) {
      if (Math.abs(a.y - al.y) > 0.7) continue;
      let icinde;
      if (al.hu) { const [u, v] = yerel(al.x, al.z, al.r, a.x, a.z); icinde = Math.abs(u) <= al.hu && Math.abs(v) <= al.hv; }
      else icinde = Math.hypot(a.x - al.x, a.z - al.z) < al.yr + (al.tip === 'mayin' || al.tip === 'yay' ? 0.5 : 0);
      if (!icinde) continue;
      if (al.tip === 'yag') { tutus = 0.35; ivme = 0.45; a.kayiyor = 1; a.yerde = 'yag'; }
      else if (al.tip === 'bal') { hizCarp = 0.33; ivme = 0.5; a.yerde = 'bal'; }
      else if (al.tip === 'turbo' && !a.havada) { if (a.turboT < 0.5) ol.push({ tip: 'turbo' }); a.turboT = Math.max(a.turboT, 0.8); }
      else if (al.tip === 'mayin' && !a.havada) {
        if ((d.mayinKapali.get(al.pid) ?? -1) > t) continue;
        d.mayinKapali.set(al.pid, t + 4);
        ol.push({ tip: 'mayin', pid: al.pid, x: al.x, y: al.y, z: al.z });
        const aci = Math.random() * PI * 2;
        vur(a, Math.cos(aci) * 0.4 - fx * 0.6, Math.sin(aci) * 0.4 - fz * 0.6, 6, 10.5, ol, 'patladi');
      }
      else if (al.tip === 'yay' && !a.havada) { a.vy = 10.5; a.vx *= 0.75; a.vz *= 0.75; a.havada = true; a.spinV = 0; ol.push({ tip: 'yay' }); }
    }
    // sürüş
    if (!a.havada) {
      let f = a.vx * fx + a.vz * fz, l = -a.vx * fz + a.vz * fx;
      // nitro: basılı tuttukça depo azalır, bırakınca kalanı sonraya kalır
      if (g.turbo && a.nitro > 0) { if (!a.nitroYaniyor) ol.push({ tip: 'nitro' }); a.nitroYaniyor = true; a.nitro = Math.max(0, a.nitro - dt); a.turboT = Math.max(a.turboT, 0.12); }
      else a.nitroYaniyor = false;
      const azami = AZAMI_HIZ * hizCarp * (a.turboT > 0 ? 1.6 : 1) * (a.sinir || 1);
      const kontrol = a.sersem > 0 || a.bitti ? 0 : 1;
      const gaz = g.gaz * kontrol;
      if (a.turboT > 0 && kontrol && gaz >= 0) f = Math.min(azami, f + 45 * dt);
      else if (gaz > 0) { if (f < azami) f = Math.min(azami, f + 26 * gaz * ivme * dt); else f -= (f - azami) * 4 * dt; }
      else if (gaz < 0) { if (f > 0.5) f -= 40 * dt; else f = Math.max(-7 * hizCarp, f - 18 * ivme * dt); }
      else f -= f * (a.bitti ? 3 : 1.1) * dt;
      if (f > azami + 0.5 && a.turboT <= 0) f -= (f - azami) * 4 * dt;
      // yokuşta yerçekimi
      const zm0 = zemin(d, a.x, a.z, a.y);
      if (zm0 && zm0.s.h0 !== zm0.s.h1) { const egim = (zm0.s.h1 - zm0.s.h0) / (2 * zm0.s.hu), yon = Math.cos(a.a - zm0.s.r); f -= egim * yon * 9 * dt; }
      if (Math.abs(l) > 4 && tutus > 2) a.kayiyor = Math.max(a.kayiyor, Math.min(1, (Math.abs(l) - 4) / 6));
      l *= Math.exp(-tutus * dt);
      const donus = g.don * kontrol * 2.5 * Math.max(-1, Math.min(1, f / 5)) * (tutus < 1 ? 0.6 : 1) * (Math.abs(f) > 11 ? 0.85 : 1);
      a.a += donus * dt;
      fx = Math.cos(a.a); fz = Math.sin(a.a);
      a.vx = fx * f - fz * l; a.vz = fz * f + fx * l;
    } else { a.vx *= 1 - 0.12 * dt; a.vz *= 1 - 0.12 * dt; }

    a.x += a.vx * dt; a.z += a.vz * dt;
    for (const e of d.engel) {
      if (Math.abs(a.x - e.cx) > e.hu + e.hv + 1.2 || Math.abs(a.z - e.cz) > e.hu + e.hv + 1.2) continue;
      if (a.y > e.y0 + e.ust - 0.15 || a.y < e.y0 - 1.2) continue;
      const c = daireKutu(a.x, a.z, ARABA_R, e.cx, e.cz, e.r, e.hu, e.hv);
      if (!c) continue;
      a.x += c.nx * c.der; a.z += c.nz * c.der;
      const vn = a.vx * c.nx + a.vz * c.nz;
      if (vn < 0) { a.vx -= vn * c.nx * (e.alcak ? 1.2 : 1.4); a.vz -= vn * c.nz * (e.alcak ? 1.2 : 1.4); if (vn < -4) ol.push({ tip: 'carpti', guc: -vn, x: a.x - c.nx * ARABA_R, y: a.y, z: a.z - c.nz * ARABA_R }); }
    }
    for (const m of d.hareketli) {
      if (a.y < m.y0 - 1.2) continue;
      const hd = hareketliDurum(m, t);
      if (m.tip === 'pervane') {
        if (a.y > m.y0 + 1.2) continue;
        const c = daireKutu(a.x, a.z, ARABA_R, m.cx, m.cz, hd.aci, 2.8, 0.35);
        if (!c) continue;
        a.x += c.nx * c.der; a.z += c.nz * c.der;
        const rx = a.x - m.cx, rz = a.z - m.cz, rl = Math.hypot(rx, rz) || 1;
        const tx = -rz / rl * m.yon, tz = rx / rl * m.yon;
        const nx = tx * 0.75 + rx / rl * 0.35, nz = tz * 0.75 + rz / rl * 0.35, nl = Math.hypot(nx, nz);
        vur(a, nx / nl, nz / nl, 4 + rl * 0.7, 2.6, ol);
      } else if (m.tip === 'cekic') {
        if (a.y > m.y0 + 2.3) continue;
        if (Math.hypot(a.x - hd.x, a.z - hd.z) > ARABA_R + 1.1) continue;
        const [vx, vz] = [-Math.sin(m.r), Math.cos(m.r)], yon = Math.sign(hd.hiz) || 1;
        a.x += vx * yon * 0.8; a.z += vz * yon * 0.8;
        vur(a, vx * yon, vz * yon, 11, 6, ol);
      } else if (m.tip === 'blok') {
        if (a.y > m.y0 + 1.5) continue;
        const c = daireKutu(a.x, a.z, ARABA_R, hd.x, hd.z, m.r, 1.1, 1.1);
        if (!c) continue;
        a.x += c.nx * c.der; a.z += c.nz * c.der;
        const vn = a.vx * c.nx + a.vz * c.nz;
        if (vn < 0) { a.vx -= vn * c.nx * 1.3; a.vz -= vn * c.nz * 1.3; }
        const [ux, uz] = [Math.cos(m.r), Math.sin(m.r)], it = hd.hiz * 3;
        if (ux * c.nx + uz * c.nz > 0.3 === it > 0 && Math.abs(it) > 1) { a.vx += ux * it; a.vz += uz * it; ol.push({ tip: 'carpti', guc: 6, x: a.x, y: a.y, z: a.z }); }
      }
    }

    // dikey
    if (!a.havada) {
      const zm = zemin(d, a.x, a.z, a.y);
      const yatay = Math.max(1, Math.hypot(a.vx, a.vz));
      if (zm && zm.h >= a.y - 0.45 && zm.s.tumsek && a.vyT > 0.8 && (zm.h - a.y) / dt < a.vyT - G * (0.5 / yatay) * 1.2) {
        a.havada = true; a.vy = Math.min(a.vyT, 4.2); a.rampada = false; ol.push({ tip: 'havalandi', yuk: a.vy });   // tümsekten uçtu
      } else if (zm && zm.h >= a.y - 0.45) { const yeni = zm.h; a.vyT = (yeni - a.y) / dt; a.y = yeni; a.sonY = yeni; a.rampada = !!zm.s.rampa && (a.vx * Math.cos(zm.s.r) + a.vz * Math.sin(zm.s.r)) > 1.5; }
      else {
        a.havada = true; a.vy = Math.max(0, a.vyT) * 1.1;
        if (a.rampada) {
          const f = a.vx * Math.cos(a.a) + a.vz * Math.sin(a.a), ek = Math.max(0, 13 - f);
          a.vx += Math.cos(a.a) * ek; a.vz += Math.sin(a.a) * ek; a.vy = Math.max(a.vy, 6.5);
        }
        a.rampada = false;
        ol.push({ tip: 'havalandi', yuk: a.vy });
      }
    }
    if (a.havada) {
      a.vy -= G * dt; a.y += a.vy * dt; a.spin += a.spinV * dt;
      let zm = zemin(d, a.x, a.z, a.y + 0.3);
      const ust = zemin(d, a.x, a.z, a.y + 2.4);   // tümseğin yükselen yüzüne çarptıysa içinden geçmesin, üstüne çıksın
      if (ust && ust.s.tumsek && ust.h > a.y && ust.h - a.y < 2.4) { zm = ust; a.vy = Math.min(a.vy, 0); }
      if (zm && a.y <= zm.h && a.vy <= 0 && a.y > zm.h - (zm.s.tumsek ? 2.4 : 0.9)) {
        const sert = -a.vy;
        a.y = zm.h; a.havada = false; a.vy = 0; a.vyT = 0; a.spinV = 0; a.spin = 0; a.sonY = zm.h;
        ol.push({ tip: 'indi', guc: sert });
      } else if (!zm && a.y < a.sonY - 4.5) { a.dus = 1; a.dusT = 0; ol.push({ tip: 'dustu' }); }
    }
    // ilerleme ve bitiş
    if (!a.havada) {
      const i = ilerlemeBul(d, a.x, a.y, a.z, a.ci, 30);
      if (i >= 0) { a.ci = i; if (i > a.enIleri && i < a.enIleri + 30) a.enIleri = i; }
      if (!a.bitti && a.ci >= d.bitisI && a.enIleri >= d.bitisI - 30) { a.bitti = true; ol.push({ tip: 'bitis' }); }
    }
    return ol;
  }

  function arabaCarp(a, b, ol) {
    if (a.dus > 0 || b.dus > 0 || a.bitti || b.bitti || Math.abs(a.y - b.y) > 1) return;
    const dx = a.x - b.x, dz = a.z - b.z, dd = Math.hypot(dx, dz), en = ARABA_R * 2;
    if (dd >= en || dd < 1e-4) return;
    const nx = dx / dd, nz = dz / dd;
    a.x += nx * (en - dd) * 0.55; a.z += nz * (en - dd) * 0.55;
    const goreli = (a.vx - (b.vx || 0)) * nx + (a.vz - (b.vz || 0)) * nz;
    if (goreli < 0) { a.vx -= goreli * nx * 0.8; a.vz -= goreli * nz * 0.8; if (goreli < -5 && ol) ol.push({ tip: 'carpti', guc: -goreli, x: a.x - nx * ARABA_R, y: a.y, z: a.z - nz * ARABA_R }); }
  }

  // Başlangıç dizilişi (iki sıra)
  function baslangicYeri(d, i) {
    const sat = Math.floor(i / 2), yan = i % 2 ? 1.8 : -1.8;
    const t = 9 - sat * 3.2;
    return { x: t, y: 0, z: yan, a: 0 };
  }

  // ---------- Tuzak yerleştirme kuralları ----------
  function yerlestirmeHatasi(d, tur, x, y, z, r) {
    const T = TURLER[tur];
    if (!T || T.kisisel) return 'Bu parça haritaya konmaz';
    if (tur === 'silgi') return silgiHedefi(d, x, y, z) ? null : 'Sökülecek tuzak yok';
    if (tur === 'bomba') return null;
    const zm = zemin(d, x, z, y + 0.5, 0);
    if (!zm || Math.abs(zm.h - y) > 0.8) return 'Yolun üstüne koymalısın';
    if (zm.s.rampa) return 'Rampanın üstüne konmaz';
    const i = ilerlemeBul(d, x, zm.h, z);
    if (i < 0) return 'Yolun üstüne koymalısın';
    if (i < BAS_UZ + 2) return 'Başlangıca çok yakın';
    if (i > d.bitisI - 6) return 'Bitişe çok yakın';
    if (tur === 'duvar' || tur === 'korkuluk') {
      const P = d.cizgi[i], [lo, hi] = yanAralik(x, z, r, tur === 'duvar' ? 2.2 : 3, tur === 'duvar' ? 0.55 : 0.2, P);
      if (Math.max(lo + P.w / 2, P.w / 2 - hi) < 2.7) return 'Yanında araba geçecek yer kalmalı';
    }
    for (const p of d.parcalar) {
      const dd = Math.hypot(p.x - x, p.z - z), dy = Math.abs((p.y || 0) - zm.h);
      if (dy < 2 && dd < 2.6) return 'Başka bir tuzağın üstüne denk geliyor';
      if (dy < 2 && dd < 7 && ['duvar', 'blok'].includes(tur) && ['duvar', 'blok'].includes(p.tur)) return 'Yolu tamamen kapatamazsın';
    }
    return null;
  }
  // Döndürülmüş kutunun, yol orta çizgisine göre yan aralığı [en sol, en sağ]
  function yanAralik(x, z, r, hu, hv, P) {
    const yanlar = [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([su, sv]) => { const [kx, kz] = dunyaya(x, z, r, su * hu, sv * hv); return (kx - P.x) * -Math.sin(P.a) + (kz - P.z) * Math.cos(P.a); });
    return [Math.min(...yanlar), Math.max(...yanlar)];
  }
  function silgiHedefi(d, x, y, z) {
    let en = null, ed = SILGI_R + 1.5;
    for (const p of d.parcalar) { if (Math.abs((p.y || 0) - y) > 2) continue; const dd = Math.hypot(p.x - x, p.z - z); if (dd < ed) { ed = dd; en = p; } }
    return en;
  }
  function bombaHedefleri(d, x, y, z) { return d.parcalar.filter(p => Math.abs((p.y || 0) - y) < 3 && Math.hypot(p.x - x, p.z - z) < BOMBA_R); }

  // ---------- Bot sürücü: orta çizgiyi izler, tuzakların yanından geçer ----------
  function botGirdi(bot, d, t, dt) {
    const a = bot.a, C = d.cizgi, N = C.length;
    if (a.dus || a.bitti) return { gaz: 0, don: 0 };
    if (a.havada) return { gaz: 1, don: 0 };
    if (bot.geri > 0) { bot.geri -= dt; return { gaz: -1, don: bot.geriDon }; }
    const sp = Math.hypot(a.vx, a.vz);
    bot.sikisma = sp < 1.5 ? (bot.sikisma || 0) + dt : 0;
    if (bot.sikisma > 1.4) { bot.sikisma = 0; bot.geri = 0.8; bot.geriDon = Math.random() < 0.5 ? -1 : 1; }
    const ci = Math.max(0, a.ci);
    let atla = false;
    for (let j = ci; j < Math.min(N, ci + 16); j++) if (C[j].rampa || C[j].bosluk) { atla = true; break; }
    // önümdeki ilk tuzağın yanından geç
    let yanHedef = 0, bulundu = false;
    const dusun = (x, y, z, rad, kutu) => {
      if (bulundu) return;
      for (let j = ci + 2; j < Math.min(N, ci + 20); j += 2) {
        const p = C[j]; if (Math.abs(p.y - y) > 2) continue;
        const dx = x - p.x, dz = z - p.z; if (dx * dx + dz * dz > (p.w / 2 + rad + 1) ** 2) continue;
        const yan = dx * -Math.sin(p.a) + dz * Math.cos(p.a), ileri = dx * Math.cos(p.a) + dz * Math.sin(p.a);
        if (Math.abs(ileri) > rad + 1.5) continue;
        const delikMi = kutu && kutu.delik, sinir = p.w / 2 - (delikMi ? 0.95 : 1.1), pay = delikMi ? 1.0 : 1.4;
        const [lo, hi] = kutu ? yanAralik(kutu.cx, kutu.cz, kutu.r, kutu.hu, kutu.hv, p) : [yan - rad, yan + rad];
        const sol = lo - pay, sag = hi + pay;   // engelin solundan ya da sağından geç
        let hedef = Math.abs(sol) < Math.abs(sag) ? sol : sag;
        if (Math.abs(hedef) > sinir) hedef = Math.abs(sol) <= sinir ? sol : Math.abs(sag) <= sinir ? sag : (Math.sign(-yan) || 1) * sinir;
        yanHedef = Math.max(-sinir, Math.min(sinir, hedef)); bulundu = true; return;
      }
    };
    for (const al of d.alan) if (al.tip !== 'turbo') dusun(al.x, al.y, al.z, al.yr || 1.5);
    for (const e of d.engel) if (!e.direk && !e.kenar) dusun(e.cx, e.y0, e.cz, Math.max(e.hu, e.hv), e);
    for (const m of d.hareketli) if (m.tip === 'blok') dusun(m.cx, m.y0, m.cz, 2.2);
    for (const k of d.yol.delikler) dusun(k.cx, k.y, k.cz, k.hu, { cx: k.cx, cz: k.cz, r: k.r, hu: k.hu + 0.4, hv: k.hv, delik: true });
    if (atla) yanHedef = 0;
    bot.yan = (bot.yan || 0) + (yanHedef - (bot.yan || 0)) * Math.min(1, dt * 3);
    const j = Math.min(N - 1, ci + Math.round(atla ? 8 : 4 + sp * 0.35));
    const P = C[j];
    const tx = P.x - Math.sin(P.a) * bot.yan, tz = P.z + Math.cos(P.a) * bot.yan;
    let fark = aciFark(a.a, Math.atan2(tz - a.z, tx - a.x));
    fark += (bot.hata || 0) * Math.sin(t * 1.7 + (bot.no || 0));
    const don = Math.max(-1, Math.min(1, fark * 2.4));
    let gaz = Math.abs(fark) < 0.5 ? 1 : Math.abs(fark) < 1.2 ? 0.55 : 0.25;
    if (Math.abs(fark) > 2.3 && sp < 4) gaz = -0.6;
    // viraja girerken yavaşla
    const k1 = C[Math.min(N - 1, ci + 2)], k2 = C[Math.min(N - 1, ci + 4 + Math.round(sp * 1.2))];
    const viraj = Math.abs(aciFark(k1.a, k2.a));
    if (!atla && viraj > 0.7 && sp > 10) gaz = sp > 13 ? -0.7 : sp > 11.5 ? -0.2 : 0.2;
    if (atla) gaz = 1;
    // dar yolda dikkatli
    if (!atla && P.w < 5 && sp > 11) gaz = Math.min(gaz, 0.3);
    // hareketli tuzak önümdeyse bekle
    if (!atla) for (const m of d.hareketli) {
      if (m.tip === 'blok' || Math.abs(m.y0 - a.y) > 2) continue;
      const mu = Math.hypot(m.cx - a.x, m.cz - a.z);
      if (mu > 10) continue;
      if (mu < (m.tip === 'pervane' ? 3.9 : 3.8)) { gaz = 1; continue; }
      const yakin = [1.5, 3, 4.5].map(l => [a.x + Math.cos(a.a) * l, a.z + Math.sin(a.a) * l]);
      const tehlike = yakin.some(([px, pz]) => [t, t + 0.35].some(tt => {
        const hd = hareketliDurum(m, tt);
        if (m.tip === 'pervane') { const r = Math.hypot(px - m.cx, pz - m.cz); if (r > 3.8) return false; let fa = Math.atan2(pz - m.cz, px - m.cx) - hd.aci; fa = ((fa % PI) + PI) % PI; return Math.min(fa, PI - fa) < 0.75; }
        return Math.hypot(px - hd.x, pz - hd.z) < 2.5;
      }));
      if (tehlike) { bot.bekle = (bot.bekle || 0) + dt; if (bot.bekle < 4) return { gaz: sp > 1 ? -0.5 : 0, don: 0 }; }
    }
    bot.bekle = Math.max(0, (bot.bekle || 0) - dt * 0.5);
    // önümde yol yoksa fren
    if (!atla && sp > 3) { const l = sp * 0.35; if (!zemin(d, a.x + a.vx / sp * l, a.z + a.vz / sp * l, a.y + 0.5, 0)) gaz = -0.7; }
    return { gaz, don: gaz < 0 ? -don : don, turbo: a.nitro > 0 && Math.abs(fark) < 0.2 && sp > 10 && viraj < 0.3 && !atla && (a.nitroYaniyor || Math.random() < 0.05) };
  }

  const api = { ORTAMLAR, YOLLAR, YOL_KARTLARI, TURLER, KATLAR, SILGI_R, BOMBA_R, ARABA_R, AZAMI_HIZ, GENIS, ZEMIN_Y, BAS_UZ, G,
    yolKur, uygunYol, cakisma, kur, parcaSekli, zemin, yuzeyYuk, hareketliDurum, adim, arabaCarp, yeniAraba, yenidenDog, ilerlemeBul,
    baslangicYeri, yerlestirmeHatasi, silgiHedefi, bombaHedefleri, botGirdi, yerel, dunyaya, karma, aciFark };
  if (typeof module !== 'undefined') module.exports = api;
  return api;
})();
