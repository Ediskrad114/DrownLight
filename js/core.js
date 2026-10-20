/* ==========================================================================
   光溺 DROWNLIGHT · core.js
   工具函数 / 画布与尺寸 / 输入 / 存档 / 全局状态
   ========================================================================== */
window.DL = window.DL || {};
(function () {
  'use strict';

  var T = DL.T;

  /* ---------------- 工具 ---------------- */
  var rgbaCache = Object.create(null), rgbaN = 0;
  var U = {
    TAU: Math.PI * 2,
    rnd: function (a, b) { if (b === undefined) { b = a; a = 0; } return a + Math.random() * (b - a); },
    rndInt: function (a, b) { return Math.floor(U.rnd(a, b + 1)); },
    clamp: function (v, a, b) { return v < a ? a : (v > b ? b : v); },
    lerp: function (a, b, t) { return a + (b - a) * t; },
    dist: function (ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); },
    dist2: function (ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; },
    ang: function (ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); },
    angDiff: function (a, b) { var d = (b - a) % U.TAU; if (d > Math.PI) d -= U.TAU; if (d < -Math.PI) d += U.TAU; return d; },
    pick: function (arr) { return arr[(Math.random() * arr.length) | 0]; },
    shuffle: function (a) { for (var i = a.length - 1; i > 0; i--) { var j = (Math.random() * (i + 1)) | 0; var t = a[i]; a[i] = a[j]; a[j] = t; } return a; },
    fmt: function (n) {
      n = Math.round(n);
      var s = String(n), out = '';
      for (var i = 0; i < s.length; i++) {
        if (i > 0 && (s.length - i) % 3 === 0) out += ',';
        out += s[i];
      }
      return out;
    },
    depthStr: function (m) {
      if (m >= 10000) return (m / 10000).toFixed(2) + '×10⁴';
      return String(Math.round(m));
    },
    rgba: function (hex, a) {
      if (typeof hex !== 'string') return hex;
      if (hex.charAt(0) !== '#') return hex;              // 已经是 rgba(...) 之类，直接透传
      if (a === undefined) a = 1;
      var q = Math.round(a * 200);
      if (q > 200) q = 200; else if (q < 0) q = 0;
      var key = hex + q;
      var v = rgbaCache[key];
      if (v !== undefined) return v;
      var h = hex.slice(1);
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      var n = parseInt(h, 16);
      v = 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + (q / 200) + ')';
      if (rgbaN > 6000) { rgbaCache = Object.create(null); rgbaN = 0; }
      rgbaCache[key] = v; rgbaN++;
      return v;
    }
  };
  DL.U = U;

  /* ---------------- 画布 ---------------- */
  var S = {
    canvas: null, ctx: null,
    W: 1280, H: 720, DPR: 1, tx: 1,
    scale: 1,
    ui: 1,
    bgGrad: null, vig: null, bgTex: null, vigTex: null,
    resizeCbs: []
  };

  S.init = function () {
    S.canvas = document.getElementById('cv');
    S.ctx = S.canvas.getContext('2d', { alpha: false });
    window.addEventListener('resize', S.resize);
    window.addEventListener('orientationchange', function () { setTimeout(S.resize, 120); });
    S.resize();
  };

  /* 只改画布像素分辨率，不动任何游戏数据（自适应画质用） */
  S.applyScale = function () {
    var tx = S.DPR * S.scale;
    /* 像素预算：帧率目标越高，先天的像素上限越低 */
    var cap = (T.perf && T.perf.maxPixels) || 4000000;
    var tg = 120;
    try { tg = DL.save.get().settings.fpsTarget || 120; } catch (e) { }
    if (tg >= 240) cap = Math.min(cap, 2300000);
    else if (tg >= 144) cap = Math.min(cap, 3100000);
    var px = S.W * S.H * tx * tx;
    if (px > cap) tx *= Math.sqrt(cap / px);
    S.tx = tx;
    S.canvas.width = Math.max(2, Math.round(S.W * S.tx));
    S.canvas.height = Math.max(2, Math.round(S.H * S.tx));
    S.ctx.setTransform(S.tx, 0, 0, S.tx, 0, 0);
  };

  /* 帧率长期不够时降分辨率，恢复后再升回来 */
  S.setScale = function (k) {
    k = U.clamp(k, 0.5, 1);
    if (Math.abs(k - S.scale) < 0.01) return;
    S.scale = k;
    S.applyScale();
  };

  S.resize = function () {
    var w = window.innerWidth, h = window.innerHeight;
    S.DPR = Math.min(window.devicePixelRatio || 1, T.maxDPR);
    S.W = Math.max(320, w);
    S.H = Math.max(240, h);
    S.canvas.style.width = S.W + 'px';
    S.canvas.style.height = S.H + 'px';
    S.ui = U.clamp(Math.min(S.W / 1280, S.H / 720), 0.72, 1.5);
    S.applyScale();

    var g = S.ctx.createLinearGradient(0, 0, 0, S.H);
    g.addColorStop(0, DL.C ? DL.C.bg0 : '#03101a');
    g.addColorStop(1, DL.C ? DL.C.bg1 : '#07242b');
    S.bgGrad = g;

    var r = Math.max(S.W, S.H) * 0.78;
    var vg = S.ctx.createRadialGradient(S.W * 0.5, S.H * 0.5, r * 0.28, S.W * 0.5, S.H * 0.5, r);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(0.62, 'rgba(0,3,8,0.30)');
    vg.addColorStop(1, 'rgba(0,2,6,0.80)');
    S.vig = vg;

    /* 背景与暗角都是静态的：烘成半分辨率贴图，每帧只做一次 drawImage，
       省掉全屏渐变求值（这是每帧最贵的两笔之一） */
    var hw = Math.max(2, Math.round(S.W * 0.5)), hh = Math.max(2, Math.round(S.H * 0.5));
    var bc = document.createElement('canvas'); bc.width = hw; bc.height = hh;
    var bx = bc.getContext('2d');
    var bg2 = bx.createLinearGradient(0, 0, 0, hh);
    bg2.addColorStop(0, DL.C ? DL.C.bg0 : '#03101a');
    bg2.addColorStop(1, DL.C ? DL.C.bg1 : '#07242b');
    bx.fillStyle = bg2; bx.fillRect(0, 0, hw, hh);
    S.bgTex = bc;

    var vc = document.createElement('canvas'); vc.width = hw; vc.height = hh;
    var vx = vc.getContext('2d');
    var vr = Math.max(hw, hh) * 0.78;
    var vg2 = vx.createRadialGradient(hw * 0.5, hh * 0.5, vr * 0.28, hw * 0.5, hh * 0.5, vr);
    vg2.addColorStop(0, 'rgba(0,0,0,0)');
    vg2.addColorStop(0.62, 'rgba(0,3,8,0.30)');
    vg2.addColorStop(1, 'rgba(0,2,6,0.80)');
    vx.fillStyle = vg2; vx.fillRect(0, 0, hw, hh);
    S.vigTex = vc;

    for (var i = 0; i < S.resizeCbs.length; i++) S.resizeCbs[i]();
  };

  S.onResize = function (fn) { S.resizeCbs.push(fn); };
  DL.S = S;

  /* ---------------- 全屏与指针锁定 ---------------- */
  var FS = {
    want: true,
    on: false,
    denied: false,
    locked: false,
    lockFailed: false,
    /* 在 exe（WebView2）里，全屏是宿主窗口的事，不走 DOM Fullscreen API。
       这样 Esc 就只是解除指针锁定 → 暂停，Chromium 没有全屏可退。 */
    host: !!(window.chrome && window.chrome.webview && window.chrome.webview.postMessage)
  };

  FS.postHost = function (on) {
    try { window.chrome.webview.postMessage(on ? 'fs:1' : 'fs:0'); } catch (e) { }
  };

  /* 宿主用 F11 改窗口状态时，反过来同步页面 */
  FS.setFromHost = function (on) {
    FS.on = !!on;
    FS.want = !!on;
    if (!on) FS.userOff = true;      // 用户主动退出全屏，本局不再自动抢回来
  };

  FS.tryEnter = function () {
    if (FS.on || FS.denied) return;
    FS.userOff = false;
    if (FS.host) { FS.on = true; FS.want = true; FS.postHost(true); return; }
    var el = document.documentElement;
    var fn = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
    if (!fn) { FS.denied = true; return; }
    try {
      var p = fn.call(el);
      if (p && p.catch) p.catch(function () { FS.denied = true; });
    } catch (e) { FS.denied = true; }
  };

  FS.exit = function () {
    FS.want = false;
    FS.userOff = true;
    if (FS.host) { FS.on = false; FS.postHost(false); return; }
    var ex = document.exitFullscreen || document.webkitExitFullscreen;
    if (ex) { try { ex.call(document); } catch (e) { } }
    FS.on = false;
  };

  FS.toggle = function () {
    if (FS.on) FS.exit();
    else { FS.denied = false; FS.want = true; FS.tryEnter(); }
  };

  FS.lock = function (soft) {
    if (FS.locked) return;
    if (!soft && FS.lockFailed) return;
    if (DL.input && DL.input.usingTouch) return;
    var cv = S.canvas;
    var fn = cv.requestPointerLock || cv.webkitRequestPointerLock;
    if (!fn) { FS.lockFailed = true; return; }
    try {
      var p = fn.call(cv);
      if (p && p.catch) p.catch(function () { if (!soft) FS.lockFailed = true; });
    } catch (e) { if (!soft) FS.lockFailed = true; }
  };

  FS.unlock = function () {
    if (!FS.locked) return;
    var ex = document.exitPointerLock || document.webkitExitPointerLock;
    if (ex) { try { ex.call(document); } catch (e) { } }
  };

  /* 在真实用户手势里调用，浏览器才允许进全屏 / 锁指针 */
  FS.gesture = function () {
    if (FS.want && !FS.on) FS.tryEnter();
  };

  document.addEventListener('fullscreenchange', function () {
    if (FS.host) return;
    FS.on = !!document.fullscreenElement;
    if (!FS.on) FS.want = false;      // 用户按 Esc 主动退出，不再自动重进
  });

  document.addEventListener('pointerlockchange', function () {
    var wasLocked = FS.locked;
    FS.locked = document.pointerLockElement === S.canvas;
    if (DL.input) DL.input.locked = FS.locked;
    if (wasLocked && !FS.locked && DL.ui) {
      // Esc 解除锁定 —— 直接暂停，避免鼠标飘出去
      if (G.screen === 'play') DL.ui.goto('paused');
    }
  });

  document.addEventListener('pointerlockerror', function () { FS.lockFailed = true; });

  DL.fs = FS;

  /* 退出游戏：exe 里让宿主关窗口；浏览器里没有权限，只能尽量关标签页 */
  DL.quitGame = function () {
    if (FS.host) {
      try { window.chrome.webview.postMessage('quit'); return; } catch (e) { }
    }
    if (DL.ui) DL.ui.quitHint = 5.0;
    try { window.close(); } catch (e) { }
  };

  /* ---------------- 按键绑定 ---------------- */
  var KB = {
    map: null,
    reset: function () {
      KB.map = {};
      for (var k in T.keys) KB.map[k] = T.keys[k].slice();
      var sv = DL.save.get();
      if (sv.keys) {
        for (var a in sv.keys) {
          if (!T.keys[a]) continue;
          var v = sv.keys[a];
          if (v && v.length) KB.map[a] = v.slice();
        }
      }
    },
    codes: function (action) { return KB.map[action] || []; },
    down: function (action) {
      var c = KB.map[action];
      if (!c) return false;
      for (var i = 0; i < c.length; i++) if (I.keys[c[i]]) return true;
      return false;
    },
    hit: function (queue, action) {
      var c = KB.map[action];
      if (!c) return false;
      for (var i = 0; i < queue.length; i++) if (c.indexOf(queue[i]) >= 0) return true;
      return false;
    },
    /* 改键：同一个键只保留在一个动作上；被抢走最后一个键的动作改用旧键，避免出现空绑定 */
    set: function (action, code) {
      if (!KB.map[action]) return;
      var old = KB.map[action].slice();
      for (var a in KB.map) {
        if (a === action) continue;
        var idx = KB.map[a].indexOf(code);
        if (idx < 0) continue;
        KB.map[a].splice(idx, 1);
        if (KB.map[a].length === 0) KB.map[a] = old.slice();
      }
      KB.map[action] = [code];
      KB.save();
    },
    save: function () {
      var sv = DL.save.get();
      sv.keys = sv.keys || {};
      for (var a in KB.map) sv.keys[a] = KB.map[a].slice();
      DL.save.flush();
    },
    restore: function () {
      var sv = DL.save.get();
      sv.keys = {};
      DL.save.flush();
      KB.reset();
    },
    isDefault: function () {
      var sv = DL.save.get();
      return !sv.keys || Object.keys(sv.keys).length === 0;
    }
  };

  var KEY_LABEL = {
    Space: '空格', ShiftLeft: '左Shift', ShiftRight: '右Shift', ControlLeft: '左Ctrl',
    Escape: 'Esc', Enter: '回车', Tab: 'Tab', Backspace: '退格',
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
    KeyW: 'W', KeyA: 'A', KeyS: 'S', KeyD: 'D', KeyQ: 'Q', KeyE: 'E', KeyF: 'F',
    KeyR: 'R', KeyB: 'B', KeyM: 'M', KeyP: 'P', KeyC: 'C', KeyV: 'V',
    Digit1: '1', Digit2: '2', Digit3: '3', Digit4: '4', Digit5: '5'
  };
  KB.label = function (code) {
    if (!code) return '—';
    if (KEY_LABEL[code]) return KEY_LABEL[code];
    return String(code).replace('Key', '').replace('Digit', '').replace('Numpad', '小键盘');
  };
  KB.labelAll = function (action) {
    var c = KB.codes(action);
    var out = [];
    for (var i = 0; i < c.length; i++) out.push(KB.label(c[i]));
    return out.join(' / ');
  };
  DL.KB = KB;

  /* ---------------- 输入 ---------------- */
  var I = {
    keys: {},
    queue: [],
    clicks: [],
    px: 0, py: 0,
    hasPointer: false,       // 鼠标是否动过
    pointerT: 0,
    mDown: false,
    locked: false,
    touch: { on: false, sx: 0, sy: 0, x: 0, y: 0, id: -1 },
    usingTouch: false
  };

  function clampCursor() {
    I.px = U.clamp(I.px, 4, S.W - 4);
    I.py = U.clamp(I.py, 4, S.H - 4);
  }

  I.init = function () {
    I.px = S.W * 0.62; I.py = S.H * 0.4;

    window.addEventListener('keydown', function (e) {
      if (I.capture) {
        e.preventDefault();
        if (e.repeat) return;
        var fn = I.capture;
        I.capture = null;
        fn(e.code);
        return;
      }
      /* 控制台优先：打开时吃掉所有按键，关闭时只吃 `~` */
      if (DL.console && DL.console.onKey(e)) return;
      if (e.repeat) { I.keys[e.code] = true; return; }
      I.keys[e.code] = true;
      I.queue.push(e.code);
      FS.gesture();
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'ArrowDown' ||
          e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'Tab') {
        e.preventDefault();
      }
    }, { passive: false });

    window.addEventListener('keyup', function (e) { I.keys[e.code] = false; });
    window.addEventListener('blur', function () { I.keys = {}; I.mDown = false; I.touch.on = false; });

    var cv = S.canvas;

    /* 锁定状态下用 movementX/Y 驱动虚拟光标，彻底避免光标飘出窗口 */
    window.addEventListener('mousemove', function (e) {
      if (I.locked) {
        var sens = (DL.save.get().settings.sens || 100) / 100;
        I.px += (e.movementX || 0) * sens;
        I.py += (e.movementY || 0) * sens;
        clampCursor();
        I.hasPointer = true; I.pointerT = 0;
        return;
      }
      I.px = e.clientX; I.py = e.clientY;
      I.hasPointer = true; I.pointerT = 0;
    });

    cv.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') {
        if (I.touch.id === e.pointerId) { I.touch.x = e.clientX; I.touch.y = e.clientY; }
        return;
      }
      if (I.locked) return;
      I.px = e.clientX; I.py = e.clientY;
      I.hasPointer = true; I.pointerT = 0;
    });

    cv.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'touch') {
        I.usingTouch = true;
        I.touch.on = true; I.touch.id = e.pointerId;
        I.touch.sx = I.touch.x = e.clientX;
        I.touch.sy = I.touch.y = e.clientY;
        I.mDown = true;
        I.clicks.push({ x: e.clientX, y: e.clientY, type: 'touch' });
      } else {
        if (!I.locked) {
          I.px = e.clientX; I.py = e.clientY;
          I.hasPointer = true; I.pointerT = 0;
        }
        I.mDown = true;
        I.clicks.push({ x: e.clientX, y: e.clientY, type: 'mouse' });
      }
      if (cv.setPointerCapture) { try { cv.setPointerCapture(e.pointerId); } catch (err) { } }
      FS.gesture();
      if (G.screen === 'play') FS.lock();
      DL.audio && DL.audio.unlock && DL.audio.unlock();
      e.preventDefault();
    }, { passive: false });

    var up = function (e) {
      if (e.pointerType === 'touch') {
        if (I.touch.id === e.pointerId) { I.touch.on = false; I.touch.id = -1; I.mDown = false; }
      } else {
        I.mDown = false;
      }
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  };

  I.take = function () { var q = I.queue; I.queue = []; return q; };
  I.takeClicks = function () { var q = I.clicks; I.clicks = []; return q; };
  I.peekClicks = function () { return I.clicks; };
  I.down = function (c) { return !!I.keys[c]; };
  I.anyDown = function (arr) { for (var i = 0; i < arr.length; i++) if (I.keys[arr[i]]) return true; return false; };

  /* 移动向量（键盘或触屏摇杆） */
  I.moveVec = function () {
    var x = 0, y = 0;
    if (DL.console && DL.console.open) return { x: 0, y: 0, mag: 0 };
    if (KB.down('left')) x -= 1;
    if (KB.down('right')) x += 1;
    if (KB.down('up')) y -= 1;
    if (KB.down('down')) y += 1;
    if (x || y) { var m = Math.sqrt(x * x + y * y); return { x: x / m, y: y / m, mag: 1 }; }

    if (I.touch.on) {
      var dx = I.touch.x - I.touch.sx;
      var dy = I.touch.y - I.touch.sy;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d > 8) {
        var mag = Math.min((d - 8) / 70, 1);
        return { x: dx / d, y: dy / d, mag: mag };
      }
    }
    return { x: 0, y: 0, mag: 0 };
  };

  DL.input = I;

  /* ---------------- 存档 ---------------- */
  var KEY = 'drownlight.save.v1';

  function defSave() {
    return {
      v: 1,
      bestDepth: 0,
      bestScore: 0,
      clears: 0,
      totalKills: 0,
      totalDives: 0,
      salvage: 0,
      tree: {},
      endless: false,
      codex: {},
      codexE: {},
      cardsSeen: {},
      keys: {},
      cardsUsed: {},
      settings: {
        flash: 70, shake: 100, coneLight: 100,
        music: 60, sfx: 80, musicOn: true, autoAim: true, colorblind: false,
        sens: 100, muted: false, fpsTarget: 120
      }
    };
  }

  var save = null;

  function load() {
    var d = defSave();
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var o = JSON.parse(raw);
        if (o && o.v === 1) {
          for (var k in d) if (o[k] !== undefined) d[k] = o[k];
          for (var s in defSave().settings) if (!o.settings || o.settings[s] === undefined) d.settings[s] = defSave().settings[s];
        } else if (o) {
          d.bestDepth = o.bestDepth || 0;
          d.bestScore = o.bestScore || 0;
          d.clears = o.clears || 0;
        }
      }
    } catch (e) { }
    save = d;
    return d;
  }

  function flush() {
    try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { }
  }

  var Save = {
    get: function () { return save || load(); },
    load: load,
    flush: flush,
    resetTree: function () {
      var s = Save.get(), total = 0;
      for (var arm in s.tree) total += s.tree[arm];
      var refund = 0;
      for (var i = 0; i < DL.TREE_NODES.length; i++) {
        var n = DL.TREE_NODES[i];
        if (Save.hasNode(n)) refund += n.cost;
      }
      s.tree = {};
      s.salvage += refund;
      flush();
      return refund;
    },
    hasNode: function (n) {
      var s = Save.get();
      var lvl = s.tree[n.arm] || 0;
      return lvl > n.i;
    },
    buyNode: function (n) {
      var s = Save.get();
      var lvl = s.tree[n.arm] || 0;
      var ok = n.i < 8;
      if (!ok) return false;
      if (lvl > 0 && n.i >= lvl + 1) return false;      // 必须按顺序解锁
      if (lvl !== n.i) return false;
      if (s.salvage < n.cost) return false;
      s.salvage -= n.cost;
      s.tree[n.arm] = lvl + 1;
      flush();
      return true;
    }
  };
  DL.save = Save;

  /* ---------------- 全局运行状态 ---------------- */
  var G = {
    screen: 'title',        // title | intro | play | paused | cards | summary | tree | settings | codex | ending
    t: 0,
    runT: 0,
    layer: 1,
    surge: 0,
    depth: 0,
    score: 0,
    kills: 0,
    combo: 0,
    comboT: 0,
    maxCombo: 0,
    cysts: 0,
    enemies: [], bullets: [], ebullets: [], parts: [], drops: [], floats: [],
    rings: [], lights: [], fogs: [], vents: [], current: null,
    slashes: [], mines: [],
    quota: 0, spawned: 0, spawnT: 0,
    surgeState: 'idle',
    surgeDur: 60, surgeT: 0,
    boss: null,
    shake: 0, shakeX: 0, shakeY: 0,
    flash: 0, flashCol: '#eafcff',
    freeze: 0,
    slow: 1,
    slowA: 0,
    endlessRun: false,
    runBosses: null,
    pingCd: 0, pingDark: 0,
    sonarT: 0, ringT: 0,
    intensity: 0,
    lightR: 0,
    ended: false,
    deathT: -1,
    layerShiftT: 0,
    hintT: 0, hintIdx: 0,
    bannerT: 0, bannerText: '',
    debug: false,
    perf: { fps: 60, worst: 0, worstMs: 0, acc: 0, frames: 0, lowT: 0, grade: 0, slowT: 0, cool: 0, lod: 0 }
  };
  DL.G = G;

  /* ---------------- 主循环 ---------------- */
  var last = 0, acc = 0, rafId = 0, updater = null, renderer = null;
  var STEP = T.step || 1 / 120;

  function frame(now) {
    rafId = requestAnimationFrame(frame);
    if (!last) last = now;
    var raw = (now - last) / 1000;
    last = now;
    if (raw > 0.25) raw = 0.25;

    // 性能统计
    G.perf.acc += raw; G.perf.frames++;
    if (raw > G.perf.worst) G.perf.worst = raw;
    if (G.perf.acc >= 0.5) {
      var fpsAvg = G.perf.frames / G.perf.acc;
      G.perf.fps = fpsAvg;
      G.perf.worstMs = G.perf.worst * 1000;
      G.perf.worst = 0;
      G.perf.acc = 0; G.perf.frames = 0;
      if (fpsAvg < 45) G.perf.lowT += 0.5; else G.perf.lowT = Math.max(0, G.perf.lowT - 0.5);
      if (G.perf.lowT >= 2 && G.perf.grade < 3) { G.perf.grade++; G.perf.lowT = 0; }

      /* 自适应分辨率：以「帧率目标」为准，掉帧就降像素密度，稳定后再升回去 */
      var target = DL.save.get().settings.fpsTarget || 120;
      var floor = target >= 240 ? 0.5 : 0.62;
      /* 低于目标 5% 就进入低画质：省掉小光晕等零碎绘制 */
      G.perf.lod = fpsAvg < target * 0.95 ? 1 : 0;
      if (G.perf.cool > 0) G.perf.cool -= 0.5;
      if (fpsAvg < target * 0.92) G.perf.slowT = (G.perf.slowT || 0) + 0.5; else G.perf.slowT = 0;
      if (G.perf.cool <= 0) {
        if (G.perf.slowT >= 1.0 && S.scale > floor) {
          S.setScale(Math.max(floor, S.scale - 0.1));
          G.perf.cool = 1.5; G.perf.slowT = 0;
        } else if (fpsAvg > target * 0.99 && S.scale < 1 && raw < 0.02) {
          S.setScale(Math.min(1, S.scale + 0.05));
          G.perf.cool = 3;
        }
      }
    }

    acc += raw;
    var guard = 0;
    while (acc >= STEP && guard < 8) {
      if (updater) updater(STEP);
      acc -= STEP;
      guard++;
    }
    if (guard >= 8) acc = 0;

    if (renderer) renderer(raw);
  }

  DL.loop = {
    start: function (u, r) { updater = u; renderer = r; last = 0; acc = 0; rafId = requestAnimationFrame(frame); },
    stop: function () { if (rafId) cancelAnimationFrame(rafId); rafId = 0; }
  };

})();
