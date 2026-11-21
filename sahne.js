// =============================================================
// Oyuncak Rallisi - 3D görüntü (Three.js). Gökyüzü, vadi/kanyon, asfalt pist ve direkleri,
// tuzaklar, arabalar, efektler, takip kamerası. Kurallar ve fizik burada değil (dunya.js).
// Yön: dünya açısı a için mesh.rotation.y = -a (model +x'e bakar).
// =============================================================

const Sahne = (() => {
  const RENKLER = [0xe8413a, 0x2f7de1, 0xf2c12e, 0x34b45a, 0x9a4ae0, 0xff8a1e];
  const RENK_AD = ['Kırmızı', 'Mavi', 'Sarı', 'Yeşil', 'Mor', 'Turuncu'];
  let renderer, scene, camera, gunes, hemi;
  const kam = { gYaw: Math.PI / 2, gPitch: 0.9, x: 0, y: 40, z: 40, hx: 0, hy: 0, hz: 0, sars: 0, mod: 'genel', hedef: null, yaw: 0, odak: { x: 30, y: 0, z: 0 }, uzak: 80, kayX: 0, kayZ: 0, yakin: 1 };
  const parcaG = new Map();
  let ortamG = null, yolG = null, hayalet = null, hayaletTur = null;
  let yolMeshler = [];
  const imlecler = new Map();
  const animasyonlar = [];
  let zaman = 0, sonDunya = null, bayrakMesh = null;
  const ZY = () => Dunya.ZEMIN_Y;

  // ---------- Yardımcılar ----------
  const matOnbellek = new Map();
  function mat(renk, o = {}) {
    const k = renk + JSON.stringify(o, (k2, v) => (v && v.isTexture ? v.uuid : v));
    if (!matOnbellek.has(k)) matOnbellek.set(k, new THREE.MeshStandardMaterial({ color: renk, roughness: o.p ?? 0.6, metalness: o.m ?? 0, emissive: o.e ?? 0, emissiveIntensity: o.ei ?? 1, transparent: !!o.sf, opacity: o.sf ?? 1, map: o.map || null, side: o.cift ? THREE.DoubleSide : THREE.FrontSide }));
    return matOnbellek.get(k);
  }
  function kutu(w, h, d, m, x = 0, y = 0, z = 0, golge = true) {
    const ms = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    ms.position.set(x, y, z); ms.castShadow = golge; ms.receiveShadow = true; return ms;
  }
  function silindir(rt, rb, h, m, n = 16) { const ms = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, n), m); ms.castShadow = true; ms.receiveShadow = true; return ms; }
  function tuval(w, h, ciz) { const c = document.createElement('canvas'); c.width = w; c.height = h; ciz(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
  const rnd = (a, b) => a + Math.random() * (b - a);
  let tohum = 1; const srnd = (a, b) => { tohum = (tohum * 16807) % 2147483647; return a + (tohum / 2147483647) * (b - a); };

  // ---------- Dokular ----------
  let DOKU = null;
  function dokulariYap() {
    const gurultu = (g, w, h, renkler, n) => { for (let i = 0; i < n; i++) { g.fillStyle = renkler[i % renkler.length]; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } };
    DOKU = {
      asfalt: tuval(256, 512, (g, w, h) => {
        g.fillStyle = '#3c3e44'; g.fillRect(0, 0, w, h);
        gurultu(g, w, h, ['#2e3036', '#4a4c52', '#35373c', '#55575d'], 9000);
        g.fillStyle = '#f2f2ee'; g.fillRect(8, 0, 9, h); g.fillRect(w - 17, 0, 9, h);
        g.fillStyle = '#f2c12e'; for (let y = 0; y < h; y += 128) g.fillRect(w / 2 - 4, y + 20, 8, 70);
      }),
      bordur: tuval(32, 128, (g, w, h) => { for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#f4f4f4' : '#d8202a'; g.fillRect(0, i * 32, w, 32); } }),
      rampa: tuval(256, 256, (g, w, h) => {
        g.fillStyle = '#f2c12e'; g.fillRect(0, 0, w, h);
        g.fillStyle = '#1a1a1a'; for (let i = -4; i < 8; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64 + 32, 0); g.lineTo(i * 64 + 32 + 256, h); g.lineTo(i * 64 + 256, h); g.fill(); }
      }),
      dama: tuval(128, 128, (g) => { for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { g.fillStyle = (i + j) % 2 ? '#111' : '#fafafa'; g.fillRect(i * 16, j * 16, 16, 16); } }),
      ok: tuval(128, 128, (g, w, h) => { g.fillStyle = '#ff5a1a'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffe24a'; for (const y of [0, 64]) { g.beginPath(); g.moveTo(20, y + 6); g.lineTo(108, y + 6); g.lineTo(64, y + 58); g.closePath(); g.fill(); } }),
      cimen: tuval(256, 256, (g, w, h) => { g.fillStyle = '#5a9a3a'; g.fillRect(0, 0, w, h); gurultu(g, w, h, ['#4a8a2e', '#6aaa44', '#548f36', '#76b24e', '#3f7a28'], 14000); }),
      kum: tuval(256, 256, (g, w, h) => { g.fillStyle = '#d8a868'; g.fillRect(0, 0, w, h); gurultu(g, w, h, ['#c8985a', '#e4b878', '#d0a060', '#b8884a'], 14000); }),
      beton: tuval(128, 128, (g, w, h) => { g.fillStyle = '#a8a8a4'; g.fillRect(0, 0, w, h); gurultu(g, w, h, ['#989894', '#b8b8b4', '#8e8e8a'], 3000); }),
      seritli: tuval(128, 32, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#fafafa' : '#e8202a'; g.fillRect(i * 16, 0, 16, h); } }),
      uyari: tuval(128, 32, (g, w, h) => { g.fillStyle = '#f2c12e'; g.fillRect(0, 0, w, h); g.fillStyle = '#111'; for (let i = -2; i < 10; i++) { g.beginPath(); g.moveTo(i * 16, h); g.lineTo(i * 16 + 8, h); g.lineTo(i * 16 + 8 + h, 0); g.lineTo(i * 16 + h, 0); g.fill(); } }),
    };
    for (const k of ['asfalt', 'bordur', 'cimen', 'kum', 'beton', 'dama', 'ok', 'seritli', 'uyari', 'rampa']) { DOKU[k].wrapS = DOKU[k].wrapT = THREE.RepeatWrapping; }
    DOKU.cimen.repeat.set(160, 160); DOKU.kum.repeat.set(160, 160);
  }

  // ---------- Kurulum ----------
  function kur(kanvas) {
    renderer = new THREE.WebGLRenderer({ canvas: kanvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(60, 1, 0.3, 1400);
    hemi = new THREE.HemisphereLight(0xcfe6ff, 0x5a6a3a, 1.0); scene.add(hemi);
    gunes = new THREE.DirectionalLight(0xfff0d8, 2.6);
    gunes.castShadow = true; gunes.shadow.mapSize.set(2048, 2048);
    Object.assign(gunes.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 220 });
    gunes.shadow.bias = -0.0004; gunes.shadow.normalBias = 0.04;
    scene.add(gunes); scene.add(gunes.target);
    dokulariYap();
    parcacikKur();
    boyutla();
    addEventListener('resize', boyutla);
  }
  function boyutla() {
    const w = Math.max(1, innerWidth), h = Math.max(1, innerHeight);
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }

  // ---------- Ortam (gökyüzü, yer, ağaçlar, dağlar) ----------
  function ortamKur(ortam) {
    if (ortamG) scene.remove(ortamG);
    ortamG = new THREE.Group(); scene.add(ortamG);
    const kanyon = ortam === 'kanyon';
    tohum = kanyon ? 7 : 3;
    const ust = kanyon ? 0x5a9ad8 : 0x3a8ae0, ufuk = kanyon ? 0xf2d6a8 : 0xcfe8f8;
    // gökyüzü küresi
    const gok = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { ust: { value: new THREE.Color(ust) }, ufuk: { value: new THREE.Color(ufuk) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 ust; uniform vec3 ufuk; varying vec3 vP; void main(){ float k = smoothstep(-0.05, 0.45, vP.y); gl_FragColor = vec4(mix(ufuk, ust, k), 1.0); }',
    }));
    gok.renderOrder = -1; ortamG.add(gok); ortamG.userData.gok = gok;
    scene.background = new THREE.Color(ufuk);
    scene.fog = new THREE.Fog(ufuk, 160, 650);
    hemi.color.setHex(kanyon ? 0xffe8c8 : 0xcfe6ff); hemi.groundColor.setHex(kanyon ? 0x8a5a3a : 0x5a6a3a);
    // güneş diski
    const gd = new THREE.Mesh(new THREE.SphereGeometry(18, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfff6d8, fog: false })); gd.position.set(320, 380, 260); ortamG.add(gd);
    // yer
    const yer = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), new THREE.MeshStandardMaterial({ map: kanyon ? DOKU.kum : DOKU.cimen, roughness: 1 }));
    yer.rotation.x = -Math.PI / 2; yer.position.y = ZY(); yer.receiveShadow = true; ortamG.add(yer);
    // uzak dağlar / kayalar
    for (let i = 0; i < 46; i++) {
      const a = i / 46 * Math.PI * 2 + srnd(-0.05, 0.05), r = srnd(420, 620);
      let m;
      if (!kanyon) {
        const h = srnd(70, 190);
        m = new THREE.Mesh(new THREE.ConeGeometry(srnd(70, 140), h, 7), mat(srnd(0, 1) < 0.5 ? 0x4a7a5a : 0x5a8a6a, { p: 1 }));
        m.position.set(Math.cos(a) * r, ZY() + h / 2 - 2, Math.sin(a) * r);
        if (h > 130) { const kar = new THREE.Mesh(new THREE.ConeGeometry(m.geometry.parameters.radius * 0.32, h * 0.3, 7), mat(0xf4f8ff, { p: 0.9 })); kar.position.y = h * 0.36; m.add(kar); }
      } else {
        const h = srnd(40, 120), rr = srnd(40, 90);
        m = new THREE.Mesh(new THREE.CylinderGeometry(rr * 0.8, rr, h, 8), mat([0xb8603a, 0xc87a4a, 0xa8502e][i % 3], { p: 1 }));
        m.position.set(Math.cos(a) * r, ZY() + h / 2 - 2, Math.sin(a) * r);
        const serit = new THREE.Mesh(new THREE.CylinderGeometry(rr * 0.86, rr * 0.9, h * 0.12, 8), mat(0xe8b088, { p: 1 })); serit.position.y = h * 0.1; m.add(serit);
      }
      m.rotation.y = srnd(0, 6); ortamG.add(m);
    }
    // ağaçlar / kaktüsler (InstancedMesh)
    const n = kanyon ? 220 : 520;
    const govdeG = kanyon ? new THREE.CapsuleGeometry(0.7, 5, 4, 8) : new THREE.CylinderGeometry(0.4, 0.6, 3, 6);
    const tepeG = kanyon ? new THREE.CapsuleGeometry(0.45, 2.2, 4, 8) : new THREE.ConeGeometry(2.6, 7, 7);
    const govde = new THREE.InstancedMesh(govdeG, mat(kanyon ? 0x4a8a3a : 0x6a4a2a, { p: 0.9 }), n);
    const tepe = new THREE.InstancedMesh(tepeG, mat(kanyon ? 0x4a8a3a : 0x2f6a34, { p: 0.85 }), n * (kanyon ? 2 : 1));
    const o = new THREE.Object3D(); let ti = 0;
    for (let i = 0; i < n; i++) {
      const a = srnd(0, Math.PI * 2), r = srnd(30, 400), x = Math.cos(a) * r + 60, z = Math.sin(a) * r, s = srnd(0.7, 1.5);
      o.position.set(x, ZY() + (kanyon ? 3 : 1.5) * s, z); o.scale.setScalar(s); o.rotation.set(0, srnd(0, 6), 0); o.updateMatrix(); govde.setMatrixAt(i, o.matrix);
      if (!kanyon) { o.position.y = ZY() + 6 * s; o.updateMatrix(); tepe.setMatrixAt(ti++, o.matrix); }
      else for (const sg of [-1, 1]) { o.position.set(x + sg * 1.3 * s, ZY() + 4 * s, z); o.updateMatrix(); tepe.setMatrixAt(ti++, o.matrix); }
    }
    govde.castShadow = tepe.castShadow = true; ortamG.add(govde, tepe);
    // bulutlar
    for (let i = 0; i < 22; i++) {
      const b = new THREE.Group(); const k = srnd(0.8, 1.8);
      for (let j = 0; j < 5; j++) { const s = new THREE.Mesh(new THREE.SphereGeometry(srnd(6, 11) * k, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.92 })); s.position.set(j * 7 * k - 14 * k, srnd(-2, 3), srnd(-4, 4)); s.scale.y = 0.6; b.add(s); }
      b.position.set(srnd(-400, 500), srnd(70, 130), srnd(-400, 400)); ortamG.add(b);
    }
  }

  // ---------- Pist ----------
  // Bir nokta dizisinden (orta çizgi) şerit şeklinde yol geometrisi: üst, iki yan, alt
  function seritGeo(pts, genislik, kalin, yUst, uzunlukV = 8) {
    const P = [], UV = [], I = [];
    let v = 0;
    const kenar = (p, s) => { const w = (genislik ? genislik(p) : p.w) / 2 * s; return [p.x - Math.sin(p.a) * w, p.z + Math.cos(p.a) * w]; };
    pts.forEach((p, i) => {
      if (i) v += Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z, p.y - pts[i - 1].y) / uzunlukV;
      const [lx, lz] = kenar(p, -1), [rx, rz] = kenar(p, 1), y = p.y + yUst;
      P.push(lx, y, lz, rx, y, rz, lx, y - kalin, lz, rx, y - kalin, rz);
      UV.push(0, v, 1, v, 0, v, 1, v);
    });
    for (let i = 0; i < pts.length - 1; i++) {
      const a = i * 4, b = a + 4;
      I.push(a, a + 1, b, a + 1, b + 1, b);              // üst
      I.push(a + 2, b + 2, a + 3, a + 3, b + 2, b + 3);  // alt
      I.push(a, b, a + 2, a + 2, b, b + 2);              // sol yan
      I.push(a + 1, a + 3, b + 1, a + 3, b + 3, b + 1);  // sağ yan
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setIndex(I); g.computeVertexNormals();
    return g;
  }
  let YM = null;
  function yolMalzeme() {
    if (!YM) YM = {
      asfalt: new THREE.MeshStandardMaterial({ map: DOKU.asfalt, roughness: 0.85 }),
      rampa: new THREE.MeshStandardMaterial({ map: DOKU.rampa, roughness: 0.6 }),
      beton: new THREE.MeshStandardMaterial({ map: DOKU.beton, roughness: 0.95 }),
      bordur: new THREE.MeshStandardMaterial({ map: DOKU.bordur, roughness: 0.7 }),
      celik: new THREE.MeshStandardMaterial({ color: 0xc4c8d0, metalness: 0.85, roughness: 0.3 }),
    };
    return YM;
  }
  // Bir yol parçasını (segment) g grubuna çiz: asfalt şerit, rampa, bordür, direkler
  function segmentCiz(g, C, si, tabanY, meshler) {
    const { asfalt: asfaltM, rampa: rampaM, beton: betonM, bordur: bordurM } = yolMalzeme();
    const idx = []; C.forEach((p, i) => { if (p.si === si) idx.push(i); });
    if (!idx.length) return null;
    const son = idx[idx.length - 1] + 1;
    if (son < C.length) idx.push(son);
    let kos = [];
    const kapat = (rampaMi) => {
      if (kos.length < 2) return;
      const pts = kos.map(i => C[i]);
      const m = new THREE.Mesh(seritGeo(pts, null, 0.7, 0), rampaMi ? rampaM : asfaltM);
      m.castShadow = true; m.receiveShadow = true; g.add(m); if (meshler) meshler.push(m);
      if (pts.some(p => p.viraj)) for (const s of [-1, 1]) {
        const kb = pts.map(p => ({ ...p, x: p.x - Math.sin(p.a) * (p.w / 2 - 0.35) * s, z: p.z + Math.cos(p.a) * (p.w / 2 - 0.35) * s, w: 0.7 }));
        const b = new THREE.Mesh(seritGeo(kb, null, 0.12, 0.06, 2), bordurM); b.receiveShadow = true; g.add(b);
      }
      pts.forEach((p, k) => {
        if ((kos[k] % 11) !== 3) return;
        const h = p.y - 0.7 - tabanY; if (h < 1) return;
        const dr = silindir(0.55, 0.75, h, betonM, 10); dr.position.set(p.x, tabanY + h / 2, p.z); g.add(dr);
        const bas = kutu(1.4, 0.5, p.w * 0.6, betonM, p.x, p.y - 0.95, p.z); bas.rotation.y = -p.a; g.add(bas);
      });
    };
    let kosRampa = null;
    idx.forEach(i => {
      const p = C[i];
      if (p.bosluk) { if (kos.length) { kos.push(i); kapat(kosRampa); } kos = []; kosRampa = null; return; }
      const r = !!p.rampa;
      if (kos.length && r !== kosRampa) { kos.push(i); kapat(kosRampa); kos = [i]; kosRampa = r; return; }
      if (!kos.length) kosRampa = r;
      kos.push(i);
    });
    if (kos.length) kapat(kosRampa);
    return idx;
  }
  // Yol kenarı çelik korkulukları (tek seferde, InstancedMesh)
  function korkulukCiz(liste, hedef) {
    if (!liste.length) return;
    const { celik } = yolMalzeme();
    const ray = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.34, 0.1), celik, liste.length);
    const direk = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 0.8, 0.12), celik, liste.length);
    const o = new THREE.Object3D();
    liste.forEach((k, i) => {
      o.position.set(k.x, k.y + 0.62, k.z); o.rotation.set(0, -k.a, Math.atan2(k.dy || 0, k.L)); o.scale.set(k.L + 0.04, 1, 1); o.updateMatrix(); ray.setMatrixAt(i, o.matrix);
      o.position.set(k.x, k.y + 0.4, k.z); o.rotation.set(0, -k.a, 0); o.scale.set(1, 1, 1); o.updateMatrix(); direk.setMatrixAt(i, o.matrix);
    });
    ray.castShadow = true; direk.castShadow = true;
    hedef.add(ray, direk);
  }
  // Pistin ucunda, eklenecek yolun yarı saydam önizlemesi
  let yolHayaletG = null;
  const hayaletYolM = new THREE.MeshBasicMaterial({ color: 0x5aff7a, transparent: true, opacity: 0.45, depthWrite: false });
  function yolHayalet(dizi, tur) {
    if (yolHayaletG) { scene.remove(yolHayaletG); yolHayaletG = null; }
    if (!dizi || !tur) return;
    const ekler = Dunya.uygunYol(dizi, tur).ekler;
    const Y = Dunya.yolKur([...dizi, ...ekler]);
    yolHayaletG = new THREE.Group();
    for (let si = 1 + dizi.length; si < 1 + dizi.length + ekler.length; si++) segmentCiz(yolHayaletG, Y.cizgi, si, ZY(), null);
    yolHayaletG.traverse(o => { if (o.isMesh) { o.material = hayaletYolM; o.castShadow = false; } });
    yolHayaletG.position.y = 0.05;
    scene.add(yolHayaletG);
    const t0 = zaman;
    animasyonlar.push({ son: zaman + 0.4, f: k => { if (yolHayaletG) hayaletYolM.opacity = 0.2 + 0.25 * k; } });
    void t0;
  }
  // d: dunya. yeniSi: animasyonla gelecek segment numaraları
  function yolGuncelle(d, yeniSi = []) {
    sonDunya = d;
    if (yolG) scene.remove(yolG);
    yolG = new THREE.Group(); scene.add(yolG); yolMeshler = [];
    const C = d.cizgi, S = d.yol.segmentler;
    S.forEach((seg, si) => {
      const g = new THREE.Group(); yolG.add(g);
      const idx = segmentCiz(g, C, si, ZY(), yolMeshler);
      if (!idx) return;
      // yeni gelen segment: aşağıdan yükselsin
      if (yeniSi.includes(si)) {
        g.position.y = -12; g.scale.set(1, 0.2, 1);
        animasyonlar.push({ son: zaman + 0.9, f: k => { const e = 1 - Math.pow(1 - k, 3); g.position.y = -12 * (1 - e); g.scale.y = 0.2 + 0.8 * e; }, bitis: () => { g.position.y = 0; g.scale.y = 1; const p = C[idx[Math.floor(idx.length / 2)]]; toz(p.x, p.y + 0.2, p.z, 30, 0xd8d0c0, 4); } });
      }
    });
    korkulukCiz(d.yol.korkuluk, yolG);
    // başlangıç kapısı ve dizilim çizgileri
    const b0 = C[0];
    const kapi = (p, yazi, renk) => {
      const k = new THREE.Group(); k.position.set(p.x, p.y, p.z); k.rotation.y = -p.a;
      const dm = mat(0x2a2a30, { m: 0.6, p: 0.4 });
      [-1, 1].forEach(s => { const d = silindir(0.25, 0.3, 6, dm, 10); d.position.set(0, 3, s * (p.w / 2 + 0.5)); k.add(d); });
      const pano = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.4, p.w + 1.6), [dm, dm, dm, dm,
        new THREE.MeshStandardMaterial({ map: tuval(512, 96, (g, w, h) => { g.fillStyle = renk; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = 'bold 64px sans-serif'; g.textAlign = 'center'; g.fillText(yazi, w / 2, 72); }), emissive: 0x222222 }),
        new THREE.MeshStandardMaterial({ map: tuval(512, 96, (g, w, h) => { g.fillStyle = renk; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = 'bold 64px sans-serif'; g.textAlign = 'center'; g.fillText(yazi, w / 2, 72); }), emissive: 0x222222 })]);
      pano.position.y = 6; pano.rotation.y = Math.PI / 2; pano.castShadow = true; k.add(pano);
      const cizgi = new THREE.Mesh(new THREE.PlaneGeometry(1.2, p.w), new THREE.MeshStandardMaterial({ map: DOKU.dama }));
      cizgi.rotation.x = -Math.PI / 2; cizgi.position.y = 0.03; k.add(cizgi);
      yolG.add(k); return k;
    };
    kapi(C[13], 'BAŞLA', '#2a6ad8');
    for (let i = 0; i < 3; i++) for (const s of [-1, 1]) {
      const p = C[9 - i * 3 + 1]; const c = kutu(0.15, 0.02, 1.4, mat(0xffffff), p.x, p.y + 0.02, p.z + s * 1.8, false); c.rotation.y = -p.a; yolG.add(c);
    }
    const bp = C[d.bitisI];
    kapi(bp, 'BİTİŞ', '#d8202a');
    // bitişte sallanan dama bayrak
    const bayrak = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.6, 8, 4), new THREE.MeshStandardMaterial({ map: DOKU.dama, side: THREE.DoubleSide }));
    const sag = [-Math.sin(bp.a), Math.cos(bp.a)];
    bayrak.position.set(bp.x + sag[0] * (bp.w / 2 + 1.7), bp.y + 7.2, bp.z + sag[1] * (bp.w / 2 + 1.7)); bayrak.rotation.y = -bp.a;
    yolG.add(bayrak); bayrakMesh = bayrak;
    void b0;
  }
  // Pistin kapladığı alan (kamera için)
  function yolKutusu(d, i0 = 0) {
    const C = (d || sonDunya).cizgi; let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, y1 = 0;
    for (let i = i0; i < C.length; i++) { const p = C[i]; x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); y1 = Math.max(y1, p.y); }
    return { x0, x1, z0, z1, y1, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2 };
  }

  // ---------- Tuzaklar ----------
  function parcaYap(p, hayaletRenk) {
    const g = new THREE.Group(); g.position.set(p.x, p.y || 0, p.z); g.rotation.y = -p.r;
    const H = hayaletRenk !== undefined ? mat(hayaletRenk, { sf: 0.5, e: hayaletRenk, ei: 0.35 }) : null;
    const M = (renk, o) => H || mat(renk, o);
    let anim = null;
    const S = Dunya.parcaSekli({ ...p, y: 0, x: 0, z: 0, r: 0, id: p.id || 'h' });
    switch (p.tur) {
      case 'duvar': {
        const sekil = new THREE.Shape(); sekil.moveTo(-0.55, 0); sekil.lineTo(0.55, 0); sekil.lineTo(0.38, 0.35); sekil.lineTo(0.2, 1.3); sekil.lineTo(-0.2, 1.3); sekil.lineTo(-0.38, 0.35); sekil.closePath();
        const geo = new THREE.ExtrudeGeometry(sekil, { depth: 4.4, bevelEnabled: false }); geo.translate(0, 0, -2.2); geo.rotateY(Math.PI / 2);
        const m = new THREE.Mesh(geo, H || new THREE.MeshStandardMaterial({ map: DOKU.beton, roughness: 0.95 })); m.castShadow = true; m.receiveShadow = true; g.add(m);
        if (!H) [-1, 1].forEach(s => { const b = kutu(4.3, 0.18, 0.02, new THREE.MeshStandardMaterial({ map: DOKU.seritli }), 0, 0.9, s * 0.29, false); b.rotation.x = s * 0.17; g.add(b); });
        break;
      }
      case 'korkuluk': {
        for (let i = -3; i <= 3; i += 1.5) { const d = kutu(0.14, 0.9, 0.14, M(0x8a9098, { m: 0.8, p: 0.35 }), i, 0.45, 0); g.add(d); }
        const ray = kutu(6.2, 0.36, 0.12, M(0xc8ccd4, { m: 0.9, p: 0.25 }), 0, 0.68, 0); g.add(ray);
        if (!H) for (let i = -2.5; i <= 2.5; i += 2.5) g.add(kutu(0.2, 0.12, 0.13, mat(0xff4020, { e: 0xff2000, ei: 0.6 }), i, 0.68, 0, false));
        break;
      }
      case 'pervane': {
        const direk = silindir(0.4, 0.45, 2.4, H || new THREE.MeshStandardMaterial({ map: DOKU.uyari, roughness: 0.6 }), 12); direk.position.y = 1.2; g.add(direk);
        const kol = new THREE.Group(); kol.position.y = 0.6;
        kol.add(kutu(5.6, 0.45, 0.55, H || new THREE.MeshStandardMaterial({ map: DOKU.seritli, roughness: 0.5 })));
        [-2.8, 2.8].forEach(x => kol.add(kutu(0.3, 0.7, 0.7, M(0x2a2a2a, { m: 0.5 }), x, 0, 0)));
        g.add(kol);
        const m = S.hareketli[0];
        anim = tt => { kol.rotation.y = -(Dunya.hareketliDurum({ ...m, r: p.r }, tt).aci - p.r); };
        break;
      }
      case 'cekic': {
        const celik = M(0xd8a020, { m: 0.5, p: 0.45 });
        [-3.6, 3.6].forEach(v => { const d = kutu(0.4, 5.4, 0.4, celik, 0, 2.7, v); g.add(d); });
        g.add(kutu(0.45, 0.45, 7.8, celik, 0, 5.3, 0));
        const sarkac = new THREE.Group(); sarkac.position.y = 5.1; g.add(sarkac);
        const zincir = silindir(0.07, 0.07, 3.1, M(0x555555, { m: 0.9 }), 6); zincir.position.y = -1.55; sarkac.add(zincir);
        const top = new THREE.Mesh(new THREE.SphereGeometry(1.05, 20, 14), M(0x2a2a30, { m: 0.85, p: 0.35 })); top.position.y = -4.1; top.castShadow = true; sarkac.add(top);
        const m = S.hareketli[0];
        anim = tt => { const hd = Dunya.hareketliDurum(m, tt); sarkac.rotation.x = -Math.asin(Math.max(-1, Math.min(1, hd.s * 3.2 / 4.1))); };
        break;
      }
      case 'blok': {
        const b = new THREE.Group();
        b.add(kutu(2.2, 1.4, 2.2, M(0xff7a1a, { p: 0.6 }), 0, 0.7, 0));
        if (!H) b.add(kutu(2.22, 0.35, 2.22, new THREE.MeshStandardMaterial({ map: DOKU.uyari }), 0, 1.15, 0));
        g.add(b);
        if (!H) [-1, 1].forEach(s => g.add(kutu(7.2, 0.06, 0.15, mat(0x777780, { m: 0.7 }), 0, 0.03, s * 0.8, false)));
        const m = S.hareketli[0];
        anim = tt => { b.position.x = Math.sin(tt * 1.2 + m.faz) * 2.4; };
        break;
      }
      case 'yag': case 'bal': {
        const yag = p.tur === 'yag';
        const sekil = new THREE.Shape(); const n = 16;
        for (let i = 0; i <= n; i++) { const a = i / n * 6.283, r = 2.3 * (0.85 + 0.16 * Math.sin(a * 3 + Dunya.karma(p.id || 'x') * 6)); if (i) sekil.lineTo(Math.cos(a) * r, Math.sin(a) * r); else sekil.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
        const lek = new THREE.Mesh(new THREE.ShapeGeometry(sekil), H || mat(yag ? 0x101016 : 0x5a3a1e, { p: yag ? 0.05 : 0.85, m: yag ? 0.8 : 0, e: yag ? 0x1a1030 : 0 }));
        lek.rotation.x = -Math.PI / 2; lek.position.y = 0.04; lek.receiveShadow = true; g.add(lek);
        if (!H) for (let i = 0; i < 7; i++) { const k = new THREE.Mesh(new THREE.SphereGeometry(rnd(0.18, 0.4), 10, 8), mat(yag ? 0x3a2a6a : 0x4a2e16, { p: yag ? 0.1 : 0.9, m: yag ? 0.5 : 0 })); k.position.set(rnd(-1.4, 1.4), 0.05, rnd(-1.4, 1.4)); k.scale.y = 0.45; g.add(k); }
        if (!H && yag) { const varil = silindir(0.55, 0.55, 1.3, mat(0x2a5ab8, { m: 0.5, p: 0.4 }), 16); varil.rotation.z = Math.PI / 2; varil.position.set(1.6, 0.55, -1.4); g.add(varil); }
        break;
      }
      case 'mayin': {
        const disk = silindir(0.75, 0.85, 0.28, M(0x3a4a2a, { m: 0.4, p: 0.5 }), 18); disk.position.y = 0.14; g.add(disk);
        const ust = silindir(0.3, 0.35, 0.16, M(0x2a2a2a, { m: 0.6 }), 12); ust.position.y = 0.34; g.add(ust);
        const isik = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2020 })); isik.position.y = 0.45; g.add(isik);
        g.userData.mayin = true;
        anim = tt => { isik.visible = g.visible && Math.sin(tt * 8) > 0; };
        break;
      }
      case 'yay': {
        g.add(silindir(1.2, 1.3, 0.22, M(0x2a2a30, { m: 0.6, p: 0.3 }), 20)).position.y = 0.11;
        const pts = []; for (let i = 0; i <= 80; i++) { const a = i / 80 * Math.PI * 10; pts.push(new THREE.Vector3(Math.cos(a) * 0.8, 0.22 + i / 80 * 0.8, Math.sin(a) * 0.8)); }
        const yay = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.1, 6), M(0xc8ccd8, { m: 0.9, p: 0.25 })); yay.castShadow = true; g.add(yay);
        const ust = silindir(1.15, 1.15, 0.16, H || new THREE.MeshStandardMaterial({ map: DOKU.uyari }), 20); ust.position.y = 1.1; g.add(ust);
        g.userData.yay = { yay, ust };
        break;
      }
      case 'turbo': {
        const t = DOKU.ok.clone(); t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 2);
        const ok = new THREE.Mesh(new THREE.PlaneGeometry(4, 3), H || new THREE.MeshStandardMaterial({ map: t, emissive: 0xff5a1a, emissiveMap: t, emissiveIntensity: 0.9 }));
        ok.rotation.set(-Math.PI / 2, 0, Math.PI / 2); ok.position.y = 0.04; g.add(ok);
        if (!H) anim = tt => { t.offset.y = -tt * 2; };
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
    if (dusur) {
      const g = o.g, y0 = p.y || 0;
      animasyonlar.push({ son: zaman + 0.55, f: k => { const e = 1 - Math.pow(1 - k, 3); g.position.y = y0 + (1 - e) * 10; g.scale.setScalar(0.7 + 0.3 * e); }, bitis: () => { g.position.y = y0; g.scale.setScalar(1); toz(p.x, y0 + 0.1, p.z, 22, 0xd8d0c0, 2.2); } });
    }
  }
  function parcaSil(id, efekt = true) {
    const o = parcaG.get(id); if (!o) return;
    parcaG.delete(id);
    if (efekt) { const g = o.g; poof(o.p.x, (o.p.y || 0) + 0.5, o.p.z); animasyonlar.push({ son: zaman + 0.35, f: k => { g.scale.setScalar(1 - k); }, bitis: () => scene.remove(g) }); }
    else scene.remove(o.g);
  }
  function parcalariTemizle() { [...parcaG.keys()].forEach(id => parcaSil(id, false)); }
  function mayinDurum(id, kapali) { const o = parcaG.get(id); if (o?.g.userData.mayin) o.g.visible = !kapali; }
  function yayBas(x, z) {
    let en = null, ed = 3;
    parcaG.forEach(o => { if (o.g.userData.yay) { const d = Math.hypot(o.p.x - x, o.p.z - z); if (d < ed) { ed = d; en = o; } } });
    if (!en) return;
    const { yay, ust } = en.g.userData.yay;
    animasyonlar.push({ son: zaman + 0.5, f: k => { const s = 1 + Math.sin(k * Math.PI * 3) * (1 - k) * 0.7; yay.scale.y = s; ust.position.y = 0.22 + 0.88 * s; } });
  }

  // ---------- Hayalet ve imleçler ----------
  function hayaletAyarla(tur, x, y, z, r, gecerli) {
    if (!tur) { if (hayalet) { scene.remove(hayalet.g); hayalet = null; hayaletTur = null; } return; }
    const k = tur + (gecerli ? 'e' : 'h');
    if (!hayalet || hayaletTur !== k) {
      if (hayalet) scene.remove(hayalet.g);
      const r0 = gecerli ? 0x5aff7a : 0xff4a4a;
      if (tur === 'silgi' || tur === 'bomba') {
        const g = new THREE.Group(), R = tur === 'silgi' ? Dunya.SILGI_R : Dunya.BOMBA_R;
        const halka = new THREE.Mesh(new THREE.RingGeometry(R - 0.3, R, 48), new THREE.MeshBasicMaterial({ color: r0, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
        halka.rotation.x = -Math.PI / 2; halka.position.y = 0.2; g.add(halka);
        const ic = new THREE.Mesh(new THREE.CircleGeometry(R - 0.3, 48), new THREE.MeshBasicMaterial({ color: r0, transparent: true, opacity: 0.18, depthWrite: false }));
        ic.rotation.x = -Math.PI / 2; ic.position.y = 0.18; g.add(ic);
        const ikon = etiketYap(tur === 'silgi' ? '🔧' : '💣', '#0000', 64); ikon.position.y = 3; g.add(ikon);
        hayalet = { g };
      } else hayalet = parcaYap({ tur, x: 0, y: 0, z: 0, r: 0, id: 'hayalet' }, r0);
      hayaletTur = k; scene.add(hayalet.g);
    }
    hayalet.g.position.set(x, y + 0.04, z); hayalet.g.rotation.y = -r;
    if (hayalet.anim) hayalet.anim(zaman);
    parcaG.forEach(o => o.g.traverse(m => { if (m.isMesh && m.userData.parlak) { m.material = m.userData.asil; m.userData.parlak = false; } }));
  }
  function vurgula(ids) {
    const isik = 0.5 + Math.sin(zaman * 10) * 0.5;
    ids.forEach(id => { const o = parcaG.get(id); if (!o) return; o.g.traverse(m => { if (m.isMesh && m.material?.emissive) { if (!m.userData.parlak) { m.userData.asil = m.material; m.material = m.material.clone(); m.userData.parlak = true; } m.material.emissive.setHex(0xff2020); m.material.emissiveIntensity = isik; } }); });
  }
  function imlecAyarla(no, tur, x, y, z, r) {
    let o = imlecler.get(no);
    if (!tur) { if (o) { scene.remove(o.g); imlecler.delete(no); } return; }
    if (!o || o.tur !== tur) {
      if (o) scene.remove(o.g);
      const renk = RENKLER[no % RENKLER.length], g = new THREE.Group();
      const ic = (tur === 'silgi' || tur === 'bomba') ? null : parcaYap({ tur, x: 0, y: 0, z: 0, r: 0, id: 'im' + no }, renk);
      if (ic) g.add(ic.g);
      const ok = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.6, 12), new THREE.MeshBasicMaterial({ color: renk })); ok.rotation.x = Math.PI; ok.position.y = 5; g.add(ok);
      o = { g, tur, ic, ok, hx: x, hy: y, hz: z, hr: r, x, y, z }; scene.add(g); imlecler.set(no, o);
    }
    Object.assign(o, { hx: x, hy: y, hz: z, hr: r });
  }
  function imlecleriTemizle() { imlecler.forEach(o => scene.remove(o.g)); imlecler.clear(); }

  // ---------- Arabalar ----------
  function arabaYap(renkNo) {
    const renk = RENKLER[renkNo % RENKLER.length];
    const g = new THREE.Group(), govde = new THREE.Group(); g.add(govde);
    const boya = new THREE.MeshPhysicalMaterial({ color: renk, roughness: 0.28, metalness: 0.35, clearcoat: 1, clearcoatRoughness: 0.15 });
    const yan = (pts, derin, m) => { const s = new THREE.Shape(); pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y))); const geo = new THREE.ExtrudeGeometry(s, { depth: derin, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 2 }); geo.translate(0, 0, -derin / 2); const ms = new THREE.Mesh(geo, m); ms.castShadow = true; ms.receiveShadow = true; return ms; };
    govde.add(yan([[-1.18, 0.28], [1.16, 0.28], [1.22, 0.52], [1.05, 0.66], [0.5, 0.74], [-0.95, 0.78], [-1.2, 0.72]], 1.18, boya));
    govde.add(yan([[0.5, 0.74], [0.18, 1.12], [-0.6, 1.14], [-0.95, 0.78]], 1.04, new THREE.MeshPhysicalMaterial({ color: 0x1a2230, roughness: 0.05, metalness: 0.6, clearcoat: 1 })));
    govde.add(kutu(0.72, 0.06, 1.08, boya, -0.21, 1.15, 0));
    govde.add(kutu(0.1, 0.08, 1.25, mat(0x1a1a1a), -1.12, 0.95, 0));   // spoiler
    [-0.45, 0.45].forEach(z => govde.add(kutu(0.08, 0.24, 0.08, mat(0x1a1a1a), -1.1, 0.84, z)));
    [-0.42, 0.42].forEach(z => govde.add(kutu(0.06, 0.13, 0.3, mat(0xfff6d0, { e: 0xfff0b0, ei: 1.5 }), 1.24, 0.52, z, false)));
    [-0.44, 0.44].forEach(z => govde.add(kutu(0.06, 0.12, 0.28, mat(0xff2020, { e: 0xff0000, ei: 1 }), -1.24, 0.6, z, false)));
    govde.add(kutu(0.04, 0.16, 0.42, mat(0xf4f4f4), -1.25, 0.42, 0, false));   // plaka
    govde.add(kutu(1.4, 0.02, 0.3, mat(0xffffff), 0.1, 0.79, 0, false));      // yarış şeridi
    const tekerler = [];
    [[0.74, 0.62], [0.74, -0.62], [-0.74, 0.62], [-0.74, -0.62]].forEach(([x, z]) => {
      const t = new THREE.Group(); t.position.set(x, 0.36, z);
      const lastik = silindir(0.36, 0.36, 0.3, mat(0x161616, { p: 0.85 }), 18); lastik.rotation.x = Math.PI / 2; t.add(lastik);
      const jant = silindir(0.22, 0.22, 0.32, mat(0xd8dce4, { m: 0.9, p: 0.25 }), 10); jant.rotation.x = Math.PI / 2; t.add(jant);
      govde.add(t); tekerler.push(t);
    });
    const kalkan = new THREE.Mesh(new THREE.SphereGeometry(1.7, 20, 14), new THREE.MeshBasicMaterial({ color: 0x6ad8ff, transparent: true, opacity: 0.22, depthWrite: false }));
    kalkan.position.y = 0.7; kalkan.visible = false; g.add(kalkan);
    const alev = new THREE.Mesh(new THREE.ConeGeometry(0.25, 1.3, 10), new THREE.MeshBasicMaterial({ color: 0x66aaff, transparent: true, opacity: 0.9 }));
    alev.rotation.z = Math.PI / 2; alev.position.set(-1.85, 0.5, 0); alev.visible = false; govde.add(alev);
    const golge = new THREE.Mesh(new THREE.CircleGeometry(1.2, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
    golge.rotation.x = -Math.PI / 2; golge.visible = false; scene.add(golge);
    return { g, govde, tekerler, kalkan, alev, golge, donus: 0, tozT: 0, renk, onTeker: tekerler.slice(0, 2) };
  }
  function arabaGuncelle(A, s, dt) {
    A.g.position.set(s.x, s.y, s.z);
    A.g.rotation.y = -s.a;
    A.govde.rotation.x = s.spin || 0;
    A.govde.rotation.z = s.havada ? Math.max(-0.35, Math.min(0.35, (s.vy || 0) * 0.035)) : (s.egim || 0);
    A.donus += (s.hiz || 0) * dt / 0.36;
    A.tekerler.forEach(t => { t.rotation.z = -A.donus; });
    A.onTeker.forEach(t => { t.rotation.y = -(s.direksiyon || 0) * 0.45; });
    A.kalkan.visible = !!s.kalkan; if (s.kalkan) A.kalkan.material.opacity = 0.18 + Math.sin(zaman * 6) * 0.06;
    A.alev.visible = !!s.turbo; if (s.turbo) { A.alev.scale.set(1, 0.8 + Math.random() * 0.6, 1); alevEfekt(s); }
    const zm = sonDunya ? Dunya.zemin(sonDunya, s.x, s.z, s.y + 0.5) : null;
    A.golge.visible = !!zm && s.y - zm.h > 0.3; if (A.golge.visible) { A.golge.position.set(s.x, zm.h + 0.05, s.z); A.golge.scale.setScalar(Math.max(0.4, 1 - (s.y - zm.h) * 0.08)); }
    A.tozT -= dt;
    if (A.tozT <= 0 && !s.havada && !s.dus && (s.hiz || 0) > 3) {
      A.tozT = 0.04;
      const gx = s.x - Math.cos(s.a) * 1, gz = s.z - Math.sin(s.a) * 1;
      if (s.kayiyor) for (let i = 0; i < 2; i++) parcacik(0, { x: gx + rnd(-0.6, 0.6), y: s.y + 0.2, z: gz + rnd(-0.6, 0.6), vx: rnd(-0.5, 0.5), vy: rnd(0.5, 1.5), vz: rnd(-0.5, 0.5), renk: 0xd8d8e0, boy: rnd(0.9, 1.5), omur: rnd(0.5, 0.9), buyu: 1.8 });
      else if (s.bal) for (let i = 0; i < 2; i++) parcacik(0, { x: gx + rnd(-0.5, 0.5), y: s.y + 0.2, z: gz + rnd(-0.5, 0.5), vx: rnd(-1, 1), vy: rnd(1.5, 3), vz: rnd(-1, 1), renk: 0x4a2e16, boy: 0.35, omur: 0.6, yer: 10 });
      else if (Math.random() < 0.2) parcacik(0, { x: gx, y: s.y + 0.1, z: gz, vx: rnd(-0.3, 0.3), vy: rnd(0.2, 0.6), vz: rnd(-0.3, 0.3), renk: 0xb8b4ac, boy: 0.5, omur: 0.4, buyu: 1.2 });
    }
  }
  function arabaSil(A) { scene.remove(A.g); scene.remove(A.golge); }
  function alevEfekt(s) {
    const gx = s.x - Math.cos(s.a) * 1.8, gz = s.z - Math.sin(s.a) * 1.8;
    parcacik(1, { x: gx, y: s.y + 0.5, z: gz, vx: -Math.cos(s.a) * 4 + rnd(-1, 1), vy: rnd(0, 1), vz: -Math.sin(s.a) * 4 + rnd(-1, 1), renk: Math.random() < 0.5 ? 0x4a9aff : 0xffd04a, boy: rnd(0.5, 0.9), omur: 0.25, buyu: -1 });
  }
  function dunyaAyarla(d) { sonDunya = d; }
  function etiketYap(yazi, renk, boy = 40) {
    const c = document.createElement('canvas'), g = c.getContext('2d');
    g.font = `900 ${boy}px Nunito, sans-serif`;
    const w = Math.ceil(g.measureText(yazi).width) + boy; c.width = w; c.height = boy * 1.6;
    g.font = `900 ${boy}px Nunito, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (renk !== '#0000') { g.fillStyle = '#000a'; g.beginPath(); g.roundRect(2, 2, w - 4, c.height - 4, boy * 0.5); g.fill(); g.strokeStyle = renk; g.lineWidth = 5; g.stroke(); }
    g.fillStyle = '#fff'; g.fillText(yazi, w / 2, c.height / 2 + 2);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
    const k = 0.0095 * boy / 40; sp.scale.set(w * k, c.height * k, 1); sp.renderOrder = 10;
    return sp;
  }

  // ---------- Parçacıklar ----------
  const PN = 2400, sistemler = [];
  function parcacikKur() {
    [THREE.NormalBlending, THREE.AdditiveBlending].forEach(karisim => {
      const geo = new THREE.BufferGeometry();
      const poz = new Float32Array(PN * 3), renk = new Float32Array(PN * 3), boy = new Float32Array(PN), alfa = new Float32Array(PN);
      geo.setAttribute('position', new THREE.BufferAttribute(poz, 3)); geo.setAttribute('renk', new THREE.BufferAttribute(renk, 3));
      geo.setAttribute('boy', new THREE.BufferAttribute(boy, 1)); geo.setAttribute('alfa', new THREE.BufferAttribute(alfa, 1));
      const m = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: karisim, uniforms: { olcek: { value: innerHeight } },
        vertexShader: `attribute vec3 renk; attribute float boy; attribute float alfa; varying vec3 vR; varying float vA; uniform float olcek;
          void main(){ vR = renk; vA = alfa; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = boy * olcek * 0.9 / -mv.z; gl_Position = projectionMatrix * mv; }`,
        fragmentShader: `varying vec3 vR; varying float vA; void main(){ vec2 p = gl_PointCoord - 0.5; float d = length(p); if (d > 0.5) discard; gl_FragColor = vec4(vR, smoothstep(0.5, 0.15, d) * vA); }`,
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
      ['position', 'renk', 'boy', 'alfa'].forEach(a => { S.geo.attributes[a].needsUpdate = true; });
    });
  }
  function toz(x, y, z, n = 10, renk = 0xd8d0c0, yay = 1.5) {
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.283; parcacik(0, { x: x + Math.cos(a) * yay * 0.5, y, z: z + Math.sin(a) * yay * 0.5, vx: Math.cos(a) * rnd(2, 5), vy: rnd(0.3, 1.5), vz: Math.sin(a) * rnd(2, 5), renk, boy: rnd(0.7, 1.3), omur: rnd(0.4, 0.8), buyu: 1.5 }); }
  }
  function kivilcim(x, y, z, n = 14) {
    for (let i = 0; i < n; i++) parcacik(1, { x, y, z, vx: rnd(-7, 7), vy: rnd(2, 7), vz: rnd(-7, 7), renk: Math.random() < 0.5 ? 0xffe060 : 0xff9a30, boy: rnd(0.18, 0.35), omur: rnd(0.25, 0.5), yer: 18 });
  }
  function poof(x, y, z) {
    for (let i = 0; i < 26; i++) { const a = Math.random() * 6.283; parcacik(0, { x, y: y + rnd(0, 1), z, vx: Math.cos(a) * rnd(2, 6), vy: rnd(1, 4), vz: Math.sin(a) * rnd(2, 6), renk: [0xffffff, 0xe8e8e8, 0xd0e0ff][i % 3], boy: rnd(0.9, 1.6), omur: rnd(0.5, 0.9), buyu: 1.4 }); }
    for (let i = 0; i < 12; i++) parcacik(1, { x, y: y + 0.5, z, vx: rnd(-5, 5), vy: rnd(2, 6), vz: rnd(-5, 5), renk: 0xfff080, boy: 0.3, omur: 0.6, yer: 6 });
  }
  function patlama(x, y, z, buyuk = false) {
    const k = buyuk ? 1.8 : 1;
    for (let i = 0; i < 40 * k; i++) { const a = Math.random() * 6.283, h = rnd(0.2, 1); parcacik(1, { x, y: y + 0.5, z, vx: Math.cos(a) * rnd(3, 11) * k * h, vy: rnd(2, 10) * k, vz: Math.sin(a) * rnd(3, 11) * k * h, renk: [0xffd040, 0xff8a20, 0xff4a10, 0xfff0a0][i % 4], boy: rnd(0.8, 1.8) * k, omur: rnd(0.3, 0.7), buyu: -0.5, yer: 4 }); }
    for (let i = 0; i < 30 * k; i++) { const a = Math.random() * 6.283; parcacik(0, { x: x + rnd(-1, 1), y: y + rnd(0.5, 2), z: z + rnd(-1, 1), vx: Math.cos(a) * rnd(1, 4) * k, vy: rnd(1, 5), vz: Math.sin(a) * rnd(1, 4) * k, renk: [0x4a4a50, 0x6a6a70, 0x2a2a30][i % 3], boy: rnd(1.5, 2.8) * k, omur: rnd(0.9, 1.6), buyu: 1.5 }); }
    kivilcim(x, y + 0.5, z, 30 * k);
    const halka = new THREE.Mesh(new THREE.RingGeometry(0.6, 1, 40), new THREE.MeshBasicMaterial({ color: 0xffe0a0, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    halka.rotation.x = -Math.PI / 2; halka.position.set(x, y + 0.2, z); scene.add(halka);
    const isik = new THREE.PointLight(0xffa040, 80 * k, 20 * k, 2); isik.position.set(x, y + 2, z); scene.add(isik);
    animasyonlar.push({ son: zaman + 0.6, f: t => { halka.scale.setScalar(1 + t * 9 * k); halka.material.opacity = 0.9 * (1 - t); isik.intensity = 80 * k * (1 - t); }, bitis: () => { scene.remove(halka); scene.remove(isik); } });
    sarsinti(buyuk ? 1 : 0.6, x, z);
  }
  function konfeti(x, y, z) {
    const renk = [0xff4a6a, 0x4ad0ff, 0xffe04a, 0x6aff7a, 0xc86aff, 0xff9a3a];
    for (let i = 0; i < 90; i++) parcacik(1, { x, y: y + 1, z, vx: rnd(-6, 6), vy: rnd(6, 14), vz: rnd(-6, 6), renk: renk[i % 6], boy: rnd(0.3, 0.55), omur: rnd(1.2, 2.2), yer: 9 });
  }
  function halkaEfekt(x, y, z, renk, buyu = 4) {
    const halka = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.1, 32), new THREE.MeshBasicMaterial({ color: renk, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    halka.rotation.x = -Math.PI / 2; halka.position.set(x, y, z); scene.add(halka);
    animasyonlar.push({ son: zaman + 0.5, f: t => { halka.scale.setScalar(1 + t * buyu); halka.material.opacity = 0.9 * (1 - t); }, bitis: () => scene.remove(halka) });
  }
  function sarsinti(g, x, z) {
    if (x !== undefined && kam.mod === 'takip' && kam.hedef) { const d = Math.hypot(x - kam.hedef.x, z - kam.hedef.z); g *= Math.max(0.1, 1 - d / 40); }
    kam.sars = Math.max(kam.sars, g);
  }

  // ---------- Kamera ----------
  // genel: yukarıdan, eğik bakış (inşa ve yerleştirme). takip: arabanın arkasından.
  function kameraGenel(odak, uzak) { kam.mod = 'genel'; if (odak) kam.odak = { ...odak }; if (uzak) kam.uzak = uzak; kam.kayX = 0; kam.kayZ = 0; kam.yakin = 1; }
  function kameraPistiGoster(d) {
    const k = yolKutusu(d);
    const tanH = Math.tan(camera.fov * Math.PI / 360), yx = (k.x1 - k.x0) / 2 + 8, yz = (k.z1 - k.z0) / 2 + 8;
    kameraGenel({ x: k.cx, y: k.y1 * 0.4, z: k.cz }, Math.max(30, yx / (tanH * camera.aspect), yz * 1.35 / tanH) * 1.05);
  }
  function kameraKaydir(dx, dz) { kam.kayX += dx; kam.kayZ += dz; }
  // Fareyle döndür: sağa sola 360°, yukarı aşağı eğim
  function kameraDondur(dx, dy) { kam.gYaw -= dx * 0.007; kam.gPitch = Math.max(0.2, Math.min(1.45, kam.gPitch + dy * 0.005)); }
  function kameraYakinlas(k) { kam.yakin = Math.max(0.25, Math.min(2.5, kam.yakin * k)); }
  function kameraTakip(hedef, ani) { kam.mod = 'takip'; kam.hedef = hedef; if (ani) { kam.yaw = hedef.a; kam.ani = true; } }
  function kameraGuncelle(dt) {
    let hx, hy, hz, cx, cy, cz, hiz = 3;
    if (kam.mod === 'takip' && kam.hedef) {
      const h = kam.hedef;
      if (!h.dus) {
        const sp = Math.hypot(h.vx || 0, h.vz || 0);
        const hedefYaw = h.havada && sp > 3 ? Math.atan2(h.vz, h.vx) : h.a;
        kam.yaw += Dunya.aciFark(kam.yaw, hedefYaw) * Math.min(1, dt * (h.havada ? 2.5 : 4.5));
        const geri = 8.5 + Math.min(3, sp * 0.12), yuk = 3.8 + Math.min(1.5, sp * 0.05);
        cx = h.x - Math.cos(kam.yaw) * geri; cz = h.z - Math.sin(kam.yaw) * geri; cy = h.y + yuk;
        hx = h.x + Math.cos(kam.yaw) * 5; hz = h.z + Math.sin(kam.yaw) * 5; hy = h.y + 1.2;
        kam.sonTakip = { cx, cy, cz };
      } else { const s = kam.sonTakip || { cx: kam.x, cy: kam.y, cz: kam.z }; cx = s.cx; cy = s.cy; cz = s.cz; hx = h.x; hy = h.y; hz = h.z; }
      hiz = 9;
    } else {
      const D = kam.uzak / kam.yakin;
      hx = kam.odak.x + kam.kayX; hy = kam.odak.y; hz = kam.odak.z + kam.kayZ;
      cx = hx + D * Math.cos(kam.gPitch) * Math.cos(kam.gYaw); cy = hy + D * Math.sin(kam.gPitch); cz = hz + D * Math.cos(kam.gPitch) * Math.sin(kam.gYaw);
    }
    const k = kam.ani ? 1 : 1 - Math.exp(-dt * hiz); kam.ani = false;
    if (![kam.x, kam.y, kam.z, kam.hx, kam.hy, kam.hz].every(Number.isFinite)) Object.assign(kam, { x: cx, y: cy, z: cz, hx, hy, hz });
    kam.x += (cx - kam.x) * k; kam.y += (cy - kam.y) * k; kam.z += (cz - kam.z) * k;
    kam.hx += (hx - kam.hx) * k; kam.hy += (hy - kam.hy) * k; kam.hz += (hz - kam.hz) * k;
    // kamera yolun içine girmesin (alttan bakmasın)
    if (kam.mod === 'takip' && sonDunya) { const zm = Dunya.zemin(sonDunya, kam.x, kam.z, kam.y); if (zm && kam.y < zm.h + 1.5) kam.y = zm.h + 1.5; }
    const s = kam.sars; kam.sars = Math.max(0, kam.sars - dt * 2.2);
    camera.position.set(kam.x + rnd(-1, 1) * s, kam.y + rnd(-1, 1) * s, kam.z + rnd(-1, 1) * s);
    camera.lookAt(kam.hx, kam.hy, kam.hz);
    const gx = kam.mod === 'takip' ? kam.hx : kam.hx, gz = kam.mod === 'takip' ? kam.hz : kam.hz;
    gunes.position.set(gx + 40, kam.hy + 80, gz + 30); gunes.target.position.set(gx, kam.hy, gz);
    const golgeAlan = kam.mod === 'takip' ? 40 : Math.min(140, kam.uzak / kam.yakin * 0.8);
    if (gunes.shadow.camera.right !== golgeAlan) { Object.assign(gunes.shadow.camera, { left: -golgeAlan, right: golgeAlan, top: golgeAlan, bottom: -golgeAlan }); gunes.shadow.camera.updateProjectionMatrix(); }
    if (ortamG?.userData.gok) ortamG.userData.gok.position.copy(camera.position);
  }
  // Ekrandaki noktanın yolda denk geldiği yer
  const isin = new THREE.Raycaster();
  function ekrandanYola(px, py) {
    isin.setFromCamera({ x: px / innerWidth * 2 - 1, y: -(py / innerHeight) * 2 + 1 }, camera);
    const vur = isin.intersectObjects(yolMeshler, false)[0];
    return vur ? { x: vur.point.x, y: vur.point.y, z: vur.point.z } : null;
  }
  // Ekranda sürükleme → yerde kaydırma miktarı
  function ekranKaydirma(dxPx, dyPx) {
    const D = kam.uzak / kam.yakin, olcek = D * Math.tan(camera.fov * Math.PI / 360) * 2 / innerHeight;
    const fx = -Math.cos(kam.gYaw), fz = -Math.sin(kam.gYaw), sx = -fz, sz = fx;   // ileri ve sağ (yerde)
    return { dx: -sx * dxPx * olcek + fx * dyPx * olcek * 1.25, dz: -sz * dxPx * olcek + fz * dyPx * olcek * 1.25 };
  }

  // ---------- Kart resimleri ----------
  let kartR = null, kartSahne = null, kartKam = null;
  const kartOnbellek = new Map();
  function simgeYap(tur) {   // haritaya konmayan kartlar için küçük 3D simgeler
    const g = new THREE.Group();
    if (tur === 'kalkan') {
      const s = new THREE.Shape(); s.moveTo(0, 1.4); s.quadraticCurveTo(1.2, 1.3, 1.25, 0.9); s.quadraticCurveTo(1.2, -0.6, 0, -1.4); s.quadraticCurveTo(-1.2, -0.6, -1.25, 0.9); s.quadraticCurveTo(-1.2, 1.3, 0, 1.4);
      const m = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: true, bevelSize: 0.12, bevelThickness: 0.12 }), mat(0x2a8ae8, { m: 0.5, p: 0.3, e: 0x1a4a9a, ei: 0.4 }));
      m.position.y = 1.6; g.add(m);
      const ic = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: false }), mat(0xe8eef8, { m: 0.6, p: 0.3 })); ic.scale.setScalar(0.55); ic.position.set(0, 1.6, 0.45); g.add(ic);
    } else if (tur === 'nitro') {
      const sise = silindir(0.6, 0.6, 2, mat(0x2a6ad8, { m: 0.7, p: 0.25 }), 20); sise.position.y = 1.2; sise.rotation.z = -0.5; g.add(sise);
      const bas = silindir(0.25, 0.4, 0.5, mat(0xc8ccd4, { m: 0.9, p: 0.2 }), 14); bas.position.set(0.62, 2.35, 0); bas.rotation.z = -0.5; g.add(bas);
      const alev = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.8, 14), new THREE.MeshBasicMaterial({ color: 0x5ab0ff })); alev.position.set(-0.8, 0.0, 0); alev.rotation.z = -0.5 + Math.PI; g.add(alev);
      const alev2 = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.2, 12), new THREE.MeshBasicMaterial({ color: 0xffe06a })); alev2.position.set(-0.7, 0.2, 0.1); alev2.rotation.z = -0.5 + Math.PI; g.add(alev2);
    } else if (tur === 'silgi') {
      const m = mat(0xc8ccd4, { m: 0.9, p: 0.25 });
      const sap = kutu(0.45, 3, 0.25, m, 0, 1.5, 0); sap.rotation.z = 0.6; g.add(sap);
      const bas = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.22, 10, 20, Math.PI * 1.5), m); bas.position.set(-0.9, 2.8, 0); bas.rotation.z = 1.2; g.add(bas);
      const tut = kutu(0.5, 1.2, 0.3, mat(0xe8413a, { p: 0.5 }), 0.75, 0.45, 0); tut.rotation.z = 0.6; g.add(tut);
    } else if (tur === 'bomba') {
      const top = new THREE.Mesh(new THREE.SphereGeometry(1.2, 24, 18), mat(0x1a1a20, { m: 0.6, p: 0.35 })); top.position.y = 1.3; g.add(top);
      const ag = silindir(0.35, 0.35, 0.4, mat(0x888888, { m: 0.8 }), 12); ag.position.y = 2.55; g.add(ag);
      const fitil = silindir(0.06, 0.06, 0.7, mat(0xc8a070), 6); fitil.position.set(0.2, 2.95, 0); fitil.rotation.z = -0.5; g.add(fitil);
      const k = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd040 })); k.position.set(0.42, 3.3, 0); g.add(k);
    }
    return g;
  }
  function kartResmi(tip, tur) {
    const anahtar = tip + ':' + tur;
    if (kartOnbellek.has(anahtar)) return kartOnbellek.get(anahtar);
    if (!kartR) {
      kartR = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      kartR.setSize(256, 256); kartR.setPixelRatio(1);
      kartR.outputColorSpace = THREE.SRGBColorSpace; kartR.toneMapping = THREE.ACESFilmicToneMapping;
      kartSahne = new THREE.Scene();
      kartSahne.add(new THREE.HemisphereLight(0xffffff, 0x8a8a7a, 1.6));
      const gl = new THREE.DirectionalLight(0xffffff, 2.2); gl.position.set(5, 10, 7); kartSahne.add(gl);
      kartKam = new THREE.PerspectiveCamera(32, 1, 0.1, 500);
    }
    const g = new THREE.Group(); kartSahne.add(g);
    if (tip === 'yol') {
      const Y = Dunya.yolKur([tur]);
      const C = Y.cizgi.map(p => ({ ...p }));
      const ic = new THREE.Group(); g.add(ic);
      const yMin = Math.min(...C.filter(p => p.si === 1).map(p => p.y));
      segmentCiz(ic, C, 1, yMin - 2.5, null);
      // giriş oku
      const p0 = C.find(p => p.si === 1);
      const ok = new THREE.Mesh(new THREE.ConeGeometry(1.4, 2.6, 3), new THREE.MeshBasicMaterial({ color: 0x3ae86a }));
      ok.rotation.set(0, 0, -Math.PI / 2); ok.position.set(p0.x - 2.2, p0.y + 0.3, p0.z); ic.add(ok);
      ic.rotation.y = Math.PI / 2;   // pist aşağıdan yukarı doğru gitsin
    } else {
      const T = Dunya.TURLER[tur];
      if (T.kisisel || tur === 'silgi' || tur === 'bomba') g.add(simgeYap(tur));
      else {
        const o = parcaYap({ tur, x: 0, y: 0, z: 0, r: 0, id: 'kart' + tur });
        if (o.anim) o.anim(0.7);
        g.add(o.g);
        const zemin = kutu(tur === 'cekic' ? 9 : 7, 0.3, 7, yolMalzeme().asfalt, 0, -0.16, 0, false); g.add(zemin);
      }
      g.rotation.y = 0.5;
    }
    if (tip === 'yol' && (Dunya.YOLLAR[tur].seg || []).some(s => s.dalga || s.kasis)) g.scale.y = 2.6;   // tümsekler kartta belli olsun
    // çerçevele
    const kutuB = new THREE.Box3().setFromObject(g), boy = new THREE.Vector3(), merkez = new THREE.Vector3();
    kutuB.getSize(boy); kutuB.getCenter(merkez);
    const r = Math.max(boy.x, boy.y, boy.z) * 0.62;
    const D = r / Math.tan(kartKam.fov * Math.PI / 360) * 1.05;
    const tumsekli = tip === 'yol' && (Dunya.YOLLAR[tur].seg || []).some(s => s.dalga || s.kasis);
    const yon = tip === 'yol' ? (tumsekli ? new THREE.Vector3(0.55, 0.38, 0.75).normalize() : new THREE.Vector3(0, 0.85, 0.53).normalize()) : new THREE.Vector3(0.15, 0.5, 0.85).normalize();
    kartKam.position.copy(merkez).addScaledVector(yon, D); kartKam.lookAt(merkez);
    kartR.render(kartSahne, kartKam);
    const url = kartR.domElement.toDataURL('image/png');
    kartSahne.remove(g);
    kartOnbellek.set(anahtar, url);
    return url;
  }

  // ---------- Kare ----------
  function ciz(dt, oyunT) {
    zaman += dt;
    for (let i = animasyonlar.length - 1; i >= 0; i--) {
      const a = animasyonlar[i];
      a.bas ??= zaman - dt;
      const k = Math.min(1, (zaman - a.bas) / Math.max(0.001, a.son - a.bas));
      a.f(k);
      if (k >= 1) { animasyonlar.splice(i, 1); a.bitis && a.bitis(); }
    }
    parcaG.forEach(o => o.anim && o.anim(oyunT));
    imlecler.forEach(o => { const k = 1 - Math.exp(-dt * 12); o.x += (o.hx - o.x) * k; o.y += (o.hy - o.y) * k; o.z += (o.hz - o.z) * k; o.g.position.set(o.x, o.y + 0.08, o.z); if (o.ic) o.ic.g.rotation.y = -o.hr; o.ok.position.y = 4.6 + Math.sin(zaman * 4) * 0.4; });
    if (bayrakMesh) { const p = bayrakMesh.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i) + 1.2; p.setZ(i, Math.sin(x * 3 - zaman * 6) * 0.15 * x); } p.needsUpdate = true; }
    parcacikGuncelle(dt);
    if (Math.abs(camera.aspect - innerWidth / Math.max(1, innerHeight)) > 0.01 && innerHeight > 0) boyutla();
    kameraGuncelle(dt);
    renderer.render(scene, camera);
  }

  return {
    RENKLER, RENK_AD, kur, ortamKur, yolGuncelle, yolKutusu, parcaEkle, parcaSil, parcalariTemizle, mayinDurum, yayBas, hayaletAyarla, vurgula, imlecAyarla, imlecleriTemizle,
    arabaYap, arabaGuncelle, arabaSil, etiketYap, dunyaAyarla, toz, kivilcim, poof, patlama, konfeti, halkaEfekt, sarsinti, parcacik,
    kartResmi, yolHayalet, kameraDondur, kameraGenel, kameraPistiGoster, kameraKaydir, kameraYakinlas, kameraTakip, ekrandanYola, ekranKaydirma, ciz,
    get scene() { return scene; }, get camera() { return camera; },
  };
})();
