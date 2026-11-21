// Oyuncak Rallisi - motor testi: sadece botlarla bütün bir oyun oynatır.
// Çalıştır: node araclar/test-motor.js [harita] [botSayisi]
const Motor = require('../motor.js');
const D = require('../dunya.js');
const harita = process.argv[2] || 'masa', n = +(process.argv[3] || 5);
const ayar = { harita, bitis: 'tur', turSayisi: 6, hedefPuan: 10, yerlestir: 20, yarisSure: 90, botZorluk: 'orta', katlar: {} };
const sayac = {}, yarislar = [];
let son = null, sonYaris = null;
Motor.baslat(Array.from({ length: n }, (_, i) => ({ id: 'b' + i, ad: 'Bot' + i, bot: true, renk: i })), ayar, {
  elle: true,
  herkese: m => {
    sayac[m.tip] = (sayac[m.tip] || 0) + 1;
    if (m.tip === 'faz' && m.faz === 'yaris') sonYaris = { tur: m.tur, bitenler: [] };
    if (m.tip === 'bitirdi') sonYaris.bitenler.push([m.no, m.sure]);
    if (m.tip === 'faz' && m.faz === 'puan') { yarislar.push(sonYaris); console.log(`Tur ${m.tur}: bitiren ${sonYaris.bitenler.length}/${n}`, sonYaris.bitenler.map(b => b[1]).join(' '), '| parça', Motor.durum.parcalar.map(p => p.tur).join(',')); }
    if (m.tip === 'son') son = m;
  },
});
const bas = Date.now();
for (let i = 0; i < 30 * 60 * 25 && !son; i++) Motor.tik(1 / 30);
console.log('mesajlar', sayac);
console.log('son', son, 'süre', Date.now() - bas, 'ms');
if (!son) { console.log('HATA: oyun bitmedi'); process.exit(1); }
