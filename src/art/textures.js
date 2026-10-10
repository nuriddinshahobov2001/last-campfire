// All game art is drawn in code on canvas textures (no image files).
// Characters face +x; the sprite is rotated toward its target at runtime.
(function () {
  const R = (globalThis.Rassvet = globalThis.Rassvet || {});

  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);

  function canvasTex(scene, key, w, h, draw) {
    const tex = scene.textures.createCanvas(key, w, h);
    draw(tex.getContext(), w, h);
    tex.refresh();
  }

  function radial(ctx, x, y, r0, r1, stops) {
    const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
    for (const [o, c] of stops) g.addColorStop(o, c);
    return g;
  }

  function linear(ctx, x0, y0, x1, y1, stops) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    for (const [o, c] of stops) g.addColorStop(o, c);
    return g;
  }

  function blob(ctx, cx, cy, rx, ry, fill, stroke, lw) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.lineWidth = lw || 1.5;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  }

  function roundRect(ctx, x, y, w, h, r, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  }

  function limb(ctx, x0, y0, x1, y1, width, color, outline) {
    ctx.lineCap = 'round';
    if (outline) {
      ctx.strokeStyle = outline;
      ctx.lineWidth = width + 2.5;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }

  function poly(ctx, pts, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  }

  function softShadow(ctx, cx, cy, r) {
    ctx.fillStyle = radial(ctx, cx, cy, r * 0.25, r, [
      [0, 'rgba(0,0,0,0.5)'],
      [1, 'rgba(0,0,0,0)'],
    ]);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.fill();
  }

  function glowDot(ctx, x, y, r, color) {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = r * 3.5;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // ---- characters -------------------------------------------------------

  function drawPlayer(ctx) {
    softShadow(ctx, 24, 24, 24);
    roundRect(ctx, 5, 14, 11, 20, 4, '#3a4a38', '#1b251a'); // backpack
    limb(ctx, 26, 15, 41, 23, 6, '#2c74b8', '#173a5e'); // arms
    limb(ctx, 26, 33, 38, 27, 6, '#2c74b8', '#173a5e');
    // rifle
    roundRect(ctx, 30, 21.5, 24, 6.5, 2, linear(ctx, 0, 21, 0, 28, [[0, '#dde4ec'], [1, '#59626e']]), '#222a33');
    ctx.fillStyle = '#23292f';
    ctx.fillRect(50, 21, 5, 7.5);
    blob(ctx, 41, 23, 3.3, 3.3, '#f0c8a0', '#a8764a', 1); // hands
    blob(ctx, 37, 27, 3.3, 3.3, '#f0c8a0', '#a8764a', 1);
    // torso
    blob(ctx, 22, 24, 10, 17, radial(ctx, 19, 19, 2, 20, [[0, '#86d4ff'], [1, '#2a6fb0']]), '#173a5e', 1.5);
    // helmet
    blob(ctx, 24, 24, 8.5, 8.5, radial(ctx, 21, 20, 1, 10, [[0, '#7384a0'], [1, '#2a3446']]), '#121820', 1.5);
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(24, 24, 5.5, Math.PI * 0.95, Math.PI * 1.55);
    ctx.stroke();
    roundRect(ctx, 28.5, 20.5, 3.5, 7, 1.5, '#9be4ff', '#3a6a82'); // visor
  }

  function drawWalker(ctx) {
    softShadow(ctx, 22, 22, 21);
    limb(ctx, 22, 11, 40, 15, 6, '#4f8a49', '#25451f'); // reaching arms
    limb(ctx, 22, 33, 40, 29, 6, '#4f8a49', '#25451f');
    blob(ctx, 40.5, 15, 3.5, 3.5, '#a8d99a', '#3b6a34', 1);
    blob(ctx, 40.5, 29, 3.5, 3.5, '#a8d99a', '#3b6a34', 1);
    blob(ctx, 20, 22, 12, 15.5, radial(ctx, 17, 17, 2, 20, [[0, '#9ad88a'], [1, '#3f7a3a']]), '#1f3d1b', 1.5);
    ctx.fillStyle = 'rgba(30,50,25,0.55)'; // torn cloth
    ctx.beginPath();
    ctx.ellipse(16, 16, 4, 3, 0.5, 0, TAU);
    ctx.ellipse(18, 29, 5, 3, -0.4, 0, TAU);
    ctx.fill();
    blob(ctx, 26, 22, 8.5, 8.5, radial(ctx, 23, 19, 1, 10, [[0, '#b7e8a8'], [1, '#5c9a55']]), '#27481f', 1.5);
    glowDot(ctx, 30.5, 19, 1.9, '#ff3b3b');
    glowDot(ctx, 30.5, 25, 1.9, '#ff3b3b');
    ctx.strokeStyle = '#1c3217';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(32, 21);
    ctx.lineTo(32.5, 23);
    ctx.stroke();
  }

  function drawRunner(ctx) {
    softShadow(ctx, 18, 18, 17);
    for (const y of [10, 26]) {
      // long claws
      limb(ctx, 16, y + 2, 32, y + (y < 18 ? 3 : -1), 3.5, '#b8501a', '#5a240a');
      poly(ctx, [[32, y + (y < 18 ? 1 : -3)], [35.5, y + (y < 18 ? 3 : -1)], [32, y + (y < 18 ? 5 : 1)]], '#f4e2c4', '#6a4a24');
    }
    // back spikes
    for (const [x, y, a] of [[7, 10, -0.9], [5, 18, 0], [7, 26, 0.9]]) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI + a);
      poly(ctx, [[0, -2.5], [8, 0], [0, 2.5]], '#7a2a0c', '#3a1204');
      ctx.restore();
    }
    blob(ctx, 17, 18, 11, 8.5, radial(ctx, 14, 14, 1, 14, [[0, '#ffa55a'], [1, '#c4561c']]), '#5a240a', 1.5);
    blob(ctx, 25, 18, 6, 5.5, radial(ctx, 23, 16, 1, 7, [[0, '#ffc07a'], [1, '#d9692a']]), '#5a240a', 1.5);
    glowDot(ctx, 28, 16.2, 1.4, '#fff06a');
    glowDot(ctx, 28, 19.8, 1.4, '#fff06a');
  }

  function drawBrute(ctx) {
    softShadow(ctx, 35, 35, 34);
    // back spikes
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * 0.62 + (i / 6) * Math.PI * 0.76;
      ctx.save();
      ctx.translate(35 + Math.cos(a) * 20, 35 + Math.sin(a) * 20);
      ctx.rotate(a);
      poly(ctx, [[0, -3.5], [9, 0], [0, 3.5]], '#3c1850', '#1a0826');
      ctx.restore();
    }
    limb(ctx, 38, 17, 56, 20, 11, '#6a2f7c', '#2a0e38'); // arms + fists
    limb(ctx, 38, 53, 56, 50, 11, '#6a2f7c', '#2a0e38');
    blob(ctx, 58, 20, 8, 8, radial(ctx, 55, 17, 1, 10, [[0, '#a05ab8'], [1, '#55246a']]), '#2a0e38', 1.5);
    blob(ctx, 58, 50, 8, 8, radial(ctx, 55, 47, 1, 10, [[0, '#a05ab8'], [1, '#55246a']]), '#2a0e38', 1.5);
    blob(ctx, 33, 35, 24, 25, radial(ctx, 26, 27, 3, 32, [[0, '#a866c0'], [1, '#4a1c5e']]), '#240a32', 2);
    for (const y of [15, 55]) blob(ctx, 36, y, 12, 9, radial(ctx, 33, y - 3, 1, 13, [[0, '#8a8f9c'], [1, '#444955']]), '#1c1f26', 1.5); // shoulder plates
    ctx.strokeStyle = 'rgba(20,6,30,0.65)'; // cracks
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(18, 30);
    ctx.lineTo(25, 36);
    ctx.lineTo(21, 44);
    ctx.moveTo(25, 36);
    ctx.lineTo(33, 38);
    ctx.stroke();
    // horns
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.translate(46, 35 + s * 10);
      ctx.rotate(s * 0.55);
      poly(ctx, [[-2, -4 * s], [12, s * 3], [-2, 4 * s]].map(([x, y]) => [x, y]), '#efe6cf', '#6a5a3a');
      ctx.restore();
    }
    blob(ctx, 43, 35, 11, 11, radial(ctx, 40, 31, 1, 13, [[0, '#b878d0'], [1, '#5a2670']]), '#240a32', 1.8);
    glowDot(ctx, 49, 31.5, 2.4, '#ff3030');
    glowDot(ctx, 49, 38.5, 2.4, '#ff3030');
    ctx.strokeStyle = '#1a0626';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(50, 33.5);
    ctx.lineTo(51, 36.5);
    ctx.stroke();
  }

  function drawBoss(ctx) {
    softShadow(ctx, 60, 60, 58);
    // back spikes
    for (let i = 0; i < 9; i++) {
      const a = Math.PI * 0.6 + (i / 8) * Math.PI * 0.8;
      ctx.save();
      ctx.translate(60 + Math.cos(a) * 34, 60 + Math.sin(a) * 34);
      ctx.rotate(a);
      poly(ctx, [[0, -6], [18, 0], [0, 6]], '#2a0a0a', '#0e0202');
      ctx.restore();
    }
    // arms with clawed fists
    limb(ctx, 66, 26, 100, 30, 16, '#8a1f1f', '#2a0606');
    limb(ctx, 66, 94, 100, 90, 16, '#8a1f1f', '#2a0606');
    for (const y of [30, 90]) {
      blob(ctx, 104, y, 12, 12, radial(ctx, 100, y - 3, 1, 14, [[0, '#d24a3a'], [1, '#6a1212']]), '#2a0606', 2);
      for (const d of [-6, 0, 6]) poly(ctx, [[112, y + d - 2], [124, y + d], [112, y + d + 2]], '#f4ecd6', '#6a5a3a');
    }
    // body
    blob(ctx, 56, 60, 40, 42, radial(ctx, 44, 44, 4, 56, [[0, '#d8483a'], [0.55, '#8a1c1c'], [1, '#2e0707']]), '#1a0303', 2.5);
    // shoulder armour
    for (const y of [26, 94]) {
      blob(ctx, 62, y, 20, 14, radial(ctx, 58, y - 4, 1, 22, [[0, '#a0a6b2'], [1, '#3a3e48']]), '#14161b', 2);
      blob(ctx, 62, y, 20, 14, 'rgba(0,0,0,0)', '#e0b84a', 1.5);
    }
    // glowing runes
    ctx.save();
    ctx.shadowColor = '#ff9a2a';
    ctx.shadowBlur = 8;
    ctx.strokeStyle = '#ffb040';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(30, 48);
    ctx.lineTo(40, 58);
    ctx.lineTo(32, 70);
    ctx.moveTo(44, 74);
    ctx.lineTo(54, 66);
    ctx.lineTo(50, 52);
    ctx.stroke();
    ctx.restore();
    // horns
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.translate(84, 60 + s * 17);
      ctx.rotate(s * 0.5);
      poly(ctx, [[-4, -6 * s], [26, s * 5], [-4, 6 * s]], '#f1e7cb', '#6a5a3a');
      ctx.restore();
    }
    // head
    blob(ctx, 80, 60, 17, 17, radial(ctx, 75, 54, 1, 20, [[0, '#e0584a'], [1, '#6a1212']]), '#1a0303', 2.2);
    glowDot(ctx, 90, 53, 3.4, '#ffe26a');
    glowDot(ctx, 90, 67, 3.4, '#ffe26a');
    ctx.fillStyle = '#f4ecd6'; // fangs
    for (const y of [57, 61, 65]) poly(ctx, [[93, y], [98, y + 1.5], [93, y + 3]], '#f4ecd6');
  }

  function drawGolem(ctx) {
    softShadow(ctx, 40, 40, 38);
    limb(ctx, 38, 17, 62, 22, 14, '#6b7078', '#23262c');
    limb(ctx, 38, 63, 62, 58, 14, '#6b7078', '#23262c');
    for (const y of [22, 58]) {
      blob(ctx, 67, y, 11.5, 11.5, radial(ctx, 63, y - 4, 1, 14, [[0, '#b4bac2'], [1, '#4c5058']]), '#1c1f24', 2);
      ctx.strokeStyle = 'rgba(20,22,26,0.7)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(62, y - 4);
      ctx.lineTo(68, y + 1);
      ctx.lineTo(65, y + 7);
      ctx.stroke();
    }
    poly(
      ctx,
      [[15, 31], [24, 13], [44, 9], [58, 21], [63, 40], [57, 60], [44, 71], [24, 67], [13, 50]],
      radial(ctx, 30, 28, 2, 46, [[0, '#a6acb4'], [1, '#3e4248']]),
      '#1a1d21'
    );
    poly(ctx, [[22, 20], [36, 14], [40, 30], [26, 36]], 'rgba(255,255,255,0.12)'); // lit facets
    poly(ctx, [[30, 50], [48, 46], [50, 64], [32, 66]], 'rgba(0,0,0,0.22)');
    ctx.fillStyle = 'rgba(78,130,66,0.6)'; // moss
    ctx.beginPath();
    ctx.ellipse(24, 28, 7, 4, 0.5, 0, TAU);
    ctx.ellipse(34, 60, 8, 4, -0.3, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(16,18,22,0.75)'; // cracks
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(26, 22);
    ctx.lineTo(34, 34);
    ctx.lineTo(28, 46);
    ctx.lineTo(36, 58);
    ctx.stroke();
    poly(ctx, [[50, 30], [64, 32], [66, 49], [52, 51]], radial(ctx, 56, 36, 1, 18, [[0, '#c4c9d0'], [1, '#575b63']]), '#1a1d21'); // head
    glowDot(ctx, 61, 37, 2.4, '#ffa030');
    glowDot(ctx, 61, 45, 2.4, '#ffa030');
  }

  function drawColossus(ctx) {
    softShadow(ctx, 75, 75, 72);
    for (let i = 0; i < 9; i++) {
      const a = Math.PI * 0.62 + (i / 8) * Math.PI * 0.76;
      ctx.save();
      ctx.translate(75 + Math.cos(a) * 46, 75 + Math.sin(a) * 46);
      ctx.rotate(a);
      poly(ctx, [[0, -8], [24, 0], [0, 8]], '#2c3037', '#0f1114');
      ctx.restore();
    }
    limb(ctx, 80, 32, 122, 38, 26, '#5c626b', '#1b1e22');
    limb(ctx, 80, 118, 122, 112, 26, '#5c626b', '#1b1e22');
    for (const y of [38, 112]) {
      blob(ctx, 130, y, 20, 20, radial(ctx, 124, y - 6, 2, 24, [[0, '#aab0b8'], [1, '#3a3e45']]), '#15171a', 2.5);
      ctx.save();
      ctx.shadowColor = '#ff7a1a';
      ctx.shadowBlur = 8;
      ctx.strokeStyle = '#ff9a3a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(122, y - 8);
      ctx.lineTo(131, y);
      ctx.lineTo(126, y + 9);
      ctx.stroke();
      ctx.restore();
    }
    poly(
      ctx,
      [[22, 56], [36, 26], [72, 14], [104, 34], [114, 76], [102, 116], [72, 136], [36, 124], [20, 94]],
      radial(ctx, 56, 50, 4, 84, [[0, '#848a94'], [0.6, '#4e545c'], [1, '#22252a']]),
      '#101215'
    );
    poly(ctx, [[40, 36], [70, 22], [78, 54], [48, 64]], 'rgba(255,255,255,0.1)');
    ctx.fillStyle = 'rgba(70,120,60,0.55)';
    ctx.beginPath();
    ctx.ellipse(44, 48, 12, 6, 0.4, 0, TAU);
    ctx.ellipse(56, 108, 14, 6, -0.3, 0, TAU);
    ctx.fill();
    ctx.save(); // lava cracks
    ctx.shadowColor = '#ff6a10';
    ctx.shadowBlur = 10;
    ctx.strokeStyle = '#ffa030';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(40, 52);
    ctx.lineTo(56, 70);
    ctx.lineTo(46, 90);
    ctx.lineTo(62, 108);
    ctx.moveTo(56, 70);
    ctx.lineTo(80, 74);
    ctx.stroke();
    ctx.restore();
    for (const y of [28, 122]) blob(ctx, 82, y, 22, 17, radial(ctx, 76, y - 5, 2, 26, [[0, '#9ba1ab'], [1, '#383c43']]), '#121417', 2);
    poly(ctx, [[96, 56], [124, 56], [128, 94], [98, 94]], radial(ctx, 108, 66, 2, 34, [[0, '#a0a6b0'], [1, '#41454c']]), '#121417'); // head
    for (const y of [54, 76, 96]) poly(ctx, [[104, y], [112, y - 14], [120, y]], '#3a3e45', '#121417'); // crown
    glowDot(ctx, 118, 68, 4, '#ff5a2a');
    glowDot(ctx, 118, 82, 4, '#ff5a2a');
  }

  function drawWraith(ctx) {
    ctx.fillStyle = radial(ctx, 55, 55, 6, 54, [[0, 'rgba(160,130,255,0.35)'], [1, 'rgba(160,130,255,0)']]);
    ctx.beginPath();
    ctx.arc(55, 55, 54, 0, TAU);
    ctx.fill();
    // tattered tails streaming behind
    for (const [y, len, w] of [[30, 34, 8], [42, 44, 9], [55, 52, 10], [68, 44, 9], [80, 34, 8]]) {
      poly(
        ctx,
        [[46, y - w], [46 - len, y + (y - 55) * 0.5], [46, y + w]],
        linear(ctx, 46 - len, y, 46, y, [[0, 'rgba(120,90,230,0)'], [1, 'rgba(120,90,230,0.55)']])
      );
    }
    for (const y of [32, 78]) { // reaching claws
      limb(ctx, 62, y + (y < 55 ? 8 : -8), 92, y, 6, 'rgba(176,156,255,0.9)', 'rgba(40,20,90,0.8)');
      for (const d of [-4, 0, 4]) poly(ctx, [[92, y + d - 1.5], [101, y + d], [92, y + d + 1.5]], '#f2eeff');
    }
    ctx.save();
    ctx.shadowColor = '#9a7aff';
    ctx.shadowBlur = 14;
    blob(ctx, 52, 55, 28, 24, radial(ctx, 46, 48, 2, 34, [[0, 'rgba(190,170,255,0.95)'], [1, 'rgba(80,50,190,0.9)']]), 'rgba(30,10,80,0.9)', 2);
    ctx.restore();
    blob(ctx, 70, 55, 15, 15, radial(ctx, 66, 50, 1, 18, [[0, '#4a3a8a'], [1, '#150a38']]), '#0a0420', 2);
    blob(ctx, 75, 55, 9, 10, '#06020f');
    glowDot(ctx, 77, 51, 3, '#d8fcff');
    glowDot(ctx, 77, 59, 3, '#d8fcff');
  }

  function drawDiamond(ctx) {
    ctx.save();
    ctx.shadowColor = '#bfefff';
    ctx.shadowBlur = 10;
    poly(ctx, [[7, 3], [19, 3], [25, 10], [13, 24], [1, 10]], '#7ed6f5');
    ctx.restore();
    poly(ctx, [[7, 3], [19, 3], [25, 10], [1, 10]], '#eafcff', '#2f7fa0');
    poly(ctx, [[7, 3], [13, 10], [1, 10]], '#bdeeff', '#2f7fa0');
    poly(ctx, [[19, 3], [25, 10], [13, 10]], '#a6e6ff', '#2f7fa0');
    poly(ctx, [[1, 10], [13, 10], [13, 24]], '#5cc0ea', '#2f7fa0');
    poly(ctx, [[25, 10], [13, 10], [13, 24]], '#3fa6d6', '#2f7fa0');
    ctx.fillStyle = 'rgba(255,255,255,0.95)'; // sparkle
    ctx.beginPath();
    ctx.moveTo(9, 3.2);
    ctx.lineTo(10.2, 6);
    ctx.lineTo(13, 7);
    ctx.lineTo(10.2, 8);
    ctx.lineTo(9, 10.8);
    ctx.lineTo(7.8, 8);
    ctx.lineTo(5, 7);
    ctx.lineTo(7.8, 6);
    ctx.closePath();
    ctx.fill();
  }

  function drawCrate(ctx) {
    roundRect(ctx, 2, 2, 40, 40, 3, linear(ctx, 0, 0, 0, 44, [[0, '#bb8650'], [1, '#85572a']]), '#3e2410');
    ctx.lineCap = 'butt';
    ctx.strokeStyle = 'rgba(50,28,10,0.75)'; // plank seams
    ctx.lineWidth = 1.5;
    for (const y of [15, 29]) {
      ctx.beginPath();
      ctx.moveTo(3, y);
      ctx.lineTo(41, y);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(70,40,16,0.4)'; // grain
    ctx.lineWidth = 1;
    for (const [x, y, l] of [[9, 8, 12], [26, 21, 10], [12, 35, 14], [28, 6, 9]]) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + l, y + 0.6);
      ctx.stroke();
    }
    ctx.strokeStyle = '#6b4220'; // frame + brace
    ctx.lineWidth = 4;
    ctx.strokeRect(7, 7, 30, 30);
    ctx.beginPath();
    ctx.moveTo(9, 9);
    ctx.lineTo(35, 35);
    ctx.moveTo(35, 9);
    ctx.lineTo(9, 35);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(235,190,120,0.55)'; // highlight
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(5, 5);
    ctx.lineTo(39, 5);
    ctx.stroke();
    for (const [x, y] of [[3, 3], [33, 3], [3, 33], [33, 33]]) {
      roundRect(ctx, x, y, 8, 8, 1.5, '#8d95a1', '#3a3f48'); // corner plates
      blob(ctx, x + 4, y + 4, 1.2, 1.2, '#d6dbe2');
    }
  }

  // ---- new monsters, weapons, weather, capsule ---------------------------

  function drawSpitter(ctx) {
    softShadow(ctx, 22, 22, 21);
    limb(ctx, 18, 12, 33, 14, 5, '#7f9a2e', '#35420e');
    limb(ctx, 18, 32, 33, 30, 5, '#7f9a2e', '#35420e');
    blob(ctx, 18, 22, 13, 14.5, radial(ctx, 15, 17, 1, 18, [[0, '#d9f26e'], [1, '#6a891a']]), '#2e3b0a', 1.6);
    for (const [x, y, r] of [[12, 16, 3.2], [20, 28, 3], [14, 26, 2.2]]) {
      blob(ctx, x, y, r, r, 'rgba(190,255,90,0.75)', 'rgba(40,70,0,0.6)', 1); // toxic bubbles
    }
    blob(ctx, 28, 22, 8, 8, radial(ctx, 26, 19, 1, 9, [[0, '#e4f88a'], [1, '#7d9c24']]), '#2e3b0a', 1.5);
    glowDot(ctx, 35, 22, 3.2, '#b6ff3a'); // open mouth full of acid
    glowDot(ctx, 31, 18, 1.4, '#ff3b3b');
    glowDot(ctx, 31, 26, 1.4, '#ff3b3b');
  }

  function drawExploder(ctx) {
    softShadow(ctx, 20, 20, 19);
    blob(ctx, 20, 20, 15, 15, radial(ctx, 15, 15, 1, 20, [[0, '#ff7050'], [0.6, '#c01818'], [1, '#5a0808']]), '#2a0404', 2);
    ctx.save(); // hazard stripes
    ctx.beginPath();
    ctx.arc(20, 20, 13, 0, TAU);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,220,40,0.8)';
    ctx.lineWidth = 3;
    for (let i = -20; i < 50; i += 9) {
      ctx.beginPath();
      ctx.moveTo(i, 40);
      ctx.lineTo(i + 24, 0);
      ctx.stroke();
    }
    ctx.restore();
    glowDot(ctx, 20, 20, 3.6, '#fff1a0'); // unstable core
    glowDot(ctx, 28, 15, 1.6, '#ffe03a');
    glowDot(ctx, 28, 25, 1.6, '#ffe03a');
    ctx.strokeStyle = '#e8d8a0'; // burning fuse at the back
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(6, 20);
    ctx.lineTo(2.5, 20);
    ctx.stroke();
    glowDot(ctx, 2.5, 20, 2, '#ffb030');
  }

  function drawHealer(ctx) {
    softShadow(ctx, 23, 23, 22);
    ctx.fillStyle = radial(ctx, 23, 23, 6, 23, [[0, 'rgba(106,255,138,0.3)'], [1, 'rgba(106,255,138,0)']]);
    ctx.beginPath();
    ctx.arc(23, 23, 23, 0, TAU);
    ctx.fill();
    limb(ctx, 24, 33, 41, 29, 3, '#6a4a2a', '#2a1a0a'); // staff
    glowDot(ctx, 42, 29, 4, '#6aff8a');
    blob(ctx, 20, 23, 13, 15, radial(ctx, 16, 18, 1, 18, [[0, '#c6f2e4'], [1, '#3a8a78']]), '#14403a', 1.6);
    ctx.fillStyle = '#6aff8a'; // healing cross on the robe
    ctx.fillRect(13, 21.6, 8, 2.6);
    ctx.fillRect(15.7, 18.8, 2.6, 8);
    blob(ctx, 27, 22, 8.5, 8.5, radial(ctx, 24, 19, 1, 10, [[0, '#6ab8a8'], [1, '#1c5a50']]), '#0c2a26', 1.6);
    blob(ctx, 30, 22, 5, 5.5, '#04100e');
    glowDot(ctx, 32, 20, 1.5, '#9bffb0');
    glowDot(ctx, 32, 24, 1.5, '#9bffb0');
  }

  function drawSpit(ctx) {
    ctx.fillStyle = radial(ctx, 7, 7, 0, 7, [[0, 'rgba(235,255,150,1)'], [0.45, 'rgba(150,230,40,0.95)'], [1, 'rgba(90,170,10,0)']]);
    ctx.beginPath();
    ctx.arc(7, 7, 7, 0, TAU);
    ctx.fill();
  }

  function drawLaser(ctx) {
    ctx.save();
    ctx.shadowColor = '#55e0ff';
    ctx.shadowBlur = 6;
    roundRect(ctx, 3, 2, 38, 6, 3, linear(ctx, 3, 0, 41, 0, [[0, 'rgba(70,200,255,0)'], [0.6, 'rgba(90,225,255,0.85)'], [1, '#ffffff']]));
    ctx.restore();
    roundRect(ctx, 14, 3.8, 27, 2.4, 1.2, linear(ctx, 14, 0, 41, 0, [[0, 'rgba(255,255,255,0)'], [1, '#ffffff']]));
  }

  function drawRocket(ctx) {
    poly(ctx, [[8, 7], [0, 1.5], [3, 7], [0, 12.5]], '#ff9a2a'); // flame
    poly(ctx, [[8, 7], [3, 4.5], [4, 7], [3, 9.5]], '#fff0a0');
    poly(ctx, [[10, 1], [14, 3], [14, 5]], '#3a3f48', '#14161b'); // fins
    poly(ctx, [[10, 13], [14, 11], [14, 9]], '#3a3f48', '#14161b');
    roundRect(ctx, 8, 3.5, 14, 7, 3, linear(ctx, 0, 3, 0, 11, [[0, '#e6eaf0'], [1, '#7a828e']]), '#2a2e36');
    poly(ctx, [[21, 3.5], [28, 7], [21, 10.5]], '#e83a3a', '#5a0e0e');
  }

  function drawRaindrop(ctx) {
    ctx.fillStyle = linear(ctx, 0, 0, 0, 20, [[0, 'rgba(190,220,255,0)'], [1, 'rgba(210,232,255,0.9)']]);
    ctx.fillRect(1, 0, 2, 20);
  }

  // fog: clear around the player, thick towards the edges of the screen
  function drawFogVision(ctx, w, h) {
    ctx.fillStyle = radial(ctx, w / 2, h / 2, 190, Math.hypot(w, h) / 2, [
      [0, 'rgba(140,162,178,0)'],
      [0.45, 'rgba(140,162,178,0.8)'],
      [1, 'rgba(140,162,178,0.92)'],
    ]);
    ctx.fillRect(0, 0, w, h);
  }

  function drawCapsuleDome(ctx, size, r) {
    const c = size / 2;
    ctx.fillStyle = radial(ctx, c, c, r * 0.35, r, [[0, 'rgba(90,210,255,0.04)'], [1, 'rgba(90,210,255,0.34)']]);
    ctx.beginPath();
    ctx.arc(c, c, r, 0, TAU);
    ctx.fill();
    ctx.save();
    ctx.shadowColor = '#6fe8ff';
    ctx.shadowBlur = 12;
    ctx.strokeStyle = 'rgba(140,235,255,0.95)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(c, c, r - 2, 0, TAU);
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; // glass highlight
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(c, c, r - 12, Math.PI * 1.1, Math.PI * 1.4);
    ctx.stroke();
  }

  function drawDrone(ctx) {
    // blurred rotors on four motors
    for (const [x, y] of [[7, 7], [33, 7], [7, 33], [33, 33]]) {
      ctx.fillStyle = radial(ctx, x, y, 0, 8, [[0, 'rgba(220,245,255,0.55)'], [1, 'rgba(220,245,255,0)']]);
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, TAU);
      ctx.fill();
    }
    ctx.lineCap = 'round';
    for (const [x, y] of [[7, 7], [33, 7], [7, 33], [33, 33]]) {
      limb(ctx, 20, 20, x, y, 3, '#5a6a78', '#1a222a'); // arms
      blob(ctx, x, y, 3.2, 3.2, '#2c3640', '#0e1318', 1);
    }
    blob(ctx, 20, 20, 10, 10, radial(ctx, 16, 16, 1, 13, [[0, '#e6f8ff'], [1, '#3a8fb8']]), '#16384a', 1.8);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; // glass highlight
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(20, 20, 6.5, Math.PI * 1.05, Math.PI * 1.55);
    ctx.stroke();
    glowDot(ctx, 28, 20, 2.6, '#7dffa0'); // eye / gun
    glowDot(ctx, 12.5, 20, 1.3, '#ff5a5a'); // tail light
  }

  function drawGhost(ctx) {
    ctx.fillStyle = radial(ctx, 17, 17, 2, 17, [[0, 'rgba(190,170,255,0.4)'], [1, 'rgba(190,170,255,0)']]);
    ctx.beginPath();
    ctx.arc(17, 17, 17, 0, TAU);
    ctx.fill();
    for (const [y, len] of [[11, 12], [17, 15], [23, 12]]) { // wavy tail
      poly(ctx, [[14, y - 4], [14 - len, y + (y - 17) * 0.6], [14, y + 4]], linear(ctx, 14 - len, y, 14, y, [[0, 'rgba(150,120,240,0)'], [1, 'rgba(150,120,240,0.6)']]));
    }
    blob(ctx, 19, 17, 10, 9, radial(ctx, 16, 14, 1, 12, [[0, 'rgba(245,240,255,0.95)'], [1, 'rgba(140,110,230,0.9)']]), 'rgba(40,20,90,0.8)', 1.4);
    glowDot(ctx, 24, 14.5, 1.6, '#3a1a7a');
    glowDot(ctx, 24, 19.5, 1.6, '#3a1a7a');
  }

  function drawBoulder(ctx) {
    softShadow(ctx, 13, 14, 13);
    poly(ctx, [[3, 11], [8, 3], [18, 2], [24, 9], [23, 19], [15, 24], [6, 21]], radial(ctx, 10, 9, 1, 18, [[0, '#a8aeb8'], [1, '#4a4e56']]), '#1a1d22');
    poly(ctx, [[8, 5], [16, 4], [14, 11], [7, 12]], 'rgba(255,255,255,0.15)');
    ctx.strokeStyle = 'rgba(20,22,26,0.7)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(14, 8);
    ctx.lineTo(17, 14);
    ctx.lineTo(12, 19);
    ctx.stroke();
  }

  // ---- minimap art ------------------------------------------------------

  function drawMapBg(ctx, size) {
    const c = size / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(c, c, c, 0, TAU);
    ctx.clip();
    ctx.fillStyle = radial(ctx, c, c, 0, c, [[0, '#10202c'], [1, '#060a10']]);
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(140,220,200,0.10)'; // range rings + cross hair
    ctx.lineWidth = 1;
    for (const f of [1 / 3, 2 / 3]) {
      ctx.beginPath();
      ctx.arc(c, c, c * f, 0, TAU);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(c, 0);
    ctx.lineTo(c, size);
    ctx.moveTo(0, c);
    ctx.lineTo(size, c);
    ctx.stroke();
    ctx.restore();
  }

  // diagonal hatching: marks the void beyond the edge of the world on the minimap
  function drawMapHatch(ctx, size) {
    ctx.strokeStyle = 'rgba(120,170,210,0.2)';
    ctx.lineWidth = 1.5;
    for (let i = -size; i < size * 2; i += 8) {
      ctx.beginPath();
      ctx.moveTo(i, size);
      ctx.lineTo(i + size, 0);
      ctx.stroke();
    }
  }

  function drawMapRim(ctx, size) {
    const c = size / 2;
    ctx.fillStyle = radial(ctx, c, c, c * 0.6, c, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.6)']]);
    ctx.beginPath();
    ctx.arc(c, c, c, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'; // glass highlight
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(c, c, c - 6, Math.PI * 1.08, Math.PI * 1.42);
    ctx.stroke();
  }

  function drawMapBezel(ctx, size, r) {
    const c = size / 2;
    ctx.fillStyle = radial(ctx, c, c, r, c, [[0, 'rgba(0,0,0,0.55)'], [1, 'rgba(0,0,0,0)']]); // drop shadow
    ctx.beginPath();
    ctx.arc(c, c, c, 0, TAU);
    ctx.fill();
    ctx.lineCap = 'butt';
    ctx.strokeStyle = linear(ctx, 0, 0, size, size, [[0, '#fff0c8'], [0.35, '#b07a30'], [0.65, '#ffd9a0'], [1, '#7a5320']]);
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(c, c, r + 4, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = '#1a1208';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(c, c, r, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,230,180,0.65)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(c, c, r + 8, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(40,24,6,0.85)'; // tick marks on the bezel
    for (let deg = 0; deg < 360; deg += 15) {
      const a = (deg * Math.PI) / 180;
      const major = deg % 90 === 0;
      ctx.lineWidth = major ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(c + Math.cos(a) * (r + 1.5), c + Math.sin(a) * (r + 1.5));
      ctx.lineTo(c + Math.cos(a) * (r + (major ? 7.5 : 4.5)), c + Math.sin(a) * (r + (major ? 7.5 : 4.5)));
      ctx.stroke();
    }
  }

  function drawMapSweep(ctx, size) {
    const c = size / 2;
    const slices = 28;
    const span = (70 * Math.PI) / 180;
    for (let i = 0; i < slices; i++) {
      const a0 = -span + (i / slices) * span;
      const a1 = -span + ((i + 1) / slices) * span;
      ctx.fillStyle = 'rgba(120,255,190,' + (0.32 * Math.pow((i + 1) / slices, 2.2)).toFixed(3) + ')';
      ctx.beginPath();
      ctx.moveTo(c, c);
      ctx.arc(c, c, c - 1, a0, a1);
      ctx.closePath();
      ctx.fill();
    }
  }

  // ---- items & effects --------------------------------------------------

  function drawBullet(ctx) {
    ctx.fillStyle = radial(ctx, 8, 8, 0, 8, [[0, 'rgba(255,240,160,1)'], [0.4, 'rgba(255,190,60,0.75)'], [1, 'rgba(255,150,30,0)']]);
    ctx.beginPath();
    ctx.arc(8, 8, 8, 0, TAU);
    ctx.fill();
    blob(ctx, 8, 8, 2.6, 2.6, '#ffffff');
  }

  function drawSpark(ctx) {
    ctx.fillStyle = radial(ctx, 4, 4, 0, 4, [[0, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']]);
    ctx.beginPath();
    ctx.arc(4, 4, 4, 0, TAU);
    ctx.fill();
  }

  function drawCrystal(ctx) {
    ctx.save();
    ctx.shadowColor = '#4fe0ff';
    ctx.shadowBlur = 8;
    poly(ctx, [[10, 1.5], [17, 10], [10, 18.5], [3, 10]], '#35b8e0');
    ctx.restore();
    poly(ctx, [[10, 1.5], [17, 10], [10, 10]], '#8ff0ff', '#1c6f8c');
    poly(ctx, [[10, 1.5], [3, 10], [10, 10]], '#5bd6f2', '#1c6f8c');
    poly(ctx, [[10, 10], [17, 10], [10, 18.5]], '#1f8fb8', '#1c6f8c');
    poly(ctx, [[10, 10], [3, 10], [10, 18.5]], '#2aa6d0', '#1c6f8c');
    blob(ctx, 8, 6.5, 1.3, 1.3, 'rgba(255,255,255,0.9)');
  }

  function drawFire(ctx) {
    softShadow(ctx, 32, 46, 30);
    const flame = (cx, baseY, w, h, color) => {
      ctx.beginPath();
      ctx.moveTo(cx - w, baseY);
      ctx.bezierCurveTo(cx - w * 1.1, baseY - h * 0.55, cx - w * 0.3, baseY - h * 0.6, cx, baseY - h);
      ctx.bezierCurveTo(cx + w * 0.3, baseY - h * 0.6, cx + w * 1.1, baseY - h * 0.55, cx + w, baseY);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    };
    ctx.save();
    ctx.shadowColor = 'rgba(255,140,40,0.9)';
    ctx.shadowBlur = 14;
    flame(32, 46, 17, 36, '#d02a10');
    ctx.restore();
    flame(32, 46, 13, 28, '#ff6a14');
    flame(28, 46, 7, 20, '#ff8f1f');
    flame(36, 46, 7, 17, '#ff8f1f');
    flame(32, 46, 9, 20, '#ffc83a');
    flame(32, 46, 4.5, 11, '#fff3b8');
    // logs
    ctx.save();
    ctx.translate(32, 46);
    for (const a of [-0.35, 0.35]) {
      ctx.save();
      ctx.rotate(a);
      roundRect(ctx, -25, -4.5, 50, 9, 4.5, linear(ctx, 0, -5, 0, 5, [[0, '#7a5230'], [1, '#3e2612']]), '#241408');
      for (const x of [-25, 25]) blob(ctx, x, 0, 3, 4.5, '#b88a58', '#4a2e14', 1);
      ctx.restore();
    }
    ctx.restore();
  }

  // ---- world ------------------------------------------------------------

  function drawGrass(ctx, w, h) {
    ctx.fillStyle = '#1d4430';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 28; i++) {
      const x = rand(0, w);
      const y = rand(0, h);
      const r = rand(40, 110);
      const col = Math.random() < 0.5 ? '12,36,24' : '46,92,56';
      for (const ox of [-w, 0, w]) {
        for (const oy of [-h, 0, h]) {
          ctx.fillStyle = radial(ctx, x + ox, y + oy, 0, r, [[0, 'rgba(' + col + ',0.38)'], [1, 'rgba(' + col + ',0)']]);
          ctx.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
        }
      }
    }
    const blades = ['#2f6a43', '#3a7d4e', '#18382a', '#4a9060'];
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';
    for (let i = 0; i < 1500; i++) {
      const x = rand(0, w);
      const y = rand(0, h);
      const a = -Math.PI / 2 + rand(-0.6, 0.6);
      const len = rand(3, 8);
      ctx.strokeStyle = blades[(Math.random() * blades.length) | 0];
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
      ctx.stroke();
    }
    const petals = ['#f2e6a0', '#e8b8d0', '#cfe0ff'];
    for (let i = 0; i < 22; i++) {
      blob(ctx, rand(4, w - 4), rand(4, h - 4), 1.6, 1.6, petals[(Math.random() * petals.length) | 0]);
    }
  }

  function drawRock(ctx) {
    softShadow(ctx, 20, 17, 19);
    blob(ctx, 20, 15, 14, 10, radial(ctx, 15, 10, 1, 18, [[0, '#a4aab4'], [1, '#585e69']]), '#2a2e36', 1.5);
    blob(ctx, 15, 11, 5, 2.5, 'rgba(255,255,255,0.25)');
    ctx.strokeStyle = 'rgba(30,34,42,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(22, 12);
    ctx.lineTo(26, 17);
    ctx.stroke();
  }

  function drawBush(ctx) {
    softShadow(ctx, 24, 22, 24);
    const lobes = [[14, 20, 10], [26, 16, 12], [35, 22, 9], [22, 24, 10]];
    for (const [x, y, r] of lobes) blob(ctx, x, y, r, r, radial(ctx, x - 3, y - 4, 1, r + 2, [[0, '#4c9a52'], [1, '#1d4a28']]), '#12301a', 1.2);
    for (const [x, y] of [[20, 14], [30, 12], [16, 22], [34, 20]]) blob(ctx, x, y, 1.6, 1.6, '#e85a6a');
  }

  function drawVignette(ctx, w, h) {
    ctx.fillStyle = radial(ctx, w / 2, h / 2, h * 0.32, Math.hypot(w, h) / 2, [
      [0, 'rgba(0,0,0,0)'],
      [1, 'rgba(0,0,0,0.6)'],
    ]);
    ctx.fillRect(0, 0, w, h);
  }

  function drawGlow(ctx, size) {
    ctx.fillStyle = radial(ctx, size / 2, size / 2, 0, size / 2, [
      [0, 'rgba(255,170,60,0.6)'],
      [1, 'rgba(255,170,60,0)'],
    ]);
    ctx.fillRect(0, 0, size, size);
  }

  R.makeTextures = function (scene) {
    const E = R.CONFIG.enemies;
    canvasTex(scene, 'player', 56, 48, drawPlayer);
    canvasTex(scene, 'walker', E.walker.size, E.walker.size, drawWalker);
    canvasTex(scene, 'runner', E.runner.size, E.runner.size, drawRunner);
    canvasTex(scene, 'brute', E.brute.size, E.brute.size, drawBrute);
    canvasTex(scene, 'golem', E.golem.size, E.golem.size, drawGolem);
    canvasTex(scene, 'boss', E.boss.size, E.boss.size, drawBoss);
    canvasTex(scene, 'colossus', E.colossus.size, E.colossus.size, drawColossus);
    canvasTex(scene, 'wraith', E.wraith.size, E.wraith.size, drawWraith);
    canvasTex(scene, 'diamond', 26, 26, drawDiamond);
    canvasTex(scene, 'crate', 44, 44, drawCrate);
    canvasTex(scene, 'spitter', E.spitter.size, E.spitter.size, drawSpitter);
    canvasTex(scene, 'exploder', E.exploder.size, E.exploder.size, drawExploder);
    canvasTex(scene, 'healer', E.healer.size, E.healer.size, drawHealer);
    canvasTex(scene, 'spit', 14, 14, drawSpit);
    canvasTex(scene, 'ghost', E.ghost.size, E.ghost.size, drawGhost);
    canvasTex(scene, 'boulder', 26, 26, drawBoulder);
    canvasTex(scene, 'drone', 40, 40, drawDrone);
    canvasTex(scene, 'laser', 44, 10, drawLaser);
    canvasTex(scene, 'rocket', 28, 14, drawRocket);
    canvasTex(scene, 'raindrop', 4, 20, drawRaindrop);
    canvasTex(scene, 'fogvision', R.CONFIG.WIDTH, R.CONFIG.HEIGHT, (ctx) => drawFogVision(ctx, R.CONFIG.WIDTH, R.CONFIG.HEIGHT));
    const cap = R.CONFIG.capsule;
    canvasTex(scene, 'capsule', (cap.radius + 20) * 2, (cap.radius + 20) * 2, (ctx) => drawCapsuleDome(ctx, (cap.radius + 20) * 2, cap.radius));
    const mr = R.CONFIG.MAP_R;
    canvasTex(scene, 'mapbg', mr * 2, mr * 2, (ctx) => drawMapBg(ctx, mr * 2));
    canvasTex(scene, 'maprim', mr * 2, mr * 2, (ctx) => drawMapRim(ctx, mr * 2));
    canvasTex(scene, 'maphatch', 32, 32, (ctx) => drawMapHatch(ctx, 32));
    canvasTex(scene, 'mapbezel', (mr + 14) * 2, (mr + 14) * 2, (ctx) => drawMapBezel(ctx, (mr + 14) * 2, mr));
    canvasTex(scene, 'mapsweep', mr * 2, mr * 2, (ctx) => drawMapSweep(ctx, mr * 2));
    canvasTex(scene, 'bullet', 16, 16, drawBullet);
    canvasTex(scene, 'spark', 8, 8, drawSpark);
    canvasTex(scene, 'crystal', 20, 20, drawCrystal);
    canvasTex(scene, 'fire', 64, 64, drawFire);
    canvasTex(scene, 'grass', 512, 512, drawGrass);
    canvasTex(scene, 'rock', 40, 32, drawRock);
    canvasTex(scene, 'bush', 48, 38, drawBush);
    canvasTex(scene, 'vignette', R.CONFIG.WIDTH, R.CONFIG.HEIGHT, drawVignette);
    const glow = R.CONFIG.FIRE_RADIUS * 2;
    canvasTex(scene, 'glow', glow, glow, (ctx) => drawGlow(ctx, glow));
  };
})();
