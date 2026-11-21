// =============================================================
// Oyuncak Rallisi - oyuncunun tarafı: ekranlar, bekleme odası, kart seçme, parça yerleştirme,
// kendi arabanı sürme (fizik burada çalışır, yer eve gönderilir), diğerlerini gösterme, HUD, telefon tuşları.
// Kurallar evde (motor.js). Tek kişilik oyunda motor aynı sayfada çalışır.
// =============================================================

const Oyun = (() => {
  const SURUM = 1;   // sw.js ONBELLEK numarasıyla aynı tut; oyuncular farklı sürümdeyse uyarı çıkar
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
  const ayarVarsayilan = () => ({ harita: 'masa', bitis: 'puan', hedefPuan: 10, turSayisi: 7, yerlestir: 30, yarisSure: 90, botZorluk: 'orta', katlar: { yol: true, engel: true, kaygan: true, patlar: true, fayda: true } });
  let lobi = { ayar: ayarVarsayilan(), botlar: [] };
  try { const k = JSON.parse(localStorage.getItem('or.ayar') || 'null'); if (k) lobi.ayar = { ...lobi.ayar, ...k, katlar: { ...lobi.ayar.katlar, ...(k.katlar || {}) } }; } catch (e) { }
  let O = null;   // oyun durumu
  let adim = '';

  Sahne.haritaKur('masa');
  Sahne.kameraGenel(Dunya.HARITALAR.masa.sinir);

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
  const AYAR_SEC = [['ayHarita', 'harita', String], ['ayBitis', 'bitis', String], ['ayHedef', 'hedefPuan', Number], ['ayTur', 'turSayisi', Number], ['ayYerlestir', 'yerlestir', Number], ['aySure', 'yarisSure', Number], ['ayZorluk', 'botZorluk', String]];
  function botEkle(sessiz) {
    if (tumOyuncular().length >= AZAMI) { if (!sessiz) $('lobiDurum').textContent = `En fazla ${AZAMI} oyuncu.`; return; }
    const kullanilan = new Set(lobi.botlar.map(b => b.ad));
    const ad = BOT_ADLARI.find(a => !kullanilan.has(a)) || 'Bot';
    lobi.botlar.push({ id: 'bot-' + Math.random().toString(36).slice(2, 7), ad });
    if (!sessiz) lobiDegisti();
  }
  $('botEkleBtn').onclick = () => { if (yonetici()) botEkle(); };
  function lobiYay() { if (mod === 'ev') Ag.yayinla({ tip: 'lobi', lobi, surum: SURUM }); }
  function lobiDegisti() { try { localStorage.setItem('or.ayar', JSON.stringify(lobi.ayar)); } catch (e) { } if (mod === 'ev') lobiYay(); lobiCiz(); }
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
    $('ayarOzet').textContent = `${L.length} oyuncu · ${Dunya.HARITALAR[a.harita].emoji} ${Dunya.HARITALAR[a.harita].ad} · ${a.bitis === 'puan' ? `${a.hedefPuan} puana ilk ulaşan kazanır` : `${a.turSayisi} tur`}`;
    $('baslaBtn').classList.toggle('gizli', !yonetici());
    if (yonetici()) $('lobiDurum').textContent = L.length < 2 ? (mod === 'yerel' ? 'En az 1 bot ekle.' : 'En az 2 oyuncu gerekli. Oda kodunu gönder ya da bot ekle.') : 'Hazır olunca oyunu başlat.';
    else if (!/Sürümün/.test($('lobiDurum').textContent)) $('lobiDurum').textContent = 'Oda sahibi oyunu başlatacak…';
    if (!O) { Sahne.haritaKur(a.harita); Sahne.kameraGenel(Dunya.HARITALAR[a.harita].sinir); }
  }
  AYAR_SEC.forEach(([el, k, f]) => $(el).addEventListener('change', () => { lobi.ayar[k] = f($(el).value); lobiDegisti(); }));
  $('kurallar').querySelectorAll('input').forEach(c => c.addEventListener('change', () => {
    lobi.ayar.katlar[c.dataset.kat] = c.checked;
    if (!Object.values(lobi.ayar.katlar).some(Boolean)) { lobi.ayar.katlar.yol = true; }
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
  const parcaAd = tur => `${T_[tur]?.emoji || ''} ${T_[tur]?.ad || tur}`;

  // ---------- Oyun kurulumu ----------
  function oyunTemizle() {
    if (O) { O.arabalar.forEach(c => { Sahne.arabaSil(c.A); Sahne.scene.remove(c.et); }); }
    Sahne.parcalariTemizle(); Sahne.imlecleriTemizle(); Sahne.hayaletAyarla(null);
    Ses.motorDurdur();
    O = null;
    ['kartPanel', 'yerlestirPanel', 'yarisBilgi'].forEach(e => $(e).classList.add('gizli'));
    surusGoster(false);
    $('akis').innerHTML = ''; $('ipucu').textContent = '';
  }
  function oyunKur(m) {
    oyunTemizle();
    const benNo = m.oyuncular.findIndex(p => p.id === benimId() && !p.bot);
    O = { oyuncular: m.oyuncular, ayar: m.ayar, benNo, parcalar: [], faz: 'bos', puan: m.oyuncular.map(() => 0), el: {}, koydu: {}, arabalar: new Map(), cikti: new Set(), bitti: false, tur: 0, fazSon: 0, yer: { x: 0, z: 0, r: 0 } };
    Sahne.haritaKur(m.ayar.harita);
    Sahne.kameraGenel(Dunya.HARITALAR[m.ayar.harita].sinir);
    dunyaYenile();
    ekranGoster('hud');
    puanCiz();
  }
  function dunyaYenile() {
    const eski = O.d?.mayinKapali;
    O.d = Dunya.kur(O.ayar.harita, O.parcalar);
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
        const k = O.secim?.kartlar[m.kart]; if (k) k.alan = m.no;
        O.el[m.no] = m.tur;
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
      case 'sil': {
        O.parcalar = O.parcalar.filter(p => !m.ids.includes(p.id)); dunyaYenile();
        m.ids.forEach(id => Sahne.parcaSil(id));
        if (m.tur === 'bomba') { Sahne.patlama(m.x, 0, m.z, true); Ses.patla(); akis(`💣 ${ad(m.no)} bomba patlattı! ${m.ids.length} parça gitti`, 'kotu'); }
        else if (m.tur === 'eski') { if (m.ids.length) { Ses.sil(); akis(`🧹 Pist çok doldu: en eski ${m.ids.length} parça kalktı`); } }
        else { Ses.sil(); akis(`🩹 ${ad(m.no)} bir parçayı sildi`); }
        if (m.no >= 0) { O.koydu[m.no] = true; Sahne.imlecAyarla(m.no, null); }
        if (m.no === O.benNo) { O.bekliyor = false; yerlestirPanelCiz(); }
        break;
      }
      case 'red': O.bekliyor = false; O.redYazi = m.neden; Ses.olmaz(); yerlestirPanelCiz(); break;
      case 'imlec': if (m.no !== O.benNo && O.faz === 'yerlestir' && !O.koydu[m.no]) Sahne.imlecAyarla(m.no, O.el[m.no], m.x, m.z, m.r); break;
      case 'koymadi': akis(`⌛ ${ad(m.no)} parçasını koyamadı`); Sahne.imlecAyarla(m.no, null); break;
      case 'durum': durumGeldi(m); break;
      case 'patla':
        if (m.no !== O.benNo) { Sahne.patlama(m.x, 0, m.z); Ses.patla(); }
        O.d.mayinKapali.set(m.pid, (O.yarisT ?? 0) + 4);
        break;
      case 'bitirdi': {
        if (!O.bitenler.includes(m.no)) O.bitenler.push(m.no);
        O.yarisSon = m.son;
        const sira = m.sira;
        if (m.no !== O.benNo) { Ses.baskasiBitirdi(); const b = O.d.h.bitis; Sahne.konfeti(b.x, 0, b.z); }
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
    $('kartPanel').classList.add('gizli'); $('yerlestirPanel').classList.add('gizli'); $('yarisBilgi').classList.add('gizli');
    $('turSonu').classList.add('gizli');
    surusGoster(false);
    Sahne.hayaletAyarla(null);
    if (m.puan) O.puan = m.puan;
    if (m.faz === 'secim') {
      if (m.tur !== O.tur) {   // yeni tur: arabaları kaldır
        O.tur = m.tur; O.el = {}; O.koydu = {};
        O.arabalar.forEach(c => { Sahne.arabaSil(c.A); Sahne.scene.remove(c.et); }); O.arabalar.clear();
        O.ben = null; Ses.motorDurdur();
        Sahne.kameraGenel(O.d.h.sinir);
        Sahne.imlecleriTemizle();
        ekranGoster('hud');
        buyuk(`${O.tur}. TUR`, 'Parça seçme zamanı', 1300);
      }
      O.secim = { kartlar: m.kartlar.map(k => ({ ...k })), sira: m.sira, siradaki: m.siradaki };
      $('fazYazi').textContent = '🃏 Parça seç';
      $('kartPanel').classList.remove('gizli');
      if (m.siradaki === O.benNo) { Ses.sendeSira(); }
      kartlariCiz();
      $('ipucu').textContent = '';
    } else if (m.faz === 'yerlestir') {
      O.el = m.eller; O.koydu = { ...m.koydu }; O.bekliyor = false; O.redYazi = '';
      $('fazYazi').textContent = '🧩 Parçanı yerleştir';
      const tur = O.el[O.benNo];
      if (tur && T_[tur].kisisel) akis(`${parcaAd(tur)} senin! Sonraki yarışta işine yarayacak.`, 'iyi');
      const s = O.d.h.sinir;
      O.yer = { x: (s.x0 + s.x1) / 2, z: (s.z0 + s.z1) / 2, r: 0, degisti: true };
      $('yerlestirPanel').classList.remove('gizli');
      yerlestirPanelCiz();
      $('ipucu').textContent = dokun ? '' : 'Fareyle gez · Tıkla: koy · R / sağ tık / tekerlek: döndür';
    } else if (m.faz === 'yaris') yarisBasla(m);
    else if (m.faz === 'puan') puanGoster(m);
    puanCiz();
  }

  // ---------- Kart seçme ----------
  function kartlariCiz() {
    const S = O.secim; if (!S) return;
    const benimSiram = S.siradaki === O.benNo && O.faz === 'secim' && !O.el[O.benNo];
    $('kartBaslik').textContent = O.faz !== 'secim' ? '' : benimSiram ? '👉 Sıra sende! Bir parça seç' : `${ad(S.siradaki)} seçiyor…`;
    $('kartBaslik').classList.toggle('sende', benimSiram);
    const anahtar = O.tur + ':' + S.kartlar.map(k => k.tur).join(',');
    if ($('kartlar').dataset.anahtar !== anahtar) {   // yeni kartlar: bir kez çiz (animasyon bir kez oynasın)
      $('kartlar').dataset.anahtar = anahtar;
      $('kartlar').innerHTML = S.kartlar.map((k, i) => {
        const T = T_[k.tur], kat = K_[T.kat];
        return `<div class="pk" data-i="${i}" style="--k:${kat.renk}"><span class="kat">${kat.ad}</span><span class="em">${T.emoji}</span><b>${T.ad}</b><small>${T.acik}</small></div>`;
      }).join('');
      $('kartlar').querySelectorAll('.pk').forEach(el => { el.onclick = () => {
        const S2 = O.secim; if (!el.classList.contains('secilebilir')) return;
        if (O.secimGitti === O.tur + ':' + S2.siradaki) return;
        O.secimGitti = O.tur + ':' + S2.siradaki; eve({ tip: 'sec', kart: +el.dataset.i });
      }; });
    }
    $('kartlar').querySelectorAll('.pk').forEach(el => {
      const k = S.kartlar[+el.dataset.i], alan = k.alan !== null && k.alan !== undefined;
      el.classList.toggle('alindi', alan); el.classList.toggle('secilebilir', !alan && benimSiram);
      el.dataset.alan = alan ? ad(k.alan) : '';
      if (alan) el.style.setProperty('--alan', renkHex(O.oyuncular[k.alan].renk));
    });
  }

  // ---------- Yerleştirme ----------
  function yerlestirPanelCiz() {
    const tur = O.el[O.benNo];
    const el = $('elimde');
    if (!tur) { el.innerHTML = 'Bu turda parçan yok. Diğerlerini izle.'; el.style.setProperty('--k', '#888'); return; }
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
  function dondur(y = 1) { if (!yerlestiriyorum()) return; O.yer.r = ((O.yer.r + y * Math.PI / 4) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2); O.yer.degisti = true; Ses.don(); }
  function koyDene() {
    if (!yerlestiriyorum()) return;
    const tur = O.el[O.benNo], { x, z, r } = O.yer;
    const hata = Dunya.yerlestirmeHatasi(O.d, tur, x, z, r);
    if (hata) { O.redYazi = hata; Ses.olmaz(); yerlestirPanelCiz(); return; }
    O.bekliyor = true; O.redYazi = '';
    eve({ tip: 'koy', x, z, r });
    yerlestirPanelCiz();
  }
  function yerAyarla(px, py) {
    const p = Sahne.ekrandanMasaya(px, py); if (!p) return;
    const s = O.d.h.sinir;
    O.yer.x = Math.max(s.x0, Math.min(s.x1, Math.round(p.x * 2) / 2));
    O.yer.z = Math.max(s.z0, Math.min(s.z1, Math.round(p.z * 2) / 2));
    O.yer.degisti = true;
  }
  let sonImlec = 0;
  function yerlestirKare() {
    const tur = O.el[O.benNo];
    if (!yerlestiriyorum()) { Sahne.hayaletAyarla(null); return; }
    const Y = O.yer;
    if (Y.degisti) {
      Y.degisti = false;
      Y.hata = Dunya.yerlestirmeHatasi(O.d, tur, Y.x, Y.z, Y.r, true);
      Y.hedefler = tur === 'silgi' ? [Dunya.silgiHedefi(O.d, Y.x, Y.z)].filter(Boolean).map(p => p.id) : tur === 'bomba' ? Dunya.bombaHedefleri(O.d, Y.x, Y.z).map(p => p.id) : [];
      if (performance.now() - sonImlec > 120) { sonImlec = performance.now(); eve({ tip: 'imlec', x: Y.x, z: Y.z, r: Y.r }); }
      else Y.imlecBekliyor = true;
    } else if (Y.imlecBekliyor && performance.now() - sonImlec > 120) { Y.imlecBekliyor = false; sonImlec = performance.now(); eve({ tip: 'imlec', x: Y.x, z: Y.z, r: Y.r }); }
    Sahne.hayaletAyarla(tur, Y.x, Y.z, Y.r, !Y.hata);
    if (Y.hedefler?.length) Sahne.vurgula(Y.hedefler);
    $('ipucu').textContent = dokun ? (Y.hata ? '❌ ' + Y.hata : '') : (Y.hata ? '❌ ' + Y.hata : 'Tıkla: koy · R / sağ tık / tekerlek: döndür');
  }
  const kanvas = $('sahne');
  kanvas.addEventListener('pointermove', e => { if (e.pointerType !== 'touch' && yerlestiriyorum()) yerAyarla(e.clientX, e.clientY); });
  kanvas.addEventListener('pointerdown', e => {
    Ses.baslat();
    if (!yerlestiriyorum()) return;
    yerAyarla(e.clientX, e.clientY);
    if (e.pointerType === 'touch') return;
    if (e.button === 0) koyDene(); else if (e.button === 2) dondur(1);
  });
  kanvas.addEventListener('contextmenu', e => e.preventDefault());
  kanvas.addEventListener('wheel', e => { if (yerlestiriyorum()) { e.preventDefault(); dondur(e.deltaY > 0 ? 1 : -1); } }, { passive: false });
  $('donBtn').onclick = () => dondur(1);
  $('koyBtn').onclick = koyDene;

  // ---------- Yarış ----------
  const tus = new Set(), dokunTus = new Set();
  let otopilot = null;   // sadece test için
  let nitroBasildi = false, kurtarBasildi = false;
  addEventListener('keydown', e => {
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    if (!e.repeat) {
      if (k === ' ') nitroBasildi = true;
      if (k === 'r') { if (O?.faz === 'yerlestir') dondur(1); else kurtarBasildi = true; }
      if (k === 'q' && O?.faz === 'yerlestir') dondur(-1);
      if (k === 'm') mikDegistir();
    }
    tus.add(k);
  });
  addEventListener('keyup', e => tus.delete(e.key.toLowerCase()));
  addEventListener('blur', () => { tus.clear(); dokunTus.clear(); });
  document.querySelectorAll('[data-t]').forEach(b => {
    const t = b.dataset.t;
    const bas = e => { e.preventDefault(); Ses.baslat(); dokunTus.add(t); b.classList.add('basili'); if (t === 'nitro') nitroBasildi = true; if (t === 'kurtar') kurtarBasildi = true; try { b.setPointerCapture(e.pointerId); } catch (x) { } };
    const birak = e => { dokunTus.delete(t); b.classList.remove('basili'); };
    b.addEventListener('pointerdown', bas); b.addEventListener('pointerup', birak); b.addEventListener('pointercancel', birak); b.addEventListener('lostpointercapture', birak);
  });
  function surusGoster(v) { document.querySelectorAll('.surus').forEach(e => e.classList.toggle('gizli2', !v)); }
  surusGoster(false);
  function girdiAl() {
    const v = k => tus.has(k);
    let gaz = (v('w') || v('arrowup') || dokunTus.has('gaz')) ? 1 : 0;
    if (v('s') || v('arrowdown') || dokunTus.has('fren')) gaz = -1;
    const don = ((v('d') || v('arrowright') || dokunTus.has('sag')) ? 1 : 0) - ((v('a') || v('arrowleft') || dokunTus.has('sol')) ? 1 : 0);
    const turbo = nitroBasildi; nitroBasildi = false;
    if (otopilot && O?.ben && O.yh) return Dunya.botGirdi(otopilot.bot ||= { a: O.ben, no: 0, hata: 0.05 }, O.d, O.yh, O.yarisT, 1 / 60);
    return { gaz, don, turbo };
  }

  function yarisBasla(m) {
    O.yarisT = -m.geriSayim; O.yarisSon = m.kalan; O.bitenler = []; O.sonGeriSayi = null; O.sonGonder = 0; O.siraT = 0; O.kurtarT = 0;
    O.arabalar.forEach(c => { Sahne.arabaSil(c.A); Sahne.scene.remove(c.et); }); O.arabalar.clear();
    dunyaYenile(); O.d.mayinKapali = new Map();
    O.yh = Dunya.yolHaritasi(O.d);
    O.ben = null;
    O.oyuncular.forEach(p => {
      const y = m.yerler[p.no]; if (!y) return;
      const A = Sahne.arabaYap(p.renk);
      const et = Sahne.etiketYap(p.ad, renkHex(p.renk));
      Sahne.scene.add(A.g); Sahne.scene.add(et);
      const s = { x: y.x, y: 0, z: y.z, a: y.a, spin: 0, hiz: 0 };
      O.arabalar.set(p.no, { A, et, s, hedef: { ...s, zaman: performance.now() } });
      if (p.no === O.benNo) {
        O.ben = Dunya.yeniAraba(y.x, y.z, y.a); if (otopilot) otopilot = {};
        const g = m.guc?.[p.no] || {};
        O.ben.kalkan = g.kalkan || 0; O.ben.nitro = (g.nitro || 0) * 3;
      }
    });
    if (O.ben) Sahne.kameraTakip(O.ben); else Sahne.kameraGenel(O.d.h.sinir);
    $('fazYazi').textContent = `🏁 ${O.tur}. yarış`;
    $('yarisBilgi').classList.remove('gizli');
    surusGoster(!!O.ben);
    $('ipucu').textContent = O.ben ? 'W/↑ gaz · S/↓ fren · A D / ← → direksiyon · Boşluk nitro · R kurtar' : '';
    $('ipucu').classList.add('surus');
    if (O.ben) Ses.motorBaslat();
  }
  function durumGeldi(m) {
    const simdi = performance.now();
    m.l.forEach(([no, x, y, z, a, spin, b, hiz]) => {
      if (no === O.benNo) return;
      const c = O.arabalar.get(no); if (!c) return;
      const onceDus = c.hedef.b & 2;
      c.hedef = { x, y, z, a, spin, b, hiz, zaman: simdi };
      if (onceDus && !(b & 2)) { Sahne.poof(x, y + 0.5, z); c.s.x = x; c.s.y = y; c.s.z = z; c.s.a = a; }
    });
  }
  function olayIsle(ol, a) {
    ol.forEach(o => {
      switch (o.tip) {
        case 'mayin': eve({ tip: 'mayin', pid: o.pid, x: o.x, z: o.z }); Sahne.patlama(o.x, 0, o.z); Ses.patla(); break;
        case 'yay': Ses.yay(); Sahne.yayBas(a.x, a.z); Sahne.halkaEfekt(a.x, 0.3, a.z, 0x6aff7a, 3); break;
        case 'portal': Ses.portal(); Sahne.portalEfekt(o.x, o.z, o.bx, o.bz); break;
        case 'turbo': Ses.turbo(); break;
        case 'nitro': Ses.nitro(); Sahne.halkaEfekt(a.x, 0.4, a.z, 0xff8a2a, 3); akis(`🔥 Nitro! (${a.nitro} kaldı)`); break;
        case 'carpti': Ses.carp(o.guc); Sahne.kivilcim(o.x, a.y + 0.5, o.z, Math.min(24, 4 + o.guc * 1.5)); if (o.guc > 8) Sahne.sarsinti(0.25); break;
        case 'vurdu': Ses.vurdu(); Sahne.kivilcim(a.x, a.y + 0.6, a.z, 20); Sahne.sarsinti(0.5); break;
        case 'kalkan': Ses.kalkan(); Sahne.halkaEfekt(a.x, 0.6, a.z, 0x6ad8ff, 4); akis('🛡️ Kalkan seni korudu!', 'iyi'); break;
        case 'indi': Ses.indi(o.guc); if (o.guc > 4) Sahne.toz(a.x, a.y + 0.1, a.z, Math.min(16, o.guc * 1.5)); break;
        case 'dustu': Ses.dus(); break;
        case 'dogdu': Ses.dogdu(); Sahne.poof(a.x, a.y + 0.5, a.z); break;
        case 'bitis': {
          eve({ tip: 'bitir' });
          const sira = O.bitenler.length + (O.bitenler.includes(O.benNo) ? 0 : 1);
          Ses.bitis(sira === 1); Sahne.konfeti(a.x, a.y, a.z); Sahne.sarsinti(0.3);
          buyuk(sira === 1 ? '🥇 BİRİNCİ!' : `🏁 ${sira}. oldun!`, sira <= 3 ? `+${[3, 2, 1][sira - 1]} puan` : '+1 puan', 2200);
          setTimeout(() => { if (O?.faz === 'yaris') Sahne.kameraGenel(O.d.h.sinir); }, 1800);
          break;
        }
      }
    });
  }
  function yarisKare(dt) {
    O.yarisT += dt;
    const t = O.yarisT;
    // geri sayım
    if (t < 0.9) {
      const n = Math.ceil(-t);
      if (n !== O.sonGeriSayi) {
        O.sonGeriSayi = n;
        if (n > 0) { buyuk(String(n), n === 3 ? 'Hazır ol!' : '', 900); Ses.geriSayim(); }
        else { buyuk('BAŞLA!', '', 700); Ses.basla(); }
      }
    }
    const a = O.ben;
    if (a && t >= 0) {
      const g = girdiAl();
      if (kurtarBasildi) { kurtarBasildi = false; if (!a.bitti && t - O.kurtarT > 2) { O.kurtarT = t; Dunya.yenidenDog(a); olayIsle([{ tip: 'dogdu' }], a); } }
      const n = Math.max(1, Math.ceil(dt / (1 / 120))), h = dt / n;
      for (let i = 0; i < n; i++) {
        const ol = Dunya.adim(a, g, O.d, t - dt + h * (i + 1), h, []);
        O.arabalar.forEach((c, no) => { if (no === O.benNo) return; const s = c.s; Dunya.arabaCarp(a, { x: s.x, y: s.y, z: s.z, vx: Math.cos(s.a) * (s.hiz || 0), vz: Math.sin(s.a) * (s.hiz || 0), bitti: !!(c.hedef.b & 4), dus: c.hedef.b & 2 ? 1 : 0 }, ol); });
        if (ol.length) olayIsle(ol, a);
      }
      if (t - O.sonGonder > 1 / 15) {
        O.sonGonder = t;
        const b = (a.havada ? 1 : 0) | (a.dus ? 2 : 0) | (a.bitti ? 4 : 0) | (a.turboT > 0 ? 8 : 0) | (a.kayiyor > 0.3 ? 16 : 0) | (a.kalkan > 0 ? 32 : 0) | (a.yerde === 'bal' ? 64 : 0);
        eve({ tip: 'ben', d: [+a.x.toFixed(2), +a.y.toFixed(2), +a.z.toFixed(2), +a.a.toFixed(3), +a.spin.toFixed(2), b, +a.vx.toFixed(1), +a.vz.toFixed(1)] });
      }
      const hiz = Math.hypot(a.vx, a.vz);
      Ses.motorAyarla(a.havada ? hiz * 1.3 : hiz, g.gaz, a.turboT > 0);
      $('nitroBtn').classList.toggle('bos', !a.nitro);
    }
    // çizim
    const simdi = performance.now();
    O.arabalar.forEach((c, no) => {
      if (no === O.benNo && a) {
        const hiz = Math.hypot(a.vx, a.vz);
        c.s = { x: a.x, y: a.y, z: a.z, a: a.a, spin: a.spin, hiz, havada: a.havada, vy: a.vy, dus: a.dus, turbo: a.turboT > 0, kayiyor: a.kayiyor > 0.3, kalkan: a.kalkan > 0, bal: a.yerde === 'bal' };
      } else {
        const H = c.hedef, s = c.s, b = H.b || 0;
        const gecen = Math.min(0.15, (simdi - H.zaman) / 1000);
        const tx = H.x + (b & 1 ? 0 : Math.cos(H.a) * (H.hiz || 0) * gecen), tz = H.z + (b & 1 ? 0 : Math.sin(H.a) * (H.hiz || 0) * gecen);
        const k = 1 - Math.exp(-dt * 14);
        s.x += (tx - s.x) * k; s.y += (H.y - s.y) * k; s.z += (tz - s.z) * k;
        let fa = H.a - s.a; while (fa > Math.PI) fa -= 2 * Math.PI; while (fa < -Math.PI) fa += 2 * Math.PI;
        s.a += fa * k; s.spin = H.spin; s.hiz = H.hiz;
        Object.assign(s, { havada: !!(b & 1), dus: b & 2, turbo: !!(b & 8), kayiyor: !!(b & 16), kalkan: !!(b & 32), bal: !!(b & 64) });
      }
      Sahne.arabaGuncelle(c.A, c.s, dt);
      c.et.position.set(c.s.x, c.s.y + 2.3, c.s.z);
      c.et.visible = !(c.hedef.b & 4) || no === O.benNo;
    });
    // mayınlar
    O.parcalar.forEach(p => { if (p.tur === 'mayin') Sahne.mayinDurum(p.id, (O.d.mayinKapali.get(p.id) ?? -1) > t); });
    // HUD
    O.siraT -= dt;
    if (O.siraT <= 0) { O.siraT = 0.25; siraCiz(); }
    const kalan = Math.max(0, (O.yarisSon ?? 0) - Math.max(0, t));
    $('sayac').textContent = t < 0 ? '' : `${Math.floor(kalan / 60)}:${String(Math.floor(kalan % 60)).padStart(2, '0')}`;
    $('sayac').classList.toggle('az', t >= 0 && kalan < 10);
  }
  function siraCiz() {
    if (!O.ben) { $('siraYazi').innerHTML = '👀 İzliyorsun'; $('gucYazi').textContent = ''; $('hizYazi').textContent = ''; return; }
    const ilerleme = no => {
      const bi = O.bitenler.indexOf(no); if (bi >= 0) return -1000 + bi;
      const c = O.arabalar.get(no); if (!c) return 1e9;
      const i = Dunya.enYakinYurur(O.yh, c.s.x, c.s.z, 3);
      return i >= 0 ? O.yh.uz[i] : 5e8;
    };
    const liste = [...O.arabalar.keys()].map(no => ({ no, u: ilerleme(no) })).sort((x, y) => x.u - y.u);
    const benSira = liste.findIndex(x => x.no === O.benNo) + 1;
    $('siraYazi').innerHTML = `${benSira}.<small>/${liste.length}</small>`;
    const a = O.ben;
    $('gucYazi').textContent = [a.nitro ? `🔥×${a.nitro}` : '', a.kalkan ? '🛡️' : ''].filter(Boolean).join('  ');
    $('hizYazi').textContent = a.bitti ? '🏁 Bitirdin!' : `${Math.round(Math.hypot(a.vx, a.vz) * 9)} km/s`;
  }

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
    if (benKazandim) { Ses.kazandi(); const b = O.d.h.bitis; Sahne.konfeti(b.x, 0, b.z); setTimeout(() => O && Sahne.konfeti(b.x, 0, b.z), 500); } else Ses.kaybetti();
  }

  // ---------- Ana döngü ----------
  let son = performance.now(), elleSur = false;
  function kare(dt) {
    if (O) {
      if (O.faz === 'yerlestir') yerlestirKare();
      else if (O.faz === 'yaris') yarisKare(dt);
      if (O.faz === 'secim' || O.faz === 'yerlestir' || O.faz === 'puan') {
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
    otopilot(v = true) { otopilot = v ? {} : null; },
    tusBas(k, v = true) { if (v) tus.add(k); else tus.delete(k); },
    yerSec(x, z, r = 0) { if (O) { O.yer.x = x; O.yer.z = z; O.yer.r = r; O.yer.degisti = true; } },
    koy: () => koyDene(), sec: i => { const el = document.querySelector(`.pk[data-i="${i}"]`); el?.click(); },
    get O() { return O; },
  };
})();
