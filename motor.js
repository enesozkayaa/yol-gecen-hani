// =============================================================
// Oyuncak Rallisi - oyun motoru. Sadece oda sahibinde (ya da tek kişilik oyunda) çalışır.
// Sıra: parça seçme → yerleştirme → yarış → puan → (yeni tur ya da oyun sonu).
// Botları da burası sürer. Node'da araclar/test-motor.js ile denenir.
// =============================================================

const Motor = (() => {
  const D = typeof Dunya !== 'undefined' ? Dunya : require('./dunya.js');
  const SECIM_SURE = 12, PUAN_SURE = 7, GERI_SAYIM = 3;
  let M = null, cikisFn = null, sayac = null;
  const yay = m => cikisFn && cikisFn.herkese(m);
  const birine = (no, m) => { const o = M.oyuncular[no]; if (o && !o.bot && cikisFn.birine) cikisFn.birine(o.id, m); };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const aktifler = () => M.oyuncular.filter(o => !o.cikti);

  function baslat(oyuncular, ayar, cikis) {
    durdur();
    cikisFn = cikis;
    M = {
      ayar, oyuncular: oyuncular.map((o, no) => ({ ...o, no, puan: 0, cikti: false })),
      tur: 0, parcalar: [], sonId: 0, faz: 'bos', t: 0, fazBitis: 0, el: {}, koydu: {}, guc: {}, kimseBitirmedi: false,
      secim: null, yaris: null, botPlan: {}, sonDurum: 0,
    };
    M.d = D.kur(ayar.harita, M.parcalar);
    yay({ tip: 'basla', oyuncular: M.oyuncular.map(o => ({ no: o.no, id: o.id, ad: o.ad, bot: !!o.bot, renk: o.renk })), ayar });
    secimBaslat();
    if (!cikis.elle) sayac = setInterval(() => tik(1 / 30), 1000 / 30);
  }
  function durdur() { clearInterval(sayac); sayac = null; M = null; }

  // ---------- Kart seçme ----------
  function kartUret(n) {
    const katlar = M.ayar.katlar || {};
    const havuz = Object.entries(D.TURLER).filter(([, T]) => katlar[T.kat] !== false);
    if (!havuz.length) havuz.push(['cetvel', D.TURLER.cetvel]);
    const toplam = havuz.reduce((s, [, T]) => s + T.agirlik, 0);
    const cek = () => { let r = Math.random() * toplam; for (const [k, T] of havuz) { r -= T.agirlik; if (r <= 0) return k; } return havuz[0][0]; };
    const kartlar = Array.from({ length: n }, cek);
    // en az bir yol parçası ve en az bir tuzak olsun
    if (katlar.yol !== false && !kartlar.some(k => D.TURLER[k].kat === 'yol')) kartlar[0] = ['cetvel', 'rampa', 'kitap'][Math.floor(Math.random() * 3)];
    // kimse bitiremediyse yol açıcı bir şey mutlaka gelsin
    if (M.kimseBitirmedi && M.parcalar.length) kartlar[n - 1] = Math.random() < 0.5 ? 'bomba' : 'silgi';
    return kartlar.map(tur => ({ tur, alan: null }));
  }
  function secimBaslat() {
    M.tur++;
    const akt = aktifler();
    const sira = akt.map(o => ({ no: o.no, p: o.puan, r: Math.random() })).sort((a, b) => a.p - b.p || a.r - b.r).map(o => o.no);
    M.secim = { kartlar: kartUret(akt.length + 1), sira, k: 0 };
    M.el = {}; M.koydu = {};
    M.faz = 'secim';
    siradakiSecsin();
  }
  function siradakiSecsin() {
    const S = M.secim;
    while (S.k < S.sira.length && M.oyuncular[S.sira[S.k]].cikti) S.k++;
    if (S.k >= S.sira.length) return yerlestirBaslat();
    const no = S.sira[S.k];
    M.fazBitis = M.t + SECIM_SURE;
    M.botSecT = M.oyuncular[no].bot ? M.t + rnd(0.8, 1.8) : null;
    yay({ tip: 'faz', faz: 'secim', tur: M.tur, kartlar: S.kartlar, sira: S.sira, siradaki: no, kalan: SECIM_SURE, puan: puanlar() });
  }
  function secimYap(no, k) {
    const S = M.secim;
    if (M.faz !== 'secim' || S.sira[S.k] !== no) return;
    const kart = S.kartlar[k];
    if (!kart || kart.alan !== null) return;
    kart.alan = no; M.el[no] = kart.tur;
    yay({ tip: 'sec', no, kart: k, tur: kart.tur });
    S.k++;
    siradakiSecsin();
  }
  function botSec(no) {
    const bos = M.secim.kartlar.map((k, i) => ({ k, i })).filter(x => x.k.alan === null);
    // botlar biraz tuzak sever; puanı düşükse yol/fayda
    const puan = (T) => (T.kat === 'engel' || T.kat === 'patlar' ? 3 : T.kat === 'yol' ? 2.5 : T.kat === 'kaygan' ? 2 : 2.2) + Math.random() * 2.5;
    bos.sort((a, b) => puan(D.TURLER[b.k.tur]) - puan(D.TURLER[a.k.tur]));
    if (M.kimseBitirmedi) { const yk = bos.find(x => ['bomba', 'silgi'].includes(x.k.tur)); if (yk) return secimYap(no, yk.i); }
    secimYap(no, bos[0].i);
  }

  // ---------- Yerleştirme ----------
  function yerlestirBaslat() {
    M.faz = 'yerlestir';
    M.botPlan = {};
    aktifler().forEach(o => {
      const tur = M.el[o.no];
      if (!tur) { M.koydu[o.no] = true; return; }
      if (D.TURLER[tur].kisisel) { M.guc[o.no] = M.guc[o.no] || {}; M.guc[o.no][tur] = (M.guc[o.no][tur] || 0) + 1; M.koydu[o.no] = true; return; }
      if (o.bot) M.botPlan[o.no] = M.t + rnd(2.5, Math.min(14, M.ayar.yerlestir - 3));
    });
    M.fazBitis = M.t + M.ayar.yerlestir;
    yay({ tip: 'faz', faz: 'yerlestir', eller: M.el, koydu: M.koydu, kalan: M.ayar.yerlestir, guc: M.guc });
    hepsiKoyduMu();
  }
  function hepsiKoyduMu() {
    if (aktifler().every(o => M.koydu[o.no])) M.fazBitis = Math.min(M.fazBitis, M.t + 1.2);
  }
  function koy(no, x, z, r) {
    if (M.faz !== 'yerlestir' || M.koydu[no]) return;
    const tur = M.el[no]; if (!tur) return;
    x = Math.round(x * 2) / 2; z = Math.round(z * 2) / 2; r = Math.round((r || 0) / (Math.PI / 4)) * (Math.PI / 4);
    const hata = D.yerlestirmeHatasi(M.d, tur, x, z, r);
    if (hata) { birine(no, { tip: 'red', neden: hata }); return false; }
    if (tur === 'silgi' || tur === 'bomba') {
      const giden = tur === 'silgi' ? [D.silgiHedefi(M.d, x, z)] : D.bombaHedefleri(M.d, x, z);
      const ids = giden.filter(Boolean).map(p => p.id);
      M.parcalar = M.parcalar.filter(p => !ids.includes(p.id));
      yay({ tip: 'sil', no, ids, tur, x, z });
    } else {
      const p = { id: 'p' + (++M.sonId), tur, x, z, r, sahip: no };
      M.parcalar.push(p);
      yay({ tip: 'koy', no, p });
    }
    M.d = D.kur(M.ayar.harita, M.parcalar);
    M.koydu[no] = true;
    hepsiKoyduMu();
    return true;
  }

  // Botun parçayı nereye koyacağına karar vermesi
  function botYerlestir(no) {
    const tur = M.el[no], T = D.TURLER[tur];
    const yh = D.yolHaritasi(M.d), yol = D.yolNoktalari(M.d, yh);
    const nokta = f => { const i = Math.max(1, Math.min(yol.length - 2, Math.floor(f * (yol.length - 1)))); const a = yol[i], b = yol[Math.min(yol.length - 1, i + 3)]; return { x: a.x, z: a.z, a: Math.atan2(b.z - a.z, b.x - a.x) || 0 }; };
    const gecerli = (x, z, r) => !D.yerlestirmeHatasi(M.d, tur, Math.round(x * 2) / 2, Math.round(z * 2) / 2, r);
    const s = M.d.h.sinir, bit = M.d.h.bitis;
    const yuvarla = a => Math.round(a / (Math.PI / 4)) * (Math.PI / 4);
    if (!yol.length) return koy(no, rnd(s.x0 + 5, s.x1 - 5), rnd(s.z0 + 3, s.z1 - 3), 0);
    if (T.kat === 'yol' || tur === 'portal') {
      const temel = D.baslangicUzakligi(M.d, yh);
      const boy = { cetvel: 6, kitap: 3.5, rampa: 2.2, turbo: 2, portal: 5 }[tur] || 3;
      let en = null, enU = temel - 3;
      for (let i = 0; i < 9; i++) {
        const n = nokta(rnd(0.05, 0.9));
        const hedefA = Math.atan2(bit.z - n.z, bit.x - n.x);
        const a = yuvarla(hedefA + rnd(-0.8, 0.8));
        const x = n.x + Math.cos(a) * boy, z = n.z + Math.sin(a) * boy;
        if (!gecerli(x, z, a)) continue;
        const aday = { id: 'aday', tur, x: Math.round(x * 2) / 2, z: Math.round(z * 2) / 2, r: a, sahip: no };
        const u = D.baslangicUzakligi(D.kur(M.ayar.harita, [...M.parcalar, aday]));
        if (u < enU) { enU = u; en = aday; }
      }
      if (en) return koy(no, en.x, en.z, en.r);
      if (tur === 'turbo') { for (let i = 0; i < 12; i++) { const n = nokta(rnd(0.15, 0.8)); if (gecerli(n.x, n.z, yuvarla(n.a))) return koy(no, n.x, n.z, yuvarla(n.a)); } }
      for (let i = 0; i < 12; i++) { const x = rnd(s.x0 + 6, s.x1 - 6), z = rnd(s.z0 + 3, s.z1 - 3), a = yuvarla(rnd(0, 6.28)); if (gecerli(x, z, a)) return koy(no, x, z, a); }
      return;
    }
    if (tur === 'silgi' || tur === 'bomba') {
      const tuzak = M.parcalar.filter(p => D.TURLER[p.tur].kat !== 'yol' && p.tur !== 'korkuluk');
      if (!tuzak.length) return;
      let en = null, ed = 1e9;
      tuzak.forEach(p => { let dd = 1e9; for (let i = 0; i < yol.length; i += 2) dd = Math.min(dd, Math.hypot(yol[i].x - p.x, yol[i].z - p.z)); if (p.sahip === no) dd += 6; if (dd < ed) { ed = dd; en = p; } });
      if (en) return koy(no, en.x, en.z, 0);
      return;
    }
    if (tur === 'korkuluk') {   // yolun kenarına, yola paralel
      for (let i = 0; i < 25; i++) {
        const n = nokta(rnd(0.15, 0.85)), a = yuvarla(n.a);
        for (const yan of [1.9, -1.9, 2.4, -2.4]) {
          const x = n.x - Math.sin(a) * yan, z = n.z + Math.cos(a) * yan;
          const disari = !D.zemin(M.d, n.x - Math.sin(a) * (yan + 1.2), n.z + Math.cos(a) * (yan + 1.2), 1);
          if (disari && gecerli(x, z, a)) return koy(no, x, z, a);
        }
      }
      return;
    }
    // tuzaklar: yolun üstüne
    for (let i = 0; i < 20; i++) {
      const n = nokta(rnd(0.22, 0.85));
      let a = yuvarla(n.a);
      if (tur === 'duvar' || tur === 'blok') a = yuvarla(n.a + Math.PI / 2);
      let x = n.x, z = n.z;
      if (tur === 'duvar') { const yan = rnd(-1.2, 1.2); x += -Math.sin(n.a) * yan; z += Math.cos(n.a) * yan; }
      if (gecerli(x, z, a)) return koy(no, x, z, a);
    }
  }

  // ---------- Yarış ----------
  const AZAMI_PARCA = 18;
  function yarisBaslat() {
    M.faz = 'yaris';
    // Pist çok dolmasın: en eski parçalar kalkar
    if (M.parcalar.length > AZAMI_PARCA) {
      const ids = M.parcalar.slice(0, M.parcalar.length - AZAMI_PARCA).map(p => p.id);
      M.parcalar = M.parcalar.filter(p => !ids.includes(p.id));
      yay({ tip: 'sil', no: -1, ids, tur: 'eski' });
    }
    M.d = D.kur(M.ayar.harita, M.parcalar);
    M.yh = D.yolHaritasi(M.d);
    const zorluk = { kolay: { sinir: 0.8, hata: 0.25 }, orta: { sinir: 0.9, hata: 0.12 }, zor: { sinir: 1, hata: 0.03 } }[M.ayar.botZorluk] || { sinir: 0.9, hata: 0.12 };
    const yerler = {};
    M.yaris = { t: -GERI_SAYIM, son: M.ayar.yarisSure, bitenler: [], arabalar: {}, botlar: {}, konum: {}, olaylar: [] };
    aktifler().forEach((o, i) => {
      const y = D.baslangicYeri(M.ayar.harita, i);
      yerler[o.no] = y;
      const a = D.yeniAraba(y.x, y.z, y.a);
      const g = M.guc[o.no] || {};
      a.kalkan = g.kalkan || 0; a.nitro = (g.nitro || 0) * 3;
      M.yaris.arabalar[o.no] = a;
      if (o.bot) { a.sinir = zorluk.sinir; M.yaris.botlar[o.no] = { a, no: o.no, hata: zorluk.hata * (0.6 + Math.random() * 0.8) }; }
    });
    const guc = M.guc; M.guc = {};
    yay({ tip: 'faz', faz: 'yaris', kalan: M.ayar.yarisSure, geriSayim: GERI_SAYIM, yerler, guc, tur: M.tur });
  }
  function yarisTik(dt) {
    const Y = M.yaris;
    Y.t += dt;
    if (Y.t < 0) return;
    const adimS = 2, h = dt / adimS;
    for (const no in Y.botlar) {
      const b = Y.botlar[no], a = b.a;
      if (a.bitti && !a.havada) continue;
      for (let k = 0; k < adimS; k++) {
        const g = D.botGirdi(b, M.d, M.yh, Y.t, h);
        const ol = D.adim(a, g, M.d, Y.t, h);
        for (const o2 in Y.arabalar) if (o2 !== no) D.arabaCarp(a, Y.arabalar[o2]);
        ol.forEach(o => {
          if (o.tip === 'mayin') yay({ tip: 'patla', pid: o.pid, no: +no, x: o.x, z: o.z, t: Y.t });
          else if (o.tip === 'bitis') bitirdi(+no);
          else if (o.tip === 'dogdu') b.kilit = null;
        });
      }
    }
    // durum yayını (saniyede 15)
    if (M.t - M.sonDurum > 1 / 15) {
      M.sonDurum = M.t;
      const l = [];
      for (const no in Y.arabalar) {
        const a = Y.arabalar[no];
        l.push([+no, +a.x.toFixed(2), +a.y.toFixed(2), +a.z.toFixed(2), +a.a.toFixed(3), +a.spin.toFixed(2), bayrak(a), +Math.hypot(a.vx, a.vz).toFixed(1)]);
      }
      yay({ tip: 'durum', l, t: +Y.t.toFixed(2) });
    }
    const kalanlar = aktifler().filter(o => Y.arabalar[o.no] && !Y.arabalar[o.no].bitti);
    if (!kalanlar.length && Y.bitisT === undefined) Y.bitisT = Y.t + 1.5;
    if (Y.t >= Y.son || (Y.bitisT !== undefined && Y.t >= Y.bitisT)) puanFaz();
  }
  const bayrak = a => (a.havada ? 1 : 0) | (a.dus ? 2 : 0) | (a.bitti ? 4 : 0) | (a.turboT > 0 ? 8 : 0) | (a.kayiyor > 0.3 ? 16 : 0) | (a.kalkan > 0 ? 32 : 0) | (a.yerde === 'bal' ? 64 : 0);
  function bitirdi(no) {
    const Y = M.yaris;
    if (Y.bitenler.includes(no)) return;
    const a = Y.arabalar[no]; if (a) a.bitti = true;
    Y.bitenler.push(no);
    if (Y.bitenler.length === 1) Y.son = Math.min(Y.son, Y.t + Math.max(12, M.ayar.sonrakiSure || 20));
    yay({ tip: 'bitirdi', no, sira: Y.bitenler.length, sure: +Y.t.toFixed(2), son: Y.son });
  }

  // ---------- Puan ----------
  const puanlar = () => M.oyuncular.map(o => o.puan);
  function puanFaz() {
    const Y = M.yaris;
    M.faz = 'puan';
    const PUAN = [3, 2, 1];
    const sonuc = Y.bitenler.map((no, i) => ({ no, sira: i + 1, arti: PUAN[Math.min(i, 2)] }));
    sonuc.forEach(s => { M.oyuncular[s.no].puan += s.arti; });
    M.kimseBitirmedi = !sonuc.length;
    const p = puanlar();
    const enYuksek = Math.max(...aktifler().map(o => o.puan));
    const bitti = M.ayar.bitis === 'puan' ? enYuksek >= M.ayar.hedefPuan : M.tur >= M.ayar.turSayisi;
    M.fazBitis = M.t + PUAN_SURE;
    M.oyunBitti = bitti;
    yay({ tip: 'faz', faz: 'puan', sonuc, puan: p, tur: M.tur, bitti, kalan: PUAN_SURE, kimse: M.kimseBitirmedi });
  }
  function oyunSonu() {
    M.faz = 'son';
    const sira = aktifler().slice().sort((a, b) => b.puan - a.puan).map(o => o.no);
    yay({ tip: 'son', puan: puanlar(), sira });
    clearInterval(sayac); sayac = null;
  }

  // ---------- Saat ----------
  function tik(dt) {
    if (!M) return;
    M.t += dt;
    if (M.faz === 'secim') {
      if (M.botSecT && M.t >= M.botSecT) { M.botSecT = null; botSec(M.secim.sira[M.secim.k]); }
      else if (M.t >= M.fazBitis) { const bos = M.secim.kartlar.findIndex(k => k.alan === null); secimYap(M.secim.sira[M.secim.k], bos); }
    } else if (M.faz === 'yerlestir') {
      for (const no in M.botPlan) if (M.t >= M.botPlan[no]) { delete M.botPlan[no]; try { botYerlestir(+no); } catch (e) { console.warn('bot yerleştiremedi', e); } if (!M.koydu[no]) { M.koydu[no] = true; hepsiKoyduMu(); } }
      if (M.t >= M.fazBitis) {
        aktifler().forEach(o => { if (!M.koydu[o.no]) yay({ tip: 'koymadi', no: o.no }); });
        yarisBaslat();
      }
    } else if (M.faz === 'yaris') yarisTik(dt);
    else if (M.faz === 'puan' && M.t >= M.fazBitis) { if (M.oyunBitti) oyunSonu(); else secimBaslat(); }
  }

  // ---------- Oyunculardan gelenler ----------
  function girdi(id, m) {
    if (!M) return;
    const o = M.oyuncular.find(x => x.id === id && !x.bot);
    if (!o || o.cikti) return;
    const no = o.no;
    if (m.tip === 'sec') secimYap(no, m.kart);
    else if (m.tip === 'koy') koy(no, +m.x, +m.z, +m.r);
    else if (m.tip === 'imlec' && M.faz === 'yerlestir') { if (cikisFn.digerlerine) cikisFn.digerlerine(id, { tip: 'imlec', no, x: m.x, z: m.z, r: m.r }); else yay({ tip: 'imlec', no, x: m.x, z: m.z, r: m.r }); }
    else if (m.tip === 'ben' && M.faz === 'yaris' && Array.isArray(m.d)) {
      const a = M.yaris.arabalar[no]; if (!a) return;
      const [x, y, z, aci, spin, b, vx, vz] = m.d;
      Object.assign(a, { x, y, z, a: aci, spin, vx: vx || 0, vz: vz || 0, havada: !!(b & 1), dus: b & 2 ? 1 : 0, turboT: b & 8 ? 1 : 0, kayiyor: b & 16 ? 1 : 0, kalkan: b & 32 ? 1 : 0, yerde: b & 64 ? 'bal' : 'yol' });
    }
    else if (m.tip === 'mayin' && M.faz === 'yaris') {
      const Y = M.yaris, kap = M.d.mayinKapali.get(m.pid) ?? -1;
      if (kap > Y.t + 0.6) return;
      M.d.mayinKapali.set(m.pid, Y.t + 4);
      yay({ tip: 'patla', pid: m.pid, no, x: m.x, z: m.z, t: Y.t });
    }
    else if (m.tip === 'bitir' && M.faz === 'yaris') bitirdi(no);
  }
  function cikis(id) {
    if (!M) return;
    const o = M.oyuncular.find(x => x.id === id && !x.bot);
    if (!o) return;
    o.cikti = true;
    yay({ tip: 'cikti', no: o.no });
    if (M.faz === 'secim' && M.secim.sira[M.secim.k] === o.no) { M.secim.k++; siradakiSecsin(); }
    if (M.faz === 'yerlestir') { M.koydu[o.no] = true; hepsiKoyduMu(); }
  }

  return { baslat, durdur, tik, girdi, cikis, get durum() { return M; } };
})();
if (typeof module !== 'undefined') module.exports = Motor;
