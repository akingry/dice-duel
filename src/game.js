// KCD2 Dice Duel — standalone build. THREE is provided globally by the build (see build_standalone.py).
'use strict';

const WIN_SCORE = 5000;
const DICE_COUNT = 6;
const DIE_REST_Y = 0.5;
const BOARD_RADIUS = 5.0;

const $ = (sel) => document.querySelector(sel);
const canvas = $('#gameCanvas');
const tableWrap = $('#tableWrap');
const banner = $('#banner');
const stamp = $('#stamp');
const turnRibbon = $('#turnRibbon');
const turnPouch = $('#turnPouch');
const turnPouchLabel = $('#turnPouchLabel');
const turnScoreEl = $('#turnScore');
const logEl = $('#log');
const $$ = (sel) => [...document.querySelectorAll(sel)];
const playerTotalEls = $$('.js-my-total');
const aiTotalEls = $$('.js-opp-total');
const playerBars = $$('.js-my-bar');
const aiBars = $$('.js-opp-bar');
const aiNameEls = $$('.js-opp-name');
const hud = $('#scores');
const controlsEl = $('#controls');
const netBadge = $('#netBadge');
const lobby = $('#lobby');
const lobbyStatus = $('#lobbyStatus');
const roomInput = $('#roomInput');
const joinBtn = $('#joinBtn');
const playAiBtn = $('#playAiBtn');
const cancelJoinBtn = $('#cancelJoinBtn');
const menuBtn = $('#menuBtn');
const sheetBtn = $('#sheetBtn');
const sheetCloseBtn = $('#sheetCloseBtn');
const endMenuBtn = $('#endMenuBtn');
const myChip = $('#myChip');
const oppChip = $('#oppChip');
const promptBar = $('#promptBar');
const pickModal = $('#pickModal');
const pickTitle = $('#pickTitle');
const pickSub = $('#pickSub');
const pickGrid = $('#pickGrid');
const pickWait = $('#pickWait');
const tokenKeyBody = $('#tokenKeyBody');
const playerRow = $('#playerRow');
const aiRow = $('#aiRow');
const selectedScoreEl = $('#selectedScore');
const bankedThisTurnEl = $('#bankedThisTurn');
const rollBtn = $('#rollBtn');
const continueBtn = $('#continueBtn');
const passBtn = $('#passBtn');
const newGameBtn = $('#newGameBtn');
const soundBtn = $('#soundBtn');
const scoringKey = $('#scoringKey');
const endModal = $('#endModal');
const endTitle = $('#endTitle');
const endText = $('#endText');
const endAgainBtn = $('#endAgainBtn');
const popupLayer = $('#popupLayer');

let scene, camera, renderer, raycaster, pointer, clock;
let candleLight, flameSprite, flameCore, dust;
let dice = [];
let game;
let hoveredIdx = -1;
let audioCtx = null;
let noiseBuffer = null;
let soundOn = storageGet('kcd2DiceSound', 'true') !== 'false';
const coinStacks = { mine: null, theirs: null };
let mode = 'ai';        // 'ai' | 'online' | 'offline' (online game that lost its opponent)
let role = null;        // 'host' | 'guest' when online
let mySeat = 'player';  // the seat this screen plays; seats are 'player' (host / you vs AI) and 'ai'
let animating = 0;
let guestReady = false;
const IS_MOBILE = matchMedia('(pointer: coarse)').matches || Math.min(screen.width, screen.height) < 700;
let coinGeometry, coinMaterial;
let gameToken = 0; // invalidates async turn loops when a new game starts

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const rand = (min, max) => min + Math.random() * (max - min);
const rollD6 = () => Math.floor(Math.random() * 6) + 1;
const fmt = (n) => Number(n).toLocaleString('en-US');

function storageGet(key, fallback) {
  try { const v = localStorage.getItem(key); return v === null ? fallback : v; } catch { return fallback; }
}
function storageSet(key, value) {
  try { localStorage.setItem(key, value); } catch { /* storage is optional */ }
}

const BUST_WORDS = [
  'AIEEE!', 'AIIEEE!', 'ARRGH!', 'AWK!', 'AWKKKKKK!', 'BAM!', 'BANG!',
  'BIFF!', 'BLOOP!', 'BLURP!', 'BOFF!', 'BONK!', 'CLANK!', 'CLANK-EST!', 'CLASH!',
  'CLUNK!', 'CRRAACK!', 'CRASH!', 'CRRAACK!', 'CRUNCH!',
  'EEE-YOW!', 'FLRBBBBB!', 'GLIPP!', 'GLURPP!', 'KAPOW!', 'KAYO!', 'KER-SPLOOSH!',
  'KERPLOP!', 'KLONK!', 'KLUNK!', 'KRUNCH!', 'OOOFF!', 'OOOOFF!', 'OUCH!',
  'OWWW!', 'PAM!', 'PLOP!', 'POW!', 'POWIE!', 'QUNCKKK!', 'RAKKK!', 'RIP!',
  'SLOSH!', 'SOCK!', 'SPLATS!', 'SPLATT!', 'SPLOOSH!', 'SWAAP!', 'SWISH!', 'SWOOSH!',
  'THUNK!', 'THWACK!', 'THWACKE!', 'THWAPE!', 'THWAPP!', 'UGGH!', 'URKKK!', 'VRONK!',
  'WHACK!', 'WHAMM!', 'WHAMMM!', 'WHAP!', 'Z-ZWAP!', 'ZAM!',
  'ZAMM!', 'ZAMMM!', 'ZAP!', 'ZGRUPPP!', 'ZLONK!', 'ZLOPP!', 'ZLOTT!', 'ZOK!',
  'ZOWIE!', 'ZWAPP!', 'ZZWAP!', 'ZZZZWAP!', 'ZZZZZWAP!'
];

// Box face order: +x, -x, +y, -y, +z, -z.
const VALUES_BY_FACE = [4, 3, 1, 6, 2, 5];
const faceQuats = {};
[
  [1, new THREE.Euler(0, 0, 0)],
  [2, new THREE.Euler(-Math.PI / 2, 0, 0)],
  [3, new THREE.Euler(0, 0, -Math.PI / 2)],
  [4, new THREE.Euler(0, 0, Math.PI / 2)],
  [5, new THREE.Euler(Math.PI / 2, 0, 0)],
  [6, new THREE.Euler(Math.PI, 0, 0)]
].forEach(([v, e]) => { faceQuats[v] = new THREE.Quaternion().setFromEuler(e); });

const Y_AXIS = new THREE.Vector3(0, 1, 0);
function restQuat(value, yaw = rand(-0.5, 0.5)) {
  return new THREE.Quaternion().setFromAxisAngle(Y_AXIS, yaw).multiply(faceQuats[value]);
}

/* ------------------------------------------------------------------ */
/* Scene                                                               */
/* ------------------------------------------------------------------ */

function init3D() {
  clock = new THREE.Clock();
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0604);
  scene.fog = new THREE.Fog(0x0a0604, 15, 30);

  camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, IS_MOBILE ? 1.75 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene.environment = buildEnvironment();
  scene.environmentIntensity = 0.35;

  raycaster = new THREE.Raycaster();
  pointer = new THREE.Vector2();

  // Lighting: dim warm fill, a cool "window" key, and a flickering candle.
  scene.add(new THREE.HemisphereLight(0xffd9a8, 0x1a0f08, 0.55));

  const key = new THREE.DirectionalLight(0xffe2bd, 1.6);
  key.position.set(-4, 11, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(IS_MOBILE ? 1024 : 2048, IS_MOBILE ? 1024 : 2048);
  key.shadow.camera.left = -8; key.shadow.camera.right = 8;
  key.shadow.camera.top = 8; key.shadow.camera.bottom = -8;
  key.shadow.camera.near = 1; key.shadow.camera.far = 30;
  key.shadow.bias = -0.0004;
  key.shadow.radius = 4;
  scene.add(key);

  const back = new THREE.DirectionalLight(0x7fa0d8, 0.35);
  back.position.set(6, 5, -8);
  scene.add(back);

  const spot = new THREE.SpotLight(0xffd59a, 26, 22, Math.PI / 5.5, 0.55, 1.6);
  spot.position.set(0, 12, 1.5);
  spot.target.position.set(0, 0, 0);
  scene.add(spot, spot.target);

  buildTable();
  buildBoard();
  buildCandle(new THREE.Vector3(-6.4, -0.12, -2.6));
  buildTankard(new THREE.Vector3(6.5, -0.12, -2.6));
  buildDust();

  coinGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.065, 32);
  coinMaterial = [
    new THREE.MeshStandardMaterial({ color: 0xc9953a, metalness: 0.95, roughness: 0.38 }),
    new THREE.MeshStandardMaterial({ map: makeCoinTexture(), metalness: 0.9, roughness: 0.32 }),
    new THREE.MeshStandardMaterial({ map: makeCoinTexture(), metalness: 0.9, roughness: 0.32 })
  ];
  coinStacks.mine = new THREE.Group();
  coinStacks.mine.position.set(5.9, -0.12, 2.6);
  coinStacks.theirs = new THREE.Group();
  coinStacks.theirs.position.set(-5.9, -0.12, 2.4);
  scene.add(coinStacks.mine, coinStacks.theirs);

  const dieGeometry = makeRoundedBox(1, 0.13, 6);
  const dieMaterials = createDieMaterials();
  const ringGeo = new THREE.RingGeometry(0.66, 0.84, 64);
  for (let i = 0; i < DICE_COUNT; i++) {
    const mesh = new THREE.Mesh(dieGeometry, dieMaterials.map(m => m.clone()));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.index = i;
    scene.add(mesh);

    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
      color: 0xffc95a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.012;
    scene.add(ring);

    dice.push({
      mesh, ring, value: 1, held: false, selected: false, anim: null,
      rest: new THREE.Vector3(), lift: 0, glow: 0
    });
  }

  resize();
}

function buildEnvironment() {
  // A tiny warm "room" baked into a PMREM so metals (coins, tankard) have something to reflect.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(20, 20, 20), new THREE.MeshBasicMaterial({ color: 0x1c120b, side: THREE.BackSide })));
  const glow = (color, w, h, pos) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    m.position.copy(pos); m.lookAt(0, 0, 0); env.add(m);
  };
  glow(0xffc27a, 6, 6, new THREE.Vector3(0, 9, 0));
  glow(0xff9a40, 3, 5, new THREE.Vector3(-9, 2, 3));
  glow(0x8fb0ff, 4, 6, new THREE.Vector3(9, 3, -4));
  const tex = pmrem.fromScene(env, 0.04).texture;
  pmrem.dispose();
  return tex;
}

function buildTable() {
  const wood = makeWoodTexture();
  wood.wrapS = wood.wrapT = THREE.RepeatWrapping;
  wood.repeat.set(2, 1.4);
  const table = new THREE.Mesh(
    new THREE.BoxGeometry(30, 0.6, 20),
    new THREE.MeshStandardMaterial({ map: wood, bumpMap: wood, bumpScale: 1.2, roughness: 0.78, metalness: 0 })
  );
  table.position.y = -0.42;
  table.receiveShadow = true;
  scene.add(table);
}

function buildBoard() {
  const leather = makeLeatherTexture();
  const sideMat = new THREE.MeshStandardMaterial({ color: 0x3a1d10, roughness: 0.7 });
  const topMat = new THREE.MeshStandardMaterial({ map: leather, bumpMap: leather, bumpScale: 0.6, roughness: 0.86, metalness: 0.02 });
  const board = new THREE.Mesh(new THREE.CylinderGeometry(BOARD_RADIUS, BOARD_RADIUS, 0.12, 128), [sideMat, topMat, sideMat]);
  board.position.y = -0.06;
  board.receiveShadow = true;
  scene.add(board);

  const rimWood = makeWoodTexture(true);
  rimWood.wrapS = rimWood.wrapT = THREE.RepeatWrapping;
  rimWood.repeat.set(6, 0.5);
  const rimMat = new THREE.MeshStandardMaterial({ map: rimWood, color: 0x9a6a44, roughness: 0.45, metalness: 0.02 });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(BOARD_RADIUS + 0.12, 0.24, 24, 160), rimMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.02;
  rim.castShadow = true;
  rim.receiveShadow = true;
  scene.add(rim);

  // Brass studs on the rim.
  const studGeo = new THREE.SphereGeometry(0.075, 16, 12);
  const studMat = new THREE.MeshStandardMaterial({ color: 0xd4a24c, metalness: 1, roughness: 0.3 });
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const s = new THREE.Mesh(studGeo, studMat);
    s.position.set(Math.cos(a) * (BOARD_RADIUS + 0.12), 0.25, Math.sin(a) * (BOARD_RADIUS + 0.12));
    scene.add(s);
  }
}

function buildCandle(pos) {
  const group = new THREE.Group();
  group.position.copy(pos);

  const dishMat = new THREE.MeshStandardMaterial({ color: 0x8b6a3e, metalness: 0.85, roughness: 0.42 });
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.62, 0.1, 48), dishMat);
  dish.position.y = -0.07;
  dish.castShadow = dish.receiveShadow = true;
  const holder = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.24, 32), dishMat);
  holder.position.y = 0.08;
  holder.castShadow = true;

  const waxPts = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    waxPts.push(new THREE.Vector2(0.22 + Math.sin(t * 9) * 0.012 + (t > 0.92 ? -0.05 * (t - 0.92) / 0.08 : 0), t * 1.6));
  }
  waxPts.push(new THREE.Vector2(0.0, 1.57));
  const wax = new THREE.Mesh(
    new THREE.LatheGeometry(waxPts, 40),
    new THREE.MeshStandardMaterial({ color: 0xf1e2bf, roughness: 0.55, emissive: 0x5a3010, emissiveIntensity: 0.25 })
  );
  wax.position.y = 0.18;
  wax.castShadow = true;

  const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.12, 6), new THREE.MeshBasicMaterial({ color: 0x1a1008 }));
  wick.position.y = 1.8;

  const flameTex = makeGlowTexture();
  flameSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, color: 0xffa040, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  flameSprite.scale.set(1.6, 1.6, 1);
  flameSprite.position.y = 1.92;
  flameCore = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeFlameTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  flameCore.scale.set(0.16, 0.36, 1);
  flameCore.position.y = 1.96;

  candleLight = new THREE.PointLight(0xff9a3c, 14, 16, 1.6);
  candleLight.position.set(0, 2.1, 0);
  candleLight.castShadow = !IS_MOBILE;
  candleLight.shadow.mapSize.set(1024, 1024);
  candleLight.shadow.bias = -0.002;
  candleLight.shadow.radius = 6;

  group.add(dish, holder, wax, wick, flameSprite, flameCore, candleLight);
  scene.add(group);
}

function buildTankard(pos) {
  const group = new THREE.Group();
  group.position.copy(pos);
  group.rotation.y = -0.6;
  const pewter = new THREE.MeshStandardMaterial({ color: 0x9aa0a4, metalness: 0.9, roughness: 0.4 });
  const woodTex = makeWoodTexture(true);
  woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping;
  woodTex.repeat.set(3, 1);
  woodTex.rotation = Math.PI / 2;
  const staves = new THREE.MeshStandardMaterial({ map: woodTex, color: 0xb88a5c, roughness: 0.6 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.7, 1.5, 40, 1, true), staves);
  body.position.y = 0.75;
  body.castShadow = body.receiveShadow = true;
  const inside = new THREE.Mesh(new THREE.CircleGeometry(0.6, 40), new THREE.MeshStandardMaterial({ color: 0x3b1f08, roughness: 0.15, metalness: 0.1 }));
  inside.rotation.x = -Math.PI / 2;
  inside.position.y = 1.3;
  const bandGeo = new THREE.TorusGeometry(0.67, 0.045, 10, 48);
  [0.18, 0.75, 1.36].forEach((y, i) => {
    const b = new THREE.Mesh(bandGeo, pewter);
    b.rotation.x = Math.PI / 2;
    b.position.y = y;
    b.scale.setScalar(i === 2 ? 0.94 : (i === 0 ? 1.04 : 1));
    b.castShadow = true;
    group.add(b);
  });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.72, 0.06, 40), staves);
  base.position.y = 0.03;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.08, 12, 32, Math.PI * 1.2), pewter);
  handle.position.set(0.72, 0.8, 0);
  handle.rotation.z = -Math.PI * 0.6;
  handle.castShadow = true;
  group.add(body, inside, base, handle);
  scene.add(group);
}

function buildDust() {
  const count = IS_MOBILE ? 120 : 260;
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = rand(-9, 9);
    pos[i * 3 + 1] = rand(0.3, 7);
    pos[i * 3 + 2] = rand(-6, 6);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  dust = new THREE.Points(geo, new THREE.PointsMaterial({
    map: makeGlowTexture(), color: 0xffcf8a, size: 0.07, transparent: true, opacity: 0.45,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  scene.add(dust);
}

/* ------------------------------------------------------------------ */
/* Procedural geometry & textures                                      */
/* ------------------------------------------------------------------ */

function makeRoundedBox(size, radius, segments) {
  const geo = new THREE.BoxGeometry(size, size, size, segments, segments, segments);
  const p = geo.attributes.position;
  const h = size / 2;
  const inner = h - radius;
  const v = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    c.set(
      THREE.MathUtils.clamp(v.x, -inner, inner),
      THREE.MathUtils.clamp(v.y, -inner, inner),
      THREE.MathUtils.clamp(v.z, -inner, inner)
    );
    const d = v.clone().sub(c);
    if (d.lengthSq() > 1e-10) {
      d.normalize().multiplyScalar(radius);
      v.copy(c).add(d);
    }
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

function canvas2d(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function finishTexture(cnv, srgb = true) {
  const t = new THREE.CanvasTexture(cnv);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer ? renderer.capabilities.getMaxAnisotropy() : 8;
  return t;
}

function createDieMaterials() {
  return VALUES_BY_FACE.map(value => {
    const { color, bump } = makeDieFaceTextures(value);
    return new THREE.MeshStandardMaterial({
      map: color,
      bumpMap: bump,
      bumpScale: 2.2,
      roughness: 0.42,
      metalness: 0,
      emissive: new THREE.Color(0x000000)
    });
  });
}

function makeDieFaceTextures(value) {
  const size = 512;
  const [cnv, ctx] = canvas2d(size);
  const [bcnv, bctx] = canvas2d(size);

  // Aged bone / ivory base with gentle radial falloff.
  const g = ctx.createRadialGradient(size * 0.38, size * 0.34, 20, size / 2, size / 2, size * 0.75);
  g.addColorStop(0, '#f8efda');
  g.addColorStop(0.6, '#eadbbd');
  g.addColorStop(1, '#cdb58d');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  // Fine grain streaks.
  for (let i = 0; i < 90; i++) {
    ctx.strokeStyle = `rgba(${120 + Math.random() * 40}, ${90 + Math.random() * 30}, 50, ${rand(0.03, 0.08)})`;
    ctx.lineWidth = rand(0.6, 2.2);
    ctx.beginPath();
    const y = rand(0, size);
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(size * 0.3, y + rand(-20, 20), size * 0.7, y + rand(-20, 20), size, y + rand(-15, 15));
    ctx.stroke();
  }
  // Speckle.
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(90, 60, 30, ${rand(0.02, 0.07)})`;
    ctx.fillRect(rand(0, size), rand(0, size), rand(1, 2.5), rand(1, 2.5));
  }
  // Edge grime.
  const eg = ctx.createRadialGradient(size / 2, size / 2, size * 0.36, size / 2, size / 2, size * 0.72);
  eg.addColorStop(0, 'rgba(80, 50, 20, 0)');
  eg.addColorStop(1, 'rgba(80, 50, 20, 0.28)');
  ctx.fillStyle = eg;
  ctx.fillRect(0, 0, size, size);

  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, size, size);

  const s = size / 256;
  const spots = {
    1: [[128, 128]],
    2: [[80, 80], [176, 176]],
    3: [[80, 80], [128, 128], [176, 176]],
    4: [[80, 80], [176, 80], [80, 176], [176, 176]],
    5: [[80, 80], [176, 80], [128, 128], [80, 176], [176, 176]],
    6: [[80, 72], [176, 72], [80, 128], [176, 128], [80, 184], [176, 184]]
  }[value];
  const r = (value === 1 ? 27 : 19) * s;

  for (const [x0, y0] of spots) {
    const x = x0 * s, y = y0 * s;
    // Drilled pip: dark well, light catch on lower rim, inner shadow at top.
    ctx.fillStyle = 'rgba(255, 248, 230, 0.55)';
    ctx.beginPath(); ctx.arc(x + 1.5 * s, y + 2 * s, r + 2 * s, 0, Math.PI * 2); ctx.fill();
    const pg = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
    if (value === 1) {
      pg.addColorStop(0, '#9a2a1c');
      pg.addColorStop(0.7, '#5c1208');
      pg.addColorStop(1, '#2a0603');
    } else {
      pg.addColorStop(0, '#3a2a1c');
      pg.addColorStop(0.7, '#1a120a');
      pg.addColorStop(1, '#070403');
    }
    ctx.fillStyle = pg;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();

    const bg = bctx.createRadialGradient(x, y, 0, x, y, r * 1.15);
    bg.addColorStop(0, '#101010');
    bg.addColorStop(0.75, '#202020');
    bg.addColorStop(1, '#808080');
    bctx.fillStyle = bg;
    bctx.beginPath(); bctx.arc(x, y, r * 1.15, 0, Math.PI * 2); bctx.fill();
  }
  // Tiny surface noise in bump.
  for (let i = 0; i < 1400; i++) {
    bctx.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)';
    bctx.fillRect(rand(0, size), rand(0, size), 2, 2);
  }

  return { color: finishTexture(cnv), bump: finishTexture(bcnv, false) };
}

function makeWoodTexture(fine = false) {
  const w = 1024, h = 1024;
  const [cnv, ctx] = canvas2d(w, h);
  const planks = fine ? 1 : 6;
  const ph = h / planks;
  for (let p = 0; p < planks; p++) {
    const y0 = p * ph;
    const base = [rand(70, 95), rand(40, 55), rand(22, 32)];
    ctx.fillStyle = `rgb(${base[0]}, ${base[1]}, ${base[2]})`;
    ctx.fillRect(0, y0, w, ph);
    // Grain lines.
    const lines = fine ? 160 : 70;
    for (let i = 0; i < lines; i++) {
      const yy = y0 + rand(0, ph);
      const amp = rand(2, 10);
      const freq = rand(0.002, 0.008);
      const phase = rand(0, 10);
      const dark = Math.random() < 0.6;
      ctx.strokeStyle = dark ? `rgba(25, 12, 5, ${rand(0.08, 0.28)})` : `rgba(170, 120, 75, ${rand(0.05, 0.16)})`;
      ctx.lineWidth = rand(0.8, 3.2);
      ctx.beginPath();
      for (let x = 0; x <= w; x += 16) {
        const y = yy + Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 3.1 + phase) * amp * 0.3;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    if (!fine) {
      // Knots.
      for (let k = 0; k < (Math.random() < 0.6 ? 1 : 0); k++) {
        const kx = rand(80, w - 80), ky = y0 + rand(ph * 0.3, ph * 0.7);
        for (let r = 22; r > 2; r -= 3) {
          ctx.strokeStyle = `rgba(30, 14, 6, ${0.12 + (22 - r) * 0.015})`;
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.ellipse(kx, ky, r * 2.2, r, 0, 0, Math.PI * 2); ctx.stroke();
        }
      }
      // Plank seam + wear.
      ctx.fillStyle = 'rgba(10, 5, 2, 0.85)';
      ctx.fillRect(0, y0, w, 3);
      ctx.fillStyle = 'rgba(255, 220, 170, 0.05)';
      ctx.fillRect(0, y0 + 3, w, 2);
      // Nails.
      for (const nx of [40, w - 40]) {
        ctx.fillStyle = 'rgba(20, 14, 10, 0.9)';
        ctx.beginPath(); ctx.arc(nx, y0 + ph / 2, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(150, 130, 110, 0.35)';
        ctx.beginPath(); ctx.arc(nx - 1.5, y0 + ph / 2 - 1.5, 2.5, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  // Stains and scratches.
  for (let i = 0; i < (fine ? 0 : 14); i++) {
    const x = rand(0, w), y = rand(0, h), r = rand(30, 120);
    const sg = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
    sg.addColorStop(0, 'rgba(20, 8, 2, 0.16)');
    sg.addColorStop(1, 'rgba(20, 8, 2, 0)');
    ctx.fillStyle = sg;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < (fine ? 20 : 120); i++) {
    ctx.strokeStyle = `rgba(200, 160, 120, ${rand(0.03, 0.1)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const x = rand(0, w), y = rand(0, h), a = rand(-0.4, 0.4), l = rand(10, 60);
    ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
  return finishTexture(cnv);
}

function makeLeatherTexture() {
  const px = IS_MOBILE ? 1024 : 2048;
  const [cnv, ctx] = canvas2d(px);
  ctx.scale(px / 2048, px / 2048);
  const size = 2048;
  const c = size / 2;
  const bg = ctx.createRadialGradient(c, c, 0, c, c, c);
  bg.addColorStop(0, '#5d2416');
  bg.addColorStop(0.7, '#4a1b10');
  bg.addColorStop(1, '#2c0f08');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  // Pebbled grain.
  for (let i = 0; i < (IS_MOBILE ? 12000 : 26000); i++) {
    const x = rand(0, size), y = rand(0, size);
    ctx.fillStyle = Math.random() < 0.5 ? `rgba(0,0,0,${rand(0.04, 0.12)})` : `rgba(255,190,150,${rand(0.015, 0.05)})`;
    ctx.beginPath(); ctx.arc(x, y, rand(1.5, 4.5), 0, Math.PI * 2); ctx.fill();
  }
  // Wear in the middle where dice land.
  const wear = ctx.createRadialGradient(c, c * 1.05, 0, c, c * 1.05, c * 0.6);
  wear.addColorStop(0, 'rgba(160, 90, 60, 0.16)');
  wear.addColorStop(1, 'rgba(160, 90, 60, 0)');
  ctx.fillStyle = wear;
  ctx.fillRect(0, 0, size, size);

  const ring = (r, width, color) => {
    ctx.strokeStyle = color; ctx.lineWidth = width;
    ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2); ctx.stroke();
  };
  // Tooled border: pressed lines and a gilt band.
  ring(c * 0.965, 6, 'rgba(15, 4, 2, 0.6)');
  ring(c * 0.935, 10, 'rgba(201, 150, 66, 0.75)');
  ring(c * 0.935, 2, 'rgba(255, 225, 150, 0.6)');
  ring(c * 0.905, 5, 'rgba(15, 4, 2, 0.55)');
  ring(c * 0.78, 4, 'rgba(15, 4, 2, 0.45)');
  ring(c * 0.765, 3, 'rgba(201, 150, 66, 0.45)');

  // Stamped motif band between rings.
  ctx.save();
  ctx.translate(c, c);
  const motifs = 36;
  for (let i = 0; i < motifs; i++) {
    ctx.save();
    ctx.rotate((i / motifs) * Math.PI * 2);
    ctx.translate(0, -c * 0.842);
    ctx.fillStyle = 'rgba(15, 4, 2, 0.5)';
    ctx.strokeStyle = 'rgba(201, 150, 66, 0.55)';
    ctx.lineWidth = 3;
    // fleur-ish lozenge
    ctx.beginPath();
    ctx.moveTo(0, -48); ctx.quadraticCurveTo(26, 0, 0, 48); ctx.quadraticCurveTo(-26, 0, 0, -48);
    ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(220, 170, 80, 0.6)'; ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.rotate(((i + 0.5) / motifs) * Math.PI * 2);
    ctx.translate(0, -c * 0.842);
    ctx.fillStyle = 'rgba(201, 150, 66, 0.45)';
    ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // Faint central rose.
  ctx.strokeStyle = 'rgba(15, 4, 2, 0.22)';
  ctx.lineWidth = 4;
  for (let i = 0; i < 8; i++) {
    ctx.save();
    ctx.rotate((i / 8) * Math.PI * 2);
    ctx.beginPath();
    ctx.ellipse(0, -c * 0.17, c * 0.06, c * 0.17, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  ctx.beginPath(); ctx.arc(0, 0, c * 0.36, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();

  return finishTexture(cnv);
}

function makeCoinTexture() {
  const size = 256;
  const [cnv, ctx] = canvas2d(size);
  const c = size / 2;
  const g = ctx.createRadialGradient(c * 0.8, c * 0.7, 10, c, c, c);
  g.addColorStop(0, '#ffe29a');
  g.addColorStop(0.7, '#d4a043');
  g.addColorStop(1, '#8a5c1c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(90, 55, 10, 0.8)';
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.arc(c, c, c * 0.84, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    ctx.fillStyle = 'rgba(90, 55, 10, 0.7)';
    ctx.beginPath(); ctx.arc(c + Math.cos(a) * c * 0.92, c + Math.sin(a) * c * 0.92, 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.font = `bold ${size * 0.42}px Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(110, 70, 15, 0.85)';
  ctx.fillText('G', c, c + 4);
  return finishTexture(cnv);
}

function makeGlowTexture() {
  const [cnv, ctx] = canvas2d(128);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255, 220, 160, 1)');
  g.addColorStop(0.2, 'rgba(255, 170, 80, 0.5)');
  g.addColorStop(0.5, 'rgba(255, 120, 40, 0.12)');
  g.addColorStop(1, 'rgba(255, 100, 30, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return finishTexture(cnv);
}

function makeFlameTexture() {
  const [cnv, ctx] = canvas2d(64, 128);
  const g = ctx.createRadialGradient(32, 92, 2, 32, 80, 60);
  g.addColorStop(0, 'rgba(255, 255, 240, 1)');
  g.addColorStop(0.25, 'rgba(255, 220, 120, 0.95)');
  g.addColorStop(0.6, 'rgba(255, 120, 30, 0.5)');
  g.addColorStop(1, 'rgba(255, 60, 0, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(32, 4);
  ctx.bezierCurveTo(52, 50, 60, 90, 32, 124);
  ctx.bezierCurveTo(4, 90, 12, 50, 32, 4);
  ctx.fill();
  return finishTexture(cnv);
}

/* ------------------------------------------------------------------ */
/* Layout helpers                                                      */
/* ------------------------------------------------------------------ */

function startLineup() {
  const out = [];
  for (let i = 0; i < DICE_COUNT; i++) out.push(new THREE.Vector3(-3.1 + i * 1.24, DIE_REST_Y, 0.6));
  return out;
}

function scatterPositions(count) {
  // Random non-overlapping spots in the open middle of the board.
  for (let attempt = 0; attempt < 60; attempt++) {
    const pts = [];
    let ok = true;
    for (let i = 0; i < count && ok; i++) {
      let placed = false;
      for (let t = 0; t < 80; t++) {
        const a = rand(0, Math.PI * 2);
        const r = Math.sqrt(Math.random()) * 2.7;
        const p = new THREE.Vector3(Math.cos(a) * r * 1.15, DIE_REST_Y, 0.55 + Math.sin(a) * r * 0.82);
        if (pts.every(q => q.distanceTo(p) > 1.45)) { pts.push(p); placed = true; break; }
      }
      ok = placed;
    }
    if (ok) return pts;
  }
  const spacing = 1.3;
  return Array.from({ length: count }, (_, i) => new THREE.Vector3((i - (count - 1) / 2) * spacing, DIE_REST_Y, 0.6));
}

function keptPosition(slot) {
  return new THREE.Vector3(-2.75 + slot * 1.1, DIE_REST_Y, -3.05);
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  renderer.setSize(rect.width, rect.height, false);
  camera.aspect = rect.width / rect.height;
  // Pull back on narrow screens so the whole board fits the width; look more top-down in portrait.
  const portrait = camera.aspect < 0.9;
  camera.fov = portrait ? 34 : 40;
  const halfW = portrait ? 5.45 : 6.9;
  const dist = Math.max(portrait ? 17 : 15.2, halfW / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect));
  const dir = (portrait ? new THREE.Vector3(0, 0.93, 0.37) : new THREE.Vector3(0, 0.79, 0.61)).normalize();
  camera.position.copy(dir.multiplyScalar(dist)).add(new THREE.Vector3(0, 0, 0.4));
  camera.lookAt(0, -0.3, portrait ? 0.1 : -0.25);
  scene.fog.near = dist + 1;
  scene.fog.far = dist + 16;
  camera.updateProjectionMatrix();
}

/* ------------------------------------------------------------------ */
/* Animation loop                                                      */
/* ------------------------------------------------------------------ */

const _tmpQ = new THREE.Quaternion();
const _tmpV = new THREE.Vector3();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  // Candle flicker.
  const flicker = 0.82 + Math.sin(t * 11.3) * 0.06 + Math.sin(t * 23.7 + 1.3) * 0.05 + (Math.random() - 0.5) * 0.08;
  candleLight.intensity = 14 * flicker;
  flameSprite.material.opacity = 0.75 + flicker * 0.2;
  flameSprite.scale.setScalar(1.45 + flicker * 0.25);
  flameCore.scale.set(0.15 + Math.sin(t * 17) * 0.01, 0.34 + flicker * 0.06, 1);
  flameCore.position.x = Math.sin(t * 5.1) * 0.012;

  // Dust drift.
  const dp = dust.geometry.attributes.position;
  for (let i = 0; i < dp.count; i++) {
    let y = dp.getY(i) + dt * 0.06;
    if (y > 7) y = 0.3;
    dp.setY(i, y);
    dp.setX(i, dp.getX(i) + Math.sin(t * 0.3 + i) * dt * 0.03);
  }
  dp.needsUpdate = true;

  // Gentle camera breathing.
  camera.position.x += (Math.sin(t * 0.15) * 0.18 - camera.position.x) * 0.02;

  dice.forEach(die => updateDie(die, dt, t));
  updateCoins(dt);
  updateTokens3D(dt);
  updateTurntables(t);
  updatePopups();
  renderer.render(scene, camera);
}

function updateDie(die, dt, t) {
  const a = die.anim;
  if (a) {
    a.t += dt;
    const p = THREE.MathUtils.clamp((a.t - a.delay) / a.duration, 0, 1);
    if (a.t < a.delay) {
      die.mesh.position.copy(a.startPos);
      die.mesh.quaternion.copy(a.startQuat);
    } else if (a.type === 'throw') {
      // Horizontal: decelerating slide. Vertical: drop and decaying bounces.
      const e = 1 - Math.pow(1 - p, 2.6);
      die.mesh.position.lerpVectors(a.startPos, a.endPos, e);
      die.mesh.position.y = DIE_REST_Y + throwHeight(p, a.startPos.y - DIE_REST_Y, a.bounce);
      // Tumble: spin around the roll axis, unwinding into the final resting quaternion.
      const spin = a.spin * Math.pow(1 - p, 2.2);
      _tmpQ.setFromAxisAngle(a.axis, spin);
      die.mesh.quaternion.copy(_tmpQ).multiply(a.endQuat);
      // Fire impact sounds as each bounce lands.
      while (a.contacts.length && p >= a.contacts[0].p) {
        const c = a.contacts.shift();
        playImpact(c.v);
      }
    } else {
      const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      die.mesh.position.lerpVectors(a.startPos, a.endPos, e);
      die.mesh.position.y += Math.sin(p * Math.PI) * a.hop;
      die.mesh.quaternion.copy(a.startQuat).slerp(a.endQuat, e);
    }
    if (p >= 1 && a.t >= a.delay) {
      die.mesh.position.copy(a.endPos);
      die.mesh.quaternion.copy(a.endQuat);
      die.rest.copy(a.endPos);
      die.anim = null;
      if (a.resolve) a.resolve();
    }
  }

  // Lift & glow for hover / selection when resting.
  const idx = die.mesh.userData.index;
  const selectable = isSelectable(idx);
  const targetLift = die.selected ? 0.32 : (selectable && hoveredIdx === idx ? 0.12 : 0);
  die.lift += (targetLift - die.lift) * Math.min(1, dt * 12);
  if (!die.anim) {
    die.mesh.position.set(die.rest.x, die.rest.y + die.lift + (die.selected ? Math.sin(t * 3 + idx) * 0.03 : 0), die.rest.z);
  }

  const invalid = die.selected && !scoreSelection(selectedActiveValues()).valid;
  const targetGlow = die.selected ? 1 : (selectable && hoveredIdx === idx ? 0.35 : 0);
  die.glow += (targetGlow - die.glow) * Math.min(1, dt * 10);
  const ringColor = invalid ? 0xff5040 : (game && game.current !== mySeat ? 0x9cc0ff : 0xffc95a);
  die.ring.material.color.setHex(ringColor);
  die.ring.material.opacity = die.glow * (0.75 + Math.sin(t * 4) * 0.15);
  die.ring.position.x = die.mesh.position.x;
  die.ring.position.z = die.mesh.position.z;
  die.ring.scale.setScalar(1 + die.glow * 0.05);
  const em = invalid ? 0x5a0d05 : 0x6b4a10;
  for (const m of die.mesh.material) {
    m.emissive.setHex(em);
    m.emissiveIntensity = die.glow * 0.45;
  }
}

function throwHeight(p, h0, bounce) {
  // First fall lands at c0, then arcs between later contacts with decaying peaks.
  const c = [0.3, 0.56, 0.75, 0.88, 0.96];
  if (p < c[0]) {
    const s = p / c[0];
    return h0 * (1 - s * s);
  }
  for (let i = 0; i < c.length - 1; i++) {
    if (p < c[i + 1]) {
      const s = (p - c[i]) / (c[i + 1] - c[i]);
      const peak = bounce * Math.pow(0.36, i);
      return 4 * peak * s * (1 - s);
    }
  }
  return 0;
}


/* ------------------------------------------------------------------ */
/* Coins                                                               */
/* ------------------------------------------------------------------ */

function coinTarget(total) {
  return Math.min(60, Math.round(total / 100));
}

function rebuildCoins(who, total, animateDrop = true) {
  const group = who === mySeat ? coinStacks.mine : coinStacks.theirs;
  const target = coinTarget(total);
  while (group.children.length > target) group.remove(group.children[group.children.length - 1]);
  for (let i = group.children.length; i < target; i++) {
    const coin = new THREE.Mesh(coinGeometry, coinMaterial);
    const stack = Math.floor(i / 12);
    const level = i % 12;
    const offsets = [[0, 0], [0.66, 0.15], [0.25, 0.65], [-0.45, 0.45], [-0.5, -0.25]];
    const [ox, oz] = offsets[stack % offsets.length];
    coin.userData.restY = 0.035 + level * 0.068;
    coin.position.set(ox + rand(-0.03, 0.03), animateDrop ? coin.userData.restY + 2.5 + (i - group.children.length) * 0.25 : coin.userData.restY, oz + rand(-0.03, 0.03));
    coin.rotation.y = rand(0, Math.PI * 2);
    coin.rotation.z = rand(-0.03, 0.03);
    coin.userData.vy = 0;
    coin.castShadow = true;
    coin.receiveShadow = true;
    group.add(coin);
  }
}

function updateCoins(dt) {
  for (const group of [coinStacks.mine, coinStacks.theirs]) {
    for (const coin of group.children) {
      const ry = coin.userData.restY;
      if (coin.position.y > ry) {
        coin.userData.vy -= 22 * dt;
        coin.position.y += coin.userData.vy * dt;
        if (coin.position.y <= ry) {
          coin.position.y = ry;
          if (coin.userData.vy < -3) playCoinClink();
          coin.userData.vy = 0;
        }
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Floating score popups                                               */
/* ------------------------------------------------------------------ */

const popups = [];
function spawnPopup(worldPos, text, kind = 'gain') {
  const el = document.createElement('div');
  el.className = `popup ${kind}`;
  el.textContent = text;
  popupLayer.appendChild(el);
  popups.push({ el, pos: worldPos.clone(), born: performance.now() });
}

function updatePopups() {
  const now = performance.now();
  const rect = canvas.getBoundingClientRect();
  for (let i = popups.length - 1; i >= 0; i--) {
    const p = popups[i];
    const age = (now - p.born) / 1600;
    if (age >= 1) { p.el.remove(); popups.splice(i, 1); continue; }
    _tmpV.copy(p.pos).setY(p.pos.y + 1 + age * 1.4).project(camera);
    const x = (_tmpV.x * 0.5 + 0.5) * rect.width;
    const y = (-_tmpV.y * 0.5 + 0.5) * rect.height;
    p.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${0.8 + Math.min(age * 4, 1) * 0.4})`;
    p.el.style.opacity = String(age < 0.7 ? 1 : 1 - (age - 0.7) / 0.3);
  }
}

/* ------------------------------------------------------------------ */
/* Audio                                                               */
/* ------------------------------------------------------------------ */

function toggleSound() {
  soundOn = !soundOn;
  storageSet('kcd2DiceSound', String(soundOn));
  updateSoundBtn();
}
function updateSoundBtn() {
  soundBtn.textContent = soundOn ? '🔊 Sound on' : '🔇 Sound off';
  soundBtn.setAttribute('aria-pressed', String(soundOn));
}

function getAudioContext() {
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return null;
  if (!audioCtx) audioCtx = new AudioCtor();
  if (!noiseBuffer) {
    noiseBuffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 2, audioCtx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return audioCtx;
}

function unlockGameAudio() {
  try {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  } catch { /* audio is optional */ }
}

function readyCtx() {
  if (!soundOn) return null;
  try {
    const ctx = getAudioContext();
    if (!ctx || ctx.state !== 'running') return null;
    return ctx;
  } catch { return null; }
}

function playRattle() {
  const ctx = readyCtx();
  if (!ctx) return;
  const start = ctx.currentTime + 0.01;
  for (let i = 0; i < 9; i++) {
    const t = start + i * 0.038 + Math.random() * 0.015;
    playNoisePulse(ctx, ctx.destination, t, 0.035, 0.18 + Math.random() * 0.12, 900 + Math.random() * 1400, 6.5);
    playToneClick(ctx, ctx.destination, t + 0.005, 180 + Math.random() * 220, 0.02, 0.07);
  }
}

let lastImpact = 0;
function playImpact(strength) {
  const ctx = readyCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  if (now - lastImpact < 0.012) return;
  lastImpact = now;
  const vol = 0.06 + strength * 0.32;
  playToneClick(ctx, ctx.destination, now, 110 + Math.random() * 120, 0.08, vol);
  playNoisePulse(ctx, ctx.destination, now + 0.003, 0.06, vol * 0.7, 380 + Math.random() * 500, 1.1);
  if (strength > 0.5) playToneClick(ctx, ctx.destination, now + 0.002, 900 + Math.random() * 500, 0.025, vol * 0.25);
}

let lastClink = 0;
function playCoinClink() {
  const ctx = readyCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  if (now - lastClink < 0.03) return;
  lastClink = now;
  [2400, 3600, 5200].forEach((f, i) => playToneClick(ctx, ctx.destination, now, f * rand(0.95, 1.05), 0.18 - i * 0.04, 0.05));
}

function playBustSound() {
  const ctx = readyCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(220, now);
  osc.frequency.exponentialRampToValueAtTime(70, now + 0.5);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass'; filter.frequency.value = 900;
  osc.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
  osc.start(now); osc.stop(now + 0.6);
}

function playFanfare(win) {
  const ctx = readyCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const notes = win ? [523, 659, 784, 1047] : [392, 349, 311, 262];
  notes.forEach((f, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = f;
    const t = now + i * 0.16;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + (i === notes.length - 1 ? 0.9 : 0.3));
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(t); osc.stop(t + 1);
  });
}

function playNoisePulse(ctx, destination, time, duration, volume, frequency, q) {
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(frequency, time);
  filter.Q.setValueAtTime(q, time);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), time + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
  source.connect(filter); filter.connect(gain); gain.connect(destination);
  source.start(time, Math.random());
  source.stop(time + duration + 0.02);
}

function playToneClick(ctx, destination, time, frequency, duration, volume) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(frequency, time);
  osc.frequency.exponentialRampToValueAtTime(Math.max(40, frequency * 0.55), time + duration);
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), time + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
  osc.connect(gain); gain.connect(destination);
  osc.start(time);
  osc.stop(time + duration + 0.02);
}

/* ------------------------------------------------------------------ */
/* Tokens: data, artwork (one painter feeds both the cards and 3D)     */
/* ------------------------------------------------------------------ */

const METALS = ['Wood', 'Iron', 'Copper', 'Bronze', 'Tin', 'Silver', 'Gold'];
const TIER_MIN = [50, 150, 250, 400, 550, 750, 1000];
const TOKEN_TYPES = ['headstart', 'rally', 'wind', 'fortune', 'toll', 'ward'];
const TOKEN_INFO = {
  headstart: { name: 'Sandal of Hermes', role: 'Head Start', vals: [50, 100, 150, 200, 300, 400, 500], text: v => `Start the match with ${fmt(v)} points.` },
  rally: { name: 'Laurel of Nike', role: 'Rally', vals: [10, 15, 20, 25, 30, 40, 50], text: v => `Once: arm it and your next banked turn gets +${v}%.` },
  wind: { name: 'Phoenix', role: 'Second Wind', vals: [15, 25, 35, 45, 55, 65, 75], text: v => `Once: when you bust, keep ${v}% of that turn's points.` },
  fortune: { name: 'Horn of Tyche', role: 'Fortune', vals: [1, 2, 2, 3, 3, 4, 5], text: v => `Re-roll one die after a throw, even a bust. ${v} use${v > 1 ? 's' : ''}.` },
  toll: { name: 'Charon’s Ferry', role: 'Toll', vals: [10, 15, 20, 25, 30, 40, 50], text: v => `Once: right after your opponent banks, cut that turn by ${v}%.` },
  ward: { name: 'Aegis of Athena', role: 'Ward', vals: [0, 0, 0, 0, 0, 0, 0], text: () => `Blocks their token if yours is the same metal or better; otherwise drops theirs two metals.` }
};
const METAL_PAINT = [
  { base: '#8a5a2b', light: '#c99460', dark: '#3f240e', side: 0x6b4420, metal: 0.0, rough: 0.75 },
  { base: '#6a6f74', light: '#a3a9ae', dark: '#2e3134', side: 0x7a7f84, metal: 0.7, rough: 0.42 },
  { base: '#b5653a', light: '#f2a57a', dark: '#5a2a10', side: 0xb5653a, metal: 0.95, rough: 0.38 },
  { base: '#9a7738', light: '#dcb86f', dark: '#46320f', side: 0x9a7738, metal: 0.95, rough: 0.4 },
  { base: '#a8acaf', light: '#e8eaec', dark: '#5a5e61', side: 0xa8acaf, metal: 0.9, rough: 0.42 },
  { base: '#c8cdd5', light: '#ffffff', dark: '#737985', side: 0xd6dbe3, metal: 1.0, rough: 0.25 },
  { base: '#d4a334', light: '#ffe8a0', dark: '#755010', side: 0xe0ad3c, metal: 1.0, rough: 0.28 }
];

const round5 = (x) => Math.round(x / 5) * 5;
function tierFor(score) { let t = -1; TIER_MIN.forEach((m, i) => { if (score >= m) t = i; }); return t; }
function tokenVal(tok) { return TOKEN_INFO[tok.type].vals[tok.tier]; }
function makeToken(type, tier) {
  return { type, tier, uses: type === 'fortune' ? TOKEN_INFO.fortune.vals[tier] : 1, armed: type === 'wind', cancelled: false, spent: false };
}
function tokenUsable(tok) { return !!tok && !tok.cancelled && !tok.spent && tok.uses > 0; }
const aMetal = (tier) => (/^[AEIOU]/.test(METALS[tier]) ? 'an ' : 'a ') + METALS[tier];
function tokenTitle(tok) { return `${METALS[tok.tier]} ${TOKEN_INFO[tok.type].name}`; }

/* ------------------------------------------------------------------ */
/* Token statuettes: small cast/carved Greek-myth game pieces on a     */
/* base, fully 3D, built from primitives so they read from every side. */
/* ------------------------------------------------------------------ */

const STATUE_HEIGHT = 1.6;
const statueProto = new Map();      // type -> Group (materials assigned per tier when cloned)
const statueMatCache = new Map();   // `${tier}-${slot}` -> material

function makeWoodGrain() {
  const [cnv, ctx] = canvas2d(256);
  ctx.fillStyle = '#9a6a3c'; ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 70; i++) {
    ctx.strokeStyle = `rgba(${50 + Math.random() * 30}, ${25 + Math.random() * 15}, 8, ${rand(0.15, 0.4)})`;
    ctx.lineWidth = rand(0.8, 2.6);
    const y = rand(0, 256);
    ctx.beginPath(); ctx.moveTo(0, y);
    ctx.bezierCurveTo(85, y + rand(-12, 12), 170, y + rand(-12, 12), 256, y + rand(-8, 8));
    ctx.stroke();
  }
  const t = finishTexture(cnv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 2);
  return t;
}
let woodGrainTex = null;

function statueMaterial(tier, slot) {
  const key = `${tier}-${slot}`;
  if (statueMatCache.has(key)) return statueMatCache.get(key);
  const p = METAL_PAINT[tier];
  let m;
  if (tier === 0) {
    if (!woodGrainTex) woodGrainTex = makeWoodGrain();
    m = new THREE.MeshStandardMaterial({ map: woodGrainTex, color: slot === 'dark' ? 0x5a3a20 : (slot === 'accent' ? 0xd8b080 : 0xffffff), roughness: 0.72, metalness: 0 });
  } else {
    const base = new THREE.Color(p.side);
    if (slot === 'dark') base.multiplyScalar(0.5);
    if (slot === 'accent') base.lerp(new THREE.Color(0xffffff), tier >= 5 ? 0.15 : 0.25);
    if (tier === 3 && slot === 'dark') base.set(0x2f4a3a); // bronze patina in the recesses
    if (tier === 2 && slot === 'dark') base.set(0x2f4a40);
    m = new THREE.MeshStandardMaterial({
      color: base, metalness: slot === 'dark' ? p.metal * 0.6 : p.metal, roughness: slot === 'dark' ? Math.min(1, p.rough + 0.25) : p.rough,
      envMapIntensity: 1.6
    });
  }
  m.side = THREE.DoubleSide;
  statueMatCache.set(key, m);
  return m;
}

// Small geometry helpers. Every mesh carries a material "slot": main | dark | accent.
function part(geo, slot = 'main') {
  const m = new THREE.Mesh(geo, null);
  m.userData.slot = slot;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
function ellipsoid(rx, ry, rz, slot) {
  const g = new THREE.SphereGeometry(1, 20, 14);
  g.scale(rx, ry, rz);
  return part(g, slot);
}
function feather(len, width, thick, slot) {
  // Leaf/feather: pointed ellipsoid along +y from the origin, with a raised spine.
  const g = new THREE.SphereGeometry(1, 16, 12);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const taper = 1 - Math.pow(Math.max(0, y), 2) * 0.55;
    pos.setX(i, pos.getX(i) * width * taper);
    pos.setZ(i, pos.getZ(i) * thick * (1 + 0.6 * (1 - Math.abs(pos.getX(i)))));
    pos.setY(i, (y + 1) * len / 2);
  }
  g.computeVertexNormals();
  return part(g, slot);
}
function tube(points, radius, slot, tubular = 40, taper = false) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  const g = new THREE.TubeGeometry(curve, tubular, radius, 10, false);
  if (taper) {
    const pos = g.attributes.position;
    const segs = tubular + 1;
    const ring = 11;
    for (let i = 0; i < segs; i++) {
      const t = i / tubular;
      const c = curve.getPointAt(t);
      const f = taper === 'both' ? Math.sin(Math.PI * Math.min(0.98, Math.max(0.02, t))) * 0.9 + 0.1 : 1 - t * 0.85;
      for (let j = 0; j < ring; j++) {
        const k = i * ring + j;
        pos.setXYZ(k, c.x + (pos.getX(k) - c.x) * f, c.y + (pos.getY(k) - c.y) * f, c.z + (pos.getZ(k) - c.z) * f);
      }
    }
    g.computeVertexNormals();
  }
  return part(g, slot);
}
function lathe(profile, slot, segs = 32) {
  return part(new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), segs), slot);
}
function place(mesh, x, y, z, rx = 0, ry = 0, rz = 0) {
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  return mesh;
}
function bail(group) {
  // Cord loop on the very top.
  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(group);
  const c = box.getCenter(new THREE.Vector3());
  const loop = part(new THREE.TorusGeometry(0.1, 0.028, 10, 28), 'main');
  loop.position.set(c.x, box.max.y + 0.08, c.z);
  group.add(loop);
}

/* --- Sandal of Hermes (Head Start) --- */
function buildHermes() {
  const g = new THREE.Group();
  // Sole: footprint extruded with a soft bevel.
  const foot = new THREE.Shape();
  foot.moveTo(-0.62, 0);
  foot.bezierCurveTo(-0.62, 0.2, -0.36, 0.24, -0.1, 0.2);
  foot.bezierCurveTo(0.2, 0.17, 0.5, 0.26, 0.7, 0.16);
  foot.bezierCurveTo(0.84, 0.08, 0.84, -0.12, 0.66, -0.18);
  foot.bezierCurveTo(0.4, -0.25, 0.1, -0.13, -0.1, -0.17);
  foot.bezierCurveTo(-0.38, -0.22, -0.62, -0.2, -0.62, 0);
  const soleGeo = new THREE.ExtrudeGeometry(foot, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 3, curveSegments: 20 });
  soleGeo.rotateX(Math.PI / 2);
  g.add(place(part(soleGeo, 'main'), 0, 0.11, 0));
  // Heel cup and ankle cuff.
  g.add(place(part(new THREE.CylinderGeometry(0.17, 0.2, 0.36, 28, 1, true, Math.PI * 0.15, Math.PI * 1.7), 'main'), -0.44, 0.32, 0, 0, Math.PI / 2, 0));
  g.add(place(part(new THREE.TorusGeometry(0.175, 0.03, 8, 32), 'accent'), -0.44, 0.5, 0, Math.PI / 2, 0, 0));
  // Straps over the instep and across the toes.
  for (const [x, r, s] of [[-0.18, 0.19, 0.03], [0.1, 0.18, 0.028], [0.38, 0.17, 0.026]]) {
    g.add(place(part(new THREE.TorusGeometry(r, s, 8, 24, Math.PI), 'accent'), x, 0.11, 0, 0, Math.PI / 2, 0));
  }
  g.add(tube([[-0.3, 0.42, 0.15], [-0.12, 0.28, 0.12], [0.1, 0.24, 0.08]], 0.022, 'accent'));
  g.add(tube([[-0.3, 0.42, -0.15], [-0.12, 0.28, -0.12], [0.1, 0.24, -0.08]], 0.022, 'accent'));
  // Wings sprouting from both sides of the heel.
  for (const side of [1, -1]) {
    const wing = new THREE.Group();
    const n = 6;
    for (let i = 0; i < n; i++) {
      const f = feather(0.3 + i * 0.07, 0.075, 0.04, i % 2 ? 'main' : 'accent');
      f.rotation.z = 0.25 + i * 0.22;
      f.rotation.x = side * 0.25;
      f.position.set(-0.02 * i, 0.02 * i, 0);
      wing.add(f);
    }
    wing.position.set(-0.46, 0.42, side * 0.2);
    wing.rotation.y = side * 0.35;
    wing.rotation.z = 0.15;
    g.add(wing);
  }
  return g;
}

/* --- Laurel wreath of Nike (Rally) --- */
function buildNike() {
  const g = new THREE.Group();
  const R = 0.62;
  g.add(place(part(new THREE.TorusGeometry(R, 0.05, 10, 64, Math.PI * 1.86), 'dark'), 0, 0, 0, 0, 0, -Math.PI / 2 + Math.PI * 0.07));
  for (const side of [1, -1]) {
    const steps = 11;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const a = -Math.PI / 2 + side * t * Math.PI * 0.9;
      const px = Math.cos(a) * R, py = Math.sin(a) * R;
      const tangent = a + side * Math.PI / 2;
      for (const [off, tilt, dz] of [[0.05, 0.65, 0.03], [-0.05, -0.6, -0.03]]) {
        const leaf = feather(0.32 - t * 0.08, 0.075, 0.026, (i + (off > 0 ? 0 : 1)) % 2 ? 'main' : 'accent');
        leaf.position.set(px + Math.cos(a) * off, py + Math.sin(a) * off, dz);
        leaf.rotation.set(dz * 4, -dz * 3, tangent - Math.PI / 2 + side * tilt);
        g.add(leaf);
      }
      if (i % 3 === 1) g.add(place(ellipsoid(0.035, 0.035, 0.035, 'accent'), px + Math.cos(a) * 0.02, py + Math.sin(a) * 0.02, 0.07));
    }
  }
  // Ribbon bow at the bottom.
  for (const side of [1, -1]) {
    g.add(place(part(new THREE.TorusGeometry(0.09, 0.03, 8, 24), 'accent'), side * 0.1, -R - 0.02, 0.04, 0.3, side * 0.5, 0));
    g.add(tube([[side * 0.02, -R - 0.06, 0.05], [side * 0.12, -R - 0.2, 0.08], [side * 0.2, -R - 0.34, 0.02], [side * 0.3, -R - 0.42, -0.04]], 0.026, 'accent', 24));
  }
  g.add(place(ellipsoid(0.05, 0.05, 0.05, 'accent'), 0, -R - 0.03, 0.06));
  return g;
}

/* --- Phoenix rising from flames (Second Wind) --- */
function buildPhoenix() {
  const g = new THREE.Group();
  // Flame pedestal.
  g.add(lathe([[0, 0], [0.32, 0], [0.34, 0.04], [0.26, 0.08], [0.2, 0.14], [0, 0.16]], 'dark'));
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const h = 0.28 + (i % 3) * 0.08;
    const flame = tube([[Math.cos(a) * 0.24, 0.1, Math.sin(a) * 0.24], [Math.cos(a + 0.3) * 0.2, 0.1 + h * 0.6, Math.sin(a + 0.3) * 0.2], [Math.cos(a + 0.6) * 0.12, 0.1 + h, Math.sin(a + 0.6) * 0.12]], 0.06, i % 2 ? 'accent' : 'main', 20, true);
    g.add(flame);
  }
  // Body, chest and neck.
  g.add(place(ellipsoid(0.17, 0.3, 0.17, 'main'), 0, 0.62, 0, -0.15, 0, 0));
  g.add(place(ellipsoid(0.12, 0.16, 0.12, 'accent'), 0, 0.68, 0.07, -0.3, 0, 0));
  g.add(place(ellipsoid(0.07, 0.15, 0.07, 'main'), 0, 0.92, 0.04, 0.3, 0, 0));
  // Head, beak, eyes, crest.
  g.add(place(ellipsoid(0.1, 0.09, 0.11, 'main'), 0, 1.06, 0.06));
  const beak = part(new THREE.ConeGeometry(0.035, 0.14, 12), 'accent');
  g.add(place(beak, 0, 1.03, 0.2, Math.PI / 2 + 0.35, 0, 0));
  for (const s of [1, -1]) g.add(place(ellipsoid(0.02, 0.02, 0.02, 'dark'), s * 0.065, 1.08, 0.12));
  for (let i = 0; i < 3; i++) {
    const c = feather(0.18 + i * 0.04, 0.03, 0.025, 'accent');
    g.add(place(c, 0, 1.12, 0.02, -0.7 - i * 0.25, 0, 0));
  }
  // Wings raised in a V, feathers fanned.
  for (const side of [1, -1]) {
    const wing = new THREE.Group();
    for (let i = 0; i < 8; i++) {
      const f = feather(0.42 + i * 0.05 - (i > 5 ? (i - 5) * 0.08 : 0), 0.07, 0.04, i % 2 ? 'main' : 'accent');
      f.rotation.z = -side * (0.2 + i * 0.17);
      f.position.set(side * i * 0.012, -i * 0.015, -i * 0.004);
      wing.add(f);
    }
    wing.position.set(side * 0.12, 0.74, -0.04);
    wing.rotation.set(-0.25, side * -0.35, side * -0.15);
    g.add(wing);
  }
  // Tail streaming down into the flames.
  for (let i = 0; i < 5; i++) {
    const a = (i - 2) * 0.28;
    g.add(tube([[0, 0.45, -0.1], [Math.sin(a) * 0.15, 0.32, -0.22], [Math.sin(a) * 0.3, 0.2, -0.3]], 0.03, i % 2 ? 'main' : 'accent', 18, true));
  }
  return g;
}

/* --- Horn of Tyche, the cornucopia (Fortune) --- */
function buildTyche() {
  const g = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3([
    [-0.62, 0.32, 0], [-0.74, 0.16, 0.02], [-0.66, 0.02, 0.02], [-0.42, -0.02, 0], [-0.1, 0.04, 0], [0.2, 0.18, 0], [0.42, 0.38, 0]
  ].map(p => new THREE.Vector3(...p)));
  const M = 60, S = 24;
  const frames = curve.computeFrenetFrames(M, false);
  const verts = [], idx = [];
  const radiusAt = (t) => 0.015 + 0.3 * Math.pow(t, 1.6) + 0.012 * Math.sin(t * 60) * t;
  for (let i = 0; i <= M; i++) {
    const t = i / M;
    const c = curve.getPointAt(t);
    const N = frames.normals[i], B = frames.binormals[i];
    const r = radiusAt(t);
    for (let j = 0; j <= S; j++) {
      const a = (j / S) * Math.PI * 2;
      verts.push(c.x + (Math.cos(a) * N.x + Math.sin(a) * B.x) * r, c.y + (Math.cos(a) * N.y + Math.sin(a) * B.y) * r, c.z + (Math.cos(a) * N.z + Math.sin(a) * B.z) * r);
    }
  }
  for (let i = 0; i < M; i++) for (let j = 0; j < S; j++) {
    const a = i * (S + 1) + j, b = a + S + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const hornGeo = new THREE.BufferGeometry();
  hornGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  hornGeo.setIndex(idx);
  hornGeo.computeVertexNormals();
  g.add(part(hornGeo, 'main'));
  // Raised bands around the horn.
  for (const t of [0.35, 0.55, 0.75, 0.97]) {
    const c = curve.getPointAt(t), tan = curve.getTangentAt(t);
    const band = part(new THREE.TorusGeometry(radiusAt(t) + 0.008, 0.016, 8, 32), 'accent');
    band.position.copy(c);
    band.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tan);
    g.add(band);
  }
  // Fruit spilling from the mouth.
  const m = curve.getPointAt(1);
  g.add(place(ellipsoid(0.13, 0.12, 0.13, 'accent'), m.x + 0.02, m.y + 0.08, m.z + 0.08));
  g.add(place(ellipsoid(0.11, 0.1, 0.11, 'main'), m.x - 0.14, m.y + 0.04, m.z - 0.1));
  g.add(place(lathe([[0, 0], [0.07, 0.03], [0.08, 0.08], [0.05, 0.15], [0.03, 0.2], [0, 0.22]], 'accent', 20), m.x + 0.16, m.y + 0.06, m.z - 0.06, 0, 0, -0.6));
  const grapes = [[0, 0, 0], [0.06, -0.02, 0.02], [-0.06, -0.02, 0.02], [0.03, -0.08, 0.04], [-0.03, -0.08, 0.04], [0, -0.14, 0.05], [0.0, -0.04, 0.07]];
  for (const [x, y, z] of grapes) g.add(place(ellipsoid(0.04, 0.04, 0.04, 'dark'), m.x + 0.2 + x, m.y - 0.02 + y, m.z + 0.12 + z));
  g.add(place(tube([[0, 0, 0], [0.01, 0.04, 0], [0.03, 0.07, 0]], 0.008, 'dark', 8), m.x + 0.02, m.y + 0.19, m.z + 0.08));
  for (const s of [1, -1]) g.add(place(feather(0.16, 0.05, 0.015, 'main'), m.x + s * 0.06, m.y + 0.14, m.z - 0.02 * s, 0.4 * s, 0, -s * 0.9));
  return g;
}

/* --- Charon in his ferry (Toll) --- */
function buildCharon() {
  const g = new THREE.Group();
  // Hull: half an elongated bowl, with prow and stern curling up.
  const hull = new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  hull.scale(0.62, 0.2, 0.22);
  g.add(place(part(hull, 'main'), 0, 0.22, 0));
  const gunwale = part(new THREE.TorusGeometry(1, 0.045, 8, 64), 'accent');
  gunwale.scale.set(0.62, 0.22, 1);
  gunwale.rotation.x = Math.PI / 2;
  gunwale.position.y = 0.22;
  g.add(gunwale);
  g.add(tube([[0.56, 0.2, 0], [0.7, 0.32, 0], [0.74, 0.48, 0], [0.66, 0.56, 0]], 0.045, 'main', 24, true));
  g.add(tube([[-0.56, 0.2, 0], [-0.68, 0.3, 0], [-0.7, 0.4, 0]], 0.04, 'main', 20, true));
  g.add(place(ellipsoid(0.08, 0.012, 0.18, 'dark'), 0.25, 0.2, 0));
  // Charon: robed and hooded.
  g.add(lathe([[0, 0], [0.16, 0], [0.15, 0.1], [0.12, 0.3], [0.1, 0.42], [0.08, 0.5], [0, 0.52]], 'main', 28));
  g.children[g.children.length - 1].position.set(-0.18, 0.18, 0);
  const hood = ellipsoid(0.09, 0.11, 0.1, 'main');
  g.add(place(hood, -0.18, 0.76, 0.0));
  g.add(place(part(new THREE.ConeGeometry(0.05, 0.14, 12), 'main'), -0.21, 0.88, -0.05, -0.6, 0, 0.2));
  g.add(place(ellipsoid(0.055, 0.07, 0.04, 'dark'), -0.18, 0.75, 0.07));
  for (const s of [1, -1]) g.add(place(ellipsoid(0.012, 0.012, 0.012, 'accent'), -0.18 + s * 0.02, 0.77, 0.1));
  // Arms reaching to the oar.
  g.add(tube([[-0.24, 0.6, 0.06], [-0.1, 0.55, 0.14], [0.0, 0.58, 0.16]], 0.03, 'main', 12));
  g.add(tube([[-0.12, 0.6, -0.05], [-0.02, 0.5, 0.12], [0.02, 0.45, 0.17]], 0.028, 'main', 12));
  // The long oar, blade in the water beside the hull.
  g.add(tube([[-0.08, 0.9, 0.12], [0.08, 0.4, 0.2], [0.26, -0.02, 0.3]], 0.026, 'accent', 16));
  g.add(place(ellipsoid(0.04, 0.12, 0.012, 'accent'), 0.3, -0.08, 0.31, 0, 0.6, 0.6));
  // Lantern on the prow.
  g.add(place(part(new THREE.CylinderGeometry(0.035, 0.035, 0.07, 12), 'dark'), 0.66, 0.61, 0));
  g.add(place(part(new THREE.ConeGeometry(0.045, 0.05, 12), 'main'), 0.66, 0.67, 0));
  // An obol, Charon's fee, on the bench.
  g.add(place(part(new THREE.CylinderGeometry(0.05, 0.05, 0.012, 20), 'accent'), 0.28, 0.215, 0.04));
  return g;
}

/* --- Aegis of Athena with the Gorgon's head (Ward) --- */
function buildAegis() {
  const g = new THREE.Group();
  const shield = lathe([[0, 0.09], [0.2, 0.085], [0.45, 0.06], [0.6, 0.02], [0.66, -0.01], [0.66, -0.04], [0.6, -0.03], [0, -0.03]], 'main', 64);
  shield.rotation.x = Math.PI / 2;
  g.add(shield);
  const rim = part(new THREE.TorusGeometry(0.64, 0.035, 10, 72), 'accent');
  rim.position.z = 0.01;
  g.add(rim);
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    g.add(place(ellipsoid(0.022, 0.022, 0.022, 'accent'), Math.cos(a) * 0.56, Math.sin(a) * 0.56, 0.05));
  }
  // Gorgoneion: face with bulging eyes, snakes for hair.
  g.add(place(ellipsoid(0.2, 0.24, 0.1, 'accent'), 0, -0.02, 0.1));
  for (const s of [1, -1]) {
    g.add(place(ellipsoid(0.045, 0.035, 0.03, 'main'), s * 0.08, 0.05, 0.18));
    g.add(place(ellipsoid(0.02, 0.02, 0.02, 'dark'), s * 0.08, 0.05, 0.205));
    g.add(place(ellipsoid(0.06, 0.015, 0.02, 'main'), s * 0.08, 0.11, 0.175, 0, 0, -s * 0.25));
  }
  g.add(place(ellipsoid(0.03, 0.06, 0.03, 'main'), 0, -0.02, 0.19));
  g.add(place(part(new THREE.TorusGeometry(0.06, 0.015, 8, 20, Math.PI), 'dark'), 0, -0.12, 0.17, 0, 0, Math.PI));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.13;
    const pts = [];
    for (let k = 0; k <= 5; k++) {
      const r = 0.2 + k * 0.055;
      const w = Math.sin(k * 1.6 + i) * 0.12;
      pts.push([Math.cos(a + w) * r * 1.05, Math.sin(a + w) * r * 1.15 - 0.02, 0.12 - k * 0.012]);
    }
    g.add(tube(pts, 0.034, i % 2 ? 'main' : 'accent', 24));
    const end = pts[pts.length - 1];
    g.add(place(ellipsoid(0.035, 0.026, 0.03, i % 2 ? 'main' : 'accent'), end[0], end[1], end[2]));
  }
  // Back: concentric rings, a boss and the grip.
  for (const r of [0.22, 0.42, 0.55]) g.add(place(part(new THREE.TorusGeometry(r, 0.02, 8, 56), 'accent'), 0, 0, -0.035));
  g.add(place(ellipsoid(0.09, 0.09, 0.05, 'accent'), 0, 0, -0.04));
  g.add(place(part(new THREE.TorusGeometry(0.14, 0.026, 8, 24, Math.PI), 'main'), 0, 0, -0.07, Math.PI / 2, 0, 0));
  // Athena's owl perched on the rim.
  const owl = new THREE.Group();
  owl.add(place(ellipsoid(0.11, 0.15, 0.1, 'main'), 0, 0.15, 0));
  owl.add(place(ellipsoid(0.08, 0.11, 0.05, 'accent'), 0, 0.13, 0.06));
  owl.add(place(ellipsoid(0.1, 0.085, 0.09, 'main'), 0, 0.33, 0.01));
  for (const s of [1, -1]) {
    owl.add(place(ellipsoid(0.04, 0.04, 0.02, 'accent'), s * 0.045, 0.34, 0.085));
    owl.add(place(ellipsoid(0.017, 0.017, 0.01, 'dark'), s * 0.045, 0.34, 0.103));
    owl.add(place(part(new THREE.ConeGeometry(0.025, 0.08, 10), 'main'), s * 0.065, 0.42, 0.0, 0, 0, -s * 0.35));
    owl.add(place(ellipsoid(0.04, 0.12, 0.08, 'accent'), s * 0.1, 0.14, -0.01, 0, 0, s * 0.15));
    owl.add(place(ellipsoid(0.03, 0.015, 0.04, 'accent'), s * 0.04, 0.0, 0.05));
  }
  owl.add(place(part(new THREE.ConeGeometry(0.018, 0.05, 8), 'accent'), 0, 0.31, 0.1, Math.PI / 2 + 0.6, 0, 0));
  owl.add(place(ellipsoid(0.05, 0.08, 0.02, 'main'), 0, 0.03, -0.09, -0.6, 0, 0));
  owl.position.set(0, 0.66, 0);
  g.add(owl);
  return g;
}

const STATUE_BUILDERS = { headstart: buildHermes, rally: buildNike, wind: buildPhoenix, fortune: buildTyche, toll: buildCharon, ward: buildAegis };

// Some figures read better turned before they are set on their base.
const STATUE_POSE = { headstart: [0, 0, 0], rally: [0, 0, 0], wind: [0, 0, 0], fortune: [0, 0, 0], toll: [0, 0, 0], ward: [-0.12, 0, 0] };

function statuePrototype(type) {
  if (statueProto.has(type)) return statueProto.get(type);
  const inner = STATUE_BUILDERS[type]();
  inner.rotation.set(...STATUE_POSE[type]);
  // Normalise: centred on x/z, standing on the plinth, fitting a STATUE_HEIGHT cube.
  inner.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(inner);
  const size = box.getSize(new THREE.Vector3());
  const k = (STATUE_HEIGHT - 0.14) / Math.max(size.x, size.y, size.z);
  const c = box.getCenter(new THREE.Vector3());
  const PLINTH = 0.13;
  inner.position.set(-c.x * k, -box.min.y * k + PLINTH - 0.01, -c.z * k);
  inner.scale.setScalar(k);
  const outer = new THREE.Group();
  outer.add(inner);
  // Cast base, oval to suit the figure's footprint (like a classic board-game piece).
  const rx = Math.max(0.32, Math.min(0.85, size.x * k * 0.5 * 0.92));
  const rz = Math.max(0.32, Math.min(0.6, size.z * k * 0.5 * 1.1));
  const plinth = lathe([[0, 0], [0.92, 0], [1, 0.02 / 0.5], [1, 0.06 / 0.5], [0.95, 0.09 / 0.5], [0.9, 0.11 / 0.5], [0.86, 0.13 / 0.5], [0, 0.13 / 0.5]], 'main', 48);
  plinth.scale.set(rx, 0.5, rz);
  outer.add(plinth);
  const bead = part(new THREE.TorusGeometry(1, 0.035, 8, 64), 'accent');
  bead.scale.set(rx * 0.97, rz * 0.97, 1);
  bead.rotation.x = Math.PI / 2;
  bead.position.y = 0.075;
  outer.add(bead);
  statueProto.set(type, outer);
  return outer;
}

function makeStatue(type, tier) {
  const s = statuePrototype(type).clone(true);
  s.traverse(o => { if (o.isMesh) o.material = statueMaterial(tier, o.userData.slot || 'main'); });
  return s;
}

/* Offscreen renderer for card images and turntables */
let statueStage = null;
function getStatueStage() {
  if (statueStage) return statueStage;
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1);
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.15;
  r.outputColorSpace = THREE.SRGBColorSpace;
  const sc = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(r);
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(20, 20, 20), new THREE.MeshBasicMaterial({ color: 0x5a4030, side: THREE.BackSide })));
  const panel = (color, w, h, pos) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })); m.position.copy(pos); m.lookAt(0, 0, 0); env.add(m); };
  panel(0xfff0d8, 8, 6, new THREE.Vector3(-6, 7, 6));
  panel(0xffb060, 5, 5, new THREE.Vector3(8, 2, 2));
  panel(0xffd9a8, 5, 6, new THREE.Vector3(2, 3, -9));
  panel(0xfff4e0, 10, 4, new THREE.Vector3(0, 9, 2));
  sc.environment = pm.fromScene(env, 0.03).texture;
  pm.dispose();
  sc.add(new THREE.HemisphereLight(0xfff2dd, 0x3a2414, 0.9));
  const key = new THREE.DirectionalLight(0xfff0dc, 2.2);
  key.position.set(-3, 5, 4);
  sc.add(key);
  const rimL = new THREE.DirectionalLight(0xffc080, 1.2);
  rimL.position.set(4, 2, -3);
  sc.add(rimL);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  cam.position.set(0, 1.2, 3.25);
  cam.lookAt(0, 0.78, 0);
  const holder = new THREE.Group();
  sc.add(holder);
  statueStage = { r, sc, cam, holder, current: '' };
  return statueStage;
}

function renderStatue(type, tier, angle, size) {
  const st = getStatueStage();
  const key = `${type}-${tier}`;
  if (st.current !== key) {
    st.holder.clear();
    st.holder.rotation.y = 0;
    const statue = makeStatue(type, tier);
    st.holder.add(statue);
    st.current = key;
    // Frame the sphere that contains the piece at every turn of the turntable,
    // so the base never leaves the picture.
    st.holder.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(statue);
    const hr = Math.hypot(Math.max(Math.abs(box.min.x), Math.abs(box.max.x)), Math.max(Math.abs(box.min.z), Math.abs(box.max.z)));
    const cy = (box.min.y + box.max.y) / 2;
    const R = Math.hypot(hr, (box.max.y - box.min.y) / 2);
    const elev = 0.3;
    const dist = (R * 1.04) / Math.sin(THREE.MathUtils.degToRad(st.cam.fov / 2));
    st.cam.position.set(0, cy + dist * Math.sin(elev), dist * Math.cos(elev));
    st.cam.lookAt(0, cy, 0);
  }
  if (st.r.domElement.width !== size) st.r.setSize(size, size, false);
  st.holder.rotation.y = angle;
  st.r.render(st.sc, st.cam);
  return st.r.domElement;
}

const tokenUrlCache = new Map();
function tokenImageUrl(type, tier) {
  const key = `${type}-${tier}`;
  if (!tokenUrlCache.has(key)) {
    const src = renderStatue(type, tier, -0.55, 192);
    const [cnv, ctx] = canvas2d(192);
    ctx.drawImage(src, 0, 0);
    tokenUrlCache.set(key, cnv.toDataURL());
  }
  return tokenUrlCache.get(key);
}

// Live turntables on the choice cards.
const turntables = [];
function registerTurntables(root) {
  turntables.length = 0;
  root.querySelectorAll('canvas.statue-view').forEach((c, i) => {
    turntables.push({ canvas: c, type: c.dataset.type, tier: Number(c.dataset.tier), phase: i * 0.9 });
  });
}
function updateTurntables(t) {
  if (!turntables.length || !pickModal.classList.contains('show')) return;
  for (const tt of turntables) {
    if (!tt.canvas.isConnected) continue;
    const size = tt.canvas.width;
    const src = renderStatue(tt.type, tt.tier, t * 0.7 + tt.phase, size);
    const ctx = tt.canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(src, 0, 0);
  }
}

/* Statuettes on the table */
const tokenMeshes = { mine: null, theirs: null };
function tokenSpot(which) {
  return which === 'mine' ? new THREE.Vector3(6.15, -0.12, 0.3) : new THREE.Vector3(-6.15, -0.12, 0.3);
}

function refreshTokens3D() {
  if (!game) return;
  for (const which of ['mine', 'theirs']) {
    const seat = which === 'mine' ? mySeat : other(mySeat);
    const tok = game.tokens && game.tokens[seat];
    const key = tok ? `${tok.type}-${tok.tier}` : '';
    let mesh = tokenMeshes[which];
    if (mesh && mesh.userData.key !== key) { scene.remove(mesh); mesh = tokenMeshes[which] = null; }
    if (!mesh && tok) {
      mesh = makeStatue(tok.type, tok.tier);
      mesh.traverse(o => {
        if (!o.isMesh) return;
        o.material = o.material.clone();
        o.userData.baseColor = o.material.color.clone();
        o.userData.baseMetal = o.material.metalness;
      });
      mesh.scale.setScalar(0.8);
      const spot = tokenSpot(which);
      mesh.position.set(spot.x, spot.y + 3.5, spot.z);
      mesh.userData = { key, rest: spot, vy: 0, dim: 0, dimShown: -1, landed: false, spin: which === 'mine' ? -0.6 : 0.6 };
      scene.add(mesh);
      tokenMeshes[which] = mesh;
    }
    // Head Start and Ward stay in force all match; anything blocked or used up goes dull.
    const passive = tok && (tok.type === 'headstart' || tok.type === 'ward');
    if (mesh) mesh.userData.dimTarget = tok && (tok.cancelled || (tok.spent && !passive)) ? 1 : 0;
  }
}

function clearTokens3D() {
  for (const which of ['mine', 'theirs']) {
    if (tokenMeshes[which]) scene.remove(tokenMeshes[which]);
    tokenMeshes[which] = null;
  }
}

function updateTokens3D(dt) {
  for (const which of ['mine', 'theirs']) {
    const m = tokenMeshes[which];
    if (!m) continue;
    const u = m.userData;
    if (!u.landed) {
      // Dropped onto the table once, with a couple of small bounces.
      u.vy -= 20 * dt;
      m.position.y += u.vy * dt;
      if (m.position.y <= u.rest.y) {
        m.position.y = u.rest.y;
        if (u.vy < -3) { playCoinClink(); u.vy = -u.vy * 0.22; } else { u.vy = 0; u.landed = true; }
      }
    }
    u.dim += ((u.dimTarget || 0) - u.dim) * Math.min(1, dt * 2.5);
    // Active statuettes turn slowly; a used one stops and loses its shine.
    u.spin += dt * 0.35 * (1 - u.dim);
    m.rotation.set(0, u.spin, 0);
    if (Math.abs(u.dim - u.dimShown) > 0.01) {
      u.dimShown = u.dim;
      m.traverse(o => {
        if (!o.isMesh || !o.userData.baseColor) return;
        o.material.color.copy(o.userData.baseColor).multiplyScalar(1 - u.dim * 0.6);
        o.material.metalness = o.userData.baseMetal * (1 - u.dim * 0.7);
      });
    }
  }
}

/* ------------------------------------------------------------------ */
/* Dice motion (local visuals — run on every screen)                   */
/* ------------------------------------------------------------------ */

function localThrow({ indices, values, ends, yaws, owner }) {
  const fromZ = owner === mySeat ? 7.5 : -7.5;
  animating++;
  updateUI();
  const promises = indices.map((idx, order) => new Promise(resolve => {
    const die = dice[idx];
    die.value = values[order];
    die.held = false;
    die.mesh.visible = true;
    const endPos = new THREE.Vector3(ends[order][0], DIE_REST_Y, ends[order][1]);
    const startPos = new THREE.Vector3(rand(-2.2, 2.2), rand(2.6, 3.6), fromZ + rand(-0.5, 0.5));
    const travel = endPos.clone().sub(startPos).setY(0).normalize();
    const axis = new THREE.Vector3(travel.z, 0, -travel.x).normalize();
    axis.x += rand(-0.25, 0.25); axis.z += rand(-0.25, 0.25); axis.y = rand(-0.3, 0.3);
    axis.normalize();
    const endQuat = restQuat(die.value, yaws[order]);
    const spin = Math.PI * 2 * rand(2.2, 3.6);
    const startQuat = new THREE.Quaternion().setFromAxisAngle(axis, spin).multiply(endQuat);
    const bounce = rand(0.65, 1.0);
    die.anim = {
      type: 'throw', t: 0, delay: order * rand(0.03, 0.07), duration: rand(1.15, 1.45),
      startPos, endPos, startQuat, endQuat, axis, spin, bounce,
      contacts: [{ p: 0.3, v: 1 }, { p: 0.56, v: bounce * 0.6 }, { p: 0.75, v: bounce * 0.25 }, { p: 0.88, v: 0.08 }],
      resolve
    };
    die.mesh.position.copy(startPos);
    die.mesh.quaternion.copy(startQuat);
  }));
  playRattle();
  return Promise.all(promises).then(() => { animating--; updateUI(); });
}

function localReroll({ idx, value }) {
  const die = dice[idx];
  die.value = value;
  animating++;
  updateUI();
  playRattle();
  // Hop and tumble in place, landing on the new face.
  const endQuat = restQuat(value, rand(-0.6, 0.6));
  const axis = new THREE.Vector3(rand(-1, 1), 0, rand(-1, 1)).normalize();
  const spin = Math.PI * 2 * rand(1.6, 2.4);
  const startPos = die.mesh.position.clone();
  const endPos = die.rest.clone();
  return new Promise(resolve => {
    die.anim = {
      type: 'throw', t: 0, delay: 0, duration: 0.9,
      startPos: startPos.setY(DIE_REST_Y + 1.6), endPos, startQuat: new THREE.Quaternion().setFromAxisAngle(axis, spin).multiply(endQuat),
      endQuat, axis, spin, bounce: 0.5,
      contacts: [{ p: 0.3, v: 0.8 }, { p: 0.56, v: 0.3 }],
      resolve
    };
  }).then(() => { animating--; updateUI(); });
}

function moveDie(die, endPos, endQuat, duration = 0.5, hop = 0.7, delay = 0) {
  return new Promise(resolve => {
    die.anim = {
      type: 'move', t: 0, delay, duration,
      startPos: die.mesh.position.clone(), endPos: endPos.clone(),
      startQuat: die.mesh.quaternion.clone(), endQuat: endQuat.clone(),
      hop, resolve
    };
  });
}

function localHold({ indices }) {
  const existing = dice.filter((d, i) => d.held && !indices.includes(i)).length;
  return Promise.all(indices.map((idx, n) => {
    const die = dice[idx];
    die.held = true;
    return moveDie(die, keptPosition(existing + n), restQuat(die.value, 0), 0.55, 0.9, n * 0.06);
  }));
}

function centroid(indices) {
  const c = new THREE.Vector3();
  indices.forEach(i => c.add(dice[i].mesh.position));
  return c.divideScalar(Math.max(indices.length, 1));
}

function localReset() {
  endModal.classList.remove('show');
  stamp.className = 'stamp';
  popupLayer.innerHTML = '';
  popups.length = 0;
  logEl.innerHTML = '';
  fortuneMode = false;
  clearTokens3D();
  rebuildCoins('player', 0, false);
  rebuildCoins('ai', 0, false);
  const start = startLineup();
  dice.forEach((die, i) => {
    die.anim = null;
    die.value = i + 1;
    die.held = false;
    die.mesh.visible = true;
    die.rest.copy(start[i]);
    die.mesh.position.copy(start[i]);
    die.mesh.quaternion.copy(restQuat(die.value, (i % 2 ? 1 : -1) * 0.12));
  });
}

/* ------------------------------------------------------------------ */
/* Effects: run locally and, when hosting, mirrored to the guest       */
/* ------------------------------------------------------------------ */

const other = (seat) => (seat === 'player' ? 'ai' : 'player');
const isMe = (seat) => seat === mySeat;
const pick = (seat, you, them) => (seat && !isMe(seat) ? them : you);

function runFx(op, a) {
  switch (op) {
    case 'reset': localReset(); return null;
    case 'throw': return localThrow(a);
    case 'reroll': return localReroll(a);
    case 'hold': return localHold(a);
    case 'popup': spawnPopup(centroid(a.indices), `+${fmt(a.points)}`, isMe(a.seat) ? 'gain' : 'ai'); playImpact(0.2); return null;
    case 'log': addLog(a.seat ? (isMe(a.seat) ? 'player' : 'ai') : 'system', pick(a.seat, a.you, a.them)); return null;
    case 'banner': setBanner(pick(a.seat, a.you, a.them)); return null;
    case 'stamp':
      if (a.kind === 'bust') showBustStamp(a.word); else showStamp(a.word, a.kind);
      return null;
    case 'tokenFx': {
      const pos = tokenSpot(isMe(a.seat) ? 'mine' : 'theirs');
      spawnPopup(pos.clone().setY(0.4), a.text, a.bad ? 'bad' : (isMe(a.seat) ? 'gain' : 'ai'));
      playCoinClink();
      return null;
    }
    case 'coins':
      rebuildCoins('player', a.totals.player);
      rebuildCoins('ai', a.totals.ai);
      if (a.seat) pulse(isMe(a.seat) ? playerRow : aiRow);
      return null;
    case 'win': showWinner(a.seat, a.totals); return null;
    default: return null;
  }
}

function emit(op, a = {}) {
  if (mode === 'online' && role === 'host') netSend({ t: 'fx', op, a });
  return runFx(op, a);
}

function snapshot() {
  return {
    stage: game.stage, current: game.current, phase: game.phase, totals: game.totals, turnScore: game.turnScore,
    active: game.active, selected: [...game.selected], winner: game.winner,
    draws: game.draws, tokens: game.tokens, prompt: game.prompt,
    picked: { player: game.picks.player !== null, ai: game.picks.ai !== null },
    values: dice.map(d => d.value), held: dice.map(d => d.held)
  };
}

// Push the authoritative state to the guest and refresh our own UI.
function sync() {
  if (mode === 'online' && role === 'host') netSend({ t: 'state', s: snapshot() });
  updateUI();
}

function applyState(s) {
  Object.assign(game, {
    stage: s.stage, current: s.current, phase: s.phase, totals: s.totals, turnScore: s.turnScore,
    active: s.active, selected: new Set(s.selected), winner: s.winner,
    draws: s.draws, tokens: s.tokens, prompt: s.prompt, picked: s.picked
  });
  dice.forEach((d, i) => { if (!d.anim) { d.value = s.values[i]; } d.held = s.held[i]; });
  updateUI();
}

function hasPicked(seat) {
  if (game.picked) return !!game.picked[seat];
  return game.picks && game.picks[seat] !== null;
}

/* ------------------------------------------------------------------ */
/* Game engine (runs on the host, or locally against the computer)     */
/* ------------------------------------------------------------------ */

const allDice = () => Array.from({ length: DICE_COUNT }, (_, i) => i);

function freshGame(first = 'player') {
  return {
    stage: 'draw',
    current: first,
    phase: 'ready',
    totals: { player: 0, ai: 0 },
    turnScore: 0,
    active: allDice(),
    selected: new Set(),
    winner: null,
    draws: { player: null, ai: null },
    picks: { player: null, ai: null },
    tokens: { player: null, ai: null },
    prompt: null
  };
}

function seatName(seat) {
  return seat === 'ai' && mode === 'ai' ? 'The computer' : 'Your opponent';
}

function newGame() {
  if (mode === 'online' && role === 'guest') { netSend({ t: 'act', a: 'newgame' }); return; }
  gameToken++;
  if (tollResolver) { tollResolver(false); tollResolver = null; }
  const first = mode === 'online' ? (Math.random() < 0.5 ? 'player' : 'ai') : 'player';
  game = freshGame(first);
  aiDrawTarget = null;
  emit('reset');
  emit('log', { seat: null, you: 'A new match begins. First, each player takes one turn to draw for a token.' });
  emit('banner', { seat: first, you: 'Token draw: take one turn. The more you bank, the better the metal.', them: `${seatName(first)} draws for a token first.` });
  sync();
  if (controllerOf(game.current) === 'ai') aiTurn();
}

function controllerOf(seat) {
  if (seat === mySeat) return 'local';
  return mode === 'ai' ? 'ai' : 'remote';
}

async function doRoll(seat) {
  if (!game || game.current !== seat || game.phase !== 'ready' || game.winner || game.stage === 'pick') return;
  const token = gameToken;
  game.phase = 'busy';
  game.selected.clear();
  const values = game.active.map(rollD6);
  const ends = scatterPositions(values.length).map(p => [+p.x.toFixed(3), +p.z.toFixed(3)]);
  const yaws = values.map(() => +rand(-Math.PI, Math.PI).toFixed(3));
  sync();
  emit('banner', { seat, you: 'You shake the dice…', them: `${seatName(seat)} shakes the dice…` });
  await sleep(320);
  if (token !== gameToken) return;
  emit('log', { seat, you: `You roll ${values.join(', ')}.`, them: `${seatName(seat)} rolls ${values.join(', ')}.` });
  await emit('throw', { indices: [...game.active], values, ends, yaws, owner: seat });
  if (token !== gameToken) return;
  await afterRoll(seat, token);
}

// Shared by a fresh roll and a Fortune re-roll.
async function afterRoll(seat, token) {
  const values = game.active.map(i => dice[i].value);
  if (!hasScoringSubset(values)) {
    const tok = game.tokens[seat];
    if (game.stage === 'match' && tok && tok.type === 'fortune' && tokenUsable(tok)) {
      game.phase = 'bustPending';
      emit('banner', {
        seat,
        you: `Nothing scores! Re-roll a die with Fortune (${tok.uses} left) or take the bust.`,
        them: `${seatName(seat)} rolled nothing… and reaches for Fortune.`
      });
      sync();
      if (controllerOf(seat) === 'ai') {
        await sleep(1000);
        if (token !== gameToken) return;
        await doFortune(seat, game.active[Math.floor(Math.random() * game.active.length)]);
      }
      return;
    }
    await finalizeBust(seat);
    return;
  }
  game.phase = 'selecting';
  emit('banner', game.stage === 'draw'
    ? { seat, you: 'Draw turn: keep scoring dice, then bank to take your token — or push for a better metal.', them: `${seatName(seat)} is drawing…` }
    : { seat, you: 'Tap scoring dice to keep them, then roll on or bank.', them: `${seatName(seat)} is choosing dice…` });
  sync();
}

async function finalizeBust(seat) {
  if (!game || game.current !== seat) return;
  const token = gameToken;
  const lost = game.turnScore;
  const tok = game.tokens[seat];
  let saved = 0;
  if (game.stage === 'match' && tok && tok.type === 'wind' && tok.armed && tokenUsable(tok) && lost > 0) {
    saved = round5(lost * tokenVal(tok) / 100);
    tok.uses = 0; tok.spent = true; tok.armed = false;
    game.totals[seat] += saved;
  }
  game.turnScore = 0;
  game.phase = 'busy';
  if (game.stage === 'draw') {
    emit('log', { seat, you: 'Bust! No token for you this match.', them: `${seatName(seat)} busts the draw — no token.` });
  } else {
    emit('log', {
      seat,
      you: `Bust! Nothing to keep${lost ? ` — ${fmt(lost)} lost` : ''}.`,
      them: `${seatName(seat)} busts${lost ? ` and loses ${fmt(lost)}` : ''}.`
    });
  }
  emit('banner', { seat, you: 'Bust! Your turn ends.', them: `${seatName(seat)} busts!` });
  emit('stamp', { kind: 'bust', word: BUST_WORDS[Math.floor(Math.random() * BUST_WORDS.length)] });
  if (saved) {
    emit('log', { seat, you: `Second Wind saves ${fmt(saved)} of it.`, them: `Their Second Wind saves ${fmt(saved)}.` });
    emit('tokenFx', { seat, text: `Second Wind +${fmt(saved)}` });
    emit('coins', { totals: game.totals, seat });
  }
  sync();
  await sleep(1800);
  if (token !== gameToken) return;
  if (game.stage === 'draw') { await recordDraw(seat, 0); return; }
  if (game.totals[seat] >= WIN_SCORE) { finish(seat); return; }
  passTurn();
}

function doToggle(seat, idx) {
  if (!game || game.current !== seat || game.phase !== 'selecting' || !game.active.includes(idx)) return;
  if (game.selected.has(idx)) game.selected.delete(idx);
  else game.selected.add(idx);
  sync();
}

async function doFortune(seat, idx) {
  const tok = game && game.tokens[seat];
  if (!game || game.stage !== 'match' || game.current !== seat || !['selecting', 'bustPending'].includes(game.phase)) return;
  if (!tok || tok.type !== 'fortune' || !tokenUsable(tok) || !game.active.includes(idx)) return;
  const token = gameToken;
  const old = dice[idx].value;
  game.phase = 'busy';
  tok.uses--;
  if (tok.uses <= 0) tok.spent = true;
  game.selected.clear();
  const value = rollD6();
  sync();
  emit('tokenFx', { seat, text: 'Fortune!' });
  await emit('reroll', { idx, value });
  if (token !== gameToken) return;
  emit('log', { seat, you: `Fortune: your ${old} becomes a ${value}.`, them: `${seatName(seat)} uses Fortune: a ${old} becomes a ${value}.` });
  await afterRoll(seat, token);
}

function doTokenToggle(seat) {
  const tok = game && game.tokens[seat];
  if (!tok || !tokenUsable(tok) || game.stage !== 'match' || game.winner) return;
  if (tok.type === 'wind') { tok.armed = !tok.armed; sync(); return; }
  if (tok.type === 'rally' && game.current === seat && ['ready', 'selecting'].includes(game.phase)) {
    tok.armed = !tok.armed;
    if (tok.armed) emit('log', { seat, you: `Rally armed: your next banked turn gets +${tokenVal(tok)}%.`, them: `${seatName(seat)} arms a Rally (+${tokenVal(tok)}% on their next bank).` });
    sync();
  }
}

// Keep the selected dice. bank=true ends the turn; otherwise the same player rolls the rest.
async function doKeep(seat, bank) {
  if (!game || game.current !== seat || game.phase !== 'selecting' || game.winner) return;
  const indices = [...game.selected];
  const values = indices.map(i => dice[i].value);
  const score = scoreSelection(values);
  if (!score.valid) return;
  const token = gameToken;

  game.phase = 'busy';
  game.turnScore += score.points;
  game.active = game.active.filter(i => !game.selected.has(i));
  game.selected.clear();
  dice.forEach((d, i) => { if (indices.includes(i)) d.held = true; });
  emit('popup', { indices, points: score.points, seat });
  emit('log', {
    seat,
    you: `You keep ${values.join(', ')} for ${fmt(score.points)}. Turn: ${fmt(game.turnScore)}.`,
    them: `${seatName(seat)} keeps ${values.join(', ')} for ${fmt(score.points)}. Turn: ${fmt(game.turnScore)}.`
  });
  sync();
  await emit('hold', { indices });
  if (token !== gameToken) return;

  if (bank) {
    if (game.stage === 'draw') {
      const drawn = game.turnScore;
      game.turnScore = 0;
      await recordDraw(seat, drawn);
      return;
    }
    let banked = game.turnScore;
    const tok = game.tokens[seat];
    if (tok && tok.type === 'rally' && tok.armed && tokenUsable(tok)) {
      const bonus = round5(banked * tokenVal(tok) / 100);
      banked += bonus;
      tok.uses = 0; tok.spent = true; tok.armed = false;
      emit('tokenFx', { seat, text: `Rally +${fmt(bonus)}` });
      emit('log', { seat, you: `Rally adds ${fmt(bonus)}.`, them: `Their Rally adds ${fmt(bonus)}.` });
    }
    game.totals[seat] += banked;
    game.turnScore = 0;
    emit('log', {
      seat,
      you: `You bank ${fmt(banked)}. Your purse: ${fmt(game.totals[seat])}.`,
      them: `${seatName(seat)} banks ${fmt(banked)}. Their purse: ${fmt(game.totals[seat])}.`
    });
    emit('banner', { seat, you: `You banked ${fmt(banked)}.`, them: `${seatName(seat)} banks ${fmt(banked)}.` });
    emit('coins', { totals: game.totals, seat });
    sync();

    const opp = other(seat);
    const toll = game.tokens[opp];
    if (toll && toll.type === 'toll' && tokenUsable(toll) && banked > 0) {
      const cut = round5(banked * tokenVal(toll) / 100);
      const use = await askToll(opp, seat, banked, cut);
      if (token !== gameToken) return;
      if (use) {
        toll.uses = 0; toll.spent = true;
        game.totals[seat] -= cut;
        emit('tokenFx', { seat: opp, text: `Toll −${fmt(cut)}`, bad: true });
        emit('log', { seat: opp, you: `Your Toll takes ${fmt(cut)} from their turn.`, them: `${seatName(opp)}’s Toll takes ${fmt(cut)} from your turn.` });
        emit('coins', { totals: game.totals, seat });
      }
      game.prompt = null;
      game.phase = 'busy';
      sync();
    }

    if (game.totals[seat] >= WIN_SCORE) { finish(seat); return; }
    await sleep(1000);
    if (token !== gameToken) return;
    passTurn();
    return;
  }

  if (game.active.length === 0) {
    game.active = allDice();
    dice.forEach(d => { d.held = false; });
    emit('log', { seat, you: 'Hot dice! All six scored — you take them all back.', them: `Hot dice — ${seatName(seat).toLowerCase()} takes all six back.` });
    emit('stamp', { kind: 'hot', word: 'HOT DICE!' });
    await sleep(600);
    if (token !== gameToken) return;
  }
  game.phase = 'ready';
  emit('banner', { seat, you: `${fmt(game.turnScore)} at stake. Rolling on…`, them: `${seatName(seat)} rolls on with ${fmt(game.turnScore)} at stake…` });
  sync();
}

let tollResolver = null;
async function askToll(owner, target, banked, cut) {
  game.phase = 'tollPending';
  game.prompt = { kind: 'toll', seat: owner, banked, cut };
  emit('banner', { seat: owner, you: `Use your Toll? It would cut their ${fmt(banked)} by ${fmt(cut)}.`, them: `${seatName(owner)} is weighing their Toll…` });
  sync();
  if (controllerOf(owner) === 'ai') {
    await sleep(1300);
    return banked >= 500 || game.totals[target] >= WIN_SCORE;
  }
  return new Promise(resolve => { tollResolver = resolve; });
}

function answerToll(seat, use) {
  if (!game || game.phase !== 'tollPending' || !game.prompt || game.prompt.seat !== seat || !tollResolver) return;
  const r = tollResolver;
  tollResolver = null;
  r(!!use);
}

async function keepAndRollOn(seat) {
  await doKeep(seat, false);
  if (game.current === seat && game.phase === 'ready' && !game.winner) {
    await sleep(250);
    await doRoll(seat);
  }
}

function resetTurnDice() {
  game.turnScore = 0;
  game.active = allDice();
  game.selected.clear();
  dice.forEach(d => { d.held = false; });
}

function passTurn() {
  if (game.winner) return;
  const next = other(game.current);
  game.current = next;
  game.phase = 'ready';
  resetTurnDice();
  emit('banner', { seat: next, you: 'Your throw. Roll all six dice.', them: `${seatName(next)} takes the dice.` });
  sync();
  if (controllerOf(next) === 'ai') aiTurn();
}

/* Token draw and pick */

async function recordDraw(seat, score) {
  const token = gameToken;
  game.draws[seat] = score;
  const tier = tierFor(score);
  if (tier >= 0) {
    emit('log', { seat, you: `You draw ${fmt(score)}: ${aMetal(tier)} token.`, them: `${seatName(seat)} draws ${fmt(score)}: ${aMetal(tier)} token.` });
    emit('stamp', { kind: 'hot', word: `${METALS[tier]}!` });
  }
  game.phase = 'busy';
  sync();
  await sleep(1500);
  if (token !== gameToken) return;
  resetTurnDice();
  const opp = other(seat);
  if (game.draws[opp] === null) {
    game.current = opp;
    game.phase = 'ready';
    emit('banner', { seat: opp, you: 'Your token draw: take one turn.', them: `${seatName(opp)} draws for a token.` });
    sync();
    if (controllerOf(opp) === 'ai') aiTurn();
    return;
  }
  game.stage = 'pick';
  game.phase = 'pick';
  for (const s of ['player', 'ai']) if (tierFor(game.draws[s]) < 0) game.picks[s] = 'none';
  emit('banner', { seat: null, you: 'Choose your token.' });
  sync();
  if (mode === 'ai' && game.picks.ai === null) {
    await sleep(600);
    game.picks.ai = aiPickToken();
    sync();
  }
  maybeResolvePicks();
}

function doPick(seat, type) {
  if (!game || game.stage !== 'pick' || game.picks[seat] !== null) return;
  if (!TOKEN_TYPES.includes(type) || tierFor(game.draws[seat]) < 0) return;
  game.picks[seat] = type;
  sync();
  maybeResolvePicks();
}

function maybeResolvePicks() {
  if (game.stage === 'pick' && game.picks.player !== null && game.picks.ai !== null) resolvePicks();
}

async function resolvePicks() {
  const token = gameToken;
  game.stage = 'reveal';
  const t = game.tokens;
  for (const s of ['player', 'ai']) {
    t[s] = game.picks[s] === 'none' ? null : makeToken(game.picks[s], tierFor(game.draws[s]));
  }
  for (const s of ['player', 'ai']) {
    const tok = t[s];
    if (tok) emit('log', { seat: s, you: `You take ${aMetal(tok.tier)} ${TOKEN_INFO[tok.type].name}.`, them: `${seatName(s)} takes ${aMetal(tok.tier)} ${TOKEN_INFO[tok.type].name}.` });
    else emit('log', { seat: s, you: 'You play without a token.', them: `${seatName(s)} plays without a token.` });
  }
  // Ward resolves against the original metals.
  const orig = { player: t.player && t.player.tier, ai: t.ai && t.ai.tier };
  for (const s of ['player', 'ai']) {
    const w = t[s], target = t[other(s)];
    if (!w || w.type !== 'ward') continue;
    w.spent = true;
    if (!target || target.type === 'ward') continue;
    if (orig[s] >= orig[other(s)]) {
      target.cancelled = true;
      emit('log', { seat: s, you: `Your Aegis blocks their ${TOKEN_INFO[target.type].name}.`, them: `${seatName(s)}’s Aegis blocks your ${TOKEN_INFO[target.type].name}.` });
    } else {
      target.tier = Math.max(0, target.tier - 2);
      if (target.type === 'fortune') target.uses = TOKEN_INFO.fortune.vals[target.tier];
      emit('log', { seat: s, you: `Your Aegis knocks their token down to ${METALS[target.tier]}.`, them: `${seatName(s)}’s Aegis knocks your token down to ${METALS[target.tier]}.` });
    }
  }
  for (const s of ['player', 'ai']) {
    const tok = t[s];
    if (tok && tok.type === 'headstart' && !tok.cancelled) {
      game.totals[s] += tokenVal(tok);
      tok.spent = true;
      emit('log', { seat: s, you: `Head Start: you begin with ${fmt(tokenVal(tok))}.`, them: `${seatName(s)} begins with ${fmt(tokenVal(tok))} (Head Start).` });
    }
  }
  const dp = game.draws.player, da = game.draws.ai;
  const first = dp === da ? (Math.random() < 0.5 ? 'player' : 'ai') : (dp < da ? 'player' : 'ai');
  game.phase = 'busy';
  sync();
  emit('coins', { totals: game.totals });
  emit('stamp', { kind: 'hot', word: 'Tokens revealed' });
  await sleep(2000);
  if (token !== gameToken) return;
  game.stage = 'match';
  game.current = first;
  game.phase = 'ready';
  resetTurnDice();
  emit('banner', { seat: first, you: 'The match begins — your throw (lower draw goes first).', them: `The match begins — ${seatName(first).toLowerCase()} throws first.` });
  sync();
  if (controllerOf(first) === 'ai') aiTurn();
}

function finish(seat) {
  game.winner = seat;
  game.phase = 'gameOver';
  emit('log', {
    seat,
    you: `Victory — ${fmt(game.totals[seat])} to ${fmt(game.totals[other(seat)])}.`,
    them: `Defeat — ${fmt(game.totals[seat])} to ${fmt(game.totals[other(seat)])}.`
  });
  emit('banner', { seat, you: 'Victory! The purse is yours.', them: `${seatName(seat)} takes the purse.` });
  emit('win', { seat, totals: game.totals });
  sync();
}

/* Computer opponent */

let aiDrawTarget = null;

function aiPickToken() {
  const mine = tierFor(game.draws.ai);
  if (mine < 0) return 'none';
  const theirs = tierFor(game.draws.player);
  const weights = { headstart: 2, rally: 2, wind: 2, fortune: 2, toll: 2, ward: theirs < 0 ? 0 : (theirs > mine ? 3 : 1) };
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const [k, w] of Object.entries(weights)) { r -= w; if (r <= 0) return k; }
  return 'headstart';
}

async function aiTurn() {
  const token = gameToken;
  await sleep(700);
  if (game.stage === 'draw' && aiDrawTarget === null) aiDrawTarget = [250, 400, 400, 550, 550, 750][Math.floor(Math.random() * 6)];
  while (token === gameToken && game.current === 'ai' && !game.winner && (game.stage === 'draw' || game.stage === 'match')) {
    const stage = game.stage;
    await doRoll('ai');
    if (token !== gameToken || game.current !== 'ai' || game.phase !== 'selecting' || game.stage !== stage) return;

    const values = game.active.map(i => dice[i].value);
    const options = getScoringOptions(values);
    const choice = chooseAiOption(values, options);
    const chosen = choice.maskIndices.map(local => game.active[local]);
    await sleep(450);
    chosen.forEach(i => game.selected.add(i));
    sync();
    await sleep(800);
    if (token !== gameToken) return;

    const turnAfter = game.turnScore + choice.points;
    const left = values.length - chosen.length;
    const diceLeft = left === 0 ? DICE_COUNT : left;
    let bank;
    if (stage === 'draw') {
      bank = turnAfter >= aiDrawTarget || (diceLeft <= 2 && turnAfter >= 150);
    } else {
      const behind = game.totals.ai < game.totals.player;
      bank = game.totals.ai + turnAfter >= WIN_SCORE || turnAfter >= (behind ? 900 : 650) || (turnAfter >= 400 && diceLeft <= 2);
      const tok = game.tokens.ai;
      if (bank && tok && tok.type === 'rally' && tokenUsable(tok) && !tok.armed && turnAfter >= 500) {
        tok.armed = true;
        emit('log', { seat: 'ai', you: '', them: `${seatName('ai')} arms a Rally (+${tokenVal(tok)}%).` });
      }
    }
    await doKeep('ai', bank);
    if (bank || token !== gameToken) return;
    await sleep(400);
  }
}

function chooseAiOption(values, options) {
  const diceLeftAfter = (opt) => values.length - opt.maskIndices.length;
  const sorted = [...options].sort((a, b) => {
    const va = a.points + (diceLeftAfter(a) === 0 ? 250 : 0) - (diceLeftAfter(a) === 1 ? 70 : 0);
    const vb = b.points + (diceLeftAfter(b) === 0 ? 250 : 0) - (diceLeftAfter(b) === 1 ? 70 : 0);
    return vb - va;
  });
  const singleOne = options.find(o => o.points === 100 && o.maskIndices.length === 1 && values[o.maskIndices[0]] === 1);
  const singleFive = options.find(o => o.points === 50 && o.maskIndices.length === 1 && values[o.maskIndices[0]] === 5);
  if (game.turnScore < 250 && values.length >= 5 && singleOne && sorted[0].points < 500) return singleOne;
  if (game.turnScore < 200 && values.length >= 5 && singleFive && sorted[0].points < 300 && Math.random() < 0.35) return singleFive;
  return sorted[0];
}

/* ------------------------------------------------------------------ */
/* Local player actions (routed to the host when we are the guest)     */
/* ------------------------------------------------------------------ */

let fortuneMode = false;

function act(a, extra = {}) {
  if (!game) return;
  if (mode === 'online' && role === 'guest') {
    netSend({ t: 'act', a, ...extra });
    return;
  }
  runAct(mySeat, { a, ...extra });
}

function runAct(seat, msg) {
  switch (msg.a) {
    case 'roll': doRoll(seat); break;
    case 'toggle': doToggle(seat, msg.idx); break;
    case 'continue': keepAndRollOn(seat); break;
    case 'bank': doKeep(seat, true); break;
    case 'pick': doPick(seat, msg.type); break;
    case 'token': doTokenToggle(seat); break;
    case 'fortune': doFortune(seat, msg.idx); break;
    case 'acceptBust': if (game.phase === 'bustPending' && game.current === seat) finalizeBust(seat); break;
    case 'toll': answerToll(seat, msg.use); break;
    default: break;
  }
}

function hostHandleRemote(msg) {
  const seat = other(mySeat);
  if (msg.a === 'newgame') {
    newGame();
    emit('log', { seat, you: 'You started a new match.', them: 'Your opponent started a new match.' });
    return;
  }
  runAct(seat, msg);
}

function canRoll() {
  return mode !== 'offline' && !!game && (game.stage === 'draw' || game.stage === 'match') && game.current === mySeat && game.phase === 'ready' && !animating && !game.winner;
}

function canKeep() {
  if (mode === 'offline' || !game || game.current !== mySeat || game.phase !== 'selecting' || animating || game.winner || fortuneMode) return false;
  return scoreSelection(selectedActiveValues()).valid;
}

function myToken() { return game && game.tokens ? game.tokens[mySeat] : null; }

function canFortune() {
  const tok = myToken();
  return !!tok && tok.type === 'fortune' && tokenUsable(tok) && game.stage === 'match' && game.current === mySeat &&
    ['selecting', 'bustPending'].includes(game.phase) && !animating && !game.winner && mode !== 'offline';
}

function onMyTokenClick() {
  const tok = myToken();
  if (!tok || !tokenUsable(tok)) return;
  if (tok.type === 'fortune') {
    if (canFortune()) { fortuneMode = !fortuneMode; updateUI(); }
    return;
  }
  if (tok.type === 'rally' || tok.type === 'wind') act('token');
}

/* ------------------------------------------------------------------ */
/* Input                                                               */
/* ------------------------------------------------------------------ */

function isSelectable(idx) {
  if (fortuneMode) return canFortune() && game.active.includes(idx);
  return mode !== 'offline' && !!game && game.current === mySeat && game.phase === 'selecting' && !animating && !game.winner && game.active.includes(idx);
}

function pickDie(event, forgiving = false) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(dice.map(d => d.mesh).filter(m => m.visible));
  if (hits.length) return hits[0].object.userData.index;
  if (!forgiving) return -1;
  // Fingers are bigger than dice on a phone: take the nearest selectable die within reach.
  let best = -1, bestD = Math.max(34, rect.width * 0.06);
  dice.forEach((d, i) => {
    if (!isSelectable(i)) return;
    _tmpV.copy(d.mesh.position).project(camera);
    const x = (_tmpV.x * 0.5 + 0.5) * rect.width + rect.left;
    const y = (-_tmpV.y * 0.5 + 0.5) * rect.height + rect.top;
    const dist = Math.hypot(x - event.clientX, y - event.clientY);
    if (dist < bestD) { bestD = dist; best = i; }
  });
  return best;
}

function onPointerMove(event) {
  if (event.pointerType === 'touch') return;
  const idx = pickDie(event);
  hoveredIdx = idx;
  canvas.style.cursor = idx >= 0 && isSelectable(idx) ? 'pointer' : 'default';
}

function onPointerDown(event) {
  const idx = pickDie(event, true);
  if (idx < 0 || !isSelectable(idx)) return;
  if (fortuneMode) {
    fortuneMode = false;
    act('fortune', { idx });
    updateUI();
    return;
  }
  playImpact(0.15);
  if (mode === 'online' && role === 'guest') {
    // Toggle immediately for responsiveness; the host's state confirms it.
    if (game.selected.has(idx)) game.selected.delete(idx); else game.selected.add(idx);
    updateUI();
    netSend({ t: 'act', a: 'toggle', idx });
  } else {
    doToggle(mySeat, idx);
  }
}

function selectedActiveValues() {
  return game ? [...game.selected].map(idx => dice[idx].value) : [];
}

function onKey(e) {
  if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
  if (lobby.classList.contains('show')) return;
  const k = e.key.toLowerCase();
  if (k === ' ' || k === 'r') { e.preventDefault(); if (canRoll()) act('roll'); }
  else if (k === 'c') { if (canKeep()) act('continue'); }
  else if (k === 'p' || k === 'enter') { e.preventDefault(); if (canKeep()) act('bank'); }
  else if (k === 't') onMyTokenClick();
  else if (k === 'escape' && fortuneMode) { fortuneMode = false; updateUI(); }
  else if (k === 'm') toggleSound();
}

/* ------------------------------------------------------------------ */
/* UI                                                                  */
/* ------------------------------------------------------------------ */

function tokenStatus(tok, seat) {
  if (!tok) {
    const d = game.draws && game.draws[seat];
    if (game.stage === 'draw') return d === null ? (game.current === seat ? 'Drawing…' : 'Draws next') : (tierFor(d) < 0 ? 'Busted the draw' : `${METALS[tierFor(d)]} (${fmt(d)})`);
    if (game.stage === 'pick') return tierFor(d) < 0 ? 'No token' : `${METALS[tierFor(d)]} · ${hasPicked(seat) ? 'chosen' : 'choosing…'}`;
    return 'No token';
  }
  if (tok.cancelled) return 'Blocked by Ward';
  const v = tokenVal(tok);
  switch (tok.type) {
    case 'headstart': return `+${fmt(v)} at start`;
    case 'ward': return 'Ward · resolved';
    case 'rally': return tok.spent ? 'Rally · used' : (tok.armed ? `Armed: +${v}% next bank` : `+${v}% · tap to arm`);
    case 'wind': return tok.spent ? 'Second Wind · used' : (tok.armed ? `Ready: keeps ${v}% on bust` : `Held · tap to ready`);
    case 'fortune': return tok.spent ? 'Fortune · used' : `${tok.uses} re-roll${tok.uses > 1 ? 's' : ''} · tap, then a die`;
    case 'toll': return tok.spent ? 'Toll · used' : `−${v}% of their next bank`;
    default: return '';
  }
}

function renderChip(el, tok, seat, mine) {
  const img = el.querySelector('img');
  const txt = el.querySelector('.tc-text');
  const show = !!game && (game.stage !== 'draw' || game.draws[seat] !== null || game.current === seat);
  el.hidden = !show;
  if (!show) return;
  if (tok) {
    const src = tokenImageUrl(tok.type, tok.tier);
    if (img.getAttribute('src') !== src) img.setAttribute('src', src);
    img.hidden = false;
  } else {
    img.hidden = true;
  }
  txt.textContent = tokenStatus(tok, seat);
  el.classList.toggle('spent', !!tok && (tok.spent || tok.cancelled));
  el.classList.toggle('armed', !!tok && tok.armed && !tok.spent);
  const actionable = mine && tok && tokenUsable(tok) && (
    tok.type === 'wind' || (tok.type === 'rally' && game.current === mySeat && ['ready', 'selecting'].includes(game.phase)) || (tok.type === 'fortune' && canFortune()));
  el.classList.toggle('actionable', !!actionable);
  el.classList.toggle('active-mode', mine && fortuneMode);
  if (mine) el.disabled = !actionable;
  el.title = tok ? `${tokenTitle(tok)}: ${TOKEN_INFO[tok.type].text(tokenVal(tok))}` : '';
}

function renderPrompt() {
  let html = '';
  if (game && game.phase === 'tollPending' && game.prompt && game.prompt.seat === mySeat) {
    html = `<span>Use your Toll? Their ${fmt(game.prompt.banked)} would lose <b>${fmt(game.prompt.cut)}</b>.</span>
      <button class="btn gold" data-p="toll-yes">Use Toll</button><button class="btn ghost" data-p="toll-no">Save it</button>`;
  } else if (fortuneMode && canFortune()) {
    html = `<span>Tap a die to re-roll it.</span><button class="btn ghost" data-p="fortune-cancel">Cancel</button>`;
  } else if (game && game.phase === 'bustPending' && game.current === mySeat && !animating) {
    const tok = myToken();
    html = `<span>Nothing scores. Use Fortune (${tok ? tok.uses : 0} left)?</span>
      <button class="btn gold" data-p="fortune">Re-roll a die</button><button class="btn ghost" data-p="bust">Take the bust</button>`;
  }
  if (promptBar.dataset.html !== html) {
    promptBar.innerHTML = html;
    promptBar.dataset.html = html;
  }
  promptBar.classList.toggle('show', !!html);
}

function renderPicker() {
  const show = !!game && game.stage === 'pick' && mode !== 'offline';
  pickModal.classList.toggle('show', show);
  if (!show) { pickModal.dataset.key = ''; return; }
  const myTier = tierFor(game.draws[mySeat]);
  const theirTier = tierFor(game.draws[other(mySeat)]);
  const picked = hasPicked(mySeat);
  const key = `${myTier}|${theirTier}|${picked}|${hasPicked(other(mySeat))}|${mode}`;
  if (pickModal.dataset.key === key) return;
  pickModal.dataset.key = key;
  const oppName = mode === 'ai' ? 'The computer' : 'Your opponent';
  pickTitle.textContent = myTier < 0 ? 'No token this match' : `Your token: ${METALS[myTier]}`;
  pickSub.textContent = (myTier < 0 ? 'You busted the draw. ' : `You drew ${fmt(game.draws[mySeat])}. `) +
    (theirTier < 0 ? `${oppName} busted and gets no token.` : `${oppName} drew ${METALS[theirTier]}${hasPicked(other(mySeat)) ? ' and has chosen.' : ' and is choosing.'}`);
  if (myTier < 0 || picked) {
    pickGrid.innerHTML = '';
    pickWait.hidden = false;
    pickWait.textContent = myTier < 0 ? `Waiting for ${oppName.toLowerCase()} to choose…` : `Chosen. Waiting for ${oppName.toLowerCase()}…`;
    return;
  }
  pickWait.hidden = true;
  pickGrid.innerHTML = TOKEN_TYPES.map(type => {
    const v = TOKEN_INFO[type].vals[myTier];
    return `<button class="pick-card" data-type="${type}">
      <canvas class="statue-view" width="${IS_MOBILE ? 180 : 220}" height="${IS_MOBILE ? 180 : 220}" data-type="${type}" data-tier="${myTier}"></canvas>
      <b>${TOKEN_INFO[type].name}</b>
      <em>${TOKEN_INFO[type].role}</em>
      <span>${TOKEN_INFO[type].text(v)}</span>
    </button>`;
  }).join('');
  registerTurntables(pickGrid);
}

function updateUI() {
  if (!game) return;
  const me = mySeat;
  const them = other(me);
  const oppLabel = mode === 'ai' ? 'Computer' : 'Opponent';
  aiNameEls.forEach(el => { el.textContent = oppLabel; });
  playerTotalEls.forEach(el => { el.textContent = fmt(game.totals[me]); });
  aiTotalEls.forEach(el => { el.textContent = fmt(game.totals[them]); });
  playerBars.forEach(el => { el.style.width = `${Math.min(100, (game.totals[me] / WIN_SCORE) * 100)}%`; });
  aiBars.forEach(el => { el.style.width = `${Math.min(100, (game.totals[them] / WIN_SCORE) * 100)}%`; });
  const myTurn = game.current === me;
  const playing = game.stage === 'draw' || game.stage === 'match';
  playerRow.classList.toggle('active', playing && myTurn && !game.winner);
  aiRow.classList.toggle('active', playing && !myTurn && !game.winner);
  hud.classList.toggle('my-turn', myTurn);

  if (fortuneMode && !canFortune()) fortuneMode = false;
  dice.forEach((d, i) => { d.selected = game.phase === 'selecting' && game.selected.has(i); });

  const selected = selectedActiveValues();
  const selectedScore = scoreSelection(selected);
  const projected = game.turnScore + (game.phase === 'selecting' && selectedScore.valid ? selectedScore.points : 0);

  turnScoreEl.textContent = fmt(projected);
  bankedThisTurnEl.textContent = fmt(game.turnScore);
  selectedScoreEl.textContent = selectedScore.valid ? fmt(selectedScore.points) : (selected.length ? 'not valid' : '0');
  selectedScoreEl.classList.toggle('invalid', selected.length > 0 && !selectedScore.valid);

  let tier = 'empty';
  if (projected > 1000) tier = 'huge';
  else if (projected >= 600) tier = 'large';
  else if (projected >= 300) tier = 'medium';
  else if (projected > 0) tier = 'small';
  turnPouch.className = `turn-pouch ${tier}`;
  turnPouch.hidden = !playing;
  if (game.stage === 'draw') {
    const t = tierFor(projected);
    turnPouchLabel.textContent = myTurn ? (t < 0 ? 'Draw score' : `Draw: ${METALS[t]} token`) : `${oppLabel}’s draw`;
  } else {
    turnPouchLabel.textContent = !myTurn
      ? `${oppLabel}’s turn`
      : (selected.length && !selectedScore.valid ? 'Not a scoring pick' : (selectedScore.valid && selected.length ? 'At stake if kept' : 'At stake this turn'));
  }

  let ribbon;
  if (game.winner) ribbon = 'Match over';
  else if (game.stage === 'draw') ribbon = myTurn ? 'Your token draw' : `${oppLabel}’s token draw`;
  else if (game.stage === 'pick' || game.stage === 'reveal') ribbon = 'Choose tokens';
  else ribbon = myTurn ? 'Your throw' : `${oppLabel}’s throw`;
  turnRibbon.textContent = ribbon;
  turnRibbon.className = `turn-ribbon ${myTurn || !playing ? 'player' : 'ai'}`;

  const keepOk = canKeep();
  rollBtn.disabled = !canRoll();
  continueBtn.disabled = !keepOk;
  passBtn.disabled = !keepOk;
  passBtn.querySelector('span').textContent = game.stage === 'draw' ? 'Keep & take token' : 'Keep & bank';
  if (game.stage === 'draw') {
    const t = tierFor(projected);
    passBtn.querySelector('.btn-sub').textContent = keepOk ? (t < 0 ? 'no token' : `${METALS[t]} token`) : 'take token';
  } else {
    passBtn.querySelector('.btn-sub').textContent = keepOk ? `bank ${fmt(projected)}` : 'bank points';
  }
  continueBtn.querySelector('.btn-sub').textContent = keepOk ? `${game.active.length - selected.length || 6} dice left` : 'risk it';
  controlsEl.classList.toggle('waiting', !myTurn || !!game.winner || !playing);
  netBadge.hidden = mode !== 'online';

  renderChip(myChip, game.tokens ? game.tokens[me] : null, me, true);
  renderChip(oppChip, game.tokens ? game.tokens[them] : null, them, false);
  renderPrompt();
  renderPicker();
  refreshTokens3D();
}

function pulse(el) {
  el.classList.remove('pulse');
  void el.offsetWidth;
  el.classList.add('pulse');
}

function setBanner(text) {
  banner.textContent = text;
}

function addLog(kind, text) {
  if (!text) return;
  const li = document.createElement('li');
  li.className = kind;
  li.textContent = text;
  logEl.prepend(li);
  while (logEl.children.length > 80) logEl.lastChild.remove();
}

function showStamp(text, kind, tilt = rand(-12, 12)) {
  stamp.textContent = text;
  stamp.style.setProperty('--tilt', `${tilt}deg`);
  stamp.className = `stamp ${kind}`;
  void stamp.offsetWidth;
  stamp.classList.add('show');
  clearTimeout(showStamp.timer);
  showStamp.timer = setTimeout(() => { stamp.classList.remove('show'); }, 1500);
}

function showBustStamp(word) {
  playBustSound();
  showStamp(word || BUST_WORDS[Math.floor(Math.random() * BUST_WORDS.length)], 'bust');
  tableWrap.classList.remove('shake');
  void tableWrap.offsetWidth;
  tableWrap.classList.add('shake');
}

function showWinner(seat, totals) {
  const won = isMe(seat);
  const oppLabel = mode === 'ai' ? 'The computer' : 'Your opponent';
  playFanfare(won);
  setTimeout(() => {
    showModal(
      won ? 'Victory' : 'Defeat',
      won
        ? `You reached ${fmt(totals[seat])} first. ${oppLabel} finished on ${fmt(totals[other(seat)])}.`
        : `${oppLabel} reached ${fmt(totals[seat])} first. You finished on ${fmt(totals[other(seat)])}.`,
      won ? 'won' : 'lost',
      true
    );
  }, 900);
}

function showModal(title, text, kind, showAgain) {
  endTitle.textContent = title;
  endText.textContent = text;
  endAgainBtn.hidden = !showAgain;
  endModal.className = `end-modal show ${kind}`;
  (showAgain ? endAgainBtn : endMenuBtn).focus();
}

function openSheet(open) {
  document.body.classList.toggle('sheet-open', open);
}

function buildTokenKey() {
  const desc = {
    headstart: 'Start the match with bonus points.',
    rally: 'Once: arm it, and your next banked turn earns a bonus.',
    wind: 'Once: when you bust, keep part of that turn’s points.',
    fortune: 'Re-roll a single die after a throw — even a bust.',
    toll: 'Once: right after your opponent banks, cut that turn.',
    ward: TOKEN_INFO.ward.text()
  };
  const range = {
    headstart: '50 → 500 points', rally: '+10% → +50%', wind: 'keeps 15% → 75%',
    fortune: '1 → 5 re-rolls', toll: '−10% → −50%', ward: ''
  };
  const rows = TOKEN_TYPES.map(type => {
    const info = TOKEN_INFO[type];
    return `<div class="tk-row"><img alt="" src="${tokenImageUrl(type, 6)}" /><div><b>${info.name}</b> <em>${info.role}</em><span>${desc[type]}${range[type] ? ` <i>Wood → Gold: ${range[type]}.</i>` : ''}</span></div></div>`;
  }).join('');
  const metals = METALS.map((m, i) => `<span><img alt="" src="${tokenImageUrl('wind', i)}" />${m} ${fmt(TIER_MIN[i])}+</span>`).join('');
  tokenKeyBody.innerHTML = `<p class="key-note">Before each match, both players take one draw turn. What you bank sets your token's metal; a bust means no token. Then each picks a token. The lower draw throws first.</p>
    <div class="tk-metals">${metals}</div>${rows}`;
}

/* ------------------------------------------------------------------ */
/* Lobby & online play (PeerJS: peer-to-peer, room = agreed number)    */
/* ------------------------------------------------------------------ */

const ROOM_PREFIX = 'kcd2-dice-duel-v1-room-';
let peer = null;
let conn = null;
let lastHeard = 0;
let heartbeat = null;
let joinAttempt = 0;
let wakeLock = null;

function showLobby(message) {
  leaveRoom(true);
  lobbyStatus.textContent = message || 'Agree on a number with your friend, then both join it.';
  lobbyStatus.className = 'lobby-status';
  setJoining(false);
  endModal.classList.remove('show');
  openSheet(false);
  lobby.classList.add('show');
}

function setJoining(joining) {
  joinBtn.disabled = joining;
  roomInput.disabled = joining;
  playAiBtn.disabled = joining;
  cancelJoinBtn.hidden = !joining;
}

function lobbyMsg(text, kind = '') {
  lobbyStatus.textContent = text;
  lobbyStatus.className = `lobby-status ${kind}`;
}

function startVsComputer() {
  leaveRoom(true);
  mode = 'ai';
  role = null;
  mySeat = 'player';
  lobby.classList.remove('show');
  newGame();
}

function peerOptions() {
  const opts = { debug: 0 };
  // Optional self-hosted signalling server: ?peerserver=host:port
  const custom = new URLSearchParams(location.search).get('peerserver');
  if (custom) {
    const [host, port] = custom.split(':');
    Object.assign(opts, { host, port: Number(port || 443), path: '/', secure: location.protocol === 'https:' && !/^(localhost|127\.)/.test(host) });
  }
  return opts;
}

function joinRoom() {
  const code = roomInput.value.replace(/\D/g, '');
  if (code.length < 3) { lobbyMsg('Use a number with at least 3 digits — 5 or 6 is better.', 'error'); return; }
  if (typeof Peer === 'undefined') { lobbyMsg('Online play could not load.', 'error'); return; }
  storageSet('kcd2DiceRoom', code);
  joinAttempt = 0;
  setJoining(true);
  tryJoin(code);
}

function tryJoin(code) {
  leaveRoom(true);
  guestReady = false;
  joinAttempt++;
  const myAttempt = joinAttempt;
  const roomId = ROOM_PREFIX + code;
  lobbyMsg(`Connecting to room ${code}…`);

  // Whoever claims the room's ID first is the host; the second player connects to them.
  const hostPeer = new Peer(roomId, peerOptions());
  peer = hostPeer;
  hostPeer.on('open', () => {
    if (myAttempt !== joinAttempt) return;
    role = 'host';
    mySeat = 'player';
    lobbyMsg(`Room ${code} is open. Waiting for your opponent to join with the same number…`, 'waiting');
  });
  hostPeer.on('connection', (c) => {
    if (conn && conn.open) {
      c.on('open', () => { c.send({ t: 'full' }); setTimeout(() => c.close(), 400); });
      return;
    }
    attachConn(c);
  });
  hostPeer.on('disconnected', () => { if (!hostPeer.destroyed) hostPeer.reconnect(); });
  hostPeer.on('error', (err) => {
    if (myAttempt !== joinAttempt) return;
    if (err.type === 'unavailable-id') {
      hostPeer.destroy();
      joinAsGuest(code, roomId, myAttempt);
    } else if (err.type === 'peer-unavailable') {
      /* handled by the guest path */
    } else {
      netError(err);
    }
  });
}

function joinAsGuest(code, roomId, myAttempt) {
  const guestPeer = new Peer(peerOptions());
  peer = guestPeer;
  guestPeer.on('open', () => {
    if (myAttempt !== joinAttempt) return;
    role = 'guest';
    mySeat = 'ai';
    lobbyMsg(`Found room ${code}. Connecting to your opponent…`);
    const c = guestPeer.connect(roomId, { reliable: true });
    attachConn(c);
    setTimeout(() => {
      if (myAttempt !== joinAttempt || (conn && conn.open)) return;
      // Either the room was left behind by a closed page, or the networks can't see each other.
      if (joinAttempt < 3) {
        lobbyMsg(`Room ${code} didn’t answer. Trying again…`);
        setTimeout(() => { if (myAttempt === joinAttempt) tryJoin(code); }, 2500);
      } else {
        setJoining(false);
        leaveRoom(true);
        lobbyMsg('Couldn’t connect. If your friend is already waiting, one of your networks may be blocking direct connections — try switching between Wi-Fi and mobile data.', 'error');
      }
    }, 12000);
  });
  guestPeer.on('error', (err) => {
    if (myAttempt !== joinAttempt) return;
    if (err.type === 'peer-unavailable') {
      // The host vanished between our two steps — start over.
      setTimeout(() => { if (myAttempt === joinAttempt) tryJoin(code); }, 1200);
    } else netError(err);
  });
}

function attachConn(c) {
  c.on('open', () => {
    if (conn && conn !== c && conn.open) { c.close(); return; }
    conn = c;
    lastHeard = Date.now();
    c.send({ t: 'hello', v: 1 });
    onConnected();
  });
  c.on('data', onNetData);
  c.on('close', () => { if (conn === c) onPeerLost('Your opponent left the table.'); });
  c.on('error', () => { if (conn === c) onPeerLost('The connection to your opponent dropped.'); });
}

function onConnected() {
  mode = 'online';
  lobby.classList.remove('show');
  setJoining(false);
  endModal.classList.remove('show');
  clearInterval(heartbeat);
  heartbeat = setInterval(() => {
    netSend({ t: 'ping' });
    if (Date.now() - lastHeard > 20000) onPeerLost('Lost contact with your opponent.');
  }, 4000);
  requestWakeLock();
  if (role === 'host') {
    newGame();
  } else if (!guestReady) {
    game = freshGame('player');
    localReset();
    setBanner('Connected. Waiting for the table to be set…');
    updateUI();
  }
}

function onNetData(msg) {
  lastHeard = Date.now();
  if (!msg || typeof msg !== 'object') return;
  switch (msg.t) {
    case 'ping': case 'hello': return;
    case 'full':
      showLobby('That room already has two players. Pick another number.');
      return;
    case 'bye':
      onPeerLost('Your opponent left the table.');
      return;
    case 'fx':
      if (role === 'guest') {
        if (msg.op === 'reset') { guestReady = true; if (!game) game = freshGame(); }
        runFx(msg.op, msg.a);
      }
      return;
    case 'state':
      if (role === 'guest') { if (!game) game = freshGame(); applyState(msg.s); }
      return;
    case 'act':
      if (role === 'host') hostHandleRemote(msg);
      return;
    default: return;
  }
}

function netSend(msg) {
  try { if (conn && conn.open) conn.send(msg); } catch { /* ignore */ }
}

function onPeerLost(text) {
  if (mode !== 'online') return;
  gameToken++;
  leaveRoom(true);
  mode = 'offline';
  setBanner(text);
  showModal('Opponent gone', `${text} You can return to the menu and join the room again.`, 'lost', false);
}

function netError(err) {
  const map = {
    'network': 'Couldn’t reach the matchmaking service. Check your internet connection.',
    'server-error': 'The matchmaking service is having trouble. Try again in a minute.',
    'socket-error': 'Couldn’t reach the matchmaking service. Check your internet connection.',
    'socket-closed': 'The matchmaking connection closed. Try again.',
    'browser-incompatible': 'This browser can’t do peer-to-peer play. Try Chrome or Safari.',
    'webrtc': 'The direct connection failed. Try switching between Wi-Fi and mobile data.'
  };
  const text = map[err && err.type] || `Connection problem (${(err && err.type) || 'unknown'}).`;
  if (mode === 'online') { onPeerLost(text); return; }
  setJoining(false);
  leaveRoom(true);
  lobbyMsg(text, 'error');
}

function leaveRoom(silent) {
  clearInterval(heartbeat);
  heartbeat = null;
  if (conn) {
    try { if (!silent) conn.send({ t: 'bye' }); } catch { /* ignore */ }
    const c = conn; conn = null;
    setTimeout(() => { try { c.close(); } catch { /* ignore */ } }, 150);
  }
  if (peer) {
    const p = peer; peer = null;
    setTimeout(() => { try { p.destroy(); } catch { /* ignore */ } }, 200);
  }
  releaseWakeLock();
}

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
  } catch { /* optional */ }
}
function releaseWakeLock() {
  try { if (wakeLock) wakeLock.release(); } catch { /* ignore */ }
  wakeLock = null;
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && mode === 'online' && !wakeLock) requestWakeLock();
});
window.addEventListener('pagehide', () => { if (mode === 'online') netSend({ t: 'bye' }); });

/* ------------------------------------------------------------------ */
/* Scoring                                                             */
/* ------------------------------------------------------------------ */

function hasScoringSubset(values) {
  return getScoringOptions(values).length > 0;
}

function getScoringOptions(values) {
  const options = [];
  const n = values.length;
  const seen = new Set();
  for (let mask = 1; mask < (1 << n); mask++) {
    const subset = [];
    const maskIndices = [];
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) { subset.push(values[i]); maskIndices.push(i); }
    }
    const score = scoreSelection(subset);
    if (score.valid) {
      const key = subset.slice().sort().join(',') + `:${score.points}`;
      if (!seen.has(key)) {
        seen.add(key);
        options.push({ mask, maskIndices, values: subset, points: score.points });
      }
    }
  }
  return options.sort((a, b) => b.points - a.points || b.maskIndices.length - a.maskIndices.length);
}

const scoreCache = new Map();
function scoreSelection(values) {
  if (!values.length) return { valid: false, points: 0 };
  const counts = Array(7).fill(0);
  values.forEach(v => counts[v]++);
  const cacheKey = counts.join('');
  if (scoreCache.has(cacheKey)) return scoreCache.get(cacheKey);
  const memo = new Map();
  const keyOf = (arr) => arr.slice(1).join('');
  const empty = (arr) => arr.slice(1).every(v => v === 0);

  function best(arr) {
    const key = keyOf(arr);
    if (memo.has(key)) return memo.get(key);
    if (empty(arr)) return 0;
    let max = -Infinity;
    if (arr[1] > 0) { arr[1]--; max = Math.max(max, 100 + best(arr)); arr[1]++; }
    if (arr[5] > 0) { arr[5]--; max = Math.max(max, 50 + best(arr)); arr[5]++; }
    const runs = [
      { nums: [1, 2, 3, 4, 5], points: 750 },
      { nums: [2, 3, 4, 5, 6], points: 750 },
      { nums: [1, 2, 3, 4, 5, 6], points: 1500 }
    ];
    for (const run of runs) {
      if (run.nums.every(n => arr[n] > 0)) {
        run.nums.forEach(n => arr[n]--);
        max = Math.max(max, run.points + best(arr));
        run.nums.forEach(n => arr[n]++);
      }
    }
    for (let face = 1; face <= 6; face++) {
      for (let amount = 3; amount <= arr[face]; amount++) {
        const base = face === 1 ? 1000 : face * 100;
        arr[face] -= amount;
        max = Math.max(max, base * Math.pow(2, amount - 3) + best(arr));
        arr[face] += amount;
      }
    }
    memo.set(key, max);
    return max;
  }

  const points = best(counts);
  const result = Number.isFinite(points) ? { valid: true, points } : { valid: false, points: 0 };
  scoreCache.set(cacheKey, result);
  return result;
}

/* ------------------------------------------------------------------ */
/* Boot (last, so every module-level constant above is initialised)    */
/* ------------------------------------------------------------------ */

init3D();
localReset();
game = null;
animate();

rollBtn.addEventListener('click', () => { if (canRoll()) act('roll'); });
continueBtn.addEventListener('click', () => { if (canKeep()) act('continue'); });
passBtn.addEventListener('click', () => { if (canKeep()) act('bank'); });
newGameBtn.addEventListener('click', () => {
  openSheet(false);
  if (mode === 'offline') { showLobby(); return; }
  const inProgress = game && !game.winner && (game.totals.player || game.totals.ai || game.turnScore);
  if (inProgress && !confirm(mode === 'online' ? 'Start a new match for both players?' : 'Abandon this match and start a new one?')) return;
  newGame();
});
endAgainBtn.addEventListener('click', () => { endModal.classList.remove('show'); newGame(); });
endMenuBtn.addEventListener('click', () => showLobby());
menuBtn.addEventListener('click', () => {
  if (mode === 'online' && !confirm('Leave this room and go back to the menu?')) return;
  if (mode === 'online') leaveRoom(false);
  mode = 'ai';
  showLobby();
});
sheetBtn.addEventListener('click', () => openSheet(!document.body.classList.contains('sheet-open')));
sheetCloseBtn.addEventListener('click', () => openSheet(false));
$('#sheetScrim').addEventListener('click', () => openSheet(false));
soundBtn.addEventListener('click', toggleSound);
playAiBtn.addEventListener('click', startVsComputer);
joinBtn.addEventListener('click', joinRoom);
roomInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') joinRoom(); });
roomInput.addEventListener('input', () => { roomInput.value = roomInput.value.replace(/\D/g, '').slice(0, 9); });
cancelJoinBtn.addEventListener('click', () => {
  joinAttempt++;
  leaveRoom(true);
  setJoining(false);
  lobbyMsg('Cancelled.');
});
window.addEventListener('pointerdown', unlockGameAudio, { once: true });
window.addEventListener('keydown', unlockGameAudio, { once: true });
window.addEventListener('keydown', onKey);
canvas.addEventListener('pointerdown', onPointerDown);
canvas.addEventListener('pointermove', onPointerMove);
canvas.addEventListener('pointerleave', () => { hoveredIdx = -1; canvas.style.cursor = 'default'; });
window.addEventListener('resize', resize);
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
scoringKey.open = storageGet('kcd2DiceScoringKeyCollapsed', IS_MOBILE ? 'true' : 'false') !== 'true';
scoringKey.addEventListener('toggle', () => storageSet('kcd2DiceScoringKeyCollapsed', String(!scoringKey.open)));
updateSoundBtn();
buildTokenKey();
myChip.addEventListener('click', onMyTokenClick);
pickGrid.addEventListener('click', (e) => {
  const card = e.target.closest('.pick-card');
  if (!card) return;
  pickGrid.querySelectorAll('.pick-card').forEach(c => { c.disabled = true; });
  card.classList.add('chosen');
  act('pick', { type: card.dataset.type });
});
promptBar.addEventListener('click', (e) => {
  const b = e.target.closest('[data-p]');
  if (!b) return;
  const p = b.dataset.p;
  if (p === 'toll-yes') act('toll', { use: true });
  else if (p === 'toll-no') act('toll', { use: false });
  else if (p === 'fortune') { fortuneMode = true; updateUI(); }
  else if (p === 'fortune-cancel') { fortuneMode = false; updateUI(); }
  else if (p === 'bust') act('acceptBust');
});

const hashRoom = (location.hash.match(/room=(\d+)/) || [])[1];
roomInput.value = hashRoom || storageGet('kcd2DiceRoom', '');
showLobby();
setBanner('Choose how to play.');

// Small hook for automated checks.
window.__diceDuel = {
  get game() { return game; }, dice, get camera() { return camera; },
  get net() { return { mode, role, mySeat, open: !!(conn && conn.open) }; },
  tokenImageUrl,
  renderStatue,
  refresh: () => updateUI(),
  tokenMeshes
};
