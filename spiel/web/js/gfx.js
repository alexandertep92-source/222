'use strict';
// Rumms! – Grafik-Grundlagen: Renderer, Licht und Schatten, Materialien, Himmel,
// Leuchtpunkte (Glühen, Funken, Rauch) und Nachbearbeitung (Bloom) für die hohe Stufe.

const GFX = {
  hq: true,          // Standard-Materialien (sonst Lambert für schwache Handys)
  shadows: true,
  bloom: false,
  outline: true,     // dunkle Comic-Umrisse um Figuren (nicht auf Niedrig)
  time: 0,           // für Shader (Wind, Wasser)
  timeUniform: { value: 0 },
  sunDir: new THREE.Vector3(0.55, 0.75, 0.36).normalize(),
};

function setupRenderer(canvas) {
  const q = Settings.quality;
  GFX.hq = q !== 'low';
  GFX.shadows = q !== 'low';
  GFX.bloom = q === 'high';
  GFX.outline = q !== 'low';
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: q !== 'low' && !GFX.bloom, powerPreference: 'high-performance', stencil: false,
  });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = GFX.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x9fd6ff);
  W.renderer = renderer;
  W.maxAniso = renderer.capabilities.getMaxAnisotropy();
}

function setupLights(scene) {
  const hemi = new THREE.HemisphereLight(0xc4e2ff, 0x5c6b34, 1.3);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe7c4, 3.3);
  sun.position.copy(GFX.sunDir).multiplyScalar(90);
  scene.add(sun, sun.target);
  if (GFX.shadows) {
    sun.castShadow = true;
    const size = Settings.quality === 'high' ? 2048 : 1024;
    sun.shadow.mapSize.set(size, size);
    const c = sun.shadow.camera;
    c.left = -32; c.right = 32; c.top = 32; c.bottom = -32; c.near = 10; c.far = 200;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.05;
    sun.shadow.radius = 3;
  }
  W.sun = sun; W.hemi = hemi;
}

// Schattenkamera folgt dem Spieler, in Texel-Schritten, damit Schatten nicht flimmern.
function updateSun(x, z) {
  const sun = W.sun;
  const texel = 64 / sun.shadow.mapSize.x;
  const fx = Math.round(x / texel) * texel, fz = Math.round(z / texel) * texel;
  const fy = groundHeight(fx, fz);
  sun.target.position.set(fx, fy, fz);
  sun.position.set(fx + GFX.sunDir.x * 90, fy + GFX.sunDir.y * 90, fz + GFX.sunDir.z * 90);
  updateDecoShadows(x, z);
}

// ---------- Materialien ----------
// mat({ color, vertexColors, rough, metal, emissive, flat, rim }) – Standard-Material auf Mittel/Hoch,
// Lambert auf Niedrig. rim: heller Rand für Figuren (Comic-Look).
function mat(o = {}) {
  const base = {};
  if (o.color !== undefined) base.color = o.color;
  if (o.vertexColors) base.vertexColors = true;
  if (o.emissive !== undefined) base.emissive = new THREE.Color(o.emissive);
  if (o.emissiveIntensity !== undefined) base.emissiveIntensity = o.emissiveIntensity;
  if (o.flat) base.flatShading = true;
  if (o.transparent) { base.transparent = true; base.opacity = o.opacity === undefined ? 1 : o.opacity; }
  if (o.map) base.map = o.map;
  if (o.side) base.side = o.side;
  let m;
  if (GFX.hq) {
    base.roughness = o.rough === undefined ? 0.78 : o.rough;
    base.metalness = o.metal === undefined ? 0 : o.metal;
    m = new THREE.MeshStandardMaterial(base);
  } else {
    m = new THREE.MeshLambertMaterial(base);
  }
  if (o.rim) addRim(m, o.rim === true ? 0.32 : o.rim);
  return m;
}

function addRim(m, strength) {
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    sh.uniforms.rimStrength = { value: strength };
    sh.fragmentShader = 'uniform float rimStrength;\n' + sh.fragmentShader.replace('#include <tonemapping_fragment>', `
      {
        float facing = clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
        float rimF = pow(1.0 - facing, 2.6) * rimStrength;
        gl_FragColor.rgb += vec3(1.0, 0.96, 0.88) * rimF;
      }
      #include <tonemapping_fragment>`);
  };
  m.customProgramCacheKey = () => 'rim' + (prev ? '+' : '');
}

// ---------- Umrisse (Comic-Look) ----------
// Dunkle Kontur um Helden, Gegner, Bosse und Truhen: eine aufgeblähte Kopie, von der nur
// die Rückseiten gezeichnet werden. Die Breite gilt in Welteinheiten, egal wie groß oder
// verzerrt ein Teil skaliert ist. Funktioniert für einzelne Meshes und InstancedMesh.
const _outlineMats = {};
function outlineMaterial(width) {
  const key = width.toFixed(3);
  if (_outlineMats[key]) return _outlineMats[key];
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { color: { value: new THREE.Color(0x1c1430) }, width: { value: width } }]),
    vertexShader: `uniform float width;
      #include <common>
      #include <fog_pars_vertex>
      void main(){
        vec3 objectNormal = normal;
        vec4 p = vec4(position, 1.0);
        #ifdef USE_INSTANCING
          mat3 im = mat3(instanceMatrix);
          objectNormal /= vec3(dot(im[0], im[0]), dot(im[1], im[1]), dot(im[2], im[2]));
          objectNormal = im * objectNormal;
          p = instanceMatrix * p;
        #endif
        vec4 mvPosition = modelViewMatrix * p;
        mvPosition.xyz += normalize(normalMatrix * objectNormal) * width;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform vec3 color;
      #include <common>
      #include <fog_pars_fragment>
      void main(){
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  _outlineMats[key] = m;
  return m;
}
// Hängt an jedes undurchsichtige Teil eines Modells eine Kontur. Winzige Teile (Augen, Knöpfe)
// bleiben ohne, sonst wirken sie verschmiert. Mehrfacher Aufruf ergänzt nur neue Teile.
function addOutline(root, width) {
  if (!GFX.outline) return;
  root.updateMatrixWorld(true);
  const list = [], ws = new THREE.Vector3();
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.userData.outline || o.userData.hasOutline) return;
    const m = o.material;
    if (!m || Array.isArray(m) || m.transparent || m.isMeshBasicMaterial || m.isShaderMaterial || !m.visible) return;
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    o.getWorldScale(ws);
    if (o.geometry.boundingSphere.radius * Math.max(ws.x, ws.y, ws.z) < 0.09) return;
    list.push(o);
  });
  const om = outlineMaterial(width);
  for (const o of list) {
    const ol = new THREE.Mesh(o.geometry, om);
    ol.userData.outline = true;
    ol.raycast = () => {};
    o.add(ol);
    o.userData.hasOutline = true;
  }
}

// Wind: wiegt Bäume und Büsche sanft (nur Vertex-Shader, Schatten bleiben ruhig).
// Außerdem wird alles, was der Kamera zu nahe kommt, gerastert ausgeblendet –
// so verdecken Bäume und Büsche nie die Spielfigur.
function addWind(m, amount) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = GFX.timeUniform;
    sh.vertexShader = 'uniform float uTime;\nvarying vec3 vWPos;\n' + sh.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      #ifdef USE_INSTANCING
        vec2 wp = instanceMatrix[3].xz;
      #else
        vec2 wp = vec2(0.0);
      #endif
      float hgt = max(position.y - 1.0, 0.0);
      float sway = sin(uTime * 1.4 + wp.x * 0.21 + wp.y * 0.17) + 0.4 * sin(uTime * 2.7 + wp.x * 0.5);
      transformed.x += sway * ${amount.toFixed(3)} * hgt;
      transformed.z += cos(uTime * 1.1 + wp.y * 0.23) * ${(amount * 0.6).toFixed(3)} * hgt;`).replace('#include <project_vertex>', `
      #include <project_vertex>
      {
        vec4 wq = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          wq = instanceMatrix * wq;
        #endif
        vWPos = (modelMatrix * wq).xyz;
      }`);
    sh.fragmentShader = 'varying vec3 vWPos;\n' + sh.fragmentShader.replace('#include <clipping_planes_fragment>', `
      #include <clipping_planes_fragment>
      {
        float camD = distance(vWPos, cameraPosition);
        float keep = smoothstep(3.0, 7.5, camD);
        float dith = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
        if (keep < dith) discard;
      }`);
  };
  m.customProgramCacheKey = () => 'wind' + amount;
}

// ---------- Prozedurale Texturen ----------
function canvasTexture(size, draw, opts = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  draw(ctx, size);
  const t = new THREE.CanvasTexture(c);
  if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(opts.repeat, opts.repeat); }
  t.colorSpace = opts.srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = Math.min(8, W.maxAniso || 1);
  return t;
}
// Feine Grasstruktur für den Boden (hell um 1.0, wird mit den Bodenfarben multipliziert)
function groundDetailTexture() {
  return canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = 'rgb(232,232,232)';
    ctx.fillRect(0, 0, s, s);
    const rng = mulberry32(5);
    for (let i = 0; i < 2600; i++) {
      const x = rng() * s, y = rng() * s, l = 2 + rng() * 5, a = -Math.PI / 2 + (rng() - 0.5) * 0.9;
      const v = 190 + Math.floor(rng() * 65);
      ctx.strokeStyle = `rgb(${v},${v},${v})`;
      ctx.lineWidth = 1 + rng();
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
    }
    for (let i = 0; i < 90; i++) {
      const x = rng() * s, y = rng() * s, r = 6 + rng() * 18;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(255,255,255,${0.12 + rng() * 0.1})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }, { repeat: 70 });
}
function softDotTexture() {
  return canvasTexture(64, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  });
}
// Hieb-Bogen: hell an der Außenkante, ausfransend nach innen und zu den Enden
function slashTexture() {
  return canvasTexture(128, (ctx, s) => {
    const img = ctx.createImageData(s, s);
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const u = x / (s - 1), v = 1 - y / (s - 1); // u entlang des Bogens, v von innen (0) nach außen (1)
        const edge = Math.pow(v, 2.2), ends = Math.sin(u * Math.PI);
        const a = clamp(edge * ends * 1.4, 0, 1);
        const i = (y * s + x) * 4;
        img.data[i] = 255; img.data[i + 1] = 255; img.data[i + 2] = 255; img.data[i + 3] = a * 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
}

// ---------- Himmel ----------
function buildSkyDome(scene) {
  const geo = new THREE.SphereGeometry(250, 32, 16);
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color(0x1f6fd6) }, mid: { value: new THREE.Color(0x6db8f2) },
      bottom: { value: new THREE.Color(0xcbe8fb) }, sunDir: { value: GFX.sunDir },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; uniform vec3 sunDir; varying vec3 vDir;
      void main(){
        float y = vDir.y;
        vec3 c = mix(bottom, mid, smoothstep(-0.05, 0.2, y));
        c = mix(c, top, smoothstep(0.2, 0.9, y));
        float s = max(dot(normalize(vDir), sunDir), 0.0);
        c += vec3(1.0, 0.93, 0.75) * (pow(s, 900.0) * 2.5 + pow(s, 40.0) * 0.35 + pow(s, 6.0) * 0.12);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(geo, m);
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  scene.add(sky);
  return sky;
}

// ---------- Leuchtpunkte: Glühen (additiv) und weiche Partikel (Rauch, Staub) ----------
class PointCloud {
  constructor(cap, additive) {
    this.cap = cap; this.n = 0;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(cap * 3);
    this.col = new Float32Array(cap * 4);
    this.size = new Float32Array(cap);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.uniforms = { map: { value: GFX.dotTex }, scale: { value: 300 } };
    const m = new THREE.ShaderMaterial({
      uniforms: Object.assign({}, THREE.UniformsLib.fog, this.uniforms),
      transparent: true, depthWrite: false, fog: true,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: `attribute float size; attribute vec4 color; varying vec4 vCol; uniform float scale;
        #include <fog_pars_vertex>
        void main(){
          vCol = color;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * scale / max(-mvPosition.z, 0.5);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `uniform sampler2D map; varying vec4 vCol;
        #include <fog_pars_fragment>
        void main(){
          vec4 t = texture2D(map, gl_PointCoord);
          gl_FragColor = vec4(vCol.rgb, vCol.a * t.a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
    });
    m.uniforms.map = this.uniforms.map; m.uniforms.scale = this.uniforms.scale;
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 5 : 4;
    this.geo = g;
    W.scene.add(this.points);
  }
  begin() { this.n = 0; }
  add(x, y, z, size, r, g, b, a) {
    if (this.n >= this.cap) return;
    const i = this.n++;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.col[i * 4] = r; this.col[i * 4 + 1] = g; this.col[i * 4 + 2] = b; this.col[i * 4 + 3] = a;
    this.size[i] = size;
  }
  end() {
    this.geo.setDrawRange(0, this.n);
    for (const k of ['position', 'color', 'size']) {
      const a = this.geo.attributes[k];
      a.needsUpdate = true;
      a.clearUpdateRanges && a.clearUpdateRanges();
    }
  }
}

// ---------- Nachbearbeitung (nur Grafikstufe Hoch) ----------
const Post = {
  ready: false,
  init() {
    const r = W.renderer;
    const type = r.capabilities.isWebGL2 ? THREE.HalfFloatType : THREE.UnsignedByteType;
    this.rtScene = new THREE.WebGLRenderTarget(4, 4, { type, samples: r.capabilities.isWebGL2 ? 4 : 0 });
    this.rtA = new THREE.WebGLRenderTarget(4, 4, { type });
    this.rtB = new THREE.WebGLRenderTarget(4, 4, { type });
    const vs = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
    this.bright = new THREE.ShaderMaterial({
      uniforms: { tex: { value: null } }, vertexShader: vs, depthTest: false, depthWrite: false,
      fragmentShader: `uniform sampler2D tex; varying vec2 vUv;
        void main(){ vec3 c = texture2D(tex, vUv).rgb; float l = max(max(c.r, c.g), c.b);
          gl_FragColor = vec4(c * smoothstep(0.85, 1.6, l), 1.0); }`,
    });
    this.blur = new THREE.ShaderMaterial({
      uniforms: { tex: { value: null }, dir: { value: new THREE.Vector2() } }, vertexShader: vs, depthTest: false, depthWrite: false,
      fragmentShader: `uniform sampler2D tex; uniform vec2 dir; varying vec2 vUv;
        void main(){
          vec3 c = texture2D(tex, vUv).rgb * 0.227;
          c += texture2D(tex, vUv + dir * 1.385).rgb * 0.316; c += texture2D(tex, vUv - dir * 1.385).rgb * 0.316;
          c += texture2D(tex, vUv + dir * 3.231).rgb * 0.07; c += texture2D(tex, vUv - dir * 3.231).rgb * 0.07;
          gl_FragColor = vec4(c, 1.0); }`,
    });
    this.comp = new THREE.ShaderMaterial({
      uniforms: { tex: { value: null }, bloom: { value: null }, strength: { value: 0.7 } }, vertexShader: vs, depthTest: false, depthWrite: false,
      fragmentShader: `uniform sampler2D tex; uniform sampler2D bloom; uniform float strength; varying vec2 vUv;
        void main(){
          vec3 c = texture2D(tex, vUv).rgb + texture2D(bloom, vUv).rgb * strength;
          vec2 q = vUv - 0.5; c *= 1.0 - dot(q, q) * 0.55;
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.comp);
    this.quad.frustumCulled = false;
    this.qScene = new THREE.Scene(); this.qScene.add(this.quad);
    this.qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.ready = true;
  },
  resize(w, h, pr) {
    if (!this.ready) return;
    const W2 = Math.max(4, Math.round(w * pr)), H2 = Math.max(4, Math.round(h * pr));
    this.rtScene.setSize(W2, H2);
    this.rtA.setSize(Math.max(4, W2 >> 2), Math.max(4, H2 >> 2));
    this.rtB.setSize(Math.max(4, W2 >> 2), Math.max(4, H2 >> 2));
  },
  pass(m, target) { this.quad.material = m; W.renderer.setRenderTarget(target); W.renderer.render(this.qScene, this.qCam); },
  render(scene, camera) {
    const r = W.renderer;
    r.setRenderTarget(this.rtScene);
    r.render(scene, camera);
    this.bright.uniforms.tex.value = this.rtScene.texture;
    this.pass(this.bright, this.rtA);
    const iw = 1 / this.rtA.width, ih = 1 / this.rtA.height;
    for (let i = 0; i < 2; i++) {
      this.blur.uniforms.tex.value = this.rtA.texture; this.blur.uniforms.dir.value.set(iw * (i + 1), 0);
      this.pass(this.blur, this.rtB);
      this.blur.uniforms.tex.value = this.rtB.texture; this.blur.uniforms.dir.value.set(0, ih * (i + 1));
      this.pass(this.blur, this.rtA);
    }
    this.comp.uniforms.tex.value = this.rtScene.texture;
    this.comp.uniforms.bloom.value = this.rtA.texture;
    this.pass(this.comp, null);
  },
};

function renderFrame() {
  if (GFX.bloom && Post.ready) Post.render(W.scene, W.camera);
  else W.renderer.render(W.scene, W.camera);
}
