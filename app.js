/* Project page prototype. All data comes from assets/*.json, exported by build/*.py. */

const GENRE = {
  "Action": "#ec9800", "Puzzle": "#2ba0e6", "Platformer": "#0f9d6c", "Shooter": "#e0531a",
  "Strategy": "#2563c9", "Simulation": "#c9619f", "Racing": "#bf9f00", "Adventure": "#7a4cb5",
  "Card Game": "#9c5a3c", "RPG": "#4a9e22", "Sports": "#12a8b8", "Other": "#8b8f95",
};
const ENGINE = {
  "Unity WebGL": "#2563c9", "HTML5": "#ec9800", "Flash": "#e0531a", "Godot": "#0f9d6c",
  "PICO-8": "#c9619f", "GameMaker": "#2ba0e6", "Construct": "#7a4cb5", "Other engines": "#8b8f95",
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
const sources = mp4 => `<source src="${mp4}" type="video/mp4"><source src="${mp4.replace(/\.mp4$/, ".webm")}" type="video/webm">`;
function setVideo(video, mp4) { video.removeAttribute("src"); video.innerHTML = sources(mp4); video.load(); }

function fit(canvas, cssH) {
  const dpr = window.devicePixelRatio || 1, w = canvas.parentElement.clientWidth, h = Math.max(1, Math.round(cssH));
  canvas.style.width = w + "px"; canvas.style.height = h + "px";
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
  const ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}
const load = p => fetch(p).then(r => r.json());
initNav();
initResults();
Promise.all(["assets/tiles.json", "assets/data.json", "assets/stories.json", "assets/policy/index.json"].map(load))
  .then(([tiles, data, stories, policies]) => {
    initIntro(tiles);
    initLoop(stories, tiles);
    initExamples(data.replays);
    initPlayers(policies);
  });

/* ============ the bar along the top ============ */
function navH() { return $("#topnav").offsetHeight; }
// How far the page has scrolled through a pinned chapter's hold, from 0 to 1.
function progressIn(pin) {
  const span = pin.offsetHeight - pin.firstElementChild.offsetHeight;
  return span > 0 ? clamp((navH() - pin.getBoundingClientRect().top) / span, 0, 1) : 0;
}
// The page position where a chapter starts under the bar.
function topOf(el) { return el.getBoundingClientRect().top + scrollY - navH(); }
function initNav() {
  const intro = $("#intro"), links = [...document.querySelectorAll("#nav-links a")];
  const IDS = ["abstract", "contributions", "loop", "examples", "players", "results", "release", "cite"];
  // the games are the regrouped wall, most of the way through the opening; a chapter lands
  // with a little room between the bar and its heading
  const target = id => id === "top" ? 0 : id === "games" ? intro.offsetTop + (intro.offsetHeight - innerHeight) * .72 : topOf(document.getElementById(id)) - 24;
  document.addEventListener("click", e => {
    const a = e.target.closest("a[data-go], a.soon"); if (!a) return;
    e.preventDefault();
    if (a.dataset.go) scrollTo({ top: target(a.dataset.go), behavior: "smooth" });
  });
  function onScroll() {
    const p = clamp(scrollY / Math.max(1, intro.offsetHeight - innerHeight), 0, 1);
    document.body.classList.toggle("nav-on", p > .25);
    let cur = p > .5 ? "games" : null;
    IDS.forEach(id => { if (document.getElementById(id).getBoundingClientRect().top <= navH() + innerHeight * .3) cur = id; });
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) cur = IDS[IDS.length - 1];
    links.forEach(a => a.classList.toggle("on", a.dataset.go === cur));
  }
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll);
  onScroll();
}

/* ============ opening wall -> games ============ */
function initIntro(T) {
  const games = T.games, N = games.length, [TW, TH] = T.tile, COLS = T.cols;
  const canvas = $("#wall"), intro = $("#intro"), head = $("#games-head"), band = $("#title-band");
  const tip = $("#tip"), tipVideo = $("#tip-video");
  // One atlas video holds every game; each tile shows its own cell of it. Each new video
  // frame is copied once into `copy` and the tiles are cut from that copy: cutting them from
  // the video itself makes Firefox fetch the whole frame again for every tile.
  const video = Object.assign(document.createElement("video"), { muted: true, loop: true, playsInline: true, autoplay: true });
  setVideo(video, "assets/wall.mp4");
  video.play().catch(() => {});
  const poster = new Image(); poster.src = "assets/wall.jpg";
  const copy = document.createElement("canvas"), cctx = copy.getContext("2d");
  let copied = null, copiedAt = -1;
  function grab() {
    const src = video.readyState >= 2 ? video : poster.complete && poster.naturalWidth ? poster : null;
    if (!src || (src === copied && (src === poster || video.currentTime === copiedAt))) return !!copied;
    const w = src.videoWidth || src.naturalWidth, h = src.videoHeight || src.naturalHeight;
    if (copy.width !== w || copy.height !== h) { copy.width = w; copy.height = h; }
    cctx.drawImage(src, 0, 0); copied = src; copiedAt = video.currentTime;
    return true;
  }
  games.forEach((g, i) => { g.i = i; g.cur = {}; g.zoom = 0; g.vel = 0; g.touched = 0; });

  // the games on the wall and their tasks, counted up from zero each time they come into view
  const counts = [[N, "games"], [games.reduce((n, g) => n + (g.tasks || 0), 0), "tasks"]];
  $("#bignums").innerHTML = counts.map(([n, s]) => `<div><b data-to="${n}">${fmt(n)}</b><span>${s}</span></div>`).join("");
  let counted = false;
  function countUp() {
    const els = [...document.querySelectorAll("#bignums b")], t0 = performance.now();
    const step = now => {
      const f = reduce ? 1 : clamp((now - t0) / 1500, 0, 1), e = 1 - Math.pow(1 - f, 3);
      els.forEach(b => b.textContent = fmt(Math.round(+b.dataset.to * e)));
      if (f < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  let W, H, ctx, wall, groups, group = "genre", switching = null, hover = -1, p = 0, panX = 0, panY = 0, drift = 0, frozen = null, last = performance.now();
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
    const buckets = {}; games.forEach(g => (buckets[g[key]] = buckets[g[key]] || []).push(g.i));
    const names = Object.keys(buckets).sort((a, b) => buckets[b].length - buckets[a].length);
    for (let tw = 64; tw >= 12; tw--) {
      const th = tw * 9 / 16, gap = 3, labelH = 22, pos = [], labels = [];
      let x = 0, y = 0, rowH = 0, ok = true;
      for (const name of names) {
        const n = buckets[name].length, cols = Math.max(3, Math.ceil(Math.sqrt(n * 2.4)));
        const bw = cols * (tw + gap), bh = labelH + Math.ceil(n / cols) * (th + gap);
        if (x + bw > width) { x = 0; y += rowH + 14; rowH = 0; }
        if (y + bh > height) { ok = false; break; }
        labels.push({ x: left + x, y: top + y + 14, name, n, color: (key === "engine" ? ENGINE : GENRE)[name] || INK3 });
        buckets[name].forEach((gi, k) => pos[gi] = { x: left + x + (k % cols) * (tw + gap), y: top + y + labelH + Math.floor(k / cols) * (th + gap), w: tw });
        x += bw + 30; rowH = Math.max(rowH, bh);
      }
      if (ok) return { pos, labels };
    }
  }
  function resize() {
    W = canvas.clientWidth; H = canvas.clientHeight;
    const dpr = window.devicePixelRatio || 1; canvas.width = W * dpr; canvas.height = H * dpr;
    ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.imageSmoothingQuality = "high";
    wall = layoutWall(); groups = { genre: layoutGroups("genre"), engine: layoutGroups("engine") };
  }
  const wrap = (v, span) => ((v % span) + span) % span;
  let running = false;
  function draw(now) {
    if (!running) return;
    const dt = Math.min(.1, (now - last) / 1000); last = now;
    const holding = p <= .1;
    if (holding && !reduce) { drift += dt; const a = heading(drift); panX += Math.cos(a) * SPEED * dt; panY += Math.sin(a) * SPEED * dt; frozen = null; }
    else if (!holding && !frozen) frozen = [panX, panY];
    const [ox, oy] = frozen || [panX, panY];
    const m = ease(clamp((p - .1) / .5, 0, 1)), target = groups[group];
    ctx.clearRect(0, 0, W, H);
    const ready = grab();
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
      if (m > .98) { ctx.strokeStyle = (group === "engine" ? ENGINE[g.engine] : GENRE[g.genre]) || INK3; ctx.lineWidth = 1; ctx.strokeRect(cur.x + .5, cur.y + .5, cur.w - 1, cur.h - 1); }
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
    requestAnimationFrame(draw);
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
    const c = g.cur, z = clamp(g.zoom, 0, 1), bh = BIG * 9 / 16;
    const bx = clamp(c.x + c.w / 2 - BIG / 2, 8, W - BIG - 8), by = clamp(c.y + c.h / 2 - bh / 2, 8, H - bh - 64);
    return { x: c.x + (bx - c.x) * z, y: c.y + (by - c.y) * z, w: c.w + (BIG - c.w) * z, z };
  }
  function tile(gi, x, y, w) {
    const h = w * 9 / 16;
    if (x > W || x + w < 0 || y > H || y + h < 0) return;
    ctx.drawImage(copy, (gi % COLS) * TW, Math.floor(gi / COLS) * TH, TW, TH, x, y, w, h);
  }
  function onScroll() {
    const span = intro.offsetHeight - innerHeight;
    p = clamp(-intro.getBoundingClientRect().top / span, 0, 1);
    const f = clamp((p - .1) / .15, 0, 1);
    band.style.opacity = 1 - f; band.style.transform = `translate(-50%, calc(-50% - ${f * 40}px))`;
    band.style.visibility = f >= 1 ? "hidden" : "";
    head.style.opacity = clamp((p - .5) / .12, 0, 1); head.classList.toggle("live", p > .6);
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
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !running) { running = true; last = performance.now(); video.play().catch(() => {}); requestAnimationFrame(draw); }
    else if (!e.isIntersecting) { running = false; video.pause(); }
  }).observe(intro);
  resize(); onScroll();
}

/* ============ the loop ============ */
// The loop: Builder, Environment, the two players and their Reports on a ring of wide arrows;
// the Scout in front of it, drawing from the sites the games come from; the data after it, a
// window onto a growing library of episodes. Real games ride the arrows: out of the sites,
// through the Scout and the Builder, over to the players, then into the library or round again.
// Below the drawing, what the chosen stage does, played out on one game from its records.
function initLoop(S, T) {
  const cycle = $("#cycle"), canvas = $("#cycle-fx"), panel = $("#loop-panel");
  const ICON = {
    scout: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5" opacity=".5"/><g class="sweep"><path d="M12 12L12 3"/></g><circle cx="16.5" cy="8" r="1.2" fill="currentColor" stroke="none"/>',
    builder: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
    env: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 8.5h18M8.5 14.5l2.3 2.3 4.7-4.7"/>',
    policy: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>',
    vlm: '<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    reports: '<path d="M4 4.5h16v11H11l-4.5 4v-4H4z"/><path d="M12 7.5v4M12 13.8v.1"/>',
    data: '<path d="M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  };
  const NAME = { scout: "Scout", builder: "Builder", env: "Environment", policy: "Coding Player", vlm: "VLM Player", reports: "Reports", data: "Data" };
  cycle.querySelectorAll(".node").forEach(n => {
    n.innerHTML = `<span class="ic"><svg viewBox="0 0 24 24">${ICON[n.dataset.k]}</svg></span>${NAME[n.dataset.k]}`;
  });
  // the stages named in the text are the same buttons, small
  document.querySelectorAll(".sname[data-k]").forEach(m => {
    m.innerHTML = `<span class="ic"><svg viewBox="0 0 24 24">${ICON[m.dataset.k]}</svg></span><span class="t">${NAME[m.dataset.k]}</span>`;
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
  // steps: [title, card html, the time it comes in, card style]
  const STORY = {
    scout: {
      what: "Looks at a game where it is published, works out how it is built and how its state could be read, and decides whether to build it.",
      dur: 9.5,
      steps: () => [
        ["Finds the game", `<img class="fill" src="${S.scout.shot}" alt=""><div class="over">${chip(logo("itchdotio.svg") + `<span>${S.scout.url}</span>`, .5)}${chip(logo("pico8.png") + "PICO-8", .8, "dark")}</div>`, 0, "media"],
        ["Reads up on it", typed(S.scout.evidence[0], 2.4, 2.6), 2.2],
        ["Decides", `${chip(S.scout.decision, 5.6, "call")}<p class="lead" data-at="6">with tasks to build:</p><ol class="ideas">${S.scout.ideas.map((x, i) => `<li data-at="${(6.3 + i * .5).toFixed(1)}">${rich(x)}</li>`).join("")}</ol>`, 5.4],
      ],
    },
    builder: {
      what: "Gets the game running offline, exposes its state through game_api.js, writes the tasks and checks every one before it ships.",
      dur: 9.5,
      steps: () => [
        ["Gets it running offline", `<div class="flip">${S.builder.shots.map(f => `<img src="${f}" alt="">`).join("")}</div>`, 0, "media"],
        ["Exposes its state", `<pre class="api">${S.builder.api.slice(0, 11).map((l, i) => `<span data-at="${(2.4 + i * .14).toFixed(2)}">${esc(l) || " "}</span>`).join("\n")}</pre>`, 2.2, "code"],
        ["Checks it", `<ul class="phases">${S.builder.phases.map(([ph, , txt], i) => `<li data-at="${(5.2 + i * .9).toFixed(1)}"><b>${ph[0] + ph.slice(1).toLowerCase()}</b>${rich(txt)}</li>`).join("")}</ul>`, 5],
      ],
    },
    env: {
      what: "The game, offline and seeded, with tasks whose progress is read from the game's own state, never guessed from the screen.",
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
  const ORDER = ["scout", "builder", "env", "policy", "vlm", "reports", "data"];
  let cur = null, t0 = 0, held = 0, still = 0, video = null, steps = [], round = -1, lastHit = "";
  function show(k) {
    cur = k; t0 = performance.now(); texts.length = 0; round = -1;
    cycle.querySelectorAll(".node").forEach(n => n.classList.toggle("on", n.dataset.k === k));
    if (video) video.pause();
    const st = STORY[k];
    steps = st.steps();
    panel.dataset.k = k;
    panel.innerHTML = `<div class="lp-head"><span class="ic"><svg viewBox="0 0 24 24">${ICON[k]}</svg></span><h3>${NAME[k]}</h3><p>${rich(st.what)}</p></div>
      <div class="board">
        <ol class="rail">${steps.map(([title], i) => `<li><b>${i + 1}</b><span>${esc(title)}</span>${i < 2 ? "<i></i>" : ""}</li>`).join("")}</ol>
        <div class="cards">${steps.map(([, html, , cls]) => `<div class="card ${cls || ""}">${html}</div>`).join("")}</div>
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
    n.addEventListener("mouseenter", () => { if (performance.now() < still) return; held = performance.now() + 15000; if (cur !== n.dataset.k) show(n.dataset.k); });
    n.addEventListener("click", () => { held = performance.now() + 30000; if (cur !== n.dataset.k) show(n.dataset.k); });
  });
  panel.addEventListener("mouseenter", () => held = performance.now() + 15000);
  // a stage named in the chapter's text: show it, with the figure brought into view; the
  // boxes passing under the pointer on the way do not take over
  document.querySelectorAll("#loop .sname").forEach(m => m.addEventListener("click", () => {
    held = performance.now() + 30000; still = performance.now() + 1500; if (cur !== m.dataset.k) show(m.dataset.k);
    scrollTo({ top: topOf(cycle.closest(".pin")) + 2, behavior: "smooth" });
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
    const st = STORY[cur], t = (now - t0) / 1000;
    // stages that run more than once start over each round, with the next case
    const u = st.cycle ? t % st.cycle : t, r = st.cycle ? Math.floor(t / st.cycle) % st.cases : 0;
    if (st.cycle && r !== round) { round = r; st.fill(panel, r); }
    const lit = steps.reduce((n, [, , at], i) => u >= at ? i : n, -1);
    panel.querySelectorAll(".rail li").forEach((li, i) => {
      li.classList.toggle("on", i <= lit); li.classList.toggle("now", i === lit);
      li.classList.toggle("done", i + 1 < steps.length && u >= steps[i + 1][2]);
    });
    panel.querySelectorAll(".card").forEach((cd, i) => { cd.classList.toggle("in", u >= steps[i][2]); cd.classList.toggle("now", i === lit); });
    panel.querySelectorAll(".card [data-at]").forEach(el => el.classList.toggle("in", u >= +el.dataset.at));
    panel.querySelectorAll(".typed").forEach(el => {
      const f = clamp((u - +el.dataset.at) / +el.dataset.dur, 0, 1), txt = el.dataset.text || "", n = Math.ceil(txt.length * f);
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
    if (t > st.dur && performance.now() > held && running) show(ORDER[(ORDER.indexOf(cur) + 1) % ORDER.length]);
  }

  // ---------- the drawing
  const ctx = canvas.getContext("2d"), wall = new Image();
  wall.src = "assets/wall.jpg";
  const COLS = T.cols, [TW, TH] = T.tile;
  let G = null;
  const node = k => cycle.querySelector(`.node[data-k=${k}]`);
  // Everything is placed in design units on a DW x DH board, which is then scaled as one
  // piece to fit the screen; the ring, the cards and the icons keep their proportions.
  const DH = 424, R = 170, GAP = 72, SIDE = 40;   // SIDE: sites to Scout = Data to library
  let DW = 1300;   // set by layout() to just hold both sides
  // The library: a framed window, two episodes wide and four rows tall, onto a list that keeps
  // growing; when the bottom row is full the rows slide up and the top one leaves the window.
  const LIB = { cols: 2, rows: 4, cw: 60, ch: 34, gap: 6, pad: 9 };
  LIB.w = LIB.cols * (LIB.cw + LIB.gap) - LIB.gap + 2 * LIB.pad; LIB.h = LIB.rows * (LIB.ch + LIB.gap) - LIB.gap + 2 * LIB.pad; LIB.step = LIB.ch + LIB.gap;
  const HEAP_W = LIB.w;
  function layout() {
    const box = $("#cycle-box"), stage = cycle.closest(".pin-stage");
    // the single stages share one size (set in the stylesheet); the players' frame is larger
    const size = el => [el.offsetWidth / 2, el.offsetHeight / 2], group = $("#pgroup");
    const [nw, nh] = size(node("builder")), [gw, gh] = size(group);
    // the board is as wide as its wider side needs, twice, so the ring stays in the middle
    DW = Math.round(2 * (R + Math.max(nw, gw) + GAP + 2 * nw + SIDE + HEAP_W) + 12);
    const availW = box.offsetWidth, availH = stage.clientHeight - offsetIn(box, stage) - panel.offsetHeight - 18 - 26;
    const k = clamp(Math.min(availW / DW, availH / DH), .55, 1.12);
    cycle.style.width = DW + "px"; cycle.style.height = DH + "px"; cycle.style.transform = `translateX(-50%) scale(${k})`;
    box.style.height = Math.round(DH * k) + "px";
    // on tall screens the drawing and its panel sit in the middle of the room under the title
    box.style.marginTop = Math.max(0, Math.round((availH - DH * k) / 2)) + "px";
    const dpr = (devicePixelRatio || 1) * k;
    canvas.width = Math.round(DW * dpr); canvas.height = Math.round(DH * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cx = DW / 2, cy = DH / 2;
    const sx = cx - R - nw - GAP - nw, dx = cx + R + gw + GAP + nw;
    G = { W: DW, H: DH, cx, cy, sx, dx, sL: sx - nw, dR: dx + nw };
    const place = (el, x, y) => { el.style.left = x + "px"; el.style.top = y + "px"; };
    place(node("scout"), sx, cy); place(node("builder"), cx - R, cy); place(node("env"), cx, cy - R);
    place(group, cx + R, cy); place(node("reports"), cx, cy + R); place(node("data"), dx, cy);
    // the sites end SIDE short of the Scout; the library starts SIDE past the Data
    G.heap = heap([...cycle.querySelectorAll(".logo")], G.sL - SIDE - HEAP_W, G.sL - SIDE, cy, 44);
    const reach = Math.max(...G.heap.map(c => c.x + c.w / 2)), shift = G.sL - SIDE - reach;
    G.heap.forEach(c => { c.x += shift; place(c.el, c.x, c.y); });
    G.lib = { x: G.dR + SIDE, y: cy - LIB.h / 2 };
    if (!lib.rows.length) {   // start part full
      const any = () => Math.floor(Math.random() * T.games.length);
      lib.rows = [[any(), any()], [any(), any()], [any(), any()], [any(), -1]];
    }
    // Where the ring clears a box, in degrees either side of its angle: past the top or bottom
    // edge of the Builder (a) and of the players' frame (g), past the sides of the boxes above
    // and below (b). Each arrow takes the colour of the stage it leaves.
    const PAD = 12, edge = half => Math.asin(Math.min(1, (half + PAD) / R)) * 180 / Math.PI;
    const a = edge(nh), b = edge(nw), g = edge(gh);
    G.arcs = [   // [from, to] in screen degrees, clockwise, and the colour
      [180 + a, 270 - b, "game"], [270 + b, 360 - g, "game"], [g, 90 - b, "player"], [90 + b, 180 - a, "turn"]];
    G.links = [[sx + nw + PAD, cx - R - nw - PAD, "grey"], [cx + R + gw + PAD, dx - nw - PAD, "player"]];
    const line = (x0, x1) => Array.from({ length: 40 }, (_, i) => [x0 + (x1 - x0) * i / 39, cy]);
    const arc = (a0, a1) => Array.from({ length: 160 }, (_, i) => { const a = (a0 + (a1 - a0) * i / 159) * Math.PI / 180; return [cx + R * Math.cos(a), cy + R * Math.sin(a)]; });
    G.paths = { feed: line(sx, cx - R), top: arc(180, 360), back: arc(0, 180), out: line(cx + R, dx), ring: arc(180, 540) };
  }
  // rows are numbered for good (`base` is the number of the top one kept), so a game flying
  // to its slot keeps its target while the rows slide under it
  const lib = { rows: [], base: 0, scroll: 0, flash: {} };
  const cellAt = (row, col) => [G.lib.x + LIB.pad + col * (LIB.cw + LIB.gap) + LIB.cw / 2,
    G.lib.y + LIB.pad + (row - lib.base) * LIB.step - lib.scroll + LIB.ch / 2];
  function claim() {   // the next free slot, opening a new row at the bottom when the last is full
    let r = lib.rows.length - 1, c = lib.rows[r].indexOf(-1);
    if (c < 0) { lib.rows.push([-1, -1]); r++; c = 0; }
    lib.rows[r][c] = -2;   // taken, still in flight
    return [lib.base + r, c];
  }
  function stepLib(dt) {
    const target = Math.max(0, lib.rows.length - LIB.rows) * LIB.step;
    lib.scroll += (target - lib.scroll) * (1 - Math.exp(-dt * 5));
    if (lib.rows.length > LIB.rows && lib.scroll > LIB.step - .5) { lib.rows.shift(); lib.base++; lib.scroll -= LIB.step; }
  }
  function drawLib() {
    const { x, y } = G.lib;
    ctx.save();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.roundRect(x, y, LIB.w, LIB.h, 6); ctx.fill();
    ctx.strokeStyle = "#4b5563"; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath(); ctx.roundRect(x + 1, y + 1, LIB.w - 2, LIB.h - 2, 5); ctx.clip();
    lib.rows.forEach((row, r) => row.forEach((gi, c) => {
      const [cx, cy] = cellAt(lib.base + r, c), x0 = cx - LIB.cw / 2, y0 = cy - LIB.ch / 2;
      if (y0 > y + LIB.h || y0 + LIB.ch < y) return;
      if (gi < 0) { ctx.strokeStyle = "#cdd4dc"; ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.roundRect(x0 + .5, y0 + .5, LIB.cw - 1, LIB.ch - 1, 3); ctx.stroke(); ctx.setLineDash([]); return; }
      ctx.save(); ctx.beginPath(); ctx.roundRect(x0, y0, LIB.cw, LIB.ch, 3); ctx.clip();
      if (wall.complete && wall.naturalWidth) ctx.drawImage(wall, (gi % COLS) * TW, Math.floor(gi / COLS) * TH, TW, TH, x0, y0, LIB.cw, LIB.ch);
      ctx.restore();
      const age = clock - (lib.flash[`${lib.base + r},${c}`] ?? -9);
      if (age < .6) { ctx.strokeStyle = alpha(PLAYER, (1 - age / .6).toFixed(3)); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.roundRect(x0 - 1.5, y0 - 1.5, LIB.cw + 3, LIB.ch + 3, 4); ctx.stroke(); }
    }));
    // the rows fade out at the window's top and in at its bottom
    [[y, y + 16], [y + LIB.h, y + LIB.h - 16]].forEach(([a, b]) => {
      const g = ctx.createLinearGradient(0, a, 0, b); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g; ctx.fillRect(x, Math.min(a, b), LIB.w, 16);
    });
    ctx.restore();
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
  function lineArrow(x0, x1, tone) {
    const y = G.cy, h = BODY / 2, hw = HEAD_W / 2, xh = x1 - HEAD_L;
    ctx.beginPath(); ctx.moveTo(x0, y - h); ctx.lineTo(xh, y - h); ctx.lineTo(xh, y - hw); ctx.lineTo(x1, y);
    ctx.lineTo(xh, y + hw); ctx.lineTo(xh, y + h); ctx.lineTo(x0, y + h); ctx.closePath(); paint(tone);
  }
  function thumb(gi, x, y, w, h, s = 1, border = null) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.roundRect(-w / 2 - 2.5, -h / 2 - 2.5, w + 5, h + 5, 3.5); ctx.fill();
    if (wall.complete && wall.naturalWidth) ctx.drawImage(wall, (gi % COLS) * TW, Math.floor(gi / COLS) * TH, TW, TH, -w / 2, -h / 2, w, h);
    ctx.strokeStyle = border || "#5b6470"; ctx.lineWidth = border ? 2 : 1; ctx.stroke();
    ctx.restore();
  }

  // games riding the arrows
  const items = [], LEG = { drift: 1.9, feed: 1.4, top: 2.4, back: 2.4, out: 1.3, lib: .9 };
  function spawn() {
    const c = G.heap[Math.floor(Math.random() * G.heap.length)];   // out from behind one of the cards
    const from = [c.x + (Math.random() - .5) * c.w * .6, c.y], to = [G.sx, G.cy];
    const bend = [(from[0] + to[0]) / 2 + (Math.random() - .5) * 60, (from[1] + to[1]) / 2 + (Math.random() - .5) * 120];
    items.push({ gi: Math.floor(Math.random() * T.games.length), leg: "drift", t: 0, from, bend, to, again: Math.random() < .3 });
  }
  function drawItem(it) {
    if (it.leg === "drift") {
      const f = ease(clamp(it.t, 0, 1)), u = 1 - f;
      const x = u * u * it.from[0] + 2 * u * f * it.bend[0] + f * f * it.to[0], y = u * u * it.from[1] + 2 * u * f * it.bend[1] + f * f * it.to[1];
      return thumb(it.gi, x, y, 54, 30, .55 + .35 * f);
    }
    if (it.leg === "lib") {
      const [x0, y0] = [G.dx, G.cy], [x1, y1] = cellAt(...it.slot), f = ease(clamp(it.t, 0, 1));
      const s = 1 + (LIB.cw / 54 - 1) * f;
      return thumb(it.gi, x0 + (x1 - x0) * f, y0 + (y1 - y0) * f - Math.sin(f * Math.PI) * 26, 54, 30, s);
    }
    const [x, y] = along(G.paths[it.leg], it.t);
    thumb(it.gi, x, y, 54, 30, it.leg === "feed" ? .9 + .1 * clamp(it.t * 2.5, 0, 1) : 1, it.leg === "back" ? TURN : null);
  }

  let running = false, last = 0, clock = 0, spawnIn = 0;
  function frame(now) {
    if (!running) return;
    const dt = Math.min(.05, (now - last) / 1000); last = now; clock += dt;
    ctx.clearRect(0, 0, G.W, G.H);
    G.arcs.forEach(([a0, a1, tone]) => arcArrow(a0, a1, tone));
    G.links.forEach(([x0, x1, tone]) => lineArrow(x0, x1, tone));
    stepLib(dt);
    drawLib();
    // games
    spawnIn -= dt;
    if (spawnIn <= 0 && items.length < 9) { spawn(); spawnIn = 1.6; }
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      it.t += dt / LEG[it.leg];
      if (it.t < 1) continue;
      it.t = 0;
      if (it.leg === "drift") it.leg = "feed";
      else if (it.leg === "feed") it.leg = "top";
      else if (it.leg === "top") { it.leg = it.again ? "back" : "out"; it.again = false; }
      else if (it.leg === "back") it.leg = "top";
      else if (it.leg === "out") { it.leg = "lib"; it.slot = claim(); }
      else {
        const [r, c] = it.slot;
        if (r >= lib.base) { lib.rows[r - lib.base][c] = it.gi; lib.flash[`${r},${c}`] = clock; }
        items.splice(i, 1);
      }
    }
    items.forEach(drawItem);
    tick(now);
    requestAnimationFrame(frame);
  }
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !running) { running = true; last = performance.now(); if (!cur) show("scout"); requestAnimationFrame(frame); }
    else if (!e.isIntersecting) { running = false; if (video) video.pause(); }
  }).observe(cycle);
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
    charts(t, dur, Math.max(220, leftH - used));
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
    const s = V.steps[k], ms = clamp(500 + (s.tout || 0) * 2.5, 700, 1600);
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
  let face = 0, f = 0;
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
    const x = clamp((progressIn(pin) - A) / (B - A), 0, 1);
    f = x * x * (3 - 2 * x);
    track.style.transform = `translateX(${(-f * 100).toFixed(3)}%)`;
    faces[0].style.opacity = 1 - .75 * f; faces[1].style.opacity = .25 + .75 * f;
    const [a, b] = names.map(n => [n.offsetLeft, n.offsetWidth]);
    bar.style.left = a[0] + (b[0] - a[0]) * f + "px"; bar.style.width = a[1] + (b[1] - a[1]) * f + "px";
    const now = f < .5 ? 0 : 1;
    if (now !== face) { face = now; names.forEach((n, i) => n.classList.toggle("on", i === face)); coding.sync(); vlm.sync(); }
  }
  const at = q => topOf(pin) + q * (pin.offsetHeight - pin.firstElementChild.offsetHeight);
  let idle = 0;
  addEventListener("scroll", () => {
    slide(); clearTimeout(idle);
    idle = setTimeout(() => { if (f > 0 && f < 1) scrollTo({ top: at(f < .5 ? A - .03 : B + .03), behavior: "smooth" }); }, 180);
  }, { passive: true });
  $("#who").addEventListener("click", e => { const b = e.target.closest("button"); if (b) scrollTo({ top: at(+b.dataset.face ? .8 : .2), behavior: "smooth" }); });
  document.querySelectorAll("#players .sname").forEach(m => m.addEventListener("click", () => scrollTo({ top: at(m.dataset.k === "vlm" ? .8 : .2), behavior: "smooth" })));
  addEventListener("resize", slide);
  slide();
  near($("#players"), () => open(0));   // the first traces are ~1 MB each: fetch them on approach
}

/* ============ results: placeholders until the experiments are done ============ */
function tbdify(s) { return esc(s).replace(/x{2,}/g, m => `<span class="tbd">${m}</span>`); }
function initResults() {
  // A chart's frame with nothing plotted yet: its scale, its categories, and an xxx where each
  // value will go. Bars stand on the baseline, so no height is implied.
  function skeleton(svg) {
    const d = svg.dataset, w = svg.clientWidth, h = svg.clientHeight, cats = d.cats.split("|"), series = d.series ? d.series.split("|") : [null];
    const L = 34, T = 26, B = 28, pw = w - L, ph = h - T - B, base = T + ph;
    const COL = ["#9aa3ad", PLAYER];
    let out = `<text x="0" y="12" class="ax">${esc(d.axis)}</text>`;
    [0, 25, 50, 75, 100].forEach(v => { const y = base - v / 100 * ph; out += `<line x1="${L}" x2="${w}" y1="${y}" y2="${y}" class="grid"/><text x="${L - 8}" y="${y + 4}" class="tick" text-anchor="end">${v}</text>`; });
    const slot = pw / cats.length, bw = Math.min(64, (slot - 28) / series.length);
    cats.forEach((c, i) => {
      const mid = L + (i + .5) * slot;
      out += `<text x="${mid}" y="${base + 18}" class="tick" text-anchor="middle">${esc(c)}</text>`;
      series.forEach((_, j) => {
        const x = mid + (j - (series.length - 1) / 2) * (bw + 8);
        out += `<line x1="${x - bw / 2}" x2="${x + bw / 2}" y1="${base}" y2="${base}" class="foot" stroke="${series.length > 1 ? COL[j] : "#9aa3ad"}"/><text x="${x}" y="${base - 10}" class="tbd" text-anchor="middle">xxx</text>`;
      });
    });
    if (series[0]) {
      let x = w;
      [...series].reverse().forEach((n, k) => { const j = series.length - 1 - k; x -= n.length * 7 + 34; out += `<line x1="${x}" x2="${x + 14}" y1="8" y2="8" class="foot" stroke="${COL[j]}"/><text x="${x + 20}" y="12" class="tick">${esc(n)}</text>`; });
    }
    svg.innerHTML = out;
  }
  const charts = [...document.querySelectorAll("svg.skel")];
  const draw = () => charts.forEach(skeleton);
  draw(); addEventListener("resize", draw); document.fonts && document.fonts.ready.then(draw);

  // the leaderboard: models ranked, then the policy and people as reference rows
  const MODELS = [["VLM xxx", "Closed VLM"], ["VLM xxx", "Closed VLM"], ["VLM xxx", "Open VLM, xxB"], ["VLM xxx", "Open VLM, xxB"],
    ["Agent xxx", "Computer-use agent"], ["Ours, xxB", "VLM trained on our episodes"]];
  const REF = [["Coding Player", "Policy written by a coding agent"], ["People", "Human players"]];
  const SCORE = ["Progress", "Success", "Cost per solved task"];
  const COLS = { all: SCORE, held: SCORE };
  function board(v) {
    document.querySelectorAll("#lb-tabs button").forEach(b => b.classList.toggle("on", b.dataset.v === v));
    const cols = COLS[v];
    const row = ([name, kind], ref, first) => `<tr class="${ref ? "ref" : ""}${first ? " split" : ""}"><td>${tbdify(name)}</td><td class="kind">${tbdify(kind)}</td>${cols.map(() => `<td class="r tbd">xxx</td>`).join("")}</tr>`;
    $("#lb").innerHTML = `<table class="tbl"><tr><th>Player</th><th>Kind</th>${cols.map(c => `<th class="r">${esc(c)}</th>`).join("")}</tr>`
      + MODELS.map(m => row(m, false, false)).join("") + REF.map((m, i) => row(m, true, i === 0)).join("") + "</table>";
  }
  $("#lb-tabs").addEventListener("click", e => { const b = e.target.closest("button"); if (b) board(b.dataset.v); });
  board("all");

  $("#bib-copy").addEventListener("click", () => {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText($("#bib").textContent).then(() => { $("#bib-copy").textContent = "Copied"; setTimeout(() => $("#bib-copy").textContent = "Copy", 1500); });
  });
}
