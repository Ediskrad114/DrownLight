/* ==========================================================================
   光溺 DROWNLIGHT · render.js
   背景 / 光域 / 实体 / HUD / 声呐盘
   ========================================================================== */
window.DL = window.DL || {};
(function () {
  'use strict';

  var U = DL.U, T = DL.T, C = T.colors, G = DL.G;

  var snow = [];
  var silh = [];

  function buildSnow() {
    var S = DL.S;
    var n = Math.min(460, Math.round(S.W * S.H / 4200));
    if (G.perf.grade >= 2) n = Math.round(n * 0.5);
    snow.length = 0;
    for (var i = 0; i < n; i++) {
      snow.push({
        x: Math.random() * S.W,
        y: Math.random() * S.H,
        z: U.rnd(0.25, 1),
        s: U.rnd(0.5, 2.0),
        p: Math.random() * U.TAU,
        sp: U.rnd(6, 22)
      });
    }
  }

  function buildSilh() {
    var S = DL.S;
    silh.length = 0;
    for (var i = 0; i < 5; i++) {
      silh.push({
        x: U.rnd(-100, S.W + 100),
        y: U.rnd(S.H * 0.2, S.H * 0.95),
        w: U.rnd(220, 560),
        h: U.rnd(120, 300),
        seed: Math.random() * 100,
        a: U.rnd(0.05, 0.14)
      });
    }
  }

  DL.onResize = function () { buildSnow(); buildSilh(); coneTex = null; coneTexKey = ''; };
  DL.S.onResize(DL.onResize);

  /* ---------------- 文本工具 ---------------- */
  var D = {};
  var fontCache = {};
  D.font = function (size, weight) {
    var sz = Math.round(size), w = weight || 600;
    var k = w * 1000 + sz;
    var f = fontCache[k];
    if (f === undefined) {
      f = w + ' ' + sz + 'px ui-monospace, "Cascadia Mono", Consolas, "Microsoft YaHei", monospace';
      fontCache[k] = f;
    }
    return f;
  };

  D.text = function (ctx, str, x, y, size, color, align, weight) {
    ctx.font = D.font(size, weight);
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(str, x, y);
  };

  D.glowText = function (ctx, str, x, y, size, color, align, blur) {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = blur || size * 0.6;
    D.text(ctx, str, x, y, size, color, align, 700);
    ctx.restore();
  };

  D.line = function (ctx, x1, y1, x2, y2, color, w) {
    ctx.strokeStyle = color;
    ctx.lineWidth = w || 1;
    ctx.beginPath();
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.stroke();
  };

  D.panel = function (ctx, x, y, w, h, a) {
    ctx.fillStyle = 'rgba(3,14,22,' + (a === undefined ? 0.72 : a) + ')';
    ctx.fillRect(x, y, w, h);
  };

  D.frame = function (ctx, x, y, w, h, color, alpha) {
    ctx.strokeStyle = U.rgba(color, alpha === undefined ? 0.5 : alpha);
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w, h);
  };

  D.roundRect = function (ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };

  /* 发光贴图：把径向渐变烘成一张 128px 的图，之后全部用 drawImage
     —— 每帧 createRadialGradient 是 Canvas2D 里最贵的一件事之一 */
  var glowCache = Object.create(null);
  function glowSprite(color) {
    var img = glowCache[color];
    if (img) return img;
    var N = 128;
    var cv = document.createElement('canvas');
    cv.width = N; cv.height = N;
    var g = cv.getContext('2d');
    var grd = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
    grd.addColorStop(0, U.rgba(color, 1));
    grd.addColorStop(0.45, U.rgba(color, 0.32));
    grd.addColorStop(1, U.rgba(color, 0));
    g.fillStyle = grd;
    g.fillRect(0, 0, N, N);
    img = cv;
    glowCache[color] = img;
    return img;
  }

  D.glow = function (ctx, x, y, r, color, alpha) {
    if (!(r > 0.5) || !(alpha > 0.003)) return;
    /* 掉帧时省掉小光晕（敌方诱饵灯之类），大光晕保留 */
    if (G.perf.lod && r < 34) return;
    var img = glowSprite(color);
    var a = ctx.globalAlpha;
    var na = a * (alpha > 1 ? 1 : alpha);
    ctx.globalAlpha = na > 1 ? 1 : na;
    ctx.drawImage(img, x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = a;
  };

  DL.draw = D;

  /* ---------------- 背景 ---------------- */
  function drawBackground(ctx, t, parallaxX, parallaxY) {
    var S = DL.S;
    if (S.bgTex) ctx.drawImage(S.bgTex, 0, 0, S.W, S.H);
    else { ctx.fillStyle = S.bgGrad; ctx.fillRect(0, 0, S.W, S.H); }

    /* 远景剪影 */
    ctx.save();
    for (var i = 0; i < silh.length; i++) {
      var s = silh[i];
      var px = s.x - parallaxX * 0.05;
      var py = s.y - parallaxY * 0.05;
      ctx.fillStyle = 'rgba(0,4,8,' + (s.a * 0.85) + ')';
      ctx.beginPath();
      ctx.moveTo(px - s.w * 0.5, py + s.h * 0.5);
      ctx.quadraticCurveTo(px - s.w * 0.15, py - s.h * 0.55, px + s.w * 0.12, py - s.h * 0.2);
      ctx.quadraticCurveTo(px + s.w * 0.4, py - s.h * 0.1, px + s.w * 0.5, py + s.h * 0.5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    /* 海雪：按 3 档透明度合并成 3 次 fill */
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var dim = G.perf.grade >= 2 ? 0.6 : 1;
    ctx.fillStyle = 'rgba(150,220,235,1)';
    for (var bucket = 0; bucket < 3; bucket++) {
      ctx.globalAlpha = [0.07, 0.14, 0.22][bucket] * dim;
      ctx.beginPath();
      for (var j = 0; j < snow.length; j++) {
        var p = snow[j];
        var bi = p.z < 0.5 ? 0 : (p.z < 0.8 ? 1 : 2);
        if (bi !== bucket) continue;
        var sy = p.y - (t * p.sp) % (S.H + 40);
        if (sy < -20) sy += S.H + 40;
        var sx = p.x + Math.sin(t * 0.5 + p.p) * 8 - parallaxX * p.z * 0.12;
        sy -= parallaxY * p.z * 0.12;
        if (sx < -10) sx += S.W + 20;
        if (sx > S.W + 10) sx -= S.W + 20;
        var ss = p.s * p.z * 1.4;
        if (ss < 2.2) ctx.rect(sx - ss, sy - ss, ss * 2, ss * 2);
        else { ctx.moveTo(sx + ss, sy); ctx.arc(sx, sy, ss, 0, U.TAU); }
      }
      ctx.fill();
    }
    ctx.restore();
  }

  /* ---------------- 可见度 ---------------- */
  function coneCheck(px, py, aim, coneAng, coneLen, x, y) {
    var dx = x - px, dy = y - py;
    var d = Math.sqrt(dx * dx + dy * dy);
    if (d > coneLen + 40) return 0;
    var a = Math.atan2(dy, dx);
    var diff = Math.abs(U.angDiff(aim, a));
    if (diff > coneAng * 0.5 + 0.04) return 0;
    // 软边缘
    var edge = 1;
    if (d > coneLen - 40) edge = Math.max(0, (coneLen + 40 - d) / 80);
    if (diff > coneAng * 0.5 - 0.05) {
      edge *= Math.max(0, 1 - (diff - (coneAng * 0.5 - 0.05)) / 0.09);
    }
    return edge;
  }

  DL.visOf = function (x, y, r) {
    var p = DL.PL;
    if (!p.alive) return 1;
    var s = p.stats;
    if (s.eye) {
      var d0 = U.dist(p.x, p.y, x, y);
      if (d0 < 210) return U.clamp(1 - (d0 - 170) / 60, 0.35, 1);
      return 0;
    }
    var cv = coneCheck(p.x, p.y, p.aim, s.coneAng, s.coneLen, x, y);
    var dd = U.dist(p.x, p.y, x, y);
    if (cv > 0) return cv;
    if (dd < s.nearR) return 0.55 * (1 - dd / s.nearR * 0.4);
    return 0;
  };

  /* ---------------- 世界 ---------------- */
  function drawVents(ctx) {
    for (var i = 0; i < G.vents.length; i++) {
      var v = G.vents[i];
      var cr = v.r * 0.55;
      if (v.active > 0) {
        var ak = v.active / 0.8;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        var g2 = ctx.createRadialGradient(v.x, v.y, 4, v.x, v.y, v.r);
        g2.addColorStop(0, 'rgba(255,210,140,' + (0.85 * ak) + ')');
        g2.addColorStop(0.45, 'rgba(255,140,70,' + (0.4 * ak) + ')');
        g2.addColorStop(1, 'rgba(255,110,50,0)');
        ctx.fillStyle = g2;
        ctx.beginPath(); ctx.arc(v.x, v.y, v.r, 0, U.TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(255,170,100,' + (0.7 * ak) + ')';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(v.x, v.y, cr + (1 - ak) * v.r * 0.8, 0, U.TAU); ctx.stroke();
        ctx.restore();
      } else if (v.tele > 0) {
        var k = 1 - v.tele;
        ctx.save();
        ctx.strokeStyle = 'rgba(255,150,90,' + (0.25 + k * 0.6) + ')';
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(v.x, v.y, cr + (1 - k) * v.r * 0.6, 0, U.TAU); ctx.stroke();
        for (var b2 = 0; b2 < 6; b2++) {
          var by = v.y - k * 46 - b2 * 9;
          ctx.fillStyle = 'rgba(255,170,120,' + (0.5 * k * (1 - b2 / 7)) + ')';
          ctx.beginPath();
          ctx.arc(v.x + Math.sin(b2 * 2 + G.t * 3) * (8 + b2 * 2), by, 1.6 + b2 * 0.35, 0, U.TAU);
          ctx.fill();
        }
        ctx.restore();
      } else {
        ctx.save();
        var cgd = ctx.createRadialGradient(v.x, v.y, 2, v.x, v.y, cr);
        cgd.addColorStop(0, 'rgba(4,2,3,0.75)');
        cgd.addColorStop(0.7, 'rgba(6,3,4,0.45)');
        cgd.addColorStop(1, 'rgba(6,3,4,0)');
        ctx.fillStyle = cgd;
        ctx.beginPath(); ctx.arc(v.x, v.y, cr, 0, U.TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(150,110,90,0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(v.x, v.y, cr * 0.55, 0, U.TAU); ctx.stroke();
        ctx.restore();
      }
    }
    if (G.current) {
      var cu = G.current;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      var cg = ctx.createLinearGradient(0, cu.y - cu.w * 0.5, 0, cu.y + cu.w * 0.5);
      cg.addColorStop(0, 'rgba(120,200,220,0)');
      cg.addColorStop(0.5, 'rgba(120,200,220,0.055)');
      cg.addColorStop(1, 'rgba(120,200,220,0)');
      ctx.fillStyle = cg;
      ctx.fillRect(0, cu.y - cu.w * 0.5, DL.S.W, cu.w);
      ctx.strokeStyle = 'rgba(140,220,240,0.05)';
      ctx.lineWidth = 1;
      for (var s = 0; s < 9; s++) {
        var ly = cu.y - cu.w * 0.5 + (s / 9) * cu.w;
        var off = ((G.t * cu.dir * 140 + s * 220) % (DL.S.W + 400)) - 200;
        ctx.beginPath();
        ctx.moveTo(off, ly);
        ctx.lineTo(off + 160, ly);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawEnemy(ctx, e, alpha) {
    var a = alpha;
    if (a <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = a;

    var x = e.x, y = e.y, r = e.r;
    var col = C.enemy;

    if (e.type === 'lantern') {
      var lr = e.lit ? 1 : 0.45;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(e.angle || 0);

      /* 尾鳍 */
      ctx.fillStyle = 'rgba(28,10,24,0.85)';
      ctx.beginPath();
      ctx.moveTo(-r * 1.15, 0);
      ctx.lineTo(-r * 1.85, -r * 0.62);
      ctx.lineTo(-r * 1.5, 0);
      ctx.lineTo(-r * 1.85, r * 0.62);
      ctx.closePath();
      ctx.fill();

      /* 躯干：深色渐变 + 侧线 */
      var lg = ctx.createLinearGradient(-r, -r * 0.8, r, r * 0.8);
      lg.addColorStop(0, '#2a0d22');
      lg.addColorStop(0.55, '#160812');
      lg.addColorStop(1, '#0a0308');
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.moveTo(r * 1.42, 0);
      ctx.quadraticCurveTo(r * 0.5, -r * 0.78, -r * 0.5, -r * 0.66);
      ctx.quadraticCurveTo(-r * 1.3, -r * 0.2, -r * 1.3, 0);
      ctx.quadraticCurveTo(-r * 1.3, r * 0.2, -r * 0.5, r * 0.66);
      ctx.quadraticCurveTo(r * 0.5, r * 0.78, r * 1.42, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = U.rgba(col, 0.55 * lr + 0.15);
      ctx.lineWidth = 1.3;
      ctx.stroke();

      /* 背鳍 */
      ctx.fillStyle = 'rgba(50,14,38,0.9)';
      ctx.beginPath();
      ctx.moveTo(-r * 0.15, -r * 0.6);
      ctx.quadraticCurveTo(-r * 0.2, -r * 1.15, -r * 0.95, -r * 0.42);
      ctx.closePath();
      ctx.fill();

      /* 牙 */
      ctx.fillStyle = 'rgba(235,225,240,0.8)';
      for (var lt = 0; lt < 4; lt++) {
        var lx = r * 1.2 - lt * r * 0.26;
        ctx.beginPath();
        ctx.moveTo(lx, -r * 0.16);
        ctx.lineTo(lx - r * 0.09, r * 0.03);
        ctx.lineTo(lx - r * 0.18, -r * 0.16);
        ctx.closePath();
        ctx.fill();
      }

      /* 眼 */
      ctx.fillStyle = 'rgba(255,220,235,0.9)';
      ctx.beginPath(); ctx.arc(r * 0.72, -r * 0.22, 1.6, 0, U.TAU); ctx.fill();

      /* 诱饵杆 + 灯 */
      ctx.strokeStyle = U.rgba(col, 0.5);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(r * 1.2, -r * 0.1);
      ctx.quadraticCurveTo(r * 1.7, -r * 0.5, r * 1.95, 0);
      ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = a * lr;
      D.glow(ctx, r * 1.95, 0, r * 0.85, col, 0.95);
      ctx.globalAlpha = a;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(r * 1.95, 0, 2.2, 0, U.TAU); ctx.fill();
      ctx.restore();

    } else if (e.type === 'jelly') {
      var pulse = 1 + Math.sin(e.t * 3.2) * 0.12;
      ctx.translate(x, y);

      /* 触须：先画，压在本体下 */
      for (var i = 0; i < 5; i++) {
        var bx = -r * 0.66 + i * r * 0.33;
        var sw = Math.sin(e.t * 2 + i * 0.9);
        ctx.strokeStyle = U.rgba(col, 0.20 + 0.10 * (i % 2));
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(bx, 0);
        ctx.quadraticCurveTo(bx + sw * 7, r * 0.75, bx + sw * 12, r * 1.55);
        ctx.stroke();
      }

      /* 伞盖 */
      var jg = ctx.createRadialGradient(0, -r * 0.3, r * 0.15, 0, 0, r * pulse);
      jg.addColorStop(0, 'rgba(120,40,95,0.75)');
      jg.addColorStop(0.55, 'rgba(58,16,48,0.72)');
      jg.addColorStop(1, 'rgba(24,6,22,0.55)');
      ctx.fillStyle = jg;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * pulse, r * 0.9 * pulse, 0, Math.PI, 0);
      ctx.quadraticCurveTo(r * pulse * 0.5, r * 0.18, 0, r * 0.16);
      ctx.quadraticCurveTo(-r * pulse * 0.5, r * 0.18, -r * pulse, 0);
      ctx.fill();
      ctx.strokeStyle = U.rgba(col, 0.55);
      ctx.lineWidth = 1.2;
      ctx.stroke();

      /* 伞缘高光 */
      ctx.strokeStyle = U.rgba('#ffd6ee', 0.28);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * pulse * 0.98, r * 0.88 * pulse, 0, Math.PI * 1.08, Math.PI * 1.92);
      ctx.stroke();

      /* 内部核 */
      ctx.globalCompositeOperation = 'lighter';
      D.glow(ctx, 0, -r * 0.34, r * 0.55, col, 0.55);
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = a * (e.tele > 0 ? 1 : 0.7);
      ctx.globalCompositeOperation = 'lighter';
      D.glow(ctx, x, y - r * 0.35, r * (e.tele > 0 ? 1.7 : 1.0), col, e.tele > 0 ? 0.85 : 0.35);
      ctx.restore();

    } else if (e.type === 'squid') {
      ctx.translate(x, y);
      ctx.rotate(e.ang || 0);
      var stretch = e.state === 'charge' ? 0.75 : (e.state === 'dash' ? 1.5 : 1);

      /* 触腕 */
      ctx.strokeStyle = U.rgba(col, 0.35);
      ctx.lineWidth = 1.6;
      for (var sq = -2; sq <= 2; sq++) {
        var sg2 = Math.sin(e.t * 4 + sq) * 3;
        ctx.beginPath();
        ctx.moveTo(-r * 0.55, sq * r * 0.18);
        ctx.quadraticCurveTo(-r * 0.95, sq * r * 0.3 + sg2, -r * 1.35, sq * r * 0.36 + sg2 * 1.4);
        ctx.stroke();
      }

      /* 外套膜 */
      var qg = ctx.createLinearGradient(r * 1.4 * stretch, 0, -r, 0);
      qg.addColorStop(0, 'rgba(56,22,52,0.95)');
      qg.addColorStop(0.6, 'rgba(26,10,30,0.95)');
      qg.addColorStop(1, 'rgba(12,5,16,0.9)');
      ctx.fillStyle = qg;
      ctx.beginPath();
      ctx.moveTo(r * 1.5 * stretch, 0);
      ctx.quadraticCurveTo(r * 0.45, -r * 0.72, -r * 0.6, -r * 0.5);
      ctx.quadraticCurveTo(-r * 1.15, 0, -r * 0.6, r * 0.5);
      ctx.quadraticCurveTo(r * 0.45, r * 0.72, r * 1.5 * stretch, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = U.rgba(col, 0.6);
      ctx.lineWidth = 1.2;
      ctx.stroke();

      /* 侧鳍 */
      ctx.fillStyle = U.rgba(col, 0.18);
      ctx.beginPath();
      ctx.moveTo(r * 0.55, -r * 0.5);
      ctx.quadraticCurveTo(r * 0.9, -r * 0.95, r * 1.15, -r * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(r * 0.55, r * 0.5);
      ctx.quadraticCurveTo(r * 0.9, r * 0.95, r * 1.15, r * 0.5);
      ctx.closePath();
      ctx.fill();

      /* 眼 */
      ctx.fillStyle = 'rgba(255,225,240,0.9)';
      ctx.beginPath(); ctx.arc(r * 0.5, -r * 0.22, 1.7, 0, U.TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(r * 0.5, r * 0.22, 1.7, 0, U.TAU); ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = a * (e.state === 'charge' ? 1 : 0.55);
      ctx.globalCompositeOperation = 'lighter';
      var sx2 = x + Math.cos(e.ang || 0) * r * 0.7;
      var sy2 = y + Math.sin(e.ang || 0) * r * 0.7;
      D.glow(ctx, sx2, sy2, e.state === 'charge' ? r * 2.2 : r, col, 0.85);
      ctx.restore();

    } else if (e.type === 'worm') {
      if (e.hidden) { ctx.restore(); return; }
      ctx.translate(x, y);
      var inA = Math.atan2(DL.S.H * 0.5 - y, DL.S.W * 0.5 - x);
      ctx.rotate(inA);

      /* 管体：两层嵌套 + 环节 */
      var wg = ctx.createLinearGradient(-r * 0.5, 0, r * 0.7, 0);
      wg.addColorStop(0, 'rgba(46,22,14,0.95)');
      wg.addColorStop(1, 'rgba(22,10,6,0.95)');
      ctx.fillStyle = wg;
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, -r * 0.85);
      ctx.lineTo(r * 0.7, -r * 0.55);
      ctx.quadraticCurveTo(r * 0.95, 0, r * 0.7, r * 0.55);
      ctx.lineTo(-r * 0.5, r * 0.85);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,150,90,0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255,140,80,0.22)';
      for (var ws = 1; ws <= 3; ws++) {
        var wx = -r * 0.5 + ws * r * 0.3;
        ctx.beginPath();
        ctx.moveTo(wx, -r * 0.8 + ws * r * 0.06);
        ctx.lineTo(wx, r * 0.8 - ws * r * 0.06);
        ctx.stroke();
      }

      /* 口器 */
      ctx.fillStyle = 'rgba(255,170,110,0.9)';
      ctx.beginPath(); ctx.ellipse(r * 0.7, 0, r * 0.14, r * 0.4, 0, 0, U.TAU); ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = a * (e.tele > 0 ? 1 : 0.7);
      ctx.globalCompositeOperation = 'lighter';
      D.glow(ctx, x + Math.cos(inA) * r, y + Math.sin(inA) * r, r * (e.tele > 0 ? 2.4 : 1.4), '#ffd166', e.tele > 0 ? 1 : 0.5);
      ctx.restore();

    } else if (e.type === 'hatchet') {
      ctx.translate(x, y);
      ctx.rotate(e.angle || 0);

      /* 尾鳍 */
      ctx.fillStyle = U.rgba(col, 0.22);
      ctx.beginPath();
      ctx.moveTo(-r * 0.9, 0);
      ctx.lineTo(-r * 1.7, -r * 0.5);
      ctx.lineTo(-r * 1.45, 0);
      ctx.lineTo(-r * 1.7, r * 0.5);
      ctx.closePath();
      ctx.fill();

      /* 金属刀身 */
      var hg = ctx.createLinearGradient(-r, -r, r * 1.3, r);
      hg.addColorStop(0, 'rgba(34,62,70,0.95)');
      hg.addColorStop(0.5, 'rgba(18,36,44,0.95)');
      hg.addColorStop(1, 'rgba(8,20,26,0.95)');
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.moveTo(r * 1.32, 0);
      ctx.lineTo(-r * 0.35, -r * 0.92);
      ctx.lineTo(-r * 1.0, -r * 0.1);
      ctx.lineTo(-r * 0.35, r * 0.92);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = U.rgba('#9ff5ff', 0.55);
      ctx.lineWidth = 1.2;
      ctx.stroke();

      /* 刃口高光 */
      ctx.strokeStyle = 'rgba(220,255,255,0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(r * 1.28, 0);
      ctx.lineTo(-r * 0.3, -r * 0.82);
      ctx.stroke();
      ctx.fillStyle = 'rgba(200,255,255,0.9)';
      ctx.beginPath(); ctx.arc(r * 0.25, -r * 0.15, 1.4, 0, U.TAU); ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = a * 0.9;
      ctx.globalCompositeOperation = 'lighter';
      for (var q = 0; q < 3; q++) {
        var bx2 = x - Math.cos(e.angle || 0) * (3 + q * 5);
        var by2 = y - Math.sin(e.angle || 0) * (3 + q * 5);
        ctx.fillStyle = U.rgba(col, 0.75 - q * 0.2);
        ctx.beginPath(); ctx.arc(bx2, by2, 1.8 - q * 0.3, 0, U.TAU); ctx.fill();
      }
      ctx.restore();

    } else if (e.type === 'angler') {
      var ma = e.angle || 0;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ma);

      /* 尾鳍 */
      ctx.fillStyle = 'rgba(30,16,6,0.9)';
      ctx.beginPath();
      ctx.moveTo(-r * 0.85, 0);
      ctx.lineTo(-r * 1.7, -r * 0.55);
      ctx.lineTo(-r * 1.45, 0);
      ctx.lineTo(-r * 1.7, r * 0.55);
      ctx.closePath();
      ctx.fill();

      /* 躯体 */
      var ag = ctx.createRadialGradient(-r * 0.25, -r * 0.3, r * 0.15, 0, 0, r * 1.1);
      ag.addColorStop(0, 'rgba(58,32,16,0.98)');
      ag.addColorStop(0.6, 'rgba(26,14,10,0.98)');
      ag.addColorStop(1, 'rgba(8,4,6,0.98)');
      ctx.fillStyle = ag;
      ctx.beginPath();
      ctx.ellipse(0, 0, r, r * 0.82, 0, 0, U.TAU);
      ctx.fill();

      /* 背棘 */
      ctx.strokeStyle = 'rgba(255,180,90,0.22)';
      ctx.lineWidth = 1.6;
      for (var sp = -2; sp <= 2; sp++) {
        ctx.beginPath();
        ctx.moveTo(sp * r * 0.22, -r * 0.72);
        ctx.lineTo(sp * r * 0.26, -r * 1.02);
        ctx.stroke();
      }

      /* 大嘴 + 牙 */
      ctx.fillStyle = 'rgba(70,26,8,0.95)';
      ctx.beginPath();
      ctx.moveTo(r * 0.35, r * 0.06);
      ctx.quadraticCurveTo(r * 0.72, r * 0.3, r * 0.98, r * 0.02);
      ctx.quadraticCurveTo(r * 0.72, r * 0.16, r * 0.35, r * 0.06);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,238,200,0.92)';
      for (var at = 0; at < 5; at++) {
        var atx = r * 0.4 + at * r * 0.13;
        ctx.beginPath();
        ctx.moveTo(atx, r * 0.08);
        ctx.lineTo(atx + r * 0.035, r * 0.2);
        ctx.lineTo(atx + r * 0.07, r * 0.08);
        ctx.closePath();
        ctx.fill();
      }

      /* 眼 */
      ctx.fillStyle = 'rgba(255,230,180,0.85)';
      ctx.beginPath(); ctx.arc(-r * 0.1, -r * 0.3, 2.2, 0, U.TAU); ctx.fill();

      /* 灯笼杆 */
      ctx.strokeStyle = 'rgba(255,200,120,0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(r * 0.5, -r * 0.5);
      ctx.quadraticCurveTo(r * 0.9, -r * 1.35, r * 1.35, -r * 1.2);
      ctx.stroke();
      ctx.restore();

      /* 口部强光（蓄力时炸开） */
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'lighter';
      D.glow(ctx, x + Math.cos(ma) * r * 0.78, y + Math.sin(ma) * r * 0.78,
        e.tele > 0 ? r * 2.4 : r * 1.2, '#ffd166', e.tele > 0 ? 0.95 : 0.55);
      /* 诱饵灯 */
      var ax = x + Math.cos(ma) * r * 1.32 - Math.sin(ma) * r * 1.2;
      var ay = y + Math.sin(ma) * r * 1.32 + Math.cos(ma) * r * 1.2;
      D.glow(ctx, ax, ay, r * 0.85, '#ffd166', 0.85);
      ctx.fillStyle = '#fff6d8';
      ctx.beginPath(); ctx.arc(ax, ay, 2.6, 0, U.TAU); ctx.fill();
      ctx.restore();

    } else if (e.type === 'swarm') {
      /* 磷虾：小、快、成群，拖一条尾迹 */
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = a * 0.55;
      D.glow(ctx, x, y, r * 2.4, '#7dffd0', 0.5);
      ctx.restore();
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(e.angle || 0);
      ctx.globalAlpha = a;
      ctx.fillStyle = '#0a2630';
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.15, r * 0.72, 0, 0, U.TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(125,255,208,0.85)';
      ctx.lineWidth = 1.1;
      ctx.stroke();
      /* 尾扇 */
      ctx.beginPath();
      ctx.moveTo(-r * 0.9, 0);
      ctx.lineTo(-r * 2.0, -r * 0.8);
      ctx.lineTo(-r * 1.5, 0);
      ctx.lineTo(-r * 2.0, r * 0.8);
      ctx.closePath();
      ctx.fillStyle = 'rgba(125,255,208,0.30)';
      ctx.fill();
      ctx.fillStyle = '#ccfff0';
      ctx.beginPath(); ctx.arc(r * 0.55, 0, 1.5, 0, U.TAU); ctx.fill();
      ctx.restore();

    } else if (e.type === 'veil') {
      /* 帷幕：合拢时是一块深色斗篷，展开时露出三只眼和一排牙 */
      var open = e.open ? 1 : 0;
      var breathe = 1 + Math.sin(e.t * 2.2) * 0.05;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(e.angle || 0);

      /* 斗篷本体 */
      var vg = ctx.createRadialGradient(-r * 0.2, -r * 0.2, r * 0.2, 0, 0, r * 1.25 * breathe);
      vg.addColorStop(0, 'rgba(46,20,58,0.98)');
      vg.addColorStop(0.65, 'rgba(18,8,24,0.96)');
      vg.addColorStop(1, 'rgba(8,4,12,0.9)');
      ctx.fillStyle = vg;
      ctx.beginPath();
      ctx.moveTo(r * 1.05, 0);
      ctx.quadraticCurveTo(r * 0.5, -r * 1.15, -r * 0.5, -r * 1.02);
      ctx.quadraticCurveTo(-r * 1.35, -r * 0.4, -r * 1.1, 0);
      ctx.quadraticCurveTo(-r * 1.35, r * 0.4, -r * 0.5, r * 1.02);
      ctx.quadraticCurveTo(r * 0.5, r * 1.15, r * 1.05, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = e.open ? 'rgba(180,120,255,0.7)' : 'rgba(120,80,150,0.35)';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      /* 合拢：只有一道缝 */
      if (!e.open) {
        ctx.strokeStyle = 'rgba(150,100,190,0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(r * 0.95, 0);
        ctx.lineTo(-r * 0.9, 0);
        ctx.stroke();
      } else {
        /* 展开：三只眼 + 牙 */
        ctx.globalCompositeOperation = 'lighter';
        for (var vi = -1; vi <= 1; vi++) {
          var ex = r * 0.55, ey = vi * r * 0.36;
          D.glow(ctx, ex, ey, 9, '#c98bff', 0.85);
          ctx.fillStyle = '#f0dcff';
          ctx.beginPath(); ctx.arc(ex, ey, 2.2, 0, U.TAU); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'rgba(230,220,255,0.9)';
        for (var t2 = 0; t2 < 5; t2++) {
          var ty = -r * 0.3 + t2 * r * 0.15;
          ctx.beginPath();
          ctx.moveTo(r * 0.62, ty);
          ctx.lineTo(r * 0.86, ty + r * 0.06);
          ctx.lineTo(r * 0.62, ty + r * 0.12);
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.restore();

    } else if (e.type === 'decoy') {
      ctx.save();
      ctx.globalAlpha = a * 0.8;
      ctx.globalCompositeOperation = 'lighter';
      D.glow(ctx, x, y, 18, C.decoy, 0.75);
      ctx.fillStyle = '#c9a8c0';
      ctx.beginPath(); ctx.arc(x, y, 3, 0, U.TAU); ctx.fill();
      ctx.restore();
    }

    /* 受击闪白 */
    if (e.flash > 0 && a > 0.2) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, e.flash * 12) * a;
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(x, y, r * 1.05, 0, U.TAU); ctx.fill();
      ctx.restore();
    }

    /* 血条 */
    if (e.hp < e.maxHp && e.type !== 'decoy') {
      var w = e.elite ? 44 : 22;
      var hh = e.elite ? 3 : 2;
      var yy = y - e.r - 9;
      ctx.save();
      ctx.globalAlpha = a * (e.flash > 0 ? 1 : 0.55);
      ctx.fillStyle = 'rgba(255,79,163,0.16)';
      ctx.fillRect(x - w / 2, yy, w, hh);
      ctx.fillStyle = C.enemy;
      ctx.fillRect(x - w / 2, yy, w * Math.max(0, e.hp / e.maxHp), hh);
      ctx.restore();
    }

    ctx.restore();
  }

  /* 骸骨鲸：横着漂的一座骨头山，只有眼睛是软的 */
  function drawWhaleBody(ctx, b) {
    var r = b.r, d = (b.dir < 0 ? -1 : 1), t = b.t;
    ctx.save();
    ctx.scale(d, 1);

    /* 尾鳍：三根骨刺 */
    ctx.save();
    ctx.strokeStyle = 'rgba(206,222,255,0.26)';
    ctx.lineWidth = 3.4;
    ctx.lineCap = 'round';
    for (var f = 0; f < 3; f++) {
      var fy = (f - 1) * r * 0.30;
      ctx.beginPath();
      ctx.moveTo(-r * 0.9, fy * 0.35);
      ctx.quadraticCurveTo(-r * 1.45, fy * 1.1, -r * 1.92, fy * 1.9);
      ctx.stroke();
    }
    ctx.restore();

    /* 脊柱：一排椎骨 */
    for (var v = 0; v < 6; v++) {
      var vx = -r * (0.05 + v * 0.26);
      var vy = -r * (0.52 - v * 0.055) + Math.sin(t * 0.9 + v * 0.6) * 3;
      var vr = r * (0.115 - v * 0.008);
      ctx.beginPath();
      ctx.arc(vx, vy, vr, 0, U.TAU);
      ctx.fillStyle = 'rgba(24,30,46,0.9)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(200,218,252,0.30)';
      ctx.lineWidth = 1.8;
      ctx.stroke();
      /* 背刺 */
      ctx.beginPath();
      ctx.moveTo(vx, vy - vr);
      ctx.lineTo(vx + r * 0.04, vy - vr - r * 0.11);
      ctx.strokeStyle = 'rgba(200,218,252,0.22)';
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }

    /* 肋骨 */
    for (var q = 0; q < 4; q++) {
      var rx = -r * (0.12 + q * 0.22);
      var rh = r * (0.50 - q * 0.05);
      ctx.beginPath();
      ctx.ellipse(rx, r * 0.12, r * 0.085, rh, 0, Math.PI * 0.06, Math.PI * 0.94);
      ctx.strokeStyle = 'rgba(192,210,246,0.20)';
      ctx.lineWidth = 2.2;
      ctx.stroke();
    }

    /* 颅骨：吻端在前，颅腔在后 */
    var bg = ctx.createLinearGradient(r * 1.2, -r * 0.3, -r * 0.9, r * 0.4);
    bg.addColorStop(0, 'rgba(34,42,62,0.97)');
    bg.addColorStop(0.5, 'rgba(22,28,44,0.97)');
    bg.addColorStop(1, 'rgba(10,14,24,0.98)');
    ctx.beginPath();
    ctx.moveTo(r * 1.42, r * 0.10);
    ctx.quadraticCurveTo(r * 0.86, -r * 0.60, r * 0.05, -r * 0.68);
    ctx.quadraticCurveTo(-r * 0.70, -r * 0.60, -r * 0.96, -r * 0.02);
    ctx.quadraticCurveTo(-r * 0.70, r * 0.54, -r * 0.05, r * 0.60);
    ctx.quadraticCurveTo(r * 0.84, r * 0.54, r * 1.42, r * 0.10);
    ctx.closePath();
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.strokeStyle = 'rgba(206,222,255,0.42)';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    /* 下颌 + 鲸须 */
    ctx.beginPath();
    ctx.moveTo(r * 1.30, r * 0.24);
    ctx.quadraticCurveTo(r * 0.60, r * 0.90, -r * 0.34, r * 0.76);
    ctx.lineTo(-r * 0.34, r * 0.54);
    ctx.quadraticCurveTo(r * 0.56, r * 0.62, r * 1.20, r * 0.12);
    ctx.closePath();
    ctx.fillStyle = 'rgba(12,16,26,0.95)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(206,222,255,0.30)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    for (var th = 0; th < 8; th++) {
      var tk = th / 7;
      var tx = r * (1.12 - tk * 1.42);
      var ty = r * (0.28 + Math.sin(tk * Math.PI) * 0.34);
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx - r * 0.03, ty + r * 0.16);
      ctx.strokeStyle = 'rgba(226,236,255,0.5)';
      ctx.lineWidth = 1.8;
      ctx.stroke();
    }

    /* 骨缝里的蓝光 */
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var s2 = 0; s2 < 4; s2++) {
      var sy = -r * 0.34 + s2 * r * 0.22;
      ctx.strokeStyle = U.rgba(b.color, 0.14 + Math.sin(t * 2 + s2 * 1.3) * 0.06);
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-r * 0.55, sy * 0.7);
      ctx.quadraticCurveTo(r * 0.15, sy, r * 0.85, sy * 0.55);
      ctx.stroke();
    }
    ctx.restore();

    ctx.restore();
  }

  /* 镜像体的两个假身 */
  function drawMirrorGhost(ctx, b, px, py, alpha) {
    var r = b.r;
    ctx.save();
    ctx.globalAlpha = alpha;
    var g = ctx.createRadialGradient(px - r * 0.3, py - r * 0.3, r * 0.12, px, py, r);
    g.addColorStop(0, U.rgba(b.color, 0.42));
    g.addColorStop(0.55, 'rgba(14,26,34,0.9)');
    g.addColorStop(1, 'rgba(5,12,18,0.72)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(px, py, r, r, 0, 0, U.TAU);
    ctx.fill();
    ctx.strokeStyle = U.rgba(b.color, 0.42);
    ctx.lineWidth = 1.8;
    ctx.stroke();
    /* 假身：没有转环，核心是空心的 */
    ctx.globalCompositeOperation = 'lighter';
    D.glow(ctx, px, py, r * 0.55, b.color, 0.22);
    ctx.strokeStyle = 'rgba(10,20,26,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, r * 0.16, 0, U.TAU);
    ctx.stroke();
    ctx.restore();
  }

  function drawBoss(ctx, b) {
    if (!b || b.dead) return;
    var x = b.x, y = b.y, r = b.r;
    var pulse = 0.6 + Math.sin(G.t * 3) * 0.15;

    /* 「镜」：先把两个假身画在各自的锚点上，本体随后照常画 */
    if (b.id === 'mirror' && b.anchors) {
      for (var mg = 0; mg < 3; mg++) {
        if (mg === b.cur) continue;
        drawMirrorGhost(ctx, b, b.anchors[mg][0], b.anchors[mg][1],
          0.26 + Math.sin(G.t * 1.6 + mg * 2) * 0.05);
      }
    }

    /* 外发光 */
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    D.glow(ctx, x, y, r * 1.35, b.color, b.flash > 0 ? 0.9 : 0.26 * pulse);
    ctx.restore();

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(G.t * 0.7) * 0.04);

    if (b.id === 'whale') {
      drawWhaleBody(ctx, b);
      /* 眼睛：唯一的弱点（眼窝 + 竖瞳） */
      var wEye = DL.whaleEye ? DL.whaleEye(b) : { x: b.x, y: b.y };
      var ex = wEye.x - x, ey = wEye.y - y;
      ctx.save();
      ctx.fillStyle = 'rgba(6,10,18,0.92)';
      ctx.beginPath();
      ctx.ellipse(ex, ey, 23, 25, b.eyeA, 0, U.TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(190,214,255,0.55)';
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      D.glow(ctx, ex, ey, 34 + Math.sin(G.t * 5) * 6, '#dff0ff', 0.7);
      ctx.fillStyle = '#f2fbff';
      ctx.beginPath();
      ctx.ellipse(ex, ey, 8, 10, b.eyeA, 0, U.TAU);
      ctx.fill();
      ctx.fillStyle = '#0a1220';
      ctx.beginPath();
      ctx.ellipse(ex, ey, 3, 5, b.eyeA, 0, U.TAU);
      ctx.fill();
      /* 弱点指示：一圈断续的准星环 */
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = 'rgba(220,238,255,' + (0.30 + Math.sin(G.t * 3) * 0.12) + ')';
      ctx.lineWidth = 1.6;
      for (var wk = 0; wk < 4; wk++) {
        var wa = G.t * 0.9 + wk * Math.PI / 2;
        ctx.beginPath();
        ctx.arc(ex, ey, 38, wa, wa + 0.5);
        ctx.stroke();
      }
      ctx.restore();
      ctx.restore();
      if (b.flash > 0) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, b.flash * 10);
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.ellipse(x, y, r * 1.42, r * 0.72, 0, 0, U.TAU); ctx.fill();
        ctx.restore();
      }
      return;
    }

    /* ---------- 触手 / 附肢：先画，压在本体下面 ---------- */
    if (b.id === 'ying' || b.id === 'mo') {
      var tent = b.id === 'ying' ? 6 : 8;
      for (var i = 0; i < tent; i++) {
        var a = b.tentA + i * U.TAU / tent;
        var len = r * (b.id === 'ying' ? 2.0 : 1.7) * (0.85 + Math.sin(b.tentA * 0.7 + i) * 0.15);
        var sway = Math.sin(b.tentA + i * 1.7) * 0.35;
        var w0 = b.id === 'ying' ? 7 : 5;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7);
        ctx.quadraticCurveTo(
          Math.cos(a + sway * 0.5) * len * 0.6, Math.sin(a + sway * 0.5) * len * 0.6,
          Math.cos(a + sway) * len, Math.sin(a + sway) * len);
        ctx.strokeStyle = U.rgba(b.color, 0.30);
        ctx.lineWidth = w0;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.strokeStyle = U.rgba(b.color, 0.75);
        ctx.lineWidth = w0 * 0.32;
        ctx.stroke();
      }
    }

    if (b.id === 'deng') {
      /* 鮟鱇王：上颚 + 灯笼杆 */
      ctx.strokeStyle = U.rgba(b.color, 0.6);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-r * 0.3, -r * 0.9);
      ctx.quadraticCurveTo(r * 0.2, -r * 1.9, r * 1.05, -r * 1.75);
      ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      D.glow(ctx, r * 1.05, -r * 1.75, 30 + Math.sin(G.t * 4) * 6, '#ffd166', 0.75);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#fff3c4';
      ctx.beginPath(); ctx.arc(r * 1.05, -r * 1.75, 5, 0, U.TAU); ctx.fill();
    }

    if (b.id === 'yuan') {
      /* 热泉巨蠕虫：体节环 */
      for (var s2 = 3; s2 >= 1; s2--) {
        ctx.beginPath();
        ctx.ellipse(0, s2 * r * 0.42, r * (1 - s2 * 0.08), r * 0.5, 0, 0, U.TAU);
        ctx.fillStyle = 'rgba(40,14,10,' + (0.5 - s2 * 0.1) + ')';
        ctx.fill();
        ctx.strokeStyle = U.rgba(b.color, 0.25);
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    /* 「潮」：三层潮汐弧，每放一波浪墙就亮一次 */
    if (b.id === 'chao') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (var cr = 0; cr < 3; cr++) {
        var ck = (b.t * 0.55 + cr / 3) % 1;
        ctx.strokeStyle = U.rgba(b.color, 0.22 * (1 - ck));
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(0, 0, r * (1.1 + ck * 0.9), b.gapA + 1.0, b.gapA + U.TAU - 1.0);
        ctx.stroke();
      }
      /* 缺口方向：一道亮楔（只在新的一波刚放出来时提示，之后靠肉眼找开口） */
      var cga = (b.lastGap || 0);
      var wfade = Math.max(0, 1 - (b.waveT || 0) / 1.4);
      if (wfade > 0.01) {
        ctx.strokeStyle = U.rgba(b.color, 0.88 * wfade);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(Math.cos(cga - 0.13) * r * 1.05, Math.sin(cga - 0.13) * r * 1.05);
        ctx.lineTo(Math.cos(cga - 0.26) * r * 2.0, Math.sin(cga - 0.26) * r * 2.0);
        ctx.moveTo(Math.cos(cga + 0.13) * r * 1.05, Math.sin(cga + 0.13) * r * 1.05);
        ctx.lineTo(Math.cos(cga + 0.26) * r * 2.0, Math.sin(cga + 0.26) * r * 2.0);
        ctx.stroke();
      }
      ctx.restore();
    }

    /* 「眠」：身体外围包一层梦雾 */
    if (b.id === 'mian') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (var mf2 = 0; mf2 < 3; mf2++) {
        var mr = r * (1.25 + mf2 * 0.3) + Math.sin(b.t * 0.8 + mf2) * 5;
        ctx.strokeStyle = U.rgba('#cfe9ff', 0.12 - mf2 * 0.03);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, mr, mf2 * 1.4, mf2 * 1.4 + U.TAU * 0.75);
        ctx.stroke();
      }
      ctx.restore();
    }

    /* 「锈」：拖着几块船板，冲撞前腹部裂口发亮 */
    if (b.id === 'xiu') {
      for (var pl = 0; pl < 5; pl++) {
        var pa = b.t * 0.4 + pl * U.TAU / 5 + 0.4;
        var pd = r * (1.15 + (pl % 3) * 0.16);
        ctx.save();
        ctx.translate(Math.cos(pa) * pd, Math.sin(pa) * pd * 0.8);
        ctx.rotate(pa * 1.7);
        ctx.fillStyle = 'rgba(34,22,18,0.9)';
        ctx.strokeStyle = 'rgba(190,120,80,0.35)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-8, -5); ctx.lineTo(9, -3); ctx.lineTo(7, 6); ctx.lineTo(-6, 5);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      if (b.st === 'tele') {
        var tk = 1 - Math.max(0, b.stT) / 0.95;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        D.glow(ctx, 0, 0, r * (0.5 + tk * 0.9), b.color, 0.35 + tk * 0.55);
        ctx.restore();
      }
    }

    /* 「晶」：本体外面一圈六角棱 */
    if (b.id === 'crystal') {
      ctx.save();
      ctx.strokeStyle = U.rgba(b.color, 0.22);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (var cg2 = 0; cg2 < 6; cg2++) {
        var ca = b.tentA * 0.5 + cg2 * U.TAU / 6;
        var cp = r * 2.5;
        if (cg2 === 0) ctx.moveTo(Math.cos(ca) * cp, Math.sin(ca) * cp);
        else ctx.lineTo(Math.cos(ca) * cp, Math.sin(ca) * cp);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    /* ---------- 本体 ---------- */
    var bodyG = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.15, 0, 0, r);
    if (b.id === 'guangni') {
      bodyG.addColorStop(0, '#1a0f2a');
      bodyG.addColorStop(0.6, '#08040f');
      bodyG.addColorStop(1, '#000000');
    } else if (b.id === 'chao') {
      bodyG.addColorStop(0, U.rgba(b.color, 0.62));
      bodyG.addColorStop(0.45, 'rgba(8,32,34,0.96)');
      bodyG.addColorStop(1, 'rgba(3,14,18,0.98)');
    } else {
      bodyG.addColorStop(0, U.rgba(b.color, 0.55));
      bodyG.addColorStop(0.45, 'rgba(22,10,26,0.96)');
      bodyG.addColorStop(1, 'rgba(8,4,12,0.98)');
    }
    ctx.fillStyle = bodyG;
    ctx.beginPath();
    if (b.id === 'xiu') {
      /* 锈：不规则的铁壳 */
      var seg = 9;
      for (var xs = 0; xs < seg; xs++) {
        var xa = xs * U.TAU / seg;
        var xr = r * (0.82 + ((xs * 7) % 5) * 0.06);
        if (xs === 0) ctx.moveTo(Math.cos(xa) * xr, Math.sin(xa) * xr);
        else ctx.lineTo(Math.cos(xa) * xr, Math.sin(xa) * xr);
      }
      ctx.closePath();
    } else if (b.id === 'crystal') {
      /* 晶：六边形结晶 */
      for (var ys = 0; ys < 6; ys++) {
        var ya = b.tentA * 0.3 + ys * U.TAU / 6;
        var yr = r * (ys % 2 ? 0.86 : 1);
        if (ys === 0) ctx.moveTo(Math.cos(ya) * yr, Math.sin(ya) * yr);
        else ctx.lineTo(Math.cos(ya) * yr, Math.sin(ya) * yr);
      }
      ctx.closePath();
    } else {
      ctx.ellipse(0, 0, r, r * (b.id === 'mo' ? 0.86 : 1), 0, 0, U.TAU);
    }
    ctx.fill();
    ctx.strokeStyle = U.rgba(b.color, 0.65);
    ctx.lineWidth = 2.4;
    ctx.stroke();

    /* 表面纹路 */
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = U.rgba(b.color, 0.8);
    ctx.lineWidth = 1;
    for (var q = 0; q < 3; q++) {
      ctx.beginPath();
      ctx.ellipse(0, 0, r * (0.55 + q * 0.15), r * (0.4 + q * 0.18), b.tentA * 0.2 + q, 0, U.TAU);
      ctx.stroke();
    }
    ctx.restore();

    /* 眼 / 核心 */
    ctx.globalCompositeOperation = 'lighter';
    if (b.id === 'guangni') {
      /* 终末体：一只竖瞳 */
      D.glow(ctx, 0, 0, r * 0.55, '#b06bff', 0.5);
      ctx.fillStyle = '#f4e9ff';
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.10, r * 0.34, 0, 0, U.TAU);
      ctx.fill();
      /* 外部转环 */
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = 'rgba(200,160,255,0.5)';
      ctx.lineWidth = 1.5;
      for (var ring = 0; ring < 2; ring++) {
        ctx.beginPath();
        ctx.ellipse(0, 0, r * (1.28 + ring * 0.16), r * (0.34 + ring * 0.1),
          G.t * (0.4 + ring * 0.25), 0, U.TAU);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'lighter';
    } else if (b.id === 'deng') {
      /* 大嘴：一排牙 + 两个小眼 */
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(60,24,10,0.95)';
      ctx.beginPath();
      ctx.moveTo(-r * 0.65, r * 0.05);
      ctx.quadraticCurveTo(0, r * 0.62, r * 0.75, r * 0.02);
      ctx.quadraticCurveTo(0, r * 0.22, -r * 0.65, r * 0.05);
      ctx.fill();
      ctx.fillStyle = '#ffe9b8';
      for (var tth = 0; tth < 7; tth++) {
        var tx2 = -r * 0.55 + tth * r * 0.19;
        ctx.beginPath();
        ctx.moveTo(tx2, r * 0.08);
        ctx.lineTo(tx2 + r * 0.05, r * 0.26);
        ctx.lineTo(tx2 + r * 0.11, r * 0.08);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'lighter';
      D.glow(ctx, -r * 0.35, -r * 0.3, 12, '#ffd166', 0.8);
      D.glow(ctx, r * 0.25, -r * 0.35, 12, '#ffd166', 0.8);
    } else if (b.id === 'qun') {
      /* 珊瑚群：多个发光孔洞 */
      for (var hole = 0; hole < 5; hole++) {
        var ha = hole * U.TAU / 5 + b.tentA * 0.3;
        var hr = r * (0.25 + (hole % 2) * 0.22);
        D.glow(ctx, Math.cos(ha) * hr, Math.sin(ha) * hr, r * 0.22, b.color, 0.6);
      }
    } else if (b.id === 'chao') {
      /* 潮：核心是一个不断收缩的水囊 */
      var ck2 = 0.72 + Math.sin(b.t * 2.4) * 0.12;
      D.glow(ctx, 0, 0, r * ck2, b.color, 0.5);
      ctx.fillStyle = 'rgba(225,255,250,0.75)';
      ctx.beginPath(); ctx.arc(0, 0, r * 0.16, 0, U.TAU); ctx.fill();
      ctx.strokeStyle = U.rgba(b.color, 0.55);
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.42, 0, U.TAU); ctx.stroke();
    } else if (b.id === 'mian') {
      /* 眠：一条闭着的眼缝 */
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = 'rgba(226,242,255,0.85)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, -r * 0.06, r * 0.34, 0.35, Math.PI - 0.35);
      ctx.stroke();
      for (var lash = 0; lash < 5; lash++) {
        var la = 0.55 + lash * 0.5;
        ctx.beginPath();
        ctx.moveTo(Math.cos(la) * r * 0.34, -r * 0.06 + Math.sin(la) * r * 0.34 * 0.6);
        ctx.lineTo(Math.cos(la) * r * 0.48, -r * 0.02 + Math.sin(la) * r * 0.48 * 0.6);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'lighter';
      D.glow(ctx, 0, -r * 0.1, r * 0.7, '#cfe9ff', 0.10 + b.slowA * 0.22);
    } else if (b.id === 'mirror') {
      /* 镜：本体有一圈会转的识别环（假身没有） */
      D.glow(ctx, 0, 0, r * 0.5, b.color, 0.55);
      ctx.fillStyle = 'rgba(236,255,255,0.9)';
      ctx.beginPath(); ctx.arc(0, 0, r * 0.11, 0, U.TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = U.rgba(b.color, 0.75);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.62, b.tentA, b.tentA + 2.2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.62, b.tentA + Math.PI, b.tentA + Math.PI + 2.2);
      ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
    } else if (b.id === 'crystal') {
      /* 晶：本体是棱镜，光从内部折出来 */
      var ckp = b.partsAlive === 0 ? 0.9 : 0.55;
      D.glow(ctx, 0, 0, r * 0.8, b.color, ckp);
      ctx.fillStyle = 'rgba(240,255,255,0.88)';
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.34);
      ctx.lineTo(r * 0.2, 0);
      ctx.lineTo(0, r * 0.34);
      ctx.lineTo(-r * 0.2, 0);
      ctx.closePath();
      ctx.fill();
    } else {
      D.glow(ctx, 0, 0, r * 0.42, b.color, b.vulnerable ? 0.6 : 0.28);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath(); ctx.arc(0, 0, r * 0.09, 0, U.TAU); ctx.fill();
    }
    ctx.restore();

    /* 受击闪 */
    if (b.flash > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, b.flash * 10);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(x, y, r * 1.02, 0, U.TAU); ctx.fill();
      ctx.restore();
    }

    // 炮茧
    if (b.id === 'qun') {
      for (var k = 0; k < b.parts.length; k++) {
        var pt = b.parts[k];
        if (pt.dead) continue;
        ctx.save();
        ctx.translate(pt.x, pt.y);
        ctx.fillStyle = 'rgba(10,20,26,0.95)';
        ctx.beginPath(); ctx.arc(0, 0, pt.r, 0, U.TAU); ctx.fill();
        ctx.strokeStyle = U.rgba(b.color, 0.7);
        ctx.lineWidth = 2; ctx.stroke();
        ctx.restore();
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        D.glow(ctx, pt.x, pt.y, pt.r * 2.2, b.color, 0.4);
        ctx.restore();
        var w2 = 40;
        ctx.fillStyle = 'rgba(255,79,163,0.18)';
        ctx.fillRect(pt.x - w2 / 2, pt.y - pt.r - 10, w2, 3);
        ctx.fillStyle = C.enemy;
        ctx.fillRect(pt.x - w2 / 2, pt.y - pt.r - 10, w2 * Math.max(0, pt.hp / pt.maxHp), 3);
      }
    }

    // 晶簇
    if (b.id === 'crystal') {
      for (var kc = 0; kc < b.parts.length; kc++) {
        var ct = b.parts[kc];
        if (ct.dead) continue;
        ctx.save();
        ctx.translate(ct.x, ct.y);
        ctx.rotate(b.tentA * 0.6 + kc);
        ctx.fillStyle = 'rgba(8,30,40,0.94)';
        ctx.strokeStyle = U.rgba(b.color, 0.8);
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(0, -ct.r);
        ctx.lineTo(ct.r * 0.62, 0);
        ctx.lineTo(0, ct.r);
        ctx.lineTo(-ct.r * 0.62, 0);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.restore();
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        D.glow(ctx, ct.x, ct.y, ct.r * 2.4, b.color, 0.34);
        ctx.restore();
      }
      /* 全碎后的停摆指示 */
      if (b.partsAlive === 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        D.glow(ctx, x, y, r * 2.4, b.color, 0.18 + Math.sin(G.t * 6) * 0.08);
        ctx.restore();
      }
    }
  }

  function drawPlayer(ctx) {
    var p = DL.PL;
    if (!p.alive) return;
    var s = p.stats;

    /* 血条颜色：高/中/低 三档，同时驱动自机的识别色 */
    var ratio = p.maxHp > 0 ? p.hp / p.maxHp : 1;
    var body = ratio <= 0.25 ? '#ff4d6d' : (ratio <= 0.5 ? C.gold : C.self);
    var lowPulse = ratio <= 0.5 ? (0.55 + Math.sin(G.t * 9) * 0.45) : 1;

    /* 1. 识别环：分段圆环 = 船体血量，谁都能一眼读懂 */
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    D.glow(ctx, p.x, p.y, 52, body, 0.06 + 0.035 * lowPulse);
    var segs = Math.max(1, Math.round(p.maxHp));
    var step = U.TAU / segs;
    var gapA = Math.min(0.22, step * 0.22);
    for (var sg = 0; sg < segs; sg++) {
      var a0 = -Math.PI / 2 + sg * step + gapA * 0.5;
      var a1 = a0 + step - gapA;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 26, a0, a1);
      if (sg < p.hp) {
        ctx.strokeStyle = U.rgba(sg === p.hp - 1 ? body : body, 0.85 * lowPulse);
        ctx.lineWidth = 3.2;
      } else {
        ctx.strokeStyle = 'rgba(220,245,255,0.10)';
        ctx.lineWidth = 2.6;
      }
      ctx.stroke();
    }
    // 朝向指示：正前方一小段亮弧
    ctx.strokeStyle = U.rgba(body, 0.9 * lowPulse);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 34, p.aim - 0.13, p.aim + 0.13);
    ctx.stroke();
    ctx.restore();

    /* 2. 残影：高速移动时拖出三道 */
    var spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    if (spd > 40) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (var g = 1; g <= 3; g++) {
        var gx = p.x - p.vx * 0.016 * g;
        var gy = p.y - p.vy * 0.016 * g;
        ctx.globalAlpha = 0.10 / g;
        ctx.strokeStyle = body;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(gx, gy, 15 - g, 0, U.TAU);
        ctx.stroke();
      }
      ctx.restore();
    }

    /* 3. 船体 */
    // 先压一块暗底，避免被自己的灯锥洗掉
    ctx.save();
    var dg = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, 26);
    dg.addColorStop(0, 'rgba(2,10,14,0.72)');
    dg.addColorStop(0.72, 'rgba(2,10,14,0.5)');
    dg.addColorStop(1, 'rgba(2,10,14,0)');
    ctx.fillStyle = dg;
    ctx.beginPath(); ctx.arc(p.x, p.y, 26, 0, U.TAU); ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.aim);
    ctx.scale(1.12, 1.12);
    if (p.recoil > 0) ctx.translate(-p.recoil * 2.2, 0);

    // 推进器
    if (p.thrust > 0.05) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (var i2 = 0; i2 < 3; i2++) {
        var k2 = i2 / 3;
        D.glow(ctx, -17 - k2 * 20, 0, 9 - k2 * 2.5, body, 0.26 * p.thrust * (1 - k2));
      }
      ctx.restore();
    }

    // 灯臂
    var armG = ctx.createLinearGradient(3, 0, 20, 0);
    armG.addColorStop(0, 'rgba(32,72,82,0.95)');
    armG.addColorStop(1, 'rgba(14,34,40,0.95)');
    ctx.fillStyle = armG;
    ctx.fillRect(3, -3.5, 15, 7);
    ctx.fillStyle = U.rgba(body, 0.9);
    ctx.fillRect(16, -2.5, 3.5, 5);
    ctx.fillStyle = '#eafffb';
    ctx.fillRect(19, -1.4, 1.6, 2.8);

    // 船体轮廓：对称飞镖形，前尖后掠
    ctx.beginPath();
    ctx.moveTo(23, 0);
    ctx.lineTo(6, -8);
    ctx.lineTo(-6, -17);
    ctx.lineTo(-11, -7);
    ctx.lineTo(-8, 0);
    ctx.lineTo(-11, 7);
    ctx.lineTo(-6, 17);
    ctx.lineTo(6, 8);
    ctx.closePath();
    var hullG = ctx.createLinearGradient(-12, -17, 10, 17);
    hullG.addColorStop(0, '#12505d');
    hullG.addColorStop(0.5, '#0d3a44');
    hullG.addColorStop(1, '#07222a');
    ctx.fillStyle = hullG;
    ctx.fill();
    ctx.strokeStyle = p.ifr > 0 && Math.floor(G.t * 24) % 2 === 0 ? '#ffffff' : body;
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // 鳍面高光
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = U.rgba(body, 0.5);
    ctx.beginPath();
    ctx.moveTo(6, -8); ctx.lineTo(-6, -17); ctx.lineTo(-8, -7); ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(6, 8); ctx.lineTo(-6, 17); ctx.lineTo(-8, 7); ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 中脊 + 舷侧板线
    ctx.strokeStyle = U.rgba(body, 0.35);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(18, 0); ctx.lineTo(-8, 0);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(120,220,215,0.18)';
    ctx.beginPath();
    ctx.moveTo(2, -6.5); ctx.lineTo(-5, -12);
    ctx.moveTo(2, 6.5); ctx.lineTo(-5, 12);
    ctx.stroke();

    // 座舱
    var cockpit = ctx.createRadialGradient(4, -1, 0.5, 4, 0, 5);
    cockpit.addColorStop(0, '#ffffff');
    cockpit.addColorStop(0.45, U.rgba(body, 0.95));
    cockpit.addColorStop(1, U.rgba(body, 0.25));
    ctx.fillStyle = cockpit;
    ctx.beginPath(); ctx.ellipse(4, 0, 4.4, 3.4, 0, 0, U.TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.arc(5, -0.6, 1.4, 0, U.TAU); ctx.fill();

    ctx.restore();

    /* 4. 护盾 */
    if (p.shield > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (var k = 0; k < p.shield; k++) {
        ctx.strokeStyle = U.rgba(C.self, 0.38 - k * 0.12);
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 24 + k * 5, 0, U.TAU);
        ctx.stroke();
      }
      ctx.restore();
    }

    /* 5. 无敌帧提示 */
    if (p.ifr > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = U.rgba('#ffffff', 0.25 + Math.sin(G.t * 20) * 0.15);
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(p.x, p.y, 33, 0, U.TAU); ctx.stroke();
      ctx.restore();
    }
  }

  /* ---------------- 光照叠加 ---------------- */
  var coneTex = null, coneTexKey = '';

  /* 把九片扇形烘成一张贴图：九次渐变填充 → 一次 drawImage */
  function coneTexture(L, half) {
    var key = Math.round(L) + '|' + Math.round(half * 200);
    if (coneTex && coneTexKey === key) return coneTex;
    var bs = 0.5;                       // 半分辨率就够，渐变很平滑
    var ox = 8;
    var h = L * Math.sin(half) * 2 + 16;
    var w = L + 16;
    try {
      var cv = document.createElement('canvas');
      cv.width = Math.max(8, Math.ceil(w * bs));
      cv.height = Math.max(8, Math.ceil(h * bs));
      var c = cv.getContext('2d');
      c.scale(bs, bs);
      c.translate(ox, h / 2);
      var grad = c.createRadialGradient(0, 0, 12, 0, 0, L);
      grad.addColorStop(0, U.rgba(C.self, 1));
      grad.addColorStop(0.45, U.rgba(C.self, 0.5));
      grad.addColorStop(1, U.rgba(C.self, 0));
      c.fillStyle = grad;
      c.globalCompositeOperation = 'lighter';
      var steps = 9;
      for (var si = 0; si < steps; si++) {
        var f0 = si / steps, f1 = (si + 1) / steps;
        var mid = (f0 + f1) / 2;
        c.globalAlpha = Math.pow(Math.cos((mid - 0.5) * Math.PI), 1.15);
        c.beginPath();
        c.moveTo(0, 0);
        c.arc(0, 0, L, -half + f0 * half * 2, -half + f1 * half * 2);
        c.closePath();
        c.fill();
      }
      cv.ox = ox; cv.oy = h / 2; cv.w = w; cv.h = h;
      coneTex = cv;
      coneTexKey = key;
    } catch (e) { coneTex = null; }
    return coneTex;
  }

  function drawLight(ctx) {
    var p = DL.PL, s = p.stats;
    if (!p.alive) return;
    var lightK = DL.save.get().settings.coneLight / 100;
    var hpK = p.hp <= p.maxHp * 0.4 ? 0.72 + Math.sin(G.t * 9) * 0.12 : 1;
    var off = G.pingDark > 0 ? Math.max(0, 1 - G.pingDark / T.sonar.pingDark) : 1;
    if (off < 0.05) off = 0;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    if (s.eye) {
      D.glow(ctx, p.x, p.y, 210, C.self, 0.3 * lightK * hpK);
    } else {
      // 近距弱光
      D.glow(ctx, p.x, p.y, s.nearR * 1.05, C.self, 0.09 * lightK * hpK);
      // 灯锥体积光：整锥烘成一张贴图，每帧只做一次 drawImage
      var L = s.coneLen, half = s.coneAng * 0.5;
      var tex = coneTexture(L, half);
      if (tex) {
        var a0 = 0.22 * lightK * hpK * off;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.aim);
        ctx.globalAlpha = a0;
        ctx.drawImage(tex, -tex.ox, -tex.oy, tex.w, tex.h);
        ctx.globalAlpha = 1;
        // 灯口亮核
        D.glow(ctx, 0, 0, 26, C.self, 0.5 * lightK * hpK * off);
        ctx.restore();
      }
    }

    // 击杀照明
    if (G.lights) {
      for (var i = 0; i < G.lights.length; i++) {
        var L2 = G.lights[i];
        var k = Math.max(0, L2.life / Math.max(0.01, L2.max));
        D.glow(ctx, L2.x, L2.y, L2.r * (1.15 - k * 0.25), C.gold, 0.30 * k);
      }
    }

    // 声呐环
    for (var j = 0; j < G.rings.length; j++) {
      var r = G.rings[j];
      if (!r.sonar) continue;
      var kk = 1 - r.life / r.max;
      var rad = U.lerp(r.r, r.to, kk);
      var a = (1 - kk) * (1 - kk) * 0.16;
      ctx.strokeStyle = U.rgba(C.self, a * 0.3);
      ctx.lineWidth = 7;
      ctx.beginPath(); ctx.arc(r.x, r.y, rad, 0, U.TAU); ctx.stroke();
      ctx.strokeStyle = U.rgba(C.self, a);
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(r.x, r.y, rad, 0, U.TAU); ctx.stroke();
    }
    ctx.restore();
  }

  function drawRings(ctx) {
    for (var i = 0; i < G.rings.length; i++) {
      var r = G.rings[i];
      if (r.sonar) continue;
      var k = 1 - r.life / r.max;
      var rad = U.lerp(r.r, r.to, Math.min(1, k * 1.4));
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = U.rgba(r.color, (1 - k) * 0.8);
      ctx.lineWidth = r.width * (1 - k * 0.6);
      ctx.beginPath();
      ctx.arc(r.x, r.y, rad, 0, U.TAU);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawBullets(ctx) {
    var i, b;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    /* 同一透明度的一批圆合并成一条路径，一次 fill
       —— 弹幕多的时候，一帧能省掉几百次 fill() */
    if (G.bullets.length) {
      ctx.fillStyle = C.self;
      ctx.globalAlpha = 0.16;
      ctx.beginPath();
      for (i = 0; i < G.bullets.length; i++) {
        b = G.bullets[i];
        if (b.big) continue;
        var hr = b.r * 2.6;
        ctx.moveTo(b.x + hr, b.y);
        ctx.arc(b.x, b.y, hr, 0, U.TAU);
      }
      ctx.fill();

      ctx.globalAlpha = 0.38;
      ctx.beginPath();
      for (i = 0; i < G.bullets.length; i++) {
        b = G.bullets[i];
        if (b.big) continue;
        var h2 = b.r * 2.6 * 0.55;
        ctx.moveTo(b.x + h2, b.y);
        ctx.arc(b.x, b.y, h2, 0, U.TAU);
      }
      ctx.fill();

      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      for (i = 0; i < G.bullets.length; i++) {
        b = G.bullets[i];
        var cr = b.r * 0.75;
        ctx.moveTo(b.x + cr, b.y);
        ctx.arc(b.x, b.y, cr, 0, U.TAU);
      }
      ctx.fill();

      /* 大弹单独走金色三层 */
      for (i = 0; i < G.bullets.length; i++) {
        b = G.bullets[i];
        if (!b.big) continue;
        var hb = b.r * 3.6;
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = C.gold;
        ctx.beginPath(); ctx.arc(b.x, b.y, hb, 0, U.TAU); ctx.fill();
        ctx.globalAlpha = 0.45;
        ctx.beginPath(); ctx.arc(b.x, b.y, hb * 0.55, 0, U.TAU); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.75, 0, U.TAU); ctx.fill();
        ctx.fillStyle = C.self;
      }
    }

    if (G.ebullets.length) {
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = C.enemy;
      ctx.beginPath();
      for (var j = 0; j < G.ebullets.length; j++) {
        var e = G.ebullets[j];
        if (e.col) continue;
        var er = e.r * 2.6;
        ctx.moveTo(e.x + er, e.y);
        ctx.arc(e.x, e.y, er, 0, U.TAU);
      }
      ctx.fill();

      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffd0e2';
      ctx.beginPath();
      for (var k = 0; k < G.ebullets.length; k++) {
        var e2 = G.ebullets[k];
        if (e2.col) continue;
        var er2 = e2.r * 0.62;
        ctx.moveTo(e2.x + er2, e2.y);
        ctx.arc(e2.x, e2.y, er2, 0, U.TAU);
      }
      ctx.fill();

      /* 腐蚀粘液：单独上色，一眼能认出「这玩意会追人」 */
      var sludge = null;
      for (var s4 = 0; s4 < G.ebullets.length; s4++) {
        if (G.ebullets[s4].col) { sludge = s4; break; }
      }
      if (sludge !== null) {
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = '#d08a54';
        ctx.beginPath();
        for (var s5 = 0; s5 < G.ebullets.length; s5++) {
          var e3 = G.ebullets[s5];
          if (!e3.col) continue;
          var er3 = e3.r * 2.8;
          ctx.moveTo(e3.x + er3, e3.y);
          ctx.arc(e3.x, e3.y, er3, 0, U.TAU);
        }
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#ffc9a0';
        ctx.beginPath();
        for (var s6 = 0; s6 < G.ebullets.length; s6++) {
          var e4 = G.ebullets[s6];
          if (!e4.col) continue;
          var er4 = e4.r * 0.7;
          ctx.moveTo(e4.x + er4, e4.y);
          ctx.arc(e4.x, e4.y, er4, 0, U.TAU);
        }
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /* 粒子按「颜色 × 透明度档」合并成路径，一帧几十次 fill 而不是几百上千次 */
  var partBuckets = Object.create(null), partKeys = [];

  function drawParticles(ctx) {
    if (!G.parts.length) return;
    if (!partBuckets) partBuckets = Object.create(null);
    for (var k0 = 0; k0 < partKeys.length; k0++) {
      var arr0 = partBuckets[partKeys[k0]];
      arr0[0].length = 0; arr0[1].length = 0; arr0[2].length = 0; arr0[3].length = 0;
    }
    partKeys.length = 0;

    for (var i = 0; i < G.parts.length; i++) {
      var p = G.parts[i];
      var k = p.life / p.max;
      if (k <= 0) continue;
      var b = k >= 0.75 ? 3 : (k >= 0.5 ? 2 : (k >= 0.25 ? 1 : 0));
      var e = partBuckets[p.color];
      if (!e) { e = partBuckets[p.color] = [[], [], [], []]; }
      if (e[0].length + e[1].length + e[2].length + e[3].length === 0) partKeys.push(p.color);
      e[b].push(p);
    }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var A = [0.14, 0.36, 0.60, 0.85];
    for (var ki = 0; ki < partKeys.length; ki++) {
      var col = partKeys[ki];
      var arrs = partBuckets[col];
      ctx.fillStyle = col;
      for (var b2 = 0; b2 < 4; b2++) {
        var arr = arrs[b2];
        if (!arr.length) continue;
        ctx.globalAlpha = A[b2];
        ctx.beginPath();
        for (var j = 0; j < arr.length; j++) {
          var p2 = arr[j];
          var k2 = p2.life / p2.max;
          var rr = p2.r * (0.4 + k2 * 0.8);
          if (rr < 2.4) ctx.rect(p2.x - rr, p2.y - rr, rr * 2, rr * 2);
          else { ctx.moveTo(p2.x + rr, p2.y); ctx.arc(p2.x, p2.y, rr, 0, U.TAU); }
        }
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawDrops(ctx) {
    for (var i = 0; i < G.drops.length; i++) {
      var d = G.drops[i];
      var col = d.kind === 'repair' ? C.self : (d.kind === 'neon' ? '#b06bff' : '#7dffb2');
      var pulse = 1 + Math.sin(G.t * (d.kind === 'cyst' ? 7 : 4) + i) * 0.18;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      D.glow(ctx, d.x, d.y, 22 * pulse, col, 0.75);
      ctx.restore();
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      if (d.kind === 'repair') {
        ctx.beginPath();
        ctx.moveTo(-4, 0); ctx.lineTo(4, 0);
        ctx.moveTo(0, -4); ctx.lineTo(0, 4);
        ctx.stroke();
      } else if (d.kind === 'neon') {
        ctx.rotate(G.t * 1.5);
        ctx.strokeRect(-4, -4, 8, 8);
      } else {
        ctx.beginPath(); ctx.ellipse(0, 0, 6 * pulse, 8 * pulse, 0, 0, U.TAU); ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawFloats(ctx) {
    for (var i = 0; i < G.floats.length; i++) {
      var f = G.floats[i];
      var k = f.life / f.max;
      ctx.save();
      ctx.globalAlpha = Math.min(1, k * 1.6);
      D.text(ctx, f.text, f.x, f.y, f.size, f.color, 'center', 600);
      ctx.restore();
    }
  }

  function drawFogs(ctx) {
    for (var i = 0; i < G.fogs.length; i++) {
      var f = G.fogs[i];
      var k = Math.min(1, f.life / 0.6);
      var g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
      g.addColorStop(0, 'rgba(2,2,6,' + (0.97 * k) + ')');
      g.addColorStop(0.7, 'rgba(2,2,6,' + (0.86 * k) + ')');
      g.addColorStop(1, 'rgba(2,2,6,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, U.TAU);
      ctx.fill();
    }
  }

  /* ---------------- HUD ---------------- */
  function drawSonar(ctx) {
    var S = DL.S, s = S.ui;
    var R = (I_usingTouch() ? 92 : 118) * s;
    var cx = S.W - R - 18 * s;
    var cy = S.H - R - (I_usingTouch() ? 128 : 18) * s;

    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = 'rgba(3,20,30,0.62)';
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, U.TAU); ctx.fill();
    ctx.strokeStyle = U.rgba(C.self, 0.55);
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, U.TAU); ctx.stroke();
    for (var i = 1; i <= 3; i++) {
      ctx.strokeStyle = U.rgba(C.self, 0.2);
      ctx.beginPath(); ctx.arc(cx, cy, R * i / 3, 0, U.TAU); ctx.stroke();
    }
    D.line(ctx, cx - R, cy, cx + R, cy, U.rgba(C.self, 0.16), 1);
    D.line(ctx, cx, cy - R, cx, cy + R, U.rgba(C.self, 0.16), 1);

    // 场地框
    var bw = (R * 1.62) * (S.W / Math.max(S.W, S.H));
    var bh = (R * 1.62) * (S.H / Math.max(S.W, S.H));
    ctx.strokeStyle = U.rgba(C.self, 0.3);
    ctx.strokeRect(cx - bw / 2, cy - bh / 2, bw, bh);

    // 扫描线
    var ang = (G.sonarT / Math.max(0.4, DL.PL.stats.sonarPeriod)) * U.TAU - Math.PI / 2;
    ctx.strokeStyle = U.rgba(C.self, 0.35);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(ang) * R, cy + Math.sin(ang) * R);
    ctx.stroke();

    // 光点
    var blipFade = T.sonar.blipFade;

    var p = DL.PL;
    for (var j = 0; j < G.enemies.length; j++) {
      var e = G.enemies[j];
      var last = e.lastSweep === undefined ? -99 : e.lastSweep;
      var age = G.t - last - (e.sweepDelay || 0);
      var fadeMax = e.decoy ? T.sonar.decoyFade : blipFade;
      if (age < 0 || age > fadeMax) continue;
      var al = 1 - age / fadeMax;
      if (al <= 0) continue;
      var mx = cx + (e.x / S.W - 0.5) * bw;
      var my = cy + (e.y / S.H - 0.5) * bh;
      if (U.dist(mx, my, cx, cy) > R - 3) continue;
      var col = e.decoy ? C.decoy : C.enemy;
      var baseA = e.decoy ? 0.45 : 1;
      var a3 = Math.min(1, al * baseA * 1.35);
      var rr = e.elite ? 5.5 : 3.4;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = a3 * 0.4;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(mx, my, rr * 2.5, 0, U.TAU); ctx.fill();
      ctx.globalAlpha = a3;
      ctx.beginPath(); ctx.arc(mx, my, rr, 0, U.TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      if (e.elite || (e.markUntil !== undefined && G.t < e.markUntil)) {
        ctx.globalAlpha = a3;
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(mx, my, rr + 4, 0, U.TAU); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    if (G.boss && !G.boss.dead) {
      var bx = cx + (G.boss.x / S.W - 0.5) * bw;
      var by = cy + (G.boss.y / S.H - 0.5) * bh;
      ctx.strokeStyle = '#b06bff';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(bx, by, 7, 0, U.TAU); ctx.stroke();
      ctx.fillStyle = U.rgba('#b06bff', 0.4);
      ctx.beginPath(); ctx.arc(bx, by, 4, 0, U.TAU); ctx.fill();
    }

    // 玩家
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(p.aim);
    ctx.fillStyle = C.self;
    ctx.beginPath();
    ctx.moveTo(6, 0); ctx.lineTo(-4, -3.4); ctx.lineTo(-4, 3.4);
    ctx.closePath(); ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  function I_usingTouch() { return DL.input.usingTouch; }

  function drawHUD(ctx) {
    var S = DL.S, s = S.ui;
    var p = DL.PL;

    /* 深度 */
    var dp = 18 * s;
    ctx.save();
    D.text(ctx, 'DEPTH', dp, 26 * s, 9 * s, 'rgba(160,210,225,0.45)', 'left', 600);
    var dcol = G.depth >= 4000 ? C.enemy : (G.depth >= 2500 ? C.gold : C.self);
    D.glowText(ctx, U.depthStr(G.depth) + 'm', dp, 46 * s, 20 * s, dcol, 'left', 10);
    D.text(ctx, (G.endlessRun ? '第 ' + G.layer + ' 层 · 无尽' : '第 ' + G.layer + ' 层') +
      ' · 涌潮 ' + Math.min(G.surge, T.layer.surges) + '/' + T.layer.surges,
      dp, 62 * s, 10 * s, 'rgba(160,210,225,0.4)', 'left', 500);
    ctx.restore();

    /* 分数 */
    ctx.save();
    D.text(ctx, 'SCORE', S.W - dp, 26 * s, 9 * s, 'rgba(160,210,225,0.45)', 'right', 600);
    D.text(ctx, U.fmt(G.score), S.W - dp, 46 * s, 20 * s, C.white, 'right', 700);
    D.text(ctx, 'BEST ' + U.fmt(Math.max(DL.save.get().bestScore, G.score)), S.W - dp, 62 * s, 9 * s, 'rgba(160,210,225,0.35)', 'right', 500);
    ctx.restore();

    /* 船体 */
    var hx = dp, hy = S.H - 30 * s;
    for (var i = 0; i < p.maxHp; i++) {
      var filled = i < p.hp;
      var bx = hx + i * 18 * s;
      ctx.fillStyle = filled ? U.rgba(C.self, 0.9) : 'rgba(120,160,175,0.16)';
      ctx.fillRect(bx, hy, 13 * s, 5 * s);
    }
    for (var sh = 0; sh < p.shield; sh++) {
      ctx.strokeStyle = U.rgba(C.self, 0.7);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(hx + p.maxHp * 18 * s + 8 * s + sh * 11 * s, hy + 2.5 * s, 4.4 * s, 0, U.TAU);
      ctx.stroke();
    }

    /* 冲刺 / ping 冷却条 */
    var s2 = p.stats;
    var dashFrac = p.dashCh / Math.max(1, s2.dashCharges);
    ctx.fillStyle = 'rgba(120,160,175,0.16)';
    ctx.fillRect(hx, hy + 10 * s, 60 * s, 2.4 * s);
    ctx.fillStyle = dashFrac >= 1 ? C.self : U.rgba(C.self, 0.5);
    ctx.fillRect(hx, hy + 10 * s, 60 * s * Math.min(1, dashFrac), 2.4 * s);

    var pingFrac = 1 - G.pingCd / Math.max(0.1, s2.pingCd);
    ctx.fillStyle = 'rgba(120,160,175,0.16)';
    ctx.fillRect(hx + 66 * s, hy + 10 * s, 40 * s, 2.4 * s);
    ctx.fillStyle = pingFrac >= 1 ? C.self : U.rgba(C.self, 0.45);
    ctx.fillRect(hx + 66 * s, hy + 10 * s, 40 * s * Math.min(1, pingFrac), 2.4 * s);

    /* 强化计时 */
    var owned = G.runCards || {};
    var bx2 = hx;
    var by2 = hy - 20 * s;
    var shown = 0;
    for (var k = 0; k < DL.CARDS.length && shown < 8; k++) {
      var c = DL.CARDS[k];
      var lv = owned[c.id] || 0;
      if (!lv) continue;
      var rar = DL.RARITY[c.rar];
      ctx.fillStyle = U.rgba(rar.col, 0.85);
      ctx.fillRect(bx2 + shown * 13 * s, by2, 9 * s, 9 * s);
      D.text(ctx, String(lv), bx2 + shown * 13 * s + 2.2 * s, by2 + 7.4 * s, 7 * s, '#02131a', 'left', 700);
      shown++;
    }

    /* 连击 */
    if (G.combo >= 2) {
      var cm = Math.min(1 + G.combo * T.combo.per, T.combo.cap);
      var cc = G.combo >= 30 ? C.enemy : (G.combo >= 10 ? C.gold : C.self);
      var cx2 = 26 * s, cy2 = S.H * 0.42;
      D.text(ctx, '×' + cm.toFixed(2), cx2, cy2, 26 * s, cc, 'left', 700);
      D.text(ctx, G.combo + ' COMBO', cx2, cy2 + 16 * s, 10 * s, U.rgba(cc, 0.7), 'left', 600);
      var fw = (G.comboT / Math.max(0.2, p.stats.comboWin)) * 70 * s;
      ctx.fillStyle = U.rgba(cc, 0.35);
      ctx.fillRect(cx2, cy2 + 22 * s, 70 * s, 2);
      ctx.fillStyle = cc;
      ctx.fillRect(cx2, cy2 + 22 * s, fw, 2);
    }

    /* Boss 血条 */
    if (G.boss && !G.boss.dead) {
      var b = G.boss;
      var w = Math.min(460 * s, S.W * 0.5), h = 6 * s;
      var bx3 = S.W * 0.5 - w / 2, by3 = 74 * s;
      ctx.fillStyle = 'rgba(255,79,163,0.12)';
      ctx.fillRect(bx3, by3, w, h);
      ctx.fillStyle = b.color;
      ctx.fillRect(bx3, by3, w * Math.max(0, b.hp / b.maxHp), h);
      ctx.strokeStyle = U.rgba(b.color, 0.5);
      ctx.lineWidth = 1;
      ctx.strokeRect(bx3 + 0.5, by3 + 0.5, w, h);
      D.text(ctx, b.def.name, bx3, by3 - 8 * s, 13 * s, b.color, 'left', 700);
      D.text(ctx, 'L' + G.layer + (G.endlessRun && G.layer > 6 ? ' · 第 ' + (Math.floor((G.layer - 1) / T.boss.perRun) + 1) + ' 轮' : '') +
        ' · ' + b.def.sub, bx3 + w, by3 - 8 * s, 9 * s, U.rgba(b.color, 0.6), 'right', 500);
      // 阶段刻度
      var ph = b.def.phases;
      for (var q = 0; q < ph.length; q++) {
        var xx = bx3 + w * ph[q];
        D.line(ctx, xx, by3 - 2, xx, by3 + h + 2, U.rgba('#ffffff', 0.5), 1);
      }
    }

    /* 触屏按钮 */
    var btns = DL.touchBtns();
    if (btns) {
      var drawBtn = function (b2, label, frac) {
        ctx.save();
        ctx.strokeStyle = U.rgba(C.self, 0.35);
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(b2.x, b2.y, b2.r, 0, U.TAU); ctx.stroke();
        if (frac < 1) {
          ctx.strokeStyle = U.rgba(C.self, 0.7);
          ctx.beginPath(); ctx.arc(b2.x, b2.y, b2.r, -Math.PI / 2, -Math.PI / 2 + U.TAU * frac); ctx.stroke();
        }
        D.text(ctx, label, b2.x, b2.y + 4, 10 * s, U.rgba(C.self, 0.75), 'center', 600);
        ctx.restore();
      };
      drawBtn(btns.dash, '冲', dashFrac);
      drawBtn(btns.ping, '声', pingFrac);
    }

    /* 横幅 */
    if (G.bannerT > 0) {
      var k2 = Math.min(1, G.bannerT);
      ctx.save();
      ctx.globalAlpha = Math.min(1, k2 * 2);
      D.text(ctx, G.bannerText, S.W * 0.5, S.H * 0.16, 16 * s, C.self, 'center', 700);
      ctx.restore();
    }

    /* 教学提示 */
    if (G.layer === 1 && G.hintIdx < 3 && G.runT < 45) {
      var hints = ['鼠标控制探照灯', 'WASD 移动 · 空格冲刺', '光会暴露你，也会暴露它们'];
      var txt = hints[G.hintIdx];
      ctx.save();
      ctx.globalAlpha = 0.5 + Math.sin(G.t * 2) * 0.14;
      D.text(ctx, txt, S.W * 0.5, S.H * 0.78, 12 * s, 'rgba(200,235,245,0.9)', 'center', 500);
      ctx.restore();
    }

    /* 调试信息已迁到内置控制台（`~` 打开） */
  }

  /* ---------------- 近战 / 环绕物 / 光雷 ---------------- */
  function drawBlade(ctx) {
    var p = DL.PL, s = p.stats;
    if (!p.alive || !s.blade) return;
    var half = s.bladeArc * 0.5;
    var R = s.bladeR;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    /* 1. 常驻的判定提示弧：告诉你刀能打到哪 */
    var arcA = 0.22 + 0.06 * Math.sin(G.t * 4);
    ctx.strokeStyle = U.rgba(C.self, arcA);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(p.x, p.y, R, p.aim - half, p.aim + half);
    ctx.stroke();
    if (s.bladeTwin) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, R, p.aim + Math.PI - half, p.aim + Math.PI + half);
      ctx.stroke();
    }
    /* 弧两端的小刻度，读判定范围更准 */
    ctx.strokeStyle = U.rgba(C.self, 0.35);
    ctx.lineWidth = 2;
    for (var sgn = -1; sgn <= 1; sgn += 2) {
      var ea = p.aim + sgn * half;
      ctx.beginPath();
      ctx.moveTo(p.x + Math.cos(ea) * (R - 9), p.y + Math.sin(ea) * (R - 9));
      ctx.lineTo(p.x + Math.cos(ea) * (R + 3), p.y + Math.sin(ea) * (R + 3));
      ctx.stroke();
      if (s.bladeTwin) {
        var eb = ea + Math.PI;
        ctx.beginPath();
        ctx.moveTo(p.x + Math.cos(eb) * (R - 9), p.y + Math.sin(eb) * (R - 9));
        ctx.lineTo(p.x + Math.cos(eb) * (R + 3), p.y + Math.sin(eb) * (R + 3));
        ctx.stroke();
      }
    }

    /* 2. 横扫残影 */
    for (var i = 0; i < G.slashes.length; i++) {
      var sl = G.slashes[i];
      var k = sl.t / sl.life;                 // 0 → 1
      var lead = sl.a - sl.half + sl.half * 2 * Math.min(1, k * 1.6);
      var a0 = sl.a - sl.half;
      var fade = 1 - k;

      ctx.globalAlpha = fade * 0.9;
      var g = ctx.createRadialGradient(sl.x, sl.y, sl.r * 0.3, sl.x, sl.y, sl.r * 1.02);
      g.addColorStop(0, U.rgba(C.self, 0));
      g.addColorStop(0.5, U.rgba(C.self, 0.42 * fade));
      g.addColorStop(0.86, U.rgba('#c9fff4', 0.5 * fade));
      g.addColorStop(1, U.rgba(C.self, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(sl.x, sl.y, sl.r, a0, lead, false);
      ctx.arc(sl.x, sl.y, sl.r * 0.32, lead, a0, true);
      ctx.closePath();
      ctx.fill();

      /* 刃口：一道亮线扫过 */
      ctx.globalAlpha = fade;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4.2 * fade + 0.8;
      ctx.beginPath();
      ctx.arc(sl.x, sl.y, sl.r * 0.96, lead - 0.10, lead + 0.02);
      ctx.stroke();
      ctx.strokeStyle = U.rgba(C.self, 0.9);
      ctx.lineWidth = 11 * fade;
      ctx.beginPath();
      ctx.arc(sl.x, sl.y, sl.r * 0.9, lead - 0.2, lead);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawOrbits(ctx) {
    var p = DL.PL, s = p.stats;
    if (!p.alive || s.orbit <= 0) return;
    var n = s.orbit, R = 74;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    /* 轨道提示环 */
    ctx.globalAlpha = 0.10;
    ctx.strokeStyle = C.self;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, U.TAU); ctx.stroke();

    for (var i = 0; i < n; i++) {
      var a = G.t * 2.2 + i * U.TAU / n;
      var ox = p.x + Math.cos(a) * R;
      var oy = p.y + Math.sin(a) * R;
      var tangent = a + Math.PI / 2;

      /* 拖尾：沿切向的一段淡光 */
      ctx.globalAlpha = 0.30;
      ctx.strokeStyle = U.rgba(C.self, 0.5);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, R, a - 0.24, a);
      ctx.stroke();
      ctx.globalAlpha = 1;

      D.glow(ctx, ox, oy, 26, C.self, 0.65);

      ctx.save();
      ctx.translate(ox, oy);
      ctx.rotate(tangent);
      /* 双面刃：细长的菱形 */
      ctx.fillStyle = 'rgba(240,255,252,0.98)';
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(0, -5);
      ctx.lineTo(-12, 0);
      ctx.lineTo(0, 5);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = U.rgba(C.self, 0.95);
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawDrones(ctx) {
    var p = DL.PL, s = p.stats;
    if (!p.alive || s.drone <= 0) return;
    ctx.save();
    for (var i = 0; i < s.drone; i++) {
      var a = -G.t * 1.6 + i * Math.PI;
      var dx = p.x + Math.cos(a) * 58;
      var dy = p.y + Math.sin(a) * 58;

      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = C.self;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(dx, dy); ctx.stroke();

      ctx.globalAlpha = 1;
      D.glow(ctx, dx, dy, 16, C.self, 0.45);

      ctx.globalCompositeOperation = 'source-over';
      ctx.save();
      ctx.translate(dx, dy);
      ctx.rotate(G.t * 2.4);
      ctx.fillStyle = '#0b2b33';
      ctx.beginPath();
      for (var k = 0; k < 6; k++) {
        var aa = k * U.TAU / 6;
        var rr = k % 2 === 0 ? 6.2 : 4.6;
        if (k === 0) ctx.moveTo(Math.cos(aa) * rr, Math.sin(aa) * rr);
        else ctx.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = U.rgba(C.self, 0.85);
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = U.rgba(C.self, 0.95);
      ctx.beginPath(); ctx.arc(dx, dy, 1.8, 0, U.TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  }

  function drawMelt(ctx) {
    var p = DL.PL;
    if (!p.meltTrail || !p.meltTrail.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < p.meltTrail.length; i++) {
      var m = p.meltTrail[i];
      var k = m.life / m.max;
      D.glow(ctx, m.x, m.y, m.r * (0.7 + k * 0.5), C.gold, 0.16 * k);
      ctx.globalAlpha = 0.25 * k;
      ctx.strokeStyle = C.gold;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r * 0.7, 0, U.TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function drawMines(ctx) {
    if (!G.mines || !G.mines.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < G.mines.length; i++) {
      var m = G.mines[i];
      var blink = m.t > 7.4 ? (Math.sin(m.t * 26) > 0 ? 1 : 0.25) : 1;
      var pulse = 0.7 + Math.sin(m.t * 6 + i) * 0.3;
      D.glow(ctx, m.x, m.y, 18 * pulse, C.gold, 0.5 * blink);
      ctx.globalAlpha = 0.7 * blink;
      ctx.strokeStyle = C.gold;
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(m.x, m.y, 7, 0, U.TAU); ctx.stroke();
      ctx.globalAlpha = 0.35 * blink;
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r * 0.55, 0, U.TAU); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff6dd';
      ctx.beginPath(); ctx.arc(m.x, m.y, 2.4, 0, U.TAU); ctx.fill();
    }
    ctx.restore();
  }

  function drawFields(ctx) {
    var p = DL.PL, s = p.stats;
    if (!p.alive) return;

    if (s.auraR > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      var k = 0.5 + Math.sin(G.t * 5) * 0.12;
      ctx.strokeStyle = U.rgba(C.gold, 0.20 * k);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, s.auraR, 0, U.TAU); ctx.stroke();
      var ag = ctx.createRadialGradient(p.x, p.y, s.auraR * 0.55, p.x, p.y, s.auraR);
      ag.addColorStop(0, U.rgba(C.gold, 0));
      ag.addColorStop(1, U.rgba(C.gold, 0.10 * k));
      ctx.fillStyle = ag;
      ctx.beginPath(); ctx.arc(p.x, p.y, s.auraR, 0, U.TAU); ctx.fill();
      ctx.restore();
    }

    if (s.slowField > 0) {
      var sr = s.slowField === 1 ? 180 : 240;
      ctx.save();
      ctx.strokeStyle = U.rgba('#57e0ff', 0.13);
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 10]);
      ctx.lineDashOffset = -G.t * 30;
      ctx.beginPath(); ctx.arc(p.x, p.y, sr, 0, U.TAU); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  function drawSym(ctx) {
    var p = DL.PL, s = p.stats;
    if (!p.alive || s.sym <= 0 || p.sym <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < 10; i++) {
      var a = -Math.PI / 2 + (i / 10) * U.TAU;
      var on = i < p.sym;
      ctx.globalAlpha = on ? 0.85 : 0.14;
      ctx.fillStyle = on ? C.self : '#ffffff';
      ctx.beginPath();
      ctx.arc(p.x + Math.cos(a) * 40, p.y + Math.sin(a) * 40, on ? 1.9 : 1.2, 0, U.TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ---------------- 主渲染 ---------------- */
  DL.renderPlay = function (ctx, dt, allowHUD) {
    var S = DL.S, p = DL.PL;
    var px = p.x - S.W * 0.5, py = p.y - S.H * 0.5;

    drawBackground(ctx, G.t, px, py);

    var sx = G.shakeX, sy = G.shakeY;
    ctx.save();
    ctx.translate(sx, sy);

    drawVents(ctx);

    // 敌人
    for (var i = 0; i < G.enemies.length; i++) {
      var e = G.enemies[i];
      var vis = DL.visOf(e.x, e.y);
      if (e.tele > 0) vis = Math.max(vis, 0.55);
      if (e.lastSweep !== undefined) {
        var ag = G.t - e.lastSweep - (e.sweepDelay || 0);
        var rv = T.sonar.revealT || 1.5;
        if (ag >= 0 && ag < rv) {
          var kk3 = ag < rv * 0.45 ? 1 : 1 - (ag - rv * 0.45) / (rv * 0.55);
          vis = Math.max(vis, 0.95 * kk3);
        }
      }
      if (e.markUntil !== undefined && G.t < e.markUntil) vis = Math.max(vis, 0.4);
      if (e.type === 'decoy') vis = Math.max(vis, DL.visOf(e.x, e.y));
      drawEnemy(ctx, e, vis);
    }

    // Boss 始终可见（强光）
    drawBoss(ctx, G.boss);

    drawDrops(ctx);
    drawRings(ctx);
    drawMelt(ctx);
    drawMines(ctx);
    drawFields(ctx);
    drawBlade(ctx);
    drawOrbits(ctx);
    drawDrones(ctx);
    drawPlayer(ctx);
    drawSym(ctx);
    drawBullets(ctx);
    drawParticles(ctx);
    drawFloats(ctx);

    // 光照
    drawLight(ctx);

    // 雾盖在最上
    drawFogs(ctx);

    // 挤压边界
    if (G.shrink > 1) {
      var ins = 20 + G.shrink;
      ctx.strokeStyle = 'rgba(176,107,255,' + (0.25 + Math.sin(G.t * 6) * 0.1) + ')';
      ctx.lineWidth = 3;
      ctx.strokeRect(ins, ins, S.W - ins * 2, S.H - ins * 2);
    }

    ctx.restore();

    /* 暗角 */
    if (G.perf.grade < 3) {
      if (S.vigTex) ctx.drawImage(S.vigTex, 0, 0, S.W, S.H);
      else { ctx.fillStyle = S.vig; ctx.fillRect(0, 0, S.W, S.H); }
    }

    /* 闪屏 */
    if (G.flash > 0.01) {
      var maxF = DL.save.get().settings.flash / 100;
      ctx.save();
      ctx.globalAlpha = Math.min(0.85, G.flash) * maxF;
      ctx.fillStyle = G.flashCol;
      ctx.fillRect(0, 0, S.W, S.H);
      ctx.restore();
    }

    if (allowHUD) {
      drawReticle(ctx);
      drawSonar(ctx);
      drawHUD(ctx);
    }
  };

  /* 准星：锁指针后就靠它告诉你灯指哪 */
  function drawReticle(ctx) {
    if (DL.input.usingTouch) return;
    var x = DL.input.px, y = DL.input.py;
    var p = DL.PL;
    var locked = DL.input.locked;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = U.rgba(C.self, locked ? 0.5 : 0.28);
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(x, y, 9, 0, U.TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, 2, 0, U.TAU); ctx.stroke();
    for (var i = 0; i < 4; i++) {
      var a = i * Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * 12, y + Math.sin(a) * 12);
      ctx.lineTo(x + Math.cos(a) * 17, y + Math.sin(a) * 17);
      ctx.stroke();
    }
    // 指向自己的细线，方便在大幅甩动后立刻找回
    if (locked) {
      ctx.strokeStyle = U.rgba(C.self, 0.06 + G.pingDark * 0.1);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  DL.renderBGOnly = function (ctx) {
    drawBackground(ctx, G.t, 0, 0);
  };

})();
