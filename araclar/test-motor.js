// Yol Geçen Hanı - motor testi: sadece botlarla bütün bir oyun oynatır.
// Çalıştır: node araclar/test-motor.js [ortam] [botSayisi]
const Motor = require('../motor.js');
const ayar = { ortam: process.argv[2] || 'vadi', bitis: 'tur', turSayisi: 6, hedefPuan: 10, yerlestir: 20, yarisSure: 90, botZorluk: 'orta', katlar: {} };
const n = +(process.argv[3] || 5);
let son = null, yaris = null;
Motor.baslat(Array.from({ length: n }, (_, i) => ({ id: 'b' + i, ad: 'Bot' + i, bot: true, renk: i })), ayar, {
  elle: true,
  herkese: m => {
    if (m.tip === 'faz' && m.faz === 'yaris') yaris = { bit: [] };
    if (m.tip === 'yolEkle' && m.not) console.log('  yol', m.tur, '→', m.ekler.join(','), '(' + m.not + ')');
    if (m.tip === 'bitirdi') yaris.bit.push(m.sure);
    if (m.tip === 'faz' && m.faz === 'puan') { const M = Motor.durum; console.log(`Tur ${m.tur}: bitiren ${yaris.bit.length}/${n} [${yaris.bit.join(' ')}] pist ${M.d.cizgi.length}m, ${M.parcalar.length} tuzak: ${M.parcalar.map(p => p.tur).join(',')}`); }
    if (m.tip === 'son') son = m;
  },
});
for (let i = 0; i < 30 * 60 * 40 && !son; i++) Motor.tik(1 / 30);
console.log('son', son && son.puan);
if (!son) { console.log('HATA: oyun bitmedi'); process.exit(1); }
