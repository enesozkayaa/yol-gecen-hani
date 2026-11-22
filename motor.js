// =============================================================
// Yol Geçen Hanı - oyun motoru. Sadece oda sahibinde (ya da tek kişilik oyunda) çalışır.
// Tur sırası: yol kartı kapma → tuzak kartı kapma → herkes yolunu pistin ucuna kendisi ekler (kim önce basarsa)
//             → tuzaklar herkesçe aynı anda konur → yarış → puan → (yeni tur ya da oyun sonu).
// Botları da burası sürer. Node'da araclar/test-motor.js ile denenir.
// =============================================================

const Motor = (() => {
  const D = typeof Dunya !== 'undefined' ? Dunya : require('./dunya.js');
  const SECIM_SURE = 12, PUAN_SURE = 7, GERI_SAYIM = 3, AZAMI_TUZAK = 22;
  let M = null, cikisFn = null, sayac = null;
  const yay = m => cikisFn && cikisFn.herkese(m);
  const birine = (no, m) => { const o = M.oyuncular[no]; if (o && !o.bot && cikisFn.birine) cikisFn.birine(o.id, m); };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const aktifler = () => M.oyuncular.filter(o => !o.cikti);
  const dunyaYenile = () => { M.d = D.kur(M.ayar.ortam, M.dizi, M.parcalar); };

  function baslat(oyuncular, ayar, cikis) {
    durdur();
    cikisFn = cikis;
    M = {
      ayar, oyuncular: oyuncular.map((o, no) => ({ ...o, no, puan: 0, cikti: false })),
      tur: 0, dizi: [], parcalar: [], sonId: 0, faz: 'bos', t: 0, fazBitis: 0, el: {}, yolEl: {}, koydu: {}, guc: {}, kimseBitirmedi: false,
      secim: null, yaris: null, botPlan: {}, sonDurum: 0, yolSira: [],
    };
    // başlangıçta kısa bir pist
    ['duz', Math.random() < 0.5 ? 'sagHafif' : 'solHafif', 'duz'].forEach(t => M.dizi.push(...D.uygunYol(M.dizi, t).ekler));
    dunyaYenile();
    yay({ tip: 'basla', oyuncular: M.oyuncular.map(o => ({ no: o.no, id: o.id, ad: o.ad, bot: !!o.bot, renk: o.renk })), ayar, dizi: M.dizi });
    turBaslat();
    if (!cikis.elle) sayac = setInterval(() => tik(1 / 30), 1000 / 30);
  }
  function durdur() { clearInterval(sayac); sayac = null; M = null; }

  // ---------- Kart seçme ----------
  function agirlikliCek(havuz) {
    const toplam = havuz.reduce((s, [, T]) => s + T.agirlik, 0);
    let r = Math.random() * toplam; for (const [k, T] of havuz) { r -= T.agirlik; if (r <= 0) return k; } return havuz[0][0];
  }
  function kartUret(tip, n) {
    if (tip === 'yol') {
      // nadir yollar (delikli) bütün oyunda en fazla 'nadir' kez gelir, bir seferde en fazla 1 tane
      M.nadirSayac = M.nadirSayac || {};
      const havuz = D.YOL_KARTLARI.filter(k => !D.YOLLAR[k].nadir || (M.nadirSayac[k] || 0) < D.YOLLAR[k].nadir).map(k => [k, D.YOLLAR[k]]);
      const kartlar = [];
      for (let i = 0; i < n; i++) {
        let t = agirlikliCek(havuz);
        if (D.YOLLAR[t].nadir && kartlar.includes(t)) t = 'duz';
        if (D.YOLLAR[t].engebe && kartlar.filter(k => D.YOLLAR[k].engebe).length >= 2) t = Math.random() < 0.5 ? 'tepe' : 'zikzak';   // bir elde en fazla 2 engebeli yol
        kartlar.push(t);
      }
      kartlar.forEach(t => { if (D.YOLLAR[t].nadir) M.nadirSayac[t] = (M.nadirSayac[t] || 0) + 1; });
      return kartlar.map(tur => ({ tur, alan: null }));
    }
    const katlar = M.ayar.katlar || {};
    const havuz = Object.entries(D.TURLER).filter(([, T]) => katlar[T.kat] !== false);
    if (!havuz.length) havuz.push(['mayin', D.TURLER.mayin]);
    const kartlar = Array.from({ length: n }, () => agirlikliCek(havuz));
    if (M.kimseBitirmedi && M.parcalar.length && katlar.fayda !== false) kartlar[n - 1] = Math.random() < 0.5 ? 'bomba' : 'silgi';
    return kartlar.map(tur => ({ tur, alan: null }));
  }
  function turBaslat() {
    M.tur++;
    M.el = {}; M.yolEl = {}; M.koydu = {};
    secimBaslat('yol');
  }
  // Kartlar ortaya gelir, herkes aynı anda kapar: kim önce tıklarsa kart onundur (herkes bir tane alır)
  function secimBaslat(tip) {
    const akt = aktifler();
    M.secim = { tip, kartlar: kartUret(tip, akt.length + 1), aldi: {} };
    M.faz = 'secim';
    M.fazBitis = M.t + SECIM_SURE;
    M.botSecPlan = {};
    akt.forEach(o => { if (o.bot) M.botSecPlan[o.no] = M.t + rnd(1.2, 5); });
    yay({ tip: 'faz', faz: 'secim', secimTip: tip, tur: M.tur, kartlar: M.secim.kartlar, kalan: SECIM_SURE, puan: puanlar() });
  }
  function secimYap(no, k) {
    const S = M.secim;
    if (M.faz !== 'secim' || S.aldi[no] !== undefined) return;
    const kart = S.kartlar[k];
    if (!kart || kart.alan !== null) return;
    kart.alan = no; S.aldi[no] = k;
    if (S.tip === 'yol') M.yolEl[no] = kart.tur; else M.el[no] = kart.tur;
    yay({ tip: 'sec', no, kart: k, tur: kart.tur, secimTip: S.tip });
    if (aktifler().every(o => S.aldi[o.no] !== undefined)) secimBitti();
  }
  function secimBitti() {
    const S = M.secim;
    // süre bitince kart almayanlara kalanlardan biri verilir
    aktifler().forEach(o => { if (S.aldi[o.no] === undefined) { const bos = S.kartlar.findIndex(k => k.alan === null); if (bos >= 0) secimYap(o.no, bos); } });
    if (M.faz !== 'secim' || S.bitti) return;
    S.bitti = true;
    M.faz = 'secimArasi'; M.araT = M.t + 0.8;   // son kartın kaybolması görünsün
  }
  function botSec(no) {
    const bos = M.secim.kartlar.map((k, i) => ({ k, i })).filter(x => x.k.alan === null);
    if (!bos.length) return;
    if (M.secim.tip === 'tuzak') {
      if (M.kimseBitirmedi) { const yk = bos.find(x => ['bomba', 'silgi'].includes(x.k.tur)); if (yk) return secimYap(no, yk.i); }
      const puan = T => (T.kat === 'engel' || T.kat === 'patlar' ? 3 : T.kat === 'kaygan' ? 2.3 : 2) + Math.random() * 2.5;
      bos.sort((a, b) => puan(D.TURLER[b.k.tur]) - puan(D.TURLER[a.k.tur]));
    } else bos.sort(() => Math.random() - 0.5);
    secimYap(no, bos[0].i);
  }

  // ---------- Yol koyma: herkes kendi yolunu pistin ucuna kendisi ekler, kim önce basarsa ----------
  function yolKoyBaslat() {
    M.faz = 'yolKoy';
    M.yolKoydu = {};
    M.botPlan = {};
    aktifler().forEach(o => { if (!M.yolEl[o.no]) M.yolKoydu[o.no] = true; else if (o.bot) M.botPlan[o.no] = M.t + rnd(1.5, 7); });
    M.fazBitis = M.t + M.ayar.yerlestir;
    yay({ tip: 'faz', faz: 'yolKoy', yollar: M.yolEl, kalan: M.ayar.yerlestir });
    yolKoyBittiMi();
  }
  function yolKoy(no, ayna) {
    if (M.faz !== 'yolKoy' || M.yolKoydu[no] || !M.yolEl[no]) return;
    let tur = M.yolEl[no];
    if (ayna && D.YOLLAR[tur].ayna) tur = D.YOLLAR[tur].ayna;
    const { ekler, not } = D.uygunYol(M.dizi, tur);
    M.dizi.push(...ekler);
    M.yolKoydu[no] = true;
    dunyaYenile();
    yay({ tip: 'yolEkle', no, tur, ekler, not, dizi: M.dizi });
    yolKoyBittiMi();
  }
  function yolKoyBittiMi() { if (aktifler().every(o => M.yolKoydu[o.no])) M.fazBitis = Math.min(M.fazBitis, M.t + 1.5); }

  // ---------- Tuzak yerleştirme ----------
  function yerlestirBaslat() {
    M.faz = 'yerlestir';
    M.botPlan = {};
    aktifler().forEach(o => {
      const tur = M.el[o.no];
      if (!tur) { M.koydu[o.no] = true; return; }
      if (D.TURLER[tur].kisisel) { M.guc[o.no] = M.guc[o.no] || {}; M.guc[o.no][tur] = (M.guc[o.no][tur] || 0) + 1; M.koydu[o.no] = true; return; }
      if (o.bot) M.botPlan[o.no] = M.t + rnd(2.5, Math.min(12, M.ayar.yerlestir - 3));
    });
    M.fazBitis = M.t + M.ayar.yerlestir;
    yay({ tip: 'faz', faz: 'yerlestir', eller: M.el, koydu: M.koydu, kalan: M.ayar.yerlestir, guc: M.guc });
    hepsiKoyduMu();
  }
  function hepsiKoyduMu() { if (aktifler().every(o => M.koydu[o.no])) M.fazBitis = Math.min(M.fazBitis, M.t + 1.2); }
  function koy(no, x, y, z, r) {
    if (M.faz !== 'yerlestir' || M.koydu[no]) return;
    const tur = M.el[no]; if (!tur) return;
    r = Math.round((r || 0) / (Math.PI / 4)) * (Math.PI / 4);
    if (tur !== 'silgi' && tur !== 'bomba') { const zm = D.zemin(M.d, x, z, y + 0.5, 0); if (zm) y = zm.h; }
    const hata = D.yerlestirmeHatasi(M.d, tur, x, y, z, r);
    if (hata) { birine(no, { tip: 'red', neden: hata }); return false; }
    if (tur === 'silgi' || tur === 'bomba') {
      const giden = tur === 'silgi' ? [D.silgiHedefi(M.d, x, y, z)] : D.bombaHedefleri(M.d, x, y, z);
      const ids = giden.filter(Boolean).map(p => p.id);
      M.parcalar = M.parcalar.filter(p => !ids.includes(p.id));
      yay({ tip: 'sil', no, ids, tur, x, y, z });
    } else {
      const p = { id: 'p' + (++M.sonId), tur, x: +x.toFixed(2), y: +y.toFixed(2), z: +z.toFixed(2), r, sahip: no };
      M.parcalar.push(p);
      yay({ tip: 'koy', no, p });
    }
    dunyaYenile();
    M.koydu[no] = true;
    hepsiKoyduMu();
    return true;
  }

  // Bot tuzağını nereye koysun
  function botYerlestir(no) {
    const tur = M.el[no], C = M.d.cizgi, i0 = D.BAS_UZ + 3, i1 = M.d.bitisI - 8;
    if (i1 <= i0) return;
    const nokta = yan => { const i = Math.floor(rnd(i0, i1)), p = C[i]; return { x: p.x - Math.sin(p.a) * yan, y: p.y, z: p.z + Math.cos(p.a) * yan, a: p.a, p }; };
    const dene = (x, y, z, r) => !D.yerlestirmeHatasi(M.d, tur, x, y, z, r) && koy(no, x, y, z, r);
    if (tur === 'silgi' || tur === 'bomba') {
      const hedefler = M.parcalar.filter(p => p.sahip !== no && p.tur !== 'korkuluk' && p.tur !== 'turbo');
      const h = hedefler[Math.floor(Math.random() * hedefler.length)] || M.parcalar[0];
      if (h) koy(no, h.x, h.y, h.z, 0);
      return;
    }
    for (let k = 0; k < 30; k++) {
      let n;
      if (tur === 'korkuluk') { const p = nokta(0).p, yan = (Math.random() < 0.5 ? -1 : 1) * (p.w / 2 - 0.3); n = { x: p.x - Math.sin(p.a) * yan, y: p.y, z: p.z + Math.cos(p.a) * yan, a: p.a }; }
      else if (tur === 'duvar') n = nokta(rnd(-1.6, 1.6));
      else if (['turbo', 'pervane', 'cekic', 'pres', 'ruzgar', 'civi', 'rampa', 'ufo'].includes(tur)) n = nokta(0);
      else n = nokta(rnd(-1.8, 1.8));
      let r = Math.round(n.a / (Math.PI / 4)) * (Math.PI / 4);
      if (tur === 'duvar' || tur === 'blok') r += Math.PI / 2;
      if (tur === 'ruzgar' && Math.random() < 0.5) r += Math.PI;   // rüzgâr sağa ya da sola üflesin
      if (dene(n.x, n.y, n.z, r)) return;
    }
  }

  // ---------- Yarış ----------
  function yarisBaslat() {
    M.faz = 'yaris';
    if (M.parcalar.length > AZAMI_TUZAK) {   // çok tuzak birikince en eskiler kalkar
      const ids = M.parcalar.slice(0, M.parcalar.length - AZAMI_TUZAK).map(p => p.id);
      M.parcalar = M.parcalar.filter(p => !ids.includes(p.id));
      yay({ tip: 'sil', no: -1, ids, tur: 'eski' });
    }
    dunyaYenile();
    const zorluk = { kolay: { sinir: 0.82, hata: 0.18 }, orta: { sinir: 0.92, hata: 0.08 }, zor: { sinir: 1, hata: 0.02 } }[M.ayar.botZorluk] || { sinir: 0.92, hata: 0.08 };
    const yerler = {};
    const sure = Math.max(M.ayar.yarisSure, Math.round(M.d.cizgi.length / 8) + 20);
    M.yaris = { t: -GERI_SAYIM, son: sure, bitenler: [], arabalar: {}, botlar: {} };
    aktifler().forEach((o, i) => {
      const y = D.baslangicYeri(M.d, i);
      yerler[o.no] = y;
      const a = D.yeniAraba(y.x, y.y, y.z, y.a);
      const g = M.guc[o.no] || {};
      a.kalkan = g.kalkan || 0; a.nitro = a.nitroAzami = 2 + (g.nitro || 0) * 4.5; a.roket = g.roket ? 1 : 0; a.hayalet = g.hayalet ? 1 : 0;
      M.yaris.arabalar[o.no] = a;
      if (o.bot) { a.sinir = zorluk.sinir; M.yaris.botlar[o.no] = { a, no: o.no, hata: zorluk.hata * (0.6 + Math.random() * 0.8) }; }
    });
    const guc = M.guc; M.guc = {};
    yay({ tip: 'faz', faz: 'yaris', kalan: sure, geriSayim: GERI_SAYIM, yerler, guc, tur: M.tur });
  }
  function yarisTik(dt) {
    const Y = M.yaris;
    Y.t += dt;
    if (Y.t < 0) return;
    const adimS = 3, h = dt / adimS;
    for (const no in Y.botlar) {
      const b = Y.botlar[no], a = b.a;
      if (a.bitti && !a.havada) continue;
      for (let k = 0; k < adimS; k++) {
        const g = D.botGirdi(b, M.d, Y.t, h);
        const ol = D.adim(a, g, M.d, Y.t, h);
        for (const o2 in Y.arabalar) if (o2 !== no) D.arabaCarp(a, Y.arabalar[o2]);
        ol.forEach(o => {
          if (o.tip === 'mayin' || o.tip === 'kapan') yay({ tip: 'patla', pid: o.pid, no: +no, x: o.x, y: o.y, z: o.z, t: Y.t, kapan: o.tip === 'kapan' });
          else if (o.tip === 'bitis') bitirdi(+no);
        });
      }
    }
    if (M.t - M.sonDurum > 1 / 15) {
      M.sonDurum = M.t;
      const l = [];
      for (const no in Y.arabalar) {
        const a = Y.arabalar[no];
        l.push([+no, +a.x.toFixed(2), +a.y.toFixed(2), +a.z.toFixed(2), +a.a.toFixed(3), +a.spin.toFixed(2), bayrak(a), +Math.hypot(a.vx, a.vz).toFixed(1), a.ci]);
      }
      yay({ tip: 'durum', l, t: +Y.t.toFixed(2) });
    }
    const kalanlar = aktifler().filter(o => Y.arabalar[o.no] && !Y.arabalar[o.no].bitti);
    if (!kalanlar.length && Y.bitisT === undefined) Y.bitisT = Y.t + 1.5;
    if (Y.t >= Y.son || (Y.bitisT !== undefined && Y.t >= Y.bitisT)) puanFaz();
  }
  const bayrak = a => (a.havada ? 1 : 0) | (a.dus ? 2 : 0) | (a.bitti ? 4 : 0) | (a.turboT > 0 ? 8 : 0) | (a.kayiyor > 0.3 ? 16 : 0) | (a.kalkan > 0 ? 32 : 0) | (a.yerde === 'bal' ? 64 : 0) | (a.hayalet ? 128 : 0);
  function bitirdi(no) {
    const Y = M.yaris;
    if (Y.bitenler.includes(no)) return;
    const a = Y.arabalar[no]; if (a) a.bitti = true;
    Y.bitenler.push(no);
    if (Y.bitenler.length === 1) Y.son = Math.min(Y.son, Y.t + Math.max(15, Math.round(M.d.cizgi.length / 15)));
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
    const enYuksek = Math.max(...aktifler().map(o => o.puan));
    const bitti = M.ayar.bitis === 'puan' ? enYuksek >= M.ayar.hedefPuan : M.tur >= M.ayar.turSayisi;
    M.fazBitis = M.t + PUAN_SURE;
    M.oyunBitti = bitti;
    yay({ tip: 'faz', faz: 'puan', sonuc, puan: puanlar(), tur: M.tur, bitti, kalan: PUAN_SURE, kimse: M.kimseBitirmedi });
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
      for (const no in M.botSecPlan) if (M.t >= M.botSecPlan[no]) { delete M.botSecPlan[no]; if (M.faz === 'secim') botSec(+no); }
      if (M.faz === 'secim' && M.t >= M.fazBitis) secimBitti();
    } else if (M.faz === 'secimArasi') {
      if (M.t >= M.araT) { if (M.secim.tip === 'yol') secimBaslat('tuzak'); else yolKoyBaslat(); }
    } else if (M.faz === 'yolKoy') {
      for (const no in M.botPlan) if (M.t >= M.botPlan[no]) { delete M.botPlan[no]; yolKoy(+no, Math.random() < 0.3); }
      if (M.t >= M.fazBitis) {
        aktifler().forEach(o => { if (!M.yolKoydu[o.no]) yay({ tip: 'yolKoymadi', no: o.no }); });
        yerlestirBaslat();
      }
    }
    else if (M.faz === 'yerlestir') {
      for (const no in M.botPlan) if (M.t >= M.botPlan[no]) { delete M.botPlan[no]; try { botYerlestir(+no); } catch (e) { console.warn('bot yerleştiremedi', e); } if (!M.koydu[no]) { M.koydu[no] = true; hepsiKoyduMu(); } }
      if (M.t >= M.fazBitis) {
        aktifler().forEach(o => { if (!M.koydu[o.no]) yay({ tip: 'koymadi', no: o.no }); });
        yarisBaslat();
      }
    } else if (M.faz === 'yaris') yarisTik(dt);
    else if (M.faz === 'puan' && M.t >= M.fazBitis) { if (M.oyunBitti) oyunSonu(); else turBaslat(); }
  }

  // ---------- Oyunculardan gelenler ----------
  function girdi(id, m) {
    if (!M) return;
    const o = M.oyuncular.find(x => x.id === id && !x.bot);
    if (!o || o.cikti) return;
    const no = o.no;
    if (m.tip === 'sec') secimYap(no, m.kart);
    else if (m.tip === 'yolKoy') yolKoy(no, !!m.ayna);
    else if (m.tip === 'koy') koy(no, +m.x, +m.y, +m.z, +m.r);
    else if (m.tip === 'fare' && M.faz === 'secim') { const f = { tip: 'fare', no, x: +m.x, y: +m.y }; if (cikisFn.digerlerine) cikisFn.digerlerine(id, f); }
    else if (m.tip === 'imlec' && M.faz === 'yerlestir') { const im = { tip: 'imlec', no, x: m.x, y: m.y, z: m.z, r: m.r }; if (cikisFn.digerlerine) cikisFn.digerlerine(id, im); else yay(im); }
    else if (m.tip === 'ben' && M.faz === 'yaris' && Array.isArray(m.d)) {
      const a = M.yaris.arabalar[no]; if (!a) return;
      const [x, y, z, aci, spin, b, vx, vz, ci] = m.d.map(Number);
      if (![x, y, z, aci].every(Number.isFinite)) return;   // bozuk mesaj yarışı kilitlemesin
      Object.assign(a, { x, y, z, a: aci, spin: spin || 0, vx: vx || 0, vz: vz || 0, ci: Math.max(0, ci | 0), havada: !!(b & 1), dus: b & 2 ? 1 : 0, turboT: b & 8 ? 1 : 0, kayiyor: b & 16 ? 1 : 0, kalkan: b & 32 ? 1 : 0, yerde: b & 64 ? 'bal' : 'yol', hayalet: b & 128 ? 1 : 0 });
    }
    else if (m.tip === 'mayin' && M.faz === 'yaris') {
      const Y = M.yaris, kap = M.d.mayinKapali.get(m.pid) ?? -1;
      if (kap > Y.t + 0.6) return;
      M.d.mayinKapali.set(m.pid, Y.t + 4);
      yay({ tip: 'patla', pid: m.pid, no, x: +m.x || 0, y: +m.y || 0, z: +m.z || 0, t: Y.t, kapan: !!m.kapan });
    }
    else if (m.tip === 'bitir' && M.faz === 'yaris') bitirdi(no);
  }
  function cikis(id) {
    if (!M) return;
    const o = M.oyuncular.find(x => x.id === id && !x.bot);
    if (!o) return;
    o.cikti = true;
    if (M.yaris) { delete M.yaris.arabalar[o.no]; delete M.yaris.botlar[o.no]; }
    yay({ tip: 'cikti', no: o.no });
    if (M.faz === 'secim' && aktifler().every(x => M.secim.aldi[x.no] !== undefined)) secimBitti();
    if (M.faz === 'yolKoy') { M.yolKoydu[o.no] = true; yolKoyBittiMi(); }
    if (M.faz === 'yerlestir') { M.koydu[o.no] = true; hepsiKoyduMu(); }
  }

  return { baslat, durdur, tik, girdi, cikis, get durum() { return M; } };
})();
if (typeof module !== 'undefined') module.exports = Motor;
