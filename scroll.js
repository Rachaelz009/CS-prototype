// Customer Stories scroll demo.
// Scroll feel follows telescope.fyi: the scroll position is eased, and every image
// trails it with its own random lag, so the images drift at slightly different speeds.
//
// Story, as progress p goes 0 → 1 through the tall #track:
//   0.00–0.20  images fly in around the headline
//   0.26–0.44  headline swaps for the copy, images scatter out to the edges
//   0.50–0.70  the featured image comes forward in Z over the faded copy
//   0.72–0.88  the featured image takes over the whole stage
//   0.88–0.95  play button, story card and dots appear

(() => {
  const track = document.getElementById('track');
  const stage = document.getElementById('stage');
  const headline = document.getElementById('headline');
  const copy = document.getElementById('copy');
  const feature = document.getElementById('feature');
  const featureUi = document.getElementById('featureUi');
  const card = featureUi.querySelector('.story-card');
  const play = featureUi.querySelector('.play');

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Positions are % of the stage (x, y = image centre). w = width as % of the size base.
  // cluster = first screenshot, scatter = second screenshot.
  const IMAGES = [
    { src: '8.png',  cluster: [25, 8, 6.5],   scatter: [-3, 30, 6.5] },
    { src: '10.png', cluster: [13.5, 19, 4.6], scatter: [20, 15, 4.6] },
    { src: '7.png',  cluster: [73.6, 9, 6.4], scatter: [86, 8, 6.4] },
    { src: '6.png',  cluster: [86.5, 17, 10.4], scatter: [99, 15, 10.4] },
    { src: '9.png',  cluster: [9.5, 64, 9.4], scatter: [15, 86, 9.4] },
    { src: '4.png',  cluster: [12.2, 85, 5.2], scatter: [5.5, 101, 5.2] },
    { src: '1.png',  cluster: [31, 72, 18.3], scatter: [-6, 60, 18.3] },
    { src: '11.png', cluster: [60.7, 65, 5.2], scatter: [62, 118, 5.2] },
    { src: '3.png',  cluster: [68.3, 89, 9.4], scatter: [82, 102, 9.4] },
    { src: '2.png',  cluster: [85.8, 77, 21], scatter: [101, 70, 21] },
  ];
  // The featured image (5.png) starts in the cluster like the others.
  const FEATURE = { cluster: [47.5, 12, 12.6], scatter: [1.2, 11, 12.6], aspect: 389 / 363 };
  const CENTRE = [50, 42];

  const els = IMAGES.map((d, i) => {
    const img = new Image();
    // window.IMAGES is set in the single-file build; otherwise load from images/.
    img.src = (window.IMAGES || {})[d.src] || 'images/' + d.src;
    img.alt = '';
    img.className = 'float';
    stage.appendChild(img);
    return {
      ...d, img,
      aspect: 1.07,
      delay: (i % 5) * 0.012,
      // Each image chases the scroll at its own speed (telescope uses scrub 0.5–1s).
      lag: 0.06 + Math.random() * 0.06,
      p: 0,
    };
  });
  els.forEach(e => e.img.addEventListener('load', () => {
    e.aspect = e.img.naturalHeight / e.img.naturalWidth;
    layout();
  }));
  const featureState = { p: 0, lag: 0.09 };

  // ---------- helpers ----------
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => t * t * (3 - 2 * t);
  const seg = (p, a, b) => ease(clamp((p - a) / (b - a)));
  const lerp2 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

  let W = 0, H = 0, base = 0;
  function measure() {
    W = stage.clientWidth;
    H = stage.clientHeight;
    base = Math.min(W, H * 1.43);
    if (W < 700) base *= 1.6;
    els.forEach(e => { e.img.style.width = (e.cluster[2] / 100 * base) + 'px'; });
  }

  // Where an image sits before flying in: pushed out from the centre, as if far away.
  const startPos = c => [CENTRE[0] + (c[0] - CENTRE[0]) * 2.1, CENTRE[1] + (c[1] - CENTRE[1]) * 2.1];

  function floatPos(d, p, delay = 0) {
    const tIn = seg(p, delay, 0.18 + delay);
    const tScatter = seg(p, 0.26, 0.44);
    let pos = lerp2(startPos(d.cluster), d.cluster, tIn);
    pos = lerp2(pos, d.scatter, tScatter);
    const scale = lerp(0.45, 1, tIn) * lerp(1, 1.08, tScatter);
    return { pos, scale, tIn };
  }

  // ---------- render one frame for each image's own (lagged) progress ----------
  function renderFloat(e) {
    const p = e.p;
    const { pos, scale, tIn } = floatPos(e, p, e.delay);
    let op = clamp(tIn * 1.6);
    op *= lerp(1, 0.35, seg(p, 0.52, 0.66));
    op *= 1 - seg(p, 0.70, 0.82);
    const w = e.cluster[2] / 100 * base;
    const h = w * e.aspect;
    const x = pos[0] / 100 * W - w / 2;
    const y = pos[1] / 100 * H - h / 2;
    e.img.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
    e.img.style.opacity = op;
  }

  function renderFeature(p) {
    // Stage 1–2: behaves like a normal floating image (portrait).
    const f = floatPos(FEATURE, p, 0.03);
    let w = FEATURE.cluster[2] / 100 * base;
    let h = w * FEATURE.aspect;
    let [cx, cy] = [f.pos[0] / 100 * W, f.pos[1] / 100 * H];
    w *= f.scale; h *= f.scale;
    let op = clamp(f.tIn * 1.6);
    let radius = 12;

    // Stage 3a: drifts back to the centre and recedes (small, far away in Z).
    const tBack = seg(p, 0.50, 0.58);
    const farW = 0.05 * base;
    cx = lerp(cx, CENTRE[0] / 100 * W, tBack);
    cy = lerp(cy, CENTRE[1] / 100 * H, tBack);
    w = lerp(w, farW, tBack);
    h = lerp(h, farW * FEATURE.aspect, tBack);

    // Stage 3b: comes forward towards the viewer, widening to a landscape frame.
    const tFwd = seg(p, 0.58, 0.70);
    w = lerp(w, 0.26 * W, tFwd);
    h = lerp(h, Math.max(0.2 * H, 0.26 * W * 0.54), tFwd);

    // Stage 4: takes over the whole stage.
    const tFull = seg(p, 0.72, 0.88);
    cx = lerp(cx, W / 2, tFull);
    cy = lerp(cy, H / 2, tFull);
    w = lerp(w, W, tFull);
    h = lerp(h, H, tFull);
    radius = lerp(radius, 0, tFull);

    feature.style.width = w + 'px';
    feature.style.height = h + 'px';
    feature.style.transform = `translate3d(${cx - w / 2}px, ${cy - h / 2}px, 0)`;
    feature.style.borderRadius = radius + 'px';
    feature.style.opacity = op;
    feature.style.setProperty('--shade', (0.18 * seg(p, 0.86, 0.94)).toFixed(3));
  }

  function renderText(p) {
    const tOut = seg(p, 0.24, 0.32);
    headline.style.opacity = 1 - tOut;
    headline.style.transform = `translate(-50%, calc(-50% - ${tOut * 40}px))`;

    const tIn = seg(p, 0.30, 0.40);
    let op = tIn * lerp(1, 0.3, seg(p, 0.52, 0.66)) * (1 - seg(p, 0.72, 0.84));
    copy.style.opacity = op;
    copy.style.transform = `translate(-50%, calc(-50% + ${(1 - tIn) * 40}px))`;
  }

  function renderUi(p) {
    const t = seg(p, 0.88, 0.95);
    featureUi.style.opacity = t;
    featureUi.classList.toggle('live', t > 0.5);
    card.style.setProperty('--card-x', ((1 - t) * 48) + 'px');
    play.style.setProperty('--play-scale', lerp(0.85, 1, t).toFixed(3));
  }

  // ---------- scroll loop ----------
  function targetProgress() {
    const r = track.getBoundingClientRect();
    const total = track.offsetHeight - window.innerHeight;
    // Guard against a zero-size window during load, which would give NaN and stick.
    return total > 0 ? clamp(-r.top / total) : 0;
  }

  let smooth = targetProgress();
  els.forEach(e => { e.p = smooth; });
  featureState.p = smooth;

  function layout() {
    measure();
    renderText(smooth);
    els.forEach(renderFloat);
    renderFeature(featureState.p);
    renderUi(smooth);
  }

  function tick() {
    const target = targetProgress();
    if (H === 0) measure();
    if (reduceMotion) {
      smooth = target;
      els.forEach(e => { e.p = target; });
      featureState.p = target;
    } else {
      // Ease the main scroll, then let each image chase it at its own pace.
      smooth = lerp(smooth, target, 0.12);
      els.forEach(e => { e.p = lerp(e.p, smooth, e.lag); });
      featureState.p = lerp(featureState.p, smooth, featureState.lag);
    }
    renderText(smooth);
    els.forEach(renderFloat);
    renderFeature(featureState.p);
    renderUi(smooth);
    requestAnimationFrame(tick);
  }

  window.addEventListener('resize', layout);
  measure();
  requestAnimationFrame(tick);
})();
