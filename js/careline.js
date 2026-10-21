/* CareLine Concierge — shared interactive modules
   dotField  : hero particle field (capsules split into dots near the cursor)
   usMap     : dot-matrix map of the US with state hover + active states
   caseFeed  : looping "live" case status demo
   reveals   : scroll reveals (GSAP + ScrollTrigger, graceful without)
*/
(function () {
  'use strict';
  const RM = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const CL = (window.CL = window.CL || {});
  CL.reducedMotion = RM;

  /* ---------- helpers ---------- */
  function sizeCanvas(c) {
    const r = c.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (c.width !== w * DPR || c.height !== h * DPR) { c.width = w * DPR; c.height = h * DPR; }
    return { w, h };
  }
  function hexToRgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(x => x + x).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function rgba(h, a) { const [r, g, b] = hexToRgb(h); return `rgba(${r},${g},${b},${a})`; }
  // small deterministic pseudo-random
  function prng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

  /* =====================================================================
     1. DOT FIELD — "many voices, one line"
     A phyllotaxis disc of navy capsules. Near the cursor every capsule
     splits into two dots that drift apart, then knit back together.
     One red dot sits at the centre and never moves: the line.
  ===================================================================== */
  CL.dotField = function (canvas, o) {
    o = Object.assign({ color: '#0F2A54', accent: '#D21A22', count: 1500, radius: 0.46, dot: 2.4, split: 150, text: null, shape: 'disc' }, o || {});
    const ctx = canvas.getContext('2d');
    let W = 0, H = 0, R = 0, cx = 0, cy = 0;
    const P = []; const rnd = prng(7);
    const mouse = { x: -9999, y: -9999, on: false, vx: 0, vy: 0, lx: 0, ly: 0 };
    let t0 = performance.now(), raf = 0, visible = true, alive = true;

    function layout() {
      ({ w: W, h: H } = sizeCanvas(canvas));
      R = Math.min(W, H) * o.radius; cx = W / 2; cy = H / 2;
      P.length = 0;
      const golden = Math.PI * (3 - Math.sqrt(5));
      const n = Math.round(o.count * Math.min(1, (W * H) / (1100 * 700)) ) || 300;
      for (let i = 0; i < n; i++) {
        const rr = Math.sqrt((i + 0.5) / n) * R;
        const th = i * golden;
        const x = cx + Math.cos(th) * rr, y = cy + Math.sin(th) * rr;
        const edge = rr / R; // 0 centre → 1 rim
        const r1 = rnd(), r2 = rnd(), r3 = rnd();
        // capsules are longer toward the rim, like a reaction-diffusion ring
        const len = r1 < 0.42 ? 0 : (6 + r2 * 16) * (0.35 + edge * 0.9);
        P.push({ hx: x, hy: y, x, y, vx: 0, vy: 0, len, ang: r3 * Math.PI * 2, s: 0, sz: o.dot * (0.75 + rnd() * 0.6), ph: rnd() * 6.28, edge });
      }
    }

    function frame(now) {
      if (!alive) return;
      raf = requestAnimationFrame(frame);
      if (!visible) return;
      const t = (now - t0) / 1000;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = o.color; ctx.strokeStyle = o.color; ctx.lineCap = 'round';
      const S = o.split, S2 = S * S;
      const speed = Math.min(1, Math.hypot(mouse.vx, mouse.vy) / 40);
      for (let i = 0; i < P.length; i++) {
        const p = P[i];
        // slow breathing drift
        const bx = Math.cos(t * 0.6 + p.ph) * 1.2, by = Math.sin(t * 0.5 + p.ph * 1.3) * 1.2;
        let tx = p.hx + bx, ty = p.hy + by;
        // repel from cursor
        let target = 0;
        if (mouse.on) {
          const dx = p.x - mouse.x, dy = p.y - mouse.y; const d2 = dx * dx + dy * dy;
          if (d2 < S2) {
            const d = Math.sqrt(d2) || 1; const f = (1 - d / S);
            target = f;
            tx += (dx / d) * f * f * 34 * (0.6 + speed);
            ty += (dy / d) * f * f * 34 * (0.6 + speed);
          }
        }
        // spring
        p.vx += (tx - p.x) * 0.06; p.vy += (ty - p.y) * 0.06;
        p.vx *= 0.82; p.vy *= 0.82;
        p.x += p.vx; p.y += p.vy;
        // split amount eases toward target
        p.s += (target - p.s) * (target > p.s ? 0.18 : 0.05);
        const sz = p.sz;
        if (p.len === 0) {
          ctx.beginPath(); ctx.arc(p.x, p.y, sz, 0, 6.283); ctx.fill();
        } else {
          const ca = Math.cos(p.ang), sa = Math.sin(p.ang);
          const half = p.len / 2;
          if (p.s < 0.02) {
            ctx.lineWidth = sz * 2;
            ctx.beginPath(); ctx.moveTo(p.x - ca * half, p.y - sa * half); ctx.lineTo(p.x + ca * half, p.y + sa * half); ctx.stroke();
          } else {
            // the split: one capsule becomes two dots flying apart
            const gap = half + p.s * (10 + p.len * 0.9);
            const r = sz * (1 + p.s * 0.25);
            ctx.beginPath(); ctx.arc(p.x - ca * gap, p.y - sa * gap, r, 0, 6.283); ctx.fill();
            ctx.beginPath(); ctx.arc(p.x + ca * gap, p.y + sa * gap, r, 0, 6.283); ctx.fill();
            if (p.s < 0.6) { // the bridge thins as it splits
              ctx.lineWidth = sz * 2 * (1 - p.s / 0.6);
              ctx.beginPath(); ctx.moveTo(p.x - ca * half * (1 - p.s), p.y - sa * half * (1 - p.s)); ctx.lineTo(p.x + ca * half * (1 - p.s), p.y + sa * half * (1 - p.s)); ctx.stroke();
            }
          }
        }
      }
      // the one line: a red dot with a soft pulse ring
      const pulse = (t % 2.4) / 2.4;
      ctx.fillStyle = o.accent;
      ctx.beginPath(); ctx.arc(cx, cy, o.dot * 2.6, 0, 6.283); ctx.fill();
      ctx.strokeStyle = rgba(o.accent, (1 - pulse) * 0.55); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, cy, o.dot * 2.6 + pulse * 28, 0, 6.283); ctx.stroke();
      mouse.vx *= 0.8; mouse.vy *= 0.8;
    }

    function staticFrame() { // reduced motion: draw once, no splitting
      ({ w: W, h: H } = sizeCanvas(canvas)); layout();
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = o.color; ctx.strokeStyle = o.color; ctx.lineCap = 'round';
      for (const p of P) {
        if (p.len === 0) { ctx.beginPath(); ctx.arc(p.x, p.y, p.sz, 0, 6.283); ctx.fill(); }
        else { const ca = Math.cos(p.ang), sa = Math.sin(p.ang), h = p.len / 2; ctx.lineWidth = p.sz * 2; ctx.beginPath(); ctx.moveTo(p.x - ca * h, p.y - sa * h); ctx.lineTo(p.x + ca * h, p.y + sa * h); ctx.stroke(); }
      }
      ctx.fillStyle = o.accent; ctx.beginPath(); ctx.arc(cx, cy, o.dot * 2.6, 0, 6.283); ctx.fill();
    }

    function onMove(e) {
      const r = canvas.getBoundingClientRect();
      const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left, y = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
      mouse.vx = x - mouse.lx; mouse.vy = y - mouse.ly; mouse.lx = x; mouse.ly = y;
      mouse.x = x; mouse.y = y; mouse.on = true;
    }
    function onLeave() { mouse.on = false; mouse.x = mouse.y = -9999; }

    if (RM) { staticFrame(); window.addEventListener('resize', staticFrame); return { destroy() { window.removeEventListener('resize', staticFrame); } }; }
    layout();
    const host = canvas.parentElement || canvas;
    host.addEventListener('pointermove', onMove, { passive: true });
    host.addEventListener('pointerleave', onLeave);
    host.addEventListener('touchmove', onMove, { passive: true });
    host.addEventListener('touchend', onLeave);
    window.addEventListener('resize', layout);
    if ('IntersectionObserver' in window) new IntersectionObserver(en => { visible = en[0].isIntersecting; }).observe(canvas);
    raf = requestAnimationFrame(frame);
    return { destroy() { alive = false; cancelAnimationFrame(raf); window.removeEventListener('resize', layout); } };
  };

  /* =====================================================================
     2. US MAP — dot matrix, state hover, active states
     Needs window.US_DOTS (generated from the state SVG).
  ===================================================================== */
  CL.usMap = function (root, o) {
    o = Object.assign({
      base: '#0F2A54', baseAlpha: 0.34, active: '#D21A22', hq: 'ny',
      activeStates: ['ny'], soonStates: [], label: null, dot: 2.6,
      onHover: null, legend: true, repel: 70,
      labels: { hq: 'Headquarters', active: 'Active', soon: 'Coming soon', none: 'Available on request' }
    }, o || {});
    const data = window.US_DOTS; if (!data) return;
    const canvas = root.querySelector('canvas') || root.appendChild(document.createElement('canvas'));
    const label = o.label || root.querySelector('[data-map-label]');
    const ctx = canvas.getContext('2d');
    const act = new Set(o.activeStates.map(s => s.toLowerCase()));
    const soon = new Set(o.soonStates.map(s => s.toLowerCase()));
    let W = 0, H = 0, sc = 1, ox = 0, oy = 0, hover = null, raf = 0, alive = true, visible = true, born = performance.now();
    const pts = data.dots.map(d => ({ ux: d[0], uy: d[1], s: d[2], x: 0, y: 0, hx: 0, hy: 0, vx: 0, vy: 0, k: 0 }));
    const mouse = { x: -9999, y: -9999, on: false };
    const hq = data.states[o.hq];

    function layout() {
      ({ w: W, h: H } = sizeCanvas(canvas));
      const pad = 10;
      sc = Math.min((W - pad * 2) / data.w, (H - pad * 2) / data.h);
      ox = (W - data.w * sc) / 2; oy = (H - data.h * sc) / 2;
      for (const p of pts) { p.hx = ox + p.ux * sc; p.hy = oy + p.uy * sc; if (!p.x) { p.x = p.hx; p.y = p.hy; } }
      // distance from HQ, for the birth wave
      const hx = ox + (hq ? hq.cx : data.w / 2) * sc, hy = oy + (hq ? hq.cy : data.h / 2) * sc;
      for (const p of pts) p.k = Math.hypot(p.hx - hx, p.hy - hy);
    }

    function nearestState(x, y) {
      let best = null, bd = (o.dot * sc * 5 + 6) ** 2;
      for (const p of pts) { const d = (p.hx - x) ** 2 + (p.hy - y) ** 2; if (d < bd) { bd = d; best = p.s; } }
      return best;
    }

    function draw(now) {
      if (!alive) return; raf = requestAnimationFrame(draw); if (!visible) return;
      const age = (now - born) / 1000;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, H);
      const R = o.repel, R2 = R * R;
      const t = now / 1000;
      for (const p of pts) {
        // birth wave from HQ
        const a = RM ? 1 : Math.max(0, Math.min(1, (age * 900 - p.k) / 240));
        if (a <= 0) continue;
        let tx = p.hx, ty = p.hy;
        if (!RM && mouse.on) {
          const dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;
          if (d2 < R2) { const d = Math.sqrt(d2) || 1, f = 1 - d / R; tx += dx / d * f * f * 16; ty += dy / d * f * f * 16; }
        }
        if (!RM) { p.vx += (tx - p.x) * 0.1; p.vy += (ty - p.y) * 0.1; p.vx *= 0.75; p.vy *= 0.75; p.x += p.vx; p.y += p.vy; } else { p.x = tx; p.y = ty; }
        const isAct = act.has(p.s), isSoon = soon.has(p.s), isHov = hover === p.s;
        let r = o.dot * sc * 1.05 * (0.6 + a * 0.4);
        if (isHov) r *= 1.5;
        if (isAct) { ctx.fillStyle = rgba(o.active, isHov ? 1 : 0.92); }
        else if (isSoon) { ctx.fillStyle = rgba(o.active, isHov ? 0.75 : 0.45); }
        else { ctx.fillStyle = rgba(o.base, isHov ? Math.min(1, o.baseAlpha + 0.45) : o.baseAlpha * a); }
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.283); ctx.fill();
      }
      // HQ pulse
      if (hq && age > 0.2 && !RM) {
        const hx = ox + hq.cx * sc, hy = oy + hq.cy * sc; const ph = (t % 2.2) / 2.2;
        ctx.strokeStyle = rgba(o.active, (1 - ph) * 0.6); ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(hx, hy, 6 + ph * 26, 0, 6.283); ctx.stroke();
      }
    }

    function onMove(e) {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.on = true;
      const s = nearestState(mouse.x, mouse.y);
      if (s !== hover) {
        hover = s;
        if (label) {
          if (s) {
            const st = data.states[s];
            const L = o.labels; const status = act.has(s) ? (s === o.hq ? L.hq : L.active) : soon.has(s) ? L.soon : L.none;
            label.innerHTML = `<b>${st.name}</b><span>${status}</span>`;
            label.dataset.status = act.has(s) ? 'active' : soon.has(s) ? 'soon' : 'none';
            label.classList.add('is-on');
          } else label.classList.remove('is-on');
        }
        if (o.onHover) o.onHover(s, s ? data.states[s] : null);
        canvas.style.cursor = s ? 'crosshair' : 'default';
      }
      if (label && s) { label.style.left = (mouse.x + 16) + 'px'; label.style.top = (mouse.y - 14) + 'px'; }
    }
    function onLeave() { mouse.on = false; mouse.x = mouse.y = -9999; hover = null; if (label) label.classList.remove('is-on'); if (o.onHover) o.onHover(null, null); }

    layout(); window.addEventListener('resize', layout);
    canvas.addEventListener('pointermove', onMove, { passive: true });
    canvas.addEventListener('pointerleave', onLeave);
    if ('IntersectionObserver' in window) new IntersectionObserver(en => { if (en[0].isIntersecting && !visible) born = performance.now(); visible = en[0].isIntersecting; }, { threshold: 0.15 }).observe(canvas);
    born = performance.now() + 300;
    raf = requestAnimationFrame(draw);
    return { destroy() { alive = false; cancelAnimationFrame(raf); window.removeEventListener('resize', layout); } };
  };

  /* =====================================================================
     3. CASE FEED — a looping "live" status demo
     Markup contract (inside root):
       [data-feed-clock]      running time (HH:MM AM/PM)
       [data-feed-from]       caller
       [data-feed-room]       room / relationship
       [data-feed-msg]        the message (typed in)
       [data-feed-steps]      container; we render steps inside
       [data-feed-elapsed]    "resolved in 17 min"
       [data-feed-index]      "case 1 of 4"
  ===================================================================== */
  CL.CASES = [
    { time: '10:10 AM', from: 'Resident, Room 118', via: 'Call', msg: "I am a resident at the facility and I did not receive my breakfast yet and it's almost 10:15 am.",
      steps: [['Received', 'Call answered by CareLine'], ['Documented', 'Concern logged and the delay noted'], ['Routed', 'Dietary department notified'], ['In Progress', 'Dietary is sending an alternative meal to her room immediately'], ['Resolved', 'Breakfast delivered 10 minutes later. She was thankful for the quick response.']], elapsed: 'Resolved in 10 minutes' },
    { time: '4:05 PM', from: 'Daughter of resident, Room 201', via: 'Text', msg: "I'm reaching out to confirm that transportation has been arranged for my dad's appointment tomorrow and that someone will be available to accompany him.",
      steps: [['Received', 'Text answered by CareLine'], ['Documented', 'Request recorded and the appointment time confirmed'], ['Routed', 'Transportation coordinator contacted for assistance'], ['In Progress', 'Transportation verified; staff to accompany him being coordinated'], ['Resolved', '30 minutes later, daughter updated by phone that all logistics are finalized and her father will be well cared for']], elapsed: 'Resolved in 30 minutes' },
    { time: '9:30 PM', from: 'Wife of resident, Room 121', via: 'Call', msg: "My husband called to tell me that they don't have his medications in stock and they're not giving him an alternative.",
      steps: [['Received', 'Call answered by CareLine'], ['Documented', 'Medication concern documented'], ['Routed', 'Escalated directly to the Nurse Supervisor on-call'], ['In Progress', 'RN Supervisor is on the unit and speaking with the doctor about an alternative now'], ['Resolved', 'Supervisor called the wife to confirm an alternative medication was given. Her husband is very happy.']], elapsed: 'Resolved the same evening' },
    { time: '2:30 AM', from: 'Son of resident, Room 211', via: 'Text', msg: "My mom says she has been pressing her call bell for approximately 30 minutes requesting assistance with using the restroom, but no one has come to help her.",
      steps: [['Received', 'Text answered by CareLine'], ['Documented', 'Wait time and lack of response recorded for visibility and accountability'], ['Routed', 'Nurse Supervisor on-call contacted directly'], ['In Progress', 'Nursing staff directed to provide prompt attention and assistance'], ['Resolved', 'The resident called her son back: she received immediate help, and CareLine made all the difference.']], elapsed: 'Resolved within minutes' }
  ];

  CL.caseFeed = function (root, o) {
    o = Object.assign({ cases: CL.CASES, hold: 5, stepGap: 1.8, typeSpeed: 0.03 }, o || {});
    const q = s => root.querySelector(s);
    const clock = q('[data-feed-clock]'), from = q('[data-feed-from]'), via = q('[data-feed-via]'), msg = q('[data-feed-msg]'), steps = q('[data-feed-steps]'), elapsed = q('[data-feed-elapsed]'), index = q('[data-feed-index]');
    let i = 0, timer = 0, alive = true;
    const hasGsap = !!window.gsap;

    function render(c) {
      if (clock) clock.textContent = c.time;
      if (from) from.textContent = c.from;
      if (via) via.textContent = c.via;
      if (index) index.textContent = `Case ${i + 1} of ${o.cases.length}`;
      if (elapsed) { elapsed.textContent = c.elapsed; elapsed.style.opacity = 0; }
      if (msg) msg.textContent = '';
      if (steps) {
        steps.innerHTML = c.steps.map((s, k) => `<li class="fs" data-k="${k}"><span class="fs-dot"></span><span class="fs-t"><b>${s[0]}:</b><em>${s[1]}</em></span></li>`).join('');
      }
    }

    function play() {
      if (!alive) return;
      const c = o.cases[i]; render(c);
      const items = steps ? [...steps.querySelectorAll('.fs')] : [];
      if (RM || !hasGsap) {
        if (msg) msg.textContent = '\u201C' + c.msg + '\u201D'; items.forEach(el => el.classList.add('is-done')); if (elapsed) elapsed.style.opacity = 1;
        timer = setTimeout(() => { i = (i + 1) % o.cases.length; play(); }, 6000); return;
      }
      const tl = gsap.timeline({ onComplete() { i = (i + 1) % o.cases.length; play(); } });
      // type the message
      const text = '\u201C' + c.msg + '\u201D'; const n = text.length; const prox = { k: 0 };
      tl.to(prox, { k: n, duration: n * o.typeSpeed, ease: 'none', onUpdate() { msg.textContent = text.slice(0, Math.round(prox.k)); } });
      tl.to({}, { duration: 0.5 });
      items.forEach((el, k) => {
        tl.add(() => { el.classList.add('is-on'); if (k > 0) items[k - 1].classList.add('is-done'); }, '+=' + (k === 0 ? 0 : o.stepGap));
      });
      tl.add(() => { items[items.length - 1].classList.add('is-done'); root.classList.add('is-resolved'); }, '+=' + o.stepGap);
      if (elapsed) tl.to(elapsed, { opacity: 1, duration: 0.5 });
      tl.to({}, { duration: o.hold });
      tl.add(() => root.classList.remove('is-resolved'));
      tl.to(root, { opacity: 0, duration: 0.35 }); tl.set(root, { opacity: 1 });
    }
    play();
    return { destroy() { alive = false; clearTimeout(timer); } };
  };

  /* =====================================================================
     4. Reveals, nav, video loaders, live clock
  ===================================================================== */
  CL.reveals = function () {
    const els = document.querySelectorAll('[data-rv]'), heads = document.querySelectorAll('[data-lines]');
    if (!window.gsap || RM) { els.forEach(el => el.classList.add('rv-in')); return; }
    // IntersectionObserver rather than scroll position: plays whatever direction the element enters from,
    // including a page restored mid-scroll, and never leaves a headline stuck hidden.
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        const el = en.target; io.unobserve(el);
        if (el.hasAttribute('data-lines')) {
          gsap.to(el.querySelectorAll('.ln > span'), { yPercent: 0, duration: 1.2, ease: 'power4.out', stagger: 0.1 });
        } else {
          const kids = el.hasAttribute('data-rv-stagger') ? el.children : [el];
          gsap.to(kids, { opacity: 1, y: 0, duration: 1.1, ease: 'power3.out', stagger: 0.09 });
        }
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.01 });
    els.forEach(el => { gsap.set(el.hasAttribute('data-rv-stagger') ? el.children : [el], { opacity: 0, y: 26 }); io.observe(el); });
    heads.forEach(h => { const spans = h.querySelectorAll('.ln > span'); if (!spans.length) return; gsap.set(spans, { yPercent: 110 }); io.observe(h); });
  };

  CL.nav = function () {
    const h = document.querySelector('header'); if (!h) return;
    const on = () => h.classList.toggle('on', window.scrollY > 24);
    on(); window.addEventListener('scroll', on, { passive: true });
    const btn = document.querySelector('[data-menu]'); const menu = document.querySelector('[data-menu-panel]');
    if (btn && menu) btn.addEventListener('click', () => { const open = menu.classList.toggle('open'); btn.setAttribute('aria-expanded', open); document.body.classList.toggle('menu-open', open); });
    if (menu) menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => { menu.classList.remove('open'); document.body.classList.remove('menu-open'); }));
  };

  CL.videos = function () {
    document.querySelectorAll('[data-vimeo]').forEach(box => {
      const id = box.dataset.vimeo; const btn = box.querySelector('button');
      const load = () => {
        const f = document.createElement('iframe');
        f.src = `https://player.vimeo.com/video/${id}?autoplay=1&title=0&byline=0&portrait=0&color=D21A22`;
        f.allow = 'autoplay; fullscreen; picture-in-picture'; f.allowFullscreen = true; f.title = box.dataset.title || 'CareLine video';
        box.classList.add('is-playing'); box.appendChild(f);
      };
      (btn || box).addEventListener('click', load, { once: true });
    });
  };

  CL.clock = function () {
    const els = document.querySelectorAll('[data-clock]'); if (!els.length) return;
    const tick = () => { const d = new Date(); let h = d.getHours(), m = d.getMinutes(); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; els.forEach(e => e.textContent = `${h}:${String(m).padStart(2, '0')} ${ap}`); };
    tick(); setInterval(tick, 15000);
  };

  CL.form = function () {
    const f = document.querySelector('form[data-mailto]'); if (!f) return;
    f.addEventListener('submit', e => {
      e.preventDefault();
      const d = new FormData(f); const to = f.dataset.mailto;
      const subj = encodeURIComponent(`CareLine demo — ${d.get('facility') || d.get('name') || ''}`);
      const body = encodeURIComponent([`Name: ${d.get('name') || ''}`, `Facility: ${d.get('facility') || ''}`, `Email: ${d.get('email') || ''}`, `Phone: ${d.get('phone') || ''}`, '', d.get('message') || ''].join('\n'));
      window.location.href = `mailto:${to}?subject=${subj}&body=${body}`;
      const ok = f.querySelector('[data-form-ok]'); if (ok) ok.hidden = false;
    });
  };

  CL.boot = function () { CL.nav(); CL.videos(); CL.clock(); CL.form(); CL.reveals(); };
})();
