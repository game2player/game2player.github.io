/* Project page prototype. All data comes from assets/*.json, exported by build/*.py. */

const GENRE = {
  "Action": "#ec9800", "Puzzle": "#2ba0e6", "Platformer": "#0f9d6c", "Shooter": "#e0531a",
  "Strategy": "#2563c9", "Simulation": "#c9619f", "Racing": "#bf9f00", "Adventure": "#7a4cb5",
  "Card": "#9c5a3c", "RPG": "#4a9e22", "Sports": "#12a8b8", "Fighting": "#a61e4d",
  "Survival": "#6d7a2c", "Arcade": "#e8638c", "Other": "#8b8f95",
};
const ENGINE = {
  "Unity WebGL": "#2563c9", "HTML5": "#ec9800", "Flash": "#e0531a", "Godot": "#0f9d6c",
  "PICO-8": "#c9619f", "GameMaker": "#2ba0e6", "Construct": "#7a4cb5", "Other engines": "#8b8f95",
};
// The game list's genres and engines, folded into the groups the opening shows: genres with
// fewer than ten games go to Other, and every HTML5 framework to HTML5.
const GROUP_OF = {
  genre: g => GENRE[g.genre] ? g.genre : g.genre === "Card Game" ? "Card" : "Other",
  engine: g => ENGINE[g.engine] ? g.engine : g.engine.startsWith("HTML5") ? "HTML5" : "Other engines",
};
const INK = "#1f2328", INK3 = "#7d8796", RULE = "#e5e7eb", PANEL = "#f7f9fb";
// The three role colours and their shades live in the stylesheet (:root); drawings read them from there.
const role = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const GAME = role("--game"), TURN = role("--turn"), PLAYER = role("--player");
const alpha = (hex, a) => `rgba(${[1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(",")},${a})`;
const $ = (s, el = document) => el.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const fmt = n => n.toLocaleString("en-US");
const esc = s => String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const compactLayout = matchMedia("(max-width: 1100px), (max-height: 760px)");
const touch = matchMedia("(pointer: coarse)");
const sources = mp4 => `<source src="${mp4}" type="video/mp4"><source src="${mp4.replace(/\.mp4$/, ".webm")}" type="video/webm">`;
function setVideo(video, mp4) { video.removeAttribute("src"); video.innerHTML = sources(mp4); video.load(); }

function fit(canvas, cssH) {
  const dpr = window.devicePixelRatio || 1, w = canvas.parentElement.clientWidth, h = Math.max(1, Math.round(cssH));
  canvas.style.width = w + "px"; canvas.style.height = h + "px";
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
  const ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}
const dataLoads = new Map();
const load = p => {
  if (!dataLoads.has(p)) dataLoads.set(p, fetch(p).then(r => {
    if (!r.ok) throw new Error(`Could not load ${p}: ${r.status}`);
    return r.json();
  }).catch(error => { dataLoads.delete(p); throw error; }));
  return dataLoads.get(p);
};
const STAGES = initStageNames();
initNav();
initCite();
const introData = Promise.all(["assets/tiles.json", "assets/dataset.json"].map(load));
introData.then(([tiles, dataset]) => initIntro(tiles, dataset.totals));
// Build each interactive chapter shortly before it enters view, rather than blocking
// the opening animation with hidden players, charts, and their data requests.
function lazyChapter(id, init) {
  const section = document.getElementById(id);
  const observer = new IntersectionObserver(entries => {
    if (!entries.some(e => e.isIntersecting)) return;
    observer.disconnect();
    Promise.resolve().then(init).catch(error => { console.error(error); observer.observe(section); });
  }, { rootMargin: "100% 0px" });
  observer.observe(section);
}
lazyChapter("leaderboard", async () => initBoard((await load("assets/results.json")).leaderboard));
lazyChapter("loop", async () => {
  const [stories, [tiles]] = await Promise.all([load("assets/stories.json"), introData]);
  initLoop(stories, tiles);
});
lazyChapter("examples", async () => initExamples((await load("assets/data.json")).replays));
lazyChapter("players", async () => initPlayers(await load("assets/policy/index.json")));
lazyChapter("dataset", async () => initDataset(await load("assets/dataset.json")));
lazyChapter("results", async () => initResults(await load("assets/results.json")));
document.querySelectorAll(".transport button").forEach(b => b.setAttribute("aria-label", "Play or pause recording"));

function observeAnimation(el, start, stop) {
  let inView = false, active = false;
  const sync = () => {
    const next = inView && !document.hidden;
    if (next === active) return;
    active = next;
    if (active) start(); else stop();
  };
  new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; sync(); }).observe(el);
  document.addEventListener("visibilitychange", sync);
}

/* ============ the bar along the top ============ */
function navH() { return $("#topnav").offsetHeight; }
// The opening's progress once the games sit in their groups with their labels.
const GROUPED = .63;
// The scroll that takes the opening from 0 to 1. Groups taller than the screen get no hold:
// their stage lets go at GROUPED and the page scrolls on through them.
function introTravel(intro) { return Math.max(1, intro.offsetHeight - intro.querySelector(".stage").offsetHeight - (+intro.dataset.reading || 0)) / (+intro.dataset.until || 1); }
// How far the page has scrolled through a pinned chapter's hold, from 0 to 1.
function progressIn(pin) {
  const span = pin.offsetHeight - pin.firstElementChild.offsetHeight;
  return span > 0 ? clamp((navH() - pin.getBoundingClientRect().top) / span, 0, 1) : 0;
}
// The page position where a chapter starts under the bar.
function topOf(el) { return el.getBoundingClientRect().top + scrollY - navH(); }
function initNav() {
  const intro = $("#intro"), links = [...document.querySelectorAll("#nav-links a")];
  const menu = $("#section-menu");
  menu.innerHTML = `<option value="top">Overview</option>` + links.map(a => `<option value="${a.dataset.go}">${a.textContent}</option>`).join("");
  menu.addEventListener("change", () => scrollTo({top: target(menu.value), behavior: reduce ? "instant" : "smooth"}));
  const IDS = ["abstract", "contributions", "leaderboard", "loop", "examples", "players", "dataset", "results", "cite"];
  const LINK = {};   // chapters shown under another chapter's link
  // the games are the regrouped wall, most of the way through the opening; a chapter lands
  // with a little room between the bar and its heading
  const target = id => id === "top" ? 0 : id === "games" ? intro.offsetTop + (+intro.dataset.reading || 0) + introTravel(intro) * Math.min(.72, +intro.dataset.until || 1) : topOf(document.getElementById(id)) - 24;
  document.addEventListener("click", e => {
    const a = e.target.closest("a[data-go], a.soon"); if (!a) return;
    e.preventDefault();
    if (a.dataset.go) scrollTo({ top: target(a.dataset.go), behavior: "smooth" });
  });
  function onScroll() {
    const p = clamp((scrollY - intro.offsetTop - (+intro.dataset.reading || 0)) / introTravel(intro), 0, 1);
    document.body.classList.toggle("nav-on", p > .25);
    let cur = p > .5 ? "games" : null;
    IDS.forEach(id => { if (document.getElementById(id).getBoundingClientRect().top <= navH() + innerHeight * .3) cur = LINK[id] || id; });
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) cur = IDS[IDS.length - 1];
    links.forEach(a => a.classList.toggle("on", a.dataset.go === cur));
    if (document.activeElement !== menu) menu.value = cur || "top";
  }
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll);
  onScroll();
}

/* ============ opening wall -> games ============ */
function initIntro(T, D) {
  const games = T.games, N = games.length, [TW, TH] = T.tile, COLS = T.cols;
  const canvas = $("#wall"), intro = $("#intro"), head = $("#games-head"), band = $("#title-band");
  const tip = $("#tip"), tipVideo = $("#tip-video");
  // Browser chrome changes innerHeight during a swipe. Measure the stable CSS viewport
  // so those events do not reset the title, canvas, and tile layout mid-transition.
  const viewportProbe = document.createElement("div");
  viewportProbe.style.cssText = "position:fixed;top:0;width:0;visibility:hidden;pointer-events:none";
  viewportProbe.setAttribute("aria-hidden", "true");
  intro.append(viewportProbe);
  // One atlas video holds every game; each tile shows its own cell of it. Each new video
  // frame is copied once into `copy` and the tiles are cut from that copy: cutting them from
  // the video itself makes Firefox fetch the whole frame again for every tile.
  const video = Object.assign(document.createElement("video"), { muted: true, loop: true, playsInline: true, autoplay: true });
  // Phones keep live gameplay with a 1080p, 12-fps atlas instead of decoding 4K.
  const animatedAtlas = !reduce;
  let atlasStarted = false;
  function playAtlas() {
    if (!animatedAtlas) return;
    if (!atlasStarted) {
      atlasStarted = true;
      if (touch.matches) video.src = "assets/wall-mobile.mp4";
      else setVideo(video, "assets/wall.mp4");
    }
    video.play().catch(() => {});
  }
  const poster = new Image();
  // Show a lightweight poster first so video downloads cannot delay the first tiles.
  poster.addEventListener("load", () => { if (running) playAtlas(); });
  poster.addEventListener("error", () => { if (running) playAtlas(); });
  poster.src = touch.matches ? "assets/wall-mobile.webp" : "assets/wall.webp";
  const copy = document.createElement("canvas"), cctx = copy.getContext("2d");
  // `fresh` says whether a new frame came in since the canvas was last drawn. Copying the whole
  // atlas is the costliest step of a frame, so it is skipped while the tiles fly (`hold`), and
  // taken at most every `gap` ms once they are small.
  let copied = null, copiedAt = -1, copiedWhen = 0, fresh = false;
  function grab(hold, gap = 0) {
    const src = animatedAtlas && video.readyState >= 2 ? video : poster.complete && poster.naturalWidth ? poster : null;
    const now = performance.now();
    if (!src || (copied && (hold || now - copiedWhen < gap)) || (src === copied && (src === poster || video.currentTime === copiedAt))) return !!copied;
    copiedWhen = now;
    const sourceW = src.videoWidth || src.naturalWidth, sourceH = src.videoHeight || src.naturalHeight;
    const scale = touch.matches ? Math.min(1, 1920 / sourceW) : 1;
    const w = Math.round(sourceW * scale), h = Math.round(sourceH * scale);
    if (copy.width !== w || copy.height !== h) { copy.width = w; copy.height = h; }
    cctx.drawImage(src, 0, 0, w, h); copied = src; copiedAt = video.currentTime; fresh = true;
    return true;
  }
  games.forEach((g, i) => { g.i = i; g.cur = {}; g.zoom = 0; g.vel = 0; g.touched = 0; g.group = { genre: GROUP_OF.genre(g), engine: GROUP_OF.engine(g) }; });

  // the games on the wall and their tasks, then the training set made from their play, counted
  // up from zero each time they come into view
  const counts = [[N, "games"], [games.reduce((n, g) => n + (g.tasks || 0), 0), "tasks"], [D.trajectories, "trajectories"],
    [D.steps, "steps"], [Math.round(D.hours), "hours of gameplay"]];
  const formatCount = (n, millions) => millions ? `${(n / 1e6).toFixed(2)}M` : fmt(n);
  $("#bignums").innerHTML = counts.map(([n, s]) => {
    const final = formatCount(n, s === "steps");
    return `<div><b data-to="${n}" data-final="${final}"${s === "steps" ? ' data-millions="true"' : ""}><i class="count-value">${final}</i></b><span>${s}</span></div>`;
  }).join("");
  let counted = false;
  function countUp() {
    const els = [...document.querySelectorAll("#bignums b")], t0 = performance.now();
    const step = now => {
      const f = reduce ? 1 : clamp((now - t0) / 1500, 0, 1), e = 1 - Math.pow(1 - f, 3);
      els.forEach(b => $(".count-value", b).textContent = formatCount(Math.round(+b.dataset.to * e), b.dataset.millions === "true"));
      if (f < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  let drawnP = -1, W, H, ctx, wall, groups, group = "genre", switching = null, hover = -1, p = 0, panX = 0, panY = 0, drift = 0, frozen = null, last = performance.now();
  // The wall drifts at a constant speed; its heading turns all the way round about every
  // 90 s, swaying a little on the way, so it wanders in every direction without repeating.
  const SPEED = 27.5, heading = t => .47 + t * 2 * Math.PI / 90 + .8 * Math.sin(t * 2 * Math.PI / 37);

  function layoutWall() {
    const w = clamp(W / 11.5, 112, 168), h = w * 9 / 16, g = 6;
    let cols = Math.ceil(Math.sqrt(N * (W / H) * 1.1)), rows = Math.ceil(N / cols);
    while ((rows) * (h + g) < H + 2 * (h + g)) { rows++; cols = Math.ceil(N / rows); }
    while (cols * (w + g) < W + 2 * (w + g)) cols++;
    // Shuffle the slots, not the games, so a game's repeats never land side by side.
    const slots = [...Array(cols * rows).keys()].sort((a, b) => ((a * 7919) % 1031) - ((b * 7919) % 1031));
    const cells = slots.map((k, j) => ({ gi: k % N, x: (j % cols) * (w + g), y: Math.floor(j / cols) * (h + g), ghost: false }));
    const seen = new Set(); cells.forEach(c => { c.ghost = seen.has(c.gi); seen.add(c.gi); });
    return { cells, w, h, g, spanX: cols * (w + g), spanY: rows * (h + g) };
  }
  function layoutGroups(key) {
    const box = $(".wrap", head).getBoundingClientRect(), top = head.offsetHeight + 22, left = box.left, width = box.width, height = H - top - 20;
    const buckets = {}; games.forEach(g => (buckets[g.group[key]] = buckets[g.group[key]] || []).push(g.i));
    const rest = name => name.startsWith("Other");   // Other and Other engines come last
    const names = Object.keys(buckets).sort((a, b) => rest(a) - rest(b) || buckets[b].length - buckets[a].length);
    // A mouse can point at small tiles, so they shrink until every group fits on the screen; a
    // finger needs tiles it can tap, and the groups run past the screen instead.
    const minimum = touch.matches ? 32 : 6;
    for (let tw = 64; tw >= minimum; tw--) {
      const th = tw * 9 / 16, gap = 3, labelH = 22, pos = [], labels = [];
      let x = 0, y = 0, rowH = 0, ok = true;
      for (const name of names) {
        const n = buckets[name].length, cols = Math.max(1, Math.min(Math.ceil(Math.sqrt(n * 2.4)), Math.floor((width + gap) / (tw + gap))));
        ctx.font = "600 14px 'Libre Franklin', sans-serif";
        const labelW = ctx.measureText(name).width + 28;
        ctx.font = "12px 'Libre Franklin', sans-serif";
        const bw = Math.max(cols * (tw + gap), labelW + ctx.measureText(String(n)).width), bh = labelH + Math.ceil(n / cols) * (th + gap);
        if (x + bw > width) { x = 0; y += rowH + 14; rowH = 0; }
        if (y + bh > height && tw > minimum) { ok = false; break; }
        labels.push({ x: left + x, y: top + y + 14, name, n, color: (key === "engine" ? ENGINE : GENRE)[name] || INK3 });
        buckets[name].forEach((gi, k) => pos[gi] = { x: left + x + (k % cols) * (tw + gap), y: top + y + labelH + Math.floor(k / cols) * (th + gap), w: tw });
        x += bw + 30; rowH = Math.max(rowH, bh);
      }
      if (ok) {
        return { pos, labels, height: top + y + rowH + 20 };
      }
    }
  }
  let layoutViewportH = 0;
  function resize(event) {
    viewportProbe.style.height = compactLayout.matches ? "100svh" : "100vh";
    const stableH = viewportProbe.offsetHeight;
    if (event?.type === "resize" && W === canvas.clientWidth && layoutViewportH === stableH) return;
    layoutViewportH = stableH;
    drawnP = -1;
    const stage = intro.querySelector(".stage");
    stage.style.height = ""; intro.style.height = ""; delete intro.dataset.until;
    W = canvas.clientWidth; H = stage.clientHeight;
    const viewportH = H, travel = intro.offsetHeight - viewportH;
    ctx = canvas.getContext("2d"); ctx.imageSmoothingQuality = "high";
    groups = { genre: layoutGroups("genre"), engine: layoutGroups("engine") };
    // Reserve space for the selected grouping, not the taller of both layouts.
    H = Math.ceil(Math.max(viewportH, groups[group].height));
    if (H > viewportH) {
      stage.style.height = H + "px";
      intro.style.height = H + travel * GROUPED + "px"; intro.dataset.until = GROUPED;
    }
    // Give a tall card its own page-scroll distance, keeping both its top and bottom accessible.
    const reading = Math.max(0, band.offsetHeight + 32 - viewportH);
    intro.dataset.reading = reading;
    if (reading) intro.style.height = intro.offsetHeight + reading + "px";
    band.style.top = (viewportH + reading) / 2 + "px";
    // Bound the backing store on high-DPI phones, especially for tall game groups.
    const dpr = Math.min(window.devicePixelRatio || 1, touch.matches ? 1.5 : 2, 8192 / H, Math.sqrt(4e6 / (W * H)));
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.imageSmoothingQuality = "high";
    wall = layoutWall();
    onScroll();
  }
  const wrap = (v, span) => ((v % span) + span) % span;
  let running = false, drawFrame = 0, viewTop = 0, viewBottom = 0, drawnViewTop = -1, drawnViewBottom = -1;
  const nextDraw = () => { drawFrame = requestAnimationFrame(draw); };
  function draw(now) {
    if (!running) return;
    if (touch.matches && now - last < 1000 / 30) { nextDraw(); return; }
    const dt = Math.min(.1, (now - last) / 1000); last = now;
    const holding = p <= .1;
    if (holding && !reduce) { drift += dt; const a = heading(drift); panX += Math.cos(a) * SPEED * dt; panY += Math.sin(a) * SPEED * dt; frozen = null; }
    else if (!holding && !frozen) frozen = [panX, panY];
    const [ox, oy] = frozen || [panX, panY];
    const m = ease(clamp((p - .1) / .5, 0, 1)), target = groups[group];
    const ready = grab((m > 0 && m < 1) || !!switching, m >= 1 ? 80 : 0);
    const bounds = canvas.getBoundingClientRect();
    viewTop = Math.max(0, -bounds.top);
    viewBottom = Math.min(H, innerHeight - bounds.top);
    // Nothing moves and no new frame: the canvas already shows this moment.
    const busy = holding || switching || hover >= 0 || p !== drawnP || viewTop !== drawnViewTop || viewBottom !== drawnViewBottom || games.some(g => g.zoom > .003);
    if (ready && !busy && !fresh) { nextDraw(); return; }
    fresh = false; drawnP = p;
    drawnViewTop = viewTop; drawnViewBottom = viewBottom;
    // A phone's full game grid is much taller than its screen. Paint only the visible
    // strip, including on scroll, instead of redrawing hundreds of hidden thumbnails.
    ctx.save(); ctx.beginPath(); ctx.rect(0, viewTop, W, Math.max(0, viewBottom - viewTop)); ctx.clip();
    ctx.clearRect(0, viewTop, W, Math.max(0, viewBottom - viewTop));
    const labelAlpha = clamp((p - .55) / .08, 0, 1) * (switching ? Math.abs(1 - 2 * switching.t) : 1);
    if (labelAlpha > 0) {
      ctx.globalAlpha = labelAlpha; ctx.font = "600 14px 'Libre Franklin', sans-serif";
      const labels = switching && switching.t < .5 ? groups[switching.from].labels : target.labels;
      labels.forEach(l => {
        ctx.fillStyle = l.color; ctx.fillRect(l.x, l.y - 9, 9, 9);
        ctx.fillStyle = INK; ctx.fillText(l.name, l.x + 14, l.y);
        const nameW = ctx.measureText(l.name).width;
        ctx.fillStyle = INK3; ctx.font = "12px 'Libre Franklin', sans-serif"; ctx.fillText(String(l.n), l.x + 20 + nameW, l.y);
        ctx.font = "600 14px 'Libre Franklin', sans-serif";
      });
      ctx.globalAlpha = 1;
    }
    for (const c of wall.cells) {
      const g = games[c.gi];
      // the wall is wider and taller than the screen; the screen shows its middle, so the
      // tiles that fly in when it regroups come from every side
      const ax = wrap(c.x - ox, wall.spanX) - (wall.spanX - W) / 2, ay = wrap(c.y - oy, wall.spanY) - (wall.spanY - H) / 2;
      let b = target.pos[c.gi];
      if (switching) { const f = groups[switching.from].pos[c.gi], e = ease(switching.t); b = { x: f.x + (b.x - f.x) * e, y: f.y + (b.y - f.y) * e, w: f.w + (b.w - f.w) * e }; }
      if (c.ghost) {               // repeated cells only fill the wall; they fade instead of flying
        if (m >= 1) continue;
        if (ready) { ctx.globalAlpha = 1 - m; tile(c.gi, ax, ay, wall.w); ctx.globalAlpha = 1; }
        continue;
      }
      const cur = g.cur;
      cur.x = ax + (b.x - ax) * m; cur.y = ay + (b.y - ay) * m; cur.w = wall.w + (b.w - wall.w) * m; cur.h = cur.w * 9 / 16;
      if (!ready) continue;
      tile(c.gi, cur.x, cur.y, cur.w);
      if (m > .98) { ctx.strokeStyle = (group === "engine" ? ENGINE : GENRE)[g.group[group]] || INK3; ctx.lineWidth = 1; ctx.strokeRect(cur.x + .5, cur.y + .5, cur.w - 1, cur.h - 1); }
    }
    // A hovered tile grows into the preview itself; the ones left behind shrink back more
    // slowly, so a quick sweep leaves a tail behind the pointer. Each zoom follows a
    // critically damped spring: its speed changes smoothly and it never overshoots. The
    // hovered tile is drawn last, the trail under it from oldest to newest.
    const zoomed = [];
    games.forEach(g => {
      const on = g.i === hover && m > .98;
      if (on) g.touched = now;
      spring(g, on ? 1 : 0, on ? 18 : 10, dt);
      if (g.zoom > .003 || on) zoomed.push(g); else { g.zoom = 0; g.vel = 0; }
    });
    zoomed.sort((a, b) => (a.i === hover) - (b.i === hover) || a.touched - b.touched);
    let shown = null;
    zoomed.forEach(g => {
      const r = zoomRect(g), head = g.i === hover;
      if (head) shown = r;
      if (!ready || r.z <= 0) return;
      ctx.save();
      ctx.shadowColor = `rgba(31, 35, 40, ${(.3 * r.z).toFixed(3)})`; ctx.shadowBlur = 22 * r.z; ctx.shadowOffsetY = 6 * r.z;
      tile(g.i, r.x, r.y, r.w);
      ctx.restore();
    });
    if (shown) {
      tip.style.transform = `translate(${shown.x}px, ${shown.y}px)`; tip.style.width = shown.w + "px";
      tip.style.opacity = clamp((shown.z - .55) / .4, 0, 1).toFixed(3);
    } else tip.style.opacity = 0;
    if (switching) { switching.t = Math.min(1, switching.t + dt / .9); if (switching.t >= 1) switching = null; }
    ctx.restore();
    nextDraw();
  }
  // Critically damped spring toward `target` with angular frequency `w`, solved exactly for
  // the frame's dt, so a long frame cannot make it jump.
  function spring(g, target, w, dt) {
    const x = g.zoom - target, k = g.vel + w * x, e = Math.exp(-w * dt);
    g.zoom = target + (x + k * dt) * e;
    g.vel = (g.vel - w * k * dt) * e;
  }
  // From the tile's own place to a 320px preview over it, kept inside the screen.
  const BIG = 320;
  function zoomRect(g) {
    const c = g.cur, z = clamp(g.zoom, 0, 1), big = Math.min(BIG, W - 16), bh = big * 9 / 16;
    const stageTop = canvas.getBoundingClientRect().top;
    const top = Math.max(8, navH() - stageTop + 8), bottom = Math.min(H, innerHeight - stageTop);
    const bx = clamp(c.x + c.w / 2 - big / 2, 8, W - big - 8), by = clamp(c.y + c.h / 2 - bh / 2, top, bottom - bh - 64);
    return { x: c.x + (bx - c.x) * z, y: c.y + (by - c.y) * z, w: c.w + (big - c.w) * z, z };
  }
  function tile(gi, x, y, w) {
    const h = w * 9 / 16;
    if (x > W || x + w < 0 || y > viewBottom || y + h < viewTop) return;
    const atlasScale = copy.width / (COLS * TW);
    ctx.drawImage(copy, (gi % COLS) * TW * atlasScale, Math.floor(gi / COLS) * TH * atlasScale, TW * atlasScale, TH * atlasScale, x, y, w, h);
  }
  function onScroll() {
    const span = introTravel(intro);
    const scrolled = Math.max(0, -intro.getBoundingClientRect().top);
    const reading = +intro.dataset.reading || 0;
    p = clamp((scrolled - reading) / span, 0, 1);
    const f = clamp((p - .1) / .15, 0, 1);
    band.style.opacity = 1 - f; band.style.transform = `translate(-50%, calc(-50% - ${Math.min(scrolled, reading) + f * 40}px))`;
    band.style.visibility = f >= 1 ? "hidden" : "";
    head.style.opacity = clamp((p - .5) / .12, 0, 1); head.classList.toggle("live", p > .6);
    $("#bignums").tabIndex = p > .6 ? 0 : -1;
    if (p > .5 && !counted) { counted = true; countUp(); } else if (p < .45) counted = false;
    if (p < .6 && hover >= 0) leave();
  }
  // The name shows at once; the preview clip loads only once the pointer rests on a tile.
  let clipTimer = 0;
  function leave() { hover = -1; canvas.classList.remove("over"); clearTimeout(clipTimer); tipVideo.pause(); }
  $("#group-seg").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b || b.dataset.g === group) return;
    document.querySelectorAll("#group-seg button").forEach(x => x.classList.toggle("on", x === b));
    switching = { from: group, t: 0 }; group = b.dataset.g;
    resize();
  });
  canvas.addEventListener("mousemove", e => {
    if (p < .6) return;
    const r = canvas.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    let hit = -1;
    games.forEach(g => { const c = g.cur; if (mx >= c.x && mx <= c.x + c.w && my >= c.y && my <= c.y + c.h) hit = g.i; });
    if (hit !== hover) {
      hover = hit; clearTimeout(clipTimer); tipVideo.pause(); tipVideo.style.visibility = "hidden";
      if (hit >= 0) {
        const g = games[hit];
        $("#tip-title").textContent = g.title; $("#tip-meta").textContent = `${g.genre} · ${g.engine}`;
        clipTimer = setTimeout(() => { setVideo(tipVideo, `assets/clips/${g.id}.mp4`); tipVideo.play().catch(() => {}); }, 160);
      }
    }
    canvas.classList.toggle("over", hit >= 0);
  });
  canvas.addEventListener("mouseleave", leave);
  tipVideo.addEventListener("playing", () => tipVideo.style.visibility = "");
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", resize);
  // Off screen the wall stops: no decoding, no drawing.
  observeAnimation(intro, () => {
    running = true; last = performance.now();
    if (poster.complete) playAtlas();
    nextDraw();
  }, () => { running = false; cancelAnimationFrame(drawFrame); video.pause(); });
  resize(); onScroll();
  document.fonts && document.fonts.ready.then(resize);
}

/* ============ the loop ============ */
// The loop: the Builder with its skills, the Environment, the two players and their Reports on
// a ring of wide arrows; the Scout in front of it, drawing from the sites the games come from.
// After it, what the loop gives: the Environments, a game at a time, and the Data, an episode
// at a time, each a window onto a list that keeps growing. Real games ride the arrows. Below
// the drawing, what the chosen stage does, played out on one game from its records.
function initStageNames() {
  const ICON = {
    scout: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5" opacity=".5"/><g class="sweep"><path d="M12 12L12 3"/></g><circle cx="16.5" cy="8" r="1.2" fill="currentColor" stroke="none"/>',
    builder: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
    env: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 8.5h18M8.5 14.5l2.3 2.3 4.7-4.7"/>',
    envs: '<rect x="7" y="3" width="14" height="13" rx="1.8"/><path d="M7 6.8h14M11 11.5l1.8 1.8 3.6-3.6M3.5 7.5v11.2c0 1 .8 1.8 1.8 1.8h11.2"/>',
    policy: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>',
    vlm: '<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    reports: '<path d="M4 4.5h16v11H11l-4.5 4v-4H4z"/><path d="M12 7.5v4M12 13.8v.1"/>',
    data: '<path d="M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  };
  const NAME = { scout: "Scout", builder: "Builder", env: "Environments", policy: "Coding Player", vlm: "VLM Player", reports: "Reports", envs: "Verified Environments", data: "Data" };
  // the stages named in the text are the same buttons, small
  document.querySelectorAll(".sname[data-k]").forEach(m => {
    m.innerHTML = `<span class="ic"><svg viewBox="0 0 24 24">${ICON[m.dataset.k]}</svg></span><span class="t">${NAME[m.dataset.k]}</span>`;
    const after = m.nextSibling;   // a comma or full stop after it stays on its line
    if (after && after.nodeType === 3 && /^[.,]/.test(after.data)) {
      const keep = document.createElement("span"); keep.className = "nobr";
      m.replaceWith(keep); keep.append(m, after.data[0]); after.data = after.data.slice(1);
    }
  });
  return { ICON, NAME };
}

function initLoop(S, T) {
  const cycle = $("#cycle"), canvas = $("#cycle-fx"), panel = $("#loop-panel");
  const { ICON, NAME } = STAGES;
  cycle.querySelectorAll(".node").forEach(n => {
    n.innerHTML = `<span class="ic"><svg viewBox="0 0 24 24">${ICON[n.dataset.k]}</svg></span><span class="node-label">${n.dataset.k === "envs" ? "Verified<br>Environments" : NAME[n.dataset.k]}</span>`;
  });
  // where the games were found
  const LOGOS = [["itchdotio.svg", "itch.io"], ["armorgames.png", "Armor Games"], ["newgrounds.png", "Newgrounds"],
    ["kongregate.svg", "Kongregate"], ["nitrome.png", "Nitrome"], ["github.svg", "GitHub"]];
  // A narrow column of cards in front of the Scout, as wide as the library behind the Data:
  // one card a row, each pushed a little left or right (x as a share of the spare width,
  // y in rows), then nudged apart where two would cover each other.
  const SPOTS = [[.15, -2.5], [.9, -1.5], [.05, -.5], [.95, .5], [.2, 1.5], [.85, 2.5]];
  function heap(cards, x0, x1, cy, row) {
    const b = cards.map(el => ({ el, w: el.firstElementChild.offsetWidth, h: el.firstElementChild.offsetHeight }));
    b.forEach((c, i) => { c.x = x0 + c.w / 2 + SPOTS[i][0] * Math.max(0, x1 - x0 - c.w); c.y = cy + SPOTS[i][1] * row; });
    const y0 = cy - 3.1 * row, y1 = cy + 3.1 * row, ALLOW = -3;   // a small gap at rest; the drift brings them to just touching
    for (let it = 0; it < 200; it++) {
      for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) {
        const A = b[i], B = b[j], dx = B.x - A.x, dy = B.y - A.y;
        const ox = (A.w + B.w) / 2 - Math.abs(dx) - ALLOW, oy = (A.h + B.h) / 2 - Math.abs(dy) - ALLOW;
        if (ox <= 0 || oy <= 0) continue;
        if (ox * .55 < oy) { const m = ox / 2 * Math.sign(dx || 1); A.x -= m; B.x += m; }
        else { const m = oy / 2 * Math.sign(dy || 1); A.y -= m; B.y += m; }
      }
      b.forEach(c => { c.x = clamp(c.x, x0 + c.w / 2, Math.max(x0 + c.w / 2, x1 - c.w / 2)); c.y = clamp(c.y, y0 + c.h / 2, y1 - c.h / 2); });
    }
    return b;
  }
  $("#logos").innerHTML = LOGOS.map(([f, name], i) => `<div class="logo" style="--dx:${(6 + (i * 1.7) % 3.5).toFixed(2)}s;--dy:${(4.6 + (i * 1.3) % 2.6).toFixed(2)}s;--delay:${(-i * 1.1).toFixed(1)}s;--r0:${(((i * 37) % 5) - 3) * .6}deg;--r1:${(((i * 53) % 5) - 1) * .6}deg"><div><span class="mark"><img src="assets/logos/${f}" alt=""></span>${name}</div></div>`).join("");
  // the Builder's skills, one for each engine; a few of them shown
  $("#skills").innerHTML = `<span class="lbl">Skills</span><div>${[["unity.svg", "Unity", "Unity WebGL"], ["flash.svg", "Flash", "Flash"], ["godot.svg", "Godot", "Godot"], ["pico8.svg", "PICO-8", "PICO-8"]]
    .map(([f, name, engine]) => `<span data-engine="${engine}"><img src="assets/logos/${f}" alt="">${name}</span>`).join("")}</div>`;

  // ---------- what each stage does, on one game, below the drawing. Every stage has the same
  // layout: on the left its name and what it does; on the right a tinted board where it runs,
  // three numbered steps along a track, each a card of the same size. The steps light up in
  // turn; stages that run more than once (the VLM's moves, the two reports) start over.
  const P = S.play, texts = [];
  // Prose with its code set as code (dotted names, snake_case names, calls) and the single
  // letters that name keys set as keys, typed out a character at a time without losing either.
  const TOKEN = /([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+(?:\(\))?|\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b|\b[A-Za-z_]\w*\(\))|\b([B-HJ-Z])\b(?= [a-z])/g;
  function rich(text, n = Infinity) {
    let html = "", i = 0, left = n;
    const put = (part, tag) => {
      if (left <= 0) return;
      let p = esc(part.slice(0, left)); left -= part.length;
      if (tag === "code") p = p.replace(/\./g, ".<wbr>");   // long dotted names break after a dot, nowhere else
      html += tag ? `<${tag}>${p}</${tag}>` : p;
    };
    for (const m of text.matchAll(TOKEN)) { put(text.slice(i, m.index), ""); put(m[0], m[1] ? "code" : "kbd"); i = m.index + m[0].length; }
    put(text.slice(i), "");
    return html;
  }
  // a model's action, "Z + ← · 0.6 s", as key caps and how long they were held
  const keycaps = a => {
    const [keys, hold] = a.split(" · ");
    const caps = /^\S+( \+ \S+)*$/.test(keys) ? keys.split(" + ").map(k => `<kbd>${esc(k)}</kbd>`).join('<span class="plus">+</span>') : esc(keys);
    return `<div class="act"><div class="caps">${caps}</div>${hold ? `<span class="hold">for ${esc(hold)}</span>` : ""}</div>`;
  };
  const typed = (text, at, dur, cls = "") => { texts.push(text); return `<p class="typed ${cls}" data-i="${texts.length - 1}" data-at="${at}" data-dur="${dur}"></p>`; };
  const chip = (html, at, cls = "") => `<span class="chip ${cls}" data-at="${at}">${html}</span>`;
  const logo = f => `<img src="assets/logos/${f}" alt="">`;
  const clip = () => `<video muted playsinline preload="none">${sources(P.video)}</video>`;
  const keyLabel = k => ({ ArrowLeft: "←", ArrowRight: "→", ArrowUp: "↑", ArrowDown: "↓", z: "Z", x: "X" }[k] || k);
  const sprite = (k, w, h) => { const sp = S.vlm.sprite, ch = w * sp.h / sp.w, oy = (h - ch) / 2;
    return `background-image:url(${sp.file});background-size:${sp.cols * w}px auto;background-position:${-(k % sp.cols) * w}px ${-Math.floor(k / sp.cols) * ch + oy}px`; };
  const meter = () => `<div class="meter"><b class="tok">0</b><span>of ${S.task.target} tokens</span></div><canvas class="pline"></canvas>`;
  // the released game's tasks, numbered as in the list beside it, each filled in once a policy
  // has solved it, then the count and how many runs that took
  const solved = tasks => {
    const ok = tasks.filter(t => t.runs[1] > 0), n = tasks[0].runs[0], all = tasks.every(t => t.runs[0] === n && t.runs[1] === n);
    return `<div class="solved">${tasks.map((t, i) => `<span>${t.id.split("_")[1]}${t.runs[1] ? `<i data-at="${(5 + i * .25).toFixed(2)}">${t.id.split("_")[1]}</i>` : ""}</span>`).join("")}</div>
      <div class="meter" data-at="${(5.3 + tasks.length * .25).toFixed(2)}"><b>${ok.length}</b><span>of ${tasks.length} tasks solved</span></div>
      <p class="lead" data-at="${(5.7 + tasks.length * .25).toFixed(2)}">${all ? `Each one by the Coding Player, in all ${n} of its runs.` : `By the Coding Player, in ${tasks.reduce((s, t) => s + t.runs[1], 0)} of ${tasks.reduce((s, t) => s + t.runs[0], 0)} runs.`}</p>`;
  };
  // steps: [title, card html, the time it comes in, card style]
  const STORY = {
    scout: {
      what: "Looks at a game where it is published, works out how it is built and how its state could be read, and decides whether to build it.",
      dur: 9.5,
      steps: () => [
        ["Finds the game", `<img class="fill" src="${S.scout.shot}" alt=""><div class="over">${chip(logo("itchdotio.svg") + `<span>${S.scout.url}</span>`, .5)}${chip(logo("pico8.png") + "PICO-8", .8, "dark")}</div>`, 0, "media"],
        ["Reads up on it", typed(S.scout.evidence[0], 2.4, 2.6), 2.2],
        ["Decides", `${chip(S.scout.decision, 5.6, "call")}<div class="kv" data-at="6"><span>runs offline</span><b>${esc(S.scout.offline)}</b><span>state readable</span><b>${esc(S.scout.state)}</b>
          <span>found in source</span><b>${S.scout.found.map(f => `<code>${esc(f)}</code>`).join(", ")}</b></div>`, 5.4],
      ],
    },
    builder: {
      what: "Gets the game running offline with the skill for its engine, exposes its state through game_api.js, writes the tasks and checks every one.",
      dur: 9.5,
      steps: () => [
        ["Gets it running offline", `<div class="flip">${S.builder.shots.map(f => `<img src="${f}" alt="">`).join("")}</div>`, 0, "media"],
        ["Exposes its state", `<pre class="api">${S.builder.api.slice(0, 11).map((l, i) => `<span data-at="${(2.4 + i * .14).toFixed(2)}">${esc(l) || " "}</span>`).join("\n")}</pre>`, 2.2, "code"],
        ["Checks it", `<ul class="phases">${S.builder.phases.map(([ph, , txt], i) => `<li data-at="${(5.2 + i * .9).toFixed(1)}"><b>${ph[0] + ph.slice(1).toLowerCase()}</b>${rich(txt)}</li>`).join("")}</ul>`, 5],
      ],
    },
    env: {
      what: "A game adapted for offline play with action and state interfaces and task checks grounded in game state. Players test it before it can enter the verified collection.",
      dur: 10,
      steps: () => [
        ["A task", `<p class="say">${rich(S.task.instruction)}</p><div class="kv"><span>progress</span><code>${esc(S.task.field)}</code><span>goal</span><code>${S.task.start} → ${S.task.target}</code></div>`, 0],
        ["Played", clip(), 1.8, "media"],
        ["Progress, read from the game", meter(), 1.8, "chart"],
      ],
    },
    policy: {
      what: "Writes a policy in code over the exposed state and plays with it in real time. What it needs and cannot read, it asks the Builder for.",
      dur: 10,
      steps: () => [
        ["Asks the Builder for", `<div class="chips col">${S.coding.fields.map((f, i) => chip(`<code>${f}</code>`, (.3 + i * .25).toFixed(2))).join("")}</div>`, 0],
        ["Reads them in its code", `<pre class="mini">${S.coding.code.map((l, i) => `<span data-l="${i}"><i>${S.coding.first + i}</i>${esc(l) || " "}</span>`).join("")}</pre>`, 2.4, "code"],
        ["Plays in real time", clip(), 2.4, "media"],
      ],
    },
    vlm: {
      what: "A vision-language model plays from the screen alone. The game waits while it reads the screenshot and decides on its next keys.",
      cycle: 3.2, cases: S.vlm.steps.length, dur: 3.2 * S.vlm.steps.length,
      steps: () => [
        ["Sees the screen", `<div class="seen fill"><span class="paused">Game paused</span></div>`, 0, "media"],
        [`Thinks`, `<p class="say thought"></p>`, .4],
        ["Presses", `<div class="press"></div>`, 2.1],
      ],
      fill(root, i) {
        const st = S.vlm.steps[i], seen = root.querySelector(".seen");
        seen.style.cssText = sprite(st.k, seen.clientWidth, seen.clientHeight);
        const th = root.querySelector(".thought"); th.dataset.text = st.text; th.dataset.at = .6; th.dataset.dur = 1.3; th.classList.add("typed"); th.textContent = ""; delete th.dataset.n;
        root.querySelector(".press").innerHTML = st.act.map(keycaps).join("");
      },
    },
    reports: {
      what: "What does not work goes back to the Builder, which checks it against the recording before it changes anything.",
      cycle: 6.5, cases: S.reports.length, dur: 6.5 * S.reports.length,
      steps: () => [
        ["A report comes in", `<span class="from"></span><p class="say report"></p>`, 0],
        ["The Builder checks it", `<p class="say check"></p>`, 1.8],
        ["Outcome", `<div class="verdict"></div>`, 4],
      ],
      fill(root, i) {
        const r = S.reports[i];
        root.querySelector(".from").textContent = r.from;
        root.querySelector(".report").innerHTML = rich(r.text);
        const ck = root.querySelector(".check"); ck.dataset.text = r.check; ck.dataset.at = 2; ck.dataset.dur = 1.6; ck.classList.add("typed"); ck.textContent = ""; delete ck.dataset.n;
        root.querySelector(".verdict").innerHTML = `<span class="badge ${i ? "ok" : "no"}" data-at="4.2">${esc(r.outcome)}</span>`;
      },
    },
    envs: {
      what: "Games enter this collection after their task checks are validated through gameplay and a code policy can solve most tasks in the game environment. Environments that do not meet these criteria are excluded.",
      dur: 10,
      steps: () => [
        ["Runs offline", `<img class="fill" src="${S.released.shot}" alt=""><div class="over">${chip(logo("pico8.svg") + "PICO-8", .4)}${chip("Fixed seed", .7)}${chip("<code>game_api.js</code>", 1)}</div>`, 0, "media"],
        [`${S.released.tasks.length} tasks`, `<ol class="tasklist">${S.released.tasks.map((t, i) => `<li data-at="${(2.2 + i * .2).toFixed(1)}"><b>${t.id.split("_")[1]}</b><span>${esc(t.prompt)}</span></li>`).join("")}</ol>`, 2],
        ["Solved in play", solved(S.released.tasks), 4.8],
      ],
    },
    data: {
      what: "Both players play the tasks again and again. Each episode keeps the video, the game state and every input, all on one clock.",
      dur: 10,
      steps: () => [
        ["Video", clip(), 0, "media"],
        ["Game state", meter(), .9, "chart"],
        ["Inputs", `<canvas class="lanes"></canvas>`, 1.8, "chart"],
      ],
    },
  };
  const ORDER = ["scout", "builder", "env", "policy", "vlm", "reports", "envs", "data"];
  let cur = null, t0 = 0, held = 0, still = 0, video = null, steps = [], round = -1, lastHit = "";
  let activeStep = 0, stepElapsed = 0, stepLast = 0;
  function selectStep(i) {
    activeStep = i; stepElapsed = 0;
    panel.querySelectorAll("[data-step]").forEach(b => b.setAttribute("aria-pressed", String(+b.dataset.step === i)));
    panel.querySelectorAll(".step-group").forEach((el, j) => el.classList.toggle("selected", j === i));
  }
  const picker = $("#stage-picker");
  picker.innerHTML = Object.entries(NAME).map(([k, name]) => `<option value="${k}">${name}</option>`).join("");
  const revealPanel = () => scrollTo({top: topOf(picker.parentElement) - 8, behavior: reduce ? "instant" : "smooth"});
  picker.addEventListener("change", () => { held = performance.now() + 30000; show(picker.value); });
  $("#show-diagram").addEventListener("click", () => {
    const box = $("#cycle-box"), selected = cycle.querySelector(".node.on");
    if (compactLayout.matches && selected) {
      const r = selected.getBoundingClientRect(), frame = box.getBoundingClientRect();
      box.scrollTo({left: box.scrollLeft + r.left - frame.left + r.width / 2 - box.clientWidth / 2, behavior: reduce ? "instant" : "smooth"});
    }
    scrollTo({top: topOf(box) - 8, behavior: reduce ? "instant" : "smooth"});
  });
  function show(k) {
    activeStep = 0; stepElapsed = 0; stepLast = 0;
    picker.value = k;
    cur = k; t0 = performance.now(); texts.length = 0; round = -1;
    cycle.querySelectorAll(".node").forEach(n => { n.classList.toggle("on", n.dataset.k === k); n.setAttribute("aria-pressed", String(n.dataset.k === k)); });
    if (video) video.pause();
    const st = STORY[k];
    steps = st.steps();
    panel.dataset.k = k;
    panel.innerHTML = `<div class="lp-head"><span class="ic"><svg viewBox="0 0 24 24">${ICON[k]}</svg></span><h3>${NAME[k]}</h3><p>${rich(st.what)}</p></div>
      <div class="board">
        <div class="compact-control step-controls" role="group" aria-label="Stage steps">${steps.map(([title], i) => `<button type="button" data-step="${i}" aria-pressed="${i === 0}">${i + 1}. ${esc(title)}</button>`).join("")}</div>
        <ol class="rail">${steps.map(([title], i) => `<li><b>${i + 1}</b><span>${esc(title)}</span>${i < 2 ? "<i></i>" : ""}</li>`).join("")}</ol>
        <div class="cards">${steps.map(([title, html, , cls], i) => `<div class="step-group${i === 0 ? " selected" : ""}"><h4 class="mobile-step-title"><b>${i + 1}</b>${esc(title)}</h4><div class="card ${cls || ""}">${html}</div></div>`).join("")}</div>
      </div>`;
    panel.querySelectorAll(".typed").forEach(el => el.dataset.text = texts[+el.dataset.i]);
    video = panel.querySelector("video");
    if (video) {
      video.preload = "auto";
      video.addEventListener("loadedmetadata", () => { video.currentTime = P.from; video.play().catch(() => {}); }, { once: true });
      video.addEventListener("ended", () => { video.currentTime = P.from; video.play().catch(() => {}); });
    }
  }
  cycle.querySelectorAll(".node").forEach(n => {
    n.addEventListener("mouseenter", () => { if (compactLayout.matches || performance.now() < still) return; held = performance.now() + 15000; if (cur !== n.dataset.k) show(n.dataset.k); });
    n.addEventListener("click", () => { held = performance.now() + 30000; if (cur !== n.dataset.k) show(n.dataset.k); if (compactLayout.matches) revealPanel(); });
  });
  panel.addEventListener("click", e => {
    const button = e.target.closest("[data-step]");
    if (button) selectStep(+button.dataset.step);
  });
  panel.addEventListener("mouseenter", () => held = performance.now() + 15000);
  // a stage named in the chapter's text: show it, with the figure brought into view; the
  // boxes passing under the pointer on the way do not take over
  document.querySelectorAll("#loop .sname").forEach(m => m.addEventListener("click", () => {
    held = performance.now() + 30000; still = performance.now() + 1500; if (cur !== m.dataset.k) show(m.dataset.k);
    if (compactLayout.matches) revealPanel();
    else scrollTo({ top: topOf(cycle.closest(".pin")) + 2, behavior: "smooth" });
  }));

  // a chart canvas fills what is left of its card below whatever sits above it
  const room = cv => Math.max(40, Math.floor(cv.parentElement.getBoundingClientRect().bottom - cv.getBoundingClientRect().top - 12));
  function progressLine(cv, t) {
    const { ctx: c, w, h } = fit(cv, room(cv));
    const X = tt => tt / P.duration * w, Y = v => h - 4 - v * (h - 10);
    c.strokeStyle = "#dde3ea"; c.lineWidth = 1; c.beginPath(); c.moveTo(0, h - 3.5); c.lineTo(w, h - 3.5); c.stroke();
    c.strokeStyle = PLAYER; c.lineWidth = 2; c.beginPath(); c.moveTo(0, Y(0)); let v = 0;
    for (const [tt, vv] of P.progress) { if (tt > t) break; c.lineTo(X(tt), Y(v)); c.lineTo(X(tt), Y(vv)); v = vv; }
    c.lineTo(X(t), Y(v)); c.stroke();
    c.fillStyle = PLAYER; c.beginPath(); c.arc(X(t), Y(v), 3.5, 0, Math.PI * 2); c.fill();
    return v;
  }
  function lanes(cv, t) {
    const { ctx: c, w, h } = fit(cv, room(cv)), keys = ["z", "x", "ArrowLeft", "ArrowRight"], span = 6, lh = h / keys.length;
    const X = tt => w - (t - tt) / span * (w - 30);
    c.font = "600 13px 'Libre Franklin', sans-serif";
    keys.forEach((k, i) => {
      const y = i * lh;
      c.fillStyle = "#f1f4f7"; c.fillRect(30, y + 4, w - 30, lh - 8);
      c.fillStyle = INK3; c.fillText(keyLabel(k), 8, y + lh / 2 + 5);
      P.keys.forEach(([kk, a, b]) => {
        if (kk !== k || a > t || (b ?? t) < t - span) return;
        const x0 = Math.max(30, X(a)), x1 = X(Math.min(b ?? t, t));
        c.fillStyle = (b ?? 1e9) >= t ? TURN : PLAYER; c.fillRect(x0, y + 6, Math.max(2, x1 - x0), lh - 12);
      });
    });
    c.strokeStyle = INK; c.beginPath(); c.moveTo(w - .5, 0); c.lineTo(w - .5, h); c.stroke();
  }
  function tick(now) {
    if (!cur) return;
    const delta = stepLast ? Math.min(now - stepLast, 250) : 0;
    stepLast = now;
    if (compactLayout.matches && !document.hidden) {
      const bounds = panel.getBoundingClientRect();
      if (bounds.top < innerHeight && bounds.bottom > navH()) {
        stepElapsed += delta;
        if (stepElapsed >= 2000) selectStep((activeStep + 1) % steps.length);
      }
    }
    const st = STORY[cur], t = (now - t0) / 1000;
    // stages that run more than once start over each round, with the next case
    const u = st.cycle ? t % st.cycle : t, r = st.cycle ? Math.floor(t / st.cycle) % st.cases : 0;
    if (st.cycle && r !== round) { round = r; st.fill(panel, r); }
    const lit = steps.reduce((n, [, , at], i) => u >= at ? i : n, -1);
    panel.querySelectorAll(".rail li").forEach((li, i) => {
      li.classList.toggle("on", i <= lit); li.classList.toggle("now", i === lit);
      li.classList.toggle("done", i + 1 < steps.length && u >= steps[i + 1][2]);
    });
    panel.querySelectorAll(".card").forEach((cd, i) => { cd.classList.toggle("in", compactLayout.matches || u >= steps[i][2]); cd.classList.toggle("now", i === (compactLayout.matches ? activeStep : lit)); });
    panel.querySelectorAll(".card [data-at]").forEach(el => el.classList.toggle("in", compactLayout.matches || u >= +el.dataset.at));
    panel.querySelectorAll(".typed").forEach(el => {
      const f = compactLayout.matches ? 1 : clamp((u - +el.dataset.at) / +el.dataset.dur, 0, 1), txt = el.dataset.text || "", n = Math.ceil(txt.length * f);
      if (+el.dataset.n !== n) { el.dataset.n = n; el.innerHTML = rich(txt, n); }
    });
    const flip = panel.querySelector(".flip");
    if (flip) { const i = Math.floor(t / 1.1) % flip.children.length; [...flip.children].forEach((im, j) => im.classList.toggle("on", j === i)); }
    const vt = video && video.readyState >= 2 ? video.currentTime - P.offset : P.from;
    panel.querySelectorAll(".pline").forEach(cv => {
      const v = progressLine(cv, vt), tok = cv.parentElement.querySelector(".tok");
      if (tok) tok.textContent = Math.round(v * S.task.target);
    });
    panel.querySelectorAll(".lanes").forEach(cv => lanes(cv, vt));
    const mini = panel.querySelector(".mini");
    if (mini) {   // the policy lines that ran on the call at this moment of the video
      let hit = []; for (const [tt, ls] of S.coding.hits) { if (tt > vt) break; hit = ls; }
      const key = hit.join(",");
      if (key !== lastHit) { lastHit = key; mini.querySelectorAll("span").forEach(sp => sp.classList.toggle("hit", hit.includes(+sp.dataset.l))); }
    }
    const seen = panel.querySelector(".seen");
    if (seen) seen.classList.toggle("thinking", u < steps[2][2]);
    if (!compactLayout.matches && t > st.dur && performance.now() > held && running) show(ORDER[(ORDER.indexOf(cur) + 1) % ORDER.length]);
  }

  // ---------- the drawing
  const ctx = canvas.getContext("2d"), wall = new Image();
  wall.src = "assets/wall.webp";
  const COLS = T.cols, [TW, TH] = T.tile;
  let G = null;
  const node = k => cycle.querySelector(`.node[data-k=${k}]`);
  // Everything is placed in design units on a DW x DH board, which is then scaled as one
  // piece to fit the screen; the ring, the cards and the icons keep their proportions.
  const DH = 424, R = 170, GAP = 72, GAP_OUT = 124, TRUNK = 16, OY = 62, SIDE = 32;   // SIDE: sites to Scout = outputs to their windows
  let DW = 1300;   // set by layout() to just hold both sides
  // What the loop gives, each a framed window onto a list that keeps growing; when the bottom
  // row is full the rows slide up and the top one leaves the window. The Environments come a
  // game at a time, a card with a pip for each of its tasks; the Data comes an episode at a
  // time, a strip with the game's picture and the progress of that run.
  function shelf(cols, cw, ch, view, tone) {
    const s = { cols, cw, ch, view, tone, gap: 6, pad: 9, rows: [], base: 0, scroll: 0, flash: {} };
    s.w = cols * (cw + s.gap) - s.gap + 2 * s.pad; s.h = view * (ch + s.gap) - s.gap + 2 * s.pad; s.step = ch + s.gap;
    return s;
  }
  const ENVS = shelf(2, 54, 40, 2, "game"), DATA = shelf(1, 114, 17, 4, "player");
  const HEAP_W = ENVS.w;
  function layout() {
    const box = $("#cycle-box"), stage = cycle.closest(".pin-stage");
    // the single stages share one size (set in the stylesheet); the two frames, the Builder
    // with its skills and the two players, are larger
    const size = el => [el.offsetWidth / 2, el.offsetHeight / 2], group = $("#pgroup"), bgroup = $("#bgroup");
    const [nw] = size(node("scout")), [bw, bh] = size(bgroup), [gw, gh] = size(group);
    // the board is as wide as the two sides of the ring need; the outputs take more room than
    // the way in, so the ring sits a little left of the middle
    const left = R + bw + GAP + 2 * nw + SIDE + HEAP_W, right = R + gw + GAP_OUT + 2 * nw + SIDE + ENVS.w;
    DW = Math.round(left + right + 12);
    const availW = box.offsetWidth, availH = stage.clientHeight - offsetIn(box, stage) - panel.offsetHeight - 18 - 26;
    const k = compactLayout.matches ? 1 : Math.min(availW / DW, Math.max(0.1, availH / DH), 1.12);
    cycle.style.width = DW + "px"; cycle.style.height = DH + "px"; cycle.style.transform = compactLayout.matches ? "none" : `translateX(-50%) scale(${k})`;
    box.style.height = Math.round(DH * k) + "px";
    // on tall screens the drawing and its panel sit in the middle of the room under the title
    box.style.marginTop = compactLayout.matches ? "0px" : Math.max(0, Math.round((availH - DH * k) / 2)) + "px";
    const dpr = (devicePixelRatio || 1) * k;
    canvas.width = Math.round(DW * dpr); canvas.height = Math.round(DH * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cx = left + 6, cy = DH / 2;
    const sx = cx - R - bw - GAP - nw, dx = cx + R + gw + GAP_OUT + nw;
    G = { W: DW, H: DH, cx, cy, sx, dx, sL: sx - nw, dR: dx + nw };
    const place = (el, x, y) => { el.style.left = x + "px"; el.style.top = y + "px"; };
    place(node("scout"), sx, cy); place(bgroup, cx - R, cy); place(node("env"), cx, cy - R);
    place(group, cx + R, cy); place(node("reports"), cx, cy + R);
    place(node("envs"), dx, cy - OY); place(node("data"), dx, cy + OY);
    // the sites end SIDE short of the Scout; the windows start SIDE past the outputs
    G.heap = heap([...$("#logos").children], G.sL - SIDE - HEAP_W, G.sL - SIDE, cy, 44);
    const reach = Math.max(...G.heap.map(c => c.x + c.w / 2)), shift = G.sL - SIDE - reach;
    G.heap.forEach(c => { c.x += shift; place(c.el, c.x, c.y); });
    Object.assign(ENVS, { x: G.dR + SIDE, y: cy - OY - ENVS.h / 2 });
    Object.assign(DATA, { x: G.dR + SIDE, y: cy + OY - DATA.h / 2 });
    if (!ENVS.rows.length) {   // start part full
      const any = () => Math.floor(Math.random() * T.games.length);
      ENVS.rows = [[{ gi: any() }, { gi: any() }], [{ gi: any() }, null]];
      DATA.rows = [[strip(any())], [strip(any())], [strip(any())], [null]];
    }
    // Where the ring clears a box, in degrees either side of its angle: past the top or bottom
    // edge of the Builder's frame (a) and of the players' frame (g), past the sides of the boxes
    // above and below (b). Each arrow takes the colour of the stage it leaves.
    const PAD = 12, edge = half => Math.asin(Math.min(1, (half + PAD) / R)) * 180 / Math.PI;
    const a = edge(bh), b = edge(nw), g = edge(gh);
    G.arcs = [   // [from, to] in screen degrees, clockwise, and the colour
      [180 + a, 270 - b, "game"], [270 + b, 360 - g, "game"], [g, 90 - b, "player"], [90 + b, 180 - a, "turn"]];
    G.links = [[sx + nw + PAD, cy, cx - R - bw - PAD, cy, "grey"]];   // [x0, y0, x1, y1, colour]
    // The way out forks: one band leaves the players' frame and splits in two, teal bending up
    // to the Environments and iris down to the Data. Each half is a whole arrow from the frame,
    // drawn only on its own side of the middle, so the two run as one band until they part.
    const fx = cx + R + gw + PAD, x0 = fx + TRUNK, xe = dx - nw - PAD - HEAD_L, L = xe - x0;
    const bend = y1 => [[fx, cy], ...Array.from({ length: 41 }, (_, i) => {   // a cubic, level where it leaves and where it arrives
      const t = i / 40, u = 1 - t;
      return [u * u * u * x0 + 3 * u * u * t * (x0 + L / 2) + 3 * u * t * t * (xe - L / 2) + t * t * t * xe, cy + (y1 - cy) * (3 * u * t * t + t * t * t)];
    })];
    const up = bend(cy - OY), down = bend(cy + OY);
    G.fork = [[band(up), "game"], [band(down), "player"]];
    const line = (...pts) => {   // points evenly spaced along a broken line
      const seg = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1])), total = seg.reduce((s, l) => s + l);
      return Array.from({ length: 60 }, (_, n) => {
        let d = total * n / 59, i = 0;
        while (i < seg.length - 1 && d > seg[i]) d -= seg[i++];
        const f = d / seg[i]; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f];
      });
    };
    const arc = (a0, a1) => Array.from({ length: 160 }, (_, i) => { const a = (a0 + (a1 - a0) * i / 159) * Math.PI / 180; return [cx + R * Math.cos(a), cy + R * Math.sin(a)]; });
    G.paths = { feed: line([sx, cy], [cx - R, cy]), top: arc(180, 360), back: arc(0, 180),
      ship: line([cx + R, cy], ...up, [dx, cy - OY]), rec: line([cx + R, cy], ...down, [dx, cy + OY]) };
  }
  // rows are numbered for good (`base` is the number of the top one kept), so a card flying
  // to its slot keeps its target while the rows slide under it
  const cellAt = (s, row, col) => [s.x + s.pad + col * (s.cw + s.gap) + s.cw / 2, s.y + s.pad + (row - s.base) * s.step - s.scroll + s.ch / 2];
  function claim(s) {   // the next free slot, opening a new row at the bottom when the last is full
    let r = s.rows.length - 1, c = s.rows[r].indexOf(null);
    if (c < 0) { s.rows.push(Array(s.cols).fill(null)); r++; c = 0; }
    s.rows[r][c] = false;   // taken, still in flight
    return [s.base + r, c];
  }
  function settle(s, [r, c], cell) { if (r >= s.base) { s.rows[r - s.base][c] = cell; s.flash[`${r},${c}`] = clock; } }
  function stepShelf(s, dt) {
    const target = Math.max(0, s.rows.length - s.view) * s.step;
    s.scroll += (target - s.scroll) * (1 - Math.exp(-dt * 5));
    if (s.rows.length > s.view && s.scroll > s.step - .5) { s.rows.shift(); s.base++; s.scroll -= s.step; }
  }
  function drawShelf(s, cell) {
    const { x, y } = s;
    ctx.save();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.roundRect(x, y, s.w, s.h, 6); ctx.fill();
    ctx.strokeStyle = ARROW[s.tone][0]; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath(); ctx.roundRect(x + 1, y + 1, s.w - 2, s.h - 2, 5); ctx.clip();
    s.rows.forEach((row, r) => row.forEach((it, c) => {
      const [mx, my] = cellAt(s, s.base + r, c), x0 = mx - s.cw / 2, y0 = my - s.ch / 2;
      if (y0 > y + s.h || y0 + s.ch < y) return;
      if (!it) { ctx.strokeStyle = "#cdd4dc"; ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.roundRect(x0 + .5, y0 + .5, s.cw - 1, s.ch - 1, 3); ctx.stroke(); ctx.setLineDash([]); return; }
      cell(it, x0, y0);
      const age = clock - (s.flash[`${s.base + r},${c}`] ?? -9);
      if (age < .6) { ctx.strokeStyle = alpha(ARROW[s.tone][0], (1 - age / .6).toFixed(3)); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.roundRect(x0 - 1.5, y0 - 1.5, s.cw + 3, s.ch + 3, 4); ctx.stroke(); }
    }));
    // the rows fade out at the window's top and in at its bottom
    [[y, y + 16], [y + s.h, y + s.h - 16]].forEach(([a, b]) => {
      const g = ctx.createLinearGradient(0, a, 0, b); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g; ctx.fillRect(x, Math.min(a, b), s.w, 16);
    });
    ctx.restore();
  }
  const picture = (gi, x, y, w, h) => {
    ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, 3); ctx.clip();
    if (wall.complete && wall.naturalWidth) ctx.drawImage(wall, (gi % COLS) * TW, Math.floor(gi / COLS) * TH, TW, TH, x, y, w, h);
    ctx.restore();
  };
  // an environment: the game, and a pip under it for each of its tasks
  function envCard({ gi }, x, y) {
    picture(gi, x, y, ENVS.cw, 30);
    const n = Math.min(T.games[gi].tasks || 0, 8);
    ctx.fillStyle = GAME;
    for (let i = 0; i < n; i++) ctx.fillRect(x + 1 + i * 6.5, y + 34, 4.5, 4.5);
  }
  // an episode: the game, and how its progress rose over the run, stepping up as it went
  function strip(gi) {
    const solved = Math.random() < .6, n = 2 + Math.floor(Math.random() * 4);
    const at = Array.from({ length: n }, () => .08 + Math.random() * .8).sort((a, b) => a - b);
    const top = solved ? 1 : .3 + Math.random() * .5;
    return { gi, solved, steps: at.map((t, i) => [t, top * (i + 1) / n]), end: solved ? at[n - 1] + .04 + Math.random() * .08 : 1 };
  }
  function dataStrip(it, x, y) {
    const w = DATA.cw, h = DATA.ch, lx = x + 36, lw = w - 40, Y = v => y + h - 3 - v * (h - 7);
    picture(it.gi, x, y, 30, h);
    ctx.strokeStyle = "#dde3ea"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(lx, y + h - 2.5); ctx.lineTo(lx + lw, y + h - 2.5); ctx.stroke();
    ctx.strokeStyle = PLAYER; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(lx, Y(0));
    let v = 0;
    for (const [t, vv] of it.steps) { ctx.lineTo(lx + t * lw, Y(v)); ctx.lineTo(lx + t * lw, Y(vv)); v = vv; }
    ctx.lineTo(lx + it.end * lw, Y(v)); ctx.stroke();
    if (it.solved) { ctx.fillStyle = PLAYER; ctx.beginPath(); ctx.arc(lx + it.end * lw, Y(v), 2.4, 0, Math.PI * 2); ctx.fill(); }
  }
  function along(pts, f) {
    const x = clamp(f, 0, 1) * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(x)), t = x - i;
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, Math.atan2(y1 - y0, x1 - x0)];
  }
  // Block arrows drawn like the boxes: a pale solid fill inside a 1.5px rule in the colour of
  // the stage the arrow leaves, corners slightly rounded.
  const BODY = 26, HEAD_L = 24, HEAD_W = 48;
  const ARROW = Object.fromEntries(["game", "turn", "player"].map(k => [k, [role(`--${k}`), role(`--${k}-soft`)]]));
  ARROW.grey = ["#4b5563", "#eef1f4"];
  function paint(tone) {
    const [line, fill] = ARROW[tone];
    ctx.save(); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = line; ctx.lineWidth = 1.5; ctx.lineJoin = "round"; ctx.stroke(); ctx.restore();
  }
  function arcArrow(a0, a1, tone) {
    const r0 = a0 * Math.PI / 180, r1 = a1 * Math.PI / 180, hl = HEAD_L / R;
    const at = (a, rr) => [G.cx + rr * Math.cos(a), G.cy + rr * Math.sin(a)];
    ctx.beginPath();
    ctx.arc(G.cx, G.cy, R + BODY / 2, r0, r1 - hl);
    ctx.lineTo(...at(r1 - hl, R + HEAD_W / 2)); ctx.lineTo(...at(r1, R)); ctx.lineTo(...at(r1 - hl, R - HEAD_W / 2));
    ctx.arc(G.cx, G.cy, R - BODY / 2, r1 - hl, r0, true);
    ctx.closePath(); paint(tone);
  }
  // a straight arrow at any angle
  function lineArrow(x0, y0, x1, y1, tone) {
    const len = Math.hypot(x1 - x0, y1 - y0), h = BODY / 2, hw = HEAD_W / 2, xh = len - HEAD_L;
    ctx.save(); ctx.translate(x0, y0); ctx.rotate(Math.atan2(y1 - y0, x1 - x0));
    ctx.beginPath(); ctx.moveTo(0, -h); ctx.lineTo(xh, -h); ctx.lineTo(xh, -hw); ctx.lineTo(len, 0);
    ctx.lineTo(xh, hw); ctx.lineTo(xh, h); ctx.lineTo(0, h); ctx.closePath();
    ctx.restore(); paint(tone);
  }
  // a band BODY wide along a path that ends level, with an arrowhead there
  function band(pts) {
    const p = new Path2D(), h = BODY / 2, n = pts.length, side = [];
    pts.forEach(([x, y], i) => {
      const [ax, ay] = pts[Math.max(0, i - 1)], [bx, by] = pts[Math.min(n - 1, i + 1)], l = Math.hypot(bx - ax, by - ay);
      side.push([x - (by - ay) / l * h, y + (bx - ax) / l * h, x + (by - ay) / l * h, y - (bx - ax) / l * h]);
    });
    side.forEach(([x, y], i) => p[i ? "lineTo" : "moveTo"](x, y));
    const [x, y] = pts[n - 1];
    p.lineTo(x, y + HEAD_W / 2); p.lineTo(x + HEAD_L, y); p.lineTo(x, y - HEAD_W / 2);
    side.reverse().forEach(([, , x, y]) => p.lineTo(x, y));
    p.closePath();
    return p;
  }
  function fork() {   // the teal half above the middle, the iris half below it
    G.fork.forEach(([p, tone], i) => {
      const [line, fill] = ARROW[tone];
      ctx.save(); ctx.beginPath(); ctx.rect(0, i ? G.cy : 0, G.W, i ? G.H - G.cy : G.cy); ctx.clip();
      ctx.fillStyle = fill; ctx.fill(p); ctx.strokeStyle = line; ctx.lineWidth = 1.5; ctx.lineJoin = "round"; ctx.stroke(p);
      ctx.restore();
    });
  }
  function thumb(gi, x, y, w, h, s = 1, border = null) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.roundRect(-w / 2 - 2.5, -h / 2 - 2.5, w + 5, h + 5, 3.5); ctx.fill();
    if (wall.complete && wall.naturalWidth) ctx.drawImage(wall, (gi % COLS) * TW, Math.floor(gi / COLS) * TH, TW, TH, -w / 2, -h / 2, w, h);
    ctx.strokeStyle = border || "#5b6470"; ctx.lineWidth = border ? 2 : 1; ctx.stroke();
    ctx.restore();
  }
  function stripAt(it, x, y, s) {   // an episode on its way to the Data
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    const w = DATA.cw, h = DATA.ch;
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.roundRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6, 4); ctx.fill();
    ctx.strokeStyle = PLAYER; ctx.lineWidth = 1.5; ctx.stroke();
    dataStrip(it, -w / 2, -h / 2);
    ctx.restore();
  }

  // Games ride the arrows: out of the sites, through the Scout and the Builder (lighting the
  // skill for their engine), over to the players. Each time a game is played, both players'
  // episodes go to the Data; the game goes round again or, done, into the Environments.
  const items = [], LEG = { drift: 1.9, feed: 1.4, top: 2.4, back: 2.4, ship: 1.3, shelf: .9, rec: 1.2, file: .8 };
  function spawn() {
    const c = G.heap[Math.floor(Math.random() * G.heap.length)];   // out from behind one of the cards
    const from = [c.x + (Math.random() - .5) * c.w * .6, c.y], to = [G.sx, G.cy];
    const bend = [(from[0] + to[0]) / 2 + (Math.random() - .5) * 60, (from[1] + to[1]) / 2 + (Math.random() - .5) * 120];
    const r = Math.random();
    items.push({ gi: Math.floor(Math.random() * T.games.length), leg: "drift", t: 0, from, bend, to, rounds: 1 + (r < .45) + (r < .12) });
  }
  function light(gi) {
    const el = $(`#skills [data-engine="${T.games[gi].engine}"]`);
    if (!el) return;
    el.classList.add("lit"); clearTimeout(el.off); el.off = setTimeout(() => el.classList.remove("lit"), 1100);
  }
  function drawItem(it) {
    if (it.t < 0) return;
    const f = ease(clamp(it.t, 0, 1));
    if (it.leg === "drift") {
      const u = 1 - f;
      const x = u * u * it.from[0] + 2 * u * f * it.bend[0] + f * f * it.to[0], y = u * u * it.from[1] + 2 * u * f * it.bend[1] + f * f * it.to[1];
      return thumb(it.gi, x, y, 54, 30, .55 + .35 * f);
    }
    if (it.leg === "shelf" || it.leg === "file") {   // from the output into its slot in the window
      const s = it.leg === "shelf" ? ENVS : DATA, [x1, yc] = cellAt(s, ...it.slot), y0 = G.cy + (s === ENVS ? -OY : OY);
      const y1 = s === ENVS ? yc - 5 : yc;   // a card's picture sits above its pips
      const x = G.dx + (x1 - G.dx) * f, y = y0 + (y1 - y0) * f - Math.sin(f * Math.PI) * 22;
      return s === ENVS ? thumb(it.gi, x, y, 54, 30, 1 + (ENVS.cw / 54 - 1) * f, GAME) : stripAt(it.cell, x, y, .8 + .2 * f);
    }
    const [x, y] = along(G.paths[it.leg], it.t);
    if (it.leg === "rec") return stripAt(it.cell, x, y, .8);
    thumb(it.gi, x, y, 54, 30, it.leg === "feed" ? .9 + .1 * clamp(it.t * 2.5, 0, 1) : 1, it.leg === "back" ? TURN : it.leg === "ship" ? GAME : null);
  }

  let running = false, last = 0, clock = 0, spawnIn = 0, frameId = 0;
  const nextFrame = () => { frameId = requestAnimationFrame(frame); };
  function frame(now) {
    if (!running) return;
    // Keep the full diagram on phones, with a lower frame rate for the wide canvas.
    if (compactLayout.matches && now - last < 1000 / 30) {
      nextFrame(); return;
    }
    const dt = Math.min(.05, (now - last) / 1000); last = now; clock += dt;
    ctx.clearRect(0, 0, G.W, G.H);
    G.arcs.forEach(([a0, a1, tone]) => arcArrow(a0, a1, tone));
    G.links.forEach(l => lineArrow(...l));
    fork();
    [ENVS, DATA].forEach(s => stepShelf(s, dt));
    drawShelf(ENVS, envCard); drawShelf(DATA, dataStrip);
    spawnIn -= dt;
    if (spawnIn <= 0 && items.filter(it => !it.cell).length < 8) { spawn(); spawnIn = 1.9; }
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      it.t += dt / LEG[it.leg];
      if (it.t < 1) continue;
      it.t = 0;
      if (it.leg === "drift") it.leg = "feed";
      else if (it.leg === "feed") { it.leg = "top"; light(it.gi); }
      else if (it.leg === "top") {   // played: an episode from each player, one just after the other
        [0, -.3].forEach(t => items.push({ gi: it.gi, cell: strip(it.gi), leg: "rec", t }));
        it.leg = --it.rounds > 0 ? "back" : "ship";
      }
      else if (it.leg === "back") it.leg = "top";
      else if (it.leg === "ship") { it.leg = "shelf"; it.slot = claim(ENVS); }
      else if (it.leg === "rec") { it.leg = "file"; it.slot = claim(DATA); }
      else { settle(it.cell ? DATA : ENVS, it.slot, it.cell || { gi: it.gi }); items.splice(i, 1); }
    }
    items.forEach(drawItem);
    tick(now);
    nextFrame();
  }
  observeAnimation(cycle.closest(".pin"), () => {
    running = true; last = performance.now();
    if (!cur) show("scout");
    else if (video) video.play().catch(() => {});
    nextFrame();
  }, () => { running = false; cancelAnimationFrame(frameId); if (video) video.pause(); });
  addEventListener("resize", () => { layout(); });
  layout();
  document.fonts && document.fonts.ready.then(layout);
}

/* ============ keyboard and mouse ============ */
function keyName(k) {
  if (k === " " || k === "Space" || k === "Spacebar") return "Space";
  if (k.length === 1) return k.toUpperCase();
  return { Control: "Ctrl", Escape: "Esc" }[k] || k;
}
function buildKeyboard(svg) {
  const U = 40, G = 4;
  const rows = [
    [["Esc", 1], ..."1234567890".split("").map(k => [k, 1]), ["-", 1], ["=", 1], ["Backspace", 2]],
    [["Tab", 1.5], ..."QWERTYUIOP".split("").map(k => [k, 1]), ["[", 1], ["]", 1], ["\\", 1.5]],
    [["Caps", 1.75], ..."ASDFGHJKL".split("").map(k => [k, 1]), [";", 1], ["'", 1], ["Enter", 2.25]],
    [["Shift", 2.25], ..."ZXCVBNM".split("").map(k => [k, 1]), [",", 1], [".", 1], ["/", 1], ["Shift", 2.75]],
    [["Ctrl", 1.5], ["Alt", 1.5], ["Space", 9], ["Alt", 1.5], ["Ctrl", 1.5]],
  ];
  const legend = { ArrowLeft: "←", ArrowRight: "→", ArrowUp: "↑", ArrowDown: "↓", Space: "", Backspace: "⌫" };
  let s = "", width = 0;
  const key = (name, x, y, w) => {
    const Wd = w * U - G, Ht = U - G;
    s += `<g class="key" data-k="${esc(name)}" transform="translate(${x},${y})"><rect class="base" width="${Wd}" height="${Ht}" rx="6" fill="#cfd5dd"/>
      <g class="cap"><rect class="top" x="2" y="1.5" width="${Wd - 4}" height="${Ht - 7}" rx="5" fill="#fff" stroke="#e3e7ec"/>
      <text x="8" y="17" font-size="${name.length > 2 ? 10 : 13}" font-family="Libre Franklin, sans-serif" fill="#4b5563">${esc(legend[name] ?? name)}</text></g></g>`;
  };
  rows.forEach((row, r) => { let x = 0; row.forEach(([k, w]) => { key(k, x + 10, r * U + 10, w); x += w * U; }); width = Math.max(width, x); });
  const ax = width + 10 + U * .5;
  key("ArrowUp", ax + U, 3 * U + 10, 1); key("ArrowLeft", ax, 4 * U + 10, 1); key("ArrowDown", ax + U, 4 * U + 10, 1); key("ArrowRight", ax + 2 * U, 4 * U + 10, 1);
  const total = ax + 3 * U + 10, height = 5 * U + 16;
  svg.setAttribute("viewBox", `0 0 ${total} ${height}`);
  svg.innerHTML = `<rect width="${total}" height="${height}" rx="12" fill="#eef1f4"/>` + s;
  const all = [...svg.querySelectorAll(".key")];
  return { aspect: height / total, set(held) { all.forEach(k => k.classList.toggle("down", held.has(k.dataset.k))); } };
}
function buildMouse(svg) {
  svg.innerHTML = `<path d="M46 4 C20 4 6 22 6 50 L6 104 C6 132 24 146 46 146 C68 146 86 132 86 104 L86 50 C86 22 72 4 46 4 Z" fill="#fff" stroke="#bcc3cc" stroke-width="2"/>
    <path class="mbtn" data-b="0" d="M45 5 C21 5 7 22 7 50 L7 62 L45 62 Z" fill="#fff" stroke="#bcc3cc" stroke-width="1.5"/>
    <path class="mbtn" data-b="2" d="M47 5 C71 5 85 22 85 50 L85 62 L47 62 Z" fill="#fff" stroke="#bcc3cc" stroke-width="1.5"/>
    <rect x="41" y="16" width="10" height="24" rx="5" fill="#dde2e8" stroke="#bcc3cc"/>`;
  const btns = [...svg.querySelectorAll(".mbtn")];
  return { set(held) { btns.forEach(b => b.classList.toggle("down", held.has(+b.dataset.b))); } };
}

/* ============ shared player pieces ============ */
const valueAt = (series, t) => {
  let lo = 0, hi = series.length - 1, v = series.length ? series[0][1] : 0;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (series[m][0] <= t) { v = series[m][1]; lo = m + 1; } else hi = m - 1; }
  return v;
};
function scrubber(el, onSeek) {
  let down = false;
  const at = e => { const r = el.getBoundingClientRect(); onSeek(clamp((e.clientX - r.left) / r.width, 0, 1)); };
  el.addEventListener("pointerdown", e => { down = true; el.setPointerCapture(e.pointerId); at(e); });
  el.addEventListener("pointermove", e => down && at(e));
  el.addEventListener("pointerup", () => down = false);
}
function drawScrub(canvas, series, t, dur) {
  const { ctx, w, h } = fit(canvas, canvas.parentElement.clientHeight);
  ctx.fillStyle = role("--game-wash"); ctx.fillRect(0, 0, w * t / dur, h);
  ctx.strokeStyle = GAME; ctx.lineWidth = 1.4; ctx.beginPath();
  series.forEach(([tt, v], i) => { const x = tt / dur * w, y = h - 4 - v * (h - 8); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
  ctx.stroke();
}
// The pointer and its clicks over a 16:9 screen; positions are in the 1280x720 frame.
function pointerLayer(cursor, ripple) {
  let lastT = 0;
  return (pointer, buttons, t) => {
    let q = null; for (const e of pointer) { if (e[0] > t) break; q = e; }
    cursor.style.display = q ? "block" : "none";
    if (q) { cursor.style.left = q[1] / 12.8 + "%"; cursor.style.top = q[2] / 7.2 + "%"; }
    buttons.forEach(([, a]) => {
      if (a > lastT && a <= t && t - a < .3) {
        const pt = pointer.filter(e => e[0] <= a).pop();
        if (pt) { ripple.style.left = pt[1] / 12.8 + "%"; ripple.style.top = pt[2] / 7.2 + "%"; }
        ripple.animate([{ opacity: 1, transform: "scale(.4)" }, { opacity: 0, transform: "scale(1.5)" }], { duration: 450 });
      }
    });
    lastT = t;
  };
}
// Size a bench so the whole player fits in one screen: the left column is as wide as the
// height allows, the right column takes the rest and matches the left column's height.
const offsetIn = (el, anc) => { let y = 0; while (el && el !== anc) { y += el.offsetTop; el = el.offsetParent; } return y; };
function fitBench(bench, left, extra) {
  if (compactLayout.matches) {
    bench.style.gridTemplateColumns = "minmax(0, 1fr)";
    return left.clientWidth;
  }
  const stage = bench.closest(".pin-stage"), top = stage ? offsetIn(bench, stage) : 156;
  const cap = stage && stage.querySelector(".fig-cap"), below = cap ? cap.offsetHeight + 12 : 0;   // its caption stays on screen too
  const wrapW = bench.parentElement.clientWidth, avail = (stage ? stage.clientHeight : innerHeight) - top - 24 - below;
  const lw = clamp((avail - extra.fixed) / extra.perWidth, 380, wrapW * .62);
  bench.style.gridTemplateColumns = `${Math.round(lw)}px minmax(0, 1fr)`;
  return lw;
}
// Players start fetching only when their section comes within a screen of view.
const near = (el, fn) => new IntersectionObserver((es, io) => { if (es.some(e => e.isIntersecting)) { io.disconnect(); fn(); } }, { rootMargin: "100% 0px" }).observe(el);
function videoLoop(video, render, playBtn, active = () => true) {
  video.preload = "none";
  near(video, () => { video.preload = "auto"; });
  const loop = () => { render(video.currentTime); if (!video.paused) schedule(); };
  const schedule = () => video.requestVideoFrameCallback ? video.requestVideoFrameCallback(loop) : requestAnimationFrame(loop);
  video.addEventListener("play", () => { playBtn.textContent = "❚❚"; schedule(); });
  video.addEventListener("pause", () => playBtn.textContent = "▶");
  video.addEventListener("seeked", () => render(video.currentTime));
  video.addEventListener("loadeddata", () => render(video.currentTime));
  video.addEventListener("ended", () => { video.currentTime = 0; video.play(); });
  playBtn.onclick = () => video.paused ? video.play() : video.pause();
  let visible = false;
  const sync = () => visible && active() ? video.play().catch(() => {}) : video.pause();
  new IntersectionObserver(es => es.forEach(e => { visible = e.isIntersecting; sync(); }), { threshold: .3 }).observe(video);
  return { resume: () => { if (visible && active()) video.play().catch(() => {}); }, sync };
}

/* ============ examples ============ */
function initExamples(list) {
  const video = $("#ex-video"), kb = buildKeyboard($("#ex-kb")), ms = buildMouse($("#ex-ms"));
  const pointer = pointerLayer($("#ex-cursor"), $("#ex-ripple"));
  let cur = null;
  $("#ex-tabs").innerHTML = list.map((r, i) => `<button data-i="${i}">${esc(r.title.replace(/[^\x20-\x7e]/g, "").trim())}</button>`).join("");
  $("#ex-tabs").addEventListener("click", e => { const b = e.target.closest("button"); if (b) open(+b.dataset.i); });
  function layout() {
    // left = video (9/16 w) + transport (36) + deck (keyboard 0.87w * aspect)
    const lw = fitBench($("#ex-bench"), $("#ex-left"), { perWidth: .5625 + .87 * kb.aspect, fixed: 36 + 10 + 12 });
    $("#ex-ms-box").style.width = Math.round(lw * .12) + "px";
    if (cur) render(video.currentTime);
  }
  function open(i) {
    cur = list[i];
    document.querySelectorAll("#ex-tabs button").forEach(b => b.classList.toggle("on", +b.dataset.i === i));
    setVideo(video, cur.video); video.currentTime = 0; resume();
    $("#ex-task").textContent = cur.instruction;
    const dur = {}; cur.keys.forEach(([k, a, b]) => dur[k] = (dur[k] || 0) + ((b ?? cur.duration) - a));
    cur.lanes = Object.keys(dur).sort((a, b) => dur[b] - dur[a]).slice(0, 5);
    layout(); render(0);
  }
  function render(tv) {
    if (!cur) return;
    const dur = cur.duration, t = clamp(tv - cur.offset, 0, dur);
    $("#ex-prog").textContent = Math.round(valueAt(cur.progress, t) * 100) + "%";
    $("#ex-t").textContent = t.toFixed(1);
    $("#ex-time").textContent = `${t.toFixed(1)} / ${dur.toFixed(1)}`;
    kb.set(new Set(cur.keys.filter(([, a, b]) => a <= t && t < (b ?? dur)).map(([k]) => keyName(k))));
    ms.set(new Set(cur.buttons.filter(([, a, b]) => a <= t && t < (b ?? dur) + .08).map(([b]) => b)));
    pointer(cur.pointer, cur.buttons, t);
    drawScrub($("#ex-scrub-c"), cur.progress, t, dur);
    const leftH = $("#ex-left").offsetHeight, used = $("#ex-task-box").offsetHeight + 14 + $(".read", $("#ex-right")).offsetHeight + 12 + $(".charts .label").offsetHeight + 6;
    charts(t, dur, Math.max(compactLayout.matches ? 320 : 220, leftH - used));
  }
  // One canvas: every row has the same label height, plot height and width.
  function charts(t, dur, height) {
    const metrics = Object.entries(cur.metrics), rows = [["progress", cur.progress, 0, 1], ...metrics.map(([k, s]) => [k, s]), ["inputs"]];
    const LABEL = 18, GAP = 10, PLOT = Math.floor((height - rows.length * (LABEL + GAP)) / rows.length);
    const { ctx, w } = fit($("#ex-charts"), height), X = v => v / dur * w;
    ctx.font = "12px 'Libre Franklin', sans-serif";
    rows.forEach(([name, s, lo, hi], i) => {
      const y0 = i * (LABEL + PLOT + GAP), py = y0 + LABEL;
      ctx.fillStyle = INK3; ctx.fillText(name, 0, y0 + 12);
      ctx.fillStyle = PANEL; ctx.fillRect(0, py, w, PLOT);
      if (name === "inputs") {
        const lanes = [...cur.lanes.map(k => ["key", k]), ...(cur.buttons.length ? [["mouse", null]] : [])], lh = PLOT / Math.max(1, lanes.length);
        lanes.forEach(([kind, k], j) => {
          const ly = py + j * lh, items = kind === "key" ? cur.keys.filter(e => e[0] === k).map(e => [e[1], e[2]]) : cur.buttons.map(b => [b[1], b[2]]);
          items.forEach(([a, b]) => { ctx.fillStyle = a <= t ? GAME : "#dde3ea"; ctx.fillRect(X(a), ly + 2, Math.max(2, X((b ?? dur) - a)), lh - 4); });
        });
      } else {
        const a = lo ?? Math.min(...s.map(p => p[1])), b = hi ?? Math.max(...s.map(p => p[1])), span = b - a || 1;
        const Y = v => py + PLOT - 4 - (v - a) / span * (PLOT - 8);
        const v = valueAt(s, t), txt = name === "progress" ? Math.round(v * 100) + "%" : String(v);
        ctx.fillStyle = INK; ctx.fillText(txt, w - ctx.measureText(txt).width, y0 + 12);
        [[dur, "#cfd6de", 1.5], [t, GAME, 2]].forEach(([upto, color, lw]) => {
          ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.beginPath(); let prev = null;
          s.forEach(([tt, vv]) => { if (tt > upto) return; const x = X(tt), y = Y(vv); if (prev === null) ctx.moveTo(x, y); else { ctx.lineTo(x, Y(prev)); ctx.lineTo(x, y); } prev = vv; });
          if (prev !== null && upto < dur) ctx.lineTo(X(upto), Y(prev));
          ctx.stroke();
        });
      }
      ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X(t), py); ctx.lineTo(X(t), py + PLOT); ctx.stroke();
    });
  }
  const { resume } = videoLoop(video, render, $("#ex-play"));
  scrubber($("#ex-scrub"), f => { video.currentTime = f * (cur?.duration || 0); render(video.currentTime); });
  addEventListener("resize", layout);
  open(0);
}

/* ============ how a policy plays ============ */
// Split each line into strings, comments and code first, so colouring one never rewrites another.
function highlightPy(line) {
  const KW = /^(def|class|return|if|else|elif|for|while|in|not|and|or|None|True|False|self|lambda|is|import|from|with|as|try|except|break|continue|pass)$/;
  let out = "", i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (ch === "#") { out += `<span class="cm">${esc(line.slice(i))}</span>`; break; }
    if (ch === '"' || ch === "'") { let j = i + 1; while (j < line.length && line[j] !== ch) j += line[j] === "\\" ? 2 : 1; out += `<span class="st">${esc(line.slice(i, j + 1))}</span>`; i = j + 1; continue; }
    const word = /^[A-Za-z_]\w*/.exec(line.slice(i)), num = /^\d+(\.\d+)?/.exec(line.slice(i));
    if (word) { out += KW.test(word[0]) ? `<span class="kw">${word[0]}</span>` : word[0]; i += word[0].length; continue; }
    if (num) { out += `<span class="nu">${num[0]}</span>`; i += num[0].length; continue; }
    out += esc(ch); i++;
  }
  return out;
}
const showValue = v => {
  if (v === null || v === undefined) return "None";
  if (typeof v === "boolean") return v ? "True" : "False";
  if (Array.isArray(v)) return "[" + v.slice(0, 4).map(x => typeof x === "string" ? `'${x}'` : showValue(x)).join(", ") + (v.length > 4 ? ", …" : "") + "]";
  if (typeof v === "object") return v.lateral !== undefined ? `{lateral ${(+v.lateral).toFixed(2)}, distance ${(+v.distance).toFixed(0)}}` : "{…}";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
  return `'${String(v).slice(0, 24)}'`;
};
// World coordinates into a canvas, aspect kept, centred.
function frame(w, h, [x0, y0, x1, y1], pad = 8) {
  const k = Math.min((w - 2 * pad) / (x1 - x0), (h - 2 * pad) / (y1 - y0));
  const ox = (w - (x1 - x0) * k) / 2 - x0 * k, oy = (h - (y1 - y0) * k) / 2 - y0 * k;
  return { X: x => ox + x * k, Y: y => oy + y * k, k };
}
function ray(ctx, x0, y0, x1, y1, color, width, head) {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  if (!head) return;
  const a = Math.atan2(y1 - y0, x1 - x0); ctx.fillStyle = color; ctx.beginPath();
  ctx.moveTo(x1 + Math.cos(a) * 3, y1 + Math.sin(a) * 3);
  ctx.lineTo(x1 + Math.cos(a + 2.5) * 7, y1 + Math.sin(a + 2.5) * 7); ctx.lineTo(x1 + Math.cos(a - 2.5) * 7, y1 + Math.sin(a - 2.5) * 7); ctx.fill();
}
const dot = (ctx, x, y, r, fill, stroke) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); } };
const RED = "#e04040", AMBER = "#f0a630", GOLD = "#ffd23f";
const MAPS = {
  // The race: road across, distance ahead upwards; the dashed line is where it steers.
  "43_pico-world-race"(ctx, w, h, v) {
    const X = lat => w / 2 + lat * (w * .36), Y = d => h - 18 - d / 200 * (h - 28);
    ctx.fillStyle = "#e8edf2"; ctx.fillRect(X(-1), 0, X(1) - X(-1), h);
    ctx.strokeStyle = "#c9d1da"; ctx.setLineDash([5, 7]); ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.stroke(); ctx.setLineDash([]);
    (v.obstacles || []).forEach(([side, d]) => { if (d <= 200) { ctx.fillStyle = INK3; ctx.fillRect(X(side * 1.08) - 5, Y(d) - 5, 10, 10); } });
    (v.tokens || []).forEach(([lat, d]) => { if (d <= 200 && d >= -5) dot(ctx, X(lat), Y(d), 4.5, GOLD, "#b8901a"); });
    (v.opponents || []).forEach(([lat, d]) => { if (d <= 200 && d >= -8) { ctx.fillStyle = PLAYER; ctx.fillRect(X(lat) - 4.5, Y(d) - 7, 9, 14); } });
    if (typeof v.target === "number") { ctx.setLineDash([4, 4]); ray(ctx, X(v.target), Y(0), X(v.target), Y(120), TURN, 2); ctx.setLineDash([]); }
    ctx.fillStyle = INK; ctx.fillRect(X(v.lateral) - 5.5, Y(0) - 9, 11, 18);
    if (v.turn) ray(ctx, X(v.lateral), Y(0) - 12, X(v.lateral) + v.turn * 16, Y(0) - 20, INK, 2, true);
  },
  // The bullets the probe reports, and the 18 moves it scored: red ones end in a hit.
  "131_touhou-tales-of-danmaku"(ctx, w, h, v) {
    const { X, Y, k } = frame(w, h, v.b);
    ctx.fillStyle = "#e8edf2"; ctx.fillRect(X(v.b[0]), Y(v.b[1]), (v.b[2] - v.b[0]) * k, (v.b[3] - v.b[1]) * k);
    if (typeof v.tx === "number") { ctx.setLineDash([3, 4]); ray(ctx, X(v.tx), Y(0), X(v.tx), Y(v.b[3]), PLAYER, 1); ctx.setLineDash([]); }
    if (v.boss) { ctx.fillStyle = INK3; ctx.fillRect(X(v.boss[0] - v.boss[2] / 2), Y(v.boss[1] - v.boss[3] / 2), v.boss[2] * k, v.boss[3] * k); }
    (v.en || []).forEach(([x, y, r]) => dot(ctx, X(x), Y(y), Math.max(2.5, r * k), INK3));
    const [px, py] = v.p;
    (v.cand || []).forEach(([x, y, s]) => ray(ctx, X(px), Y(py), X(x), Y(y), s < 0 ? RED : s < 5 ? AMBER : "#b9bec4", 1));
    const pick = v.pick && (v.cand || []).find(c => c[3] === v.pick[2] && Math.abs(c[4] - v.pick[0]) < .01 && Math.abs(c[5] - v.pick[1]) < .01);
    if (pick && (pick[4] || pick[5])) ray(ctx, X(px), Y(py), X(pick[0]), Y(pick[1]), TURN, 2.5, true);
    (v.th || []).forEach(([x, y, r]) => dot(ctx, X(x), Y(y), Math.max(1.8, (r > 0 ? r : 2) * k), RED));
    dot(ctx, X(px), Y(py), 4, INK); dot(ctx, X(px), Y(py), 7, null, INK);
  },
  // The route graph: every spot the policy can stand on, darker the sooner it reaches the star.
  "76_starcatcher"(ctx, w, h, v, T) {
    const nav = T.navs[v.nav];
    if (!nav.box) {
      const xs = nav.nodes.map(n => n[0]), ys = nav.nodes.map(n => n[1]);
      nav.box = [Math.min(...xs) - 12, Math.min(...ys) - 12, Math.max(...xs) + 12, Math.max(...ys) + 12];
      const sorted = nav.d.filter(d => d !== null).sort((a, b) => a - b);   // shade by rank: near the star = dark
      nav.rank = nav.d.map(d => d === null ? null : sorted.findIndex(x => x >= d) / Math.max(1, sorted.length - 1));
    }
    const { X, Y } = frame(w, h, nav.box);
    nav.nodes.forEach(([x, y], i) => {
      const f = nav.rank[i];
      dot(ctx, X(x), Y(y), 2.2, f === null ? "#dde3ea" : alpha(TURN, (1 - f) * .9 + .08));
    });
    (v.en || []).forEach(([x, y]) => { if (x !== null) { ctx.fillStyle = INK3; ctx.fillRect(X(x) - 4, Y(y) - 4, 8, 8); } });
    const [px, py, gx, gy] = v.p;
    v.opts.forEach(([x, y, fatal], i) => { if (i !== v.pick) { if (fatal) ctx.setLineDash([3, 3]); ray(ctx, X(px), Y(py), X(x), Y(y), fatal ? RED : "#9aa3ad", 1); ctx.setLineDash([]); } });
    if (v.pick >= 0) { const [x, y] = v.opts[v.pick]; ray(ctx, X(px), Y(py), X(x), Y(y), TURN, 2.5, true); }
    const [sx, sy] = v.star; ctx.fillStyle = GOLD; ctx.strokeStyle = "#b8901a"; ctx.beginPath();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? 3.2 : 7.5, a = -Math.PI / 2 + i * Math.PI / 5; ctx.lineTo(X(sx) + r * Math.cos(a), Y(sy) + r * Math.sin(a)); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    dot(ctx, X(px), Y(py), 4.5, INK); ray(ctx, X(px), Y(py), X(px) + gx * 11, Y(py) + gy * 11, INK, 1.5, true);
  },
  // The whole arena (dashed: what the screen shows), the eight directions as scored, the aim.
  "37_radius-raid"(ctx, w, h, v) {
    const { X, Y, k } = frame(w, h, v.b);
    ctx.fillStyle = "#e8edf2"; ctx.fillRect(X(v.b[0]), Y(v.b[1]), (v.b[2] - v.b[0]) * k, (v.b[3] - v.b[1]) * k);
    ctx.strokeStyle = INK3; ctx.setLineDash([3, 3]); ctx.lineWidth = 1; ctx.strokeRect(X(v.cam[0]), Y(v.cam[1]), v.cam[2] * k, v.cam[3] * k); ctx.setLineDash([]);
    if (v.crate) { ctx.fillStyle = GOLD; ctx.strokeStyle = "#b8901a"; ctx.fillRect(X(v.crate[0]) - 5, Y(v.crate[1]) - 3.5, 10, 7); ctx.strokeRect(X(v.crate[0]) - 5, Y(v.crate[1]) - 3.5, 10, 7); }
    (v.en || []).forEach(([x, y, r]) => dot(ctx, X(x), Y(y), Math.max(2.2, r * k), RED));
    const [px, py] = v.p;
    if (v.aim) { ctx.setLineDash([3, 3]); ray(ctx, X(px), Y(py), X(v.aim[0]), Y(v.aim[1]), PLAYER, 1.2); ctx.setLineDash([]); }
    const scores = v.dirs.map(d => d[2]), lo = Math.min(...scores), hi = Math.max(...scores);
    v.dirs.forEach(([dx, dy, s], i) => {
      const len = 6 + 22 * (s - lo) / ((hi - lo) || 1);
      ray(ctx, X(px), Y(py), X(px) + dx * len, Y(py) + dy * len, i === v.pick ? TURN : "#9aa3ad", i === v.pick ? 2.5 : 1.2, i === v.pick);
    });
    dot(ctx, X(px), Y(py), 4, INK);
  },
};
function initCoding(index, active) {
  const video = $("#pv-video"), kb = buildKeyboard($("#pv-kb")), ms = buildMouse($("#pv-ms"));
  const pointer = pointerLayer($("#pv-cursor"), $("#pv-ripple")), scroller = $("#code-scroll"), code = $("#code");
  const cache = {};
  let T = null, rows = {}, assign = {}, lastIdx = -1;
  let mapH = 160;
  function layout() {
    const lw = fitBench($("#pv-bench"), $("#pv-left"), { perWidth: .5625 + .30 + .87 * kb.aspect, fixed: 36 + 10 + 10 + 12 });
    $("#pv-ms-box").style.width = Math.round(lw * .12) + "px";
    mapH = Math.round(lw * .30);
    $("#fields").style.height = mapH + "px";
  }
  async function open(i) {
    const g = index[i].game;
    T = cache[g] = cache[g] || await load(`assets/policy/${g}.json`);
    setVideo(video, T.video); video.currentTime = 0; loop.resume(); lastIdx = -1;
    $("#code-file").textContent = T.file;
    // inline values sit on the last executed assignment of each local
    assign = {};
    const names = new Set(T.calls.flatMap(c => Object.keys(c.v)));
    if (T.calls[0].s) ["turn", "accelerating"].forEach(n => names.add(n));
    T.source.forEach((src, k) => {
      const m = src.match(/^\s*((?:self\.)?[A-Za-z_]\w*(?:\s*,\s*[A-Za-z_]\w*)*)\s*=(?!=)/);
      if (!m) return;
      m[1].split(",").map(x => x.trim().replace(/^self\./, "")).forEach(n => { if (names.has(n)) (assign[n] = assign[n] || []).push(k + 1); });
    });
    const n = T.calls.length;
    code.innerHTML = T.source.map((src, k) => `<div class="ln" data-n="${k + 1}"><span class="no">${k + 1}</span><span class="cov"><i style="width:${((T.coverage[k + 1] || 0) / n * 100).toFixed(1)}%"></i></span><span class="src">${highlightPy(src) || " "}</span><span class="val"></span></div>`).join("");
    rows = {}; code.querySelectorAll(".ln").forEach(el => rows[+el.dataset.n] = el);
    T.flicker = flicker(T);
    layout(); render(0); toHotspot();
  }
  // How often each line changes state from one call to the next (run / not run / last line).
  function flicker(T) {
    const n = {};
    let prev = new Set(), prevLast = null;
    T.calls.forEach(c => {
      const hit = new Set(c.lines);
      hit.forEach(l => { if (!prev.has(l)) n[l] = (n[l] || 0) + 1; });
      prev.forEach(l => { if (!hit.has(l)) n[l] = (n[l] || 0) + 1; });
      if (c.last !== prevLast) [c.last, prevLast].forEach(l => { if (l) n[l] = (n[l] || 0) + 1; });
      prev = hit; prevLast = c.last;
    });
    return n;
  }
  // Show the window of lines that flickers most; the reader scrolls freely from there.
  function toHotspot() {
    const lines = Object.keys(rows).map(Number).sort((a, b) => a - b), h = scroller.clientHeight;
    if (!lines.length || !h) return;
    let best = 0, bestTop = 0, sum = 0, j = 0;
    lines.forEach((l, i) => {
      sum += T.flicker[l] || 0;
      while (rows[l].offsetTop + rows[l].offsetHeight - rows[lines[j]].offsetTop > h) sum -= T.flicker[lines[j++]] || 0;
      if (sum > best) { best = sum; bestTop = rows[lines[j]].offsetTop; }
    });
    scroller.scrollTop = bestTop - 6;
  }
  const callAt = t => { let lo = 0, hi = T.calls.length - 1, a = 0; while (lo <= hi) { const m = (lo + hi) >> 1; if (T.calls[m].t <= t) { a = m; lo = m + 1; } else hi = m - 1; } return a; };
  const blank = n => !(T.source[n - 1] || "").trim() || (T.source[n - 1] || "").trim().startsWith("#");
  function render(tv) {
    if (!T) return;
    const t = Math.max(0, tv - T.offset), i = callAt(t), c = T.calls[i];
    $("#pv-time").textContent = `${t.toFixed(1)} / ${T.duration.toFixed(1)}`;
    $("#code-step").textContent = `step ${i + 1} / ${T.calls.length}`;
    drawScrub($("#pv-scrub-c"), T.progress, t, T.duration);
    kb.set(new Set(T.keys.filter(([, a, b]) => a <= t && t < (b ?? T.duration)).map(([k]) => keyName(k))));
    ms.set(new Set(T.buttons.filter(([, a, b]) => a <= t && t < (b ?? T.duration) + .08).map(([b]) => b)));
    pointer(T.pointer, T.buttons, t);
    probe(c);
    if (i === lastIdx) return; lastIdx = i;
    const hit = new Set(c.lines);
    Object.entries(rows).forEach(([n, el]) => {
      n = +n; const on = hit.has(n);
      el.classList.toggle("hit", on); el.classList.toggle("last", n === c.last);
      el.classList.toggle("off", !on && !blank(n)); el.querySelector(".val").textContent = "";
    });
    const values = { ...c.v, ...(c.s || {}) };
    Object.entries(assign).forEach(([name, lines]) => {
      const done = lines.filter(n => hit.has(n)).pop();
      if (done && name in values) rows[done].querySelector(".val").textContent = showValue(values[name]);
    });
  }
  // What the policy read this step: a small map on the left, the fields that decide on the right.
  function probe(c) {
    const { ctx, w, h } = fit($("#pmap"), mapH);
    ctx.fillStyle = PANEL; ctx.fillRect(0, 0, w, h);
    if (c.view) (MAPS[T.game] || (() => {}))(ctx, w, h, c.view, T);
    const html = (c.fields || []).map(([k, v]) => `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join("");
    if (html !== $("#fields").dataset.html) { $("#fields").innerHTML = html; $("#fields").dataset.html = html; }
  }
  const loop = videoLoop(video, render, $("#pv-play"), active);
  scrubber($("#pv-scrub"), f => { if (!T) return; video.currentTime = f * T.duration; render(video.currentTime); });
  addEventListener("resize", () => { if (!T) return; layout(); render(video.currentTime); toHotspot(); });
  return { open, sync: loop.sync };
}

/* ============ the VLM Player ============ */
// The model plays from screenshots and the game waits while it thinks. The video is game
// time with those pauses cut out, so playback puts a short pause back at every step: the
// frame freezes, the screenshot joins the model's context, its reasoning comes in, the keys go.
function initVLM(index, active) {
  const video = $("#vm-video"), screen = $("#vm-screen"), kb = buildKeyboard($("#vm-kb")), ms = buildMouse($("#vm-ms"));
  const pointer = pointerLayer($("#vm-cursor"), $("#vm-ripple")), scroller = $("#vm-scroll"), list = $("#vm-steps");
  const cache = {}, playBtn = $("#vm-play");
  let V = null, rows = [], shown = -2, lastT = 0, want = true, visible = false, beat = null, userUntil = 0, mapH = 160;
  ["wheel", "pointerdown", "touchstart"].forEach(ev => scroller.addEventListener(ev, () => userUntil = performance.now() + 4000, { passive: true }));
  const thumb = (k, w) => {
    const sp = V.sprite, h = w * 9 / 16;
    return `background-image:url(${sp.file});background-size:${sp.cols * w}px auto;background-position:${-(k % sp.cols) * w}px ${-Math.floor(k / sp.cols) * h}px`;
  };
  function layout() {
    const lw = fitBench($("#vm-bench"), $("#vm-left"), { perWidth: .5625 + .30 + .87 * kb.aspect, fixed: 36 + 10 + 10 + 12 });
    $("#vm-ms-box").style.width = Math.round(lw * .12) + "px";
    mapH = Math.round(lw * .30);
    $("#vm-fields").style.height = mapH + "px";
    $("#vm-ctx").style.height = mapH + "px";
    shown = -2;
  }
  async function open(i) {
    const g = index[i].game;
    V = cache[g] = cache[g] || await load(`assets/vlm/${g}.json`);
    endBeat(); setVideo(video, V.video); video.currentTime = 0; lastT = 0; shown = -2;
    $("#vm-model").textContent = `${V.model} · task ${V.task}`;
    $("#vm-thinking").textContent = `${V.model} is thinking`;
    list.innerHTML = V.steps.map((s, k) => `<div class="turn" data-k="${k}"><span class="no">${k + 1}</span><div class="th" style="${thumb(k, 72)}"></div>
      <div><p>${esc(s.text || "(no reasoning given)")}</p><div class="meta"><span class="act">${s.act.map(esc).join("; ")}</span><span>${fmt(s.tout || 0)} tokens</span></div></div></div>`).join("");
    rows = [...list.children];
    layout(); render(0); sync();
  }
  const stepAt = t => { let lo = 0, hi = V.steps.length - 1, a = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (V.steps[m].t <= t) { a = m; lo = m + 1; } else hi = m - 1; } return a; };
  function render(tv) {
    if (!V) return;
    const t = Math.max(0, tv - V.offset), k = stepAt(t), n = V.steps.length;
    $("#vm-time").textContent = `${t.toFixed(1)} / ${V.duration.toFixed(1)}`;
    $("#vm-step").textContent = `step ${Math.max(k + 1, 0)} / ${n}`;
    drawScrub($("#vm-scrub-c"), V.progress, t, V.duration);
    kb.set(new Set(V.keys.filter(([, a, b]) => a <= t && t < (b ?? V.duration)).map(([key]) => keyName(key))));
    ms.set(new Set(V.buttons.filter(([, a, b]) => a <= t && t < (b ?? V.duration) + .08).map(([b]) => b)));
    pointer(V.pointer, V.buttons, t);
    // playing forward into a new step: the game would have stopped here while the model thought
    if (want && !beat && !video.paused && k >= 0 && V.steps[k].t > lastT && V.steps[k].t <= t) startBeat(k);
    lastT = t;
    if (k !== shown) showStep(k);
  }
  function showStep(k) {
    shown = k;
    rows.forEach((el, j) => { el.classList.toggle("cur", j === k); el.classList.toggle("future", j > k); });
    const s = V.steps[Math.max(k, 0)];
    const ctx = [];
    for (let j = Math.max(0, k - 5); j <= k; j++) ctx.push(j);
    const cw = $("#vm-ctx").clientWidth / 3 - 3;
    $("#vm-ctx").innerHTML = Array.from({ length: 6 }, (_, slot) => {
      const j = ctx[slot]; if (j === undefined) return "<div></div>";
      return `<div class="${j === k ? "now" : ""}" style="${thumb(j, cw)}"><span>${j === k ? "now" : `step ${j + 1}`}</span></div>`;
    }).join("");
    const p = valueAt(V.progress, s ? s.t : 0);
    $("#vm-fields").innerHTML = [
      ["model", V.model],
      ["screenshot at", k >= 0 ? `${s.obs.toFixed(1)} s` : "-"],
      ["action", k >= 0 ? s.act.join("; ") : "-"],
      ["reply", k >= 0 ? `${fmt(s.tout || 0)} tokens` : "-"],
      ["prompt", k >= 0 ? `${fmt(s.tin || 0)} tokens` : "-"],
      ["game paused", `${V.paused.count} times, ${Math.round(V.paused.seconds)} s`],
      ["progress", Math.round(p * 100) + "%"],
    ].map(([a, b]) => `<div><span>${esc(a)}</span><b>${esc(b)}</b></div>`).join("");
    const el = rows[k];
    if (el && performance.now() > userUntil) {
      const top = el.offsetTop, h = scroller.clientHeight, st = scroller.scrollTop;
      if (top < st + h * .15 || top + el.offsetHeight > st + h * .85) scroller.scrollTo({ top: top - h * .35, behavior: reduce ? "auto" : "smooth" });
    }
  }
  function startBeat(k) {
    const s = V.steps[k], ms = clamp(750 + (s.tout || 0) * 3.75, 1050, 2400);
    beat = { k }; video.pause(); screen.classList.add("frozen");
    $("#vm-shutter").animate([{ opacity: .55 }, { opacity: 0 }], { duration: 260 });
    const p = rows[k] && rows[k].querySelector("p"), text = s.text || "";
    if (p && !reduce) {   // the reasoning comes in while the game waits
      const t0 = performance.now();
      const type = () => { if (!beat) { p.textContent = text; return; } const f = clamp((performance.now() - t0) / (ms * .8), 0, 1); p.textContent = text.slice(0, Math.ceil(text.length * f)); if (f < 1) requestAnimationFrame(type); };
      type();
    }
    beat.timer = setTimeout(() => { endBeat(); sync(); }, ms);
  }
  function endBeat() {
    if (!beat) return;
    clearTimeout(beat.timer);
    const p = rows[beat.k] && rows[beat.k].querySelector("p");
    if (p) p.textContent = V.steps[beat.k].text || "(no reasoning given)";
    beat = null; screen.classList.remove("frozen");
  }
  const loop = () => { render(video.currentTime); if (!video.paused) schedule(); };
  const schedule = () => video.requestVideoFrameCallback ? video.requestVideoFrameCallback(loop) : requestAnimationFrame(loop);
  video.addEventListener("play", () => { schedule(); });
  video.addEventListener("seeked", () => render(video.currentTime));
  video.addEventListener("loadeddata", () => render(video.currentTime));
  video.addEventListener("ended", () => { endBeat(); video.currentTime = 0; lastT = 0; sync(); });
  const sync = () => {
    playBtn.textContent = want ? "❚❚" : "▶";
    if (!V) return;
    if (visible && active() && want) { video.preload = "auto"; if (!beat) video.play().catch(() => {}); }
    else { endBeat(); video.pause(); }
  };
  playBtn.onclick = () => { want = !want; sync(); };
  scrubber($("#vm-scrub"), f => { if (!V) return; endBeat(); video.currentTime = f * V.duration + V.offset; lastT = f * V.duration; render(video.currentTime); sync(); });
  new IntersectionObserver(es => es.forEach(e => { visible = e.isIntersecting; sync(); }), { threshold: .3 }).observe(video);
  addEventListener("resize", () => { layout(); if (V) render(video.currentTime); });
  return { open, sync };
}

/* ============ the two players on one page ============ */
// One row of game tabs drives both players. Scrolling through the chapter's hold slides the
// page from the Coding Player to the VLM Player and back; the slide follows the scroll itself,
// and stopping half way finishes it towards the nearer player. The names in the header scroll
// the page to their player.
function initPlayers(index) {
  let face = 0, f = 0, selectedFace = 0;
  const coding = initCoding(index, () => face === 0), vlm = initVLM(index, () => face === 1);
  const pin = $("#pv-pin"), track = $("#track"), faces = [$("#face-code"), $("#face-vlm")];
  const names = [...document.querySelectorAll("#who button")], bar = $("#who-bar");
  const A = .4, B = .6;   // the slide takes this part of the hold
  $("#pv-tabs").innerHTML = index.map((g, i) => `<button data-i="${i}">${esc(g.title)}</button>`).join("");
  function open(i) {
    document.querySelectorAll("#pv-tabs button").forEach(b => b.classList.toggle("on", +b.dataset.i === i));
    coding.open(i); vlm.open(i);
  }
  $("#pv-tabs").addEventListener("click", e => { const b = e.target.closest("button"); if (b) open(+b.dataset.i); });
  function slide() {
    const x = compactLayout.matches ? selectedFace : clamp((progressIn(pin) - A) / (B - A), 0, 1);
    f = x * x * (3 - 2 * x);
    track.style.transform = `translateX(${(-f * 100).toFixed(3)}%)`;
    faces[0].style.opacity = 1 - .75 * f; faces[1].style.opacity = .25 + .75 * f;
    const [a, b] = names.map(n => [n.offsetLeft, n.offsetWidth]);
    bar.style.left = a[0] + (b[0] - a[0]) * f + "px"; bar.style.width = a[1] + (b[1] - a[1]) * f + "px";
    const now = f < .5 ? 0 : 1;
    names.forEach((n, i) => n.setAttribute("aria-pressed", String(i === now)));
    faces.forEach((el, i) => { el.inert = i !== now; });
    if (now !== face) { face = now; names.forEach((n, i) => n.classList.toggle("on", i === face)); coding.sync(); vlm.sync(); }
  }
  const at = q => topOf(pin) + q * (pin.offsetHeight - pin.firstElementChild.offsetHeight);
  let idle = 0;
  addEventListener("scroll", () => {
    slide(); clearTimeout(idle);
    if (!compactLayout.matches) idle = setTimeout(() => { if (f > 0 && f < 1) scrollTo({ top: at(f < .5 ? A - .03 : B + .03), behavior: "smooth" }); }, 180);
  }, { passive: true });
  function selectPlayer(i, fromIntro = false) {
    if (compactLayout.matches) {
      selectedFace = i; slide();
      if (fromIntro) scrollTo({ top: topOf(pin), behavior: "smooth" });
    } else scrollTo({ top: at(i ? .8 : .2), behavior: "smooth" });
  }
  $("#who").addEventListener("click", e => { const b = e.target.closest("button"); if (b) selectPlayer(+b.dataset.face); });
  document.querySelectorAll("#players .sname").forEach(m => m.addEventListener("click", () => selectPlayer(m.dataset.k === "vlm" ? 1 : 0, true)));
  addEventListener("resize", slide);
  slide();
  near($("#players"), () => open(0));   // the first traces are ~1 MB each: fetch them on approach
}

/* ============ the training data ============ */
// Six panels in one pinned screen: what the trajectories come from (genre, engine, player) and
// what they look like (task difficulty, length, the progress they end with).
const CODING = role("--player"), VLM = "#e39b2d";
const PROGRESS = ["#dcefea", "#a3d8cb", "#55b7a4", role("--game")];
function initDataset(D) {
  const P = D.players, names = Object.keys(P), tone = { "Coding Player": CODING, "VLM Player": VLM };
  const pct = (n, total) => (n / total * 100 < 1 ? (n / total * 100).toFixed(1) : Math.round(n / total * 100)) + "%";
  const legend = (items, y = 12) => { let x = 0, out = ""; items.forEach(([name, color]) => { out += `<rect x="${x}" y="${y - 9}" width="10" height="10" rx="2" fill="${color}"/>` + svgText(x + 15, y, name, "tick"); x += 30 + name.length * 7.2; }); return out; };
  function donut(w, h, items, colors) {
    const total = items.reduce((t, [, n]) => t + n, 0), r = Math.min(h / 2 - 4, w * .23), ri = r * .62, cx = r + 4, cy = h / 2;
    let a0 = -Math.PI / 2, out = "";
    items.forEach(([name, n]) => {
      const a1 = a0 + n / total * Math.PI * 2, big = a1 - a0 > Math.PI ? 1 : 0, p = (a, rr) => `${cx + rr * Math.cos(a)},${cy + rr * Math.sin(a)}`;
      out += `<path d="M${p(a0, r)} A${r},${r} 0 ${big} 1 ${p(a1, r)} L${p(a1, ri)} A${ri},${ri} 0 ${big} 0 ${p(a0, ri)} Z" fill="${colors[name] || INK3}" stroke="#fff" stroke-width="1.5"/>`;
      a0 = a1;
    });
    out += svgText(cx, cy + 2, fmt(total), "dtotal", "middle") + svgText(cx, cy + 20, "trajectories", "tick", "middle");
    const x0 = 2 * r + 26, row = Math.min(19, (h - 4) / items.length), y0 = (h - row * items.length) / 2 + row * .7;
    items.forEach(([name, n], i) => {
      const y = y0 + i * row;
      out += `<rect x="${x0}" y="${y - 9}" width="10" height="10" rx="2" fill="${colors[name] || INK3}"/>` + svgText(x0 + 16, y, name, "tick")
        + svgText(w, y, pct(n, total), "tick num", "end");
    });
    return out;
  }
  function players(w, h) {
    const rows = [["Trajectories", "trajectories"], ["Steps", "steps"]], L = 92, bw = w - L, bh = 26;
    const top = 24 + Math.max(0, (h - 24 - 214) / 2);   // the bars sit in the middle of the space under the legend
    let out = legend(names.map(n => [n, tone[n]]));
    rows.forEach(([label, k], i) => {
      const y = top + i * 66, total = names.reduce((t, n) => t + P[n][k], 0);
      out += svgText(0, y + bh / 2 + 4, label, "tick");
      let x = L;
      names.forEach(n => {
        const len = P[n][k] / total * bw;
        out += `<rect x="${x}" y="${y}" width="${Math.max(1, len - 1)}" height="${bh}" rx="3" fill="${tone[n]}"/>`;
        if (len > 64) out += svgText(x + 8, y + bh / 2 + 4, fmt(P[n][k]), "inbar");
        else out += svgText(w, y + bh + 16, fmt(P[n][k]), "tick num", "end");
        x += len;
      });
    });
    // success and the progress a trajectory ends with, the two players side by side on each row
    const half = (bw - 12) / 2, track = half - 44;
    [["Success", "completed"], ["Progress", "progress_sum"]].forEach(([label, k], i) => {
      const y = top + 2 * 66 + 6 + i * 22;
      out += svgText(0, y + 12, label, "tick");
      names.forEach((n, j) => {
        const x = L + j * (half + 12);
        out += `<rect x="${x}" y="${y + 2}" width="${track}" height="12" rx="3" fill="#eef1f4"/><rect x="${x}" y="${y + 2}" width="${track * P[n][k] / P[n].trajectories}" height="12" rx="3" fill="${tone[n]}"/>`
          + svgText(x + half, y + 12, pct(P[n][k], P[n].trajectories), "tick num", "end");
      });
    });
    return out;
  }
  function difficulty(w, h) {
    const items = D.difficulty, colors = ["#3fae8a", "#e2b13c", "#e8803f", "#c9473b"], top = Math.max(...items.map(d => d[1]));
    const total = items.reduce((t, [, n]) => t + n, 0), T = 22, B = 26, ph = h - T - B, base = T + ph, slot = w / items.length, bw = Math.min(64, slot * .6);
    let out = "";
    items.forEach(([name, n], i) => {
      const mid = (i + .5) * slot, y = base - n / top * ph;
      out += `<rect x="${mid - bw / 2}" y="${y}" width="${bw}" height="${base - y}" rx="3" fill="${colors[i]}"/>` + svgText(mid, y - 7, pct(n, total), "dval", "middle")
        + svgText(mid, base + 18, name[0].toUpperCase() + name.slice(1), "tick", "middle");
    });
    return out + `<line x1="0" x2="${w}" y1="${base}" y2="${base}" class="grid"/>`;
  }
  function length(w, h) {
    const E = D.length_edges, T = 28, B = 24, L = 4, ph = h - T - B, base = T + ph;
    const lx = v => L + Math.log10(v) / Math.log10(E[E.length - 1] * 1.6) * (w - L - 4);
    const shares = names.map(n => P[n].length.map(c => c / P[n].trajectories)), top = Math.max(...shares.flat());
    let out = legend(names.map(n => [n, tone[n]]));
    [1, 10, 100, 1000].forEach(v => out += `<line x1="${lx(v)}" x2="${lx(v)}" y1="${T}" y2="${base}" class="grid"/>` + svgText(lx(v), base + 17, fmt(v), "tick", "middle"));
    out += svgText(w, base + 17, "steps", "tick", "end");
    names.forEach((n, j) => {
      const pts = E.map((e, i) => [lx(i < E.length - 1 ? Math.sqrt(e * E[i + 1]) : e * 1.25), base - shares[j][i] / top * (ph - 6)]);
      // a smooth line through the bin centres that never overshoots them (monotone cubic)
      const k = pts.length, dx = [], m = [], t = [];
      for (let i = 0; i < k - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0]; m[i] = (pts[i + 1][1] - pts[i][1]) / dx[i]; }
      for (let i = 0; i < k; i++) t[i] = i === 0 ? m[0] : i === k - 1 ? m[k - 2] : m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
      for (let i = 0; i < k - 1; i++) {
        if (m[i] === 0) { t[i] = t[i + 1] = 0; continue; }
        const a = t[i] / m[i], b = t[i + 1] / m[i], q = a * a + b * b;
        if (q > 9) { t[i] = 3 * a / Math.sqrt(q) * m[i]; t[i + 1] = 3 * b / Math.sqrt(q) * m[i]; }
      }
      let d = `M${pts[0][0]},${pts[0][1]}`;
      for (let i = 0; i < k - 1; i++) d += ` C${pts[i][0] + dx[i] / 3},${pts[i][1] + t[i] * dx[i] / 3} ${pts[i + 1][0] - dx[i] / 3},${pts[i + 1][1] - t[i + 1] * dx[i] / 3} ${pts[i + 1][0]},${pts[i + 1][1]}`;
      out += `<path d="${d} L${pts[pts.length - 1][0]},${base} L${pts[0][0]},${base} Z" fill="${tone[n]}" opacity=".16"/><path d="${d}" fill="none" stroke="${tone[n]}" stroke-width="2.4"/>`;
    });
    return out + `<line x1="0" x2="${w}" y1="${base}" y2="${base}" class="grid"/>`;
  }
  function progress(w, h) {
    const buckets = [["Under 10%", [0]], ["10–49%", [1, 2, 3, 4]], ["50–99%", [5, 6, 7, 8, 9]], ["Complete", [10]]];
    const L = 104, bw = w - L, bh = 30;
    const top = 24 + Math.max(0, (h - 24 - 124) / 2);
    let out = legend(buckets.map(([b], i) => [b, PROGRESS[i]]));
    names.forEach((n, j) => {
      const y = top + j * 64, counts = buckets.map(([, bins]) => bins.reduce((t, b) => t + P[n].progress[b], 0)), total = P[n].trajectories;
      out += svgText(0, y + bh / 2 + 4, n, "tick");
      let x = L;
      counts.forEach((c, i) => {
        const len = c / total * bw;
        out += `<rect x="${x}" y="${y}" width="${Math.max(0, len - 1)}" height="${bh}" rx="2" fill="${PROGRESS[i]}"/>`;
        if (len > 38) out += svgText(x + len / 2, y + bh / 2 + 4, pct(c, total), i > 1 ? "inbar" : "dval", "middle");
        x += len;
      });
    });
    return out;
  }
  const draw = {
    genre: (w, h) => donut(w, h, D.genre, GENRE), engine: (w, h) => donut(w, h, D.engine, ENGINE),
    players, difficulty, length, progress,
  };
  const render = () => document.querySelectorAll("#dash .dbody").forEach(el => {
    const w = el.clientWidth, h = el.clientHeight;
    el.innerHTML = `<svg class="chart" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${draw[el.dataset.k](w, h)}</svg>`;
  });
  render(); addEventListener("resize", render); document.fonts && document.fonts.ready.then(render);
}

/* ============ leaderboard ============ */
// Model families share a locally served logo across versions and evaluation settings.
function modelIcon(name) {
  const families = [
    [/^Game2Player/i, "game2player"], [/^(GPT|OpenAI)/i, "openai"],
    [/^Claude/i, "claude"], [/^Qwen/i, "qwen"], [/^DeepSeek/i, "deepseek"],
    [/^GLM/i, "glm"], [/^Gemini/i, "gemini"], [/^(Seed|UI-TARS)/i, "bytedance"],
    [/^Kimi/i, "kimi"], [/^Grok/i, "grok"],
  ];
  const family = families.find(([pattern]) => pattern.test(name));
  return family ? `<img class="model-icon" src="assets/logos/models/${family[1]}.svg${family[1] === "game2player" ? "?v=2" : ""}" width="22" height="22" alt="" aria-hidden="true">` : "";
}
// One ranked table per benchmark, sorted by the column whose header was clicked; equal scores
// share a rank. The longer table scrolls inside a frame as tall as the shorter one.
// A GameWorld entry names the harness it was played through, in that harness's color.
// Keep full harness names; show mobile interface details only when every note fits.
const HARNESS = { gameworld: "GameWorld harness", vista: "VISTA harness", ours: "our harness" };
const boardNote = r => r.harness
  ? `<span class="harness h-${r.harness}">${HARNESS[r.harness]}</span>`
    + (r.note ? `<span class="${r.harness === "gameworld" ? "harness-interface" : ""}"> · ${esc(r.note)}</span>` : "")
  : esc(r.note);
function initBoard(boards) {
  const cards = [...document.querySelectorAll(".lb[data-suite]")];
  cards.forEach(card => {
    // PlayerBench shows two decimals; GameWorld's published numbers have one
    const rows = boards[card.dataset.suite], digits = card.dataset.suite === "GameWorld" ? 1 : 2;
    let key = "progress";
    const metric = $(".board-metric", card);
    metric.addEventListener("change", () => { key = metric.value; render(); });
    const fitInterfaceLabels = () => {
      card.classList.remove("hide-interfaces");
      if (!matchMedia("(max-width: 600px)").matches) return;
      const notes = [...card.querySelectorAll(".effort")];
      // Measure the complete notes on one line before choosing one policy for the table.
      const wraps = notes.some(note => {
        const previous = note.style.whiteSpace;
        note.style.whiteSpace = "nowrap";
        const overflows = note.scrollWidth > note.clientWidth + 1;
        note.style.whiteSpace = previous;
        return overflows;
      });
      card.classList.toggle("hide-interfaces", wraps);
    };
    let measuredWidth;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width === measuredWidth) return;
      measuredWidth = entry.contentRect.width;
      fitInterfaceLabels();
    });
    observer.observe(card);
    addEventListener("resize", fitInterfaceLabels);
    document.fonts.ready.then(fitInterfaceLabels);
    function render() {
      card.dataset.metric = key; metric.value = key;
      const sorted = [...rows].sort((a, b) => b[key] - a[key] || b.progress - a.progress);
      let rank = 0;
      sorted.forEach((r, i) => { if (!i || r[key] !== sorted[i - 1][key]) rank = i + 1; r.rank = rank; });
      const top = Math.max(...rows.map(r => r[key]));
      const cell = (r, k) => k === key
        ? `<td class="n on"><div><span class="bar"><i style="width:${(r[k] / top * 100).toFixed(1)}%"></i></span><b>${r[k].toFixed(digits)}</b></div></td>`
        : `<td class="n">${r[k].toFixed(digits)}</td>`;
      $("tbody", card).innerHTML = sorted.map(r => `<tr class="row-${r.kind}"><td class="rk">${r.rank <= 3 ? `<span class="medal m${r.rank}">${r.rank}</span>` : r.rank}</td>
        <td><div class="model-label">${modelIcon(r.name)}<div class="model-copy"><b>${esc(r.name)}</b><span class="effort">${boardNote(r)}</span></div></div></td>${cell(r, "progress")}${cell(r, "success")}</tr>`).join("");
      card.querySelectorAll("th.sort").forEach(th => th.classList.toggle("on", th.dataset.k === key));
      fitInterfaceLabels();
    }
    card.querySelectorAll("th.sort").forEach(th => th.addEventListener("click", () => { key = th.dataset.k; render(); }));
    render();
  });
  const level = () => {
    const stage = $(".boards").closest(".pin-stage");
    cards.forEach(c => { const el = $(".lb-scroll", c); el.style.maxHeight = compactLayout.matches ? "none" : Math.max(240, stage.clientHeight - offsetIn(el, stage) - 34) + "px"; });
  };
  level(); addEventListener("resize", level);
}

/* ============ results ============ */
const svgText = (x, y, text, cls, anchor = "start") => `<text x="${x}" y="${y}" class="${cls}" text-anchor="${anchor}">${esc(text)}</text>`;
const benchmarkTitle = (x, y, suite) => suite === "PlayerBench"
  ? `<text x="${x}" y="${y}" class="title playerbench"><tspan class="pb-player">Player</tspan><tspan>Bench</tspan></text>`
  : `<a class="benchmark-link" href="https://gameworld-project.github.io/" target="_blank" rel="noopener noreferrer">${svgText(x, y, suite, "title")}</a>`;
const niceTop = v => Math.ceil(v * 1.12 / 10) * 10;
function initResults(R) {
  const SUITES = [["PlayerBench", "#main-pb"], ["GameWorld", "#main-gw"]];
  let metric = "progress";
  // Base and trained side by side for each model; both panels share one scale.
  function bars(h) {
    const top = niceTop(Math.max(...R.main.flatMap(g => SUITES.map(([s]) => g.ours[s][metric]))));
    SUITES.forEach(([suite, sel]) => {
      const svg = $(sel), w = svg.clientWidth, L = 34, T = 46, B = 30, ph = h - T - B, base = T + ph;
      const y = v => base - v / top * ph, slot = (w - L) / R.main.length, bw = Math.min(46, slot * .3);
      let out = benchmarkTitle(0, 18, suite);
      for (let v = 0; v <= top; v += 10) out += `<line x1="${L}" x2="${w}" y1="${y(v)}" y2="${y(v)}" class="grid"/>` + svgText(L - 8, y(v) + 4, v, "tick", "end");
      R.main.forEach((g, i) => {
        const mid = L + (i + .5) * slot;
        [["base", -1], ["ours", 1]].forEach(([k, side]) => {
          const v = g[k][suite][metric], x = mid + side * (bw / 2 + 3) - bw / 2;
          out += `<rect x="${x}" y="${y(v)}" width="${bw}" height="${base - y(v)}" rx="2" class="b-${k}"/>` + svgText(x + bw / 2, y(v) - 7, v.toFixed(1), "v-" + k, "middle");
        });
        out += svgText(mid, base + 21, g.thinking === "on" ? `${g.size}, thinking on` : g.size, "cat", "middle");
      });
      svg.setAttribute("height", h); svg.innerHTML = out;
    });
  }
  // PlayerBench progress against training steps, 4B dashed and 9B solid. A value goes above the upper
  // line and below the lower one, or to a corner of its point where a line, a point or a value is in the way.
  function steps() {
    // as tall as the table beside it, so the two end on one line; the bar charts above take the same height
    const svg = $("#steps"), table = $("#ablation table");
    const h = clamp(table.getBoundingClientRect().bottom - svg.getBoundingClientRect().top, 260, 360);
    const w = svg.clientWidth, L = 34, R_ = 28, T = 46, B = 26, ph = h - T - B, base = T + ph;
    const sizes = Object.entries(R.steps), all = sizes.flatMap(([, pts]) => pts);
    const last = Math.max(...all.map(p => p.step)), top = niceTop(Math.max(...all.map(p => p.PlayerBench.progress)));
    const x = s => L + 12 + s / last * (w - L - R_ - 12), y = v => base - v / top * ph;
    let out = benchmarkTitle(0, 18, "PlayerBench");
    const taken = [];
    for (let v = 0; v <= top; v += 10) {
      out += `<line x1="${L}" x2="${w - R_ + 12}" y1="${y(v)}" y2="${y(v)}" class="grid"/>` + svgText(L - 8, y(v) + 4, v, "tick", "end");
      taken.push([L - 30, y(v) - 9, L - 8, y(v) + 4]);
    }
    sizes[0][1].forEach(p => out += svgText(x(p.step), base + 20, p.step ? fmt(p.step) : "0", "tick", "middle"));
    const lines = sizes.map(([size, pts]) => [size, pts.map(p => [x(p.step), y(p.PlayerBench.progress), p.PlayerBench.progress])]);
    const segs = lines.flatMap(([, xy]) => xy.slice(1).map((q, i) => [xy[i], q]));
    lines.forEach(([size, xy]) => {
      out += `<polyline points="${xy.map(([a, b]) => `${a},${b}`).join(" ")}" class="line s-pb${size === "4B" ? " dash" : ""}"/>`;
      xy.forEach(([a, b]) => { out += `<circle cx="${a}" cy="${b}" r="3.5" class="dot s-pb"/>`; taken.push([a - 5, b - 5, a + 5, b + 5]); });
    });
    const free = ([x1, y1, x2, y2]) => !taken.some(([p1, q1, p2, q2]) => x1 < p2 && p1 < x2 && y1 < q2 && q1 < y2) &&
      !segs.some(([[a, b], [c, d]]) => { for (let t = 0; t <= 1; t += .02) { const sx = a + (c - a) * t, sy = b + (d - b) * t; if (sx > x1 && sx < x2 && sy > y1 && sy < y2) return true; } return false; });
    lines.forEach(([, xy]) => xy.forEach(([a, b, v], j) => {
      // [text x, baseline, anchor, box]
      const at = { above: [a, b - 9, "middle", [a - 14, b - 19, a + 14, b - 8]], below: [a, b + 20, "middle", [a - 14, b + 10, a + 14, b + 21]],
        aboveLeft: [a - 6, b - 4, "end", [a - 34, b - 14, a - 6, b - 3]], aboveRight: [a + 6, b - 4, "start", [a + 6, b - 14, a + 34, b - 3]],
        belowLeft: [a - 6, b + 13, "end", [a - 34, b + 3, a - 6, b + 14]], belowRight: [a + 6, b + 13, "start", [a + 6, b + 3, a + 34, b + 14]] };
      const order = lines.every(([, o]) => o[j][1] >= b) ? ["above", "aboveLeft", "aboveRight", "belowLeft", "belowRight", "below"]
        : ["below", "belowRight", "belowLeft", "aboveRight", "aboveLeft", "above"];
      const [tx, ty, anchor, box] = at[order.find(k => free(at[k][3])) || order[0]];
      taken.push(box); out += svgText(tx, ty, v.toFixed(1), "v s-pb", anchor);
    }));
    svg.setAttribute("height", h); svg.innerHTML = out;
    return h;
  }
  // The training data ablation: best value of each model size in bold.
  function ablation() {
    const cols = [["PlayerBench", "progress"], ["PlayerBench", "success"], ["GameWorld", "progress"], ["GameWorld", "success"]];
    const sizes = [...new Set(R.ablation.map(r => r.size))];
    let html = `<table class="tbl abl"><tr><th rowspan="2">Training data</th><th colspan="2" class="c"><span class="playerbench"><span class="pb-player">Player</span>Bench</span></th><th colspan="2" class="c"><a class="benchmark-link" href="https://gameworld-project.github.io/" target="_blank" rel="noopener noreferrer">GameWorld</a></th></tr>
      <tr>${cols.map(([, m]) => `<th class="r">${m === "progress" ? "Progress" : "Success"}</th>`).join("")}</tr>`;
    sizes.forEach(size => {
      const rows = R.ablation.filter(r => r.size === size);
      const best = cols.map(([s, m]) => Math.max(...rows.map(r => r[s][m])));
      html += `<tr class="grp"><td colspan="5">Game2Player-${size}</td></tr>` + rows.map(r => `<tr><td>${esc(r.data)}</td>${cols.map(([s, m], j) =>
        `<td class="r">${r[s][m] === best[j] ? `<b>${r[s][m].toFixed(1)}</b>` : r[s][m].toFixed(1)}</td>`).join("")}</tr>`).join("");
    });
    $("#ablation").innerHTML = html + "</table>";
  }
  $("#main-metric").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    metric = b.dataset.k; document.querySelectorAll("#main-metric button").forEach(x => x.classList.toggle("on", x === b)); bars(+$("#steps").getAttribute("height"));
  });
  const draw = () => {
    document.querySelectorAll("#ablation .grp td").forEach(td => td.colSpan = compactLayout.matches ? 3 : 5);
    bars(steps());
  };
  $("#ablation-suite").addEventListener("change", e => { $("#ablation").dataset.suite = e.target.value; draw(); });
  ablation(); draw();
  addEventListener("resize", draw); document.fonts && document.fonts.ready.then(draw);
  initCompare(R.compare);
}

/* ============ base and trained, side by side ============ */
// Both recordings hold game time only, so they share one clock: the longer one plays and the
// other follows it, holding its last frame once it is over. The chart draws both progress lines.
const CURSOR = `<svg class="cursor" viewBox="0 0 18 24"><path d="M1 1 L1 19 L5.5 14.5 L8.6 22 L11.6 20.7 L8.6 13.6 L14.5 13.6 Z" fill="#fff" stroke="#000" stroke-width="1.3" stroke-linejoin="round"/></svg>`;
function initCompare(list) {
  const root = $("#cmp"), plot = $("#cmp-plot");
  const sides = [["base", "Qwen3.5-4B"], ["ours", "Game2Player-4B"]].map(([k, name]) => {
    const el = root.querySelector(`.cmp-side[data-k="${k}"]`);
    el.innerHTML = `<div class="who"><b>${name}</b><span>thinking: on</span><span class="cur"></span></div>
      <div class="screen"><video muted playsinline preload="none"></video>${CURSOR}<div class="ripple"></div><span class="live">0%</span><span class="end"></span></div>
      <div class="deck"><div class="kb"><svg></svg></div><div class="ms"><svg viewBox="0 0 92 150"></svg></div></div>`;
    return { k, name, video: $("video", el), screen: $(".screen", el), live: $(".live", el), end: $(".end", el), step: $(".cur", el),
      kb: buildKeyboard($(".kb svg", el)), ms: buildMouse($(".ms svg", el)), pointer: pointerLayer($(".cursor", el), $(".ripple", el)) };
  });
  const COLOR = { base: "#8b939e", ours: PLAYER };
  let cur = null, lead = null, follow = null, visible = false, stopped = false, hold = 0;
  const total = () => lead.d.duration;
  // where a side's recording stops: the encoded video can end a few frames before the episode
  const endOf = s => Math.min(s.d.duration, s.video.duration || Infinity) - .08;
  const clock = () => clamp(lead.video.currentTime - lead.d.offset, 0, total());
  $("#cmp-tabs").innerHTML = list.map((c, i) => `<button data-i="${i}">${esc(c.title.replace(/[^\x20-\x7e]/g, "").trim())}</button>`).join("");
  $("#cmp-tabs").addEventListener("click", e => { const b = e.target.closest("button"); if (b) open(+b.dataset.i); });
  function open(i) {
    cur = list[i]; clearTimeout(hold);
    document.querySelectorAll("#cmp-tabs button").forEach(b => b.classList.toggle("on", +b.dataset.i === i));
    $("#cmp-task").textContent = cur.instruction;
    sides.forEach(s => { s.d = cur[s.k]; setVideo(s.video, s.d.video); });
    [lead, follow] = cur.ours.duration >= cur.base.duration ? [sides[1], sides[0]] : [sides[0], sides[1]];
    seek(0);
  }
  function seek(t) {
    clearTimeout(hold);
    sides.forEach(s => {
      const end = endOf(s);
      s.video.currentTime = Math.max(0, Math.min(t, end) + s.d.offset);
      if (s === follow && t >= end) s.video.pause();
    });
    run(); render(t);
  }
  function run() {
    if (visible && !stopped) lead.video.play().catch(() => {}); else sides.forEach(s => s.video.pause());
    $("#cmp-play").textContent = visible && !stopped ? "❚❚" : "▶";
  }
  sides.forEach(s => s.video.addEventListener("ended", () => { if (s === lead) hold = setTimeout(() => seek(0), 1800); }));
  function tick() {
    if (cur && lead) {
      const t = clock(), d = follow.d, end = endOf(follow);
      if (t < end && !lead.video.paused) {
        const want = Math.max(0, t + d.offset);
        if (Math.abs(follow.video.currentTime - want) > .3) follow.video.currentTime = want;
        if (follow.video.paused && !follow.video.ended) follow.video.play().catch(() => {});
      } else if (!follow.video.paused) follow.video.pause();
      render(t);
    }
    if (visible) requestAnimationFrame(tick);
  }
  function render(t) {
    sides.forEach(s => {
      const d = s.d, tt = Math.min(t, d.duration), over = t >= d.duration - .05;
      s.live.textContent = Math.round(valueAt(d.progress, tt) * 100) + "%";
      s.kb.set(new Set(over ? [] : d.keys.filter(([, a, b]) => a <= tt && tt < (b ?? d.duration)).map(([k]) => keyName(k))));
      s.ms.set(new Set(over ? [] : d.buttons.filter(([, a, b]) => a <= tt && tt < (b ?? d.duration) + .08).map(([b]) => b)));
      s.pointer(d.pointer, d.buttons, tt);
      s.screen.classList.toggle("held", over);
      // the step under way: the last one the model took at or before this moment
      let k = 0; while (k < d.decisions.length && d.decisions[k] <= tt) k++;
      s.step.textContent = `Step ${k}/100`;
      s.end.textContent = d.solved ? `Task complete at ${Math.round(d.duration)} s` : `All ${d.decisions.length} steps used · ${Math.round(d.final * 100)}%`;
    });
    $("#cmp-legend").innerHTML = sides.map(s => `<span><i style="background:${COLOR[s.k]}"></i>${s.name}<b>${Math.round(valueAt(s.d.progress, Math.min(t, s.d.duration)) * 100)}%</b></span>`).join("");
    $("#cmp-time").textContent = `${t.toFixed(1)} / ${total().toFixed(1)} s`;
    chart(t);
  }
  const PAD = { l: 44, r: 10, t: 10, b: 24 };
  function chart(t) {
    const { ctx, w, h } = fit($("#cmp-c"), plot.clientHeight), pw = w - PAD.l - PAD.r, ph = h - PAD.t - PAD.b, dur = total();
    const X = v => PAD.l + v / dur * pw, Y = v => PAD.t + ph - v * ph;
    ctx.font = "12px 'Libre Franklin', sans-serif"; ctx.fillStyle = INK3;
    [0, .5, 1].forEach(v => { ctx.strokeStyle = RULE; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(PAD.l, Y(v)); ctx.lineTo(w - PAD.r, Y(v)); ctx.stroke();
      const s = v * 100 + "%"; ctx.fillText(s, PAD.l - 8 - ctx.measureText(s).width, Y(v) + 4); });
    const stepT = dur > 60 ? 20 : 10;
    for (let v = 0; v <= dur; v += stepT) { const s = v + " s"; ctx.fillText(s, clamp(X(v) - ctx.measureText(s).width / 2, PAD.l, w - ctx.measureText(s).width), h - 6); }
    const line = (series, upto, color, width) => {
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); let prev = null;
      series.forEach(([tt, v]) => { if (tt > upto) return; const x = X(tt); if (prev === null) ctx.moveTo(x, Y(v)); else { ctx.lineTo(x, Y(prev)); ctx.lineTo(x, Y(v)); } prev = v; });
      if (prev !== null) ctx.lineTo(X(upto), Y(prev));
      ctx.stroke();
    };
    sides.forEach(s => {
      const d = s.d;
      line(d.progress, d.duration, s.k === "ours" ? alpha(PLAYER, .25) : "#dde2e8", 2);
      line(d.progress, Math.min(t, d.duration), COLOR[s.k], s.k === "ours" ? 2.6 : 2);
      if (t >= d.duration - .05) dot(ctx, X(d.duration), Y(d.final), 4, COLOR[s.k], "#fff");
    });
    ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X(t), PAD.t); ctx.lineTo(X(t), PAD.t + ph); ctx.stroke();
  }
  let dragging = false;
  const at = e => { const r = plot.getBoundingClientRect(); seek(clamp((e.clientX - r.left - PAD.l) / (r.width - PAD.l - PAD.r), 0, 1) * total()); };
  plot.addEventListener("pointerdown", e => { dragging = true; plot.setPointerCapture(e.pointerId); at(e); });
  plot.addEventListener("pointermove", e => dragging && at(e));
  plot.addEventListener("pointerup", () => dragging = false);
  $("#cmp-play").addEventListener("click", () => { stopped = !stopped; if (!stopped && lead.video.ended) seek(0); else run(); });
  new IntersectionObserver(([e]) => {
    const was = visible; visible = e.isIntersecting;
    if (visible && !was) { if (!cur) { sides.forEach(s => s.video.preload = "auto"); open(0); } run(); requestAnimationFrame(tick); }
    else if (!visible) run();
  }, { threshold: .25 }).observe(root);
  addEventListener("resize", () => cur && render(clock()));
}

function initCite() {
  $("#bib-copy").addEventListener("click", () => {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText($("#bib").textContent).then(() => { $("#bib-copy").textContent = "Copied"; setTimeout(() => $("#bib-copy").textContent = "Copy", 1500); });
  });
}
