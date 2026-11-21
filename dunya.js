// =============================================================
// Oyuncak Rallisi - dünya: haritalar, parçalar, araba fiziği, botların yol haritası.
// Bu dosya hem tarayıcıda hem Node'da (test) çalışır. Three.js kullanmaz.
// Yön kuralı: açı a için ileri yön (cos a, sin a) [x, z]. Parçanın yerel u ekseni ileri, v ekseni yan.
// =============================================================

const Dunya = (() => {
  const PI = Math.PI;
  const G = 22;              // yerçekimi
  const ARABA_R = 0.9;       // arabanın çarpışma yarıçapı
  const AZAMI_HIZ = 13;

  // ---------- Haritalar ----------
  // adalar: masadaki kuleler (üstleri yol). kopruler: başlangıçta var olan cetveller [x1,z1,x2,z2]
  const HARITALAR = {
    masa: {
      ad: 'Çalışma Masası', emoji: '📚',
      sinir: { x0: -44, x1: 44, z0: -21, z1: 21 },
      adalar: [
        { cx: -35, cz: 0, w: 14, l: 16 }, { cx: -17, cz: -10, w: 10, l: 8 }, { cx: -2, cz: 8, w: 10, l: 10 },
        { cx: 14, cz: -8, w: 10, l: 10 }, { cx: 35, cz: 2, w: 14, l: 16 },
      ],
      kopruler: [[-29, -5, -21, -9], [-13, -7, -6, 5], [2, 6, 10, -5], [18, -6, 29, -1]],
      baslangic: { x: -37, z: 0, a: 0 }, bitis: { x: 37, z: 2, r: 4 },
    },
    mutfak: {
      ad: 'Mutfak Tezgâhı', emoji: '🍳',
      sinir: { x0: -44, x1: 44, z0: -21, z1: 21 },
      adalar: [
        { cx: -36, cz: -8, w: 12, l: 14 }, { cx: -20, cz: 8, w: 9, l: 9 }, { cx: -4, cz: -6, w: 10, l: 8 },
        { cx: 10, cz: 10, w: 9, l: 9 }, { cx: 24, cz: -4, w: 8, l: 8 }, { cx: 37, cz: 6, w: 12, l: 14 },
      ],
      kopruler: [[-31, -4, -23, 6], [-16, 6, -7, -4], [0, -5, 7, 8], [13, 7, 22, -2], [27, -3, 33, 3]],
      baslangic: { x: -38, z: -8, a: 0 }, bitis: { x: 38, z: 7, r: 4 },
    },
  };

  // ---------- Parça türleri ----------
  // kat: yol, engel, kaygan, patlar, fayda.  kisisel: haritaya konmaz, sahibine sonraki yarışta güç verir
  const TURLER = {
    cetvel:  { ad: 'Cetvel Köprü',    emoji: '📏', kat: 'yol',    agirlik: 10, acik: 'Uzun bir yol. Boşlukların üstüne köprü kur, kısa yol aç.' },
    kitap:   { ad: 'Kitap Platform',  emoji: '📘', kat: 'yol',    agirlik: 6,  acik: 'Kare, geniş bir yol parçası.' },
    rampa:   { ad: 'Atlama Rampası',  emoji: '🛹', kat: 'yol',    agirlik: 8,  acik: 'Hızla çıkan araba uçar. Boşlukların üstünden atla!' },
    turbo:   { ad: 'Hız Şeridi',      emoji: '⏩', kat: 'yol',    agirlik: 7,  acik: 'Üstünden geçen araba bir anlığına çok hızlanır.' },
    duvar:   { ad: 'Kitap Duvarı',    emoji: '🧱', kat: 'engel',  agirlik: 8,  acik: 'Yolu kapatan sağlam bir duvar.' },
    pervane: { ad: 'Dönen Cetvel',    emoji: '🌀', kat: 'engel',  agirlik: 7,  acik: 'Durmadan döner. Çarpanı savurur.' },
    cekic:   { ad: 'Oyuncak Tokmak',  emoji: '🔨', kat: 'engel',  agirlik: 6,  acik: 'Sağa sola sallanır, çarptığını fırlatır.' },
    blok:    { ad: 'Kayan Silgi',     emoji: '🧽', kat: 'engel',  agirlik: 6,  acik: 'İleri geri kayan koca bir silgi.' },
    yag:     { ad: 'Yağ Birikintisi', emoji: '🛢️', kat: 'kaygan', agirlik: 7,  acik: 'Kayarsın! Direksiyon tutmaz.' },
    bal:     { ad: 'Bal Gölü',        emoji: '🍯', kat: 'kaygan', agirlik: 7,  acik: 'Yapış yapış. Araba çok yavaşlar.' },
    mayin:   { ad: 'Kestane Fişeği',  emoji: '🧨', kat: 'patlar', agirlik: 8,  acik: 'Üstüne basan havaya uçar. Biraz sonra yeniden kurulur.' },
    yay:     { ad: 'Zıplama Yayı',    emoji: '🌀', kat: 'patlar', agirlik: 7,  acik: 'Arabayı yükseğe zıplatır. Duvarların üstünden atla!' },
    portal:  { ad: 'Işınlayıcı',      emoji: '🌌', kat: 'patlar', agirlik: 5,  acik: 'Mavi kapıya giren turuncu kapıdan çıkar.' },
    silgi:   { ad: 'Silgi',           emoji: '🩹', kat: 'fayda',  agirlik: 6,  acik: 'Haritaya konmuş bir parçayı siler.' },
    bomba:   { ad: 'Bomba',           emoji: '💣', kat: 'fayda',  agirlik: 4,  acik: 'Çevresindeki bütün konmuş parçaları patlatıp siler.' },
    korkuluk:{ ad: 'Korkuluk',        emoji: '🚧', kat: 'fayda',  agirlik: 6,  acik: 'Yol kenarına alçak bir bariyer. Düşmeni önler.' },
    kalkan:  { ad: 'Kalkan',          emoji: '🛡️', kat: 'fayda',  agirlik: 4,  acik: 'Sonraki yarışta ilk tuzak sana işlemez.', kisisel: true },
    nitro:   { ad: 'Nitro Şişesi',    emoji: '🔥', kat: 'fayda',  agirlik: 4,  acik: 'Sonraki yarışta 3 kez turbo (Boşluk).', kisisel: true },
  };
  const KATLAR = {
    yol: { ad: 'Yol ve rampa', renk: '#3a9ae0' }, engel: { ad: 'Engel', renk: '#e0603a' },
    kaygan: { ad: 'Kaygan / yapışkan', renk: '#c89a2a' }, patlar: { ad: 'Patlayan / fırlatan', renk: '#d03a8a' },
    fayda: { ad: 'Fayda', renk: '#3ab86a' },
  };
  const SILGI_R = 1.8, BOMBA_R = 5;

  // ---------- Yardımcılar ----------
  const yerel = (cx, cz, r, x, z) => { const dx = x - cx, dz = z - cz, c = Math.cos(r), s = Math.sin(r); return [dx * c + dz * s, -dx * s + dz * c]; };
  const dunyaya = (cx, cz, r, u, v) => { const c = Math.cos(r), s = Math.sin(r); return [cx + u * c - v * s, cz + u * s + v * c]; };
  function karma(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; }

  // Bir parçanın fiziksel karşılığı
  function parcaSekli(p) {
    const { x, z, r } = p, S = { yuzey: [], engel: [], hareketli: [], alan: [] };
    const faz = karma(p.id) * 6.283;
    switch (p.tur) {
      case 'cetvel': S.yuzey.push({ cx: x, cz: z, r, hu: 6, hv: 1.8, h0: 0, h1: 0 }); break;
      case 'kitap': S.yuzey.push({ cx: x, cz: z, r, hu: 3.5, hv: 3.5, h0: 0, h1: 0 }); break;
      case 'rampa': S.yuzey.push({ cx: x, cz: z, r, hu: 2.2, hv: 1.6, h0: 0, h1: 1.4, rampa: true }); break;
      case 'turbo': S.yuzey.push({ cx: x, cz: z, r, hu: 2, hv: 1.3, h0: 0, h1: 0 }); S.alan.push({ tip: 'turbo', x, z, r, hu: 2, hv: 1.3 }); break;
      case 'duvar': S.engel.push({ cx: x, cz: z, r, hu: 2.5, hv: 0.5, ust: 1.6 }); break;
      case 'pervane': S.engel.push({ cx: x, cz: z, r: 0, hu: 0.4, hv: 0.4, ust: 2.2 }); S.hareketli.push({ tip: 'pervane', cx: x, cz: z, r, faz, yon: karma(p.id + 'y') < 0.5 ? 1 : -1 }); break;
      case 'cekic': {
        for (const v of [-3.2, 3.2]) { const [a, b] = dunyaya(x, z, r, 0, v); S.engel.push({ cx: a, cz: b, r, hu: 0.3, hv: 0.3, ust: 3.5 }); }
        S.hareketli.push({ tip: 'cekic', cx: x, cz: z, r, faz }); break;
      }
      case 'blok': S.hareketli.push({ tip: 'blok', cx: x, cz: z, r, faz }); break;
      case 'yag': S.alan.push({ tip: 'yag', x, z, yr: 2.2 }); break;
      case 'bal': S.alan.push({ tip: 'bal', x, z, yr: 2.2 }); break;
      case 'mayin': S.alan.push({ tip: 'mayin', x, z, yr: 0.9, pid: p.id }); break;
      case 'yay': S.alan.push({ tip: 'yay', x, z, yr: 1.2 }); break;
      case 'portal': { const [ax, az] = dunyaya(x, z, r, -5, 0), [bx, bz] = dunyaya(x, z, r, 5, 0); S.alan.push({ tip: 'portal', x: ax, z: az, yr: 1.3, bx, bz, r }); break; }
      case 'korkuluk': S.engel.push({ cx: x, cz: z, r, hu: 3, hv: 0.25, ust: 0.7, alcak: true }); break;
    }
    return S;
  }

  // Haritadaki her şeyi tek bir dünyada topla
  function kur(haritaAd, parcalar) {
    const h = HARITALAR[haritaAd] || HARITALAR.masa;
    const d = { haritaAd, h, yuzey: [], engel: [], hareketli: [], alan: [], parcalar: parcalar || [], mayinKapali: new Map() };
    h.adalar.forEach(a => d.yuzey.push({ cx: a.cx, cz: a.cz, r: 0, hu: a.w / 2, hv: a.l / 2, h0: 0, h1: 0, ada: true }));
    h.kopruler.forEach(([x1, z1, x2, z2]) => d.yuzey.push({ cx: (x1 + x2) / 2, cz: (z1 + z2) / 2, r: Math.atan2(z2 - z1, x2 - x1), hu: Math.hypot(x2 - x1, z2 - z1) / 2 + 0.8, hv: 2, h0: 0, h1: 0, kopru: true }));
    d.parcalar.forEach(p => { const S = parcaSekli(p); for (const k in S) S[k].forEach(o => { o.pid = p.id; d[k].push(o); }); });
    return d;
  }
  // Temel kopru parçalarını (çizim için) ver
  function temelKopruler(haritaAd) { return kur(haritaAd, []).yuzey.filter(y => y.kopru); }

  // ---------- Zemin ----------
  function yuzeyYuk(y, u) { return y.h0 === y.h1 ? y.h0 : y.h0 + (u + y.hu) / (2 * y.hu) * (y.h1 - y.h0); }
  // (x,z) altındaki, y'den çok yukarıda olmayan en yüksek yüzey
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

  // ---------- Hareketli engellerin o anki yeri ----------
  function hareketliDurum(m, t) {
    if (m.tip === 'pervane') return { aci: m.r + m.yon * (t * 1.25 + m.faz) };
    if (m.tip === 'cekic') { const s = Math.sin(t * 2.1 + m.faz); const [x, z] = dunyaya(m.cx, m.cz, m.r, 0, s * 2.8); return { x, z, s, hiz: Math.cos(t * 2.1 + m.faz) }; }
    if (m.tip === 'blok') { const off = Math.sin(t * 1.3 + m.faz) * 3; const [x, z] = dunyaya(m.cx, m.cz, m.r, off, 0); return { x, z, hiz: Math.cos(t * 1.3 + m.faz) }; }
    return {};
  }

  // Daire - döndürülmüş kutu çarpışması: itme vektörü ya da null
  function daireKutu(x, z, rad, cx, cz, r, hu, hv) {
    const [u, v] = yerel(cx, cz, r, x, z);
    const qu = Math.max(-hu, Math.min(hu, u)), qv = Math.max(-hv, Math.min(hv, v));
    let du = u - qu, dv = v - qv, dd = Math.hypot(du, dv);
    if (dd >= rad) return null;
    let nu, nv, der;
    if (dd > 1e-6) { nu = du / dd; nv = dv / dd; der = rad - dd; }
    else { // merkez kutunun içinde: en yakın kenardan çıkar
      const pu = hu - Math.abs(u), pv = hv - Math.abs(v);
      if (pu < pv) { nu = Math.sign(u) || 1; nv = 0; der = pu + rad; } else { nu = 0; nv = Math.sign(v) || 1; der = pv + rad; }
    }
    const c = Math.cos(r), s = Math.sin(r);
    return { nx: nu * c - nv * s, nz: nu * s + nv * c, der };
  }

  // ---------- Araba ----------
  function yeniAraba(x, z, a) {
    return { x, y: 0, z, a, vx: 0, vz: 0, vy: 0, vyT: 0, havada: false, dus: 0, turboT: 0, nitro: 0, kalkan: 0,
      cpx: x, cpz: z, cpa: a, portalT: 0, spin: 0, spinV: 0, sersem: 0, bitti: false, hizCarp: 1, kayiyor: 0, yerde: 'yol' };
  }
  function yenidenDog(a) {
    Object.assign(a, { x: a.cpx, z: a.cpz, y: 0.6, a: a.cpa, vx: 0, vz: 0, vy: 0, vyT: 0, havada: true, dus: 0, spin: 0, spinV: 0, sersem: 0, turboT: 0 });
  }
  function vur(a, nx, nz, guc, yuk, ol, tip) {
    if (a.kalkan > 0) { a.kalkan = 0; a.vx = nx * 5; a.vz = nz * 5; ol.push({ tip: 'kalkan' }); return; }
    a.vx = nx * guc; a.vz = nz * guc; a.vy = yuk; a.havada = true; a.spinV = (Math.random() < 0.5 ? -1 : 1) * (8 + Math.random() * 6); a.sersem = 0.4;
    ol.push({ tip: tip || 'vurdu' });
  }

  // Bir adım (dt saniye). g = { gaz: -1..1, don: -1..1, turbo: bool }. t = yarış zamanı. ol: olay listesi
  function adim(a, g, d, t, dt, ol = []) {
    if (a.bitti && !a.havada && Math.hypot(a.vx, a.vz) < 0.3) return ol;
    a.portalT -= dt; a.sersem -= dt; a.turboT -= dt;
    if (a.dus > 0) {
      a.vy -= G * dt; a.y += a.vy * dt; a.x += a.vx * dt * 0.6; a.z += a.vz * dt * 0.6; a.spin += a.spinV * dt;
      if (a.y < -9.5) { yenidenDog(a); ol.push({ tip: 'dogdu' }); }
      return ol;
    }
    let fx = Math.cos(a.a), fz = Math.sin(a.a);
    // bulunduğu alanların etkisi
    let tutus = 7, hizCarp = 1, ivme = 1;
    a.kayiyor = 0; a.yerde = 'yol';
    const yerYakin = !a.havada || a.y < 0.4;
    if (yerYakin) for (const al of d.alan) {
      let icinde;
      if (al.hu) { const [u, v] = yerel(al.x, al.z, al.r, a.x, a.z); icinde = Math.abs(u) <= al.hu && Math.abs(v) <= al.hv; }
      else icinde = Math.hypot(a.x - al.x, a.z - al.z) < al.yr + (al.tip === 'mayin' || al.tip === 'yay' ? 0.5 : 0);
      if (!icinde) continue;
      if (al.tip === 'yag') { tutus = 0.35; ivme = 0.45; a.kayiyor = 1; a.yerde = 'yag'; }
      else if (al.tip === 'bal') { hizCarp = 0.33; ivme = 0.5; a.yerde = 'bal'; }
      else if (al.tip === 'turbo' && !a.havada) { if (a.turboT < 0.9) ol.push({ tip: 'turbo' }); a.turboT = Math.max(a.turboT, 0.8); }
      else if (al.tip === 'mayin' && !a.havada) {
        if ((d.mayinKapali.get(al.pid) ?? -1) > t) continue;
        d.mayinKapali.set(al.pid, t + 4);
        ol.push({ tip: 'mayin', pid: al.pid, x: al.x, z: al.z });
        const aci = Math.random() * PI * 2;
        vur(a, Math.cos(aci) * 0.4 - fx * 0.6, Math.sin(aci) * 0.4 - fz * 0.6, 7, 10.5, ol, 'patladi');
      }
      else if (al.tip === 'yay' && !a.havada) { a.vy = 10.5; a.vx *= 0.6; a.vz *= 0.6; a.havada = true; a.spinV = 0; ol.push({ tip: 'yay' }); }
      else if (al.tip === 'portal' && a.portalT <= 0) {
        const sp = Math.hypot(a.vx, a.vz), cik = Math.max(sp, 8);
        a.a = al.r; a.x = al.bx + Math.cos(a.a) * 1.6; a.z = al.bz + Math.sin(a.a) * 1.6; a.portalT = 1.2;   // turuncu kapıdan kapının yönünde çıkar
        a.vx = Math.cos(a.a) * cik; a.vz = Math.sin(a.a) * cik;
        ol.push({ tip: 'portal', x: al.x, z: al.z, bx: al.bx, bz: al.bz });
      }
    }
    a.hizCarp = hizCarp;
    // sürüş
    if (!a.havada) {
      let f = a.vx * fx + a.vz * fz, l = -a.vx * fz + a.vz * fx;
      if (g.turbo && a.nitro > 0 && a.turboT <= 0) { a.nitro--; a.turboT = 1.6; ol.push({ tip: 'nitro' }); }
      const azami = AZAMI_HIZ * hizCarp * (a.turboT > 0 ? 1.65 : 1) * (a.sinir || 1);
      const kontrol = a.sersem > 0 || a.bitti ? 0 : 1;
      const gaz = g.gaz * kontrol;
      if (a.turboT > 0 && kontrol && gaz >= 0) f = Math.min(azami, f + 45 * dt);
      else if (gaz > 0) { if (f < azami) f = Math.min(azami, f + 30 * gaz * ivme * dt); else f -= (f - azami) * 4 * dt; }
      else if (gaz < 0) { if (f > 0.5) f -= 42 * dt; else f = Math.max(-7 * hizCarp, f - 20 * ivme * dt); }
      else f -= f * (a.bitti ? 3 : 1.3) * dt;
      if (f > azami + 0.5 && a.turboT <= 0) f -= (f - azami) * 4 * dt;
      if (Math.abs(l) > 4 && tutus > 2) a.kayiyor = Math.max(a.kayiyor, Math.min(1, (Math.abs(l) - 4) / 6));
      l *= Math.exp(-tutus * dt);
      const donus = g.don * kontrol * 2.6 * Math.max(-1, Math.min(1, f / 5)) * (tutus < 1 ? 0.6 : 1);
      a.a += donus * dt;
      fx = Math.cos(a.a); fz = Math.sin(a.a);
      a.vx = fx * f - fz * l; a.vz = fz * f + fx * l;
    } else { a.vx *= 1 - 0.15 * dt; a.vz *= 1 - 0.15 * dt; }

    // hareket
    a.x += a.vx * dt; a.z += a.vz * dt;
    // sabit engeller
    for (const e of d.engel) {
      if (a.y > e.ust - 0.15) continue;
      const c = daireKutu(a.x, a.z, ARABA_R, e.cx, e.cz, e.r, e.hu, e.hv);
      if (!c) continue;
      a.x += c.nx * c.der; a.z += c.nz * c.der;
      const vn = a.vx * c.nx + a.vz * c.nz;
      if (vn < 0) { a.vx -= vn * c.nx * 1.4; a.vz -= vn * c.nz * 1.4; if (vn < -4) ol.push({ tip: 'carpti', guc: -vn, x: a.x - c.nx * ARABA_R, z: a.z - c.nz * ARABA_R }); }
    }
    // hareketli engeller
    for (const m of d.hareketli) {
      const hd = hareketliDurum(m, t);
      if (m.tip === 'pervane') {
        if (a.y > 1.1) continue;
        const c = daireKutu(a.x, a.z, ARABA_R, m.cx, m.cz, hd.aci, 3.1, 0.35);
        if (!c) continue;
        a.x += c.nx * c.der; a.z += c.nz * c.der;
        // kolun dönüş yönünde savur
        const rx = a.x - m.cx, rz = a.z - m.cz, rl = Math.hypot(rx, rz) || 1;
        const tx = -rz / rl * m.yon, tz = rx / rl * m.yon;
        const nx = tx * 0.75 + rx / rl * 0.35, nz = tz * 0.75 + rz / rl * 0.35, nl = Math.hypot(nx, nz);
        vur(a, nx / nl, nz / nl, 6 + rl * 0.8, 3.2, ol);
      } else if (m.tip === 'cekic') {
        if (a.y > 2.2) continue;
        if (Math.hypot(a.x - hd.x, a.z - hd.z) > ARABA_R + 1.0) continue;
        const [vx, vz] = [-Math.sin(m.r), Math.cos(m.r)], yon = Math.sign(hd.hiz) || 1;
        a.x += vx * yon * 0.8; a.z += vz * yon * 0.8;
        vur(a, vx * yon, vz * yon, 11, 6, ol);
      } else if (m.tip === 'blok') {
        if (a.y > 1.2) continue;
        const c = daireKutu(a.x, a.z, ARABA_R, hd.x, hd.z, m.r, 0.95, 0.95);
        if (!c) continue;
        a.x += c.nx * c.der; a.z += c.nz * c.der;
        const vn = a.vx * c.nx + a.vz * c.nz;
        if (vn < 0) { a.vx -= vn * c.nx * 1.3; a.vz -= vn * c.nz * 1.3; }
        const [ux, uz] = [Math.cos(m.r), Math.sin(m.r)], it = hd.hiz * 3.9;
        if (ux * c.nx + uz * c.nz > 0.3 === it > 0 && Math.abs(it) > 1) { a.vx += ux * it; a.vz += uz * it; ol.push({ tip: 'carpti', guc: 6, x: a.x, z: a.z }); }
      }
    }

    // dikey
    if (!a.havada) {
      const zm = zemin(d, a.x, a.z, a.y);
      if (zm && zm.h >= a.y - 0.4) { const yeni = zm.h; a.vyT = (yeni - a.y) / dt; a.y = yeni; a.rampada = !!zm.s.rampa && a.vyT > 0.5; }
      else {
        a.havada = true; a.vy = Math.max(0, a.vyT) * 1.15;
        if (a.rampada) {   // rampadan çıkan araba her zaman güzelce uçar
          const f = a.vx * Math.cos(a.a) + a.vz * Math.sin(a.a), ek = Math.max(0, 12.5 - f);
          a.vx += Math.cos(a.a) * ek; a.vz += Math.sin(a.a) * ek; a.vy = Math.max(a.vy, 6.5);
        }
        a.rampada = false;
        ol.push({ tip: 'havalandi', yuk: a.vy });
      }
    }
    if (a.havada) {
      a.vy -= G * dt; a.y += a.vy * dt; a.spin += a.spinV * dt;
      const zm = zemin(d, a.x, a.z, a.y + 0.3);
      if (zm && a.y <= zm.h && a.vy <= 0 && a.y > zm.h - 0.8) {
        const sert = -a.vy;
        a.y = zm.h; a.havada = false; a.vy = 0; a.vyT = 0; a.spinV = 0; a.spin = 0;
        ol.push({ tip: 'indi', guc: sert });
      } else if (a.y < -1.3) { a.dus = 1; ol.push({ tip: 'dustu' }); }
    }
    // güvenli yer: etrafı yol olan, tuzaksız bir yerde yere bastığın son nokta. Düşünce buradan devam edersin.
    a.guvenT = (a.guvenT || 0) - dt;
    if (!a.havada && a.sersem <= 0 && a.guvenT <= 0 && !a.bitti) {
      a.guvenT = 0.25;
      const sp = Math.hypot(a.vx, a.vz);
      if (sp > 2 && a.y < 0.1) {
        const R = 2.3;
        const etraf = [[R, 0], [-R, 0], [0, R], [0, -R], [R, R], [-R, -R], [R, -R], [-R, R]].every(([dx, dz]) => { const zz = zemin(d, a.x + dx, a.z + dz, 0.5, 0); return zz && zz.h < 0.1; });
        if (etraf && !d.alan.some(al => Math.hypot(al.x - a.x, al.z - a.z) < (al.yr || 2.5) + 1.5) && !d.hareketli.some(m => Math.hypot(m.cx - a.x, m.cz - a.z) < 5.5)) {
          a.cpx = a.x - a.vx / sp * 1.2; a.cpz = a.z - a.vz / sp * 1.2; a.cpa = Math.atan2(a.vz, a.vx);
        }
      }
    }
    // bitiş
    const b = d.h.bitis;
    if (!a.bitti && !a.havada && Math.hypot(a.x - b.x, a.z - b.z) < b.r) { a.bitti = true; ol.push({ tip: 'bitis' }); }
    return ol;
  }

  // İki araba çarpışırsa a'yı it (b'nin hızını da biraz al)
  function arabaCarp(a, b, ol) {
    if (a.dus > 0 || b.dus > 0 || a.bitti || b.bitti || Math.abs(a.y - b.y) > 1) return;
    const dx = a.x - b.x, dz = a.z - b.z, dd = Math.hypot(dx, dz), en = ARABA_R * 2;
    if (dd >= en || dd < 1e-4) return;
    const nx = dx / dd, nz = dz / dd;
    a.x += nx * (en - dd) * 0.55; a.z += nz * (en - dd) * 0.55;
    const goreli = (a.vx - (b.vx || 0)) * nx + (a.vz - (b.vz || 0)) * nz;
    if (goreli < 0) { a.vx -= goreli * nx * 0.8; a.vz -= goreli * nz * 0.8; if (goreli < -5 && ol) ol.push({ tip: 'carpti', guc: -goreli, x: a.x - nx * ARABA_R, z: a.z - nz * ARABA_R }); }
  }

  // Başlangıç yerleri
  function baslangicYeri(haritaAd, i) {
    const b = (HARITALAR[haritaAd] || HARITALAR.masa).baslangic;
    const sut = Math.floor(i / 3), sat = i % 3;
    return { x: b.x - sut * 2.8 + (sat === 1 ? 0.8 : 0), z: b.z + (sat - 1) * 3.2, a: b.a };
  }

  // ---------- Yerleştirme kuralları ----------
  function yerlestirmeHatasi(d, tur, x, z, r, hizli) {
    const h = d.h, T = TURLER[tur];
    if (!T) return 'Bilinmeyen parça';
    if (x < h.sinir.x0 || x > h.sinir.x1 || z < h.sinir.z0 || z > h.sinir.z1) return 'Masanın dışı';
    if (tur === 'silgi') return silgiHedefi(d, x, z) ? null : 'Silinecek parça yok';
    if (tur === 'bomba') return null;
    const yolMu = T.kat === 'yol';
    const bas = h.baslangic, bit = h.bitis;
    if (!yolMu || tur === 'turbo') {
      if (Math.hypot(x - bas.x, z - bas.z) < 6.5) return 'Başlangıca çok yakın';
      if (Math.hypot(x - bit.x, z - bit.z) < bit.r + 2.5) return 'Bitişe çok yakın';
    }
    if (tur === 'portal') for (const u of [-5, 5]) {
      const [px, pz] = dunyaya(x, z, r, u, 0);
      if (Math.hypot(px - bas.x, pz - bas.z) < 6.5 || Math.hypot(px - bit.x, pz - bit.z) < bit.r + 2.5) return 'Kapılar başlangıç/bitişe çok yakın';
      const zm = zemin(d, px, pz, 1, -0.8); if (!zm || zm.h > 0.1) return 'İki kapı da yolun üstünde olmalı';
    }
    if (tur === 'portal') { const [px, pz] = dunyaya(x, z, r, 8, 0); if (!zemin(d, px, pz, 1)) return 'Turuncu kapının önünde yol olmalı'; }
    // Başka bir parçanın tam üstüne konamaz
    for (const p of d.parcalar) {
      const yol2 = TURLER[p.tur].kat === 'yol';
      const en = yolMu && yol2 ? 1.5 : yolMu || yol2 ? 0.8 : 2.2;
      if (Math.hypot(p.x - x, p.z - z) < en) return 'Başka bir parçanın üstüne denk geliyor';
    }
    // Yolu tamamen kapatmak yasak: bitişe giden bir yol hep kalmalı
    if (!hizli && (tur === 'duvar' || tur === 'cekic' || tur === 'pervane' || tur === 'korkuluk')) {
      const d2 = kur(d.haritaAd, [...d.parcalar, { id: 'deneme', tur, x, z, r }]);
      if (baslangicUzakligi(d2) >= 1e8) return 'Yolu tamamen kapatıyor';
    }
    return null;
  }
  // Silginin sileceği parça (en yakın, kişisel olmayan)
  function silgiHedefi(d, x, z) {
    let en = null, ed = SILGI_R + 1.2;
    for (const p of d.parcalar) {
      const dd = parcaUzaklik(p, x, z);
      if (dd < ed) { ed = dd; en = p; }
    }
    return en;
  }
  function parcaUzaklik(p, x, z) {
    const S = parcaSekli(p); let en = Math.hypot(x - p.x, z - p.z);
    S.yuzey.concat(S.engel).forEach(y => { const [u, v] = yerel(y.cx, y.cz, y.r, x, z); en = Math.min(en, Math.hypot(Math.max(0, Math.abs(u) - y.hu), Math.max(0, Math.abs(v) - y.hv))); });
    S.alan.forEach(a => { en = Math.min(en, Math.max(0, Math.hypot(x - a.x, z - a.z) - (a.yr || 1))); if (a.bx !== undefined) en = Math.min(en, Math.hypot(x - a.bx, z - a.bz) - a.yr); });
    if (S.hareketli.length && p.tur === 'pervane') en = Math.min(en, Math.max(0, Math.hypot(x - p.x, z - p.z) - 3.1));
    return en;
  }
  function bombaHedefleri(d, x, z) { return d.parcalar.filter(p => parcaUzaklik(p, x, z) < BOMBA_R); }

  // ---------- Botlar için yol haritası (bitişe uzaklık alanı) ----------
  const HUCRE = 0.5;
  function yolHaritasi(d) {
    const s = d.h.sinir, W = Math.round((s.x1 - s.x0) / HUCRE), H = Math.round((s.z1 - s.z0) / HUCRE), N = W * H;
    const yurur = new Uint8Array(N), ek = new Float32Array(N), uz = new Float64Array(N).fill(1e9), sonraki = new Int32Array(N).fill(-1);
    const hx = i => s.x0 + (i % W + 0.5) * HUCRE, hz = i => s.z0 + (Math.floor(i / W) + 0.5) * HUCRE;
    const hucre = (x, z) => { const i = Math.floor((x - s.x0) / HUCRE), j = Math.floor((z - s.z0) / HUCRE); return i < 0 || j < 0 || i >= W || j >= H ? -1 : j * W + i; };
    for (let i = 0; i < N; i++) {
      const x = hx(i), z = hz(i), zm = zemin(d, x, z, 5, -0.55);
      if (!zm) continue;
      let ok = true;
      for (const e of d.engel) if (daireKutu(x, z, 1.0, e.cx, e.cz, e.r, e.hu, e.hv)) { ok = false; break; }
      if (!ok) continue;
      yurur[i] = 1;
      let c = 0;
      for (const al of d.alan) {
        const dd = Math.hypot(x - al.x, z - al.z);
        if (al.tip === 'mayin' && dd < 2.2) c += 14; else if (al.tip === 'yay' && dd < 2.2) c += 10; else if (al.tip === 'yag' && dd < 3) c += 2.5; else if (al.tip === 'bal' && dd < 3) c += 6;
      }
      for (const m of d.hareketli) {
        const dd = Math.hypot(x - m.cx, z - m.cz);
        if (m.tip === 'pervane' && dd < 4.2) c += 9; else if (m.tip === 'cekic' && dd < 3.5) c += 6; else if (m.tip === 'blok' && dd < 4.6) c += 3;
      }
      ek[i] = c;
    }
    // kenara yakın hücreler pahalı (bot ortadan gitsin)
    const kenar = new Uint8Array(N);
    for (let i = 0; i < N; i++) if (yurur[i]) {
      const x = i % W, y = Math.floor(i / W);
      let k = 0;
      for (let dy = -2; dy <= 2 && !k; dy++) for (let dx = -2; dx <= 2; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H || !yurur[yy * W + xx]) { k = Math.abs(dx) <= 1 && Math.abs(dy) <= 1 ? 2 : 1; break; } }
      kenar[i] = k;
    }
    for (let i = 0; i < N; i++) ek[i] += kenar[i] === 2 ? 3 : kenar[i] === 1 ? 0.8 : 0;
    // özel geçişler: rampadan atlama, ışınlayıcı
    const ozel = new Map();   // hedef hücre → [{kaynak, maliyet}]
    const ozelEkle = (k, h, m, bilgi) => { if (k < 0 || h < 0 || !yurur[k] || !yurur[h]) return; (ozel.get(h) || ozel.set(h, []).get(h)).push({ k, m, bilgi }); };
    for (const y of d.yuzey) if (y.rampa) {
      const ux = Math.cos(y.r), uz = Math.sin(y.r);
      const px = y.cx - ux * (y.hu + 1.8), pz = y.cz - uz * (y.hu + 1.8);
      // 12.5 hızla çıkınca ~9 birim ileri iner; 7.5-11 arası hep yol olmalı
      const yer = m => zemin(d, y.cx + ux * (y.hu + m), y.cz + uz * (y.hu + m), 1, -0.6);
      if (yer(7.5) && yer(9) && yer(11)) {
        const lx = y.cx + ux * (y.hu + 10), lz = y.cz + uz * (y.hu + 10);
        ozelEkle(hucre(px, pz), hucre(lx, lz), Math.hypot(lx - px, lz - pz) + 3, { tip: 'rampa', x: lx, z: lz });
      }
    }
    for (const al of d.alan) if (al.tip === 'portal') ozelEkle(hucre(al.x, al.z), hucre(al.bx + Math.cos(al.r) * 2.5, al.bz + Math.sin(al.r) * 2.5), 3, { tip: 'portal', x: al.bx, z: al.bz });
    // Dijkstra: bitişten geriye
    const yigin = [];
    const it = (i, v) => { yigin.push([v, i]); let k = yigin.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (yigin[p][0] <= yigin[k][0]) break; [yigin[p], yigin[k]] = [yigin[k], yigin[p]]; k = p; } };
    const al = () => { const ust = yigin[0], son = yigin.pop(); if (yigin.length) { yigin[0] = son; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < yigin.length && yigin[l][0] < yigin[m][0]) m = l; if (r < yigin.length && yigin[r][0] < yigin[m][0]) m = r; if (m === k) break; [yigin[m], yigin[k]] = [yigin[k], yigin[m]]; k = m; } } return ust; };
    const b = d.h.bitis;
    for (let i = 0; i < N; i++) if (yurur[i] && Math.hypot(hx(i) - b.x, hz(i) - b.z) < b.r - 0.5) { uz[i] = 0; it(i, 0); }
    const KOMSU = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    const ozelBilgi = new Map();
    while (yigin.length) {
      const [v, i] = al();
      if (v > uz[i]) continue;
      const x = i % W, y = Math.floor(i / W);
      for (const [dx, dy, m] of KOMSU) {
        const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const k = yy * W + xx; if (!yurur[k]) continue;
        if (dx && dy && (!yurur[y * W + xx] || !yurur[yy * W + x])) continue;
        const yeni = v + m * HUCRE * (1 + ek[k] * 0.25);
        if (yeni < uz[k]) { uz[k] = yeni; sonraki[k] = i; ozelBilgi.delete(k); it(k, yeni); }
      }
      const oz = ozel.get(i);
      if (oz) for (const o of oz) { const yeni = v + o.m; if (yeni < uz[o.k]) { uz[o.k] = yeni; sonraki[o.k] = i; ozelBilgi.set(o.k, o.bilgi); it(o.k, yeni); } }
    }
    return { W, H, uz, sonraki, yurur, ozelBilgi, hucre, hx, hz };
  }
  // Başlangıçtan bitişe yol noktaları
  function yolNoktalari(d, yh) {
    yh = yh || yolHaritasi(d);
    const b = d.h.baslangic;
    let i = enYakinYurur(yh, b.x, b.z, 8);
    const pts = [];
    for (let n = 0; i >= 0 && n < 4000; n++) { pts.push({ x: yh.hx(i), z: yh.hz(i), ozel: yh.ozelBilgi.get(i) }); if (yh.uz[i] === 0) break; i = yh.sonraki[i]; }
    return pts;
  }
  function enYakinYurur(yh, x, z, ar = 4) {
    const c = yh.hucre(x, z);
    if (c >= 0 && yh.yurur[c] && yh.uz[c] < 1e8) return c;
    let en = -1, ed = 1e9;
    const n = Math.ceil(ar / HUCRE), cx = Math.floor((x - (yh.hx(0) - HUCRE / 2)) / HUCRE), cz = Math.floor((z - (yh.hz(0) - HUCRE / 2)) / HUCRE);
    for (let dy = -n; dy <= n; dy++) for (let dx = -n; dx <= n; dx++) {
      const xx = cx + dx, yy = cz + dy; if (xx < 0 || yy < 0 || xx >= yh.W || yy >= yh.H) continue;
      const k = yy * yh.W + xx; if (!yh.yurur[k] || yh.uz[k] >= 1e8) continue;
      const dd = dx * dx + dy * dy; if (dd < ed) { ed = dd; en = k; }
    }
    return en;
  }
  function baslangicUzakligi(d, yh) { yh = yh || yolHaritasi(d); const b = d.h.baslangic; const i = enYakinYurur(yh, b.x, b.z, 8); return i < 0 ? 1e9 : yh.uz[i]; }

  // ---------- Bot sürücü ----------
  // bot: { a: araba, hedef, kilit, sikisma, geri, hata }
  function botGirdi(bot, d, yh, t, dt) {
    const a = bot.a;
    if (a.havada || a.dus || a.bitti) return { gaz: 1, don: 0 };
    if (bot.geri > 0) { bot.geri -= dt; return { gaz: -1, don: bot.geriDon }; }
    const sp = Math.hypot(a.vx, a.vz);
    bot.sikisma = sp < 1.5 ? (bot.sikisma || 0) + dt : 0;
    if (bot.sikisma > 1.3) { bot.sikisma = 0; bot.geri = 0.9; bot.geriDon = Math.random() < 0.5 ? -1 : 1; bot.kilit = null; }
    let tx, tz, ozelHedef = false;
    if (bot.kilit && bot.kilit.son > t) { tx = bot.kilit.x; tz = bot.kilit.z; ozelHedef = true; }
    else {
      bot.kilit = null;
      let i = enYakinYurur(yh, a.x + Math.cos(a.a) * 0.6, a.z + Math.sin(a.a) * 0.6, 3);
      if (i < 0) { const b = d.h.bitis; tx = b.x; tz = b.z; }
      else {
        let j = i, adimS = 0;
        const ileri = 5 + Math.min(6, sp * 0.35) / HUCRE * 0.5;
        while (adimS < ileri && yh.sonraki[j] >= 0) {
          const oz = yh.ozelBilgi.get(j);
          if (oz) { if (adimS < 3) { bot.kilit = { x: oz.x, z: oz.z, son: t + 2.2 }; ozelHedef = true; } tx = oz.x; tz = oz.z; break; }
          j = yh.sonraki[j]; adimS++;
        }
        if (tx === undefined) { tx = yh.hx(j); tz = yh.hz(j); }
      }
    }
    let fark = Math.atan2(tz - a.z, tx - a.x) - a.a;
    while (fark > PI) fark -= 2 * PI; while (fark < -PI) fark += 2 * PI;
    fark += (bot.hata || 0) * Math.sin(t * 1.7 + (bot.no || 0));
    const don = Math.max(-1, Math.min(1, fark * 2.4));
    let gaz = Math.abs(fark) < 0.5 ? 1 : Math.abs(fark) < 1.2 ? 0.55 : 0.25;
    // dönen kol / tokmak / kayan silgi önümdeyse bekle
    if (!ozelHedef) {
      const yakin = [1.5, 3, 4.5].map(l => [a.x + Math.cos(a.a) * l, a.z + Math.sin(a.a) * l]);
      for (const m of d.hareketli) {
        const mu = Math.hypot(m.cx - a.x, m.cz - a.z);
        if (mu > 9) continue;
        if (mu < (m.tip === 'pervane' ? 4.3 : m.tip === 'cekic' ? 3.6 : 4.6)) { gaz = 1; continue; }   // içindeysem hemen çık
        const gelecek = hareketliDurum(m, t + 0.35), simdi = hareketliDurum(m, t);
        const tehlike = yakin.some(([px, pz]) => [simdi, gelecek].some(hd => {
          if (m.tip === 'pervane') { const r = Math.hypot(px - m.cx, pz - m.cz); if (r > 4.1) return false; let fa = Math.atan2(pz - m.cz, px - m.cx) - hd.aci; fa = ((fa % PI) + PI) % PI; return Math.min(fa, PI - fa) < 0.75; }
          if (m.tip === 'cekic') return Math.hypot(px - hd.x, pz - hd.z) < 2.4;
          if (m.tip === 'blok') return Math.hypot(px - hd.x, pz - hd.z) < 2.2;
          return false;
        }));
        if (tehlike) { bot.bekle = (bot.bekle || 0) + dt; if (bot.bekle < 4) return { gaz: sp > 1 ? -0.5 : 0, don: 0 }; }
      }
      bot.bekle = Math.max(0, (bot.bekle || 0) - dt * 0.5);
    }
    if (ozelHedef) gaz = 1;
    else {   // önümde yol yoksa fren (yavaşsam geri geri)
      if (sp > 3) { const l = sp * 0.4; if (!zemin(d, a.x + a.vx / sp * l, a.z + a.vz / sp * l, a.y + 0.5, 0)) gaz = -0.7; }
      else if (!zemin(d, a.x + Math.cos(a.a) * 1.1, a.z + Math.sin(a.a) * 1.1, a.y + 0.5, 0)) gaz = -0.45;
      else gaz = Math.max(gaz, 0.35);
    }
    if (Math.abs(fark) > 2.3 && sp < 4) { gaz = -0.6; }
    return { gaz, don: gaz < 0 ? -don : don, turbo: a.nitro > 0 && Math.abs(fark) < 0.15 && sp > 10 && Math.random() < 0.02 };
  }

  const api = { HARITALAR, TURLER, KATLAR, SILGI_R, BOMBA_R, ARABA_R, AZAMI_HIZ, G, kur, parcaSekli, temelKopruler, zemin, yuzeyYuk, hareketliDurum, adim, arabaCarp, yeniAraba, yenidenDog,
    baslangicYeri, yerlestirmeHatasi, silgiHedefi, bombaHedefleri, yolHaritasi, yolNoktalari, baslangicUzakligi, enYakinYurur, botGirdi, yerel, dunyaya, karma };
  if (typeof module !== 'undefined') module.exports = api;
  return api;
})();
