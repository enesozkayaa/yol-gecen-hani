// =============================================================
// Oyuncak Rallisi - 3D görüntü (Three.js). Oda, kuleler, parçalar, arabalar, efektler, kamera.
// Kurallar ve fizik burada değil (dunya.js). Burası sadece çizer.
// Yön: dünya açısı a için mesh.rotation.y = -a (model +x'e bakar).
// =============================================================

const Sahne = (() => {
  const RENKLER = [0xe8413a, 0x2f7de1, 0xf2c12e, 0x34b45a, 0x9a4ae0, 0xff8a1e];
  const RENK_AD = ['Kırmızı', 'Mavi', 'Sarı', 'Yeşil', 'Mor', 'Turuncu'];
  let renderer, scene, camera, gunes;
  const kam = { x: 0, y: 60, z: 40, hx: 0, hy: 0, hz: 0, sars: 0, mod: 'genel', hedef: null };
  const parcaG = new Map();     // id → { g, anim, p }
  let haritaG = null, hayalet = null, hayaletTur = null;
  const imlecler = new Map();
  const animasyonlar = [];      // { son, f(t01) }
  let zaman = 0;

  // ---------- Yardımcılar ----------
  const matOnbellek = new Map();
  function mat(renk, o = {}) {
    const k = renk + JSON.stringify(o);
    if (!matOnbellek.has(k)) matOnbellek.set(k, new THREE.MeshStandardMaterial({ color: renk, roughness: o.p ?? 0.6, metalness: o.m ?? 0, emissive: o.e ?? 0, emissiveIntensity: o.ei ?? 1, transparent: !!o.sf, opacity: o.sf ?? 1, map: o.map || null }));
    return matOnbellek.get(k);
  }
  function kutu(w, h, d, m, x = 0, y = 0, z = 0, golge = true) {
    const ms = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    ms.position.set(x, y, z); ms.castShadow = golge; ms.receiveShadow = true; return ms;
  }
  function silindir(rt, rb, h, m, n = 16) { const ms = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, n), m); ms.castShadow = true; ms.receiveShadow = true; return ms; }
  function tuval(w, h, ciz) { const c = document.createElement('canvas'); c.width = w; c.height = h; ciz(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
  const rnd = (a, b) => a + Math.random() * (b - a);

  // ---------- Dokular ----------
  let DOKU = null;
  function dokulariYap() {
    DOKU = {
      hali: tuval(512, 512, (g, w, h) => {
        g.fillStyle = '#8a3a4a'; g.fillRect(0, 0, w, h);
        for (let r = 250; r > 20; r -= 26) { g.strokeStyle = r % 52 ? '#e8b86a' : '#3a5a8a'; g.lineWidth = 9; g.beginPath(); g.arc(256, 256, r, 0, 7); g.stroke(); }
        for (let i = 0; i < 24; i++) { const a = i / 24 * 6.283; g.fillStyle = i % 2 ? '#f0e0c0' : '#2a7a6a'; g.beginPath(); g.arc(256 + Math.cos(a) * 190, 256 + Math.sin(a) * 190, 10, 0, 7); g.fill(); }
      }),
      parke: tuval(256, 256, (g, w, h) => {
        for (let i = 0; i < 8; i++) { g.fillStyle = ['#a8743e', '#b8834a', '#9a6a38', '#c08c52'][i % 4]; g.fillRect(0, i * 32, w, 32); g.fillStyle = '#0002'; g.fillRect(0, i * 32, w, 2); g.fillRect((i * 97) % 256, i * 32, 2, 32); }
      }),
      cetvel: tuval(512, 64, (g, w, h) => {
        g.fillStyle = '#f7cf3a'; g.fillRect(0, 0, w, h);
        g.fillStyle = '#3a2a10'; for (let i = 0; i <= 100; i++) { const x = i / 100 * w; const u = i % 10 === 0 ? 22 : i % 5 === 0 ? 15 : 9; g.fillRect(x, 0, 2, u); g.fillRect(x, h - u, 2, u); }
        g.font = 'bold 14px sans-serif'; for (let i = 0; i <= 10; i++) g.fillText(String(i), i / 10 * w + 3, 38);
      }),
      cetvelMavi: tuval(512, 64, (g, w, h) => {
        g.fillStyle = '#7ad0ff'; g.fillRect(0, 0, w, h);
        g.fillStyle = '#0a3a6a'; for (let i = 0; i <= 60; i++) { const x = i / 60 * w; const u = i % 10 === 0 ? 20 : 10; g.fillRect(x, 0, 2, u); g.fillRect(x, h - u, 2, u); }
      }),
      dama: tuval(128, 128, (g, w, h) => { for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { g.fillStyle = (i + j) % 2 ? '#111' : '#fafafa'; g.fillRect(i * 16, j * 16, 16, 16); } }),
      ok: tuval(128, 128, (g, w, h) => {
        g.fillStyle = '#ff5a1a'; g.fillRect(0, 0, w, h);
        g.fillStyle = '#ffe24a'; for (const y of [0, 64]) { g.beginPath(); g.moveTo(20, y + 6); g.lineTo(108, y + 6); g.lineTo(64, y + 58); g.closePath(); g.fill(); }
      }),
      girdap: (renk) => tuval(128, 128, (g, w, h) => {
        const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, '#fff'); gr.addColorStop(0.4, renk); gr.addColorStop(1, '#0000');
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
        g.strokeStyle = '#ffffffaa'; g.lineWidth = 5; for (let k = 0; k < 3; k++) { g.beginPath(); for (let i = 0; i < 40; i++) { const a = i * 0.25 + k * 2.09, r = i * 1.4; g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); } g.stroke(); }
      }),
      tahta: tuval(256, 256, (g, w, h) => {
        g.fillStyle = '#d8a868'; g.fillRect(0, 0, w, h);
        g.strokeStyle = '#b07a3a88'; g.lineWidth = 2; for (let i = 0; i < 30; i++) { g.beginPath(); g.moveTo(0, i * 9 + Math.sin(i) * 4); g.bezierCurveTo(80, i * 9 + 6, 170, i * 9 - 6, 256, i * 9 + Math.cos(i) * 4); g.stroke(); }
      }),
    };
    DOKU.hali.wrapS = DOKU.hali.wrapT = THREE.ClampToEdgeWrapping;
    DOKU.parke.wrapS = DOKU.parke.wrapT = THREE.RepeatWrapping; DOKU.parke.repeat.set(30, 30);
    DOKU.ok.wrapS = DOKU.ok.wrapT = THREE.RepeatWrapping;
    DOKU.dama.wrapS = DOKU.dama.wrapT = THREE.RepeatWrapping;
    DOKU.girdapMavi = DOKU.girdap('#3ab0ff'); DOKU.girdapTuruncu = DOKU.girdap('#ff8a2a');
  }

  // ---------- Kurulum ----------
  function kur(kanvas) {
    renderer = new THREE.WebGLRenderer({ canvas: kanvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x3a2a3a);
    scene.fog = new THREE.Fog(0x3a2a3a, 90, 190);
    camera = new THREE.PerspectiveCamera(42, 1, 0.5, 400);
    scene.add(new THREE.HemisphereLight(0xfff0dc, 0x5a3a4a, 1.1));
    gunes = new THREE.DirectionalLight(0xffe2b8, 2.3);
    gunes.position.set(30, 60, 25); gunes.castShadow = true;
    gunes.shadow.mapSize.set(2048, 2048);
    Object.assign(gunes.shadow.camera, { left: -55, right: 55, top: 40, bottom: -40, near: 10, far: 150 });
    gunes.shadow.bias = -0.0005; gunes.shadow.normalBias = 0.03;
    scene.add(gunes);
    const dolgu = new THREE.DirectionalLight(0x9ab8ff, 0.5); dolgu.position.set(-30, 20, -30); scene.add(dolgu);
    dokulariYap();
    parcacikKur();
    boyutla();
    addEventListener('resize', boyutla);
  }
  function boyutla() {
    const w = Math.max(1, innerWidth), h = Math.max(1, innerHeight);
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }

  // ---------- Harita ----------
  function haritaKur(haritaAd) {
    if (haritaG) { scene.remove(haritaG); }
    haritaG = new THREE.Group(); scene.add(haritaG);
    const H = Dunya.HARITALAR[haritaAd] || Dunya.HARITALAR.masa, mutfak = haritaAd === 'mutfak';
    // zemin: parke + halı
    const parke = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ map: DOKU.parke, roughness: 0.7 }));
    parke.rotation.x = -Math.PI / 2; parke.position.y = -10.05; parke.receiveShadow = true; haritaG.add(parke);
    const hali = new THREE.Mesh(new THREE.CircleGeometry(48, 64), new THREE.MeshStandardMaterial({ map: DOKU.hali, roughness: 0.95 }));
    hali.rotation.x = -Math.PI / 2; hali.position.y = -10; hali.scale.set(1.3, 0.75, 1); hali.receiveShadow = true; haritaG.add(hali);
    // uzakta duvarlar
    const duvarM = new THREE.MeshStandardMaterial({ color: mutfak ? 0xe8d8b0 : 0xb8c8e0, roughness: 0.9 });
    [[0, -95, 0], [0, 95, Math.PI], [-130, 0, Math.PI / 2], [130, 0, -Math.PI / 2]].forEach(([x, z, r]) => { const d = new THREE.Mesh(new THREE.PlaneGeometry(280, 120), duvarM); d.position.set(x, 40, z); d.rotation.y = r; haritaG.add(d); });
    // kuleler
    const kitapRenk = [0xd84a3a, 0x3a7ad8, 0x3ab06a, 0xe8b02a, 0x8a4ad0, 0xe86aa0, 0x2ab0b0, 0xf07a2a];
    H.adalar.forEach((a, i) => {
      const g = new THREE.Group(); g.position.set(a.cx, 0, a.cz); haritaG.add(g);
      if (!mutfak) {
        // kitap yığını
        let y = 0, k = i * 3;
        while (y > -10) {
          const h = y === 0 ? 1.4 : rnd(1.2, 2.2), ust = y === 0;
          const w = ust ? a.w : a.w * rnd(0.82, 1.02), l = ust ? a.l : a.l * rnd(0.82, 1.02);
          const kitap = new THREE.Group(); kitap.position.y = y - h / 2; if (!ust) kitap.rotation.y = rnd(-0.12, 0.12);
          const kapak = mat(kitapRenk[k++ % kitapRenk.length], { p: 0.55 });
          kitap.add(kutu(w, h, l, kapak));
          kitap.add(kutu(w * 0.97 + 0.02, h * 0.8, l - 0.35, mat(0xfaf4e0, { p: 0.9 }), 0.12, 0, 0, false));
          g.add(kitap); y -= h;
        }
        // üst kapakta yazı şeridi
        const serit = kutu(a.w * 0.9, 0.02, 0.6, mat(0xfff2c0), 0, 0.01, -a.l / 2 + 1.2, false); g.add(serit);
      } else {
        // kesme tahtası + konserve kutuları
        const tahta = kutu(a.w, 1, a.l, new THREE.MeshStandardMaterial({ map: DOKU.tahta, roughness: 0.75 }), 0, -0.5, 0); g.add(tahta);
        const kRenk = [0xd83a2a, 0xe8c02a, 0x2a8ad8, 0x3ab05a];
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz], j) => {
          const r = Math.min(a.w, a.l) * 0.17;
          const kk = silindir(r, r, 9, mat(0xc8ccd4, { m: 0.8, p: 0.3 }), 24); kk.position.set(sx * (a.w / 2 - r - 0.4), -5.5, sz * (a.l / 2 - r - 0.4)); g.add(kk);
          const et = silindir(r * 1.01, r * 1.01, 5, mat(kRenk[(i + j) % 4], { p: 0.5 }), 24); et.position.copy(kk.position); g.add(et);
        });
        const kavanoz = silindir(Math.min(a.w, a.l) * 0.3, Math.min(a.w, a.l) * 0.3, 9, mat(0xe8f4ff, { p: 0.1, sf: 0.55 }), 24); kavanoz.position.y = -5.5; kavanoz.castShadow = false; g.add(kavanoz);
      }
    });
    // temel köprüler (sarı cetveller)
    Dunya.temelKopruler(haritaAd).forEach(y => {
      const m = new THREE.MeshStandardMaterial({ map: DOKU.cetvel, roughness: 0.45 });
      const c = kutu(y.hu * 2, 0.3, y.hv * 2, m, y.cx, -0.15, y.cz); c.rotation.y = -y.r; haritaG.add(c);
    });
    // başlangıç çizgisi ve bitiş
    const b = H.baslangic, bt = H.bitis;
    const cizgi = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 10), new THREE.MeshStandardMaterial({ map: DOKU.dama, roughness: 0.6 }));
    DOKU.dama.repeat.set(1, 8); cizgi.rotation.x = -Math.PI / 2; cizgi.position.set(b.x + 3.2, 0.02, b.z); cizgi.receiveShadow = true; haritaG.add(cizgi);
    const bitDisk = new THREE.Mesh(new THREE.CircleGeometry(bt.r, 40), new THREE.MeshStandardMaterial({ map: tuval(128, 128, (g) => { for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { g.fillStyle = (i + j) % 2 ? '#111' : '#fff'; g.fillRect(i * 16, j * 16, 16, 16); } }), roughness: 0.6 }));
    bitDisk.rotation.x = -Math.PI / 2; bitDisk.position.set(bt.x, 0.02, bt.z); bitDisk.receiveShadow = true; haritaG.add(bitDisk);
    // bitiş kemeri
    const kemer = new THREE.Group(); kemer.position.set(bt.x, 0, bt.z);
    const direkM = mat(0xff4a8a, { p: 0.4 });
    [-1, 1].forEach(s => { const d = silindir(0.25, 0.25, 5, direkM); d.position.set(0, 2.5, s * (bt.r + 0.3)); kemer.add(d); });
    const pano = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.2, bt.r * 2 + 1.2), [mat(0xff4a8a), mat(0xff4a8a), mat(0xff4a8a), mat(0xff4a8a),
      new THREE.MeshStandardMaterial({ map: tuval(256, 64, (g, w, h) => { g.fillStyle = '#ffe24a'; g.fillRect(0, 0, w, h); g.fillStyle = '#c8104a'; g.font = 'bold 44px sans-serif'; g.textAlign = 'center'; g.fillText('BİTİŞ', w / 2, 48); }) }),
      new THREE.MeshStandardMaterial({ map: tuval(256, 64, (g, w, h) => { g.fillStyle = '#ffe24a'; g.fillRect(0, 0, w, h); g.fillStyle = '#c8104a'; g.font = 'bold 44px sans-serif'; g.textAlign = 'center'; g.fillText('BİTİŞ', w / 2, 48); }) })]);
    pano.position.y = 5.2; pano.rotation.y = Math.PI / 2; pano.castShadow = true; kemer.add(pano);
    haritaG.add(kemer);
    // Bitiş bayrağı
    const bayrak = new THREE.Mesh(new THREE.PlaneGeometry(2, 1.3, 8, 4), new THREE.MeshStandardMaterial({ map: DOKU.dama, side: THREE.DoubleSide }));
    bayrak.position.set(bt.x + bt.r + 1.5, 4, bt.z); haritaG.add(bayrak); bayrakMesh = bayrak;
    const bdirek = silindir(0.1, 0.1, 5, mat(0xdddddd, { m: 0.6 })); bdirek.position.set(bt.x + bt.r + 0.5, 2.5, bt.z); haritaG.add(bdirek);
    // halının üstünde dev oyuncaklar (süs)
    const suslar = mutfak
      ? [[-20, -28, 'elma'], [25, 26, 'portakal'], [55, -10, 'elma'], [-55, 15, 'portakal']]
      : [[-20, -28, 'top'], [22, 28, 'kup'], [56, -12, 'kup'], [-56, 16, 'top']];
    suslar.forEach(([x, z, t]) => {
      let m;
      if (t === 'top') { m = new THREE.Mesh(new THREE.SphereGeometry(4, 24, 16), mat(0xff5a5a, { p: 0.35 })); m.position.set(x, -6, z); const s = new THREE.Mesh(new THREE.TorusGeometry(4.02, 0.5, 8, 32), mat(0xffffff)); s.rotation.x = 1.2; m.add(s); }
      else if (t === 'kup') { m = kutu(5, 5, 5, mat([0x3a8ad8, 0x4ac06a, 0xf2c12e][Math.abs(x) % 3], { p: 0.5 }), x, -7.5, z); m.rotation.y = 0.5; }
      else { m = new THREE.Mesh(new THREE.SphereGeometry(3.5, 24, 16), mat(t === 'elma' ? 0xd8302a : 0xff9a2a, { p: 0.4 })); m.position.set(x, -6.5, z); }
      m.castShadow = true; haritaG.add(m);
    });
  }
  let bayrakMesh = null;

  // ---------- Parçalar ----------
  function rampaGeo(hu, hv, h1) {
    const g = new THREE.BufferGeometry();
    const p = [-hu, 0, -hv, hu, 0, -hv, hu, h1, -hv, -hu, 0, hv, hu, 0, hv, hu, h1, hv];
    const idx = [0, 2, 1, 3, 4, 5, 0, 3, 5, 0, 5, 2, 1, 2, 5, 1, 5, 4, 0, 1, 4, 0, 4, 3];
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  // p: { tur, x, z, r, id }. hayaletRenk verilirse yarı saydam tek renk
  function parcaYap(p, hayaletRenk) {
    const g = new THREE.Group(); g.position.set(p.x, 0, p.z); g.rotation.y = -p.r;
    const H = hayaletRenk !== undefined ? mat(hayaletRenk, { sf: 0.5, e: hayaletRenk, ei: 0.35 }) : null;
    const M = (renk, o) => H || mat(renk, o);
    let anim = null;
    const S = Dunya.parcaSekli({ ...p, id: p.id || 'h' });
    switch (p.tur) {
      case 'cetvel': g.add(kutu(12, 0.32, 3.6, H || new THREE.MeshStandardMaterial({ map: DOKU.cetvelMavi, roughness: 0.25, transparent: true, opacity: 0.92 }), 0, -0.14, 0)); break;
      case 'kitap': {
        g.add(kutu(7, 0.8, 7, M(0x2a6ad8, { p: 0.5 }), 0, -0.4, 0));
        if (!H) { g.add(kutu(6.6, 0.6, 6.7, mat(0xfaf4e0, { p: 0.9 }), 0.25, -0.4, 0, false)); g.add(kutu(5, 0.02, 0.8, mat(0xffe24a), 0, 0.01, -2, false)); }
        break;
      }
      case 'rampa': {
        const r = new THREE.Mesh(rampaGeo(2.2, 1.6, 1.4), M(0xe8a03a, { p: 0.5 })); r.castShadow = true; r.receiveShadow = true; g.add(r);
        if (!H) { const tut = new THREE.Group(); tut.rotation.z = Math.atan2(1.4, 4.4); tut.position.y = 0.72; const ok = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2), new THREE.MeshStandardMaterial({ map: DOKU.ok })); ok.rotation.set(-Math.PI / 2, 0, Math.PI / 2); ok.position.y = 0.03; tut.add(ok); g.add(tut); }
        break;
      }
      case 'turbo': {
        g.add(kutu(4, 0.3, 2.6, M(0x444450, { p: 0.4 }), 0, -0.14, 0));
        if (!H) { const t = DOKU.ok.clone(); t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 2); const ok = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.2), new THREE.MeshStandardMaterial({ map: t, emissive: 0xff5a1a, emissiveMap: t, emissiveIntensity: 0.9 })); ok.rotation.set(-Math.PI / 2, 0, Math.PI / 2); ok.position.y = 0.03; g.add(ok); anim = (tt) => { t.offset.y = -tt * 2; }; }
        break;
      }
      case 'duvar': {
        const rr = [0xd84a3a, 0x3a7ad8, 0xe8b02a];
        for (let i = 0; i < 3; i++) { const k = kutu(5 - i * 0.15, 0.52, 1 - i * 0.04, M(rr[i], { p: 0.5 }), rnd(-0.1, 0.1), 0.27 + i * 0.53, 0); k.rotation.y = rnd(-0.06, 0.06); g.add(k); if (!H) g.add(kutu(4.7 - i * 0.15, 0.4, 1.02, mat(0xfaf4e0), 0.1, 0.27 + i * 0.53, 0, false)); }
        break;
      }
      case 'pervane': {
        const kalem = silindir(0.35, 0.35, 2.2, M(0xf2c12e, { p: 0.5 }), 6); kalem.position.y = 1.1; g.add(kalem);
        const uc = silindir(0.01, 0.35, 0.6, M(0xf0d0a0), 6); uc.position.y = 2.5; g.add(uc);
        const kol = new THREE.Group(); kol.position.y = 0.55;
        kol.add(kutu(6.2, 0.3, 0.7, H || new THREE.MeshStandardMaterial({ map: DOKU.cetvel, roughness: 0.4 })));
        [-3.1, 3.1].forEach(x => kol.add(kutu(0.25, 0.5, 0.75, M(0xe8413a), x, 0, 0)));
        g.add(kol);
        const m = S.hareketli[0];
        anim = (tt) => { kol.rotation.y = -(Dunya.hareketliDurum(m, tt).aci - p.r); };
        break;
      }
      case 'cekic': {
        [-3.2, 3.2].forEach(v => { const d = silindir(0.22, 0.22, 3.6, M(0x5a8ad8), 8); d.position.set(0, 1.8, v); g.add(d); });
        const ust = silindir(0.18, 0.18, 6.8, M(0x5a8ad8), 8); ust.rotation.x = Math.PI / 2; ust.position.y = 3.5; g.add(ust);
        const sarkac = new THREE.Group(); sarkac.position.y = 3.5; g.add(sarkac);
        const sap = silindir(0.1, 0.1, 2.6, M(0xc89a5a), 6); sap.position.y = -1.3; sarkac.add(sap);
        const bas = silindir(0.7, 0.7, 1.6, M(0xe8413a, { p: 0.35 }), 16); bas.rotation.x = Math.PI / 2; bas.position.y = -2.9; sarkac.add(bas);
        if (!H) [-0.82, 0.82].forEach(z => { const k = silindir(0.72, 0.72, 0.12, mat(0xf2c12e), 16); k.rotation.x = Math.PI / 2; k.position.set(0, -2.9, z); sarkac.add(k); });
        const m = S.hareketli[0];
        anim = (tt) => { const hd = Dunya.hareketliDurum(m, tt); sarkac.rotation.x = -Math.asin(Math.max(-1, Math.min(1, hd.s * 2.8 / 3))); };
        break;
      }
      case 'blok': {
        const silg = new THREE.Group();
        silg.add(kutu(1.9, 1.1, 1.9, M(0xff8ab0, { p: 0.85 }), 0, 0.55, 0));
        if (!H) silg.add(kutu(1.92, 0.4, 1.92, mat(0x4a8ad8, { p: 0.7 }), 0, 0.85, 0));
        g.add(silg);
        if (!H) { const ray = kutu(8, 0.05, 0.4, mat(0x888899, { m: 0.5 }), 0, 0.02, 0, false); g.add(ray); }
        const m = S.hareketli[0];
        anim = (tt) => { silg.position.x = Math.sin(tt * 1.3 + m.faz) * 3; };
        break;
      }
      case 'yag': case 'bal': {
        const yag = p.tur === 'yag';
        const sekil = new THREE.Shape(); const n = 14;
        for (let i = 0; i <= n; i++) { const a = i / n * 6.283, r = 2.2 * (0.85 + 0.18 * Math.sin(a * 3 + Dunya.karma(p.id || 'x') * 6)); if (i) sekil.lineTo(Math.cos(a) * r, Math.sin(a) * r); else sekil.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
        const lek = new THREE.Mesh(new THREE.ShapeGeometry(sekil), H || mat(yag ? 0x15151c : 0xe8a01a, { p: yag ? 0.05 : 0.2, m: yag ? 0.7 : 0.1, e: yag ? 0x2a1a4a : 0x5a3000, ei: 0.5 }));
        lek.rotation.x = -Math.PI / 2; lek.position.y = 0.03; lek.receiveShadow = true; g.add(lek);
        if (!H) for (let i = 0; i < 5; i++) { const k = new THREE.Mesh(new THREE.SphereGeometry(rnd(0.15, 0.35), 10, 8), mat(yag ? 0x6a5aaa : 0xffd060, { p: 0.1, m: 0.3 })); k.position.set(rnd(-1.3, 1.3), 0.05, rnd(-1.3, 1.3)); k.scale.y = 0.5; g.add(k); }
        if (!H && !yag) { const kav = silindir(0.6, 0.5, 1.1, mat(0xffe0a0, { p: 0.15, sf: 0.75 }), 14); kav.position.set(1.4, 0.3, -1); kav.rotation.z = 1.4; g.add(kav); }
        break;
      }
      case 'mayin': {
        const fis = silindir(0.38, 0.38, 0.9, M(0xd8202a, { p: 0.45 }), 14); fis.position.y = 0.45; g.add(fis);
        const bant = silindir(0.39, 0.39, 0.18, M(0xffe24a), 14); bant.position.y = 0.45; g.add(bant);
        const fitil = silindir(0.04, 0.04, 0.5, M(0x333333), 6); fitil.position.y = 1.1; fitil.rotation.z = 0.4; g.add(fitil);
        const kivilcim = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd040 })); kivilcim.position.set(-0.12, 1.35, 0); g.add(kivilcim);
        g.userData.mayin = { fis, kivilcim };
        anim = (tt) => { kivilcim.scale.setScalar(0.7 + Math.abs(Math.sin(tt * 9)) * 0.8); };
        break;
      }
      case 'yay': {
        g.add(silindir(1.1, 1.2, 0.2, M(0x6a6a78, { m: 0.6, p: 0.3 }), 20)).position.y = 0.1;
        const pts = []; for (let i = 0; i <= 80; i++) { const a = i / 80 * Math.PI * 10; pts.push(new THREE.Vector3(Math.cos(a) * 0.75, 0.2 + i / 80 * 0.9, Math.sin(a) * 0.75)); }
        const yay = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.09, 6), M(0xc8ccd8, { m: 0.9, p: 0.25 })); yay.castShadow = true; g.add(yay);
        const ust = silindir(1.05, 1.05, 0.18, M(0x34d45a, { p: 0.4 }), 20); ust.position.y = 1.15; g.add(ust);
        g.userData.yay = { yay, ust };
        break;
      }
      case 'portal': {
        [[-5, 0x3ab0ff, DOKU.girdapMavi], [5, 0xff8a2a, DOKU.girdapTuruncu]].forEach(([u, renk, doku], j) => {
          const halka = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.22, 10, 32), M(renk, { e: renk, ei: 0.8, p: 0.3 }));
          halka.rotation.x = Math.PI / 2; halka.position.set(u, 0.22, 0); g.add(halka);
          if (!H) { const disk = new THREE.Mesh(new THREE.CircleGeometry(1.3, 32), new THREE.MeshBasicMaterial({ map: doku, transparent: true, depthWrite: false })); disk.rotation.x = -Math.PI / 2; disk.position.set(u, 0.06, 0); g.add(disk); (g.userData.diskler ||= []).push(disk); }
          if (j === 1) { const ok = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1, 3), M(renk, { e: renk, ei: 0.5 })); ok.rotation.z = -Math.PI / 2; ok.position.set(u + 2, 0.3, 0); g.add(ok); }
        });
        if (H) { const cizgi = kutu(10, 0.05, 0.1, H, 0, 0.05, 0, false); g.add(cizgi); }
        anim = (tt) => (g.userData.diskler || []).forEach((d, i) => { d.rotation.z = tt * (i ? -3 : 3); });
        break;
      }
      case 'korkuluk': {
        for (let i = -3; i <= 3; i += 1.5) { const d = silindir(0.12, 0.12, 0.8, M(0xffffff), 6); d.position.set(i, 0.4, 0); g.add(d); }
        const ray = kutu(6.2, 0.28, 0.2, H || new THREE.MeshStandardMaterial({ map: tuval(128, 16, (c, w, h) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#fff' : '#e8202a'; c.fillRect(i * 16, 0, 16, h); } }) }), 0, 0.62, 0);
        g.add(ray);
        break;
      }
    }
    g.traverse(o => { if (o.isMesh && hayaletRenk !== undefined) { o.castShadow = false; o.receiveShadow = false; } });
    return { g, anim, p };
  }
  function parcaEkle(p, dusur = true) {
    parcaSil(p.id, false);
    const o = parcaYap(p);
    scene.add(o.g); parcaG.set(p.id, o);
    if (dusur) {   // yukarıdan düşüp zıplayarak yerine otursun
      const g = o.g, bas = zaman;
      animasyonlar.push({ son: bas + 0.55, f: k => { const e = 1 - Math.pow(1 - k, 3); g.position.y = (1 - e) * 8 + Math.sin(k * Math.PI) * 0.4 * (1 - k); g.scale.setScalar(0.7 + 0.3 * e); }, bitis: () => { g.position.y = 0; g.scale.setScalar(1); toz(p.x, 0.1, p.z, 22, 0xe8d8b0, 2.2); } });
    }
  }
  function parcaSil(id, efekt = true) {
    const o = parcaG.get(id); if (!o) return;
    parcaG.delete(id);
    if (efekt) {
      const g = o.g, bas = zaman;
      poof(o.p.x, 0.5, o.p.z);
      animasyonlar.push({ son: bas + 0.35, f: k => { g.scale.setScalar(1 - k); g.position.y = k * 2; }, bitis: () => scene.remove(g) });
    } else scene.remove(o.g);
  }
  function parcalariTemizle() { [...parcaG.keys()].forEach(id => parcaSil(id, false)); }
  // Mayın kapalıyken soluk görünsün
  function mayinDurum(id, kapali) {
    const o = parcaG.get(id); if (!o?.g.userData.mayin) return;
    const { fis, kivilcim } = o.g.userData.mayin;
    fis.visible = !kapali; kivilcim.visible = !kapali;
    o.g.children.forEach(c => { c.visible = !kapali; });
  }
  function yayBas(x, z) {   // en yakın yayı ezip bırak
    let en = null, ed = 3;
    parcaG.forEach(o => { if (o.g.userData.yay) { const d = Math.hypot(o.p.x - x, o.p.z - z); if (d < ed) { ed = d; en = o; } } });
    if (!en) return;
    const { yay, ust } = en.g.userData.yay, bas = zaman;
    animasyonlar.push({ son: bas + 0.5, f: k => { const s = 1 + Math.sin(k * Math.PI * 3) * (1 - k) * 0.7; yay.scale.y = s; ust.position.y = 0.2 + 0.95 * s; } });
  }

  // ---------- Hayalet (yerleştirme önizlemesi) ----------
  function hayaletAyarla(tur, x, z, r, gecerli, renk) {
    if (!tur) { if (hayalet) { scene.remove(hayalet.g); hayalet = null; hayaletTur = null; } return; }
    const k = tur + (gecerli ? 'e' : 'h');
    if (!hayalet || hayaletTur !== k) {
      if (hayalet) scene.remove(hayalet.g);
      const r0 = gecerli ? 0x5aff7a : 0xff4a4a;
      if (tur === 'silgi' || tur === 'bomba') {
        const g = new THREE.Group();
        const R = tur === 'silgi' ? Dunya.SILGI_R : Dunya.BOMBA_R;
        const halka = new THREE.Mesh(new THREE.RingGeometry(R - 0.25, R, 48), new THREE.MeshBasicMaterial({ color: r0, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
        halka.rotation.x = -Math.PI / 2; halka.position.y = 0.15; g.add(halka);
        const ic = new THREE.Mesh(new THREE.CircleGeometry(R - 0.25, 48), new THREE.MeshBasicMaterial({ color: r0, transparent: true, opacity: 0.18, depthWrite: false }));
        ic.rotation.x = -Math.PI / 2; ic.position.y = 0.14; g.add(ic);
        const ikon = etiketYap(tur === 'silgi' ? '🩹' : '💣', '#0000', 64); ikon.position.y = 2.5; ikon.scale.multiplyScalar(0.8); g.add(ikon);
        hayalet = { g }; g.userData.halka = halka;
      } else hayalet = parcaYap({ tur, x: 0, z: 0, r: 0, id: 'hayalet' }, r0);
      hayaletTur = k; scene.add(hayalet.g);
    }
    hayalet.g.position.set(x, 0.05, z); hayalet.g.rotation.y = -r;
    if (hayalet.anim) hayalet.anim(zaman);
    // silinecekleri parlat
    parcaG.forEach(o => o.g.traverse(m => { if (m.isMesh && m.material?.emissive && m.userData.parlak) { m.material = m.userData.asil; m.userData.parlak = false; } }));
  }
  function vurgula(ids) {   // silgi/bomba hedeflerini kırmızı yanıp söndür
    const isik = 0.5 + Math.sin(zaman * 10) * 0.5;
    ids.forEach(id => { const o = parcaG.get(id); if (!o) return; o.g.traverse(m => { if (m.isMesh && m.material?.emissive) { if (!m.userData.parlak) { m.userData.asil = m.material; m.material = m.material.clone(); m.userData.parlak = true; } m.material.emissive.setHex(0xff2020); m.material.emissiveIntensity = isik; } }); });
  }
  // Başka oyuncuların imleçleri
  function imlecAyarla(no, tur, x, z, r) {
    let o = imlecler.get(no);
    if (!tur) { if (o) { scene.remove(o.g); imlecler.delete(no); } return; }
    if (!o || o.tur !== tur) {
      if (o) scene.remove(o.g);
      const renk = RENKLER[no % RENKLER.length];
      const g = new THREE.Group();
      const ic = (tur === 'silgi' || tur === 'bomba') ? null : parcaYap({ tur, x: 0, z: 0, r: 0, id: 'im' + no }, renk);
      if (ic) { ic.g.position.set(0, 0, 0); g.add(ic.g); }
      const ok = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.4, 12), new THREE.MeshBasicMaterial({ color: renk })); ok.rotation.x = Math.PI; ok.position.y = 4; g.add(ok);
      const halka = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.6, 32), new THREE.MeshBasicMaterial({ color: renk, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false })); halka.rotation.x = -Math.PI / 2; halka.position.y = 0.2; g.add(halka);
      o = { g, tur, ic, ok, hx: x, hz: z, hr: r, x, z, r }; scene.add(g); imlecler.set(no, o);
    }
    o.hx = x; o.hz = z; o.hr = r;
  }
  function imlecleriTemizle() { imlecler.forEach(o => scene.remove(o.g)); imlecler.clear(); }

  // ---------- Arabalar ----------
  function arabaYap(renkNo) {
    const renk = RENKLER[renkNo % RENKLER.length];
    const g = new THREE.Group(), govde = new THREE.Group(); g.add(govde);
    const boya = mat(renk, { p: 0.3, m: 0.25 });
    govde.add(kutu(2.1, 0.5, 1.25, boya, 0, 0.5, 0));
    govde.add(kutu(0.6, 0.18, 1.1, boya, 0.75, 0.82, 0));
    const kabin = kutu(1.0, 0.48, 1.05, mat(0x222a3a, { p: 0.1, m: 0.5 }), -0.15, 0.98, 0); govde.add(kabin);
    govde.add(kutu(0.9, 0.08, 1.1, boya, -0.15, 1.24, 0));
    // spoiler
    govde.add(kutu(0.12, 0.35, 0.12, mat(0x222222), -0.95, 0.9, -0.45)); govde.add(kutu(0.12, 0.35, 0.12, mat(0x222222), -0.95, 0.9, 0.45));
    govde.add(kutu(0.45, 0.08, 1.35, boya, -1.0, 1.1, 0));
    // farlar
    [-0.38, 0.38].forEach(z => govde.add(kutu(0.06, 0.16, 0.26, mat(0xfff6c0, { e: 0xfff0a0, ei: 1.2 }), 1.06, 0.55, z, false)));
    [-0.4, 0.4].forEach(z => govde.add(kutu(0.06, 0.14, 0.24, mat(0xff2020, { e: 0xff0000, ei: 0.8 }), -1.06, 0.6, z, false)));
    // numara şeridi
    govde.add(kutu(1.4, 0.02, 0.28, mat(0xffffff), 0.1, 0.76, 0, false));
    const tekerler = [];
    [[0.7, 0.62], [0.7, -0.62], [-0.7, 0.62], [-0.7, -0.62]].forEach(([x, z]) => {
      const t = new THREE.Group(); t.position.set(x, 0.34, z);
      const lastik = silindir(0.34, 0.34, 0.28, mat(0x1a1a1a, { p: 0.8 }), 14); lastik.rotation.x = Math.PI / 2; t.add(lastik);
      const jant = silindir(0.18, 0.18, 0.3, mat(0xe0e0e8, { m: 0.8, p: 0.3 }), 8); jant.rotation.x = Math.PI / 2; t.add(jant);
      govde.add(t); tekerler.push(t);
    });
    // kalkan baloncuğu ve turbo alevi
    const kalkan = new THREE.Mesh(new THREE.SphereGeometry(1.6, 20, 14), new THREE.MeshBasicMaterial({ color: 0x6ad8ff, transparent: true, opacity: 0.22, depthWrite: false }));
    kalkan.position.y = 0.7; kalkan.visible = false; g.add(kalkan);
    const alev = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.3, 10), new THREE.MeshBasicMaterial({ color: 0xffa030, transparent: true, opacity: 0.9 }));
    alev.rotation.z = Math.PI / 2; alev.position.set(-1.65, 0.6, 0); alev.visible = false; govde.add(alev);
    // gölge diski (havadayken yerde)
    const golge = new THREE.Mesh(new THREE.CircleGeometry(1.1, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
    golge.rotation.x = -Math.PI / 2; golge.visible = false; scene.add(golge);
    return { g, govde, tekerler, kalkan, alev, golge, donus: 0, tozT: 0, renk };
  }
  function arabaGuncelle(A, s, dt) {
    // s: { x, y, z, a, spin, havada, dus, bitti, turbo, kayiyor, kalkan, hiz }
    A.g.position.set(s.x, s.y, s.z);
    A.g.rotation.y = -s.a;
    A.govde.rotation.x = s.spin || 0;
    A.govde.rotation.z = s.havada ? Math.max(-0.4, Math.min(0.4, (s.vy || 0) * 0.04)) : 0;
    A.donus += (s.hiz || 0) * dt / 0.34;
    A.tekerler.forEach(t => { t.rotation.z = -A.donus; });
    A.kalkan.visible = !!s.kalkan; if (s.kalkan) A.kalkan.material.opacity = 0.18 + Math.sin(zaman * 6) * 0.06;
    A.alev.visible = !!s.turbo; if (s.turbo) { A.alev.scale.set(1, 0.8 + Math.random() * 0.6, 1); alevEfekt(s, A); }
    // havadayken ve düşerken altta gölge
    const zm = Dunya.zemin(sonDunya || { yuzey: [] }, s.x, s.z, s.y + 0.5);
    A.golge.visible = !!zm && s.y > 0.4; if (zm) { A.golge.position.set(s.x, zm.h + 0.04, s.z); A.golge.scale.setScalar(Math.max(0.4, 1 - (s.y - zm.h) * 0.08)); }
    // efektler: kayarken lastik dumanı, bal içinde damla
    A.tozT -= dt;
    if (A.tozT <= 0 && !s.havada && !s.dus && (s.hiz || 0) > 3) {
      A.tozT = 0.04;
      const geriX = s.x - Math.cos(s.a) * 0.9, geriZ = s.z - Math.sin(s.a) * 0.9;
      if (s.kayiyor) for (let i = 0; i < 2; i++) parcacik(0, { x: geriX + rnd(-0.5, 0.5), y: s.y + 0.2, z: geriZ + rnd(-0.5, 0.5), vx: rnd(-0.5, 0.5), vy: rnd(0.5, 1.5), vz: rnd(-0.5, 0.5), renk: 0xd8d8e0, boy: rnd(0.8, 1.4), omur: rnd(0.5, 0.9), buyu: 1.8 });
      else if (s.bal) parcacik(0, { x: geriX, y: s.y + 0.15, z: geriZ, vx: 0, vy: 1.5, vz: 0, renk: 0xffb020, boy: 0.35, omur: 0.5, yer: 8 });
      else if (Math.random() < 0.25) parcacik(0, { x: geriX, y: s.y + 0.1, z: geriZ, vx: rnd(-0.3, 0.3), vy: rnd(0.2, 0.6), vz: rnd(-0.3, 0.3), renk: 0xe8dcc8, boy: 0.5, omur: 0.4, buyu: 1.2 });
    }
  }
  function arabaSil(A) { scene.remove(A.g); scene.remove(A.golge); }
  function alevEfekt(s, A) {
    const gx = s.x - Math.cos(s.a) * 1.6, gz = s.z - Math.sin(s.a) * 1.6;
    parcacik(1, { x: gx, y: s.y + 0.6, z: gz, vx: -Math.cos(s.a) * 4 + rnd(-1, 1), vy: rnd(0, 1), vz: -Math.sin(s.a) * 4 + rnd(-1, 1), renk: Math.random() < 0.5 ? 0xff7a1a : 0xffd04a, boy: rnd(0.5, 0.9), omur: 0.25, buyu: -1 });
  }
  let sonDunya = null;
  function dunyaAyarla(d) { sonDunya = d; }

  // İsim etiketi
  function etiketYap(yazi, renk, boy = 40) {
    const c = document.createElement('canvas'), g = c.getContext('2d');
    g.font = `900 ${boy}px Nunito, sans-serif`;
    const w = Math.ceil(g.measureText(yazi).width) + boy; c.width = w; c.height = boy * 1.6;
    g.font = `900 ${boy}px Nunito, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (renk !== '#0000') { g.fillStyle = '#000a'; const r = boy * 0.5; g.beginPath(); g.roundRect(2, 2, w - 4, c.height - 4, r); g.fill(); g.strokeStyle = renk; g.lineWidth = 5; g.stroke(); }
    g.fillStyle = '#fff'; g.fillText(yazi, w / 2, c.height / 2 + 2);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
    const k = 0.017 * boy / 40; sp.scale.set(w * k, c.height * k, 1); sp.renderOrder = 10;
    return sp;
  }

  // ---------- Parçacıklar ----------
  const PN = 2200;
  const sistemler = [];
  function parcacikKur() {
    [THREE.NormalBlending, THREE.AdditiveBlending].forEach(karisim => {
      const geo = new THREE.BufferGeometry();
      const poz = new Float32Array(PN * 3), renk = new Float32Array(PN * 3), boy = new Float32Array(PN), alfa = new Float32Array(PN);
      geo.setAttribute('position', new THREE.BufferAttribute(poz, 3));
      geo.setAttribute('renk', new THREE.BufferAttribute(renk, 3));
      geo.setAttribute('boy', new THREE.BufferAttribute(boy, 1));
      geo.setAttribute('alfa', new THREE.BufferAttribute(alfa, 1));
      const m = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: karisim,
        uniforms: { olcek: { value: innerHeight } },
        vertexShader: `attribute vec3 renk; attribute float boy; attribute float alfa; varying vec3 vR; varying float vA;
          uniform float olcek;
          void main(){ vR = renk; vA = alfa; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = boy * olcek * 0.9 / -mv.z; gl_Position = projectionMatrix * mv; }`,
        fragmentShader: `varying vec3 vR; varying float vA;
          void main(){ vec2 p = gl_PointCoord - 0.5; float d = length(p); if (d > 0.5) discard; float a = smoothstep(0.5, 0.15, d) * vA; gl_FragColor = vec4(vR, a); }`,
      });
      const pts = new THREE.Points(geo, m); pts.frustumCulled = false; scene.add(pts);
      sistemler.push({ geo, poz, renk, boy, alfa, m, v: new Float32Array(PN * 3), omur: new Float32Array(PN), azami: new Float32Array(PN), b0: new Float32Array(PN), buyu: new Float32Array(PN), yer: new Float32Array(PN), sira: 0 });
    });
  }
  const tmpR = new THREE.Color();
  function parcacik(si, o) {
    const S = sistemler[si]; const i = S.sira; S.sira = (S.sira + 1) % PN;
    S.poz[i * 3] = o.x; S.poz[i * 3 + 1] = o.y; S.poz[i * 3 + 2] = o.z;
    S.v[i * 3] = o.vx || 0; S.v[i * 3 + 1] = o.vy || 0; S.v[i * 3 + 2] = o.vz || 0;
    tmpR.setHex(o.renk); S.renk[i * 3] = tmpR.r; S.renk[i * 3 + 1] = tmpR.g; S.renk[i * 3 + 2] = tmpR.b;
    S.omur[i] = S.azami[i] = o.omur || 1; S.b0[i] = o.boy || 0.5; S.buyu[i] = o.buyu || 0; S.yer[i] = o.yer ?? 0;
  }
  function parcacikGuncelle(dt) {
    sistemler.forEach(S => {
      S.m.uniforms.olcek.value = innerHeight;
      for (let i = 0; i < PN; i++) {
        if (S.omur[i] <= 0) { S.alfa[i] = 0; continue; }
        S.omur[i] -= dt;
        const k = 1 - S.omur[i] / S.azami[i];
        S.v[i * 3 + 1] -= S.yer[i] * dt;
        const s = Math.exp(-1.6 * dt); S.v[i * 3] *= s; S.v[i * 3 + 2] *= s; if (!S.yer[i]) S.v[i * 3 + 1] *= s;
        S.poz[i * 3] += S.v[i * 3] * dt; S.poz[i * 3 + 1] += S.v[i * 3 + 1] * dt; S.poz[i * 3 + 2] += S.v[i * 3 + 2] * dt;
        S.boy[i] = Math.max(0.01, S.b0[i] * (1 + S.buyu[i] * k));
        S.alfa[i] = Math.min(1, (1 - k) * 1.6);
      }
      S.geo.attributes.position.needsUpdate = true; S.geo.attributes.renk.needsUpdate = true; S.geo.attributes.boy.needsUpdate = true; S.geo.attributes.alfa.needsUpdate = true;
    });
  }
  // ---------- Hazır efektler ----------
  function toz(x, y, z, n = 10, renk = 0xe8dcc8, yay = 1.5) {
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.283; parcacik(0, { x: x + Math.cos(a) * yay * 0.5, y, z: z + Math.sin(a) * yay * 0.5, vx: Math.cos(a) * rnd(2, 5), vy: rnd(0.3, 1.5), vz: Math.sin(a) * rnd(2, 5), renk, boy: rnd(0.7, 1.3), omur: rnd(0.4, 0.8), buyu: 1.5 }); }
  }
  function kivilcim(x, y, z, n = 14) {
    for (let i = 0; i < n; i++) parcacik(1, { x, y, z, vx: rnd(-7, 7), vy: rnd(2, 7), vz: rnd(-7, 7), renk: Math.random() < 0.5 ? 0xffe060 : 0xff9a30, boy: rnd(0.18, 0.35), omur: rnd(0.25, 0.5), yer: 18 });
  }
  function poof(x, y, z) {
    for (let i = 0; i < 26; i++) { const a = Math.random() * 6.283, h = rnd(0, 1); parcacik(0, { x, y: y + h, z, vx: Math.cos(a) * rnd(2, 6), vy: rnd(1, 4), vz: Math.sin(a) * rnd(2, 6), renk: [0xffffff, 0xffd0e8, 0xd0e8ff][i % 3], boy: rnd(0.9, 1.6), omur: rnd(0.5, 0.9), buyu: 1.4 }); }
    for (let i = 0; i < 12; i++) parcacik(1, { x, y: y + 0.5, z, vx: rnd(-5, 5), vy: rnd(2, 6), vz: rnd(-5, 5), renk: 0xfff080, boy: 0.3, omur: 0.6, yer: 6 });
  }
  function patlama(x, y, z, buyuk = false) {
    const k = buyuk ? 1.8 : 1;
    for (let i = 0; i < 40 * k; i++) { const a = Math.random() * 6.283, h = rnd(0.2, 1); parcacik(1, { x, y: y + 0.5, z, vx: Math.cos(a) * rnd(3, 11) * k * h, vy: rnd(2, 10) * k, vz: Math.sin(a) * rnd(3, 11) * k * h, renk: [0xffd040, 0xff8a20, 0xff4a10, 0xfff0a0][i % 4], boy: rnd(0.8, 1.8) * k, omur: rnd(0.3, 0.7), buyu: -0.5, yer: 4 }); }
    for (let i = 0; i < 30 * k; i++) { const a = Math.random() * 6.283; parcacik(0, { x: x + rnd(-1, 1), y: y + rnd(0.5, 2), z: z + rnd(-1, 1), vx: Math.cos(a) * rnd(1, 4) * k, vy: rnd(1, 5), vz: Math.sin(a) * rnd(1, 4) * k, renk: [0x4a4a50, 0x6a6a70, 0x2a2a30][i % 3], boy: rnd(1.5, 2.8) * k, omur: rnd(0.9, 1.6), buyu: 1.5 }); }
    kivilcim(x, y + 0.5, z, 30 * k);
    // şok dalgası
    const halka = new THREE.Mesh(new THREE.RingGeometry(0.6, 1, 40), new THREE.MeshBasicMaterial({ color: 0xffe0a0, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    halka.rotation.x = -Math.PI / 2; halka.position.set(x, y + 0.2, z); scene.add(halka);
    const isik = new THREE.PointLight(0xffa040, 60 * k, 18 * k, 2); isik.position.set(x, y + 2, z); scene.add(isik);
    const bas = zaman;
    animasyonlar.push({ son: bas + 0.6, f: t => { halka.scale.setScalar(1 + t * 9 * k); halka.material.opacity = 0.9 * (1 - t); isik.intensity = 60 * k * (1 - t); }, bitis: () => { scene.remove(halka); scene.remove(isik); } });
    sarsinti(buyuk ? 1.2 : 0.7, x, z);
  }
  function konfeti(x, y, z) {
    const renk = [0xff4a6a, 0x4ad0ff, 0xffe04a, 0x6aff7a, 0xc86aff, 0xff9a3a];
    for (let i = 0; i < 90; i++) parcacik(1, { x, y: y + 1, z, vx: rnd(-6, 6), vy: rnd(6, 14), vz: rnd(-6, 6), renk: renk[i % 6], boy: rnd(0.3, 0.55), omur: rnd(1.2, 2.2), yer: 9 });
  }
  function halkaEfekt(x, y, z, renk, buyu = 4) {
    const halka = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.1, 32), new THREE.MeshBasicMaterial({ color: renk, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    halka.rotation.x = -Math.PI / 2; halka.position.set(x, y, z); scene.add(halka);
    const bas = zaman;
    animasyonlar.push({ son: bas + 0.5, f: t => { halka.scale.setScalar(1 + t * buyu); halka.material.opacity = 0.9 * (1 - t); }, bitis: () => scene.remove(halka) });
  }
  function portalEfekt(x, z, bx, bz) {
    for (const [px, pz, r] of [[x, z, 0x3ab0ff], [bx, bz, 0xff8a2a]]) { halkaEfekt(px, 0.3, pz, r, 3); for (let i = 0; i < 20; i++) parcacik(1, { x: px + rnd(-1, 1), y: rnd(0.2, 1.5), z: pz + rnd(-1, 1), vx: 0, vy: rnd(2, 6), vz: 0, renk: r, boy: 0.4, omur: 0.6 }); }
  }
  function sarsinti(g, x, z) {
    if (x !== undefined && kam.hedef) { const d = Math.hypot(x - kam.hx, z - kam.hz); g *= Math.max(0.15, 1 - d / 40); }
    kam.sars = Math.max(kam.sars, g);
  }

  // ---------- Kamera ----------
  function kameraGenel(sinir) { kam.mod = 'genel'; kam.sinir = sinir; }
  function kameraTakip(hedef) { kam.mod = 'takip'; kam.hedef = hedef; }
  function kameraGuncelle(dt) {
    let hx, hy, hz, cx, cy, cz;
    if (kam.mod === 'takip' && kam.hedef) {
      const h = kam.hedef;
      const ilerle = 0.35;
      hx = h.x + (h.vx || 0) * ilerle; hz = h.z + (h.vz || 0) * ilerle; hy = Math.max(-4, h.y * 0.5);
      const uzak = innerWidth < innerHeight ? 42 : 36;
      cx = hx; cy = hy + uzak * 0.86; cz = hz + uzak * 0.5;
    } else {
      const s = kam.sinir || { x0: -44, x1: 44, z0: -21, z1: 21 };
      const gx = (s.x1 - s.x0) / 2 + 3, gz = (s.z1 - s.z0) / 2 + 3;
      const yarimDikey = Math.tan(camera.fov * Math.PI / 360), yarimYatay = yarimDikey * camera.aspect;
      const uzak = Math.max(gx / yarimYatay, gz * 1.5 / yarimDikey) * 1.12;
      hx = (s.x0 + s.x1) / 2; hy = 0; hz = (s.z0 + s.z1) / 2 + 1.5;
      cx = hx; cy = uzak * 0.86; cz = hz + uzak * 0.5;
    }
    if (Math.abs(camera.aspect - innerWidth / Math.max(1, innerHeight)) > 0.01 && innerHeight > 0) boyutla();
    if (![kam.x, kam.y, kam.z, kam.hx, kam.hy, kam.hz].every(Number.isFinite)) Object.assign(kam, { x: cx, y: cy, z: cz, hx, hy, hz });
    const k = 1 - Math.exp(-dt * (kam.mod === 'takip' ? 6 : 3));
    kam.x += (cx - kam.x) * k; kam.y += (cy - kam.y) * k; kam.z += (cz - kam.z) * k;
    kam.hx += (hx - kam.hx) * k; kam.hy += (hy - kam.hy) * k; kam.hz += (hz - kam.hz) * k;
    const s = kam.sars; kam.sars = Math.max(0, kam.sars - dt * 2.2);
    camera.position.set(kam.x + rnd(-1, 1) * s, kam.y + rnd(-1, 1) * s, kam.z + rnd(-1, 1) * s);
    camera.lookAt(kam.hx, kam.hy, kam.hz);
    // gölge kamerası hedefi takip etsin
    gunes.position.set(kam.hx + 30, 60, kam.hz + 25); gunes.target.position.set(kam.hx, 0, kam.hz); gunes.target.updateMatrixWorld();
  }
  // Ekrandaki noktayı masa düzlemine (y=0) çevir
  const isin = new THREE.Raycaster(), duzlem = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), nokta = new THREE.Vector3();
  function ekrandanMasaya(px, py) {
    isin.setFromCamera({ x: px / innerWidth * 2 - 1, y: -(py / innerHeight) * 2 + 1 }, camera);
    return isin.ray.intersectPlane(duzlem, nokta) ? { x: nokta.x, z: nokta.z } : null;
  }

  // ---------- Kare ----------
  function ciz(dt, oyunT) {
    zaman += dt;
    for (let i = animasyonlar.length - 1; i >= 0; i--) {
      const a = animasyonlar[i], bas = a.son - (a.sure || 0);
      a.bas ??= zaman - dt;
      const k = Math.min(1, (zaman - a.bas) / (a.son - a.bas));
      a.f(k);
      if (k >= 1) { animasyonlar.splice(i, 1); a.bitis && a.bitis(); }
    }
    parcaG.forEach(o => o.anim && o.anim(oyunT));
    imlecler.forEach(o => { const k = 1 - Math.exp(-dt * 12); o.x += (o.hx - o.x) * k; o.z += (o.hz - o.z) * k; o.g.position.set(o.x, 0.08, o.z); if (o.ic) o.ic.g.rotation.y = -o.hr; o.ok.position.y = 3.6 + Math.sin(zaman * 4) * 0.4; });
    if (bayrakMesh) { const p = bayrakMesh.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i) + 1; p.setZ(i, Math.sin(x * 3 - zaman * 6) * 0.15 * x); } p.needsUpdate = true; }
    parcacikGuncelle(dt);
    kameraGuncelle(dt);
    renderer.render(scene, camera);
  }

  return {
    RENKLER, RENK_AD, kur, haritaKur, parcaEkle, parcaSil, parcalariTemizle, mayinDurum, yayBas, hayaletAyarla, vurgula, imlecAyarla, imlecleriTemizle,
    arabaYap, arabaGuncelle, arabaSil, etiketYap, dunyaAyarla, toz, kivilcim, poof, patlama, konfeti, halkaEfekt, portalEfekt, sarsinti, parcacik,
    kameraGenel, kameraTakip, ekrandanMasaya, ciz, get scene() { return scene; }, get camera() { return camera; },
  };
})();
