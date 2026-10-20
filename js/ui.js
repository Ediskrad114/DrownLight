/* ==========================================================================
   光溺 DROWNLIGHT · ui.js
   状态机 / 标题 / 开场投放 / 选卡 / 结算 / 技能树 / 设置 / 档案 / 结局
   ========================================================================== */
window.DL = window.DL || {};
(function () {
  'use strict';

  var U = DL.U, T = DL.T, C = T.colors, G = DL.G, I = DL.input, D = DL.draw;
  var S = null;

  var UI = {
    sel: 0,
    t: 0,
    hits: [],
    ripples: [],
    hotKey: '',
    pressT: 0,
    msg: '',
    summaryT: 0,
    depthShown: 0,
    cardAnim: 0,
    treeSel: 0,
    setRow: 0,
    trans: 0,
    quitHint: 0,
    codexTab: 0,
    codexSel: 0,
    keySel: 0,
    capturing: null
  };
  DL.ui = UI;

  function sc() { return DL.S; }

  /* 鼠标是否停在某个矩形里；进入时播放一次轻响 */
  UI.hot = function (x, y, w, h) {
    if (I.locked) return false;
    if (I.px < x || I.px > x + w || I.py < y || I.py > y + h) return false;
    var key = Math.round(x) + ',' + Math.round(y);
    if (UI.hotKey !== key) {
      UI.hotKey = key;
      DL.audio.sfx.hover();
    }
    return true;
  };

  UI.ripple = function (x, y) {
    UI.ripples.push({ x: x, y: y, t: 0 });
    if (UI.ripples.length > 8) UI.ripples.shift();
    UI.pressT = 0.16;
    DL.audio.sfx.click();
  };

  /* ---------------- 状态切换 ---------------- */
  UI.goto = function (name) {
    G.screen = name;
    UI.sel = 0;
    UI.t = 0;
    UI.hits = [];
    document.body.classList.toggle('playing', name === 'play');
    if (name === 'play') {
      if (DL.fs) DL.fs.lock(true);
    } else {
      if (DL.fs) DL.fs.unlock();
    }
    if (name === 'summary') { UI.summaryT = 0; UI.depthShown = 0; DL.audio.silence(false); }
    if (name === 'ending') { UI.t = 0; DL.audio.silence(true); if (DL.awardRun) DL.awardRun(true); }
    if (name === 'title') { DL.audio.silence(false); }
    if (name === 'bag') { UI.bagFrom = G.screen; }
    if (name === 'keys') { UI.capturing = null; I.capture = null; UI.keySel = 0; }
    if (DL.audio.scene) DL.audio.scene(name === 'play' ? 'play' : 'menu');
    if (name === 'cards') { UI.cardAnim = 0; }
  };

  function hit(x, y, w, h, act, opt) {
    UI.hits.push({ x: x, y: y, w: w, h: h, act: act, opt: opt });
  }

  function inside(h, mx, my) {
    return mx >= h.x && mx <= h.x + h.w && my >= h.y && my <= h.y + h.h;
  }

  function hoverAny(mx, my) {
    for (var i = 0; i < UI.hits.length; i++) if (inside(UI.hits[i], mx, my)) return i;
    return -1;
  }

  /* ---------------- 通用绘制 ---------------- */
  function wrapText(ctx, text, x, y, maxW, size, color, lh) {
    ctx.font = D.font(size, 500);
    var chars = text.split('');
    var line = '', yy = y;
    for (var i = 0; i < chars.length; i++) {
      var test = line + chars[i];
      if (ctx.measureText(test).width > maxW && line.length > 0) {
        ctx.fillStyle = color;
        ctx.textAlign = 'left';
        ctx.fillText(line, x, yy);
        line = chars[i];
        yy += lh;
      } else line = test;
    }
    if (line) {
      ctx.fillStyle = color;
      ctx.textAlign = 'left';
      ctx.fillText(line, x, yy);
    }
    return yy + lh;
  }

  /* 单行超宽时截断加省略号 */
  function clipText(ctx, text, x, y, maxW, size, color) {
    ctx.font = D.font(size, 500);
    if (ctx.measureText(text).width <= maxW) {
      ctx.fillStyle = color;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(text, x, y);
      return;
    }
    var s = text;
    while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(s + '…', x, y);
  }

  /* ---------------- UI 组件 ---------------- */

  /* 带角标的暗色面板：全局统一的“仪器面板”语言 */
  function panel(ctx, x, y, w, h, opt) {
    opt = opt || {};
    var a = opt.alpha === undefined ? 0.82 : opt.alpha;
    var accent = opt.color || C.self;
    var g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, 'rgba(6,20,28,' + a + ')');
    g.addColorStop(0.5, 'rgba(4,14,20,' + (a * 0.96) + ')');
    g.addColorStop(1, 'rgba(2,9,14,' + (a * 1.02) + ')');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);

    /* 顶部高光 */
    ctx.fillStyle = U.rgba(accent, 0.10);
    ctx.fillRect(x, y, w, 1);

    ctx.strokeStyle = U.rgba(accent, opt.border === undefined ? 0.26 : opt.border);
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

    if (opt.corners !== false) {
      var cs = opt.cornerSize || 11;
      ctx.strokeStyle = U.rgba(accent, 0.65);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x, y + cs); ctx.lineTo(x, y); ctx.lineTo(x + cs, y);
      ctx.moveTo(x + w - cs, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + cs);
      ctx.moveTo(x, y + h - cs); ctx.lineTo(x, y + h); ctx.lineTo(x + cs, y + h);
      ctx.moveTo(x + w - cs, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - cs);
      ctx.stroke();
    }
    return { x: x, y: y, w: w, h: h };
  }

  /* 面板标题：左侧竖条 + 标题 + 横线 */
  function panelTitle(ctx, text, x, y, w, color) {
    var col = color || C.self;
    ctx.fillStyle = U.rgba(col, 0.9);
    ctx.fillRect(x, y - 9, 2, 12);
    D.text(ctx, text, x + 8, y, 10, U.rgba(col, 0.85), 'left', 700);
    hairline(ctx, x + 8 + (text.length * 10 + 4), y - 2, w - 8 - (text.length * 10 + 4), 0.14);
  }

  function hairline(ctx, x, y, w, a) {
    if (w <= 0) return;
    ctx.fillStyle = 'rgba(120,180,195,' + (a === undefined ? 0.16 : a) + ')';
    ctx.fillRect(x, y, w, 1);
  }

  function chip(ctx, x, y, text, color, filled) {
    var col = color || C.self;
    ctx.font = D.font(9, 600);
    var w = ctx.measureText(text).width + 12;
    ctx.fillStyle = filled ? U.rgba(col, 0.20) : 'rgba(120,160,175,0.10)';
    ctx.fillRect(x, y - 9, w, 14);
    ctx.strokeStyle = U.rgba(col, filled ? 0.55 : 0.22);
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y - 8.5, w - 1, 13);
    D.text(ctx, text, x + 6, y + 1, 9, filled ? U.rgba(col, 0.95) : 'rgba(150,190,205,0.6)', 'left', 600);
    return w;
  }

  /* 屏幕四角的细装饰，给界面一点“仪器感” */
  function screenCorners(ctx, S2, s, color) {
    var pad = 14 * s, len = 26 * s;
    var col = color || C.self;
    ctx.save();
    ctx.strokeStyle = U.rgba(col, 0.22);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad, pad + len); ctx.lineTo(pad, pad); ctx.lineTo(pad + len, pad);
    ctx.moveTo(S2.W - pad - len, pad); ctx.lineTo(S2.W - pad, pad); ctx.lineTo(S2.W - pad, pad + len);
    ctx.moveTo(pad, S2.H - pad - len); ctx.lineTo(pad, S2.H - pad); ctx.lineTo(pad + len, S2.H - pad);
    ctx.moveTo(S2.W - pad - len, S2.H - pad); ctx.lineTo(S2.W - pad, S2.H - pad); ctx.lineTo(S2.W - pad, S2.H - pad - len);
    ctx.stroke();
    ctx.restore();
  }

  function button(ctx, x, y, w, h, label, active, sub) {
    var s = sc().ui;
    var hov = UI.hot(x, y, w, h);
    var on = active || hov;
    var press = hov && UI.pressT > 0;

    ctx.fillStyle = on ? 'rgba(62,240,200,' + (press ? 0.22 : 0.11) + ')' : 'rgba(8,26,34,0.55)';
    ctx.fillRect(x, y, w, h);
    if (on) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      D.glow(ctx, x + w / 2, y + h / 2, w * 0.62, C.self, press ? 0.14 : 0.07);
      ctx.restore();
    }
    ctx.strokeStyle = on ? U.rgba(C.self, press ? 1 : 0.9) : U.rgba(C.self, 0.25);
    ctx.lineWidth = on ? 1.6 : 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w, h);
    if (on) {
      ctx.fillStyle = U.rgba(C.self, 0.9);
      ctx.fillRect(x, y + h * 0.5 - h * 0.22, 3, h * 0.44);
    }
    D.text(ctx, label, x + 16 * s, y + h * 0.5 + 5 * s, 14 * s, on ? C.self : 'rgba(190,225,235,0.8)', 'left', on ? 700 : 500);
    if (sub) D.text(ctx, sub, x + w - 16 * s, y + h * 0.5 + 4 * s, 10 * s, 'rgba(160,210,225,0.45)', 'right', 500);
    if (press) {
      ctx.strokeStyle = U.rgba('#ffffff', 0.25);
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 3.5, y + 3.5, w - 6, h - 6);
    }
  }

  function bgDeep(ctx, t) {
    var S2 = sc();
    ctx.fillStyle = S2.bgGrad;
    ctx.fillRect(0, 0, S2.W, S2.H);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < 90; i++) {
      var x = (i * 137.5 + t * 8) % S2.W;
      var y = (i * 91.3 + Math.sin(i + t * 0.3) * 30) % S2.H;
      var a = 0.03 + (i % 7) * 0.008;
      ctx.fillStyle = 'rgba(150,220,235,' + a + ')';
      ctx.beginPath(); ctx.arc(x, y, 1 + (i % 3) * 0.6, 0, U.TAU); ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = S2.vig;
    ctx.fillRect(0, 0, S2.W, S2.H);
  }

  /* ---------------- 标题 ---------------- */
  function drawTitle(ctx) {
    var S2 = sc(), s = S2.ui;
    bgDeep(ctx, G.t);

    // 远处的两盏诱饵灯
    var lx1 = S2.W * 0.18 + Math.sin(G.t * 0.3) * 20;
    var ly1 = S2.H * 0.42;
    var lx2 = S2.W * 0.84 + Math.cos(G.t * 0.24) * 24;
    var ly2 = S2.H * 0.62;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var blink1 = 0.4 + Math.sin(G.t * 1.1) * 0.35;
    var blink2 = 0.35 + Math.sin(G.t * 0.7 + 2) * 0.3;
    D.glow(ctx, lx1, ly1, 26, C.enemy, Math.max(0.05, blink1) * 0.55);
    D.glow(ctx, lx2, ly2, 22, '#ffd166', Math.max(0.05, blink2) * 0.5);
    ctx.restore();

    var cx = S2.W * 0.5;

    /* 标题区：背后一团自下而上的灯锥，缓慢呼吸 */
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var breathe = 0.55 + Math.sin(G.t * 0.8) * 0.12;
    var tg = ctx.createRadialGradient(cx, S2.H * 0.30, 10, cx, S2.H * 0.30, 260 * s);
    tg.addColorStop(0, U.rgba(C.self, 0.11 * breathe));
    tg.addColorStop(0.5, U.rgba(C.self, 0.035 * breathe));
    tg.addColorStop(1, U.rgba(C.self, 0));
    ctx.fillStyle = tg;
    ctx.beginPath(); ctx.arc(cx, S2.H * 0.30, 260 * s, 0, U.TAU); ctx.fill();
    ctx.restore();

    D.glowText(ctx, '光 溺', cx, S2.H * 0.30, 64 * s, C.self, 'center', 26);
    D.text(ctx, 'D R O W N L I G H T', cx, S2.H * 0.30 + 26 * s, 11 * s, 'rgba(160,210,225,0.5)', 'center', 500);

    /* 标题下的分隔线 + 副标 */
    var ruleW = 320 * s;
    hairline(ctx, cx - ruleW / 2, S2.H * 0.30 + 40 * s, ruleW, 0.18);
    D.text(ctx, '深 度 4 0 0 0 米 · 无 光 带', cx, S2.H * 0.30 + 58 * s, 9 * s, 'rgba(150,200,215,0.42)', 'center', 500);

    var items = ['开 始 下 潜', '设 置', '深 渊 档 案', '残 骸 技 能 树', '无 尽 深 渊', '退 出 游 戏'];
    var bw = 268 * s, bh = 38 * s, gap = 9 * s;
    var top = S2.H * 0.47;
    var sv = DL.save.get();

    /* 菜单装进一块面板，和别的界面同一套语言 */
    var ph = items.length * (bh + gap) + 46 * s;
    panel(ctx, cx - bw / 2 - 22 * s, top - 40 * s, bw + 44 * s, ph, { alpha: 0.62, corners: true, cornerSize: 13 * s });
    panelTitle(ctx, 'M A I N', cx - bw / 2 - 8 * s, top - 18 * s, bw + 16 * s);

    for (var i = 0; i < items.length; i++) {
      var y = top + i * (bh + gap);
      var locked = (i === 4 && !sv.endless);
      var active = (UI.sel === i);
      var label = items[i];
      var sub = '';
      if (i === 3) sub = '◇ ' + U.fmt(sv.salvage);
      if (i === 4) sub = locked ? '通关后解锁' : '无限层 · 每 6 层换一批 Boss';
      if (i === 5) sub = (DL.fs && DL.fs.host) ? '关闭窗口' : '关闭标签页';
      ctx.save();
      if (locked) ctx.globalAlpha = 0.36;
      button(ctx, cx - bw / 2, y, bw, bh, label, active, sub);
      ctx.restore();
      if (!locked) hit(cx - bw / 2, y, bw, bh, 'title', i);
      if (locked && active) UI.sel = (UI.sel + 1) % items.length;
    }

    if (UI.quitHint > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, UI.quitHint);
      D.text(ctx, '浏览器不允许脚本关闭页面 —— 请按 Ctrl+W 关闭标签页', cx, S2.H - 62 * s, 11 * s, 'rgba(255,206,92,0.85)', 'center', 500);
      ctx.restore();
    }

    /* 底部数据条 */
    var fy = S2.H - 26 * s;
    hairline(ctx, 44 * s, fy - 22 * s, S2.W - 88 * s, 0.10);
    var stats = [
      ['最深', U.depthStr(sv.bestDepth) + ' m'],
      ['最高分', U.fmt(sv.bestScore)],
      ['通关', sv.clears + ' 次'],
      ['残骸', '◇ ' + U.fmt(sv.salvage)]
    ];
    var sw = 168 * s;
    var sx0 = S2.W * 0.5 - (stats.length - 1) * sw * 0.5;
    for (var k = 0; k < stats.length; k++) {
      var sxc = sx0 + k * sw;
      D.text(ctx, stats[k][0], sxc - 6 * s, fy - 4 * s, 9 * s, 'rgba(140,185,200,0.38)', 'right', 500);
      D.text(ctx, stats[k][1], sxc + 6 * s, fy - 4 * s, 11 * s, 'rgba(205,235,242,0.72)', 'left', 600);
    }
    screenCorners(ctx, S2, s);
  }

  /* ---------------- 开场投放 ---------------- */
  function drawIntro(ctx) {
    var S2 = sc(), s = S2.ui, t = UI.t;
    ctx.fillStyle = '#02060c';
    ctx.fillRect(0, 0, S2.W, S2.H);

    var cx = S2.W * 0.5, cy = S2.H * 0.5;

    if (t < 2.4) {
      // 海面：俯视波纹 + 母船探照灯
      var k = Math.min(1, t / 1.0);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (var i = 0; i < 8; i++) {
        var rr = 40 + i * 34 + Math.sin(t * 2 + i) * 6;
        ctx.strokeStyle = 'rgba(90,180,190,' + (0.05 + (1 - i / 8) * 0.09) * k + ')';
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.ellipse(cx, S2.H * 0.55, rr * 1.7, rr * 0.5, 0, 0, U.TAU); ctx.stroke();
      }
      var la = Math.sin(t * 3) * 0.6 + 0.7;
      D.glow(ctx, cx + Math.sin(t * 1.7) * 120, S2.H * 0.2, 90, '#9fe8ff', 0.25 * la * k);
      ctx.restore();
      // 投放舱
      if (t > 1.2) {
        var pk = Math.min(1, (t - 1.2) / 1.0);
        ctx.save();
        ctx.strokeStyle = U.rgba(C.self, 0.5 * pk);
        ctx.lineWidth = 2;
        ctx.strokeRect(cx - 16, S2.H * 0.3, 32, 44);
        ctx.restore();
      }
      // 探测器坠落
      if (t > 1.9) {
        var fk = Math.min(1, (t - 1.9) / 0.5);
        var py = U.lerp(S2.H * 0.3, S2.H * 0.62, fk);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        D.glow(ctx, cx, py, 20, C.self, 0.8);
        ctx.restore();
        // 水花
        if (fk >= 1) {
          var sp = Math.min(1, (t - 2.4) / 0.6);
          ctx.save();
          ctx.strokeStyle = U.rgba(C.self, 0.5 * (1 - sp));
          ctx.beginPath(); ctx.ellipse(cx, S2.H * 0.62, 20 + sp * 90, (20 + sp * 90) * 0.32, 0, 0, U.TAU); ctx.stroke();
          ctx.restore();
        }
      }
    } else {
      // 下潜
      var k2 = Math.min(1, (t - 2.4) / 2.6);
      var g = ctx.createLinearGradient(0, 0, 0, S2.H);
      g.addColorStop(0, 'rgba(18,90,105,' + (1 - k2) * 0.9 + ')');
      g.addColorStop(0.5, 'rgba(6,40,54,' + (1 - k2 * 0.4) + ')');
      g.addColorStop(1, 'rgba(2,8,14,1)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, S2.W, S2.H);

      // 气泡上升
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (var b = 0; b < 40; b++) {
        var bx = (b * 97.3) % S2.W;
        var by = S2.H - ((t * (60 + (b % 5) * 30) + b * 71) % (S2.H + 100));
        ctx.fillStyle = 'rgba(170,235,245,' + (0.10 + (b % 3) * 0.05) * (1 - k2 * 0.5) + ')';
        ctx.beginPath(); ctx.arc(bx, by, 1.4 + (b % 4), 0, U.TAU); ctx.fill();
      }
      ctx.restore();

      // 探测器
      var dy = U.lerp(S2.H * 0.45, S2.H * 0.56, k2);
      var pod = U.lerp(1, 1.5, k2);
      ctx.save();
      ctx.translate(cx, dy);
      ctx.rotate(-Math.PI / 2 + U.lerp(-0.5, 0, k2));
      ctx.scale(pod, pod);
      ctx.beginPath();
      ctx.moveTo(17, 0); ctx.lineTo(-9, -11); ctx.lineTo(-4, 0); ctx.lineTo(-9, 11);
      ctx.closePath();
      ctx.fillStyle = '#0d2b32'; ctx.fill();
      ctx.strokeStyle = C.self; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      D.glow(ctx, cx, dy, 60 * pod, C.self, 0.25 + k2 * 0.2);
      ctx.restore();

      // 深度表
      var depth = Math.round(410 * k2);
      D.text(ctx, String(depth).padStart(4, '0') + ' M', cx, S2.H * 0.82, 26 * s, U.rgba(C.self, 0.5 + k2 * 0.5), 'center', 700);

      // 最后一对诱饵灯
      if (t > 5.2) {
        var bk = Math.sin((t - 5.2) * 3.2);
        if (bk > 0.1) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          D.glow(ctx, S2.W * 0.2, S2.H * 0.3, 26, C.enemy, 0.6 * bk * Math.min(1, (t - 5.2)));
          D.glow(ctx, S2.W * 0.24, S2.H * 0.34, 20, C.enemy, 0.5 * bk * Math.min(1, (t - 5.2)));
          ctx.restore();
        }
      }
    }

    D.text(ctx, '任意键跳过', S2.W - 20 * s, S2.H - 18 * s, 10 * s, 'rgba(160,210,225,0.3)', 'right', 400);

    if (UI.t > 7.0) UI.beginPlay();
  }

  UI.beginPlay = function () {
    DL.newRun(!!UI.pendingEndless);
    UI.pendingEndless = false;
    DL.rebuildMeta();
    DL.PL.stats = DL.recomputeStats();
    DL.PL.maxHp = DL.PL.stats.maxHp;
    DL.PL.hp = DL.PL.maxHp;
    DL.audio.silence(false);
    if (DL.fs && !DL.fs.userOff) DL.fs.tryEnter();   // 开局自动全屏；用户主动退出过就不再抢
    UI.goto('play');
  };

  /* ---------------- 选卡 ---------------- */
  function drawCards(ctx) {
    var S2 = sc(), s = S2.ui;
    DL.renderPlay(ctx, 0, false);
    ctx.fillStyle = 'rgba(2,8,14,0.72)';
    ctx.fillRect(0, 0, S2.W, S2.H);

    UI.cardAnim = Math.min(1, UI.cardAnim + 0.06);

    D.text(ctx, G.cardKind === 'layer' ? '深度跃迁 · 稀有强化' : '涌潮退去 · 选择强化', S2.W * 0.5, S2.H * 0.13, 16 * s, C.self, 'center', 600);

    var cards = G.cards || [];
    var cw = 210 * s, ch = 290 * s, gap = 26 * s;
    var totalW = cards.length * cw + (cards.length - 1) * gap;
    var x0 = S2.W * 0.5 - totalW / 2;
    var y0 = S2.H * 0.5 - ch / 2 + 10 * s;

    // 鼠标悬停即选中
    if (!I.locked && !I.usingTouch) {
      for (var hi = 0; hi < cards.length; hi++) {
        var hx = x0 + hi * (cw + gap);
        if (UI.hot(hx, y0, cw, ch)) { UI.sel = hi; break; }
      }
    }

    for (var i = 0; i < cards.length; i++) {
      var c = cards[i];
      var rar = DL.RARITY[c.rar];
      var lv = (G.runCards[c.id] || 0);
      var sel = UI.sel === i;
      var cx = x0 + i * (cw + gap);
      var cy = y0;
      var pop = sel ? 1.04 : 1;
      var k = U.clamp(UI.cardAnim * 3 - i * 0.35, 0, 1);
      ctx.save();
      ctx.globalAlpha = k;
      ctx.translate(cx + cw / 2, cy + ch / 2);
      ctx.scale(pop, pop);
      ctx.translate(-(cx + cw / 2), -(cy + ch / 2));

      ctx.fillStyle = 'rgba(6,18,26,0.95)';
      ctx.fillRect(cx, cy, cw, ch);
      if (sel) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        D.glow(ctx, cx + cw / 2, cy + ch / 2, cw * 0.8, rar.col, 0.12);
        ctx.restore();
      }
      ctx.strokeStyle = sel ? rar.col : U.rgba(rar.col, 0.35);
      ctx.lineWidth = sel ? 2 : 1;
      ctx.strokeRect(cx + 0.5, cy + 0.5, cw, ch);

      /* 四角刻线：卡牌的“仪表”感 */
      ctx.strokeStyle = U.rgba(rar.col, sel ? 0.9 : 0.45);
      ctx.lineWidth = 1.6;
      var ck = 9 * s;
      ctx.beginPath();
      ctx.moveTo(cx + 2, cy + ck); ctx.lineTo(cx + 2, cy + 2); ctx.lineTo(cx + ck, cy + 2);
      ctx.moveTo(cx + cw - ck, cy + 2); ctx.lineTo(cx + cw - 2, cy + 2); ctx.lineTo(cx + cw - 2, cy + ck);
      ctx.moveTo(cx + 2, cy + ch - ck); ctx.lineTo(cx + 2, cy + ch - 2); ctx.lineTo(cx + ck, cy + ch - 2);
      ctx.moveTo(cx + cw - ck, cy + ch - 2); ctx.lineTo(cx + cw - 2, cy + ch - 2); ctx.lineTo(cx + cw - 2, cy + ch - ck);
      ctx.stroke();

      // 顶部光带
      ctx.fillStyle = U.rgba(rar.col, sel ? 0.9 : 0.45);
      ctx.fillRect(cx + 1, cy + 1, cw - 2, 2);

      // 稀有度
      D.text(ctx, rar.name, cx + 12 * s, cy + 22 * s, 9 * s, U.rgba(rar.col, 0.8), 'left', 600);
      var catName = c.cat === 'w' ? '武器' : c.cat === 'u' ? '辅助' : c.cat === 'p' ? '被动' : '传说';
      D.text(ctx, catName, cx + cw - 12 * s, cy + 22 * s, 9 * s, 'rgba(160,210,225,0.4)', 'right', 500);

      // 图标
      drawIcon(ctx, c.icon, cx + cw / 2, cy + 72 * s, 26 * s, rar.col, sel, G.t);

      // 名称
      D.text(ctx, c.name, cx + cw / 2, cy + 124 * s, 17 * s, C.white, 'center', 700);

      // 等级
      var maxLv = c.repeat ? 0 : c.max;
      if (maxLv > 0) {
        for (var p = 0; p < maxLv; p++) {
          var px = cx + cw / 2 - (maxLv - 1) * 6 * s + p * 12 * s;
          ctx.fillStyle = p < lv ? rar.col : 'rgba(120,160,175,0.25)';
          ctx.fillRect(px, cy + 136 * s, 8 * s, 3 * s);
        }
      }

      // 描述
      var desc = c.desc[Math.min(lv, c.desc.length - 1)];
      wrapText(ctx, desc, cx + 14 * s, cy + 168 * s, cw - 28 * s, 11 * s, 'rgba(200,232,242,0.86)', 17 * s);

      // 流派标签：手上同流派越多，这类卡出现得越频繁
      if (c.tags && c.tags.length) {
        var tagY = cy + 214 * s;
        var txs = cx + 14 * s;
        for (var tg = 0; tg < c.tags.length && tg < 2; tg++) {
          var tname = DL.CARD_TAGS[c.tags[tg]];
          if (!tname) continue;
          var aff = (DL.PL.stats && DL.PL.stats.affinity && DL.PL.stats.affinity[c.tags[tg]]) || 0;
          ctx.font = D.font(8 * s, 600);
          var tw = ctx.measureText(tname).width + 10 * s;
          ctx.fillStyle = aff > 0.3 ? U.rgba(rar.col, 0.22) : 'rgba(120,160,175,0.12)';
          ctx.fillRect(txs, tagY - 9 * s, tw, 13 * s);
          D.text(ctx, tname, txs + 5 * s, tagY, 8 * s,
            aff > 0.3 ? U.rgba(rar.col, 0.95) : 'rgba(150,190,205,0.55)', 'left', 600);
          txs += tw + 4 * s;
        }
      }

      // 等级提示
      if (maxLv > 0) {
        D.text(ctx, 'Lv ' + (lv + 1) + ' / ' + maxLv, cx + cw / 2, cy + ch - 14 * s, 9 * s, 'rgba(160,210,225,0.45)', 'center', 500);
      }

      ctx.restore();
      hit(cx, cy, cw, ch, 'card', i);
    }

    D.text(ctx, '[ 1 ]   [ 2 ]   [ 3 ]', S2.W * 0.5, S2.H - 62 * s, 11 * s, 'rgba(160,210,225,0.4)', 'center', 500);

    /* 每次抽卡固定一次免费重抽，技能树再叠加 */
    var bw = 148 * s, bh = 28 * s;
    var bx = S2.W * 0.5 - bw / 2, by = S2.H - 48 * s;
    var canRe = (G.rerollsLeft || 0) > 0;
    if (canRe) {
      button(ctx, bx, by, bw, bh, '重抽', true, '×' + G.rerollsLeft + '   [R]');
      hit(bx, by, bw, bh, 'reroll');
    } else {
      ctx.save();
      ctx.globalAlpha = 0.35;
      button(ctx, bx, by, bw, bh, '重抽', false, '已用完');
      ctx.restore();
    }
  }

  /* 简单矢量图标 */
  function drawIcon(ctx, kind, cx, cy, r, col, sel, t) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = col;
    ctx.fillStyle = U.rgba(col, sel ? 0.9 : 0.55);
    ctx.lineWidth = 1.8;
    var a = Math.sin(t * 2) * 0.06 + 1;
    ctx.scale(a, a);

    if (kind === 'twin' || kind === 'rear') {
      for (var i = 0; i < 2; i++) {
        var ox = (i - 0.5) * r * 0.6;
        ctx.beginPath(); ctx.moveTo(ox, -r * 0.9); ctx.lineTo(ox, r * 0.9); ctx.stroke();
        ctx.beginPath(); ctx.arc(ox, -r * 0.9, 2, 0, U.TAU); ctx.fill();
      }
    } else if (kind === 'fan') {
      for (var j = -1; j <= 1; j++) {
        ctx.beginPath();
        ctx.moveTo(0, r * 0.9);
        ctx.lineTo(j * r * 0.85, -r * 0.9);
        ctx.stroke();
      }
    } else if (kind === 'pierce') {
      ctx.beginPath(); ctx.moveTo(0, r); ctx.lineTo(0, -r); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.3); ctx.lineTo(0, -r); ctx.lineTo(r * 0.5, -r * 0.3); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, r * 0.4, r * 0.5, 0, U.TAU); ctx.stroke();
    } else if (kind === 'refract') {
      ctx.beginPath(); ctx.moveTo(0, r); ctx.lineTo(0, 0); ctx.stroke();
      for (var q = -1; q <= 1; q++) {
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(q * r * 0.8, -r * 0.9); ctx.stroke();
      }
    } else if (kind === 'homing') {
      ctx.beginPath(); ctx.arc(0, 0, r * 0.85, 0.4, 4.6); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -r * 0.2, 3, 0, U.TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(r * 0.6, -r * 0.7); ctx.lineTo(r * 0.9, -r * 0.2); ctx.lineTo(r * 0.25, -r * 0.2); ctx.fill();
    } else if (kind === 'orbit') {
      ctx.beginPath(); ctx.arc(0, 0, r * 0.9, 0, U.TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(r * 0.9, 0, 3.2, 0, U.TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(-r * 0.45, r * 0.78, 2.4, 0, U.TAU); ctx.fill();
    } else if (kind === 'blade' || kind === 'bladeLong') {
      /* 一道弧形刀光 */
      ctx.beginPath();
      ctx.arc(0, r * 0.35, r * 0.95, -Math.PI * 0.82, -Math.PI * 0.18);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, r * 0.35, r * 0.62, -Math.PI * 0.78, -Math.PI * 0.22);
      ctx.globalAlpha = 0.4;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(0, r * 0.55, 2.4, 0, U.TAU); ctx.fill();
    } else if (kind === 'bladeTwin') {
      ctx.beginPath(); ctx.arc(0, r * 0.2, r * 0.9, -Math.PI * 0.85, -Math.PI * 0.15); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -r * 0.2, r * 0.9, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 2.6, 0, U.TAU); ctx.fill();
    } else if (kind === 'bladeDance') {
      for (var bd = 0; bd < 3; bd++) {
        ctx.globalAlpha = 1 - bd * 0.3;
        ctx.beginPath();
        ctx.arc(0, 0, r * (0.45 + bd * 0.24), -Math.PI * 0.9, Math.PI * 0.1);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else if (kind === 'caliber') {
      ctx.beginPath(); ctx.moveTo(0, r * 0.9); ctx.lineTo(0, -r * 0.9); ctx.stroke();
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(0, r * 0.9); ctx.lineTo(0, -r * 0.9); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1.8;
    } else if (kind === 'critPow') {
      ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r * 0.35, -r * 0.1); ctx.lineTo(0, r * 0.15);
      ctx.lineTo(r * 0.35, r * 0.9); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(-r * 0.35, -r * 0.1); ctx.lineTo(0, r * 0.15);
      ctx.lineTo(-r * 0.35, r * 0.9); ctx.stroke();
    } else if (kind === 'aura' || kind === 'slow') {
      ctx.beginPath(); ctx.arc(0, 0, r * 0.9, 0, U.TAU); ctx.globalAlpha = 0.45; ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0, U.TAU); ctx.stroke();
      if (kind === 'aura') {
        for (var au = 0; au < 6; au++) {
          var aa2 = au * U.TAU / 6 + 0.3;
          ctx.beginPath();
          ctx.arc(Math.cos(aa2) * r * 0.9, Math.sin(aa2) * r * 0.9, 2, 0, U.TAU);
          ctx.fill();
        }
      } else {
        ctx.setLineDash([3, 4]);
        ctx.beginPath(); ctx.arc(0, 0, r * 0.75, 0, U.TAU); ctx.stroke();
        ctx.setLineDash([]);
      }
    } else if (kind === 'mine') {
      ctx.beginPath(); ctx.arc(0, r * 0.1, r * 0.45, 0, U.TAU); ctx.stroke();
      for (var mi = 0; mi < 6; mi++) {
        var ma2 = mi * U.TAU / 6;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ma2) * r * 0.5, r * 0.1 + Math.sin(ma2) * r * 0.5);
        ctx.lineTo(Math.cos(ma2) * r * 0.85, r * 0.1 + Math.sin(ma2) * r * 0.85);
        ctx.stroke();
      }
    } else if (kind === 'magnet') {
      ctx.beginPath(); ctx.arc(0, r * 0.1, r * 0.6, Math.PI, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-r * 0.6, r * 0.1); ctx.lineTo(-r * 0.6, r * 0.75); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(r * 0.6, r * 0.1); ctx.lineTo(r * 0.6, r * 0.75); ctx.stroke();
    } else if (kind === 'leech') {
      ctx.beginPath(); ctx.moveTo(0, -r * 0.9); ctx.quadraticCurveTo(r * 0.8, 0, 0, r * 0.9);
      ctx.quadraticCurveTo(-r * 0.8, 0, 0, -r * 0.9); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, r * 0.22, 0, U.TAU); ctx.fill();
    } else if (kind === 'drone') {
      ctx.beginPath();
      for (var dr2 = 0; dr2 < 6; dr2++) {
        var da2 = dr2 * U.TAU / 6 - Math.PI / 2;
        var dxx = Math.cos(da2) * r * 0.55, dyy = Math.sin(da2) * r * 0.55;
        if (dr2 === 0) ctx.moveTo(dxx, dyy); else ctx.lineTo(dxx, dyy);
      }
      ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, r * 0.18, 0, U.TAU); ctx.fill();
    } else if (kind === 'charge') {
      ctx.beginPath(); ctx.arc(0, 0, r * 0.85, 0, U.TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-r * 0.25, -r * 0.6); ctx.lineTo(r * 0.25, 0); ctx.lineTo(-r * 0.1, 0.1); ctx.lineTo(r * 0.2, r * 0.65);
      ctx.stroke();
    } else if (kind === 'echo') {
      for (var e2 = 0; e2 < 3; e2++) {
        ctx.globalAlpha = 1 - e2 * 0.3;
        ctx.beginPath(); ctx.arc(0, 0, r * (0.3 + e2 * 0.3), 0, U.TAU); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else if (kind === 'boom') {
      ctx.beginPath(); ctx.arc(0, 0, r * 0.35, 0, U.TAU); ctx.fill();
      for (var b2 = 0; b2 < 8; b2++) {
        var ang = b2 * U.TAU / 8;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ang) * r * 0.5, Math.sin(ang) * r * 0.5);
        ctx.lineTo(Math.cos(ang) * r * 0.95, Math.sin(ang) * r * 0.95);
        ctx.stroke();
      }
    } else if (kind === 'dblDash' || kind === 'melt') {
      ctx.beginPath(); ctx.moveTo(-r * 0.8, r * 0.4); ctx.lineTo(r * 0.2, -r * 0.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-r * 0.2, r * 0.7); ctx.lineTo(r * 0.8, -r * 0.2); ctx.stroke();
    } else if (kind === 'longIfr' || kind === 'shieldGen' || kind === 'coat') {
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.9); ctx.lineTo(r * 0.75, -r * 0.4); ctx.lineTo(r * 0.55, r * 0.6);
      ctx.lineTo(0, r * 0.95); ctx.lineTo(-r * 0.55, r * 0.6); ctx.lineTo(-r * 0.75, -r * 0.4);
      ctx.closePath(); ctx.stroke();
    } else if (kind === 'sonarArr' || kind === 'markSonar') {
      for (var q2 = 1; q2 <= 3; q2++) {
        ctx.globalAlpha = 1 - q2 * 0.22;
        ctx.beginPath(); ctx.arc(0, r * 0.8, q2 * r * 0.33, -Math.PI * 0.8, -Math.PI * 0.2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else if (kind === 'wideCone' || kind === 'longCone' || kind === 'sense' || kind === 'killLit') {
      ctx.beginPath(); ctx.moveTo(0, r * 0.8); ctx.lineTo(-r * 0.8, -r * 0.6); ctx.lineTo(r * 0.8, -r * 0.6); ctx.closePath();
      ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, r * 0.8); ctx.lineTo(0, -r * 0.6); ctx.stroke();
    } else if (kind === 'repair') {
      ctx.beginPath(); ctx.moveTo(0, -r * 0.8); ctx.lineTo(0, r * 0.8); ctx.moveTo(-r * 0.8, 0); ctx.lineTo(r * 0.8, 0); ctx.stroke();
    } else if (kind === 'dmg' || kind === 'crit' || kind === 'close') {
      ctx.beginPath(); ctx.moveTo(-r * 0.7, r * 0.7); ctx.lineTo(r * 0.7, -r * 0.7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(r * 0.7, -r * 0.7); ctx.lineTo(r * 0.1, -r * 0.7); ctx.moveTo(r * 0.7, -r * 0.7); ctx.lineTo(r * 0.7, -r * 0.1); ctx.stroke();
    } else if (kind === 'rate' || kind === 'speed') {
      ctx.beginPath(); ctx.moveTo(-r * 0.7, -r * 0.5); ctx.lineTo(r * 0.3, 0); ctx.lineTo(-r * 0.7, r * 0.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(r * 0.1, -r * 0.5); ctx.lineTo(r * 0.9, 0); ctx.lineTo(r * 0.1, r * 0.5); ctx.stroke();
    } else if (kind === 'hull') {
      ctx.beginPath(); ctx.arc(0, 0, r * 0.8, 0, U.TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-r * 0.5, 0); ctx.lineTo(-r * 0.1, r * 0.45); ctx.lineTo(r * 0.55, -r * 0.45); ctx.stroke();
    } else if (kind === 'combo') {
      for (var w2 = 0; w2 < 3; w2++) {
        ctx.beginPath(); ctx.arc(0, 0, r * (0.35 + w2 * 0.28), 0, U.TAU); ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(0, -r * 0.9, 2, 0, U.TAU); ctx.fill();
    } else if (kind === 'loot') {
      ctx.beginPath(); ctx.arc(0, 0, r * 0.7, 0, U.TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-r * 0.3, -r * 0.7); ctx.lineTo(0, -r * 0.1); ctx.lineTo(r * 0.3, -r * 0.7); ctx.stroke();
    } else if (kind === 'deep') {
      ctx.beginPath(); ctx.moveTo(-r * 0.9, -r * 0.5); ctx.lineTo(0, r * 0.8); ctx.lineTo(r * 0.9, -r * 0.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -r * 0.9); ctx.lineTo(0, -r * 0.2); ctx.stroke();
    } else if (kind === 'sym') {
      ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0, U.TAU); ctx.fill();
      for (var sp = 0; sp < 8; sp++) {
        var sa = sp * U.TAU / 8;
        ctx.beginPath();
        ctx.moveTo(Math.cos(sa) * r * 0.7, Math.sin(sa) * r * 0.7);
        ctx.lineTo(Math.cos(sa) * r, Math.sin(sa) * r);
        ctx.stroke();
      }
    } else if (kind === 'drone') {
      ctx.beginPath(); ctx.arc(0, 0, r * 0.3, 0, U.TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(r * 0.85, 0, r * 0.22, 0, U.TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(-r * 0.85, 0, r * 0.22, 0, U.TAU); ctx.stroke();
    } else if (kind === 'echoRoom') {
      ctx.strokeRect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4);
      ctx.beginPath(); ctx.arc(0, 0, r * 0.45, 0, U.TAU); ctx.stroke();
    } else if (kind === 'eye') {
      ctx.beginPath(); ctx.ellipse(0, 0, r * 0.95, r * 0.55, 0, 0, U.TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, r * 0.3, 0, U.TAU); ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(0, 0, r * 0.8, 0, U.TAU); ctx.stroke();
    }
    ctx.restore();
  }

  /* ---------------- 结算 ---------------- */
  function drawSummary(ctx) {
    var S2 = sc(), s = S2.ui;
    var sv = DL.save.get();
    UI.summaryT += 0.016;
    var k = Math.min(1, UI.summaryT / 1.2);
    UI.depthShown = U.lerp(0, G.depth, k);

    bgDeep(ctx, G.t);
    ctx.fillStyle = 'rgba(2,8,14,0.55)';
    ctx.fillRect(0, 0, S2.W, S2.H);

    var cx = S2.W * 0.5;
    var head = G.cleared ? '抵 达 深 渊 底 部'
      : (G.endlessRun ? '无 尽 深 渊 · 下 潜 终 止' : '下 潜 终 止');
    D.text(ctx, head, cx, S2.H * 0.14, 13 * s, G.cleared ? C.gold : 'rgba(200,235,245,0.6)', 'center', G.cleared ? 700 : 500);

    var isNew = G.depth >= sv.bestDepth && G.depth > 0;
    D.glowText(ctx, U.depthStr(UI.depthShown) + 'm', cx, S2.H * 0.28, 54 * s, isNew ? C.gold : C.self, 'center', 20);
    if (isNew) D.text(ctx, '▲ 新纪录', cx, S2.H * 0.28 + 22 * s, 11 * s, C.gold, 'center', 600);

    var row = S2.H * 0.43;
    var col1 = cx - 150 * s, col2 = cx + 40 * s;
    var blog = G.bossLog || [];
    var btext = blog.length
      ? (blog.length > 6 ? '… ' : '') + blog.slice(-6).join(' · ')
      : '—';
    var lines = [
      ['得分', U.fmt(G.score)],
      ['击杀', String(G.kills)],
      ['最高连击', '×' + G.maxCombo],
      ['抵达', '第 ' + G.layer + ' 层'],
      ['用时', Math.floor(G.runT / 60) + ':' + String(Math.floor(G.runT % 60)).padStart(2, '0')],
      ['遭遇 Boss', btext]
    ];
    for (var i = 0; i < lines.length; i++) {
      var yy = row + i * 20 * s;
      D.text(ctx, lines[i][0], col1, yy, 11 * s, 'rgba(160,210,225,0.45)', 'left', 500);
      D.text(ctx, lines[i][1], col2, yy, 13 * s, 'rgba(225,245,250,0.95)', 'left', 600);
    }

    // 构筑
    D.text(ctx, '本 次 构 筑', cx, S2.H * 0.62, 10 * s, 'rgba(160,210,225,0.4)', 'center', 500);
    var owned = G.runCards || {};
    var list = [];
    for (var j = 0; j < DL.CARDS.length; j++) {
      var c = DL.CARDS[j];
      if (owned[c.id]) list.push(c);
    }
    var perRow = 6;
    for (var m = 0; m < list.length && m < 12; m++) {
      var c2 = list[m];
      var rar = DL.RARITY[c2.rar];
      var gx = cx - (Math.min(list.length, perRow) - 1) * 26 * s + (m % perRow) * 52 * s;
      var gy = S2.H * 0.66 + Math.floor(m / perRow) * 44 * s;
      drawIcon(ctx, c2.icon, gx, gy, 12 * s, rar.col, false, G.t);
      D.text(ctx, 'Lv' + owned[c2.id], gx, gy + 20 * s, 8 * s, U.rgba(rar.col, 0.8), 'center', 600);
    }

    D.text(ctx, '获得残骸数据  + ' + U.fmt(G.salvageGain || 0), cx, S2.H * 0.84, 12 * s, C.gold, 'center', 600);
    if (G.cleared && G.clearBonus) {
      D.text(ctx, '（含通关奖励 +' + U.fmt(G.clearBonus) + '）  ·  技能树可用 ' + U.fmt(sv.salvage), cx, S2.H * 0.84 + 16 * s, 10 * s, 'rgba(255,206,92,0.7)', 'center', 500);
    } else {
      D.text(ctx, '技能树可用  ' + U.fmt(sv.salvage), cx, S2.H * 0.84 + 16 * s, 10 * s, 'rgba(160,210,225,0.4)', 'center', 500);
    }

    var bw = 150 * s, bh = 34 * s, gap = 16 * s;
    var totalW = bw * 3 + gap * 2;
    var bx = cx - totalW / 2, by = S2.H - 54 * s;
    button(ctx, bx, by, bw, bh, '再次下潜', UI.sel === 0);
    button(ctx, bx + bw + gap, by, bw, bh, '技能树', UI.sel === 1);
    button(ctx, bx + (bw + gap) * 2, by, bw, bh, '返回标题', UI.sel === 2);
    hit(bx, by, bw, bh, 'sum', 0);
    hit(bx + bw + gap, by, bw, bh, 'sum', 1);
    hit(bx + (bw + gap) * 2, by, bw, bh, 'sum', 2);
  }

  /* ---------------- 技能树 ---------------- */
  var TREE_PER_ARM = 8;

  function treeRadius() {
    var S2 = sc();
    return Math.min(S2.W * 0.34, S2.H * 0.315);
  }

  function treeCenter() {
    var S2 = sc();
    return { x: S2.W * 0.5, y: S2.H * 0.465 };
  }

  function treePos(node) {
    var S2 = sc(), s = S2.ui;
    var c = treeCenter(), cx = c.x, cy = c.y;
    var arm = null;
    for (var i = 0; i < DL.TREE_ARMS.length; i++) if (DL.TREE_ARMS[i].id === node.arm) arm = DL.TREE_ARMS[i];
    var ang = arm ? arm.ang : 0;
    var r0 = 72 * s, r1 = treeRadius();
    var t = (node.i + 1) / TREE_PER_ARM;
    var dist = r0 + (r1 - r0) * Math.pow(t, 0.92);
    return { x: cx + Math.cos(ang) * dist, y: cy + Math.sin(ang) * dist * 0.92, ang: ang };
  }

  function drawTree(ctx) {
    var S2 = sc(), s = S2.ui;
    bgDeep(ctx, G.t);
    var sv = DL.save.get();
    var tc = treeCenter(), cx = tc.x, cy = tc.y;

    D.text(ctx, '残 骸 技 能 树', cx, 40 * s, 18 * s, C.self, 'center', 700);
    D.text(ctx, '按顺序点亮，可随时免费重置', cx, 58 * s, 10 * s, 'rgba(160,210,225,0.4)', 'center', 400);

    // 中心
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    D.glow(ctx, cx, cy, 60 * s, C.self, 0.25);
    ctx.restore();
    ctx.strokeStyle = U.rgba(C.self, 0.6);
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(cx, cy, 20 * s, 0, U.TAU); ctx.stroke();
    D.text(ctx, '灯', cx, cy + 5 * s, 13 * s, C.self, 'center', 700);

    // 分支名
    for (var a = 0; a < DL.TREE_ARMS.length; a++) {
      var arm = DL.TREE_ARMS[a];
      var last = treePos({ arm: arm.id, i: TREE_PER_ARM - 1 });
      var tx = last.x + Math.cos(arm.ang) * 26 * s;
      var ty = last.y + Math.sin(arm.ang) * 26 * s + 4 * s;
      D.text(ctx, arm.name, tx, ty, 11 * s, 'rgba(160,210,225,0.5)', 'center', 600);
    }

    // 连线
    for (var n = 0; n < DL.TREE_NODES.length; n++) {
      var node = DL.TREE_NODES[n];
      var pos = treePos(node);
      var prev = node.i === 0 ? { x: cx, y: cy } : treePos({ arm: node.arm, i: node.i - 1 });
      var owned = sv.tree[node.arm] || 0;
      var on = owned > node.i;
      ctx.strokeStyle = on ? U.rgba(C.self, 0.5) : 'rgba(90,130,145,0.16)';
      ctx.lineWidth = on ? 1.6 : 1;
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    }

    // 节点
    /* 先用一遍 hover 定下选中项，再统一绘制 —— 否则同一帧里
       旧选中项和新悬停项会各画一次选中环 */
    for (var hv = 0; hv < DL.TREE_NODES.length; hv++) {
      var hp = treePos(DL.TREE_NODES[hv]);
      if (UI.hot(hp.x - 18 * s, hp.y - 18 * s, 36 * s, 36 * s)) UI.treeSel = hv;
    }
    for (var m = 0; m < DL.TREE_NODES.length; m++) {
      var nd = DL.TREE_NODES[m];
      var p2 = treePos(nd);
      var own = sv.tree[nd.arm] || 0;
      var has = own > nd.i;
      var canBuy = own === nd.i && sv.salvage >= nd.cost;
      var isSel = UI.treeSel === m;
      var ring = (treeRadius() - 76 * s) / TREE_PER_ARM;
      var rr = Math.max(7 * s, Math.min((isSel ? 15 : 12) * s, ring * 0.36));
      ctx.save();
      if (has) {
        ctx.fillStyle = U.rgba(C.self, 0.85);
        ctx.beginPath(); ctx.arc(p2.x, p2.y, rr, 0, U.TAU); ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        D.glow(ctx, p2.x, p2.y, rr * 2.6, C.self, 0.22);
      } else {
        ctx.strokeStyle = canBuy ? U.rgba(C.gold, 0.9) : 'rgba(110,150,165,0.3)';
        ctx.lineWidth = canBuy ? 1.6 : 1;
        ctx.beginPath(); ctx.arc(p2.x, p2.y, rr, 0, U.TAU); ctx.stroke();
        if (canBuy) {
          ctx.globalCompositeOperation = 'lighter';
          D.glow(ctx, p2.x, p2.y, rr * 2.2, C.gold, 0.12 + Math.sin(G.t * 3) * 0.05);
        }
      }
      ctx.restore();
      if (isSel) {
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(p2.x, p2.y, rr + 5 * s, 0, U.TAU); ctx.stroke();
      }
      hit(p2.x - 18 * s, p2.y - 18 * s, 36 * s, 36 * s, 'node', m);
    }

    // 详情面板
    var sel2 = DL.TREE_NODES[UI.treeSel];
    if (sel2) {
      var pw = 260 * s, ph = 92 * s;
      var px = cx - pw / 2, py = S2.H - 128 * s;
      panel(ctx, px, py, pw, ph, { alpha: 0.8, cornerSize: 10 * s });
      D.text(ctx, sel2.name, px + 14 * s, py + 24 * s, 14 * s, C.white, 'left', 700);
      var own2 = sv.tree[sel2.arm] || 0;
      var state = own2 > sel2.i ? '已点亮' : (own2 === sel2.i ? (sv.salvage >= sel2.cost ? '可点亮' : '数据不足') : '需先点亮前一节点');
      D.text(ctx, state, px + pw - 14 * s, py + 24 * s, 10 * s, own2 > sel2.i ? C.self : (own2 === sel2.i && sv.salvage >= sel2.cost ? C.gold : 'rgba(160,210,225,0.4)'), 'right', 500);
      wrapText(ctx, sel2.desc, px + 14 * s, py + 48 * s, pw - 28 * s, 11 * s, 'rgba(200,232,242,0.8)', 16 * s);
      D.text(ctx, '◇ ' + U.fmt(sel2.cost), px + pw - 14 * s, py + ph - 12 * s, 11 * s, U.rgba(C.gold, 0.9), 'right', 600);
    }

    // 底部
    D.text(ctx, '残骸数据  ◇ ' + U.fmt(sv.salvage), 24 * s, S2.H - 24 * s, 12 * s, C.gold, 'left', 600);
    var bw2 = 110 * s, bh2 = 30 * s;
    button(ctx, S2.W - 24 * s - bw2, S2.H - 42 * s, bw2, bh2, '返回', UI.treeBack === true);
    hit(S2.W - 24 * s - bw2, S2.H - 42 * s, bw2, bh2, 'treeBack');
    var bw3 = 120 * s;
    button(ctx, S2.W - 24 * s - bw2 - 12 * s - bw3, S2.H - 42 * s, bw3, bh2, '重置全部', false);
    hit(S2.W - 24 * s - bw2 - 12 * s - bw3, S2.H - 42 * s, bw3, bh2, 'treeReset');
  }

  /* ---------------- 设置 ---------------- */
  var SETROWS = [
    { key: 'flash', name: '闪光强度', type: 'pct' },
    { key: 'shake', name: '震屏强度', type: 'pct' },
    { key: 'coneLight', name: '灯锥亮度', type: 'pct' },
    { key: 'music', name: '音乐音量', type: 'pct' },
    { key: 'sfx', name: '音效音量', type: 'pct' },
    { key: 'musicOn', name: '音乐开关', type: 'bool' },
    { key: 'autoAim', name: '自动瞄准', type: 'bool' },
    { key: 'sens', name: '瞄准灵敏度', type: 'range', min: 50, max: 150 },
    { key: 'fpsTarget', name: '帧率目标', type: 'choice', opts: [60, 120, 144, 240] },
    { key: 'colorblind', name: '色觉辅助', type: 'bool' }
  ];

  function drawSettings(ctx) {
    var S2 = sc(), s = S2.ui;
    bgDeep(ctx, G.t);
    var sv = DL.save.get();
    var cx = S2.W * 0.5;
    D.text(ctx, '设 置', cx, S2.H * 0.13, 20 * s, C.self, 'center', 700);
    D.text(ctx, 'S E T T I N G S', cx, S2.H * 0.13 + 18 * s, 8 * s, 'rgba(150,200,215,0.32)', 'center', 500);

    var rowH = 38 * s, w = 460 * s;
    var x0 = cx - w / 2, y0 = S2.H * 0.22;

    panel(ctx, x0 - 26 * s, y0 - 34 * s, w + 52 * s, SETROWS.length * rowH + 46 * s, { alpha: 0.66, cornerSize: 13 * s });
    panelTitle(ctx, '系 统', x0 - 12 * s, y0 - 12 * s, w + 24 * s);

    for (var i = 0; i < SETROWS.length; i++) {
      var row = SETROWS[i];
      var y = y0 + i * rowH;
      if (UI.hot(x0, y, w, rowH - 6 * s)) UI.setRow = i;
      var active = UI.setRow === i;
      var hovRow = UI.hot(x0, y, w, rowH - 6 * s) || active;
      ctx.fillStyle = active ? 'rgba(62,240,200,0.08)' : 'rgba(6,20,28,0.5)';
      ctx.fillRect(x0, y, w, rowH - 6 * s);
      if (active) {
        ctx.strokeStyle = U.rgba(C.self, 0.5);
        ctx.strokeRect(x0 + 0.5, y + 0.5, w, rowH - 6 * s);
      }
      D.text(ctx, row.name, x0 + 14 * s, y + rowH * 0.5 + 1 * s, 12 * s, active ? C.self : 'rgba(200,232,242,0.8)', 'left', 500);

      var val = sv.settings[row.key];
      if (row.type === 'pct' || row.type === 'range') {
        var rmin = row.min || 0, rmax = row.max || 100;
        var frac = U.clamp((val - rmin) / (rmax - rmin), 0, 1);
        var bx = x0 + w - 200 * s;
        ctx.fillStyle = 'rgba(120,160,175,0.18)';
        ctx.fillRect(bx, y + rowH * 0.5 - 3 * s, 140 * s, 6 * s);
        ctx.fillStyle = C.self;
        ctx.fillRect(bx, y + rowH * 0.5 - 3 * s, 140 * s * frac, 6 * s);
        var label = row.type === 'range' ? ('×' + (val / 100).toFixed(2)) : (val + '%');
        D.text(ctx, label, x0 + w - 14 * s, y + rowH * 0.5 + 4 * s, 11 * s, 'rgba(200,232,242,0.7)', 'right', 500);
        hit(bx - 10 * s, y, 60 * s, rowH - 6 * s, 'setdec', i);
        hit(bx + 140 * s - 10 * s, y, 60 * s, rowH - 6 * s, 'setinc', i);
      } else if (row.type === 'choice') {
        var bi = row.opts.indexOf(val);
        if (bi < 0) bi = 0;
        D.text(ctx, '◀', x0 + w - 120 * s, y + rowH * 0.5 + 4 * s, 11 * s, 'rgba(160,210,225,0.5)', 'center', 500);
        D.text(ctx, val + ' 帧', x0 + w - 66 * s, y + rowH * 0.5 + 4 * s, 12 * s, C.self, 'center', 600);
        D.text(ctx, '▶', x0 + w - 16 * s, y + rowH * 0.5 + 4 * s, 11 * s, 'rgba(160,210,225,0.5)', 'center', 500);
        hit(x0 + w - 150 * s, y, 60 * s, rowH - 6 * s, 'setdec', i);
        hit(x0 + w - 40 * s, y, 40 * s, rowH - 6 * s, 'setinc', i);
      } else {
        D.text(ctx, val ? '开' : '关', x0 + w - 14 * s, y + rowH * 0.5 + 4 * s, 12 * s, val ? C.self : 'rgba(160,210,225,0.4)', 'right', 600);
        hit(x0, y, w, rowH - 6 * s, 'settoggle', i);
      }
    }

    var bw = 120 * s, bh = 32 * s;
    button(ctx, cx - bw - 10 * s, S2.H - 60 * s, bw, bh, '按键设置', UI.setRow === SETROWS.length);
    hit(cx - bw - 10 * s, S2.H - 60 * s, bw, bh, 'keysOpen');
    button(ctx, cx + 10 * s, S2.H - 60 * s, bw, bh, '返回', UI.sel === 99);
    hit(cx + 10 * s, S2.H - 60 * s, bw, bh, 'back');
    screenCorners(ctx, S2, s);
  }

  /* ---------------- 图鉴 ---------------- */
  var CODEX_TABS = ['卡牌', '生物', 'Boss'];

  function codexEntries(tab) {
    if (tab === 0) {
      var arr = [];
      for (var i = 0; i < DL.CARDS.length; i++) arr.push({ key: 'c:' + DL.CARDS[i].id, data: DL.CARDS[i] });
      return arr;
    }
    if (tab === 1) {
      var out = [];
      for (var k in DL.ETYPE) out.push({ key: 'e:' + k, data: DL.ETYPE[k], type: k });
      return out;
    }
    var bs = [];
    for (var b = 0; b < DL.BOSSES.length; b++) bs.push({ key: 'b:' + DL.BOSSES[b].id, data: DL.BOSSES[b] });
    return bs;
  }

  function codexSeen(ent, sv) {
    if (ent.key.charAt(0) === 'c') return !!sv.cardsSeen[ent.key.slice(2)];
    if (ent.key.charAt(0) === 'e') return !!sv.codexE[ent.key.slice(2)];
    return !!sv.codex[ent.key.slice(2)];
  }

  function drawCodex(ctx) {
    var S2 = sc(), s = S2.ui;
    bgDeep(ctx, G.t);
    var sv = DL.save.get();
    var cx = S2.W * 0.5;

    D.text(ctx, '深 渊 档 案', cx, 34 * s, 18 * s, C.self, 'center', 700);

    /* 页签 */
    var tw = 132 * s, th = 30 * s, tgap = 10 * s;
    var totalW = tw * 3 + tgap * 2;
    var tx0 = cx - totalW / 2, ty = 52 * s;
    for (var t = 0; t < 3; t++) {
      var list = codexEntries(t);
      var got = 0;
      for (var q = 0; q < list.length; q++) if (codexSeen(list[q], sv)) got++;
      var on = UI.codexTab === t;
      var bx = tx0 + t * (tw + tgap);
      button(ctx, bx, ty, tw, th, CODEX_TABS[t], on, got + ' / ' + list.length);
      hit(bx, ty, tw, th, 'cxTab', t);
    }

    var list2 = codexEntries(UI.codexTab);
    if (UI.codexSel >= list2.length) UI.codexSel = 0;

    /* 左：网格  右：详情 */
    var gridX = 44 * s, gridY = 104 * s;
    var rightW = 300 * s;
    var gridW = S2.W - gridX * 2 - rightW - 24 * s;
    var cols = UI.codexTab === 0 ? 7 : (UI.codexTab === 1 ? 4 : 3);
    var rows = Math.ceil(list2.length / cols);
    var cellW = gridW / cols;
    var cellH = Math.min(64 * s, (S2.H - gridY - 110 * s) / Math.max(1, rows));

    for (var n = 0; n < list2.length; n++) {
      var ent = list2[n];
      var cxi = n % cols, cyi = Math.floor(n / cols);
      var ex = gridX + cxi * cellW, ey = gridY + cyi * cellH;
      var seen = codexSeen(ent, sv);
      var sel = UI.codexSel === n;

      ctx.fillStyle = sel ? 'rgba(62,240,200,0.10)' : 'rgba(6,20,28,0.45)';
      ctx.fillRect(ex + 2, ey + 2, cellW - 6, cellH - 6);
      ctx.strokeStyle = sel ? U.rgba(C.self, 0.8) : 'rgba(110,150,165,0.14)';
      ctx.lineWidth = sel ? 1.6 : 1;
      ctx.strokeRect(ex + 2.5, ey + 2.5, cellW - 6, cellH - 6);

      var col = seen ? (ent.data.color || (ent.data.rar ? DL.RARITY[ent.data.rar].col : C.self)) : 'rgba(120,150,165,0.35)';
      if (UI.codexTab === 0) {
        drawIcon(ctx, ent.data.icon, ex + cellW * 0.5, ey + cellH * 0.38, 13 * s, col, false, 0);
        D.text(ctx, seen ? ent.data.name : '？', ex + cellW * 0.5, ey + cellH - 10 * s, 9 * s,
          seen ? 'rgba(220,242,248,0.85)' : 'rgba(120,150,165,0.3)', 'center', 500);
      } else if (UI.codexTab === 1) {
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(ex + cellW * 0.5, ey + cellH * 0.4, 11 * s, 0, U.TAU); ctx.stroke();
        D.text(ctx, seen ? ent.data.name : '？', ex + cellW * 0.5, ey + cellH - 10 * s, 9 * s,
          seen ? 'rgba(220,242,248,0.85)' : 'rgba(120,150,165,0.3)', 'center', 500);
      } else {
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(ex + cellW * 0.5, ey + cellH * 0.4, 13 * s, 0, U.TAU); ctx.stroke();
        if (seen) {
          ctx.fillStyle = U.rgba(ent.data.color, 0.3);
          ctx.beginPath(); ctx.arc(ex + cellW * 0.5, ey + cellH * 0.4, 9 * s, 0, U.TAU); ctx.fill();
        }
        D.text(ctx, seen ? ent.data.name : '？', ex + cellW * 0.5, ey + cellH - 10 * s, 9 * s,
          seen ? 'rgba(220,242,248,0.85)' : 'rgba(120,150,165,0.3)', 'center', 500);
      }

      if (UI.hot(ex + 2, ey + 2, cellW - 6, cellH - 6)) UI.codexSel = n;
      hit(ex + 2, ey + 2, cellW - 6, cellH - 6, 'cxSel', n);
    }

    /* 详情面板 */
    var px = S2.W - 44 * s - rightW, py = 104 * s;
    var ph = S2.H - py - 74 * s;
    panel(ctx, px, py, rightW, ph, { alpha: 0.72, cornerSize: 12 * s });
    panelTitle(ctx, list2[UI.codexSel] && codexSeen(list2[UI.codexSel], sv) ? 'D E T A I L' : 'L O C K E D',
      px + 16 * s, py + 20 * s, rightW - 32 * s);

    var sel2 = list2[UI.codexSel];
    if (sel2) {
      var know = codexSeen(sel2, sv);
      var d = sel2.data;
      var tcx = px + 18 * s;
      if (!know) {
        D.text(ctx, '未 记 录', tcx, py + 38 * s, 15 * s, 'rgba(150,180,195,0.5)', 'left', 700);
        wrapText(ctx, '在深渊里遇见它之后，这里会被点亮。', tcx, py + 70 * s, rightW - 36 * s, 11 * s, 'rgba(150,180,195,0.45)', 17 * s);
      } else if (UI.codexTab === 0) {
        var rar = DL.RARITY[d.rar];
        D.text(ctx, d.name, tcx, py + 34 * s, 18 * s, C.white, 'left', 700);
        D.text(ctx, rar.name + ' · ' + (d.cat === 'w' ? '武器' : d.cat === 'u' ? '辅助' : d.cat === 'p' ? '被动' : '传说'),
          tcx, py + 54 * s, 10 * s, U.rgba(rar.col, 0.9), 'left', 500);
        var ty2 = py + 82 * s;
        for (var lv = 0; lv < d.desc.length; lv++) {
          D.text(ctx, 'Lv' + (lv + 1), tcx, ty2, 9 * s, 'rgba(160,210,225,0.5)', 'left', 600);
          ty2 = wrapText(ctx, d.desc[lv], tcx + 34 * s, ty2, rightW - 60 * s, 10 * s, 'rgba(200,232,242,0.8)', 15 * s) + 4 * s;
        }
        if (d.tags && d.tags.length) {
          var tgx = tcx;
          for (var tg = 0; tg < d.tags.length; tg++) {
            var tn = DL.CARD_TAGS[d.tags[tg]];
            if (!tn) continue;
            ctx.font = D.font(9 * s, 600);
            var tw2 = ctx.measureText(tn).width + 12 * s;
            ctx.fillStyle = U.rgba(rar.col, 0.16);
            ctx.fillRect(tgx, py + ph - 34 * s, tw2, 16 * s);
            D.text(ctx, tn, tgx + 6 * s, py + ph - 22 * s, 9 * s, U.rgba(rar.col, 0.9), 'left', 600);
            tgx += tw2 + 6 * s;
          }
        }
        var used = sv.cardsUsed[d.id] || 0;
        D.text(ctx, '已选择 ' + used + ' 次', tcx, py + ph - 46 * s, 10 * s, 'rgba(160,210,225,0.45)', 'left', 500);
      } else if (UI.codexTab === 1) {
        D.text(ctx, d.name, tcx, py + 34 * s, 18 * s, C.white, 'left', 700);
        D.text(ctx, '生命 ' + d.hp + ' · 半径 ' + d.r + ' · 速度 ' + d.spd + ' · 分数 ' + d.score,
          tcx, py + 56 * s, 10 * s, 'rgba(160,210,225,0.6)', 'left', 500);
        wrapText(ctx, d.desc || '', tcx, py + 84 * s, rightW - 36 * s, 11 * s, 'rgba(200,232,242,0.82)', 17 * s);
        D.text(ctx, '首次出现：第 ' + d.first + ' 层', tcx, py + ph - 18 * s, 10 * s, 'rgba(160,210,225,0.45)', 'left', 500);
      } else {
        D.text(ctx, d.name, tcx, py + 40 * s, 20 * s, C.white, 'left', 700);
        D.text(ctx, d.sub, tcx, py + 60 * s, 10 * s, U.rgba(d.color, 0.9), 'left', 500);
        D.text(ctx, '威胁 ' + d.rank + ' / 6 · 基准生命 ' + d.hp, tcx, py + 82 * s, 10 * s, 'rgba(160,210,225,0.6)', 'left', 500);
        wrapText(ctx, d.desc || '', tcx, py + 110 * s, rightW - 36 * s, 11 * s, 'rgba(200,232,242,0.82)', 17 * s);
        D.text(ctx, d.tips, tcx, py + ph - 34 * s, 10 * s, U.rgba(d.color, 0.7), 'left', 500);
        D.text(ctx, '每局随机 6 个 · 按威胁从低到高登场', tcx, py + ph - 18 * s, 9 * s, 'rgba(160,210,225,0.4)', 'left', 500);
      }
    }

    /* 底部统计 + 返回 */
    D.text(ctx, '最深 ' + U.depthStr(sv.bestDepth) + 'm   ·   最高分 ' + U.fmt(sv.bestScore) +
      '   ·   通关 ' + sv.clears + ' 次   ·   残骸 ◇' + U.fmt(sv.salvage),
      44 * s, S2.H - 18 * s, 11 * s, 'rgba(160,210,225,0.45)', 'left', 500);

    var bw = 120 * s, bh = 32 * s;
    button(ctx, S2.W - 44 * s - bw, S2.H - 48 * s, bw, bh, '返回', false);
    hit(S2.W - 44 * s - bw, S2.H - 48 * s, bw, bh, 'back');
    screenCorners(ctx, S2, s);
  }

  /* ---------------- 背包 ---------------- */
  function drawBag(ctx) {
    var S2 = sc(), s = S2.ui;
    if (!DL.PL.stats) { DL.ui.goto('title'); return; }
    DL.renderPlay(ctx, 0, false);
    ctx.fillStyle = 'rgba(2,8,14,0.86)';
    ctx.fillRect(0, 0, S2.W, S2.H);

    var p = DL.PL, st = p.stats;
    D.text(ctx, '背 包', S2.W * 0.5, 40 * s, 20 * s, C.self, 'center', 700);
    D.text(ctx, '已暂停 · 按 ' + DL.KB.labelAll('bag').split(' / ')[0] + ' 或 Esc 返回', S2.W * 0.5, 60 * s, 10 * s,
      'rgba(160,210,225,0.4)', 'center', 500);

    var owned = [];
    for (var i = 0; i < DL.CARDS.length; i++) {
      var c = DL.CARDS[i];
      var lv = (G.runCards[c.id] || 0);
      if (lv > 0) owned.push({ c: c, lv: lv });
    }

    /* 左：卡牌列表（两列） */
    var lx = 44 * s, ly = 92 * s;
    var colW = 250 * s, rowH = 46 * s;
    D.text(ctx, '卡牌  ' + owned.length + ' 种', lx, ly - 12 * s, 11 * s, 'rgba(160,210,225,0.45)', 'left', 500);
    for (var n = 0; n < owned.length && n < 16; n++) {
      var col = n % 2, row = Math.floor(n / 2);
      var ex = lx + col * colW;
      var ey = ly + row * rowH;
      var oc = owned[n];
      var rar = DL.RARITY[oc.c.rar];
      ctx.fillStyle = 'rgba(6,20,28,0.55)';
      ctx.fillRect(ex, ey, colW - 10 * s, rowH - 8 * s);
      ctx.strokeStyle = U.rgba(rar.col, 0.28);
      ctx.strokeRect(ex + 0.5, ey + 0.5, colW - 10 * s, rowH - 8 * s);
      drawIcon(ctx, oc.c.icon, ex + 20 * s, ey + (rowH - 8 * s) * 0.5, 11 * s, rar.col, false, 0);
      D.text(ctx, oc.c.name, ex + 40 * s, ey + 18 * s, 12 * s, C.white, 'left', 600);
      D.text(ctx, 'Lv' + oc.lv + ' / ' + (oc.c.repeat ? '∞' : oc.c.max), ex + 40 * s, ey + 32 * s, 9 * s,
        U.rgba(rar.col, 0.8), 'left', 500);
      clipText(ctx, oc.c.desc[Math.min(oc.lv, oc.c.desc.length) - 1] || '', ex + 118 * s, ey + 32 * s,
        colW - 10 * s - 122 * s, 8.5 * s, 'rgba(190,225,235,0.6)');
    }
    if (owned.length === 0) {
      D.text(ctx, '还没有拿到任何强化', lx, ly + 24 * s, 12 * s, 'rgba(160,210,225,0.4)', 'left', 500);
    }

    /* 右：当前属性 */
    var rx = S2.W - 44 * s - 300 * s, ry = 92 * s;
    panel(ctx, rx, ry, 300 * s, S2.H - ry - 40 * s, { alpha: 0.6, cornerSize: 12 * s });
    panelTitle(ctx, '当 前 属 性', rx + 16 * s, ry + 22 * s, 300 * s - 32 * s);

    var rows = [
      ['伤害倍率', '×' + st.dmgMul.toFixed(2)],
      ['射击间隔', (0.135 * st.rateMul).toFixed(3) + 's'],
      ['弹丸', st.count + ' 发'],
      ['穿透 / 分裂', st.pierce + ' / ' + st.split],
      ['船体', p.hp + ' / ' + p.maxHp + (p.shield ? '  +' + p.shield + '盾' : '')],
      ['护盾', String(p.shield)],
      ['暴击', Math.round(st.crit * 100) + '%  ×' + st.critPow.toFixed(1)],
      ['移速', '×' + st.moveMul.toFixed(2)],
      ['灯锥', Math.round(st.coneLen) + 'px / ' + Math.round(st.coneAng / DL.D2) + '°'],
      ['近距弱光', Math.round(st.nearR) + 'px'],
      ['近战', st.blade ? ('刃 Lv' + st.blade + ' · ' + Math.round(st.bladeR) + 'px') : (st.orbit ? ('环刃 ×' + st.orbit) : '—')],
      ['灼环 / 迟滞', (st.auraR ? Math.round(st.auraR) + 'px' : '—') + ' / ' + (st.slowField ? '有' : '—')],
      ['无人机', String(st.drone)],
      ['拾取半径', Math.round(st.magnet * (st.magnetMul || 1)) + 'px'],
      ['免费重抽', '×' + (G.rerollsLeft !== undefined ? G.rerollsLeft : st.rerolls)]
    ];
    for (var r2 = 0; r2 < rows.length; r2++) {
      var yy = ry + 46 * s + r2 * 21 * s;
      D.text(ctx, rows[r2][0], rx + 16 * s, yy, 10 * s, 'rgba(160,210,225,0.45)', 'left', 500);
      D.text(ctx, rows[r2][1], rx + 284 * s, yy, 11 * s, 'rgba(225,245,250,0.9)', 'right', 600);
    }

    var bw = 130 * s, bh = 32 * s;
    button(ctx, S2.W * 0.5 - bw / 2, S2.H - 44 * s, bw, bh, '继续下潜', true);
    hit(S2.W * 0.5 - bw / 2, S2.H - 44 * s, bw, bh, 'bagClose');
  }

  /* ---------------- 按键设置 ---------------- */
  var KEY_ACTIONS = ['up', 'down', 'left', 'right', 'dash', 'ping', 'bag', 'pause', 'fullscreen', 'mute'];

  function drawKeys(ctx) {
    var S2 = sc(), s = S2.ui;
    bgDeep(ctx, G.t);
    var cx = S2.W * 0.5;

    D.text(ctx, '按 键 设 置', cx, 36 * s, 18 * s, C.self, 'center', 700);
    D.text(ctx, '选中一项后按 Enter 或点击，然后按下新按键；Esc 取消', cx, 56 * s, 10 * s,
      'rgba(160,210,225,0.4)', 'center', 400);

    var rowH = 34 * s, listW = 460 * s;
    var x0 = cx - listW / 2, y0 = 84 * s;

    for (var i = 0; i < KEY_ACTIONS.length; i++) {
      var act = KEY_ACTIONS[i];
      var y = y0 + i * rowH;
      var active = UI.keySel === i;
      var cap = UI.capturing === act;

      ctx.fillStyle = cap ? 'rgba(255,206,92,0.14)' : (active ? 'rgba(62,240,200,0.10)' : 'rgba(6,20,28,0.5)');
      ctx.fillRect(x0, y, listW, rowH - 6 * s);
      ctx.strokeStyle = cap ? U.rgba(C.gold, 0.9) : (active ? U.rgba(C.self, 0.7) : 'rgba(110,150,165,0.16)');
      ctx.lineWidth = cap || active ? 1.5 : 1;
      ctx.strokeRect(x0 + 0.5, y + 0.5, listW, rowH - 6 * s);

      D.text(ctx, T.keyNames[act] || act, x0 + 16 * s, y + (rowH - 6 * s) * 0.5 + 5 * s, 12 * s,
        active ? C.self : 'rgba(200,232,242,0.8)', 'left', 500);

      var label = cap ? '按下新按键…' : DL.KB.labelAll(act);
      D.text(ctx, label, x0 + listW - 16 * s, y + (rowH - 6 * s) * 0.5 + 5 * s, 12 * s,
        cap ? C.gold : 'rgba(225,245,250,0.85)', 'right', 600);

      if (UI.hot(x0, y, listW, rowH - 6 * s)) UI.keySel = i;
      hit(x0, y, listW, rowH - 6 * s, 'keyRow', act);
    }

    var by = y0 + KEY_ACTIONS.length * rowH + 12 * s;
    var bw = 150 * s, bh = 30 * s;
    button(ctx, cx - bw - 8 * s, by, bw, bh, '恢复默认', false);
    hit(cx - bw - 8 * s, by, bw, bh, 'keyReset');
    button(ctx, cx + 8 * s, by, bw, bh, '返回', false);
    hit(cx + 8 * s, by, bw, bh, 'back');
  }

  /* 开始捕获一个按键 */
  function beginCapture(act) {
    UI.capturing = act;
    I.capture = function (code) {
      UI.capturing = null;
      if (code === 'Escape') { DL.audio.sfx.back(); return; }
      DL.KB.set(act, code);
      DL.audio.sfx.confirm();
    };
  }

  /* ---------------- 暂停 ---------------- */
  function drawPause(ctx) {
    var S2 = sc(), s = S2.ui;
    DL.renderPlay(ctx, 0, false);
    ctx.fillStyle = 'rgba(2,8,14,0.78)';
    ctx.fillRect(0, 0, S2.W, S2.H);
    var cx = S2.W * 0.5;
    D.glowText(ctx, '已 暂 停', cx, S2.H * 0.32, 30 * s, C.self, 'center', 16);
    D.text(ctx, '深度 ' + U.depthStr(G.depth) + 'm · 第 ' + G.layer + ' 层', cx, S2.H * 0.32 + 24 * s, 11 * s, 'rgba(160,210,225,0.5)', 'center', 500);
    var fsHint = (DL.fs && DL.fs.host)
      ? 'F / F11 切换全屏 · Esc 暂停不会退出全屏'
      : 'F 切换全屏 · 点击画面锁定鼠标';
    D.text(ctx, fsHint, cx, S2.H * 0.32 + 44 * s, 10 * s, 'rgba(160,210,225,0.3)', 'center', 400);

    var items = ['继续下潜', '设 置', '放弃本次下潜'];
    var bw = 240 * s, bh = 36 * s, gap = 10 * s;
    var y0 = S2.H * 0.48;
    panel(ctx, cx - bw / 2 - 22 * s, y0 - 34 * s, bw + 44 * s, items.length * (bh + gap) + 40 * s,
      { alpha: 0.62, corners: true, cornerSize: 13 * s });
    panelTitle(ctx, 'P A U S E', cx - bw / 2 - 10 * s, y0 - 16 * s, bw + 20 * s);
    for (var i = 0; i < items.length; i++) {
      var y = y0 + i * (bh + gap);
      button(ctx, cx - bw / 2, y, bw, bh, items[i], UI.sel === i);
      hit(cx - bw / 2, y, bw, bh, 'pause', i);
    }
    screenCorners(ctx, S2, s);
  }

  /* ---------------- 结局 ---------------- */
  var END_LINES = [
    '你抵达了没有人抵达过的地方。',
    '4200m。',
    '深渊记住了你的光。'
  ];

  function drawEnding(ctx) {
    var S2 = sc(), s = S2.ui, t = UI.t;
    ctx.fillStyle = '#01030a';
    ctx.fillRect(0, 0, S2.W, S2.H);
    var cx = S2.W * 0.5, cy = S2.H * 0.5;

    var pk = Math.min(1, Math.max(0, (t - 1.2) / 3.0));
    if (pk > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      var r = 6 + pk * pk * 260;
      D.glow(ctx, cx, cy, r, '#bfe9ff', 0.5 * pk);
      ctx.fillStyle = 'rgba(255,255,255,' + (0.9 * pk) + ')';
      ctx.beginPath(); ctx.arc(cx, cy, 2 + pk * 6, 0, U.TAU); ctx.fill();
      ctx.restore();
    }

    for (var i = 0; i < END_LINES.length; i++) {
      var start = 4.0 + i * 2.4;
      var a = Math.min(1, Math.max(0, (t - start) / 1.4));
      if (a <= 0) continue;
      ctx.save();
      ctx.globalAlpha = a;
      D.text(ctx, END_LINES[i], cx, cy - 46 * s + i * 40 * s, (i === 1 ? 22 : 14) * s, i === 1 ? '#ffffff' : 'rgba(220,240,250,0.85)', 'center', i === 1 ? 700 : 500);
      ctx.restore();
    }

    if (t > 11) {
      var a2 = Math.min(1, (t - 11) / 1.5);
      ctx.save();
      ctx.globalAlpha = a2 * (0.6 + Math.sin(t * 3) * 0.2);
      D.text(ctx, '无尽深渊 已解锁', cx, cy + 110 * s, 13 * s, C.gold, 'center', 600);
      ctx.restore();
    }

    if (t > 14.5) {
      UI.goto('summary');
    }
  }

  /* ---------------- 输入处理 ---------------- */
  UI.onInput = function (keys, clicks) {
    var screen = G.screen;

    for (var ci = 0; ci < clicks.length; ci++) UI.ripple(clicks[ci].x, clicks[ci].y);

    function pressed(code) { return keys.indexOf(code) >= 0; }

    if (screen === 'title') {
      if (pressed('ArrowUp') || pressed('KeyW')) { UI.sel = (UI.sel + 5) % 6; DL.audio.sfx.menu(); }
      if (pressed('ArrowDown') || pressed('KeyS')) { UI.sel = (UI.sel + 1) % 6; DL.audio.sfx.menu(); }
      if (pressed('Enter') || pressed('Space')) {
        if (UI.sel === 4 && !DL.save.get().endless) { DL.audio.sfx.back(); }
        else doTitle(UI.sel);
      }
      for (var c = 0; c < clicks.length; c++) {
        var h = hoverAny(clicks[c].x, clicks[c].y);
        if (h >= 0 && UI.hits[h].act === 'title') doTitle(UI.hits[h].opt);
      }
      return;
    }

    if (screen === 'intro') {
      UI.t += 1 / 60;
      if (keys.length > 0 || clicks.length > 0) UI.beginPlay();
      return;
    }

    if (screen === 'cards') {
      if (pressed('Digit1') || pressed('Numpad1')) { DL.takeCard(0); return; }
      if (pressed('Digit2') || pressed('Numpad2')) { DL.takeCard(1); return; }
      if (pressed('Digit3') || pressed('Numpad3')) { DL.takeCard(2); return; }
      if (pressed('ArrowLeft') || pressed('KeyA')) { UI.sel = (UI.sel + 2) % 3; DL.audio.sfx.hover(); }
      if (pressed('ArrowRight') || pressed('KeyD')) { UI.sel = (UI.sel + 1) % 3; DL.audio.sfx.hover(); }
      if (pressed('Enter') || pressed('Space')) { DL.takeCard(UI.sel); return; }
      if (pressed('KeyR')) { if (DL.reroll()) UI.sel = 0; return; }
      for (var i = 0; i < clicks.length; i++) {
        var hh = hoverAny(clicks[i].x, clicks[i].y);
        if (hh < 0) continue;
        var b = UI.hits[hh];
        if (b.act === 'card') { DL.takeCard(b.opt); return; }
        if (b.act === 'reroll') { DL.reroll(); return; }
      }
      return;
    }

    if (screen === 'summary') {
      if (pressed('ArrowLeft') || pressed('KeyA')) UI.sel = (UI.sel + 2) % 3;
      if (pressed('ArrowRight') || pressed('KeyD')) UI.sel = (UI.sel + 1) % 3;
      if (pressed('Enter') || pressed('Space')) doSummary(UI.sel);
      if (pressed('KeyR')) doSummary(0);
      for (var j = 0; j < clicks.length; j++) {
        var h2 = hoverAny(clicks[j].x, clicks[j].y);
        if (h2 >= 0 && UI.hits[h2].act === 'sum') doSummary(UI.hits[h2].opt);
      }
      return;
    }

    if (screen === 'tree') {
      if (pressed('Escape')) { UI.goto('title'); return; }
      if (pressed('Enter') || pressed('Space')) buySel();
      for (var k = 0; k < clicks.length; k++) {
        var h3 = hoverAny(clicks[k].x, clicks[k].y);
        if (h3 < 0) continue;
        var bb = UI.hits[h3];
        if (bb.act === 'node') { UI.treeSel = bb.opt; buySel(); }
        else if (bb.act === 'treeBack') UI.goto(UI.treeFrom || 'title');
        else if (bb.act === 'treeReset') {
          DL.save.resetTree();
          DL.rebuildMeta();
          DL.audio.sfx.confirm();
        }
      }
      return;
    }

    if (screen === 'settings') {
      if (pressed('Escape')) { UI.goto(UI.setFrom || 'title'); return; }
      if (pressed('ArrowUp') || pressed('KeyW')) UI.setRow = (UI.setRow + SETROWS.length - 1) % SETROWS.length;
      if (pressed('ArrowDown') || pressed('KeyS')) UI.setRow = (UI.setRow + 1) % SETROWS.length;
      if (pressed('ArrowLeft') || pressed('KeyA')) adjust(-1);
      if (pressed('ArrowRight') || pressed('KeyD')) adjust(1);
      for (var m = 0; m < clicks.length; m++) {
        var h4 = hoverAny(clicks[m].x, clicks[m].y);
        if (h4 < 0) continue;
        var b4 = UI.hits[h4];
        if (b4.act === 'setdec') adjust(-1, b4.opt);
        else if (b4.act === 'setinc') adjust(1, b4.opt);
        else if (b4.act === 'settoggle') { toggleRow(b4.opt); }
        else if (b4.act === 'keysOpen') { UI.goto('keys'); }
        else if (b4.act === 'back') UI.goto(UI.setFrom || 'title');
      }
      return;
    }

    if (screen === 'codex') {
      if (pressed('Escape') || pressed('Enter')) { UI.goto('title'); return; }
      if (pressed('ArrowLeft') || pressed('KeyA')) { UI.codexTab = (UI.codexTab + 2) % 3; UI.codexSel = 0; DL.audio.sfx.hover(); }
      if (pressed('ArrowRight') || pressed('KeyD')) { UI.codexTab = (UI.codexTab + 1) % 3; UI.codexSel = 0; DL.audio.sfx.hover(); }
      if (pressed('ArrowUp') || pressed('KeyW')) { UI.codexSel = Math.max(0, UI.codexSel - 1); DL.audio.sfx.hover(); }
      if (pressed('ArrowDown') || pressed('KeyS')) {
        var len = codexEntries(UI.codexTab).length;
        UI.codexSel = Math.min(len - 1, UI.codexSel + 1);
        DL.audio.sfx.hover();
      }
      for (var n2 = 0; n2 < clicks.length; n2++) {
        var h5 = hoverAny(clicks[n2].x, clicks[n2].y);
        if (h5 < 0) continue;
        var b5 = UI.hits[h5];
        if (b5.act === 'back') UI.goto('title');
        else if (b5.act === 'cxTab') { UI.codexTab = b5.opt; UI.codexSel = 0; }
        else if (b5.act === 'cxSel') UI.codexSel = b5.opt;
      }
      return;
    }

    if (screen === 'bag') {
      for (var n3 = 0; n3 < clicks.length; n3++) {
        var h6 = hoverAny(clicks[n3].x, clicks[n3].y);
        if (h6 >= 0 && UI.hits[h6].act === 'bagClose') { DL.ui.goto('play'); return; }
      }
      return;
    }

    if (screen === 'keys') {
      if (UI.capturing) return;
      if (pressed('Escape')) { UI.goto('settings'); return; }
      if (pressed('ArrowUp') || pressed('KeyW')) { UI.keySel = (UI.keySel + KEY_ACTIONS.length - 1) % KEY_ACTIONS.length; DL.audio.sfx.hover(); }
      if (pressed('ArrowDown') || pressed('KeyS')) { UI.keySel = (UI.keySel + 1) % KEY_ACTIONS.length; DL.audio.sfx.hover(); }
      if (pressed('Enter') || pressed('Space')) { beginCapture(KEY_ACTIONS[UI.keySel]); return; }
      for (var n4 = 0; n4 < clicks.length; n4++) {
        var h7 = hoverAny(clicks[n4].x, clicks[n4].y);
        if (h7 < 0) continue;
        var b7 = UI.hits[h7];
        if (b7.act === 'keyRow') { UI.keySel = KEY_ACTIONS.indexOf(b7.opt); beginCapture(b7.opt); }
        else if (b7.act === 'keyReset') { DL.KB.restore(); DL.audio.sfx.confirm(); }
        else if (b7.act === 'back') UI.goto('settings');
      }
      return;
    }

    if (screen === 'paused') {
      if (pressed('Escape') || pressed('KeyP')) { resume(); return; }
      if (pressed('ArrowUp') || pressed('KeyW')) UI.sel = (UI.sel + 2) % 3;
      if (pressed('ArrowDown') || pressed('KeyS')) UI.sel = (UI.sel + 1) % 3;
      if (pressed('Enter') || pressed('Space')) doPause(UI.sel);
      for (var q = 0; q < clicks.length; q++) {
        var h6 = hoverAny(clicks[q].x, clicks[q].y);
        if (h6 >= 0 && UI.hits[h6].act === 'pause') doPause(UI.hits[h6].opt);
      }
      return;
    }

    if (screen === 'ending') {
      UI.t += 1 / 60;
      return;
    }
  };

  function adjust(dir, rowIdx) {
    var sv = DL.save.get();
    var row = SETROWS[rowIdx === undefined ? UI.setRow : rowIdx];
    if (!row) return;
    if (row.type === 'bool') { toggleRow(rowIdx === undefined ? UI.setRow : rowIdx); return; }
    if (row.type === 'choice') {
      var ci = row.opts.indexOf(sv.settings[row.key]);
      if (ci < 0) ci = 0;
      ci = (ci + dir + row.opts.length) % row.opts.length;
      sv.settings[row.key] = row.opts[ci];
      DL.save.flush();
      if (DL.S.applyScale) DL.S.applyScale();     // 立刻按新目标调分辨率
      DL.audio.sfx.hover();
      return;
    }
    var min = row.min || 0, max = row.max || 100;
    var v = sv.settings[row.key] + dir * 5;
    sv.settings[row.key] = U.clamp(v, min, max);
    DL.save.flush();
    DL.audio.setVolumes();
    DL.audio.sfx.hover();
  }

  function toggleRow(i) {
    var sv = DL.save.get();
    var row = SETROWS[i];
    sv.settings[row.key] = !sv.settings[row.key];
    DL.save.flush();
    DL.audio.setVolumes();
    DL.audio.sfx.confirm();
  }

  function buySel() {
    var n = DL.TREE_NODES[UI.treeSel];
    if (!n) return;
    if (DL.save.buyNode(n)) {
      DL.rebuildMeta();
      DL.audio.sfx.confirm();
    } else DL.audio.sfx.back();
  }

  function doTitle(i) {
    if (i === 0) { UI.pendingEndless = false; UI.t = 0; UI.goto('intro'); DL.audio.unlock(); }
    else if (i === 1) { UI.setFrom = 'title'; UI.goto('settings'); }
    else if (i === 2) { UI.goto('codex'); }
    else if (i === 3) { UI.treeFrom = 'title'; UI.goto('tree'); }
    else if (i === 4) {
      if (!DL.save.get().endless) { DL.audio.sfx.back(); return; }
      UI.pendingEndless = true;
      UI.t = 0; UI.goto('intro');
    }
    else if (i === 5) { DL.quitGame(); return; }
    DL.audio.sfx.confirm();
  }

  function doSummary(i) {
    if (i === 0) {
      /* 重开同一模式：在无尽里死了就再来一次无尽 */
      UI.pendingEndless = !!G.endlessRun;
      UI.t = 0; UI.goto('intro');
    }
    else if (i === 1) { UI.treeFrom = 'summary'; UI.goto('tree'); }
    else { UI.pendingEndless = false; UI.goto('title'); }
    DL.audio.sfx.confirm();
  }

  function doPause(i) {
    if (i === 0) resume();
    else if (i === 1) { UI.setFrom = 'paused'; UI.goto('settings'); }
    else if (i === 2) { DL.ui.abandon = true; }
    DL.audio.sfx.confirm();
  }

  function resume() {
    if (UI.setFrom === 'paused') { UI.setFrom = null; UI.goto('play'); return; }
    UI.goto('play');
  }

  UI.resume = function () { UI.goto('play'); };

  /* ---------------- 渲染分发 ---------------- */
  UI.render = function (ctx, dt) {
    UI.hits = [];
    UI.hotKey = '';
    UI.pressT = Math.max(0, UI.pressT - dt);
    UI.quitHint = Math.max(0, (UI.quitHint || 0) - dt);
    for (var r = UI.ripples.length - 1; r >= 0; r--) {
      UI.ripples[r].t += dt;
      if (UI.ripples[r].t > 0.55) UI.ripples.splice(r, 1);
    }

    var screen = G.screen;
    if (screen === 'title') drawTitle(ctx);
    else if (screen === 'intro') drawIntro(ctx);
    else if (screen === 'play') { DL.renderPlay(ctx, dt, true); }
    else if (screen === 'cards') drawCards(ctx);
    else if (screen === 'summary') drawSummary(ctx);
    else if (screen === 'tree') drawTree(ctx);
    else if (screen === 'settings') drawSettings(ctx);
    else if (screen === 'keys') drawKeys(ctx);
    else if (screen === 'codex') drawCodex(ctx);
    else if (screen === 'bag') drawBag(ctx);
    else if (screen === 'paused') drawPause(ctx);
    else if (screen === 'ending') drawEnding(ctx);
    else DL.renderPlay(ctx, dt, true);

    drawRipples(ctx);
  };

  function drawRipples(ctx) {
    if (!UI.ripples.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < UI.ripples.length; i++) {
      var r = UI.ripples[i];
      var k = r.t / 0.55;
      var rad = 6 + k * 46;
      ctx.strokeStyle = U.rgba(C.self, (1 - k) * 0.55);
      ctx.lineWidth = 2 * (1 - k) + 0.4;
      ctx.beginPath(); ctx.arc(r.x, r.y, rad, 0, U.TAU); ctx.stroke();
      ctx.strokeStyle = U.rgba('#ffffff', (1 - k) * 0.20);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(r.x, r.y, rad * 0.55, 0, U.TAU); ctx.stroke();
    }
    ctx.restore();
  }

})();
