/* Project page prototype. All data comes from assets/*.json, exported by build/*.py. */

const GENRE = {
  "Action": "#d98a00", "Puzzle": "#3e9bd6", "Platformer": "#138a63", "Shooter": "#c8501a",
  "Strategy": "#2c5fa8", "Simulation": "#b5679a", "Racing": "#a88f00", "Adventure": "#6e4c9a",
  "Card Game": "#8a5a44", "RPG": "#4e8f2e", "Sports": "#1a9aa8", "Other": "#8b8f95",
};
const ENGINE = {
  "Unity WebGL": "#2c5fa8", "HTML5": "#d98a00", "Flash": "#c8501a", "Godot": "#138a63",
  "PICO-8": "#b5679a", "GameMaker": "#3e9bd6", "Construct": "#6e4c9a", "Other engines": "#8b8f95",
};
const INK = "#1f2328", INK3 = "#8b929b", RULE = "#e5e7eb", PANEL = "#f7f9fb", ACCENT = "#dd6b20", BLUE = "#3d6fb0";
const $ = (s, el = document) => el.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const fmt = n => n.toLocaleString("en-US");
const esc = s => String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const stripLinks = s => String(s).replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
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
Promise.all(["assets/tiles.json", "assets/data.json", "assets/pipeline.json", "assets/policy/index.json", "assets/loop.json"].map(load))
  .then(([tiles, data, pipe, policies, loop]) => {
    initIntro(tiles, data);
    initLoop(loop, pipe);
    initExamples(data.replays);
    initPolicies(policies);
  });

/* ============ opening wall -> games ============ */
function initIntro(T, data) {
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
  games.forEach((g, i) => { g.i = i; g.cur = {}; });

  const genres = new Set(), engines = new Set();
  Object.keys(data.matrix).forEach(k => { const [e, g] = k.split("|"); engines.add(e); genres.add(g); });
  const t = data.totals;
  $("#bignums").innerHTML = [[fmt(t.games), "games"], [fmt(t.tasks), "tasks"], [genres.size, "genres"], [engines.size, "engines"],
    [fmt(t.episodes), "policy episodes"], [fmt(t.hours), "hours of play"]].map(([b, s]) => `<div><b>${b}</b><span>${s}</span></div>`).join("");

  let W, H, ctx, wall, groups, group = "genre", switching = null, hover = -1, p = 0, panX = 0, panY = 0, frozen = null, last = performance.now();
  const DIR = [Math.cos(.47), Math.sin(.47)];

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
    if (holding && !reduce) { panX += DIR[0] * 22 * dt; panY += DIR[1] * 22 * dt; frozen = null; }
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
      const ax = wrap(c.x - ox, wall.spanX) - (wall.w + wall.g), ay = wrap(c.y - oy, wall.spanY) - (wall.h + wall.g);
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
    if (ready && hover >= 0 && m > .98) {
      const c = games[hover].cur, w = c.w * 2.3, x = c.x + c.w / 2 - w / 2, y = c.y + c.h / 2 - w * 9 / 32;
      tile(hover, x, y, w); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, w * 9 / 16);
    }
    if (switching) { switching.t = Math.min(1, switching.t + dt / .9); if (switching.t >= 1) switching = null; }
    requestAnimationFrame(draw);
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
    head.style.opacity = clamp((p - .5) / .12, 0, 1); head.classList.toggle("live", p > .6);
    if (p < .6 && hover >= 0) { hover = -1; tip.classList.remove("on"); tipVideo.pause(); }
  }
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
      hover = hit;
      if (hit >= 0) { const g = games[hit]; setVideo(tipVideo, `assets/clips/${g.id}.mp4`); tipVideo.play().catch(() => {}); $("#tip-title").textContent = g.title; $("#tip-meta").textContent = `${g.genre} · ${g.engine}`; }
      else tipVideo.pause();
    }
    tip.classList.toggle("on", hit >= 0);
    if (hit >= 0) { tip.style.left = (mx + 340 > W ? mx - 340 : mx + 20) + "px"; tip.style.top = clamp(my - 100, 10, H - 250) + "px"; }
  });
  canvas.addEventListener("mouseleave", () => { hover = -1; tip.classList.remove("on"); tipVideo.pause(); });
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
// Small SVG charts at the card's pixel width. One series is one colour; the highlighted
// part is the accent; ordered parts take the gray ramp. Values sit at the bar tips.
const RAMP = ["#1f4e79", "#3b6ea8", "#6f9bcb", "#93b5da"];
const bar = (x0, y, x1, h) => {        // square at the baseline, 4px round at the data end
  const r = Math.min(4, h / 2, Math.max(0, x1 - x0));
  return `M${x0} ${y}H${x1 - r}Q${x1} ${y} ${x1} ${y + r}V${y + h - r}Q${x1} ${y + h} ${x1 - r} ${y + h}H${x0}Z`;
};
const col = (x, y0, w, y1) => {         // a column growing up from y0 to y1
  const r = Math.min(4, w / 2, Math.max(0, y0 - y1));
  return `M${x} ${y0}V${y1 + r}Q${x} ${y1} ${x + r} ${y1}H${x + w - r}Q${x + w} ${y1} ${x + w} ${y1 + r}V${y0}Z`;
};
const charts = {
  hbars(items, w, { hi = [], fmt = v => fmt0(v) } = {}) {
    // labels are 12px Libre Franklin: about 6.4px a character
    const labelW = Math.max(...items.map(d => String(d[0]).length)) * 6.4 + 14;
    const max = Math.max(...items.map(d => d[1])), x1 = w - 52, rowH = 24;
    const rows = items.map(([k, v], i) => {
      const y = i * rowH, end = labelW + Math.max(2, (x1 - labelW) * v / max);
      return `<g><title>${esc(k)}: ${fmt(v)}</title><text x="0" y="${y + 13}">${esc(k)}</text>
        <path class="m${hi.includes(i) ? " hi" : ""}" d="${bar(labelW, y + 4, end, 12)}" fill="${hi.includes(i) ? ACCENT : BLUE}"/>
        <text class="v" x="${end + 6}" y="${y + 14}">${fmt(v)}</text></g>`;
    }).join("");
    return `<svg height="${items.length * rowH}">${rows}</svg>`;
  },
  stack(items, w, { colors = RAMP, label = null } = {}) {
    const total = items.reduce((a, d) => a + d[1], 0), gap = 2, y = label ? 18 : 0;
    let x = 0;
    const segs = items.map(([k, v], i) => {
      const sw = Math.max(1, w * v / total - (i < items.length - 1 ? gap : 0)), s = `<rect class="s s${i}${colors[i] === ACCENT ? " hi" : ""}" x="${x}" y="${y}" width="${sw}" height="14" fill="${colors[i]}"><title>${esc(k)}: ${fmt0(v)}</title></rect>`;
      x += sw + gap; return s;
    }).join("");
    const legend = items.map(([k, v], i) => `<g transform="translate(${(i % 2) * w / 2}, ${y + 34 + Math.floor(i / 2) * 20})"><rect class="s s${i}${colors[i] === ACCENT ? " hi" : ""}" y="-9" width="10" height="10" fill="${colors[i]}"/>
      <text x="16">${esc(k)}</text><text class="v" x="${w / 2 - 14}" text-anchor="end">${fmt0(v)}</text></g>`).join("");
    return `<svg height="${y + 30 + Math.ceil(items.length / 2) * 20}">${label ? `<text x="0" y="11">${esc(label)}</text>` : ""}${segs}${legend}</svg>`;
  },
  columns(items, w, { hi = [], h = 150 } = {}) {
    const max = Math.max(...items.map(d => d[1])), slot = w / items.length, cw = Math.min(24, slot * .6), base = h - 18;
    const cols = items.map(([k, v], i) => {
      const x = i * slot + (slot - cw) / 2, top = base - (base - 16) * v / max;
      return `<g><title>${esc(k)}: ${fmt0(v)}</title><path class="m${hi.includes(i) ? " hi" : ""}" d="${col(x, base, cw, v ? top : base)}" fill="${hi.includes(i) ? ACCENT : BLUE}"/>
        <text class="v" x="${x + cw / 2}" y="${top - 5}" text-anchor="middle">${fmt0(v)}</text>
        <text x="${x + cw / 2}" y="${h - 3}" text-anchor="middle">${esc(k)}</text></g>`;
    }).join("");
    return `<svg height="${h}"><line class="base" x1="0" x2="${w}" y1="${base + .5}" y2="${base + .5}" stroke="${RULE}"/>${cols}</svg>`;
  },
  waffle(total, hi, w, { cols = 25 } = {}) {
    const s = Math.floor(w / cols) - 2, step = s + 2, rows = Math.ceil(total / cols);
    const cells = Array.from({ length: total }, (_, i) => `<rect x="${(i % cols) * step}" y="${Math.floor(i / cols) * step}" width="${s}" height="${s}" rx="1.5" class="wf${i < hi ? " hi" : ""}" fill="${i < hi ? BLUE : "#e3e8ee"}"/>`).join("");
    return `<svg height="${rows * step}">${cells}</svg>`;
  },
};
const fmt0 = v => typeof v === "number" ? (Number.isInteger(v) ? fmt(v) : String(v)) : String(v);
const pct = v => Math.round(v * 100) + "%";

function initLoop(L, P) {
  const flow = $("#flow"), svg = $("#wires"), panel = $("#loop-panel");
  const ICON = {
    scout: '<circle cx="12" cy="12" r="7"/><path d="M17 17L23 23"/>',
    builder: '<path d="M4 9L14 4L24 9V19L14 24L4 19Z M4 9L14 14L24 9 M14 14V24"/>',
    vlm: '<path d="M2 14C6 7 22 7 26 14C22 21 6 21 2 14Z"/><circle cx="14" cy="14" r="3.5"/>',
    policy: '<path d="M9 8L3 14L9 20 M19 8L25 14L19 20 M16 6L12 22"/>',
    data: '<rect x="4" y="5" width="20" height="18" rx="1"/><path d="M4 10H24 M4 18H24 M9 5V10 M14 5V10 M19 5V10 M9 18V23 M14 18V23 M19 18V23"/>',
  };
  const D = L.data, vlmEpisodes = D.vlm.reduce((a, m) => a + m.episodes, 0);
  const sum = items => items.reduce((a, d) => a + d[1], 0);
  const stages = {
    scout: {
      name: "Scout", stat: `${L.scout.games} games inspected`,
      what: "Finds a game's playable build and its source, and judges whether it can become an environment.",
      stats: [[L.scout.games, "games"], [`${L.scout.minutes} min`, "median per game"]],
      cards: w => [
        ["Decision", charts.stack(L.scout.decision, w)],
        ["Found on", charts.hbars(L.scout.source, w)],
        ["Outlook", charts.stack(L.scout.offline, w, { label: "runs offline" }) + charts.stack(L.scout.state, w, { label: "state readable" })],
      ],
    },
    builder: {
      name: "Builder", stat: `${sum(L.builder.outcome.slice(0, 1))} environments built`,
      what: "Rebuilds the game to run offline, exposes its state, writes the tasks and verifies every one.",
      stats: [[L.builder.outcome[0][1], "built"], [L.builder.outcome[1] ? L.builder.outcome[1][1] : 0, "unsuitable"], [fmt(L.builder.tasks_total), "tasks"], [`${L.builder.minutes} min`, "median per game"]],
      cards: w => [
        ["Engines", charts.hbars(L.builder.engine, w)],
        ["Tasks per game", charts.columns(L.builder.tasks, w)],
        [`${esc(P.title)}, while being built`, `<div class="shots">${P.shots.slice(0, 6).map(x => `<img src="${x.file}" alt="" loading="lazy">`).join("")}</div>`],
      ],
    },
    vlm: {
      name: "VLM Player", stat: `${L.vlm.reports} reports, ${L.vlm.repairs} repairs`,
      what: "A vision-language model plays every task from the screen. What does not work goes back to the Builder as a report.",
      stats: [[L.vlm.reports, "reports"], [L.vlm.repairs, "repairs"], [L.vlm.games, "games now clean"]],
      cards: w => [
        ["First play of each game", charts.stack([["clean", L.vlm.first_clean], ["problems reported", L.vlm.reported]], w, { colors: [RAMP[3], ACCENT] })],
        ["Reports per reported game", charts.columns(L.vlm.per_game, w)],
        ["Check rounds by model", charts.hbars(L.vlm.models, w)],
      ],
    },
    policy: {
      name: "Policy Author", stat: `${L.policy.outcome[0][1]} policies pass`,
      what: "Writes a scripted policy over the exposed state. State the policy needs and cannot read goes back to the Builder as a request.",
      stats: [[L.policy.files, "policies"], [L.policy.lines_median, "median lines"], [`${L.policy.minutes} min`, "median per game"]],
      cards: w => [
        ["Outcome", charts.stack(L.policy.outcome, w)],
        ["Lines per policy", charts.columns(L.policy.lines, w)],
        [`Asked the Builder for state: ${L.policy.asked} of ${sum(L.policy.outcome)} games`, charts.waffle(sum(L.policy.outcome), L.policy.asked, w)],
      ],
    },
    data: {
      name: "Data", stat: `${fmt(D.policy.episodes + vlmEpisodes)} episodes`,
      what: "Policies and VLM players play the tasks again. Each episode keeps the video, the game state and every input.",
      stats: [[fmt(D.policy.episodes + vlmEpisodes), "episodes"], [fmt(Math.round(D.policy.hours + D.vlm.reduce((a, m) => a + m.hours, 0))), "hours"]],
      cards: w => {
        const rows = [["Policies", D.policy], ...D.vlm.map(m => [m.model, m])];
        return [
          ["Episodes", charts.hbars(rows.map(([k, m]) => [k, m.episodes]), w, { hi: [0] })],
          ["Task completed", charts.hbars(rows.map(([k, m]) => [k, m.completed]), w, { hi: [0], fmt: pct })],
          ["Games played", charts.hbars(rows.map(([k, m]) => [k, m.games]), w, { hi: [0] })],
        ];
      },
    },
  };
  $("#loop-scope").textContent = `${L.games} games through the pipeline`;
  flow.querySelectorAll(".fnode").forEach(n => {
    const st = stages[n.dataset.k];
    n.innerHTML = `<svg viewBox="0 0 28 28">${ICON[n.dataset.k]}</svg><b>${st.name}</b><small>${esc(st.stat)}</small>`;
  });

  // Wires: right-angle paths between the boxes' edges, corners rounded.
  let wires = [];
  function ortho(pts, rad = 9) {
    let d = `M${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i - 1], [x, y] = pts[i], [x1, y1] = pts[i + 1];
      const r = Math.min(rad, Math.hypot(x - x0, y - y0) / 2, Math.hypot(x1 - x, y1 - y) / 2);
      d += `L${x - Math.sign(x - x0) * r} ${y - Math.sign(y - y0) * r}Q${x} ${y} ${x + Math.sign(x1 - x) * r} ${y + Math.sign(y1 - y) * r}`;
    }
    const e = pts[pts.length - 1];
    return d + `L${e[0]} ${e[1]}`;
  }
  function layoutWires() {
    const box = flow.getBoundingClientRect();
    const R = el => { const r = el.getBoundingClientRect(); return { l: r.left - box.left, r: r.right - box.left, t: r.top - box.top, b: r.bottom - box.top, cx: (r.left + r.right) / 2 - box.left, cy: (r.top + r.bottom) / 2 - box.top }; };
    const n = k => R(flow.querySelector(`.fnode[data-k=${k}]`)), g = R(flow.querySelector(".fgroup"));
    const S = n("scout"), B = n("builder"), V = n("vlm"), Pn = n("policy"), Dn = n("data");
    const m1 = (B.r + g.l) / 2, m2 = (g.r + Dn.l) / 2, low = g.b + 26, gap = 3;
    wires = [
      { d: ortho([[S.r, S.cy], [B.l - gap, B.cy]]), on: ["scout", "builder"] },
      { d: ortho([[B.r, B.cy], [m1, B.cy], [m1, V.cy], [V.l - gap, V.cy]]), on: ["builder", "vlm"] },
      { d: ortho([[B.r, B.cy], [m1, B.cy], [m1, Pn.cy], [Pn.l - gap, Pn.cy]]), on: ["builder", "policy"] },
      { d: ortho([[V.r, V.cy], [m2, V.cy], [m2, Dn.cy - 9], [Dn.l - gap, Dn.cy - 9]]), on: ["vlm", "data"] },
      { d: ortho([[Pn.r, Pn.cy], [m2, Pn.cy], [m2, Dn.cy + 9], [Dn.l - gap, Dn.cy + 9]]), on: ["policy", "data"] },
      { d: ortho([[g.cx, g.b], [g.cx, low], [B.cx, low], [B.cx, B.b + gap]]), on: ["vlm", "policy", "builder"], back: true,
        label: [(g.cx + B.cx) / 2, low + 16, "reports and requests, repaired by the Builder"] },
    ];
    svg.innerHTML = `<defs>
      <marker id="lh" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 1L9 5L0 9z" fill="${INK3}"/></marker>
      <marker id="lh-on" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 1L9 5L0 9z" fill="${INK}"/></marker>
      <marker id="lh-back" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 1L9 5L0 9z" fill="${ACCENT}"/></marker></defs>` +
      wires.map((w, i) => `<path class="w${w.back ? " back" : ""}" d="${w.d}" marker-end="url(#${w.back ? "lh-back" : "lh"})"/>` +
        (w.label ? `<text x="${w.label[0]}" y="${w.label[1]}" text-anchor="middle">${w.label[2]}</text>` : "") +
        (reduce ? "" : `<circle class="pk${w.back ? " back" : ""}" r="2.6"><animateMotion dur="${w.back ? 3.2 : 2.2}s" begin="${(i * .37).toFixed(2)}s" repeatCount="indefinite" path="${w.d}"/></circle>`)).join("");
    mark();
  }

  let cur = null, held = 0;
  function mark() {
    flow.querySelectorAll(".fnode").forEach(n => n.classList.toggle("on", n.dataset.k === cur));
    svg.querySelectorAll(".w").forEach((p, i) => {
      const on = wires[i].on.includes(cur) && (wires[i].back || wires[i].on.length === 2);
      p.classList.toggle("on", on);
      if (!wires[i].back) p.setAttribute("marker-end", `url(#${on ? "lh-on" : "lh"})`);
    });
  }
  function show(k) {
    cur = k; mark(); panel.dataset.k = k;
    const st = stages[k], w = Math.floor((panel.querySelector(".lp-cards") || panel).clientWidth / 3 - 24);
    panel.innerHTML = `<div class="lp-head"><div><h3>${st.name}</h3><p>${esc(st.what)}</p></div>
      <div class="lp-stats">${st.stats.map(([b, s]) => `<div><b>${typeof b === "number" ? fmt(b) : b}</b><span>${s}</span></div>`).join("")}</div></div>
      <div class="lp-cards">${st.cards(w).map(([h, body]) => `<div class="lp-card"><h4>${h}</h4>${body}</div>`).join("")}</div>`;
  }
  const order = ["scout", "builder", "vlm", "policy", "data"];
  flow.querySelectorAll(".fnode").forEach(n => {
    n.addEventListener("mouseenter", () => { held = performance.now() + 15000; show(n.dataset.k); });
    n.addEventListener("click", () => { held = performance.now() + 30000; show(n.dataset.k); });
  });
  panel.addEventListener("mouseenter", () => held = performance.now() + 15000);
  // The panel keeps the height of its tallest stage, so switching never moves the page.
  function settle() {
    let tallest = 0;
    order.forEach(k => { show(k); tallest = Math.max(tallest, panel.offsetHeight); });
    panel.style.minHeight = tallest + "px";
  }
  addEventListener("resize", () => { const k = cur; panel.style.minHeight = ""; settle(); layoutWires(); show(k); });
  settle(); layoutWires(); show("scout");
  document.fonts && document.fonts.ready.then(() => { const k = cur; panel.style.minHeight = ""; settle(); layoutWires(); show(k); });
  setInterval(() => { if (performance.now() > held) show(order[(order.indexOf(cur) + 1) % order.length]); }, 6000);
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
  ctx.fillStyle = "#eef3f9"; ctx.fillRect(0, 0, w * t / dur, h);
  ctx.strokeStyle = INK3; ctx.lineWidth = 1.2; ctx.beginPath();
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
function fitBench(bench, left, extra) {
  const wrapW = bench.parentElement.clientWidth, avail = innerHeight - 156 - 28;
  const lw = clamp((avail - extra.fixed) / extra.perWidth, 380, wrapW * .62);
  bench.style.gridTemplateColumns = `${Math.round(lw)}px minmax(0, 1fr)`;
  return lw;
}
// Players start fetching only when their section comes within a screen of view.
const near = (el, fn) => new IntersectionObserver((es, io) => { if (es.some(e => e.isIntersecting)) { io.disconnect(); fn(); } }, { rootMargin: "100% 0px" }).observe(el);
function videoLoop(video, render, playBtn) {
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
  new IntersectionObserver(es => es.forEach(e => { visible = e.isIntersecting; visible ? video.play().catch(() => {}) : video.pause(); }), { threshold: .3 }).observe(video);
  return () => { if (visible) video.play().catch(() => {}); };
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
    const leftH = $("#ex-left").offsetHeight, used = $("#ex-task-box").offsetHeight + 14 + $(".read", $("#ex-right")).offsetHeight + 12;
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
          items.forEach(([a, b]) => { ctx.fillStyle = a <= t ? BLUE : "#dde3ea"; ctx.fillRect(X(a), ly + 2, Math.max(2, X((b ?? dur) - a)), lh - 4); });
        });
      } else {
        const a = lo ?? Math.min(...s.map(p => p[1])), b = hi ?? Math.max(...s.map(p => p[1])), span = b - a || 1;
        const Y = v => py + PLOT - 4 - (v - a) / span * (PLOT - 8);
        const v = valueAt(s, t), txt = name === "progress" ? Math.round(v * 100) + "%" : String(v);
        ctx.fillStyle = INK; ctx.fillText(txt, w - ctx.measureText(txt).width, y0 + 12);
        [[dur, "#cfd6de", 1.5], [t, BLUE, 2]].forEach(([upto, color, lw]) => {
          ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.beginPath(); let prev = null;
          s.forEach(([tt, vv]) => { if (tt > upto) return; const x = X(tt), y = Y(vv); if (prev === null) ctx.moveTo(x, y); else { ctx.lineTo(x, Y(prev)); ctx.lineTo(x, y); } prev = vv; });
          if (prev !== null && upto < dur) ctx.lineTo(X(upto), Y(prev));
          ctx.stroke();
        });
      }
      ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X(t), py); ctx.lineTo(X(t), py + PLOT); ctx.stroke();
    });
  }
  const resume = videoLoop(video, render, $("#ex-play"));
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
const RED = "#d64545", AMBER = "#e8a33d", GOLD = "#ffd23f";
const MAPS = {
  // The race: road across, distance ahead upwards; the dashed line is where it steers.
  "43_pico-world-race"(ctx, w, h, v) {
    const X = lat => w / 2 + lat * (w * .36), Y = d => h - 18 - d / 200 * (h - 28);
    ctx.fillStyle = "#e8edf2"; ctx.fillRect(X(-1), 0, X(1) - X(-1), h);
    ctx.strokeStyle = "#c9d1da"; ctx.setLineDash([5, 7]); ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.stroke(); ctx.setLineDash([]);
    (v.obstacles || []).forEach(([side, d]) => { if (d <= 200) { ctx.fillStyle = INK3; ctx.fillRect(X(side * 1.08) - 5, Y(d) - 5, 10, 10); } });
    (v.tokens || []).forEach(([lat, d]) => { if (d <= 200 && d >= -5) dot(ctx, X(lat), Y(d), 4.5, GOLD, "#b8901a"); });
    (v.opponents || []).forEach(([lat, d]) => { if (d <= 200 && d >= -8) { ctx.fillStyle = BLUE; ctx.fillRect(X(lat) - 4.5, Y(d) - 7, 9, 14); } });
    if (typeof v.target === "number") { ctx.setLineDash([4, 4]); ray(ctx, X(v.target), Y(0), X(v.target), Y(120), ACCENT, 2); ctx.setLineDash([]); }
    ctx.fillStyle = INK; ctx.fillRect(X(v.lateral) - 5.5, Y(0) - 9, 11, 18);
    if (v.turn) ray(ctx, X(v.lateral), Y(0) - 12, X(v.lateral) + v.turn * 16, Y(0) - 20, INK, 2, true);
  },
  // The bullets the probe reports, and the 18 moves it scored: red ones end in a hit.
  "131_touhou-tales-of-danmaku"(ctx, w, h, v) {
    const { X, Y, k } = frame(w, h, v.b);
    ctx.fillStyle = "#e8edf2"; ctx.fillRect(X(v.b[0]), Y(v.b[1]), (v.b[2] - v.b[0]) * k, (v.b[3] - v.b[1]) * k);
    if (typeof v.tx === "number") { ctx.setLineDash([3, 4]); ray(ctx, X(v.tx), Y(0), X(v.tx), Y(v.b[3]), BLUE, 1); ctx.setLineDash([]); }
    if (v.boss) { ctx.fillStyle = INK3; ctx.fillRect(X(v.boss[0] - v.boss[2] / 2), Y(v.boss[1] - v.boss[3] / 2), v.boss[2] * k, v.boss[3] * k); }
    (v.en || []).forEach(([x, y, r]) => dot(ctx, X(x), Y(y), Math.max(2.5, r * k), INK3));
    const [px, py] = v.p;
    (v.cand || []).forEach(([x, y, s]) => ray(ctx, X(px), Y(py), X(x), Y(y), s < 0 ? RED : s < 5 ? AMBER : "#b9bec4", 1));
    const pick = v.pick && (v.cand || []).find(c => c[3] === v.pick[2] && Math.abs(c[4] - v.pick[0]) < .01 && Math.abs(c[5] - v.pick[1]) < .01);
    if (pick && (pick[4] || pick[5])) ray(ctx, X(px), Y(py), X(pick[0]), Y(pick[1]), ACCENT, 2.5, true);
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
      dot(ctx, X(x), Y(y), 2.2, f === null ? "#dde3ea" : `rgba(221, 107, 32, ${(1 - f) * .9 + .08})`);
    });
    (v.en || []).forEach(([x, y]) => { if (x !== null) { ctx.fillStyle = INK3; ctx.fillRect(X(x) - 4, Y(y) - 4, 8, 8); } });
    const [px, py, gx, gy] = v.p;
    v.opts.forEach(([x, y, fatal], i) => { if (i !== v.pick) { if (fatal) ctx.setLineDash([3, 3]); ray(ctx, X(px), Y(py), X(x), Y(y), fatal ? RED : "#9aa3ad", 1); ctx.setLineDash([]); } });
    if (v.pick >= 0) { const [x, y] = v.opts[v.pick]; ray(ctx, X(px), Y(py), X(x), Y(y), ACCENT, 2.5, true); }
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
    if (v.aim) { ctx.setLineDash([3, 3]); ray(ctx, X(px), Y(py), X(v.aim[0]), Y(v.aim[1]), BLUE, 1.2); ctx.setLineDash([]); }
    const scores = v.dirs.map(d => d[2]), lo = Math.min(...scores), hi = Math.max(...scores);
    v.dirs.forEach(([dx, dy, s], i) => {
      const len = 6 + 22 * (s - lo) / ((hi - lo) || 1);
      ray(ctx, X(px), Y(py), X(px) + dx * len, Y(py) + dy * len, i === v.pick ? ACCENT : "#9aa3ad", i === v.pick ? 2.5 : 1.2, i === v.pick);
    });
    dot(ctx, X(px), Y(py), 4, INK);
  },
};
function initPolicies(index) {
  const video = $("#pv-video"), kb = buildKeyboard($("#pv-kb")), ms = buildMouse($("#pv-ms"));
  const pointer = pointerLayer($("#pv-cursor"), $("#pv-ripple")), scroller = $("#code-scroll"), code = $("#code");
  const cache = {};
  let T = null, rows = {}, assign = {}, prevHit = new Set(), lastIdx = -1, userUntil = 0;
  $("#pv-tabs").innerHTML = index.map((g, i) => `<button data-i="${i}">${esc(g.title)}</button>`).join("");
  $("#pv-tabs").addEventListener("click", e => { const b = e.target.closest("button"); if (b) open(+b.dataset.i); });
  ["wheel", "pointerdown", "touchstart"].forEach(ev => scroller.addEventListener(ev, () => userUntil = performance.now() + 4000, { passive: true }));
  let mapH = 160;
  function layout() {
    const lw = fitBench($("#pv-bench"), $("#pv-left"), { perWidth: .5625 + .30 + .87 * kb.aspect, fixed: 36 + 10 + 10 + 12 });
    $("#pv-ms-box").style.width = Math.round(lw * .12) + "px";
    mapH = Math.round(lw * .30);
    $("#fields").style.height = mapH + "px";
  }
  async function open(i) {
    const g = index[i].game;
    document.querySelectorAll("#pv-tabs button").forEach(b => b.classList.toggle("on", +b.dataset.i === i));
    T = cache[g] = cache[g] || await load(`assets/policy/${g}.json`);
    setVideo(video, T.video); video.currentTime = 0; resume(); lastIdx = -1; prevHit = new Set();
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
    layout(); render(0);
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
    let focus = null;
    Object.entries(rows).forEach(([n, el]) => {
      n = +n; const on = hit.has(n);
      if (focus === null && on !== prevHit.has(n) && !blank(n)) focus = n;
      el.classList.toggle("hit", on); el.classList.toggle("last", n === c.last);
      el.classList.toggle("off", !on && !blank(n)); el.querySelector(".val").textContent = "";
    });
    prevHit = hit;
    const values = { ...c.v, ...(c.s || {}) };
    Object.entries(assign).forEach(([name, lines]) => {
      const done = lines.filter(n => hit.has(n)).pop();
      if (done && name in values) rows[done].querySelector(".val").textContent = showValue(values[name]);
    });
    // follow the code: keep the line where the path changed (or the return) in view
    const target = rows[focus ?? c.last];
    if (target && performance.now() > userUntil) {
      const top = target.offsetTop, h = scroller.clientHeight, st = scroller.scrollTop;
      if (top < st + h * .2 || top > st + h * .8) scroller.scrollTo({ top: top - h * .4, behavior: reduce ? "auto" : "smooth" });
    }
  }
  // What the policy read this step: a small map on the left, the fields that decide on the right.
  function probe(c) {
    const { ctx, w, h } = fit($("#pmap"), mapH);
    ctx.fillStyle = PANEL; ctx.fillRect(0, 0, w, h);
    if (c.view) (MAPS[T.game] || (() => {}))(ctx, w, h, c.view, T);
    const html = (c.fields || []).map(([k, v]) => `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join("");
    if (html !== $("#fields").dataset.html) { $("#fields").innerHTML = html; $("#fields").dataset.html = html; }
  }
  const resume = videoLoop(video, render, $("#pv-play"));
  scrubber($("#pv-scrub"), f => { if (!T) return; video.currentTime = f * T.duration; render(video.currentTime); });
  addEventListener("resize", () => { layout(); render(video.currentTime); });
  near($("#pv-bench"), () => open(0));   // the first trace is ~1 MB: fetch it on approach
}
