/*
 * Custom cursor + square-dot trail, shared by every page.
 *
 * Cursor: an 18px white rounded square with mix-blend-mode: exclusion
 * (the Moto Studios style). Over a link it slides out a coloured label
 * tag to its left, showing the link's data-cursor-label (or its text).
 *
 * Trail: small squares snapped to a 10px pixel grid fall off the cursor,
 * shrink in hard pixel steps and drift. Faster movement leaves more,
 * brighter dots. Clicking releases a ring of squares that expand
 * outwards on the same grid.
 */
(function () {
  if (!window.matchMedia || !window.matchMedia('(pointer: fine)').matches) return;
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var GRID = 10;
  var SIZE = 18;
  var TAG_COLORS = ['#ffc857', '#9fb4e6', '#f4f1e8', '#e8a27c'];
  var DOT_COLORS = ['#ffffff', '#ffc857', '#9fb4e6', '#f4f1e8'];

  var css = [
    'html.bb-cursor, html.bb-cursor * { cursor: none !important; }',
    '.bb-cursor-el { position: fixed; top: 0; left: 0; width: 18px; height: 18px; z-index: 100000; pointer-events: none; opacity: 0; transition: opacity 0.2s ease; will-change: transform; }',
    '.bb-cursor-el.is-visible { opacity: 1; }',
    '.bb-cursor-dot { position: fixed; top: 0; left: 0; width: 18px; height: 18px; z-index: 100001; pointer-events: none; opacity: 0; transition: opacity 0.2s ease; mix-blend-mode: exclusion; will-change: transform; }',
    '.bb-cursor-dot.is-visible { opacity: 1; }',
    '.bb-cursor-dot span { position: absolute; inset: 0; background: #fff; border-radius: 5px; transition: transform 0.25s cubic-bezier(0.22, 1, 0.36, 1); }',
    '.bb-cursor-dot.is-down span { transform: scale(0.6); }',
    '.bb-cursor-tag { position: absolute; top: 50%; right: 26px; margin-top: -0.85em; padding: 5px 0; overflow: hidden; white-space: nowrap; text-align: center; width: 0; opacity: 0;',
    '  font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 15px; font-weight: 500; line-height: 1.2; letter-spacing: -0.01em; color: #090909;',
    '  transition: width 0.4s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.2s ease, background-color 0.2s ease; }',
    '.bb-cursor-el.is-tagged .bb-cursor-tag { opacity: 1; }',
    '.bb-cursor-word { display: inline-block; transform: translateX(100%); transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1); }',
    '.bb-cursor-el.is-tagged .bb-cursor-word { transform: translateX(0); }',
    '.bb-cursor-ruler { position: absolute; visibility: hidden; white-space: nowrap; font: inherit; }',
    '.bb-cursor-trail { position: fixed; inset: 0; width: 100%; height: 100%; z-index: 99999; pointer-events: none; mix-blend-mode: exclusion; }'
  ].join('\n');

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  document.documentElement.classList.add('bb-cursor');

  var el = document.createElement('div');
  el.className = 'bb-cursor-el';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<span class="bb-cursor-tag"><span class="bb-cursor-word"></span></span>';
  document.body.appendChild(el);
  // The square lives in its own layer so mix-blend-mode reaches the page.
  var dot = document.createElement('div');
  dot.className = 'bb-cursor-dot';
  dot.setAttribute('aria-hidden', 'true');
  dot.innerHTML = '<span></span>';
  document.body.appendChild(dot);
  var tag = el.querySelector('.bb-cursor-tag');
  var word = el.querySelector('.bb-cursor-word');
  var ruler = document.createElement('span');
  ruler.className = 'bb-cursor-ruler';
  tag.appendChild(ruler);

  var canvas = document.createElement('canvas');
  canvas.className = 'bb-cursor-trail';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  var ctx = canvas.getContext('2d');
  var dpr = 1;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }
  resize();
  window.addEventListener('resize', resize);

  // Cursor follows the pointer with a light ease.
  var mouseX = -100, mouseY = -100, curX = -100, curY = -100;
  var lastSpawnX = null, lastSpawnY = null;
  var seen = false;

  window.addEventListener('mousemove', function (e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
    if (!seen) {
      seen = true;
      curX = mouseX;
      curY = mouseY;
      el.classList.add('is-visible');
      dot.classList.add('is-visible');
    }
    if (!reducedMotion) spawnTrail(e);
  }, { passive: true });

  document.addEventListener('mouseleave', function () { el.classList.remove('is-visible'); dot.classList.remove('is-visible'); seen = false; });
  document.addEventListener('mouseenter', function () { el.classList.add('is-visible'); dot.classList.add('is-visible'); });
  window.addEventListener('mousedown', function () {
    dot.classList.add('is-down');
    if (!reducedMotion) burst(mouseX, mouseY);
  });
  window.addEventListener('mouseup', function () { dot.classList.remove('is-down'); });

  // Label tag over links.
  var colorIndex = 0;
  function showTag(target) {
    var label = target.getAttribute('data-cursor-label') || (target.textContent || '').trim();
    if (!label) return;
    label = label.length > 28 ? label.slice(0, 27) + '…' : label;
    ruler.textContent = label;
    word.textContent = label;
    tag.style.backgroundColor = TAG_COLORS[colorIndex++ % TAG_COLORS.length];
    tag.style.width = (ruler.offsetWidth + 22) + 'px';
    el.classList.add('is-tagged');
  }
  function hideTag() {
    tag.style.width = '0px';
    el.classList.remove('is-tagged');
  }
  document.addEventListener('mouseover', function (e) {
    var link = e.target.closest && e.target.closest('a, button, .cursor-link');
    if (link) showTag(link);
  });
  document.addEventListener('mouseout', function (e) {
    var link = e.target.closest && e.target.closest('a, button, .cursor-link');
    if (link && !link.contains(e.relatedTarget)) hideTag();
  });

  // Trail particles: grid-snapped squares that shrink in pixel steps.
  var particles = [];
  var MAX_PARTICLES = 320;

  function snap(v) { return Math.round(v / GRID) * GRID; }

  function addParticle(x, y, vx, vy, size, life, color) {
    if (particles.length >= MAX_PARTICLES) particles.shift();
    particles.push({ x: x, y: y, vx: vx, vy: vy, size: size, life: life, age: 0, color: color });
  }

  function spawnTrail(e) {
    if (lastSpawnX === null) { lastSpawnX = mouseX; lastSpawnY = mouseY; return; }
    var dx = mouseX - lastSpawnX, dy = mouseY - lastSpawnY;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < GRID) return;
    var steps = Math.min(Math.floor(dist / GRID), 8);
    var speed = Math.min(dist / 40, 1);
    for (var i = 1; i <= steps; i++) {
      var t = i / steps;
      var px = snap(lastSpawnX + dx * t + (Math.random() - 0.5) * GRID * 2);
      var py = snap(lastSpawnY + dy * t + (Math.random() - 0.5) * GRID * 2);
      var size = Math.random() < 0.25 + speed * 0.4 ? 8 : 5;
      var color = Math.random() < 0.7 ? DOT_COLORS[0] : DOT_COLORS[1 + ((Math.random() * 3) | 0)];
      addParticle(px, py, -dx / dist * 0.25 + (Math.random() - 0.5) * 0.35, 0.2 + Math.random() * 0.4, size, 650 + Math.random() * 500, color);
    }
    lastSpawnX = mouseX;
    lastSpawnY = mouseY;
  }

  function burst(x, y) {
    var count = 24;
    for (var i = 0; i < count; i++) {
      var a = (i / count) * Math.PI * 2;
      var sp = 3.6 + Math.random() * 2.4;
      addParticle(snap(x), snap(y), Math.cos(a) * sp, Math.sin(a) * sp, 9, 750 + Math.random() * 300, DOT_COLORS[i % DOT_COLORS.length]);
    }
  }

  var last = performance.now();
  function frame(now) {
    var dt = Math.min(now - last, 50);
    last = now;

    curX += (mouseX - curX) * 0.35;
    curY += (mouseY - curY) * 0.35;
    var t = 'translate(' + (curX - SIZE / 2) + 'px, ' + (curY - SIZE / 2) + 'px)';
    el.style.transform = t;
    dot.style.transform = t;

    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.age += dt;
      if (p.age >= p.life) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt / 16;
      p.y += p.vy * dt / 16;
      p.vx *= 0.96;
      p.vy *= 0.96;
      var k = p.age / p.life;
      // Shrink in whole-pixel steps so the decay reads as "pixelated".
      var s = Math.max(1, Math.ceil(p.size * (1 - k)));
      ctx.globalAlpha = k < 0.7 ? 1 : (1 - k) / 0.3;
      ctx.fillStyle = p.color;
      ctx.fillRect(snap(p.x) - s / 2, snap(p.y) - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
