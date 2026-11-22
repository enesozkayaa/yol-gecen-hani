// =============================================================
// Yol Geçen Hanı - oyuncunun tarafı: ekranlar, bekleme odası, kart seçme, parça yerleştirme,
// kendi arabanı sürme (fizik burada çalışır, yer eve gönderilir), diğerlerini gösterme, HUD, telefon tuşları.
// Kurallar evde (motor.js). Tek kişilik oyunda motor aynı sayfada çalışır.
// =============================================================

const Oyun = (() => {
  const SURUM = 14;   // sw.js ONBELLEK numarasıyla aynı tut; oyuncular farklı sürümdeyse uyarı çıkar
  const $ = id => document.getElementById(id);
  const T_ = Dunya.TURLER, K_ = Dunya.KATLAR;
  Sahne.kur($('sahne'));
  const dokun = matchMedia('(pointer: coarse)').matches;
  if (dokun) document.body.classList.add('dokun');
  $('surumYazi').textContent = 'Sürüm ' + SURUM;
  const kacis = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const hex = n => '#' + n.toString(16).padStart(6, '0');
  const renkHex = no => hex(Sahne.RENKLER[no % Sahne.RENKLER.length]);
  const BOT_ADLARI = ['Vınvın', 'Paldır', 'Fırfır', 'Zımba', 'Takoz', 'Cırcır', 'Pıtpıt', 'Gıcır'];
  const AZAMI = 6;

  let mod = null;   // 'yerel' | 'ev' | 'misafir'
  const ayarVarsayilan = () => ({ ortam: 'vadi', bitis: 'puan', hedefPuan: 10, turSayisi: 7, yerlestir: 30, yarisSure: 60, botZorluk: 'orta', katlar: { engel: true, kaygan: true, patlar: true, fayda: true } });
  let lobi = { ayar: ayarVarsayilan(), botlar: [] };
  try { const k = JSON.parse(localStorage.getItem('or.ayar2') || 'null'); if (k) lobi.ayar = { ...lobi.ayar, ...k, katlar: { ...lobi.ayar.katlar, ...(k.katlar || {}) } }; } catch (e) { }
  let O = null;   // oyun durumu
  let adim = '';

  // menüde arkada örnek bir pist
  let menuOrtam = null;
  function menuPisti(ortam) {
    if (menuOrtam === ortam) return; menuOrtam = ortam;
    Sahne.ortamKur(ortam);
    const dizi = []; ['duz', 'sag', 'yokus', 'atlama', 'sol', 'sagSpiral', 'duz'].forEach(t => dizi.push(...Dunya.uygunYol(dizi, t).ekler));
    const d = Dunya.kur(ortam, dizi, []);
    Sahne.parcalariTemizle(); Sahne.yolGuncelle(d); Sahne.kameraPistiGoster(d);
  }
  menuPisti(lobi.ayar.ortam);

  // ---------- Giriş ----------
  try { $('adim').value = localStorage.getItem('or.ad') || ''; } catch (e) { }
  function adAl() {
    const ad = $('adim').value.trim().slice(0, 14);
    if (!ad) { $('girisDurum').textContent = 'Önce adını yaz.'; $('adim').focus(); return null; }
    try { localStorage.setItem('or.ad', ad); } catch (e) { }
    Ses.baslat(); adim = ad;
    return ad;
  }
  $('botlaBtn').onclick = () => {
    if (!adAl()) return;
    Ag.kapat(); mod = 'yerel';
    if (!lobi.botlar.length) for (let i = 0; i < 3; i++) botEkle(true);
    ekranGoster('lobi'); lobiCiz(); mikCiz();
  };
  $('odaKurBtn').onclick = () => { const ad = adAl(); if (!ad) return; mod = 'ev'; lobi.botlar = []; $('girisDurum').textContent = 'Oda açılıyor…'; Ag.odaAc(ad); };
  $('katilBtn').onclick = () => {
    const ad = adAl(); if (!ad) return;
    const kod = $('odaKoduGir').value.trim().toUpperCase();
    if (kod.length < 5) { $('girisDurum').textContent = 'Oda kodunu yaz (5 harf).'; return; }
    mod = 'misafir'; $('girisDurum').textContent = 'Bağlanılıyor…'; Ag.katil(kod, ad);
  };
  $('odaKoduGir').addEventListener('keydown', e => { if (e.key === 'Enter') $('katilBtn').click(); });
  function ekranGoster(ad) {
    ['giris', 'lobi', 'turSonu', 'sonuc'].forEach(e => $(e).classList.toggle('gizli', e !== ad));
    $('hud').classList.toggle('gizli', !['hud', 'turSonu', 'sonuc'].includes(ad));
  }

  // ---------- Ağ ----------
  const benimId = () => (mod === 'yerel' ? 'ben' : Ag.benimId);
  const insanlar = () => (mod === 'yerel' ? [{ id: 'ben', ad: adim }] : Ag.oyuncular);
  const tumOyuncular = () => [...insanlar().map(o => ({ id: o.id, ad: o.ad, ses: o.ses })), ...lobi.botlar.map(b => ({ ...b, bot: true }))];
  const yonetici = () => mod === 'ev' || mod === 'yerel';
  function yay(m) { if (mod === 'yerel') mesaj(m); else Ag.yayinla(m); }
  function eve(m) { if (mod === 'yerel') Motor.girdi('ben', m); else Ag.eveGonder(m); }
  const motorCikis = {
    herkese: m => yay(m),
    birine: (id, m) => { if (id === benimId()) mesaj(m); else Ag.gonderId(id, m); },
    digerlerine: (id, m) => { if (mod === 'yerel') return; Ag.oyuncular.forEach(o => { if (o.id === id) return; if (o.id === Ag.benimId) mesaj(m); else Ag.gonderId(o.id, m); }); },
  };
  Ag.kabulKurali(n => {
    if (O && !O.bitti) return 'Oyun başladı; bitince tekrar dene.';
    if (n + lobi.botlar.length >= AZAMI) return `Oda dolu (en fazla ${AZAMI} kişi).`;
    return true;
  });
  Ag.on('oda', ({ kod }) => { $('lobiKod').textContent = kod; ekranGoster('lobi'); lobiYay(); lobiCiz(); mikCiz(); });
  Ag.on('hata', m => { $('girisDurum').textContent = m; $('lobiDurum').textContent = m; });
  Ag.on('oyuncular', () => { if (mod === 'ev') { while (Ag.oyuncular.length + lobi.botlar.length > AZAMI && lobi.botlar.length) lobi.botlar.pop(); lobiYay(); } lobiCiz(); });
  Ag.on('mesaj', m => mesaj(m));
  Ag.on('evMesaj', (m, id) => { if (O && !O.bitti) Motor.girdi(id, m); });
  Ag.on('koptu', o => { if (mod === 'ev' && O && !O.bitti) Motor.cikis(o.id); });
  Ag.on('evKoptu', () => menuyeDon('Oda sahibiyle bağlantı koptu.'));

  // ---------- Bekleme odası ----------
  const AYAR_SEC = [['ayHarita', 'ortam', String], ['ayBitis', 'bitis', String], ['ayHedef', 'hedefPuan', Number], ['ayTur', 'turSayisi', Number], ['ayYerlestir', 'yerlestir', Number], ['aySure', 'yarisSure', Number], ['ayZorluk', 'botZorluk', String]];
  function botEkle(sessiz) {
    if (tumOyuncular().length >= AZAMI) { if (!sessiz) $('lobiDurum').textContent = `En fazla ${AZAMI} oyuncu.`; return; }
    const kullanilan = new Set(lobi.botlar.map(b => b.ad));
    const ad = BOT_ADLARI.find(a => !kullanilan.has(a)) || 'Bot';
    lobi.botlar.push({ id: 'bot-' + Math.random().toString(36).slice(2, 7), ad });
    if (!sessiz) lobiDegisti();
  }
  $('botEkleBtn').onclick = () => { if (yonetici()) botEkle(); };
  function lobiYay() { if (mod === 'ev') Ag.yayinla({ tip: 'lobi', lobi, surum: SURUM }); }
  function lobiDegisti() { try { localStorage.setItem('or.ayar2', JSON.stringify(lobi.ayar)); } catch (e) { } if (mod === 'ev') lobiYay(); lobiCiz(); }
  function lobiCiz() {
    const L = tumOyuncular();
    $('lobiBaslik').textContent = mod === 'yerel' ? '🤖 Botlarla oyun' : 'Bekleme odası';
    $('odaBilgi').classList.toggle('gizli', mod === 'yerel');
    $('lobiMikBtn').classList.toggle('gizli', mod === 'yerel');
    $('lobiListe').innerHTML = L.map((p, i) => `<li style="--r:${renkHex(i)}"><span>${p.id === benimId() ? '⭐ ' : ''}${p.bot ? '🤖 ' : ''}${kacis(p.ad)}${p.ses ? ' 🎤' : ''}</span><span><small>${Sahne.RENK_AD[i % 6]}</small>${p.bot && yonetici() ? ` <button data-sil="${p.id}">✖</button>` : ''}</span></li>`).join('');
    $('lobiListe').querySelectorAll('[data-sil]').forEach(b => { b.onclick = () => { lobi.botlar = lobi.botlar.filter(x => x.id !== b.dataset.sil); lobiDegisti(); }; });
    AYAR_SEC.forEach(([el, k]) => { $(el).value = String(lobi.ayar[k]); $(el).disabled = !yonetici(); });
    $('kurallar').querySelectorAll('input').forEach(c => { c.checked = lobi.ayar.katlar[c.dataset.kat] !== false; c.disabled = !yonetici(); });
    $('satirHedef').classList.toggle('gizli', lobi.ayar.bitis !== 'puan');
    $('satirTur').classList.toggle('gizli', lobi.ayar.bitis !== 'tur');
    $('satirZorluk').classList.toggle('gizli', !lobi.botlar.length);
    $('botEkleBtn').classList.toggle('gizli', !yonetici() || L.length >= AZAMI);
    const a = lobi.ayar;
    const ort = Dunya.ORTAMLAR[a.ortam] || Dunya.ORTAMLAR.vadi;
    $('ayarOzet').textContent = `${L.length} oyuncu · ${ort.emoji} ${ort.ad} · ${a.bitis === 'puan' ? `${a.hedefPuan} puana ilk ulaşan kazanır` : `${a.turSayisi} tur`}`;
    $('baslaBtn').classList.toggle('gizli', !yonetici());
    if (yonetici()) $('lobiDurum').textContent = L.length < 2 ? (mod === 'yerel' ? 'En az 1 bot ekle.' : 'En az 2 oyuncu gerekli. Oda kodunu gönder ya da bot ekle.') : 'Hazır olunca oyunu başlat.';
    else if (!/Sürümün/.test($('lobiDurum').textContent)) $('lobiDurum').textContent = 'Oda sahibi oyunu başlatacak…';
    if (!O) menuPisti(a.ortam);
  }
  AYAR_SEC.forEach(([el, k, f]) => $(el).addEventListener('change', () => { lobi.ayar[k] = f($(el).value); lobiDegisti(); }));
  $('kurallar').querySelectorAll('input').forEach(c => c.addEventListener('change', () => {
    lobi.ayar.katlar[c.dataset.kat] = c.checked;
    if (!Object.values(lobi.ayar.katlar).some(Boolean)) { lobi.ayar.katlar.patlar = true; }
    lobiDegisti();
  }));
  $('kodKopyalaBtn').onclick = () => { navigator.clipboard?.writeText(Ag.kod).then(() => { $('lobiDurum').textContent = 'Kod kopyalandı.'; }).catch(() => {}); };
  $('lobiCikBtn').onclick = () => menuyeDon('');
  $('lobiMikBtn').onclick = mikDegistir;
  $('baslaBtn').onclick = baslat;
  function baslat() {
    if (!yonetici()) return;
    const L = tumOyuncular();
    if (L.length < 2) { if (O) { oyunTemizle(); ekranGoster('lobi'); lobiCiz(); } $('lobiDurum').textContent = 'En az 2 oyuncu gerekli (bot ekleyebilirsin).'; return; }
    Ses.baslat();
    Motor.baslat(L.map((p, i) => ({ id: p.id, ad: p.ad, bot: !!p.bot, renk: i })), { ...lobi.ayar }, motorCikis);
  }
  function menuyeDon(neden) {
    Motor.durdur();
    Ag.kapat();
    oyunTemizle();
    mod = null;
    ekranGoster('giris');
    $('girisDurum').textContent = neden || '';
    mikCiz();
  }
  $('lobiyeBtn').onclick = () => {
    if (mod === 'ev') { Motor.durdur(); Ag.yayinla({ tip: 'lobiyeDon' }); }
    else { if (mod === 'yerel') Motor.durdur(); oyunTemizle(); ekranGoster('lobi'); lobiCiz(); }
  };
  $('tekrarBtn').onclick = () => { if (yonetici()) baslat(); };
  $('cikBtn').onclick = () => { if (confirm('Oyundan çıkılsın mı?')) menuyeDon(''); };
  $('sesBtn').onclick = () => { const a = Ses.degistir(); $('sesBtn').textContent = a ? '🔊' : '🔇'; };
  $('sesBtn').textContent = Ses.acik ? '🔊' : '🔇';
  $('mikBtn').onclick = mikDegistir;
  async function mikDegistir() {
    if (mod === 'yerel' || !mod) return;
    if (Ag.sesAcik) Ag.sesKapat(); else if (!(await Ag.sesAc())) { akis('🎤 Mikrofona izin verilmedi.', 'kotu'); $('lobiDurum').textContent = 'Mikrofona izin verilmedi.'; }
    mikCiz();
  }
  function mikCiz() {
    const a = Ag.sesAcik;
    $('lobiMikBtn').textContent = a ? '🎤 Mikrofon açık' : '🎤 Mikrofon kapalı';
    $('mikBtn').classList.toggle('acik', a); $('mikBtn').classList.toggle('kapali', !a);
    $('mikBtn').classList.toggle('gizli', mod === 'yerel');
  }

  // ---------- Küçük yardımcılar ----------
  function akis(yazi, tur) {
    const d = document.createElement('div'); d.textContent = yazi; if (tur) d.className = tur;
    $('akis').prepend(d);
    while ($('akis').children.length > 5) $('akis').lastChild.remove();
    setTimeout(() => d.remove(), 6000);
  }
  let buyukZaman = null;
  function buyuk(yazi, alt, sure = 1600) {
    $('buyukYazi').innerHTML = kacis(yazi) + (alt ? `<small>${kacis(alt)}</small>` : '');
    $('buyukYazi').classList.add('goster');
    clearTimeout(buyukZaman); buyukZaman = setTimeout(() => $('buyukYazi').classList.remove('goster'), sure);
  }
  const ad = no => O?.oyuncular[no]?.ad || '?';
  const parcaAd = tur => { const T = T_[tur] || Dunya.YOLLAR[tur]; return `${T?.emoji || ''} ${T?.ad || tur}`; };

  // ---------- Oyun kurulumu ----------
  function oyunTemizle() {
    if (O) { O.arabalar.forEach(c => { Sahne.arabaSil(c.A); Sahne.scene.remove(c.et); }); }
    Sahne.parcalariTemizle(); Sahne.imlecleriTemizle(); Sahne.hayaletAyarla(null);
    Ses.motorDurdur();
    O = null;
    ['kartPanel', 'yerlestirPanel', 'yarisBilgi'].forEach(e => $(e).classList.add('gizli'));
    surusGoster(false);
    $('akis').innerHTML = ''; $('ipucu').textContent = '';
    menuOrtam = null;
    fareler.forEach(f => f.el.remove()); fareler.clear();
  }
  function oyunKur(m) {
    oyunTemizle();
    const benNo = m.oyuncular.findIndex(p => p.id === benimId() && !p.bot);
    O = { oyuncular: m.oyuncular, ayar: m.ayar, benNo, dizi: m.dizi.slice(), parcalar: [], faz: 'bos', puan: m.oyuncular.map(() => 0), el: {}, yolEl: {}, koydu: {}, arabalar: new Map(), cikti: new Set(), bitti: false, tur: 0, fazSon: 0, yer: { x: 0, y: 0, z: 0, r: 0, donus: 0 } };
    Sahne.ortamKur(m.ayar.ortam); menuOrtam = null;
    dunyaYenile();
    Sahne.yolGuncelle(O.d);
    Sahne.kameraPistiGoster(O.d);
    ekranGoster('hud');
    puanCiz();
  }
  function dunyaYenile() {
    const eski = O.d?.mayinKapali;
    O.d = Dunya.kur(O.ayar.ortam, O.dizi, O.parcalar);
    if (eski) O.d.mayinKapali = eski;
    Sahne.dunyaAyarla(O.d);
  }
  function puanCiz() {
    if (!O) return;
    const sira = O.oyuncular.map(p => p.no).sort((a, b) => O.puan[b] - O.puan[a]);
    const hedef = O.ayar.bitis === 'puan' ? `/${O.ayar.hedefPuan}` : '';
    $('puanTablo').innerHTML = `<li><small>${O.ayar.bitis === 'puan' ? `🎯 ${O.ayar.hedefPuan} puan` : `🔁 Tur ${O.tur}/${O.ayar.turSayisi}`}</small></li>` + sira.map(no => {
      const p = O.oyuncular[no], bitti = O.faz === 'yaris' && O.bitenler?.includes(no);
      return `<li class="${no === O.benNo ? 'ben' : ''} ${O.cikti.has(no) ? 'cikti' : ''}" style="--r:${renkHex(p.renk)}"><span><i></i>${p.bot ? '🤖' : ''}${kacis(p.ad)}${bitti ? ' 🏁' : ''}</span><b>${O.puan[no]}${hedef}</b></li>`;
    }).join('');
  }

  // ---------- Mesajlar ----------
  function mesaj(m) {
    switch (m.tip) {
      case 'lobi':
        if (mod === 'ev' || mod === 'yerel') return;
        lobi = m.lobi;
        if (m.surum !== SURUM) $('lobiDurum').textContent = `⚠️ Sürümün farklı (sen ${SURUM}, oda ${m.surum}). Sayfayı yenile.`;
        lobiCiz(); return;
      case 'lobiyeDon': oyunTemizle(); ekranGoster('lobi'); lobiCiz(); return;
      case 'basla': oyunKur(m); return;
    }
    if (!O) return;
    switch (m.tip) {
      case 'faz': fazGeldi(m); break;
      case 'sec': {
        if (O.oyuncular[m.no]?.bot && m.no !== O.benNo) { const c = kartMerkez(m.kart); fareAyarla(m.no, c.x, c.y); if (botFare[m.no]) botFare[m.no].t = 0.9; }
        const k = O.secim?.kartlar[m.kart]; if (k) k.alan = m.no;
        if (O.secim) O.secim.aldi[m.no] = m.kart;
        if (m.secimTip === 'yol') O.yolEl[m.no] = m.tur; else O.el[m.no] = m.tur;
        Ses.kartAl();
        akis(`${ad(m.no)} → ${parcaAd(m.tur)}`);
        kartlariCiz();
        break;
      }
      case 'koy': {
        O.parcalar.push(m.p); dunyaYenile();
        Sahne.parcaEkle(m.p); Ses.koy();
        O.koydu[m.no] = true;
        if (m.no === O.benNo) { O.bekliyor = false; yerlestirPanelCiz(); }
        Sahne.imlecAyarla(m.no, null);
        akis(`${ad(m.no)}: ${parcaAd(m.p.tur)} koydu`);
        break;
      }
      case 'yolEkle': {
        const onceki = O.dizi.length;
        O.dizi = m.dizi.slice(); dunyaYenile();
        const yeni = []; for (let i = 0; i <= O.dizi.length - onceki; i++) yeni.push(1 + onceki + i);
        Sahne.yolGuncelle(O.d, yeni);
        const C = O.d.cizgi, son = C[C.length - 1];
        Sahne.kameraGenel({ x: son.x, y: son.y, z: son.z }, 60);
        Ses.koy();
        if (m.no === O.benNo) O.yolKoydum = true;
        if (O.faz === 'yolKoy') { yolPanelCiz(); yolHayaletGuncelle(); }
        akis(`🛣️ ${ad(m.no)}: ${parcaAd(m.tur)}${m.not ? ` (${m.not})` : ''}`);
        break;
      }
      case 'sil': {
        O.parcalar = O.parcalar.filter(p => !m.ids.includes(p.id)); dunyaYenile();
        m.ids.forEach(id => Sahne.parcaSil(id));
        if (m.tur === 'bomba') { Sahne.patlama(m.x, m.y || 0, m.z, true); Ses.patla(); akis(`💣 ${ad(m.no)} bomba patlattı! ${m.ids.length} parça gitti`, 'kotu'); }
        else if (m.tur === 'eski') { if (m.ids.length) { Ses.sil(); akis(`🧹 Pist çok doldu: en eski ${m.ids.length} parça kalktı`); } }
        else { Ses.sil(); akis(`🩹 ${ad(m.no)} bir parçayı sildi`); }
        if (m.no >= 0) { O.koydu[m.no] = true; Sahne.imlecAyarla(m.no, null); }
        if (m.no === O.benNo) { O.bekliyor = false; yerlestirPanelCiz(); }
        break;
      }
      case 'red': O.bekliyor = false; O.redYazi = m.neden; Ses.olmaz(); yerlestirPanelCiz(); break;
      case 'fare': if (m.no !== O.benNo && O.faz === 'secim') fareAyarla(m.no, m.x, m.y); break;
      case 'imlec': if (m.no !== O.benNo && O.faz === 'yerlestir' && !O.koydu[m.no]) Sahne.imlecAyarla(m.no, O.el[m.no], m.x, m.y, m.z, m.r); break;
      case 'yolKoymadi': akis(`⌛ ${ad(m.no)} yolunu ekleyemedi`); break;
      case 'koymadi': akis(`⌛ ${ad(m.no)} parçasını koyamadı`); Sahne.imlecAyarla(m.no, null); break;
      case 'durum': durumGeldi(m); break;
      case 'patla':
        if (m.no !== O.benNo) { Sahne.patlama(m.x, m.y || 0, m.z); Ses.patla(); }
        O.d.mayinKapali.set(m.pid, (O.yarisT ?? 0) + 4);
        break;
      case 'bitirdi': {
        if (!O.bitenler.includes(m.no)) O.bitenler.push(m.no);
        O.yarisSon = m.son;
        const sira = m.sira;
        if (m.no !== O.benNo) { Ses.baskasiBitirdi(); const b = O.d.cizgi[O.d.bitisI]; Sahne.konfeti(b.x, b.y, b.z); }
        akis(`🏁 ${ad(m.no)} ${sira}. oldu! (${m.sure.toFixed(1)} sn)`, m.no === O.benNo ? 'iyi' : '');
        if (sira === 1 && m.no !== O.benNo && O.ben && !O.ben.bitti) buyuk(`${ad(m.no)} bitirdi!`, `Acele et! ${Math.max(0, Math.round(m.son - O.yarisT))} saniye kaldı`, 1800);
        puanCiz();
        break;
      }
      case 'cikti': O.cikti.add(m.no); akis(`🚪 ${ad(m.no)} oyundan çıktı`, 'kotu'); const c = O.arabalar.get(m.no); if (c) { Sahne.arabaSil(c.A); Sahne.scene.remove(c.et); O.arabalar.delete(m.no); } puanCiz(); break;
      case 'son': oyunSonu(m); break;
    }
  }

  function fazGeldi(m) {
    O.faz = m.faz;
    O.fazSon = performance.now() + m.kalan * 1000;
    $('kartPanel').classList.add('gizli'); $('yerlestirPanel').classList.add('gizli'); $('yarisBilgi').classList.add('gizli'); $('yolPanel').classList.add('gizli'); $('izlePanel').classList.add('gizli'); $('nitroGosterge').classList.add('gizli');
    if (O) O.izle = null;
    Sahne.yolHayalet(null);
    $('turSonu').classList.add('gizli');
    surusGoster(false);
    Sahne.hayaletAyarla(null);
    if (m.puan) O.puan = m.puan;
    if (m.faz === 'secim') {
      if (m.tur !== O.tur) {   // yeni tur: arabaları kaldır
        O.tur = m.tur; O.el = {}; O.yolEl = {}; O.koydu = {};
        O.arabalar.forEach(c => { Sahne.arabaSil(c.A); Sahne.scene.remove(c.et); }); O.arabalar.clear();
        O.ben = null; Ses.motorDurdur();
        Sahne.kameraPistiGoster(O.d);
        Sahne.imlecleriTemizle();
        ekranGoster('hud');
        buyuk(`${O.tur}. TUR`, 'Kap! Önce bir yol, sonra bir tuzak', 1500);
      }
      O.secim = { tip: m.secimTip, kartlar: m.kartlar.map(k => ({ ...k })), aldi: {} };
      $('fazYazi').textContent = m.secimTip === 'yol' ? '🛣️ Yol kap!' : '🪤 Tuzak kap!';
      $('kartPanel').classList.remove('gizli');
      Ses.sendeSira();
      kartlariCiz();
      $('ipucu').textContent = '';
    } else if (m.faz === 'yolKoy') {
      O.yolEl = m.yollar; O.yolKoydum = !O.yolEl[O.benNo]; O.yolAyna = false;
      $('fazYazi').textContent = '🛣️ Yolunu ekle';
      $('yolPanel').classList.remove('gizli');
      yolPanelCiz(); yolHayaletGuncelle();
      const C = O.d.cizgi, son = C[C.length - 1];
      Sahne.kameraGenel({ x: son.x, y: son.y, z: son.z }, 60);
      $('ipucu').textContent = dokun ? '' : 'Enter / Boşluk: yola ekle · R: ters çevir · Sol sürükle: döndür · Tekerlek: yakınlaş';
    } else if (m.faz === 'yerlestir') {
      O.el = m.eller; O.koydu = { ...m.koydu }; O.bekliyor = false; O.redYazi = '';
      $('fazYazi').textContent = '🧩 Parçanı yerleştir';
      const tur = O.el[O.benNo];
      if (tur && T_[tur].kisisel) akis(`${parcaAd(tur)} senin! Sonraki yarışta işine yarayacak.`, 'iyi');
      const C = O.d.cizgi, orta = C[Math.floor(C.length / 2)];
      O.yer = { x: orta.x, y: orta.y, z: orta.z, r: orta.a, donus: 0, degisti: true };
      Sahne.kameraPistiGoster(O.d);
      $('yerlestirPanel').classList.remove('gizli');
      yerlestirPanelCiz();
      $('ipucu').textContent = dokun ? '' : 'Tıkla: koy · Sol sürükle: haritayı döndür · Sağ sürükle: kaydır · Tekerlek: yakınlaş · R: tuzağı çevir';
    } else if (m.faz === 'yaris') yarisBasla(m);
    else if (m.faz === 'puan') puanGoster(m);
    puanCiz();
  }

  // ---------- Kart seçme ----------
  function kartlariCiz() {
    const S = O.secim; if (!S) return;
    const benimSiram = O.faz === 'secim' && S.aldi[O.benNo] === undefined;
    const neyi = S.tip === 'yol' ? 'yol' : 'tuzak';
    $('kartBaslik').textContent = O.faz !== 'secim' ? '' : benimSiram ? `👉 Kap! İstediğin ${neyi}u al` : '✅ Aldın! Diğerleri bekleniyor…';
    $('kartBaslik').classList.toggle('sende', benimSiram);
    const anahtar = O.tur + ':' + S.tip + ':' + S.kartlar.map(k => k.tur).join(',');
    if ($('kartlar').dataset.anahtar !== anahtar) {   // yeni kartlar: bir kez çiz
      $('kartlar').dataset.anahtar = anahtar;
      $('kartlar').innerHTML = S.kartlar.map((k, i) => {
        const T = S.tip === 'yol' ? Dunya.YOLLAR[k.tur] : T_[k.tur], kat = K_[S.tip === 'yol' ? 'yol' : T.kat];
        return `<div class="pk" data-i="${i}" title="${kacis(T.ad)}" style="--k:${kat.renk}"><img src="${Sahne.kartResmi(S.tip, k.tur)}" alt="${kacis(T.ad)}" draggable="false"></div>`;
      }).join('') + '<div id="fareler"></div>';
      fareler.forEach(f => $('fareler').appendChild(f.el));
      $('kartlar').querySelectorAll('.pk').forEach(el => { el.onclick = () => {
        const S2 = O.secim; if (!el.classList.contains('secilebilir')) return;
        if (O.secimGitti === O.tur + ':' + S2.tip) return;
        O.secimGitti = O.tur + ':' + S2.tip; eve({ tip: 'sec', kart: +el.dataset.i });
        setTimeout(() => { if (O && O.secim === S2 && S2.aldi[O.benNo] === undefined) O.secimGitti = null; }, 700);   // başkası önce kaptıysa tekrar dene
      }; });
    }
    $('kartlar').querySelectorAll('.pk').forEach(el => {
      const k = S.kartlar[+el.dataset.i], alan = k.alan !== null && k.alan !== undefined;
      el.classList.toggle('gitti', alan); el.classList.toggle('secilebilir', !alan && benimSiram);
    });
  }

  // ---------- Kart seçerken herkesin faresi ----------
  const fareler = new Map();   // no → { el, x, y, hx, hy }
  function fareAyarla(no, x, y, ani) {
    let f = fareler.get(no);
    if (!f) {
      const p = O.oyuncular[no]; if (!p) return;
      const el = document.createElement('div'); el.className = 'fare';
      el.innerHTML = `<svg viewBox="0 0 24 24" width="30" height="30"><path d="M3 2 L3 20 L8 15 L11.5 22 L14.5 20.5 L11 14 L18 14 Z" fill="${renkHex(p.renk)}" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg><span style="background:${renkHex(p.renk)}">${kacis(p.ad)}</span>`;
      $('fareler')?.appendChild(el);
      f = { el, x, y, hx: x, hy: y }; fareler.set(no, f);
    }
    f.hx = x; f.hy = y; if (ani) { f.x = x; f.y = y; }
  }
  function kartMerkez(i) {
    const kap = $('kartlar').getBoundingClientRect(), el = $('kartlar').querySelector(`.pk[data-i="${i}"]`);
    if (!el || !kap.width) return { x: 0.5, y: 0.5 };
    const r = el.getBoundingClientRect();
    return { x: (r.left + r.width * (0.35 + Math.random() * 0.3) - kap.left) / kap.width, y: (r.top + r.height * (0.4 + Math.random() * 0.3) - kap.top) / kap.height };
  }
  const botFare = {};
  function fareKare(dt) {
    const secimde = O && O.faz === 'secim';
    $('fareler')?.classList.toggle('gizli', !secimde);
    if (!secimde) return;
    // botların faresi kartların üstünde gezinir
    O.oyuncular.forEach(p => {
      if (!p.bot || O.cikti.has(p.no)) return;
      const b = botFare[p.no] ||= { t: 0 };
      b.t -= dt;
      if (b.t <= 0) {
        const bos = O.secim.kartlar.map((k, i) => (k.alan === null || k.alan === undefined ? i : -1)).filter(i => i >= 0);
        const almadi = O.secim.aldi[p.no] === undefined;
        if (bos.length) { const m = kartMerkez(bos[Math.floor(Math.random() * bos.length)]); fareAyarla(p.no, m.x, m.y + (almadi ? 0 : 0.45 + Math.random() * 0.3)); }
        b.t = almadi ? 0.35 + Math.random() * 0.35 : 0.9 + Math.random() * 1.2;
      }
    });
    const k = 1 - Math.exp(-dt * 9);
    fareler.forEach(f => { f.x += (f.hx - f.x) * k; f.y += (f.hy - f.y) * k; f.el.style.left = (f.x * 100) + '%'; f.el.style.top = (f.y * 100) + '%'; });
  }
  let sonFare = 0;
  addEventListener('pointermove', e => {
    if (!O || O.faz !== 'secim' || performance.now() - sonFare < 80) return;
    const kap = $('kartlar').getBoundingClientRect(); if (!kap.width) return;
    sonFare = performance.now();
    eve({ tip: 'fare', x: +((e.clientX - kap.left) / kap.width).toFixed(3), y: +((e.clientY - kap.top) / kap.height).toFixed(3) });
  });

  // ---------- Yol koyma ----------
  function benimYolum() { const t = O?.yolEl?.[O.benNo]; if (!t) return null; return O.yolAyna && Dunya.YOLLAR[t].ayna ? Dunya.YOLLAR[t].ayna : t; }
  function yolPanelCiz() {
    const t = benimYolum();
    if (!t) { $('yolResim').removeAttribute('src'); $('yolDurum').textContent = 'Bu turda yolun yok. Diğerlerini izle.'; $('yolEkleBtn').disabled = true; $('yolCevirBtn').classList.add('gizli'); return; }
    $('yolResim').src = Sahne.kartResmi('yol', t);
    $('yolCevirBtn').classList.toggle('gizli', !Dunya.YOLLAR[O.yolEl[O.benNo]].ayna || O.yolKoydum);
    $('yolEkleBtn').disabled = O.yolKoydum;
    $('yolDurum').textContent = O.yolKoydum ? '✅ Yolun eklendi!' : 'Kim önce eklerse pist onun yoluyla devam eder!';
  }
  function yolHayaletGuncelle() { Sahne.yolHayalet(O.faz === 'yolKoy' && !O.yolKoydum ? O.dizi : null, benimYolum()); }
  function yolEkle() { if (!O || O.faz !== 'yolKoy' || O.yolKoydum || !benimYolum()) return; O.yolKoydum = true; Sahne.yolHayalet(null); eve({ tip: 'yolKoy', ayna: O.yolAyna }); yolPanelCiz(); }
  function yolCevir() { if (!O || O.faz !== 'yolKoy' || O.yolKoydum) return; O.yolAyna = !O.yolAyna; Ses.don(); yolPanelCiz(); yolHayaletGuncelle(); }
  $('yolEkleBtn').onclick = yolEkle;
  $('yolCevirBtn').onclick = yolCevir;

  // ---------- Yerleştirme ----------
  function yerlestirPanelCiz() {
    const tur = O.el[O.benNo];
    const el = $('elimde');
    if (!tur) { el.innerHTML = 'Bu turda tuzağın yok. Diğerlerini izle.'; el.style.setProperty('--k', '#888'); return; }
    const T = T_[tur];
    el.style.setProperty('--k', K_[T.kat].renk);
    if (T.kisisel) { el.innerHTML = `<span class="em">${T.emoji}</span> ${T.ad} senin!<small>${T.acik}</small>`; }
    else if (O.koydu[O.benNo]) el.innerHTML = `<span class="em">${T.emoji}</span> Koydun! Diğerleri bekleniyor…`;
    else if (O.bekliyor) el.innerHTML = `<span class="em">${T.emoji}</span> Koyuluyor…`;
    else el.innerHTML = `<span class="em">${T.emoji}</span> ${T.ad}<small>${T.acik}</small>${O.redYazi ? `<small class="hata">❌ ${kacis(O.redYazi)}</small>` : ''}`;
    const yapabilir = !T.kisisel && !O.koydu[O.benNo] && !O.bekliyor;
    $('koyBtn').disabled = !yapabilir; $('donBtn').disabled = !yapabilir;
  }
  const yerlestiriyorum = () => O && O.faz === 'yerlestir' && O.el[O.benNo] && !T_[O.el[O.benNo]].kisisel && !O.koydu[O.benNo] && !O.bekliyor;
  const ceyrek = a => Math.round(a / (Math.PI / 4)) * (Math.PI / 4);
  function dondur(y = 1) { if (!yerlestiriyorum()) return; O.yer.donus += y * Math.PI / 4; O.yer.degisti = true; Ses.don(); }
  function koyDene() {
    if (!yerlestiriyorum()) return;
    const tur = O.el[O.benNo], { x, y, z, r } = O.yer;
    if (!O.yer.yolda && tur !== 'bomba' && tur !== 'silgi') { O.redYazi = 'Yolun üstüne koymalısın'; Ses.olmaz(); yerlestirPanelCiz(); return; }
    const hata = Dunya.yerlestirmeHatasi(O.d, tur, x, y, z, r);
    if (hata) { O.redYazi = hata; Ses.olmaz(); yerlestirPanelCiz(); return; }
    O.bekliyor = true; O.redYazi = '';
    eve({ tip: 'koy', x, y, z, r });
    yerlestirPanelCiz();
  }
  function yerAyarla(px, py) {
    const p = Sahne.ekrandanYola(px, py);
    O.yer.yolda = !!p;
    if (!p) { O.yer.degisti = true; return; }
    O.yer.x = Math.round(p.x * 4) / 4; O.yer.z = Math.round(p.z * 4) / 4; O.yer.y = p.y;
    const zm = Dunya.zemin(O.d, O.yer.x, O.yer.z, p.y + 0.5, 0); if (zm) O.yer.y = zm.h;
    O.yer.degisti = true;
  }
  let sonImlec = 0;
  function yerlestirKare() {
    const tur = O.el[O.benNo];
    if (!yerlestiriyorum()) { Sahne.hayaletAyarla(null); return; }
    const Y = O.yer;
    if (Y.degisti) {
      Y.degisti = false;
      // tuzak yolun yönüne göre döner, R ile çevrilir
      const i = Dunya.ilerlemeBul(O.d, Y.x, Y.y, Y.z);
      const yolA = i >= 0 ? O.d.cizgi[i].a : 0;
      Y.r = ceyrek(yolA + ((tur === 'duvar' || tur === 'blok') ? Math.PI / 2 : 0) + Y.donus);
      Y.hata = !Y.yolda && tur !== 'bomba' && tur !== 'silgi' ? 'Yolun üstüne getir' : Dunya.yerlestirmeHatasi(O.d, tur, Y.x, Y.y, Y.z, Y.r);
      Y.hedefler = tur === 'silgi' ? [Dunya.silgiHedefi(O.d, Y.x, Y.y, Y.z)].filter(Boolean).map(p => p.id) : tur === 'bomba' ? Dunya.bombaHedefleri(O.d, Y.x, Y.y, Y.z).map(p => p.id) : [];
      Y.imlecBekliyor = true;
    }
    if (Y.imlecBekliyor && performance.now() - sonImlec > 120) { Y.imlecBekliyor = false; sonImlec = performance.now(); eve({ tip: 'imlec', x: Y.x, y: Y.y, z: Y.z, r: Y.r }); }
    Sahne.hayaletAyarla(tur, Y.x, Y.y, Y.z, Y.r, !Y.hata);
    if (Y.hedefler?.length) Sahne.vurgula(Y.hedefler);
    $('ipucu').textContent = Y.hata ? '❌ ' + Y.hata : (dokun ? '' : 'Tıkla: koy · Sol sürükle: döndür · Sağ sürükle: kaydır · Tekerlek: yakınlaş · R: tuzağı çevir');
  }
  // Fare / parmak: sol sürükle = döndür (360°), sağ sürükle / iki parmak = kaydır, tekerlek / iki parmak sıkıştır = yaklaş.
  // Kısa tıklama tuzağı koyar, kısa sağ tık çevirir.
  const kanvas = $('sahne');
  const parmaklar = new Map();
  let surukle = null, ikiParmak = null;
  const kameraSerbest = () => O && (O.faz !== 'yaris' || O.izle?.mod === 'serbest');
  kanvas.addEventListener('pointerdown', e => {
    Ses.baslat();
    if (!kameraSerbest()) return;
    parmaklar.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { kanvas.setPointerCapture(e.pointerId); } catch (x) { }
    if (parmaklar.size === 2) { const [a, b] = [...parmaklar.values()]; ikiParmak = { mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) }; if (surukle) surukle.kaydi = true; return; }
    surukle = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, buton: e.button, tip: e.pointerType, kaydi: false };
  });
  kanvas.addEventListener('pointermove', e => {
    if (parmaklar.has(e.pointerId)) parmaklar.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ikiParmak && parmaklar.size >= 2) {
      const [a, b] = [...parmaklar.values()], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, d = Math.hypot(a.x - b.x, a.y - b.y);
      const k = Sahne.ekranKaydirma(mx - ikiParmak.mx, my - ikiParmak.my); Sahne.kameraKaydir(k.dx, k.dz);
      if (ikiParmak.d > 10 && d > 10) Sahne.kameraYakinlas(d / ikiParmak.d);
      Object.assign(ikiParmak, { mx, my, d });
      return;
    }
    if (surukle) {
      const dx = e.clientX - surukle.x, dy = e.clientY - surukle.y;
      if (Math.hypot(e.clientX - surukle.sx, e.clientY - surukle.sy) > 7) surukle.kaydi = true;
      if (surukle.kaydi) {
        if (surukle.buton === 2) { const k = Sahne.ekranKaydirma(dx, dy); Sahne.kameraKaydir(k.dx, k.dz); }
        else Sahne.kameraDondur(dx, dy);
      }
      surukle.x = e.clientX; surukle.y = e.clientY;
    }
    if (e.pointerType !== 'touch' && yerlestiriyorum() && !(surukle && surukle.kaydi)) yerAyarla(e.clientX, e.clientY);
  });
  const birak = e => {
    parmaklar.delete(e.pointerId);
    if (parmaklar.size < 2) ikiParmak = null;
    const s = surukle; if (parmaklar.size === 0) surukle = null;
    if (e.type !== 'pointerup' || !s || s.kaydi || !yerlestiriyorum()) return;
    if (s.buton === 2) { dondur(1); return; }
    yerAyarla(e.clientX, e.clientY);
    if (s.tip !== 'touch') koyDene();
  };
  kanvas.addEventListener('pointerup', birak);
  kanvas.addEventListener('pointercancel', birak);
  kanvas.addEventListener('contextmenu', e => e.preventDefault());
  kanvas.addEventListener('wheel', e => { if (kameraSerbest()) { e.preventDefault(); Sahne.kameraYakinlas(e.deltaY > 0 ? 0.88 : 1.14); } }, { passive: false });
  $('donBtn').onclick = () => dondur(1);
  $('koyBtn').onclick = koyDene;
  $('yakinBtn').onclick = () => Sahne.kameraYakinlas(1.3);
  $('uzakBtn').onclick = () => Sahne.kameraYakinlas(0.77);

  // ---------- Yarış ----------
  const tus = new Set(), dokunTus = new Set();
  let otopilot = null;   // sadece test için
  let kurtarBasildi = false;
  addEventListener('keydown', e => {
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    if (!e.repeat) {
      if (k === 'r') { if (O?.faz === 'yerlestir') dondur(1); else if (O?.faz === 'yolKoy') yolCevir(); else kurtarBasildi = true; }
      if ((k === 'enter' || k === ' ') && O?.faz === 'yolKoy') yolEkle();
      if (k === 'q' && O?.faz === 'yerlestir') dondur(-1);
      if (k === 'm') mikDegistir();
    }
    tus.add(k);
  });
  addEventListener('keyup', e => tus.delete(e.key.toLowerCase()));
  addEventListener('blur', () => { tus.clear(); dokunTus.clear(); });
  document.querySelectorAll('[data-t]').forEach(b => {
    const t = b.dataset.t;
    const bas = e => { e.preventDefault(); Ses.baslat(); dokunTus.add(t); b.classList.add('basili'); if (t === 'kurtar') kurtarBasildi = true; try { b.setPointerCapture(e.pointerId); } catch (x) { } };
    const birak = () => { dokunTus.delete(t); b.classList.remove('basili'); };
    b.addEventListener('pointerdown', bas); b.addEventListener('pointerup', birak); b.addEventListener('pointercancel', birak); b.addEventListener('lostpointercapture', birak);
  });
  function surusGoster(v) { document.querySelectorAll('.surus').forEach(e => e.classList.toggle('gizli2', !v)); }
  surusGoster(false);
  function girdiAl() {
    const v = k => tus.has(k);
    let gaz = (v('w') || v('arrowup') || dokunTus.has('gaz')) ? 1 : 0;
    if (v('s') || v('arrowdown') || dokunTus.has('fren')) gaz = -1;
    const don = ((v('d') || v('arrowright') || dokunTus.has('sag')) ? 1 : 0) - ((v('a') || v('arrowleft') || dokunTus.has('sol')) ? 1 : 0);
    const turbo = v(' ') || dokunTus.has('nitro');   // basılı tuttukça nitro yanar
    if (otopilot && O?.ben) return Dunya.botGirdi(otopilot.bot ||= { a: O.ben, no: 0, hata: 0.04 }, O.d, O.yarisT, 1 / 60);
    return { gaz, don, turbo };
  }

  function yarisBasla(m) {
    O.yarisT = -m.geriSayim; O.yarisSon = m.kalan; O.bitenler = []; O.sonGeriSayi = null; O.sonGonder = 0; O.siraT = 0; O.kurtarT = 0;
    O.arabalar.forEach(c => { Sahne.arabaSil(c.A); Sahne.scene.remove(c.et); }); O.arabalar.clear();
    dunyaYenile(); O.d.mayinKapali = new Map();
    O.ben = null;
    O.oyuncular.forEach(p => {
      const y = m.yerler[p.no]; if (!y) return;
      const A = Sahne.arabaYap(p.renk);
      const et = Sahne.etiketYap(p.ad, renkHex(p.renk));
      Sahne.scene.add(A.g); Sahne.scene.add(et);
      const s = { x: y.x, y: y.y || 0, z: y.z, a: y.a, spin: 0, hiz: 0 };
      O.arabalar.set(p.no, { A, et, s, ci: 0, hedef: { ...s, zaman: performance.now(), b: 0, ci: 0 } });
      if (p.no === O.benNo) {
        O.ben = Dunya.yeniAraba(y.x, y.y || 0, y.z, y.a); if (otopilot) otopilot = {};
        const g = m.guc?.[p.no] || {};
        O.ben.kalkan = g.kalkan || 0; O.ben.nitro = O.ben.nitroAzami = 2 + (g.nitro || 0) * 4.5;
      }
    });
    if (O.ben) Sahne.kameraTakip(O.ben, true);
    else { const ilk = O.arabalar.values().next().value; if (ilk) Sahne.kameraTakip(ilk.s, true); }
    $('fazYazi').textContent = `🏁 ${O.tur}. yarış`;
    $('yarisBilgi').classList.remove('gizli');
    $('nitroGosterge').classList.toggle('gizli', !O.ben);
    surusGoster(!!O.ben);
    O.izle = null; $('izlePanel').classList.add('gizli');
    O.bitirmeT = null;
    $('ipucu').textContent = O.ben ? 'W/↑ gaz · S/↓ fren · A D / ← → direksiyon · Boşluk basılı tut: nitro · R kurtar' : '';
    $('ipucu').classList.add('surus');
    if (O.ben) Ses.motorBaslat();
  }
  function durumGeldi(m) {
    const simdi = performance.now();
    m.l.forEach(([no, x, y, z, a, spin, b, hiz, ci]) => {
      if (no === O.benNo) return;
      const c = O.arabalar.get(no); if (!c) return;
      const onceDus = c.hedef.b & 2;
      c.hedef = { x, y, z, a, spin, b, hiz, ci, zaman: simdi };
      c.ci = ci || 0;
      if (onceDus && !(b & 2)) { Sahne.poof(x, y + 0.5, z); c.s.x = x; c.s.y = y; c.s.z = z; c.s.a = a; }
    });
  }
  function olayIsle(ol, a) {
    ol.forEach(o => {
      switch (o.tip) {
        case 'mayin': eve({ tip: 'mayin', pid: o.pid, x: o.x, y: o.y, z: o.z }); Sahne.patlama(o.x, o.y, o.z); Ses.patla(); break;
        case 'yay': Ses.yay(); Sahne.yayBas(a.x, a.z); Sahne.halkaEfekt(a.x, a.y + 0.3, a.z, 0x6aff7a, 3); break;
        case 'turbo': Ses.turbo(); break;
        case 'nitro': Ses.nitro(); Sahne.halkaEfekt(a.x, a.y + 0.4, a.z, 0x4a9aff, 3); break;
        case 'carpti': Ses.carp(o.guc); Sahne.kivilcim(o.x, (o.y ?? a.y) + 0.5, o.z, Math.min(24, 4 + o.guc * 1.5)); if (o.guc > 8) Sahne.sarsinti(0.25); break;
        case 'vurdu': Ses.vurdu(); Sahne.kivilcim(a.x, a.y + 0.6, a.z, 20); Sahne.sarsinti(0.5); break;
        case 'kalkan': Ses.kalkan(); Sahne.halkaEfekt(a.x, a.y + 0.6, a.z, 0x6ad8ff, 4); akis('🛡️ Kalkan seni korudu!', 'iyi'); break;
        case 'indi': Ses.indi(o.guc); if (o.guc > 4) Sahne.toz(a.x, a.y + 0.1, a.z, Math.min(16, o.guc * 1.5)); break;
        case 'dustu': Ses.dus(); break;
        case 'cakildi': Ses.carp(12); Sahne.toz(o.x, Dunya.ZEMIN_Y + 0.3, o.z, 30, 0x8a7a5a, 3); Sahne.kivilcim(o.x, Dunya.ZEMIN_Y + 0.5, o.z, 16); break;
        case 'dogdu': Ses.dogdu(); Sahne.poof(a.x, a.y + 0.5, a.z); Sahne.kameraTakip(a, true); break;
        case 'bitis': {
          eve({ tip: 'bitir' });
          const sira = O.bitenler.length + (O.bitenler.includes(O.benNo) ? 0 : 1);
          Ses.bitis(sira === 1); Sahne.konfeti(a.x, a.y, a.z); Sahne.sarsinti(0.3);
          buyuk(sira === 1 ? '🥇 BİRİNCİ!' : `🏁 ${sira}. oldun!`, sira <= 3 ? `+${[3, 2, 1][sira - 1]} puan` : '+1 puan', 2200);
          O.bitirmeT = O.yarisT;
          break;
        }
      }
    });
  }
  function yarisKare(dt) {
    O.yarisT += dt;
    const t = O.yarisT;
    if (t < 0.9) {
      const n = Math.ceil(-t);
      if (n !== O.sonGeriSayi) {
        O.sonGeriSayi = n;
        if (n > 0) { buyuk(String(n), n === 3 ? 'Hazır ol!' : '', 900); Ses.geriSayim(); }
        else { buyuk('BAŞLA!', '', 700); Ses.basla(); }
      }
    }
    const a = O.ben;
    let g = { gaz: 0, don: 0 };
    if (a && t >= 0) {
      g = girdiAl();
      if (kurtarBasildi) { kurtarBasildi = false; if (!a.bitti && t - O.kurtarT > 2) { O.kurtarT = t; Dunya.yenidenDog(a, O.d); olayIsle([{ tip: 'dogdu' }], a); } }
      const n = Math.max(1, Math.ceil(dt / (1 / 120))), h = dt / n;
      for (let i = 0; i < n; i++) {
        const ol = Dunya.adim(a, g, O.d, t - dt + h * (i + 1), h, []);
        O.arabalar.forEach((c, no) => { if (no === O.benNo) return; const s = c.s; Dunya.arabaCarp(a, { x: s.x, y: s.y, z: s.z, vx: Math.cos(s.a) * (s.hiz || 0), vz: Math.sin(s.a) * (s.hiz || 0), bitti: !!(c.hedef.b & 4), dus: c.hedef.b & 2 ? 1 : 0 }, ol); });
        if (ol.length) olayIsle(ol, a);
      }
      if (t - O.sonGonder > 1 / 15) {
        O.sonGonder = t;
        const b = (a.havada ? 1 : 0) | (a.dus ? 2 : 0) | (a.bitti ? 4 : 0) | (a.turboT > 0 ? 8 : 0) | (a.kayiyor > 0.3 ? 16 : 0) | (a.kalkan > 0 ? 32 : 0) | (a.yerde === 'bal' ? 64 : 0);
        eve({ tip: 'ben', d: [+a.x.toFixed(2), +a.y.toFixed(2), +a.z.toFixed(2), +a.a.toFixed(3), +a.spin.toFixed(2), b, +a.vx.toFixed(1), +a.vz.toFixed(1), a.ci] });
      }
      const hiz = Math.hypot(a.vx, a.vz);
      Ses.motorAyarla(a.havada ? hiz * 1.3 : hiz, g.gaz, a.turboT > 0);
      $('nitroBtn').classList.toggle('bos', !(a.nitro > 0));
      nitroCiz(a);
    }
    const simdi = performance.now();
    O.arabalar.forEach((c, no) => {
      if (no === O.benNo && a) {
        const hiz = Math.hypot(a.vx, a.vz);
        c.s = { x: a.x, y: a.y, z: a.z, a: a.a, spin: a.spin, hiz, havada: a.havada, vy: a.vy, dus: a.dus, turbo: a.turboT > 0, kayiyor: a.kayiyor > 0.3, kalkan: a.kalkan > 0, bal: a.yerde === 'bal', direksiyon: g.don || 0 };
        c.ci = a.ci;
      } else {
        const H = c.hedef, s = c.s, b = H.b || 0;
        const gecen = Math.min(0.15, (simdi - H.zaman) / 1000);
        const tx = H.x + (b & 1 ? 0 : Math.cos(H.a) * (H.hiz || 0) * gecen), tz = H.z + (b & 1 ? 0 : Math.sin(H.a) * (H.hiz || 0) * gecen);
        const k = 1 - Math.exp(-dt * 14);
        s.x += (tx - s.x) * k; s.y += (H.y - s.y) * k; s.z += (tz - s.z) * k;
        s.a += Dunya.aciFark(s.a, H.a) * k; s.spin = H.spin; s.hiz = H.hiz;
        s.vx = Math.cos(s.a) * (s.hiz || 0); s.vz = Math.sin(s.a) * (s.hiz || 0);
        Object.assign(s, { havada: !!(b & 1), dus: b & 2, turbo: !!(b & 8), kayiyor: !!(b & 16), kalkan: !!(b & 32), bal: !!(b & 64) });
      }
      Sahne.arabaGuncelle(c.A, c.s, dt);
      c.et.position.set(c.s.x, c.s.y + 1.9, c.s.z);
      c.et.visible = no !== O.benNo && !(c.hedef.b & 4);
    });
    O.parcalar.forEach(p => { if (p.tur === 'mayin') Sahne.mayinDurum(p.id, (O.d.mayinKapali.get(p.id) ?? -1) > t); });
    if (!O.izle && t >= 0 && (!a || (O.bitirmeT != null && t - O.bitirmeT > 2.2))) izlemeyeBasla();
    O.siraT -= dt;
    if (O.siraT <= 0) { O.siraT = 0.25; siraCiz(); }
    const kalan = Math.max(0, (O.yarisSon ?? 0) - Math.max(0, t));
    $('sayac').textContent = t < 0 ? '' : `${Math.floor(kalan / 60)}:${String(Math.floor(kalan % 60)).padStart(2, '0')}`;
    $('sayac').classList.toggle('az', t >= 0 && kalan < 10);
  }
  function nitroCiz(a) {
    const oran = a.nitroAzami ? Math.max(0, a.nitro / a.nitroAzami) : 0;
    $('nitroDolu').style.height = (oran * 100).toFixed(1) + '%';
    $('nitroGosterge').classList.toggle('yaniyor', !!a.nitroYaniyor && a.nitro > 0);
    $('nitroGosterge').classList.toggle('bos', !(a.nitro > 0));
  }
  function siraCiz() {
    const ilerleme = no => { const bi = O.bitenler.indexOf(no); if (bi >= 0) return 1e6 - bi; const c = O.arabalar.get(no); return c ? c.ci : -1; };
    const liste = [...O.arabalar.keys()].map(no => ({ no, u: ilerleme(no) })).sort((x, y) => y.u - x.u);
    O.izleListe = liste.map(x => x.no);
    if (O.izle) izleGuncelle();
    if (!O.ben) { $('siraYazi').innerHTML = '👀'; $('gucYazi').textContent = ''; $('hizYazi').textContent = ''; return; }
    const benSira = liste.findIndex(x => x.no === O.benNo) + 1;
    $('siraYazi').innerHTML = `${benSira}.<small>/${liste.length}</small>`;
    const a = O.ben;
    $('gucYazi').textContent = a.kalkan ? '🛡️ Kalkan' : '';
    const yuzde = Math.min(100, Math.round(a.enIleri / Math.max(1, O.d.bitisI) * 100));
    $('hizYazi').textContent = a.bitti ? '🏁 Bitirdin!' : `${Math.round(Math.hypot(a.vx, a.vz) * 9)} km/s · %${yuzde}`;
  }

  // ---------- Bitirince / arabası olmayınca: arkadaşları izle ya da serbest bakış ----------
  function izlemeyeBasla() {
    if (!O || O.faz !== 'yaris' || O.izle) return;
    O.izle = { mod: 'oyuncu', no: null };
    $('izlePanel').classList.remove('gizli'); $('nitroGosterge').classList.add('gizli');
    surusGoster(false);
    $('ipucu').textContent = dokun ? '' : '◀ ▶ (Q / E): başka oyuncuyu izle · F: serbest bakış';
    izleDegistir(0);
  }
  function izleAdaylari() { const l = (O.izleListe || [...O.arabalar.keys()]).filter(no => no !== O.benNo); const devam = l.filter(no => !O.bitenler.includes(no)); return devam.length ? devam : l; }
  function izleDegistir(yon) {
    if (!O?.izle) return;
    const l = izleAdaylari(); if (!l.length) { izleSerbest(true); return; }
    let i = l.indexOf(O.izle.no);
    i = i < 0 ? 0 : (i + yon + l.length) % l.length;
    O.izle.no = l[i]; O.izle.mod = 'oyuncu';
    const c = O.arabalar.get(O.izle.no); if (c) Sahne.kameraTakip(c.s, true);
    izlePanelCiz();
  }
  function izleSerbest(ac) {
    if (!O?.izle) return;
    O.izle.mod = ac ? 'serbest' : 'oyuncu';
    if (ac) { const c = O.arabalar.get(O.izle.no) || (O.ben && O.arabalar.get(O.benNo)); const s = c ? c.s : O.d.cizgi[0]; Sahne.kameraGenel({ x: s.x, y: s.y, z: s.z }, 45); }
    else izleDegistir(0);
    izlePanelCiz();
  }
  function izleGuncelle() {
    // izlediğim oyuncu bitirdiyse sıradakine geç
    if (O.izle.mod === 'oyuncu' && O.izle.no !== null && O.bitenler.includes(O.izle.no) && izleAdaylari().some(no => !O.bitenler.includes(no))) setTimeout(() => izleDegistir(0), 1500);
  }
  function izlePanelCiz() {
    const serbest = O.izle.mod === 'serbest';
    $('izleAd').textContent = serbest ? '🎥 Serbest bakış' : `👀 ${ad(O.izle.no)}`;
    $('izleSerbestBtn').textContent = serbest ? '👀 Oyuncuyu izle' : '🎥 Serbest bakış';
    $('izleOnceBtn').disabled = $('izleSonraBtn').disabled = false;
  }
  $('izleOnceBtn').onclick = () => izleDegistir(-1);
  $('izleSonraBtn').onclick = () => izleDegistir(1);
  $('izleSerbestBtn').onclick = () => izleSerbest(O?.izle?.mod !== 'serbest');
  addEventListener('keydown', e => {
    if (!O?.izle || O.faz !== 'yaris' || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if (k === 'q') izleDegistir(-1); else if (k === 'e') izleDegistir(1); else if (k === 'f') izleSerbest(O.izle.mod !== 'serbest');
  });

  // ---------- Puan ----------
  function puanGoster(m) {
    O.puan = m.puan;
    Ses.motorDurdur();
    surusGoster(false); $('ipucu').textContent = ''; $('ipucu').classList.remove('surus');
    $('fazYazi').textContent = '🏆 Puanlar';
    const bu = new Map(m.sonuc.map(s => [s.no, s]));
    const sira = O.oyuncular.map(p => p.no).sort((a, b) => O.puan[b] - O.puan[a]);
    $('turSonuBaslik').textContent = m.bitti ? 'OYUN BİTTİ' : `${m.tur}. TUR BİTTİ`;
    const madalya = ['🥇', '🥈', '🥉'];
    $('turTablo').innerHTML = '<tr><th>Oyuncu</th><th>Bu yarış</th><th></th><th>Toplam</th></tr>' + sira.map(no => {
      const p = O.oyuncular[no], s = bu.get(no);
      return `<tr class="${no === O.benNo ? 'ben' : ''}"><td class="ad" style="--r:${renkHex(p.renk)}">${p.bot ? '🤖 ' : ''}${kacis(p.ad)}</td><td>${s ? (madalya[s.sira - 1] || `${s.sira}.`) : (O.cikti.has(no) ? '🚪' : '❌')}</td><td class="arti">${s ? '+' + s.arti : ''}</td><td><b>${O.puan[no]}</b></td></tr>`;
    }).join('');
    $('turSonuAlt').textContent = m.kimse ? '😱 Kimse bitiremedi! Sonraki seçimde mutlaka Silgi ya da Bomba çıkacak.' : m.bitti ? 'Kazanan açıklanıyor…' : 'Sonraki tur birazdan…';
    ekranGoster('turSonu');
    puanCiz();
  }
  function oyunSonu(m) {
    O.bitti = true; O.faz = 'son';
    O.puan = m.puan;
    Ses.motorDurdur();
    const kazananlar = m.sira.filter(no => m.puan[no] === m.puan[m.sira[0]]);
    const benKazandim = kazananlar.includes(O.benNo);
    $('sonucBaslik').textContent = benKazandim ? 'KAZANDIN!' : kazananlar.length > 1 ? 'BERABERE!' : `${ad(kazananlar[0])} KAZANDI!`;
    $('sonucSira').innerHTML = m.sira.map(no => `<li><span style="--r:${renkHex(O.oyuncular[no].renk)}">${O.oyuncular[no].bot ? '🤖 ' : ''}${kacis(ad(no))}</span> · ${m.puan[no]} puan</li>`).join('');
    $('tekrarBtn').classList.toggle('gizli', !yonetici());
    $('sonucBekle').classList.toggle('gizli', yonetici());
    ekranGoster('sonuc');
    if (benKazandim) { Ses.kazandi(); const b = O.d.cizgi[O.d.bitisI]; Sahne.konfeti(b.x, b.y, b.z); setTimeout(() => O && Sahne.konfeti(b.x, b.y, b.z), 500); } else Ses.kaybetti();
  }

  // ---------- Ana döngü ----------
  let son = performance.now(), elleSur = false;
  function kare(dt) {
    if (O) {
      fareKare(dt);
      if (O.faz === 'yerlestir') yerlestirKare();
      else if (O.faz === 'yaris') yarisKare(dt);
      if (O.faz === 'secim' || O.faz === 'yerlestir' || O.faz === 'yolKoy' || O.faz === 'puan') {
        const kalan = Math.max(0, (O.fazSon - performance.now()) / 1000);
        $('sayac').textContent = O.faz === 'puan' ? '' : Math.ceil(kalan);
        $('sayac').classList.toggle('az', kalan < 5 && O.faz !== 'puan');
        if (O.faz === 'puan') $('turSonuAlt').dataset.k = Math.ceil(kalan);
      }
    }
    const oyunT = O && O.faz === 'yaris' ? Math.max(0, O.yarisT) : performance.now() / 1000;
    Sahne.ciz(dt, oyunT);
  }
  function dongu(simdi) {
    const dt = Math.min(0.05, Math.max(0, (simdi - son) / 1000)); son = simdi;
    if (!elleSur) kare(dt);
    requestAnimationFrame(dongu);
  }
  requestAnimationFrame(dongu);

  // Test kapısı: önizleme gizliyken kareyi elle ilerletmek ve durumu okumak için
  return {
    kare(ms = 16, n = 1) { elleSur = true; for (let i = 0; i < n; i++) kare(ms / 1000); return Oyun.durum(); },
    serbest() { elleSur = false; },
    durum() { return O ? { faz: O.faz, tur: O.tur, benNo: O.benNo, puan: O.puan, parca: O.parcalar.length, ben: O.ben && { x: +O.ben.x.toFixed(1), z: +O.ben.z.toFixed(1), y: +O.ben.y.toFixed(1), bitti: O.ben.bitti }, el: O.el[O.benNo], yarisT: O.yarisT } : { mod }; },
    yolEkle: () => yolEkle(),
    otopilot(v = true) { otopilot = v ? {} : null; },
    tusBas(k, v = true) { if (v) tus.add(k); else tus.delete(k); },
    yerSec(x, z, r = 0) { if (O) { O.yer.x = x; O.yer.z = z; O.yer.r = r; O.yer.degisti = true; } },
    koy: () => koyDene(), sec: i => { const el = document.querySelector(`.pk[data-i="${i}"]`); el?.click(); },
    get O() { return O; },
  };
})();
