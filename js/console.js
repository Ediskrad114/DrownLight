/* ==========================================================================
   光溺 DROWNLIGHT · console.js
   内置控制台：`~` 开关，记录运行状态、执行调试命令
   ========================================================================== */
window.DL = window.DL || {};
(function () {
  'use strict';

  var U = DL.U, G = DL.G;
  var MAX_LINES = 80;

  var C = {
    open: false,
    lines: [],
    input: '',
    hist: [],
    hi: -1,
    caret: 0,
    stats: true
  };
  DL.console = C;

  /* ---------------- 输出 ---------------- */
  C.log = function (text, kind) {
    C.lines.push({ t: String(text), k: kind || 'out' });
    while (C.lines.length > MAX_LINES) C.lines.shift();
  };

  C.toggle = function (on) {
    var want = (on === undefined) ? !C.open : !!on;
    if (want === C.open) return;
    C.open = want;
    C.input = '';
    C.hi = -1;
    if (want && C.lines.length === 0) C.banner();
    if (DL.audio && DL.audio.sfx) DL.audio.sfx.hover();
  };

  C.banner = function () {
    C.log('光溺 控制台 · 输入 help 查看命令', 'sys');
  };

  /* ---------------- 命令 ---------------- */
  var HELP = [
    'help              这条帮助',
    'stats             开关左上角状态栏',
    'god [0|1]         无敌',
    'layer <n>         跳到指定层（1-99）',
    'boss <1-6|id>     打本局名单里的第 n 个，或按 id 点将',
    'bosses            列出 12 个 Boss 与本局名单',
    'endless [0|1]     切换无尽模式',
    'card <id> [lv]    给一张卡（如 card blade 3）',
    'cards             列出本局已有卡',
    'spawn <type> [n]  生成敌人（lantern/jelly/squid/worm/hatchet/angler/swarm/veil）',
    'kill              清空场上敌人',
    'give <n>          残骸数据 +n',
    'fps <60|120|144|240>  设帧率目标',
    'scale <0.5-1>     手动缩放内部分辨率',
    'clear             清屏',
    'quit              退出游戏'
  ];

  function toast(t) { C.log(t, 'ok'); }

  var CMDS = {
    help: function () { for (var i = 0; i < HELP.length; i++) C.log('  ' + HELP[i]); },
    stats: function () { C.stats = !C.stats; toast('状态栏 ' + (C.stats ? '开' : '关')); },
    god: function (a) {
      G.god = a === undefined ? !G.god : (a !== '0');
      toast('无敌 ' + (G.god ? '开' : '关'));
    },
    layer: function (a) {
      var n = parseInt(a, 10);
      if (!(n >= 1 && n <= 99)) return C.log('用法: layer <1-99>', 'err');
      DL.systemsJumpLayer(n);
      toast('跳到第 ' + n + ' 层');
    },
    boss: function (a) {
      var n = parseInt(a, 10);
      if (n >= 1) { DL.debugBoss(n); return toast('本局第 ' + n + ' 个 Boss'); }
      var d = DL.debugBossId(a);
      if (!d) return C.log('没有这个 Boss: ' + a + '（输入 bosses 查看）', 'err');
      toast(d.name + ' · ' + d.sub);
    },
    bosses: function () {
      var list = DL.G.runBosses || [];
      C.log('Boss 池（本局名单用 * 标出）:');
      for (var i = 0; i < DL.BOSSES.length; i++) {
        var d = DL.BOSSES[i];
        var mine = list.indexOf(d) >= 0;
        C.log('  ' + (mine ? '*' : ' ') + d.id + '  ' + d.name + ' · ' + d.sub +
          '  威胁' + d.rank + '  ' + d.hp);
      }
    },
    endless: function (a) {
      G.endlessRun = a === undefined ? !G.endlessRun : (a !== '0');
      toast('无尽模式 ' + (G.endlessRun ? '开' : '关'));
    },
    card: function (a, b) {
      var c = DL.cardById(a);
      if (!c) return C.log('没有这张卡: ' + a, 'err');
      var lv = parseInt(b, 10);
      if (!(lv > 0)) lv = 1;
      lv = Math.min(lv, c.max || 3);
      G.runCards[c.id] = lv;
      DL.PL.stats = DL.recomputeStats();
      DL.PL.maxHp = DL.PL.stats.maxHp;
      DL.PL.hp = Math.min(DL.PL.hp, DL.PL.maxHp);
      toast(c.name + ' → Lv' + lv);
    },
    cards: function () {
      var n = 0;
      for (var id in G.runCards) { C.log('  ' + id + ' Lv' + G.runCards[id]); n++; }
      if (!n) C.log('  (空)');
    },
    spawn: function (a, b) {
      var t = a || 'lantern';
      if (!DL.ETYPE[t]) return C.log('未知敌型: ' + t, 'err');
      var n = Math.max(1, Math.min(40, parseInt(b, 10) || 1));
      var S = DL.S;
      for (var i = 0; i < n; i++) {
        DL.spawnEnemy(t, U.rnd(80, S.W - 80), U.rnd(80, S.H - 80));
      }
      toast('生成 ' + t + ' ×' + n);
    },
    kill: function () {
      for (var i = G.enemies.length - 1; i >= 0; i--) DL.killEnemy(G.enemies[i]);
      toast('清场');
    },
    give: function (a) {
      var n = parseInt(a, 10);
      if (!(n > 0)) return C.log('用法: give <数量>', 'err');
      var sv = DL.save.get();
      sv.salvage += n;
      DL.save.flush();
      toast('残骸 +' + n + '（当前 ' + sv.salvage + '）');
    },
    fps: function (a) {
      var n = parseInt(a, 10);
      if ([60, 120, 144, 240].indexOf(n) < 0) return C.log('用法: fps <60|120|144|240>', 'err');
      var sv = DL.save.get();
      sv.settings.fpsTarget = n;
      DL.save.flush();
      DL.S.applyScale();
      toast('帧率目标 ' + n);
    },
    scale: function (a) {
      var k = parseFloat(a);
      if (!(k >= 0.5 && k <= 1)) return C.log('用法: scale <0.5-1>', 'err');
      DL.S.setScale(k);
      toast('分辨率 ' + Math.round(k * 100) + '%');
    },
    clear: function () { C.lines.length = 0; },
    quit: function () { DL.quitGame(); }
  };

  C.exec = function (raw) {
    var line = String(raw || '').trim();
    if (!line) return;
    C.log('> ' + line, 'in');
    C.hist.push(line);
    if (C.hist.length > 40) C.hist.shift();
    C.hi = -1;

    var parts = line.split(/\s+/);
    var name = parts[0].toLowerCase();
    var fn = CMDS[name];
    if (!fn) { C.log('未知命令: ' + name + '（输入 help）', 'err'); return; }
    try { fn(parts[1], parts[2]); }
    catch (e) { C.log('执行出错: ' + (e && e.message), 'err'); }
  };

  /* ---------------- 按键 ---------------- */
  C.onKey = function (e) {
    if (e.code === 'Backquote') {
      C.toggle();
      e.preventDefault();
      return true;
    }
    if (!C.open) return false;

    if (e.key === 'Enter') {
      C.exec(C.input);
      C.input = '';
      e.preventDefault();
      return true;
    }
    if (e.key === 'Escape') {
      C.toggle(false);
      e.preventDefault();
      return true;
    }
    if (e.key === 'Backspace') {
      C.input = C.input.slice(0, -1);
      e.preventDefault();
      return true;
    }
    if (e.key === 'ArrowUp') {
      if (C.hist.length) {
        if (C.hi < 0) C.hi = C.hist.length - 1;
        else if (C.hi > 0) C.hi--;
        C.input = C.hist[C.hi];
      }
      e.preventDefault();
      return true;
    }
    if (e.key === 'ArrowDown') {
      if (C.hi >= 0) {
        C.hi++;
        if (C.hi >= C.hist.length) { C.hi = -1; C.input = ''; }
        else C.input = C.hist[C.hi];
      }
      e.preventDefault();
      return true;
    }
    if (e.key && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (C.input.length < 90) C.input += e.key;
      e.preventDefault();
      return true;
    }
    /* 挡住了其它按键，避免在控制台里误触发游戏操作 */
    e.preventDefault();
    return true;
  };

  /* ---------------- 绘制 ---------------- */
  C.draw = function (ctx) {
    var S = DL.S, s = S.ui;
    if (!C.open) return;

    var pad = 12 * s;
    var w = Math.min(S.W - pad * 2, 760 * s);
    var h = Math.min(S.H - pad * 2, 330 * s);
    var x = pad, y = S.H - h - pad;

    ctx.save();
    ctx.globalAlpha = 0.97;

    /* 背板 */
    var g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, 'rgba(4,16,22,0.94)');
    g.addColorStop(1, 'rgba(2,8,12,0.96)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(62,240,200,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w, h);

    /* 角标 */
    var cs = 10 * s;
    ctx.strokeStyle = 'rgba(62,240,200,0.8)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x, y + cs); ctx.lineTo(x, y); ctx.lineTo(x + cs, y);
    ctx.moveTo(x + w - cs, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + cs);
    ctx.moveTo(x, y + h - cs); ctx.lineTo(x, y + h); ctx.lineTo(x + cs, y + h);
    ctx.moveTo(x + w - cs, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - cs);
    ctx.stroke();

    /* 标题行 */
    DL.draw.text(ctx, 'CONSOLE', x + 12 * s, y + 17 * s, 10 * s, DL.T.colors.self, 'left', 700);
    DL.draw.text(ctx, '~ 关闭 · Enter 执行 · ↑↓ 历史', x + w - 12 * s, y + 17 * s, 9 * s, 'rgba(150,190,205,0.45)', 'right', 500);
    ctx.strokeStyle = 'rgba(62,240,200,0.18)';
    ctx.beginPath(); ctx.moveTo(x + 8 * s, y + 24 * s); ctx.lineTo(x + w - 8 * s, y + 24 * s); ctx.stroke();

    /* 日志 */
    var lh = 13 * s;
    var top = y + 36 * s;
    var maxLines = Math.floor((h - 62 * s) / lh);
    var start = Math.max(0, C.lines.length - maxLines);
    for (var i = start; i < C.lines.length; i++) {
      var ln = C.lines[i];
      var col = ln.k === 'err' ? '#ff6b8a' : (ln.k === 'in' ? DL.T.colors.self : (ln.k === 'ok' ? '#8fffc8' : 'rgba(200,232,242,0.82)'));
      DL.draw.text(ctx, ln.t, x + 12 * s, top + (i - start) * lh, 9.5 * s, col, 'left', 500);
    }

    /* 输入行 */
    var iy = y + h - 16 * s;
    ctx.strokeStyle = 'rgba(62,240,200,0.18)';
    ctx.beginPath(); ctx.moveTo(x + 8 * s, iy - 14 * s); ctx.lineTo(x + w - 8 * s, iy - 14 * s); ctx.stroke();
    DL.draw.text(ctx, '›', x + 12 * s, iy, 11 * s, DL.T.colors.self, 'left', 700);
    DL.draw.text(ctx, C.input, x + 26 * s, iy, 10 * s, '#eafcff', 'left', 500);
    var tw = ctx.measureText ? 0 : 0;
    if (Math.floor(DL.G.t * 2) % 2 === 0) {
      var cw = C.input.length * 6.2 * s;
      ctx.fillStyle = DL.T.colors.self;
      ctx.fillRect(x + 26 * s + cw, iy - 9 * s, 5 * s, 11 * s);
    }
    ctx.restore();

    /* 状态栏 */
    if (C.stats) C.drawStats(ctx);
  };

  C.drawStats = function (ctx) {
    var S = DL.S, s = S.ui;
    var p = DL.PL;
    var lines = [
      'FPS ' + G.perf.fps.toFixed(0) + ' / ' + (DL.save.get().settings.fpsTarget || 120) +
      '   峰值 ' + (G.perf.worstMs || 0).toFixed(1) + 'ms   画质 ' + Math.round(DL.S.scale * 100) + '%',
      '坐标 ' + p.x.toFixed(0) + ',' + p.y.toFixed(0) + '   船体 ' + p.hp + '/' + p.maxHp +
      '   层 ' + G.layer + '   涌 ' + G.surge + '   ' + G.surgeState,
      '敌 ' + G.enemies.length + '   弹 ' + G.bullets.length + '   敌弹 ' + G.ebullets.length +
      '   粒子 ' + G.parts.length + '   分数 ' + G.score
    ];
    var w = 470 * s, h = 16 * s * lines.length + 12 * s;
    ctx.save();
    ctx.fillStyle = 'rgba(2,8,12,0.72)';
    ctx.fillRect(10 * s, 10 * s, w, h);
    ctx.strokeStyle = 'rgba(62,240,200,0.22)';
    ctx.strokeRect(10.5 * s, 10.5 * s, w, h);
    for (var i = 0; i < lines.length; i++) {
      DL.draw.text(ctx, lines[i], 18 * s, 26 * s + i * 16 * s, 9.5 * s, '#8fffe0', 'left', 500);
    }
    ctx.restore();
  };

  C.banner();
})();
