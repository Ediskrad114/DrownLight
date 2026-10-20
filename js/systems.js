/* ==========================================================================
   光溺 DROWNLIGHT · systems.js
   属性重算 / 分数 / 涌潮与层 / 卡牌 / Boss / 环境威胁 / 主更新
   ========================================================================== */
window.DL = window.DL || {};
(function () {
  'use strict';

  var U = DL.U, T = DL.T, C = T.colors, G = DL.G, I = DL.input;

  /* ---------------- 图鉴解锁 ---------------- */
  DL.seen = {
    card: function (id) {
      var sv = DL.save.get();
      if (!id || sv.cardsSeen[id]) return;
      sv.cardsSeen[id] = 1;
      DL.save.flush();
    },
    enemy: function (type) {
      var sv = DL.save.get();
      if (!type || sv.codexE[type]) return;
      sv.codexE[type] = 1;
      DL.save.flush();
    },
    boss: function (id) {
      var sv = DL.save.get();
      if (!id || sv.codex[id]) return;
      sv.codex[id] = 1;
      DL.save.flush();
    }
  };

  /* ---------------- 元进度 ---------------- */
  var meta = {
    moveMul: 1, coneLen: 0, coneAng: 0, killLightR: 0, nearR: 0,
    ifrHurt: 0, dropBonus: 0, maxHp: 0, shieldStart: 0,
    pingCd: 0, sonarPeriod: 0, rerolls: 0, markTime: 0,
    dashCharges: 0, dashCd: 0, dashDist: 0,
    dmgMul: 1, rateMul: 1, critAdd: 0, critPow: 0, magnet: 0, neon: 0
  };
  DL.meta = meta;

  DL.rebuildMeta = function () {
    meta.moveMul = 1; meta.coneLen = 0; meta.coneAng = 0; meta.killLightR = 0; meta.nearR = 0;
    meta.ifrHurt = 0; meta.dropBonus = 0; meta.maxHp = 0; meta.shieldStart = 0;
    meta.pingCd = 0; meta.sonarPeriod = 0; meta.rerolls = 0; meta.markTime = 0;
    meta.dashCharges = 0; meta.dashCd = 0; meta.dashDist = 0;
    meta.dmgMul = 1; meta.rateMul = 1; meta.critAdd = 0; meta.critPow = 0; meta.magnet = 0; meta.neon = 0;
    for (var i = 0; i < DL.TREE_NODES.length; i++) {
      var n = DL.TREE_NODES[i];
      if (!DL.save.hasNode(n)) continue;
      var e = n.eff;
      if (e.coneLen) meta.coneLen += e.coneLen;
      if (e.coneAng) meta.coneAng += e.coneAng * DL.D2;
      if (e.killLightR) meta.killLightR += e.killLightR;
      if (e.nearR) meta.nearR += e.nearR;
      if (e.ifrHurt) meta.ifrHurt += e.ifrHurt;
      if (e.dropBonus) meta.dropBonus += e.dropBonus;
      if (e.maxHp) meta.maxHp += e.maxHp;
      if (e.shieldStart) meta.shieldStart += e.shieldStart;
      if (e.pingCd) meta.pingCd += e.pingCd;
      if (e.sonarPeriod) meta.sonarPeriod += e.sonarPeriod;
      if (e.rerolls) meta.rerolls += e.rerolls;
      if (e.markTime) meta.markTime += e.markTime;
      if (e.dashCharges) meta.dashCharges += e.dashCharges;
      if (e.dashDist) meta.dashDist += e.dashDist;
      if (e.moveMul) meta.moveMul *= (1 + e.moveMul);
      if (e.dashCd) meta.dashCd += e.dashCd;
      if (e.dmgMul) meta.dmgMul *= e.dmgMul;
      if (e.rateMul) meta.rateMul *= e.rateMul;
      if (e.critAdd) meta.critAdd += e.critAdd;
      if (e.critPow) meta.critPow = Math.max(meta.critPow, e.critPow);
      if (e.magnet) meta.magnet += e.magnet;
      if (e.neon) meta.neon += e.neon;
    }
  };

  /* ---------------- 属性重算 ---------------- */
  DL.recomputeStats = function () {
    var s = DL.baseStats();
    var owned = G.runCards || {};
    for (var i = 0; i < DL.CARDS.length; i++) {
      var c = DL.CARDS[i];
      var lv = owned[c.id] || 0;
      for (var l = 1; l <= lv; l++) c.apply(s, l);
    }
    s.moveMul *= meta.moveMul;
    s.coneLen += meta.coneLen;
    s.coneAng += meta.coneAng;
    s.killLightR += meta.killLightR;
    s.nearR += meta.nearR;
    s.pingCd = Math.max(0.8, s.pingCd + meta.pingCd);
    s.sonarPeriod = Math.max(0.8, s.sonarPeriod + meta.sonarPeriod);
    s.maxHp += meta.maxHp;
    s.shieldStart += meta.shieldStart;
    s.dropBonus += meta.dropBonus;
    s.dashCharges += meta.dashCharges;
    s.dashDist += meta.dashDist;
    s.dashCd = Math.max(0.35, s.dashCd * (1 + meta.dashCd));
    s.markTime += meta.markTime;
    s.dmgMul *= meta.dmgMul;
    s.rateMul *= meta.rateMul;
    s.crit += meta.critAdd;
    if (meta.critPow) s.critPow = Math.max(s.critPow, meta.critPow);
    s.magnet += meta.magnet;
    s.dropNeon = meta.neon;
    /* 每次抽卡固定 1 次免费重抽，技能树再叠加 */
    s.rerolls = 1 + meta.rerolls;

    /* 流派亲和：已持有的同类卡越多，后续同类卡权重越高 */
    s.affinity = {};
    for (var k in (G.runCards || {})) {
      var card = DL.cardById(k);
      if (!card || !card.tags) continue;
      var lvl = G.runCards[k];
      for (var t = 0; t < card.tags.length; t++) {
        s.affinity[card.tags[t]] = (s.affinity[card.tags[t]] || 0) + lvl * 0.22;
      }
    }

    s.dmgMul = Math.min(s.dmgMul, T.limits.maxDmgMul);
    s.rateMul = Math.max(s.rateMul, T.limits.maxRateMul);
    s.count = Math.min(s.count, 12);
    return s;
  };

  /* ---------------- 难度缩放 ---------------- */
  DL.enemyScale = function () {
    if (G._sc && G._scLayer === G.layer) return G._sc;
    var k = Math.max(0, G.layer - 1);
    G._sc = {
      hp: Math.pow(T.scale.hp, k),
      spd: Math.min(Math.pow(T.scale.spd, k), T.scale.spdCap),
      dens: Math.pow(T.scale.dens, k),
      bspd: Math.min(Math.pow(T.scale.bspd, k), T.scale.bspdCap)
    };
    G._scLayer = G.layer;
    return G._sc;
  };

  /* ---------------- 分数 ---------------- */
  DL.addKill = function (x, y, base, elite) {
    G.kills++;
    G.combo++;
    if (G.combo > G.maxCombo) G.maxCombo = G.combo;
    G.comboT = DL.PL.stats.comboWin;

    var cmul = Math.min(1 + G.combo * T.combo.per, T.combo.cap);
    var dmul = 1 + G.depth * T.depth.mult;
    var gain = Math.round(base * cmul * dmul * (1 + DL.PL.stats.deepBonus));
    G.score += gain;

    if (G.combo >= 2) {
      var col = G.combo >= 30 ? C.enemy : (G.combo >= 10 ? C.gold : C.self);
      DL.addFloat(x, y - 10, '+' + gain, col, elite ? 16 : 11);
    }
  };

  /* ---------------- 一局的生命周期 ---------------- */
  DL.newRun = function (endless) {
    G.endlessRun = !!endless;
    G.runBosses = DL.rollBosses();
    G.bossLog = [];
    G.layer = 1; G.surge = 0;
    G.depth = 410;
    G.score = 0; G.kills = 0; G.combo = 0; G.comboT = 0; G.maxCombo = 0;
    G.runT = 0; G.cysts = 0;
    G.runCards = {};
    G.enemies = []; G.bullets = []; G.ebullets = []; G.parts = [];
    G.drops = []; G.floats = []; G.rings = []; G.lights = []; G.fogs = [];
    G.slashes = []; G.mines = [];
    G.vents = []; G.current = null;
    G.boss = null;
    G.shake = 0; G.flash = 0; G.freeze = 0; G.slow = 1;
    G.pingCd = 0; G.pingDark = 0; G.sonarT = 0;
    G.surgeState = 'idle'; G.surgeT = 0; G.spawned = 0; G.quota = 0; G.spawnT = 0;
    G.deathT = -1; G.ended = false;
    G.awarded = false; G.cleared = false;
    G.layerShiftT = 0;
    G.hintT = 0; G.hintIdx = 0;
    G.blipT = 0;
    G.shrink = 0;
    G.slowA = 0;
    G._sc = null;
    G.bannerT = 0;
    G.droneT = 0;
    G.cards = null;

    DL.rebuildMeta();
    DL.initPlayer();
    G.rerollsLeft = DL.PL.stats.rerolls;
    G.enemies.length = 0;
    startLayer(1);
  };

  function startLayer(n) {
    G.layer = n;
    G.surge = 0;
    if (!G.trace) G.trace = [];
    G.trace.push('L' + n + '@' + Math.round(G.runT));
    if (G.trace.length > 40) G.trace.shift();
    G.depth = 410 + (n - 1) * 600;
    G.cysts = 0;
    G.enemies.length = 0;
    G.ebullets.length = 0;
    G.fogs.length = 0;
    G.slashes.length = 0;
    G.mines.length = 0;
    G.shrink = 0;
    G.slowA = 0;
    buildHazards(n);
    G.bannerText = 'DEPTH ' + U.depthStr(G.depth) + 'M';
    G.bannerT = 2.4;
    nextSurge();
  }

  function buildHazards(n) {
    G.vents = [];
    G.current = null;
    if (n >= 4) {
      var count = n >= 6 ? 5 : (n >= 5 ? 4 : 3);
      for (var i = 0; i < count; i++) {
        G.vents.push({
          x: DL.S.W * (0.18 + 0.64 * (i / Math.max(1, count - 1))),
          y: DL.S.H * U.rnd(0.25, 0.85),
          cd: U.rnd(2, 6), t: 0, active: 0, tele: 0, r: 62
        });
      }
    }
    if (n >= 5) {
      G.current = { y: DL.S.H * U.rnd(0.3, 0.7), w: 140, dir: Math.random() < 0.5 ? 1 : -1, speed: 46, x: 0 };
    }
  }

  function nextSurge() {
    G.surge++;
    if (G.surge > T.layer.surges) { startBoss(); return; }
    var idx = Math.min(G.layer - 1, T.surge.onscreen.length - 1);
    var sc = DL.enemyScale();
    G.quota = Math.round(T.surge.onscreen[idx] * (0.8 + sc.dens * 0.2));
    G.maxOn = G.quota;
    G.spawned = 0;
    G.spawnT = 1.0;
    G.surgeState = 'run';
    G.surgeT = 0;
    G.clearT = 0;
    G.surgeDur = Math.min(75, 38 + G.layer * 6);
    G.bannerText = 'SURGE ' + G.surge + ' / ' + T.layer.surges;
    G.bannerT = 1.6;
  }

  function startBoss() {
    G.surgeState = 'boss';
    if (!G.trace) G.trace = [];
    G.trace.push('B' + G.layer + '@' + Math.round(G.runT));
    if (G.trace.length > 40) G.trace.shift();
    var per = T.boss.perRun;
    var slot = (G.layer - 1) % per;
    var cycle = Math.floor((G.layer - 1) / per);
    /* 新一轮（第 7、13、19… 层）：重新抽一批 Boss */
    if (slot === 0 && G.layer > 1) G.runBosses = DL.rollBosses(G.runBosses);
    var def = runBossAt(slot);
    G.boss = makeBoss(def, G.layer);
    if (!G.bossLog) G.bossLog = [];
    G.bossLog.push(def.name);
    DL.seen.boss(def.id);
    G.bannerText = 'L' + G.layer + ' · ' + def.name + ' · ' + def.sub +
      (cycle > 0 ? '   第 ' + (cycle + 1) + ' 轮' : '');
    G.bannerT = 2.6;
    DL.audio.sfx.boss();
    G.shake = Math.max(G.shake, 10);
    G.flash = 0.3; G.flashCol = def.color;
  }

  function runBossAt(slot) {
    if (!G.runBosses || !G.runBosses.length) G.runBosses = DL.rollBosses();
    return G.runBosses[slot % G.runBosses.length] || DL.BOSSES[0];
  }

  /* 抽本局的 Boss 名单：洗牌 → 取 perRun 个 → 按威胁等级排序（难度自然爬升）。
     avoid 用于无尽模式换批时尽量避开上一轮刚打过的。 */
  DL.rollBosses = function (avoid) {
    var all = DL.BOSSES, n = T.boss.perRun, i;
    var pool = [];
    for (i = 0; i < all.length; i++) pool.push(all[i]);
    for (i = pool.length - 1; i > 0; i--) {
      var j = U.rndInt(0, i), tmp = pool[i];
      pool[i] = pool[j]; pool[j] = tmp;
    }
    var pick = pool.slice(0, Math.min(n, pool.length));
    if (avoid && avoid.length && all.length > n) {
      for (i = 0; i < pick.length; i++) {
        var guard = 0;
        while (avoid.indexOf(pick[i]) >= 0 && guard++ < 24) {
          var cand = all[U.rndInt(0, all.length - 1)];
          if (pick.indexOf(cand) < 0) pick[i] = cand;
        }
      }
    }
    pick.sort(function (a, b) { return (a.rank - b.rank) || (Math.random() - 0.5); });
    return pick;
  };

  function bossFight(def, layer) {
    G.layer = Math.max(1, layer | 0);
    G.depth = 410 + (G.layer - 1) * T.depth.perLayer;
    G.enemies.length = 0;
    G.ebullets.length = 0;
    G.boss = null;
    G.bossClear = false;
    G.surgeState = 'boss';
    G._sc = null;
    buildHazards(G.layer);
    G.boss = makeBoss(def, G.layer);
    DL.seen.boss(def.id);
    G.bannerText = 'L' + G.layer + ' · ' + def.name + ' · ' + def.sub;
    G.bannerT = 2.6;
    DL.audio.sfx.boss();
  }

  /* 调试：本局名单里的第 n 个 Boss */
  DL.debugBoss = function (n) {
    n = Math.max(1, Math.min(T.boss.perRun, n | 0));
    bossFight(runBossAt(n - 1), n);
  };

  /* 调试：按层号直接开一场 Boss 战（会触发换批与无尽缩放） */
  DL.debugLayerBoss = function (n) {
    n = Math.max(1, n | 0);
    G.layer = n;
    G.depth = 410 + (n - 1) * T.depth.perLayer;
    G.enemies.length = 0;
    G.ebullets.length = 0;
    G.boss = null;
    G.bossClear = false;
    G._sc = null;
    buildHazards(n);
    startBoss();
    return G.boss;
  };

  /* 调试：按 id / 名字直接点某个 Boss（不改变当前层） */
  DL.debugBossId = function (key) {
    var k = String(key || '');
    for (var i = 0; i < DL.BOSSES.length; i++) {
      var d = DL.BOSSES[i];
      if (d.id === k || d.name === k) {
        bossFight(d, G.layer > 0 ? G.layer : 1);
        return d;
      }
    }
    return null;
  };


  /* ---------------- 刷怪 ---------------- */
  function spawnBatch() {
    var avail = [];
    for (var i = 0; i < DL.FORMATIONS.length; i++) {
      var f = DL.FORMATIONS[i];
      if (f.minLayer <= G.layer) avail.push(f);
    }
    var totalW = 0;
    for (var j = 0; j < avail.length; j++) totalW += avail[j].w;
    var r = Math.random() * totalW, acc = 0, f = avail[0];
    for (var k = 0; k < avail.length; k++) { acc += avail[k].w; if (r <= acc) { f = avail[k]; break; } }

    var room = G.maxOn - G.enemies.length;
    if (room <= 0) return;
    var spawned = 0;
    for (var m = 0; m < f.list.length; m++) {
      var type = f.list[m][0], cnt = f.list[m][1];
      for (var c = 0; c < cnt; c++) {
        if (spawned >= room) break;
        spawnAtEdge(type);
        spawned++;
        G.spawned++;
      }
    }
  }

  function spawnAtEdge(type) {
    var S = DL.S, m = 70;
    var side = U.rndInt(0, 3);
    var x, y, guard = 0;
    do {
      if (side === 0) { x = U.rnd(20, S.W - 20); y = -m; }
      else if (side === 1) { x = S.W + m; y = U.rnd(20, S.H - 20); }
      else if (side === 2) { x = U.rnd(20, S.W - 20); y = S.H + m; }
      else { x = -m; y = U.rnd(20, S.H - 20); }
      guard++;
    } while (U.dist(x, y, DL.PL.x, DL.PL.y) < 320 && guard < 12);

    if (type === 'worm') {
      // 管虫必须贴着屏幕内边缘
      var e = U.rndInt(0, 3);
      if (e === 0) { x = U.rnd(40, S.W - 40); y = 34; }
      else if (e === 1) { x = S.W - 34; y = U.rnd(40, S.H - 40); }
      else if (e === 2) { x = U.rnd(40, S.W - 40); y = S.H - 34; }
      else { x = 34; y = U.rnd(40, S.H - 40); }
    }
    DL.spawnEnemy(type, x, y);
  }

  /* ---------------- Boss ---------------- */
  /* 第 n 层 Boss 的基准血量：1~6 层查表；无尽模式每多打一轮（6 层）乘一次，
     轮内再缓慢爬升，避免第 13 层直接变成打不动的墙 */
  function bossBaseHp(layer) {
    var R = T.boss.rankHp;
    var n = Math.max(1, layer | 0);
    if (n <= 6) return R[n];
    var cycle = Math.floor((n - 1) / T.boss.perRun);
    return R[6] * Math.pow(T.boss.cycleHp, cycle) * Math.pow(T.boss.layerHp, n - 6);
  }

  /* 「鲸」的眼睛位置：跟着镜像方向，和画面上看到的位置一致 */
  function whaleEye(b) {
    var d = b.dir < 0 ? -1 : 1;
    return {
      x: b.x + Math.cos(b.eyeA) * b.r * 0.40 * d,
      y: b.y + Math.sin(b.eyeA) * b.r * 0.40
    };
  }
  DL.whaleEye = whaleEye;

  function makeBoss(def, layer) {
    var rank = Math.min(6, Math.max(1, def.rank || 6));
    /* 同一层里，威胁等级越低血量越低；同等级内保留各自的微调 */
    var hp = Math.round(bossBaseHp(layer || 1) * (def.hp / T.boss.rankHp[rank]));
    return {
      id: def.id, def: def,
      x: DL.S.W * 0.5, y: DL.S.H * 0.28,
      r: def.r, hitScale: def.hitScale || 1,
      hp: hp, maxHp: hp,
      t: 0, phase: 0, nPhase: def.phases.length,
      atk0: 1.4, atk1: 2.6, atk2: 4,
      invuln: 0, dead: false, flash: 0,
      color: def.color, angle: 0,
      parts: [], p2: false, p3: false,
      tentA: 0, sweep: 0, sweepT: 0,
      partsAlive: 0, respawnT: 0,
      fogT: 3, dashT: 6, bite: 0, pull: 0,
      decoyT: 5, ventT: 4, retract: 0,
      /* 新 Boss 用的通用槽位 */
      st: 'idle', stT: 2.0, aimA: 0, gapA: 0, spin: 0,
      cur: 0, anchors: null, dir: 0, eyeA: 0, passT: 0,
      slowA: 0, stunT: 0, hitGlow: 0,
      vulnerable: true
    };
  }

  DL.damageBoss = function (dmg, x, y) {
    var b = G.boss;
    if (!b || b.dead || b.invuln > 0) return;
    if (!b.vulnerable) {
      if (Math.random() < 0.2) DL.burst(x, y, 2, '#7a7f9a', 80, 1.6, 0.25);
      return;
    }
    // 「群」的炮茧是额外的炮台压力，不阻挡本体受伤（避免软锁）
    if (b.id === 'qun' && b.partsAlive > 0) dmg *= 0.8;
    // 「鲸」：只有颅骨上那只眼睛吃满伤害，砸在骨面上几乎白打
    if (b.id === 'whale') {
      var we = whaleEye(b);
      dmg *= (x === undefined || U.dist(x, y, we.x, we.y) < b.r * 0.5) ? 1.6 : 0.38;
    }
    // 「晶」：晶簇全碎后的停摆窗口里额外吃伤害
    if (b.id === 'crystal' && b.partsAlive === 0) dmg *= 1.5;
    b.hp -= dmg;
    b.flash = 0.06;
    if (b.hp <= 0) DL.killBoss();
  };

  DL.killBoss = function () {
    var b = G.boss;
    if (!b) return;
    b.dead = true;
    G.boss = null;
    G.score += T.score.boss;
    DL.audio.sfx.bossDie();
    G.shake = 24;
    G.freeze = T.hitstop.boss;
    G.flash = T.fx.flashBoss;
    G.flashCol = '#ffffff';
    for (var i = 0; i < 5; i++) {
      setTimeout(function () { }, 0);
      DL.burst(b.x + U.rnd(-60, 60), b.y + U.rnd(-60, 60), 40, b.color, 460, 5, 1.2, -60);
    }
    G.rings.push({ x: b.x, y: b.y, r: 10, to: 620, life: 0.9, max: 0.9, color: b.color, width: 6 });
    if (G.lights) G.lights.push({ x: b.x, y: b.y, r: 700, life: 1.4, max: 1.4 });

    G.score += Math.round(T.score.layerBonus * G.layer);
    G.ebullets.length = 0;
    G.enemies.length = 0;
    G.layerShiftT = 5.0;
    G.surgeState = 'shift';
    G.bannerText = 'DEPTH +';
    G.bannerT = 1;

    // 掉落：修复 + 氖核 + 一次稀有选卡
    DL.spawnDrop(b.x - 40, b.y, 'repair');
    DL.spawnDrop(b.x + 40, b.y, 'neon');
    G.bossClear = true;
  };

  function bossAI(b, dt) {
    b.t += dt;
    b.flash = Math.max(0, b.flash - dt);
    b.invuln = Math.max(0, b.invuln - dt);
    var S = DL.S, p = DL.PL;

    if (b.id === 'ying') {
      b.x = S.W * 0.5 + Math.sin(b.t * 0.5) * S.W * 0.18;
      b.y = S.H * 0.26 + Math.sin(b.t * 0.8) * 26;
      b.tentA += dt * 0.7;
      b.atk0 -= dt;
      if (b.atk0 <= 0) {
        b.atk0 = b.p2 ? 2.0 : 3.0;
        var n = b.p2 ? 16 : 12;
        var off = b.t;
        for (var i = 0; i < n; i++) DL.spawnEBullet(b.x, b.y, off + i * U.TAU / n, 150 * DL.enemyScale().bspd, 7);
      }
      if (!b.p2 && b.hp < b.maxHp * 0.5) {
        b.p2 = true;
        for (var j = 0; j < 3; j++) DL.spawnEnemy('jelly', b.x + U.rnd(-80, 80), b.y + 60);
        G.shake = 12; G.flash = 0.25; G.flashCol = b.color;
      }
      // 触手接触伤害
      for (var k = 0; k < 4; k++) {
        var a = b.tentA + k * Math.PI / 2;
        for (var s2 = 0.4; s2 <= 1.0; s2 += 0.2) {
          var tx = b.x + Math.cos(a) * b.r * 1.9 * s2;
          var ty = b.y + Math.sin(a) * b.r * 1.9 * s2;
          if (U.dist2(tx, ty, p.x, p.y) < (16 + p.r) * (16 + p.r)) DL.hurtPlayer(1, tx, ty);
        }
      }

    } else if (b.id === 'mo') {
      b.x = S.W * 0.5 + Math.sin(b.t * 0.4) * S.W * 0.12;
      b.y = S.H * 0.3 + Math.sin(b.t * 0.7) * 30;
      b.tentA += dt * 1.1;
      b.atk0 -= dt;
      if (b.atk0 <= 0) { b.atk0 = 2.2; DL.aimedVolley(b, 5, 0.18, 220); }
      b.fogT -= dt;
      if (b.fogT <= 0) {
        b.fogT = b.p2 ? 4.5 : 8;
        for (var f = 0; f < (b.p2 ? 4 : 3); f++) {
          G.fogs.push({ x: U.rnd(S.W * 0.15, S.W * 0.85), y: U.rnd(S.H * 0.2, S.H * 0.8), r: U.rnd(90, 150), life: 3, max: 3 });
        }
      }
      if (!b.p2 && b.hp < b.maxHp * 0.5) { b.p2 = true; G.shake = 12; G.flash = 0.25; G.flashCol = b.color; }
      for (var k2 = 0; k2 < 6; k2++) {
        var a2 = b.tentA + k2 * Math.PI / 3;
        for (var s3 = 0.5; s3 <= 1.0; s3 += 0.25) {
          var tx2 = b.x + Math.cos(a2) * b.r * 2.1 * s3;
          var ty2 = b.y + Math.sin(a2) * b.r * 2.1 * s3;
          if (U.dist2(tx2, ty2, p.x, p.y) < (14 + p.r) * (14 + p.r)) DL.hurtPlayer(1, tx2, ty2);
        }
      }

    } else if (b.id === 'deng') {
      b.x = U.lerp(b.x, S.W * 0.5 + Math.sin(b.t * 0.6) * S.W * 0.2, 0.02);
      b.y = U.lerp(b.y, S.H * 0.24, 0.02);
      b.atk0 -= dt;
      if (b.atk0 <= 0) { b.atk0 = b.p2 ? 2.4 : 3.2; DL.aimedVolley(b, b.p2 ? 7 : 5, 0.16, 200); }
      b.decoyT -= dt;
      if (b.decoyT <= 0) { b.decoyT = b.p2 ? 3.5 : 5; DL.spawnDecoy(b.x, b.y + 40); DL.spawnDecoy(b.x + 60, b.y); }
      b.pull = Math.max(0, b.pull - dt);
      if (b.pull > 0) {
        var pa = Math.atan2(b.y - p.y, b.x - p.x);
        p.vx += Math.cos(pa) * 210 * dt;
        p.vy += Math.sin(pa) * 210 * dt;
      }
      if (Math.floor(b.t) % 9 === 0 && b.bite <= 0 && b.t > 3) { b.bite = 1.2; }
      if (b.bite > 0) {
        b.bite -= dt;
        if (b.bite <= 0) {
          var ba = Math.atan2(p.y - b.y, p.x - b.x);
          for (var q = 0; q < 9; q++) DL.spawnEBullet(b.x, b.y, ba + (q - 4) * 0.09, 420 * DL.enemyScale().bspd, 7);
        }
      }
      if (!b.p2 && b.hp < b.maxHp * 0.5) { b.p2 = true; b.invuln = 1; G.shake = 14; G.flash = 0.3; G.flashCol = b.color; }

    } else if (b.id === 'qun') {
      b.x = U.lerp(b.x, S.W * 0.5, 0.02);
      b.y = U.lerp(b.y, S.H * 0.32, 0.02);
      b.tentA += dt * 0.4;
      if (b.parts.length === 0) {
        var corners = [[90, 90], [S.W - 90, 90], [90, S.H - 90], [S.W - 90, S.H - 90]];
        for (var c = 0; c < 4; c++) {
          b.parts.push({ x: corners[c][0], y: corners[c][1], r: 30, hp: b.maxHp * 0.1, maxHp: b.maxHp * 0.1, fireCd: U.rnd(0.5, 2), dead: false, ang: 0 });
        }
        b.partsAlive = 4;
      }
      var alive = 0;
      for (var pi = 0; pi < b.parts.length; pi++) {
        var pt = b.parts[pi];
        if (pt.dead) continue;
        alive++;
        pt.fireCd -= dt;
        if (pt.fireCd <= 0) {
          pt.fireCd = 2.2 / (b.p2 ? 1.5 : 1);
          var aa = Math.atan2(p.y - pt.y, p.x - pt.x);
          for (var w = -1; w <= 1; w++) DL.spawnEBullet(pt.x, pt.y, aa + w * 0.14, 210 * DL.enemyScale().bspd, 6, 0.5);
        }
      }
      b.partsAlive = alive;
      b.vulnerable = true;
      if (alive === 0) {
        b.respawnT += dt;
        if (b.respawnT > 60) {
          b.respawnT = 0;
          for (var rp = 0; rp < b.parts.length; rp++) { b.parts[rp].dead = false; b.parts[rp].hp = b.parts[rp].maxHp; }
        }
      } else b.respawnT = 0;
      b.atk0 -= dt;
      if (b.atk0 <= 0) { b.atk0 = 3.0; DL.aimedVolley(b, 6, 0.15, 190); }

    } else if (b.id === 'yuan') {
      b.x = U.lerp(b.x, S.W * 0.5 + Math.sin(b.t * 0.35) * S.W * 0.16, 0.03);
      b.y = U.lerp(b.y, S.H * 0.3, 0.03);
      b.atk0 -= dt;
      if (b.atk0 <= 0) { b.atk0 = 2.6; DL.aimedVolley(b, b.p2 ? 8 : 5, 0.13, 200); }
      b.ventT -= dt;
      if (b.ventT <= 0) {
        b.ventT = b.p2 ? 3 : 5;
        for (var v = 0; v < G.vents.length; v++) { G.vents[v].cd = Math.min(G.vents[v].cd, 0.8); }
        G.shake = 6;
      }
      b.retract -= dt;
      if (b.retract <= 0) {
        b.retract = 8;
        b.vulnerable = false; b.invuln = 2.6;
        G.shake = 8;
      }
      if (b.invuln <= 0.05 && !b.vulnerable && b.retract > 4) b.vulnerable = true;
      if (!b.p2 && b.hp < b.maxHp * 0.5) { b.p2 = true; G.shake = 12; G.flash = 0.25; G.flashCol = b.color; }

    } else if (b.id === 'xiu') {
      /* 锈：亮腹预警 → 直线冲撞 → 撞墙硬直；冲过的路上留下会追人的粘液 */
      if (b.st === 'idle') {
        /* 不冲刺的时候往玩家那边靠，别缩在角落里挨打 */
        var xt = S.W * 0.5 + (p.x - S.W * 0.5) * 0.38;
        var yt = S.H * 0.30 + (p.y - S.H * 0.30) * 0.30;
        b.x = U.lerp(b.x, xt, 0.030);
        b.y = U.lerp(b.y, yt, 0.030);
        b.stT -= dt;
        if (b.stT <= 0) {
          b.st = 'tele'; b.stT = 0.95;
          b.aimA = Math.atan2(p.y - b.y, p.x - b.x);
        }
      } else if (b.st === 'tele') {
        b.stT -= dt;
        b.x += Math.cos(b.aimA) * 26 * dt;
        b.y += Math.sin(b.aimA) * 26 * dt;
        if (b.stT <= 0) {
          b.st = 'dash'; b.stT = 0.55 + (b.p2 ? 0.1 : 0);
          G.shake = Math.max(G.shake, 6);
          DL.audio.sfx.dash && DL.audio.sfx.dash();
        }
      } else if (b.st === 'dash') {
        var xsp = 980 * (b.p2 ? 1.12 : 1);
        b.x += Math.cos(b.aimA) * xsp * dt;
        b.y += Math.sin(b.aimA) * xsp * dt;
        if (Math.random() < 0.5) DL.burst(b.x, b.y, 1, b.color, 90, 2.4, 0.45, -10);
        if (U.dist2(b.x, b.y, p.x, p.y) < (b.r + p.r) * (b.r + p.r)) DL.hurtPlayer(1, b.x, b.y);
        var hitWall = (b.x < b.r || b.x > S.W - b.r || b.y < b.r || b.y > S.H - b.r);
        if (hitWall || b.stT <= 0) {
          b.x = U.clamp(b.x, b.r, S.W - b.r);
          b.y = U.clamp(b.y, b.r, S.H - b.r);
          var muds = hitWall ? 5 : 3;
          DL.spawnSludge(b.x, b.y, muds);
          b.st = 'stun';
          b.stT = hitWall ? 1.4 : 0.7;
          G.shake = Math.max(G.shake, hitWall ? 14 : 8);
          if (hitWall) { G.flash = 0.18; G.flashCol = b.color; }
        }
      } else {
        b.stT -= dt;
        if (b.stT <= 0) { b.st = 'idle'; b.stT = b.p2 ? 1.5 : 2.4; }
      }
      if (!b.p2 && b.hp < b.maxHp * 0.5) { b.p2 = true; G.shake = 12; G.flash = 0.25; G.flashCol = b.color; }

    } else if (b.id === 'chao') {
      /* 潮：一圈闭环浪墙，只留一道会转向的缺口 */
      b.x = U.lerp(b.x, S.W * 0.5 + Math.sin(b.t * 0.42) * S.W * 0.2, 0.03);
      b.y = U.lerp(b.y, S.H * 0.3 + Math.sin(b.t * 0.6) * 20, 0.03);
      b.tentA += dt * 0.9;
      b.atk0 -= dt;
      b.waveT = (b.waveT || 0) + dt;
      if (b.atk0 <= 0) {
        b.atk0 = b.p2 ? 3.1 : 4.2;
        b.waveT = 0;
        var cn = 30, cgap = b.p2 ? 4 : 6;
        b.lastGap = b.gapA;
        for (var ci = 0; ci < cn; ci++) {
          if (ci < cgap) continue;
          DL.spawnEBullet(b.x, b.y, b.gapA + ci * U.TAU / cn, 130 * DL.enemyScale().bspd, 7);
        }
        b.gapA += 0.95;
        G.rings.push({ x: b.x, y: b.y, r: b.r * 0.8, to: 560, life: 0.55, max: 0.55, color: b.color, width: 3 });
        DL.audio.sfx.hit();
      }
      b.decoyT -= dt;
      if (b.decoyT <= 0) {
        b.decoyT = b.p2 ? 5 : 7;
        for (var cs = 0; cs < (b.p2 ? 4 : 3); cs++) {
          DL.spawnEnemy('swarm', b.x + U.rnd(-70, 70), b.y + U.rnd(30, 90));
        }
      }
      if (!b.p2 && b.hp < b.maxHp * 0.5) { b.p2 = true; G.shake = 12; G.flash = 0.25; G.flashCol = b.color; }

    } else if (b.id === 'mian') {
      /* 眠：催眠雾 + 减速场 + 四臂慢弹；不贴身，只用梦压你 */
      b.x = U.lerp(b.x, S.W * 0.5 + Math.sin(b.t * 0.33) * S.W * 0.26, 0.015);
      b.y = U.lerp(b.y, S.H * 0.34 + Math.sin(b.t * 0.5) * 40, 0.015);
      b.tentA += dt * 0.5;
      var mid = U.dist(b.x, b.y, p.x, p.y);
      b.slowA = mid < 430 ? U.clamp(1 - mid / 430, 0.2, 1) : 0;
      if (b.slowA > (G.slowA || 0)) G.slowA = b.slowA;
      b.atk0 -= dt;
      if (b.atk0 <= 0) {
        b.atk0 = b.p2 ? 2.7 : 3.5;
        b.spin += 0.34;
        for (var ma = 0; ma < 4; ma++) {
          var marc = b.spin + ma * U.TAU / 4;
          for (var mb = 0; mb < 5; mb++) {
            DL.spawnEBullet(b.x + Math.cos(marc) * (34 + mb * 26),
              b.y + Math.sin(marc) * (34 + mb * 26),
              marc, 108 * DL.enemyScale().bspd, 6);
          }
        }
      }
      b.fogT -= dt;
      if (b.fogT <= 0) {
        b.fogT = b.p2 ? 5 : 7;
        for (var mf = 0; mf < 2; mf++) {
          G.fogs.push({
            x: U.clamp(p.x + U.rnd(-260, 260), 70, S.W - 70),
            y: U.clamp(p.y + U.rnd(-220, 220), 70, S.H - 70),
            r: U.rnd(120, 175), life: 4.5, max: 4.5
          });
        }
      }
      b.decoyT -= dt;
      if (b.decoyT <= 0) { b.decoyT = 8; DL.spawnDecoy(b.x, b.y); }
      if (!b.p2 && b.hp < b.maxHp * 0.5) { b.p2 = true; G.shake = 12; G.flash = 0.25; G.flashCol = b.color; }

    } else if (b.id === 'mirror') {
      /* 镜：三个锚点，只有一个是真的；假身也会放冷枪，只有本体吃伤害 */
      if (!b.anchors) {
        b.anchors = [
          [S.W * 0.24, S.H * 0.26],
          [S.W * 0.76, S.H * 0.26],
          [S.W * 0.5, S.H * 0.38]
        ];
        b.cur = 0;
        b.stT = 3.2;
      }
      var mcur = b.anchors[b.cur];
      b.x = U.lerp(b.x, mcur[0], 0.07);
      b.y = U.lerp(b.y, mcur[1], 0.07);
      b.tentA += dt * 1.5;
      b.stT -= dt;
      if (b.stT <= 0) {
        b.stT = b.p2 ? 2.4 : 3.4;
        b.cur = (b.cur + 1 + U.rndInt(0, 1)) % 3;
        b.invuln = 0.22;
        G.rings.push({ x: b.x, y: b.y, r: 8, to: b.r * 2.4, life: 0.4, max: 0.4, color: b.color, width: 2 });
      }
      b.atk0 -= dt;
      if (b.atk0 <= 0) {
        b.atk0 = b.p2 ? 1.1 : 1.5;
        for (var mk = 0; mk < 3; mk++) {
          if (mk === b.cur) continue;
          var mp = b.anchors[mk];
          DL.spawnEBullet(mp[0], mp[1], Math.atan2(p.y - mp[1], p.x - mp[0]), 165 * DL.enemyScale().bspd, 5);
        }
      }
      b.atk1 -= dt;
      if (b.atk1 <= 0) { b.atk1 = 2.9; DL.aimedVolley(b, 3, 0.17, 215); }
      if (!b.p2 && b.hp < b.maxHp * 0.5) { b.p2 = true; G.shake = 12; G.flash = 0.25; G.flashCol = b.color; }

    } else if (b.id === 'whale') {
      /* 鲸：缓慢横穿，撞到会掉血；只有颅骨上的眼睛吃满伤害 */
      if (!b.dir) b.dir = Math.random() < 0.5 ? 1 : -1;
      b.x += b.dir * (b.p2 ? 92 : 74) * dt;
      b.y = S.H * 0.5 + Math.sin(b.t * 0.42) * S.H * 0.26;
      b.eyeA = -Math.PI / 2 + Math.sin(b.t * 0.55) * 0.85;
      if (b.x > S.W + b.r) { b.x = -b.r; b.dir = 1; b.passT++; }
      if (b.x < -b.r) { b.x = S.W + b.r; b.dir = -1; b.passT++; }
      if (U.dist2(b.x, b.y, p.x, p.y) < (b.r * 0.85 + p.r) * (b.r * 0.85 + p.r)) DL.hurtPlayer(1, p.x, p.y);
      b.atk0 -= dt;
      if (b.atk0 <= 0) {
        b.atk0 = b.p2 ? 1.5 : 2.1;
        var wd = b.dir > 0 ? 1 : -1;
        var wf = wd > 0 ? 0 : Math.PI;
        /* 从嘴里吐出去，而不是从身体中间冒出来 */
        var mwx = b.x + wd * b.r * 0.95;
        var mwy = b.y + b.r * 0.18;
        var wn = b.p2 ? 9 : 7;
        for (var wi = 0; wi < wn; wi++) {
          DL.spawnEBullet(mwx, mwy, wf + (wi - (wn - 1) / 2) * 0.12, 148 * DL.enemyScale().bspd, 6);
        }
        for (var wb = 0; wb < 3; wb++) {
          DL.spawnEBullet(b.x - wd * b.r, b.y, Math.PI - wf + (wb - 1) * 0.22, 120 * DL.enemyScale().bspd, 5);
        }
      }
      if (!b.p2 && b.hp < b.maxHp * 0.5) { b.p2 = true; G.shake = 14; G.flash = 0.28; G.flashCol = b.color; }

    } else if (b.id === 'crystal') {
      /* 晶：六枚晶簇公转并各自开火，本体持续吐螺旋；全碎则停摆 */
      b.x = U.lerp(b.x, S.W * 0.5, 0.02);
      b.y = U.lerp(b.y, S.H * 0.3, 0.02);
      b.tentA += dt * (b.p2 ? 1.35 : 1.0);
      if (!b.parts.length) {
        for (var cq = 0; cq < 6; cq++) {
          b.parts.push({
            x: b.x, y: b.y, r: 26, hp: b.maxHp * 0.05, maxHp: b.maxHp * 0.05,
            fireCd: U.rnd(0.8, 2.6), dead: false, ang: 0
          });
        }
        b.partsAlive = 6;
      }
      var cAlive = 0, cR = b.r * 2.5;
      for (var pq = 0; pq < b.parts.length; pq++) {
        var pt2 = b.parts[pq];
        if (pt2.dead) continue;
        cAlive++;
        var pa2 = b.tentA + pq * U.TAU / 6;
        pt2.x = b.x + Math.cos(pa2) * cR;
        pt2.y = b.y + Math.sin(pa2) * cR;
        pt2.fireCd -= dt;
        if (pt2.fireCd <= 0) {
          pt2.fireCd = b.p2 ? 1.5 : 2.0;
          DL.spawnEBullet(pt2.x, pt2.y, Math.atan2(p.y - pt2.y, p.x - pt2.x), 175 * DL.enemyScale().bspd, 5);
        }
      }
      b.partsAlive = cAlive;
      if (cAlive > 0) {
        b.stunT = 0; b.respawnT = 0;
        b.atk0 -= dt;
        if (b.atk0 <= 0) {
          b.atk0 = b.p2 ? 0.15 : 0.21;
          b.spin += 0.42;
          for (var csp = 0; csp < 2; csp++) {
            DL.spawnEBullet(b.x, b.y, b.spin + csp * Math.PI, 128 * DL.enemyScale().bspd, 6);
          }
        }
      } else {
        /* 全碎：停摆，晶簇慢慢长回来 */
        b.stunT += dt;
        b.respawnT += dt;
        if (b.stunT > 0.1 && b.stunT < 0.12) { G.shake = 16; G.flash = 0.3; G.flashCol = b.color; }
        if (b.respawnT > 6.5) {
          b.respawnT = 0;
          for (var cr = 0; cr < b.parts.length; cr++) {
            b.parts[cr].dead = false;
            b.parts[cr].hp = b.parts[cr].maxHp;
            b.parts[cr].fireCd = U.rnd(1, 2.4);
          }
          b.partsAlive = 6;
          G.shake = 10;
        }
      }
      if (!b.p2 && b.hp < b.maxHp * 0.5) { b.p2 = true; G.shake = 12; G.flash = 0.25; G.flashCol = b.color; }

    } else if (b.id === 'guangni') {
      b.x = U.lerp(b.x, S.W * 0.5 + Math.sin(b.t * 0.3) * S.W * 0.22, 0.02);
      b.y = U.lerp(b.y, S.H * 0.26 + Math.sin(b.t * 0.55) * 40, 0.02);
      b.atk0 -= dt;
      if (b.atk0 <= 0) {
        b.atk0 = b.p3 ? 1.5 : 2.6;
        var nn = b.p3 ? 20 : 14;
        var oo = b.t * 1.7;
        for (var g = 0; g < nn; g++) DL.spawnEBullet(b.x, b.y, oo + g * U.TAU / nn, 170 * DL.enemyScale().bspd, 7);
      }
      b.atk1 -= dt;
      if (b.atk1 <= 0) { b.atk1 = 3.4; DL.aimedVolley(b, 5, 0.2, 240); }
      b.decoyT -= dt;
      if (b.decoyT <= 0) { b.decoyT = 6; DL.spawnDecoy(b.x, b.y + 50); }
      if (!b.p2 && b.hp < b.maxHp * 0.62) {
        b.p2 = true; b.invuln = 1.2;
        G.shake = 16; G.flash = 0.35; G.flashCol = '#ffffff';
        G.bannerText = '它开始吃掉光';
        G.bannerT = 1.8;
      }
      if (!b.p3 && b.hp < b.maxHp * 0.3) {
        b.p3 = true; b.invuln = 1.2;
        G.shake = 20; G.flash = 0.4; G.flashCol = '#ffffff';
        G.bannerText = '深渊挤压';
        G.bannerT = 1.8;
        G.shrinkTarget = 140;
      }
    }
    // 玩家不能穿出挤压边界
    if (G.shrink > 0) {
      var S2 = DL.S, pad2 = 20 + G.shrink;
      var p2 = DL.PL;
      if (p2.x < pad2) { p2.x = pad2; p2.vx = Math.abs(p2.vx) * 0.2; }
      if (p2.x > S2.W - pad2) { p2.x = S2.W - pad2; p2.vx = -Math.abs(p2.vx) * 0.2; }
      if (p2.y < pad2) { p2.y = pad2; p2.vy = Math.abs(p2.vy) * 0.2; }
      if (p2.y > S2.H - pad2) { p2.y = S2.H - pad2; p2.vy = -Math.abs(p2.vy) * 0.2; }
      if (p2.x < pad2 + 2 || p2.y < pad2 + 2 || p2.x > S2.W - pad2 - 2 || p2.y > S2.H - pad2 - 2) {
        // 贴边持续伤害由视觉提示，不做额外伤害
      }
    }
  }

  DL.aimedVolley = function (b, n, spread, spd) {
    var p = DL.PL;
    var aa = Math.atan2(p.y - b.y, p.x - b.x);
    for (var i = 0; i < n; i++) {
      DL.spawnEBullet(b.x, b.y, aa + (i - (n - 1) / 2) * spread, spd * DL.enemyScale().bspd, 7);
    }
  };

  /* ---------------- 卡牌 ---------------- */
  function layerGroup() {
    if (G.layer <= 2) return 1;
    if (G.layer <= 4) return 2;
    return 3;
  }

  function rarityWeight(rar) {
    var g = layerGroup();
    var R = DL.RARITY[rar];
    return g === 1 ? R.w1 : (g === 2 ? R.w2 : R.w3);
  }

  /* 卡牌是否可抽：等级未满 + 前置卡已持有（如近战系必须先有光刃） */
  function available(c) {
    var lv = (G.runCards[c.id] || 0);
    if (!c.repeat && lv >= c.max) return false;
    if (c.need) {
      for (var i = 0; i < c.need.length; i++) {
        if (!(G.runCards[c.need[i]] > 0)) return false;
      }
    }
    return true;
  }

  /* 权重 = 稀有度 × 流派亲和。手上近战卡越多，后续越容易再抽到近战卡。 */
  function cardWeight(c) {
    var w = c.repeat ? 1.1 : rarityWeight(c.rar);
    var aff = 0;
    if (c.tags) {
      var af = (DL.PL.stats && DL.PL.stats.affinity) || {};
      for (var t = 0; t < c.tags.length; t++) aff += (af[c.tags[t]] || 0);
    }
    if (aff > 0) w *= 1 + Math.min(1.9, aff * 0.55);
    return w;
  }

  function pickOne(cat, minRar, used) {
    var pool = [], weights = [], total = 0;
    for (var i = 0; i < DL.CARDS.length; i++) {
      var c = DL.CARDS[i];
      if (used.indexOf(c) >= 0) continue;
      if (cat && c.cat !== cat) continue;
      if (!available(c)) continue;
      if (minRar && c.rar === 'c') continue;
      var w = cardWeight(c);
      if (w <= 0) continue;
      pool.push(c); weights.push(w); total += w;
    }
    if (pool.length === 0) {
      for (var j = 0; j < DL.CARDS.length; j++) {
        var c2 = DL.CARDS[j];
        if (used.indexOf(c2) >= 0) continue;
        if (!available(c2)) continue;
        pool.push(c2); weights.push(1); total += 1;
      }
    }
    if (pool.length === 0) return null;
    var r = Math.random() * total, acc = 0;
    for (var k = 0; k < pool.length; k++) {
      acc += weights[k];
      if (r <= acc) return pool[k];
    }
    return pool[pool.length - 1];
  }

  DL.drawCards = function (kind) {
    var picks = [], used = [];
    if (DL.PL.hp <= 2 && kind === 'surge') {
      for (var i = 0; i < DL.CARDS.length; i++) {
        if (DL.CARDS[i].id === 'repair') { picks.push(DL.CARDS[i]); used.push(DL.CARDS[i]); break; }
      }
    }
    if (kind === 'layer') {
      while (picks.length < 3) {
        var c = pickOne(null, true, used);
        if (!c) break;
        picks.push(c); used.push(c);
      }
    } else {
      var cats = ['w', 'u', 'p'];
      for (var m = 0; m < cats.length && picks.length < 3; m++) {
        var c2 = pickOne(cats[m], false, used);
        if (c2) { picks.push(c2); used.push(c2); }
      }
      while (picks.length < 3) {
        var c3 = pickOne(null, false, used);
        if (!c3) break;
        picks.push(c3); used.push(c3);
      }
    }
    return picks;
  };

  DL.openCards = function (kind) {
    if (G.screen === 'cards') return;
    G.cards = DL.drawCards(kind);
    G.cardKind = kind;
    G.sel = 0;
    /* 每次抽卡都给一次免费重抽（技能树「备用方案/全频段/听海」再加） */
    G.rerollsLeft = Math.max(1, DL.PL.stats.rerolls || 0);
    for (var i = 0; i < G.cards.length; i++) DL.seen.card(G.cards[i].id);
    DL.audio.sfx.card();
    DL.ui.goto('cards');
  };

  DL.reroll = function () {
    if (!G.cards || G.rerollsLeft <= 0) return false;
    G.rerollsLeft--;
    G.cards = DL.drawCards(G.cardKind);
    G.sel = 0;
    for (var i = 0; i < G.cards.length; i++) DL.seen.card(G.cards[i].id);
    DL.audio.sfx.hover();
    return true;
  };

  DL.takeCard = function (idx) {
    var c = G.cards && G.cards[idx];
    if (!c) return;
    var lv = (G.runCards[c.id] || 0) + 1;
    if (!c.repeat) lv = Math.min(lv, c.max);
    G.runCards[c.id] = lv;

    var sv = DL.save.get();
    sv.cardsUsed[c.id] = (sv.cardsUsed[c.id] || 0) + 1;

    if (c.heal) { }
    var oldMax = DL.PL.stats.maxHp;
    DL.PL.stats = DL.recomputeStats();
    var newMax = DL.PL.stats.maxHp;
    DL.PL.hp = Math.min(newMax, DL.PL.hp + (c.heal || 0) + Math.max(0, newMax - oldMax));
    DL.PL.maxHp = newMax;
    DL.PL.dashCh = Math.max(DL.PL.dashCh, DL.PL.stats.dashCharges);

    G.cards = null;
    DL.audio.sfx.confirm();
    DL.ui.goto('play');
    resumeAfterCards();
  };

  function resumeAfterCards() {
    if (G.cardKind === 'layer') { DL.nextLayer(); return; }
    G.surgeState = 'idle';
    nextSurge();
  }

  /* ---------------- 主更新 ---------------- */
  DL.updatePlay = function (dt) {
    if (G.freeze > 0) {
      G.freeze -= dt;
      G.shake *= Math.exp(-8 * dt);
      G.flash = Math.max(0, G.flash - dt);
      return;
    }

    G.t += dt;
    G.runT += dt;
    G.shake *= Math.exp(-9 * dt);    if (G.shake < 0.05) G.shake = 0;
    G.shakeX = U.rnd(-1, 1) * G.shake;
    G.shakeY = U.rnd(-1, 1) * G.shake;
    G.flash = Math.max(0, G.flash - dt * 2.2);
    G.bannerT = Math.max(0, G.bannerT - dt);
    if (G.pingDark > 0) G.pingDark -= dt;
    G.pingCd = Math.max(0, G.pingCd - dt);

    /* 死亡流程 */
    if (G.deathT >= 0) {
      G.deathT += dt;
      DL.updateParticles(dt);
      DL.updateFloats(dt);
      if (G.deathT > 3.2) {
        G.deathT = -1;
        DL.ui.goto('summary');
      }
      return;
    }

    /* 焦点提示 */
    if (G.layer === 1 && G.runT < 40) {
      G.hintT += dt;
      if (G.hintT > 9 && G.hintIdx < 3) { G.hintIdx++; G.hintT = 0; }
    }

    /* 连击衰减 */
    if (G.comboT > 0) {
      G.comboT -= dt;
      if (G.comboT <= 0) {
        if (G.combo >= 3) {
          for (var i = 0; i < 12; i++) {
            G.parts.push(DL.mkPart(DL.S.W * 0.5, DL.S.H * 0.5, U.rnd(-90, 90), U.rnd(-40, 40), U.rnd(0.4, 0.8), C.gold, U.rnd(1, 2.4)));
          }
        }
        G.combo = 0; G.comboT = 0;
      }
    }

    DL.updatePlayer(dt);
    DL.updateBullets(dt);
    DL.updateEnemies(dt);
    DL.updateEBullets(dt);
    DL.updateOrbits(dt);
    DL.updateDrones(dt);
    DL.updateParticles(dt);
    DL.updateDrops(dt);
    DL.updateFloats(dt);

    /* 声呐自动扫描 */
    var period = DL.PL.stats.sonarPeriod;
    G.sonarT += dt;
    if (G.sonarT >= period) {
      G.sonarT = 0;
      DL.sonarPulse(false);
    }

    /* 环境 */
    updateHazards(dt);

    /* Boss */
    G.slowA = Math.max(0, (G.slowA || 0) - dt * 1.6);
    if (G.boss && !G.boss.dead) bossAI(G.boss, dt);

    /* 雾 */
    for (var f = G.fogs.length - 1; f >= 0; f--) {
      var fg = G.fogs[f];
      fg.life -= dt;
      if (fg.life <= 0) G.fogs.splice(f, 1);
    }

    /* 挤压 */
    if (G.shrinkTarget) {
      G.shrink = Math.min(G.shrinkTarget, G.shrink + 26 * dt);
    }

    /* 涌潮状态机 */
    updateSurge(dt);

    /* 强度值（音频与视觉共用） */
    var inten = Math.min(1, G.enemies.length / 12 + G.combo / 30 + (G.boss ? 0.5 : 0) + (1 - DL.PL.hp / DL.PL.maxHp) * 0.25);
    G.intensity = U.lerp(G.intensity, inten, 0.08);
    DL.audio.update(dt, G.intensity, !!G.boss);
    if (G.hitAudioT === undefined) G.hitAudioT = 0;
  };

  /* 炮茧的受击判定在 entities.js 的子弹循环里统一处理，这里不再重复 */
  function updateBossParts(dt) { }

  function updateHazards(dt) {
    var p = DL.PL;
    for (var i = 0; i < G.vents.length; i++) {
      var v = G.vents[i];
      v.cd -= dt;
      if (v.tele > 0) {
        v.tele -= dt;
        if (v.tele <= 0) { v.active = 0.8; v.cd = U.rnd(4.5, 7); DL.audio.sfx.hit(); G.shake = Math.max(G.shake, 2); }
      } else if (v.active > 0) {
        v.active -= dt;
        if (U.dist2(v.x, v.y, p.x, p.y) < (v.r + p.r) * (v.r + p.r)) DL.hurtPlayer(1, v.x, v.y);
        if (Math.random() < 0.4) DL.burst(v.x, v.y - 10, 1, '#ff9a5c', 120, 2.4, 0.5, -80);
      } else if (v.cd <= 0) {
        v.tele = 1.0;
      }
    }
    if (G.current) {
      var cu = G.current;
      cu.x += cu.dir * cu.speed * dt;
      if (cu.x > DL.S.W + 200) { cu.x = -200; cu.y = U.rnd(DL.S.H * 0.3, DL.S.H * 0.7); }
      if (cu.x < -200) { cu.x = DL.S.W + 200; cu.y = U.rnd(DL.S.H * 0.3, DL.S.H * 0.7); }
    }
  }

  function updateSurge(dt) {
    if (G.surgeState === 'run') {
      G.surgeT += dt;
      var prog = G.surgeT / Math.max(1, G.surgeDur);
      if (prog < 1) {
        var phase = prog < 0.15 ? 0 : (prog < 0.7 ? 1 : 2);
        G.spawnT -= dt;
        if (G.spawnT <= 0 && G.enemies.length < G.maxOn) {
          G.spawnT = phase === 0 ? 2.4 : (phase === 1 ? 2.8 : 1.2);
          spawnBatch();
        }
      } else {
        // 收尾：停止刷新，剩余敌人全体亮灯
        G.clearT = (G.clearT || 0) + dt;
        for (var q = 0; q < G.enemies.length; q++) G.enemies[q].glow = 1.6;
        // 兜底：超过 15 秒仍未清空，剩余敌人自行散开（不计分），保证涌潮一定结束
        if (G.clearT > 15) {
          for (var z = G.enemies.length - 1; z >= 0; z--) {
            var ez = G.enemies[z];
            DL.burst(ez.x, ez.y, 6, C.enemy, 90, 2, 0.5, -20);
            G.enemies.splice(z, 1);
          }
          G.clearT = 0;
          finishSurge();
          return;
        }
        if (G.enemies.length === 0) finishSurge();
      }
    } else if (G.surgeState === 'clear') {
      G.surgeT -= dt;
      if (G.surgeT <= 0) {
        G.surgeState = 'wait';
        if (G.surge >= T.layer.surges) {
          if (!G.boss && G.layerShiftT <= 0) startBoss();
        } else {
          DL.openCards('surge');
        }
      }
    } else if (G.surgeState === 'shift') {
      G.layerShiftT -= dt;
      if (G.layerShiftT <= 0) {
        if (G.bossClear) {
          G.bossClear = false;
          G.surgeState = 'wait';
          if (!G.endlessRun && G.layer >= 6) {
            G.cleared = true;
            DL.awardRun(true);
            DL.ui.goto('ending');
            return;
          }
          G.pendingLayer = G.layer + 1;
          DL.openCards('layer');
        }
      }
    }
  }

  function finishSurge() {
    if (G.surge >= T.layer.surges) {
      startBoss();
      return;
    }
    G.score += T.score.surgeBonus * G.layer;
    G.surgeState = 'clear';
    G.surgeT = 0.9;
    DL.audio.sfx.surge();
    for (var i = 0; i < G.enemies.length; i++) G.enemies[i].glow = 1.8;
  }

  DL.nextLayer = function () {
    var n = G.pendingLayer || (G.layer + 1);
    G.pendingLayer = null;
    startLayer(n);
    DL.ui.goto('play');
  };

  /* 一局结算：死亡与通关共用，保证任何结局都会入账 */
  DL.awardRun = function (cleared) {
    if (G.awarded) return G.salvageGain || 0;
    G.awarded = true;
    var sv = DL.save.get();
    sv.totalDives++;
    sv.totalKills += G.kills;
    if (G.depth > sv.bestDepth) sv.bestDepth = G.depth;
    if (G.score > sv.bestScore) sv.bestScore = G.score;
    var gained = Math.round(
      G.depth / T.salvage.depthDiv +
      G.kills * T.salvage.perKill +
      (G.layer - 1) * T.salvage.perBoss +
      Math.floor(G.depth / T.salvage.milestoneStep) * 20
    );
    if (cleared) {
      var bonus = Math.round((T.salvage.clearBase || 800) + G.layer * (T.salvage.clearLayer || 200));
      gained += bonus;
      G.clearBonus = bonus;
      sv.clears++;
      sv.endless = true;
    } else {
      G.clearBonus = 0;
    }
    G.salvageGain = gained;
    sv.salvage += gained;
    DL.save.flush();
    return gained;
  };

  /* 死亡 */
  DL.playerDie = function () {
    var p = DL.PL;
    p.alive = false;
    p.hp = 0;
    G.deathT = 0;
    G.shake = 26;
    G.freeze = 0.12;
    G.flash = 0.5;
    G.flashCol = '#ffffff';
    DL.audio.sfx.implode();
    DL.audio.silence(true);
    DL.burst(p.x, p.y, 60, '#ffffff', 420, 4, 1.4);
    G.rings.push({ x: p.x, y: p.y, r: 8, to: 320, life: 1.0, max: 1.0, color: '#ffffff', width: 4 });
    DL.awardRun(false);
  };

  /* 声呐脉冲 */
  DL.sonarPulse = function (active) {
    var S = DL.S;
    var maxR = Math.sqrt(S.W * S.W + S.H * S.H) * 1.05;
    G.rings.push({
      x: DL.PL.x, y: DL.PL.y, r: 12, to: maxR,
      life: T.sonar.sweepTime, max: T.sonar.sweepTime,
      color: C.self, width: active ? 2.6 : 1.4, sonar: true
    });
    G.ringT = 0;
    G.lastPulse = G.t;
    var p = DL.PL;
    for (var i = 0; i < G.enemies.length; i++) {
      var e = G.enemies[i];
      e.lastSweep = G.t;
      e.sweepDelay = U.dist(p.x, p.y, e.x, e.y) / maxR * T.sonar.sweepTime;
      if (active && DL.PL.stats.markTime > 0) e.markUntil = G.t + DL.PL.stats.markTime;
    }
  };

  /* ---------------- 输入：触屏按钮 ---------------- */
  DL.touchBtns = function () {
    if (!I.usingTouch) return null;
    var S = DL.S, s = S.ui;
    var r = 34 * s;
    return {
      dash: { x: S.W - r - 16 * s, y: S.H - r - 26 * s, r: r },
      ping: { x: S.W - r * 3 - 26 * s, y: S.H - r - 26 * s, r: r }
    };
  };

  DL.consumePlayClicks = function () {
    var btns = DL.touchBtns();
    if (!btns) return;
    var clicks = I.peekClicks ? I.peekClicks() : null;
    if (!clicks) return;
    for (var i = clicks.length - 1; i >= 0; i--) {
      var c = clicks[i];
      if (U.dist(c.x, c.y, btns.dash.x, btns.dash.y) < btns.dash.r + 10) {
        DL.PL.touchDash = true; clicks.splice(i, 1);
      } else if (U.dist(c.x, c.y, btns.ping.x, btns.ping.y) < btns.ping.r + 10) {
        DL.PL.touchPing = true; clicks.splice(i, 1);
      }
    }
  };

})();
