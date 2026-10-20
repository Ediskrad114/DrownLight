/* ==========================================================================
   光溺 DROWNLIGHT · main.js
   启动 / 更新调度 / 渲染 / 调试快捷键
   ========================================================================== */
window.DL = window.DL || {};
(function () {
  'use strict';

  var U = DL.U, T = DL.T, G = DL.G, I = DL.input;
  var portrait = false;
  var rotateEl = null;

  function checkOrientation() {
    var p = window.innerHeight > window.innerWidth * 1.02;
    portrait = p;
    if (rotateEl) rotateEl.classList.toggle('on', p);
    if (p && G.screen === 'play') DL.ui.goto('paused');
  }

  /* 抓一下实际参与渲染的 GPU，方便确认有没有切到独显 */
  function detectGPU() {
    try {
      var c = document.createElement('canvas');
      var gl = c.getContext('webgl') || c.getContext('experimental-webgl');
      if (!gl) return 'no-webgl';
      var ext = gl.getExtension('WEBGL_debug_renderer_info');
      var r = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      return String(r || 'unknown');
    } catch (e) { return 'error'; }
  }

  function boot() {
    rotateEl = document.getElementById('rotate');    DL.S.init();
    DL.gpu = detectGPU();
    DL.input.init();
    DL.save.load();
    DL.KB.reset();
    DL.rebuildMeta();
    DL.audio.setVolumes();

    /* 老存档迁移：以前选过的卡，视为在图鉴里见过 */
    (function migrate() {
      var sv = DL.save.get(), dirty = false;
      for (var id in sv.cardsUsed) {
        if (!sv.cardsSeen[id]) { sv.cardsSeen[id] = 1; dirty = true; }
      }
      if (dirty) DL.save.flush();
    })();

    DL.S.onResize(checkOrientation);
    checkOrientation();

    document.addEventListener('visibilitychange', function () {
      if (document.hidden && G.screen === 'play') DL.ui.goto('paused');
    });

    // URL 调试参数
    var q = location.search;
    G.debug = /[?&]debug=1/.test(q);
    var auto = /[?&]auto=(\d)/.exec(q);
    var layerQ = /[?&]layer=(\d+)/.exec(q);

    DL.ui.goto('title');

    if (/[?&]diag=1/.test(q)) {
      setInterval(function () {
        var d = {
          s: G.screen, t: +G.t.toFixed(1), rt: +G.runT.toFixed(1),
          L: G.layer, sg: G.surge,
          hp: DL.PL.hp, mhp: DL.PL.maxHp,
          en: G.enemies.length, bul: G.bullets.length,
          st: G.surgeState, sp: G.spawned, q: G.quota,
          sT: +(G.surgeT || 0).toFixed(1), sD: G.surgeDur,
          sh: +(G.layerShiftT || 0).toFixed(1),
          boss: G.boss ? Math.round(G.boss.hp) + '/' + Math.round(G.boss.maxHp) + (G.boss.parts&&G.boss.parts.length?' pods:'+G.boss.parts.map(function(p){return Math.round(p.hp);}).join(',')+' vul:'+G.boss.vulnerable:'') : '-',
          sc: G.score, tr: (G.trace||[]).join(' '),
          qs: +(DL.S.scale||1).toFixed(2), salvageLeft: DL.save.get().salvage,
          gpu: (DL.gpu || '').slice(0, 80),
          errs: (window.__ERRS || []).slice(0, 2)
        };
        document.body.setAttribute('data-diag', JSON.stringify(d));
      }, 250);
    }

    if (auto) {
      DL.audio.unlock();
      DL.ui.beginPlay();
      if (layerQ) {
        var n = parseInt(layerQ[1], 10);
        if (n > 1) DL.systemsJumpLayer(n);
      }
    } else if (layerQ) {
      DL.audio.unlock();
      DL.ui.beginPlay();
      DL.systemsJumpLayer(parseInt(layerQ[1], 10));
    }

    G.autopick = /[?&]autopick=1/.test(q);
    if (/[?&]god=1/.test(q)) { G.god = true; }

    var bossQ = /[?&]boss=([a-zA-Z0-9]+)/.exec(q);
    if (bossQ) {
      DL.audio.unlock();
      if (G.screen !== 'play') DL.ui.beginPlay();
      var bq = bossQ[1];
      if (/^\d+$/.test(bq)) DL.debugBoss(parseInt(bq, 10));
      else DL.debugBossId(bq);
    }

    /* ?layerboss=N：直接开第 N 层的 Boss（触发换批、无尽缩放与名单逻辑） */
    var lbQ = /[?&]layerboss=(\d+)/.exec(q);
    if (lbQ) {
      DL.audio.unlock();
      if (G.screen !== 'play') DL.ui.beginPlay();
      G.endlessRun = G.endlessRun || parseInt(lbQ[1], 10) > 6;
      DL.debugLayerBoss(parseInt(lbQ[1], 10));
    }

    var scrQ = /[?&]screen=([a-z]+)/.exec(q);
    if (scrQ) {
      if (G.screen !== 'play' && scrQ[1] !== 'title' && scrQ[1] !== 'intro') DL.ui.beginPlay();
      if (scrQ[1] === 'summary') {
        G.depth = 3120; G.score = 128400; G.kills = 342; G.maxCombo = 28;
        G.runT = 702; G.layer = 4; G.salvageGain = 412;
        G.bossLog = ['荧', '锈', '墨', '潮', '灯', '眠'];
        G.runCards = { fan: 3, longCone: 2, dmg: 3, twin: 2, sonarArr: 1, crit: 1 };
        DL.ui.goto('summary');
      } else if (scrQ[1] === 'cards') {
        DL.openCards('surge');
      } else {
        DL.ui.goto(scrQ[1]);
      }
    }

    if (/[?&]intro=1/.test(q)) { DL.audio.unlock(); DL.ui.goto('intro'); }

    if (G.debug && DL.console) DL.console.toggle(true);

    /* 调试：?cards=blade,orbit,aura 直接塞满对应卡（做特效验收） */
    var cardQ = /[?&]cards=([a-zA-Z,]+)/.exec(q);
    if (cardQ) {
      if (G.screen !== 'play') DL.ui.beginPlay();
      var ids = cardQ[1].split(',');
      for (var ci = 0; ci < ids.length; ci++) {
        var cc = DL.cardById(ids[ci]);
        if (cc) G.runCards[cc.id] = cc.max || 3;
      }
      DL.PL.stats = DL.recomputeStats();
      DL.PL.maxHp = DL.PL.stats.maxHp;
      DL.PL.hp = DL.PL.maxHp;
      DL.PL.dashCh = DL.PL.stats.dashCharges;
    }

    DL.loop.start(update, render);

    /* 无头回归自检：?selftest=1 只写 DOM，不依赖人工观察 */
    if (/[?&]selftest=1/.test(q)) runSelftest();

    /* Boss 扫测：?bosstest=1&frames=N */
    if (/[?&]bosstest=1/.test(q)) {
      var bfr = /[?&]frames=(\d+)/.exec(q);
      DL.audio.unlock();
      DL.runBossTest(bfr ? parseInt(bfr[1], 10) : 900);
    }

    var benchQ = /[?&]bench(?:=(\d+))?/.exec(q);
    if (benchQ) {
      var bn = benchQ[1] ? parseInt(benchQ[1], 10) : 120;
      DL.runBench(bn);
      requestAnimationFrame(function () { DL.runBench(bn); });
    }

    /* 离线自检：?sim=N 直接同步推进 N 个逻辑帧（用于无头验证） */
    var sim = /[?&]sim=(\d+)/.exec(q);
    if (sim) {
      var n = Math.min(200000, parseInt(sim[1], 10));
      var stp = T.step || 1 / 120;
      for (var i = 0; i < n; i++) {
        try { update(stp); } catch (e) { if (window.__showErr) window.__showErr('sim ' + e.message); break; }
      }
      try { render(1 / 60); } catch (e2) { if (window.__showErr) window.__showErr('render ' + e2.message); }
    }
  }

  /* Boss 扫测：?bosstest=1&frames=N —— 12 个 Boss 各跑一段，查崩溃与弹幕失控 */
  DL.runBossTest = function (frames) {
    var out = { ok: true, list: [], pool: DL.BOSSES.length, perRun: T.boss.perRun };
    frames = frames || 900;
    try {
      DL.ui.beginPlay();
      G.god = true;
      var stp = T.step || 1 / 120;
      for (var i = 0; i < DL.BOSSES.length; i++) {
        var def = DL.BOSSES[i];
        var rec = { id: def.id, rank: def.rank };
        var d0 = DL.debugBossId(def.id);
        if (!d0) { rec.err = 'not found'; out.ok = false; out.list.push(rec); continue; }
        rec.hp = G.boss.maxHp;
        rec.y = Math.round(G.boss.y);
        var maxEB = 0, maxParts = 0, err = null, f = 0;
        for (; f < frames; f++) {
          try { update(stp); } catch (e) { err = String(e && e.message); break; }
          if (G.ebullets.length > maxEB) maxEB = G.ebullets.length;
          if (!G.boss) break;
          var pn = G.boss.parts.length;
          if (pn > maxParts) maxParts = pn;
          if (!isFinite(G.boss.x) || !isFinite(G.boss.y)) { err = 'boss NaN'; break; }
        }
        rec.frames = f;
        rec.eb = maxEB;
        rec.parts = maxParts;
        rec.alive = !!G.boss;
        rec.hpLeft = G.boss ? Math.round(G.boss.hp) : 0;
        rec.slowA = +(G.slowA || 0).toFixed(2);
        rec.err = err;
        if (err) out.ok = false;
        out.list.push(rec);
      }
      /* 无尽层：第 7 层是否真的换了名单 */
      DL.ui.beginPlay();
      G.endlessRun = true;
      G.runBosses = DL.rollBosses();
      var first = G.runBosses.map(function (d) { return d.id; }).join(',');
      DL.debugLayerBoss(7);
      var second = G.runBosses.map(function (d) { return d.id; }).join(',');
      out.endless = {
        first: first, afterLayer7: second, hp: G.boss.maxHp, layer: G.layer,
        rerolled: first !== second
      };
      /* 名单排序检查 */
      out.sorted = G.runBosses.every(function (d, k, a) { return k === 0 || a[k - 1].rank <= d.rank; });

      /* 流程：普通模式打完第 6 层 → 结算；无尽模式 → 继续下潜 */
      DL.ui.beginPlay();
      G.god = true;
      G.endlessRun = false;
      G.autopick = true;
      var rosterN = G.runBosses.map(function (d) { return d.id; }).join(',');
      DL.debugLayerBoss(6);
      DL.killBoss();
      for (var fn = 0; fn < 700 && G.screen === 'play'; fn++) update(stp);
      out.flowNormal = { screen: G.screen, cleared: !!G.cleared, layer: G.layer };

      DL.ui.beginPlay();
      G.god = true;
      G.endlessRun = true;
      G.autopick = true;
      var rosterE = G.runBosses.map(function (d) { return d.id; }).join(',');
      DL.debugLayerBoss(6);
      DL.killBoss();
      for (var fe = 0; fe < 900 && G.layer < 7; fe++) update(stp);
      out.flowEndless = {
        screen: G.screen, layer: G.layer,
        rosterBefore: rosterE,
        rosterAfter: G.runBosses.map(function (d) { return d.id; }).join(',')
      };
      out.flowNormal.roster = rosterN;
    } catch (e) {
      out.ok = false; out.err = String(e && e.message); out.stack = String(e && e.stack || '').slice(0, 400);
    }
    document.body.setAttribute('data-test', JSON.stringify(out));
    return out;
  };

  /* 回归自检：通关入账 / 幂等 / 音频场景 / 画质缩放 */
  function runSelftest() {
    var out = {};
    try {
      DL.ui.beginPlay();
      DL.systemsJumpLayer(6);
      G.layer = 6; G.kills = 300; G.depth = 3410; G.score = 200000;
      var before = DL.save.get().salvage;
      G.awarded = false;
      DL.awardRun(true);
      var sv = DL.save.get();
      out.clear = { before: before, after: sv.salvage, gain: G.salvageGain, bonus: G.clearBonus, endless: sv.endless, clears: sv.clears };
      var after1 = sv.salvage;
      DL.awardRun(true);
      out.idempotent = (DL.save.get().salvage === after1);
      out.scene = DL.audio.mix.scene;
      DL.ui.goto('paused');
      out.scenePaused = DL.audio.mix.scene;
      DL.ui.goto('play');
      out.scenePlay = DL.audio.mix.scene;
      DL.S.setScale(0.8);
      out.scale = DL.S.scale;
      out.ok = true;
    } catch (e) {
      out.ok = false; out.err = String(e && e.message); out.stack = String(e && e.stack || '').slice(0, 300);
    }
    document.body.setAttribute('data-test', JSON.stringify(out));
  }

  /* 性能基准：?bench=1&frames=N 造一个最坏情况场景，测 renderPlay 的单帧耗时 */
  DL.runBench = function (frames) {
    var S = DL.S, ctx = S.ctx;
    DL.ui.beginPlay();
    DL.systemsJumpLayer(6);
    DL.debugBoss(6);
    var types = ['lantern', 'jelly', 'squid', 'hatchet', 'angler'];
    for (var i = 0; i < 26; i++) {
      DL.spawnEnemy(types[i % types.length], U.rnd(60, S.W - 60), U.rnd(60, S.H - 60));
    }
    for (var j = 0; j < 200; j++) {
      DL.spawnEBullet(U.rnd(0, S.W), U.rnd(0, S.H), U.rnd(0, 6.28), 80, 6);
    }
    for (var k = 0; k < 12; k++) DL.burst(U.rnd(0, S.W), U.rnd(0, S.H), 40, '#ff4fa3', 200, 3, 1.2);
    G.lights.push({ x: S.W * 0.4, y: S.H * 0.5, r: 300, life: 3, max: 3 });
    G.rings.push({ x: S.W * 0.5, y: S.H * 0.5, r: 10, to: 600, life: 2, max: 2, color: '#3ef0c8', width: 4 });
    G.fogs.push({ x: S.W * 0.6, y: S.H * 0.4, r: 260, life: 3 });
    for (var f2 = 0; f2 < 24; f2++) render(0.016);
    var t0 = performance.now();
    for (var f = 0; f < frames; f++) {
      G.t += 0.016;
      render(0.016);
    }
    var ms = (performance.now() - t0) / frames;
    var out = {
      ms: +ms.toFixed(2), frames: frames,
      en: G.enemies.length, bul: G.bullets.length, eb: G.ebullets.length, pt: G.parts.length,
      w: S.W, h: S.H, dpr: S.DPR, scale: S.scale
    };
    document.body.setAttribute('data-bench', JSON.stringify(out));
    return out;
  };

  /* 静音开关（音乐 + 音效一起） */
  DL.toggleMute = function () {
    var sv = DL.save.get();
    sv.settings.muted = !sv.settings.muted;
    DL.save.flush();
    DL.audio.setVolumes();
    DL.addFloat(DL.PL.x, DL.PL.y - 30, sv.settings.muted ? '静音' : '取消静音', '#ffce5c', 12);
  };

  /* 调试用：直接跳到某一层（无尽层数也支持） */
  DL.systemsJumpLayer = function (n) {
    n = Math.max(1, Math.min(99, n | 0));
    G.enemies.length = 0;
    G.ebullets.length = 0;
    G.boss = null;
    G.layer = n - 1;
    G.surge = 0;
    G.surgeState = 'idle';
    G.surgeT = 0;
    G.layerShiftT = 0;
    G.pendingLayer = n;
    G.pendingLayer = n;
    DL.nextLayer();
  };

  function update(dt) {
    if (portrait) return;

    var keys = I.take();
    var clicks = I.takeClicks();

    if (G.screen !== 'play') G.t += dt;

    /* 全局快捷键 */
    var KB = DL.KB;
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (k === 'F1') { if (DL.console) DL.console.toggle(); }
      if (G.screen === 'play') {
        if (KB.hit([k], 'fullscreen')) { DL.fs.toggle(); return; }
        if (KB.hit([k], 'pause')) { DL.ui.goto('paused'); return; }
        if (KB.hit([k], 'bag')) { DL.ui.goto('bag'); return; }
        if (KB.hit([k], 'mute')) { DL.toggleMute(); return; }
        if (k === 'F2') { DL.systemsJumpLayer(Math.min(99, G.layer + 1)); return; }
        if (k === 'F3') { G.cysts = 0; DL.openCards('surge'); return; }
        if (k === 'F4') { G.god = !G.god; DL.addFloat(DL.PL.x, DL.PL.y - 30, G.god ? 'GOD ON' : 'GOD OFF', '#ffce5c', 12); }
        if (k === 'F6') {
          for (var j = G.enemies.length - 1; j >= 0; j--) DL.killEnemy(G.enemies[j]);
        }
      } else if (G.screen === 'bag') {
        if (KB.hit([k], 'bag') || k === 'Escape') { DL.ui.goto('play'); return; }
      } else if (G.screen === 'title') {
        if (KB.hit([k], 'fullscreen')) { DL.fs.toggle(); return; }
      }
    }

    if (G.screen === 'play') {
      if (DL.ui.abandon) {
        DL.ui.abandon = false;
        if (DL.PL.alive) DL.playerDie();
        else DL.ui.goto('summary');
        return;
      }
      DL.consumePlayClicks();
      if (G.screen === 'play') DL.updatePlay(dt);
      return;
    }

    if (G.autopick && G.screen === 'cards' && G.cards && G.cards.length) {
      DL.takeCard(0);
      return;
    }

    DL.ui.onInput(keys, clicks);

    /* 结算页不需要世界更新，但保留粒子 */
    if (G.screen === 'summary' || G.screen === 'cards') {
      DL.updateParticles(dt * 0.4);
    }
  }

  function render(dt) {
    var ctx = DL.S.ctx;
    ctx.setTransform(DL.S.tx, 0, 0, DL.S.tx, 0, 0);
    if (portrait) {
      ctx.fillStyle = '#02060c';
      ctx.fillRect(0, 0, DL.S.W, DL.S.H);
      return;
    }
    DL.ui.render(ctx, dt || 0.016);
    if (DL.console) DL.console.draw(ctx);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else boot();

})();
