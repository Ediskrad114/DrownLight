/* ==========================================================================
   光溺 DROWNLIGHT · entities.js
   玩家 / 敌人 / 子弹 / 粒子 / 掉落 / 环绕物
   ========================================================================== */
window.DL = window.DL || {};
(function () {
  'use strict';

  var U = DL.U, T = DL.T, C = T.colors, I = DL.input, G = DL.G;

  /* ---------------- 玩家 ---------------- */
  var PL = {
    x: 0, y: 0, vx: 0, vy: 0, r: T.player.r,
    hp: 4, maxHp: 4, shield: 0,
    aim: -Math.PI / 2, aimV: 0,
    fireCd: 0, chargeN: 0, echoQ: [],
    dashCh: 1, dashCd: 0, dashT: 0, dashDirX: 0, dashDirY: 0,
    ifr: 0, hurtIfr: T.player.hurtIfr,
    shieldT: 0,
    stats: null,
    sym: 0, coatT: 0, coatDur: 0,
    trail: [], thrust: 0,
    alive: true,
    dashHeld: false, pingHeld: false,
    meltTrail: [],
    bladeCd: 0, bladeT: 0, bladeSweep: 0, leechN: 0, mineCd: 0
  };
  DL.PL = PL;

  DL.initPlayer = function () {
    var S = DL.S;
    PL.x = S.W * 0.5; PL.y = S.H * 0.62;
    PL.vx = PL.vy = 0;
    PL.aim = -Math.PI / 2;
    PL.fireCd = 0; PL.chargeN = 0; PL.echoQ = [];
    PL.dashT = 0; PL.dashCd = 0; PL.ifr = 0;
    PL.sym = 0; PL.coatT = 0;
    PL.trail = []; PL.meltTrail = [];
    PL.bladeCd = 0; PL.bladeT = 0; PL.bladeSweep = 0; PL.leechN = 0; PL.mineCd = 0;
    PL.alive = true;
    PL.stats = DL.recomputeStats();
    PL.maxHp = PL.stats.maxHp;
    PL.hp = PL.maxHp;
    PL.shield = PL.stats.shieldStart;
    PL.dashCh = PL.stats.dashCharges;
    PL.shieldT = 0;
  };

  DL.aimAngle = function () {
    var s = PL.stats;
    var auto = DL.save.get().settings.autoAim;
    var useAuto = I.usingTouch || (!I.locked && auto && (!I.hasPointer || I.pointerT > 3));
    if (!useAuto && I.hasPointer) {
      return Math.atan2(I.py - PL.y, I.px - PL.x);
    }
    var best = null, bd = 1e9;
    for (var i = 0; i < G.enemies.length; i++) {
      var e = G.enemies[i];
      if (e.dead) continue;
      var d = U.dist2(PL.x, PL.y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    if (G.boss && !G.boss.dead) {
      if (!G.boss.vulnerable && G.boss.parts && G.boss.parts.length) {
        for (var k = 0; k < G.boss.parts.length; k++) {
          var pt = G.boss.parts[k];
          if (pt.dead) continue;
          var dp = U.dist2(PL.x, PL.y, pt.x, pt.y);
          if (dp < bd) { bd = dp; best = pt; }
        }
      } else {
        var db = U.dist2(PL.x, PL.y, G.boss.x, G.boss.y);
        if (db < bd) { bd = db; best = G.boss; }
      }
    }
    if (best) return Math.atan2(best.y - PL.y, best.x - PL.x);
    return PL.aim;
  };

  DL.updatePlayer = function (dt) {
    if (!PL.alive) return;
    var s = PL.stats, S = DL.S;

    /* 瞄准：云台惯性 */
    var target = DL.aimAngle();
    var diff = U.angDiff(PL.aim, target);
    PL.aim += diff * Math.min(1, T.cone.lag * dt);
    if (PL.aim > Math.PI) PL.aim -= U.TAU;
    if (PL.aim < -Math.PI) PL.aim += U.TAU;
    PL.recoil = Math.max(0, (PL.recoil || 0) - dt * 8);
    I.pointerT += dt;

    /* 移动 */
    var mv = I.moveVec();
    var spd = T.player.move * s.moveMul * (PL.coatT > 0 ? (1 + s.coat * 0.13) : 1);
    /* 「眠」的减速场：贴得越近越拖不动 */
    if (G.slowA > 0) spd *= 1 - T.boss.slowField * G.slowA;
    if (PL.dashT > 0) {
      PL.dashT -= dt;
    } else {
      if (mv.mag > 0) {
        PL.vx += mv.x * T.player.accel * mv.mag * dt;
        PL.vy += mv.y * T.player.accel * mv.mag * dt;
      }
      var dampF = Math.exp(-T.player.damp * dt);
      PL.vx *= dampF; PL.vy *= dampF;
      var sp = Math.sqrt(PL.vx * PL.vx + PL.vy * PL.vy);
      if (sp > spd) { PL.vx = PL.vx / sp * spd; PL.vy = PL.vy / sp * spd; }
    }

    PL.x += PL.vx * dt;
    PL.y += PL.vy * dt;

    /* 边界：柔和阻力 */
    var pad = PL.r + 4;
    if (PL.x < pad) { PL.x = pad; PL.vx = Math.abs(PL.vx) * 0.25; }
    if (PL.x > S.W - pad) { PL.x = S.W - pad; PL.vx = -Math.abs(PL.vx) * 0.25; }
    if (PL.y < pad) { PL.y = pad; PL.vy = Math.abs(PL.vy) * 0.25; }
    if (PL.y > S.H - pad) { PL.y = S.H - pad; PL.vy = -Math.abs(PL.vy) * 0.25; }

    /* 推进尾迹 */
    PL.thrust = U.lerp(PL.thrust, Math.min(1, Math.sqrt(PL.vx * PL.vx + PL.vy * PL.vy) / spd), 0.12);

    /* 冲刺 */
    PL.dashCd = Math.max(0, PL.dashCd - dt);
    if (PL.dashCh < s.dashCharges && PL.dashCd <= 0) {
      PL.dashCd = s.dashCd;
      PL.dashCh++;
    }
    if (PL.dashT > 0) {
      PL.ifr = Math.max(PL.ifr, 0.02);
      if (s.melt && Math.random() < 0.6) {
        PL.meltTrail.push({ x: PL.x, y: PL.y, life: 1.5, max: 1.5, r: 22 });
      }
    }

    var conOpen = DL.console && DL.console.open;
    var wantDash = !conOpen && (DL.KB.down('dash') || PL.touchDash);
    if (wantDash && !PL.dashHeld) DL.doDash();
    PL.dashHeld = !!wantDash;
    PL.touchDash = false;

    /* ping */
    var wantPing = !conOpen && (DL.KB.down('ping') || PL.touchPing);
    if (wantPing && !PL.pingHeld) DL.doPing();
    PL.pingHeld = !!wantPing;
    PL.touchPing = false;

    /* 计时器 */
    PL.ifr = Math.max(0, PL.ifr - dt);
    PL.coatT = Math.max(0, PL.coatT - dt);
    if (s.shieldEvery > 0 && PL.shield < 2) {
      PL.shieldT += dt;
      if (PL.shieldT >= s.shieldEvery) { PL.shieldT = 0; PL.shield++; DL.audio.sfx.shield(); }
    }

    /* 射击（自动） */
    PL.fireCd -= dt;
    if (PL.fireCd <= 0) DL.firePlayer();

    /* 回响队列 */
    for (var i = PL.echoQ.length - 1; i >= 0; i--) {
      PL.echoQ[i].t -= dt;
      if (PL.echoQ[i].t <= 0) {
        var q = PL.echoQ[i];
        DL.emitShot(q.ang, q.scale, q.silent);
        PL.echoQ.splice(i, 1);
      }
    }

    /* 熔核轨迹 */
    for (var m = PL.meltTrail.length - 1; m >= 0; m--) {
      var mt = PL.meltTrail[m];
      mt.life -= dt;
      if (mt.life <= 0) { PL.meltTrail.splice(m, 1); continue; }
      for (var k = 0; k < G.enemies.length; k++) {
        var en = G.enemies[k];
        if (en.dead) continue;
        if (U.dist2(mt.x, mt.y, en.x, en.y) < (mt.r + en.r) * (mt.r + en.r)) {
          DL.damageEnemy(en, 26 * dt, mt.x, mt.y);
        }
      }
    }

    /* 光刃 / 灼环 / 光雷 */
    DL.updateBlade(dt);
    DL.updateMines(dt);
    if (s.auraR > 0) {
      var ar2 = s.auraR * s.auraR;
      for (var ai = 0; ai < G.enemies.length; ai++) {
        var ae = G.enemies[ai];
        if (ae.dead) continue;
        if (U.dist2(PL.x, PL.y, ae.x, ae.y) < ar2 + ae.r * ae.r) {
          DL.damageEnemy(ae, s.auraDmg * dt, ae.x, ae.y);
        }
      }
      if (G.boss && !G.boss.dead && U.dist2(PL.x, PL.y, G.boss.x, G.boss.y) < ar2) {
        DL.damageBoss(s.auraDmg * dt, G.boss.x, G.boss.y);
      }
    }
  };

  /* ---------------- 光刃 ---------------- */
  DL.updateBlade = function (dt) {
    var s = PL.stats;
    PL.bladeT = Math.max(0, PL.bladeT - dt);
    if (!s.blade) return;
    PL.bladeCd -= dt;
    if (PL.bladeCd > 0) return;
    PL.bladeCd = s.bladeCd;
    PL.bladeT = 0.26;
    PL.bladeSweep++;

    var half = s.bladeArc * 0.5;
    var reach = s.bladeR;
    var dmg = s.bladeDmg * (1 + s.closeDmg * 0.6);
    var sides = s.bladeTwin > 0 ? 2 : 1;

    for (var si = 0; si < sides; si++) {
      var center = PL.aim + (si === 1 ? Math.PI : 0);
      var mul = (si === 1 && s.bladeTwin === 1) ? 0.7 : 1;
      G.slashes.push({
        x: PL.x, y: PL.y, a: center, half: half, r: reach,
        t: 0, life: 0.3, back: si === 1
      });
      for (var i = 0; i < G.enemies.length; i++) {
        var e = G.enemies[i];
        if (e.dead) continue;
        if (U.dist(PL.x, PL.y, e.x, e.y) > reach + e.r) continue;
        if (Math.abs(U.angDiff(center, U.ang(PL.x, PL.y, e.x, e.y))) > half) continue;
        DL.damageEnemy(e, dmg * mul, e.x, e.y);
      }
      if (G.boss && !G.boss.dead) {
        var rr = G.boss.r * G.boss.hitScale;
        if (U.dist(PL.x, PL.y, G.boss.x, G.boss.y) <= reach + rr &&
            Math.abs(U.angDiff(center, U.ang(PL.x, PL.y, G.boss.x, G.boss.y))) <= half) {
          DL.damageBoss(dmg * mul, G.boss.x, G.boss.y);
        }
      }
      /* 刃尖火星：让"打到了"有反馈 */
      var tipA = center - half + Math.random() * half * 2;
      for (var q = 0; q < 4; q++) {
        var sa = tipA + U.rnd(-0.3, 0.3);
        G.parts.push(DL.mkPart(
          PL.x + Math.cos(sa) * reach * U.rnd(0.55, 1),
          PL.y + Math.sin(sa) * reach * U.rnd(0.55, 1),
          Math.cos(sa) * U.rnd(120, 320), Math.sin(sa) * U.rnd(120, 320),
          U.rnd(0.16, 0.3), C.self, U.rnd(1.4, 2.8)));
      }
    }
    DL.audio.sfx.blade();
  };

  /* ---------------- 光雷 ---------------- */
  DL.dropMine = function () {
    var s = PL.stats;
    if (!s.mineEvery) return;
    var max = s.mineEvery > 1 ? 6 : 4;
    if (G.mines.length >= max) G.mines.shift();
    G.mines.push({ x: PL.x, y: PL.y, t: 0, life: 9, r: 46, dmg: s.mineDmg });
  };

  DL.updateMines = function (dt) {
    for (var i = G.mines.length - 1; i >= 0; i--) {
      var m = G.mines[i];
      m.t += dt;
      m.life -= dt;
      var trig = m.life <= 0;
      if (!trig && m.t > 0.25) {
        for (var j = 0; j < G.enemies.length; j++) {
          var e = G.enemies[j];
          if (e.dead) continue;
          if (U.dist2(m.x, m.y, e.x, e.y) < (m.r + e.r) * (m.r + e.r)) { trig = true; break; }
        }
        if (!trig && G.boss && !G.boss.dead &&
            U.dist2(m.x, m.y, G.boss.x, G.boss.y) < (m.r + G.boss.r) * (m.r + G.boss.r)) trig = true;
      }
      if (!trig) continue;
      G.mines.splice(i, 1);
      G.rings.push({ x: m.x, y: m.y, r: 6, to: m.r, life: 0.28, max: 0.28, color: C.gold, width: 3 });
      DL.burst(m.x, m.y, 18, C.gold, 260, 3, 0.5);
      G.lights.push({ x: m.x, y: m.y, r: 180, life: 0.3, max: 0.3 });
      DL.audio.sfx.kill();
      for (var k = 0; k < G.enemies.length; k++) {
        var o = G.enemies[k];
        if (o.dead) continue;
        if (U.dist2(m.x, m.y, o.x, o.y) < (m.r + o.r) * (m.r + o.r)) DL.damageEnemy(o, m.dmg, m.x, m.y);
      }
      if (G.boss && !G.boss.dead &&
          U.dist2(m.x, m.y, G.boss.x, G.boss.y) < (m.r + G.boss.r) * (m.r + G.boss.r)) {
        DL.damageBoss(m.dmg, m.x, m.y);
      }
    }
  };

  DL.doDash = function () {
    var s = PL.stats;
    if (PL.dashCh <= 0) return;
    PL.dashCh--;
    if (PL.dashCd <= 0) PL.dashCd = s.dashCd;

    var mv = I.moveVec();
    var dx, dy;
    if (mv.mag > 0) { dx = mv.x; dy = mv.y; }
    else { dx = -Math.cos(PL.aim); dy = -Math.sin(PL.aim); }

    PL.vx = dx * (s.dashDist / T.player.dashTime);
    PL.vy = dy * (s.dashDist / T.player.dashTime);
    PL.dashT = T.player.dashTime;
    PL.ifr = Math.max(PL.ifr, s.dashIfr);
    G.shake = Math.max(G.shake, T.shake.dash);
    DL.audio.sfx.dash();
    if (s.mineEvery) DL.dropMine();
    for (var i = 0; i < 14; i++) {
      var a = Math.random() * U.TAU;
      G.parts.push(DL.mkPart(PL.x, PL.y, Math.cos(a) * U.rnd(40, 180), Math.sin(a) * U.rnd(40, 180), U.rnd(0.3, 0.6), C.self, U.rnd(1.2, 2.6)));
    }
  };

  DL.doPing = function () {
    if (G.pingCd > 0) return;
    var s = PL.stats;
    G.pingCd = s.pingCd;
    G.pingDark = T.sonar.pingDark;
    DL.audio.sfx.ping();
    G.shake = Math.max(G.shake, T.shake.ping);
    G.sonarT = 0;
    DL.sonarPulse(true);
  };

  /* ---------------- 射击 ---------------- */
  DL.firePlayer = function () {
    var s = PL.stats;
    PL.fireCd = T.player.fireCd * s.rateMul;

    var dmgMul = s.dmgMul;
    if (s.sym > 0) dmgMul *= (1 + PL.sym * 0.06);

    PL.chargeN++;
    var charged = s.chargeEvery > 0 && PL.chargeN % s.chargeEvery === 0;
    var ang = PL.aim;

    if (charged) {
      DL.emitShot(ang, s.chargeDmg * dmgMul / 1, true, 2.4);
    } else {
      DL.emitShot(ang, dmgMul, false);
    }

    if (s.rear > 0) {
      for (var r = 0; r < Math.min(s.rear, 2); r++) {
        var off = s.rear > 1 ? (r - 0.5) * 0.16 : 0;
        DL.emitShot(ang + Math.PI + off, dmgMul * 0.62, true);
      }
    }

    if (s.echo > 0) {
      PL.echoQ.push({ t: 0.12, ang: ang, scale: s.echoScale * dmgMul, silent: true });
    }

    DL.audio.sfx.shoot();
    PL.recoil = 1;
    PL.thrust = Math.min(1, PL.thrust + 0.1);
  };

  /* 一次齐射：n 发扇形 */
  DL.emitShot = function (ang, dmgMul, silent, sizeScale) {
    var s = PL.stats;
    var n = Math.max(1, Math.min(Math.round(s.count), 12));
    var spread = s.spread > 0.001 ? s.spread : 0.055;
    var total = 0;

    for (var i = 0; i < n; i++) {
      var off = n === 1 ? 0 : (i - (n - 1) / 2) * (spread / Math.max(1, n - 1)) * 2;
      var a = ang + off;
      var dmg = T.player.dmg * dmgMul * (s.crit > 0 && Math.random() < s.crit ? 2 : 1);
      DL.spawnBullet(PL.x + Math.cos(a) * 16, PL.y + Math.sin(a) * 16, a, dmg, {
        r: 3.2 * s.bulletR * (sizeScale || 1),
        spd: T.player.bspd * s.bspdMul * (sizeScale ? 0.82 : 1),
        pierce: s.pierce,
        homing: s.homing,
        split: s.split,
        big: !!sizeScale
      });
      total++;
    }
    if (total > 0) G.perf && (G.perf.lastShots = total);

    if (!silent && s.closeDmg > 0) { /* 近战加成在命中时结算 */ }
  };

  DL.spawnBullet = function (x, y, ang, dmg, o) {
    if (G.bullets.length > T.limits.pbullets) G.bullets.shift();
    var spd = (o && o.spd) || T.player.bspd;
    G.bullets.push({
      x: x, y: y,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      r: (o && o.r) || 3.2,
      dmg: dmg,
      pierce: (o && o.pierce) || 0,
      homing: (o && o.homing) || 0,
      split: (o && o.split) || 0,
      big: !!(o && o.big),
      ang: ang,
      life: 1.5,
      hit: []
    });
  };

  DL.updateBullets = function (dt) {
    var s = PL.stats;
    for (var i = G.bullets.length - 1; i >= 0; i--) {
      var b = G.bullets[i];
      b.life -= dt;

      if (b.homing > 0) {
        var tgt = null, bd = 1e9;
        for (var k = 0; k < G.enemies.length; k++) {
          var e = G.enemies[k];
          if (e.dead) continue;
          var d = U.dist2(b.x, b.y, e.x, e.y);
          if (d < bd) { bd = d; tgt = e; }
        }
        if (G.boss && !G.boss.dead) {
          if (!G.boss.vulnerable && G.boss.parts && G.boss.parts.length) {
            for (var pi = 0; pi < G.boss.parts.length; pi++) {
              var ppt = G.boss.parts[pi];
              if (ppt.dead) continue;
              var dp2 = U.dist2(b.x, b.y, ppt.x, ppt.y);
              if (dp2 < bd) { bd = dp2; tgt = ppt; }
            }
          } else {
            var db = U.dist2(b.x, b.y, G.boss.x, G.boss.y);
            if (db < bd) { bd = db; tgt = G.boss; }
          }
        }
        if (tgt && bd < 500 * 500) {
          var want = Math.atan2(tgt.y - b.y, tgt.x - b.x);
          var cur = Math.atan2(b.vy, b.vx);
          var diff = U.angDiff(cur, want);
          var nAng = cur + U.clamp(diff, -b.homing * dt, b.homing * dt);
          var sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
          b.vx = Math.cos(nAng) * sp; b.vy = Math.sin(nAng) * sp;
        }
      }

      b.x += b.vx * dt; b.y += b.vy * dt;
      b.ang = Math.atan2(b.vy, b.vx);

      if (b.life <= 0 || b.x < -60 || b.x > DL.S.W + 60 || b.y < -60 || b.y > DL.S.H + 60) {
        G.bullets.splice(i, 1);
        continue;
      }

      /* 命中敌人 */
      var removed = false;
      for (var j = 0; j < G.enemies.length; j++) {
        var en = G.enemies[j];
        if (en.dead) continue;
        if (b.hit.indexOf(en) >= 0) continue;
        var rr = en.r + b.r;
        if (U.dist2(b.x, b.y, en.x, en.y) < rr * rr) {
          var dmg = b.dmg;
          if (s.closeDmg > 0 && U.dist(PL.x, PL.y, en.x, en.y) < 220) dmg *= (1 + s.closeDmg);
          DL.damageEnemy(en, dmg, b.x, b.y);
          b.hit.push(en);
          if (b.pierce > 0) { b.pierce--; b.dmg *= 0.88; }
          else { removed = true; }
          if (b.split > 0) {
            for (var q = 0; q < b.split; q++) {
              var na = b.ang + (q - (b.split - 1) / 2) * 0.5;
              DL.spawnBullet(b.x, b.y, na, b.dmg * 0.4, { r: 2.4, spd: T.player.bspd * 0.75 });
            }
          }
          if (removed) break;
        }
      }
      if (removed) { G.bullets.splice(i, 1); continue; }

      /* 命中 Boss */
      if (G.boss && !G.boss.dead) {
        var bs = G.boss;
        var hitPart = null;
        if (bs.parts && bs.parts.length) {
          for (var pp = 0; pp < bs.parts.length; pp++) {
            var ptt = bs.parts[pp];
            if (ptt.dead) continue;
            var rr3 = ptt.r + b.r;
            if (U.dist2(b.x, b.y, ptt.x, ptt.y) < rr3 * rr3) { hitPart = ptt; break; }
          }
        }
        if (hitPart) {
          hitPart.hp -= b.dmg;
          hitPart.flash = 0.08;
          if (G.parts) { }
          DL.burst(b.x, b.y, 3, '#57e0ff', 120, 2, 0.3);
          if (hitPart.hp <= 0) {
            hitPart.dead = true;
            DL.burst(hitPart.x, hitPart.y, 26, bs.color, 300, 3.4, 0.8);
            G.shake = 8;
            DL.audio.sfx.elite();
            G.score += 300;
          }
          if (b.pierce > 0) { b.pierce--; } else { G.bullets.splice(i, 1); }
          continue;
        }
        var rr2 = bs.r * bs.hitScale + b.r;
        if (U.dist2(b.x, b.y, bs.x, bs.y) < rr2 * rr2) {
          var dmg2 = b.dmg;
          if (s.closeDmg > 0 && U.dist(PL.x, PL.y, bs.x, bs.y) < 220) dmg2 *= (1 + s.closeDmg);
          DL.damageBoss(dmg2, b.x, b.y);
          if (b.pierce > 0) { b.pierce--; } else { G.bullets.splice(i, 1); }
        }
      }
    }
  };

  /* ---------------- 粒子 ---------------- */
  DL.mkPart = function (x, y, vx, vy, life, color, r, glow) {
    return { x: x, y: y, vx: vx, vy: vy, life: life, max: life, color: color, r: r, glow: glow !== false };
  };

  DL.burst = function (x, y, n, color, spd, size, life, up) {
    n = Math.round(n * (G.perf.grade >= 1 ? 0.5 : 1));
    for (var i = 0; i < n; i++) {
      var a = Math.random() * U.TAU;
      var s = U.rnd(spd * 0.25, spd);
      G.parts.push(DL.mkPart(x, y, Math.cos(a) * s, Math.sin(a) * s + (up || 0), U.rnd(life * 0.5, life), color, U.rnd(size * 0.4, size)));
    }
    if (G.parts.length > T.limits.parts) G.parts.splice(0, G.parts.length - T.limits.parts);
  };

  DL.updateParticles = function (dt) {
    for (var i = G.parts.length - 1; i >= 0; i--) {
      var p = G.parts[i];
      p.life -= dt;
      if (p.life <= 0) { G.parts.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      var dm = Math.exp(-2.2 * dt);
      p.vx *= dm; p.vy *= dm;
      p.vy -= 6 * dt;
    }
    for (var j = G.rings.length - 1; j >= 0; j--) {
      var r = G.rings[j];
      r.life -= dt;
      if (r.life <= 0) G.rings.splice(j, 1);
    }
    for (var si = G.slashes.length - 1; si >= 0; si--) {
      var sl = G.slashes[si];
      sl.t += dt;
      if (sl.t >= sl.life) G.slashes.splice(si, 1);
    }
    if (G.lights) {
      for (var k = G.lights.length - 1; k >= 0; k--) {
        var L = G.lights[k];
        L.life -= dt;
        if (L.life <= 0) G.lights.splice(k, 1);
      }
    }
  };

  /* ---------------- 飘字 ---------------- */
  DL.addFloat = function (x, y, text, color, size) {
    G.floats.push({ x: x, y: y, text: text, color: color || C.gold, life: 0.9, max: 0.9, size: size || 14 });
    if (G.floats.length > 40) G.floats.shift();
  };

  DL.updateFloats = function (dt) {
    for (var i = G.floats.length - 1; i >= 0; i--) {
      var f = G.floats[i];
      f.life -= dt;
      f.y -= 28 * dt;
      if (f.life <= 0) G.floats.splice(i, 1);
    }
  };

  /* ---------------- 掉落 ---------------- */
  DL.spawnDrop = function (x, y, kind) {
    if (G.drops.length > T.limits.drops) G.drops.shift();
    G.drops.push({ x: x, y: y, vx: U.rnd(-30, 30), vy: U.rnd(-30, 30), kind: kind, t: 0, life: T.drops.life, r: 9 });
  };

  DL.updateDrops = function (dt) {
    var s = PL.stats;
    for (var i = G.drops.length - 1; i >= 0; i--) {
      var d = G.drops[i];
      d.t += dt; d.life -= dt;
      if (d.life <= 0) { G.drops.splice(i, 1); continue; }

      var dd = U.dist(d.x, d.y, PL.x, PL.y);
      var magR = s.magnet * (s.magnetMul || 1);
      if (dd < magR) {
        var a = Math.atan2(PL.y - d.y, PL.x - d.x);
        var pull = 620 * (1 - dd / magR) + 120;
        d.vx += Math.cos(a) * pull * dt * 3;
        d.vy += Math.sin(a) * pull * dt * 3;
      }
      d.x += d.vx * dt; d.y += d.vy * dt;
      d.vx *= Math.exp(-2.4 * dt); d.vy *= Math.exp(-2.4 * dt);

      if (dd < PL.r + d.r + 4) {
        DL.pickup(d);
        G.drops.splice(i, 1);
      }
    }
  };

  DL.pickup = function (d) {
    if (d.kind === 'repair') {
      PL.hp = Math.min(PL.maxHp, PL.hp + 1);
      DL.audio.sfx.pickup();
      DL.addFloat(d.x, d.y, '+1 船体', C.self, 13);
      DL.burst(d.x, d.y, 10, C.self, 120, 2.4, 0.5);
    } else if (d.kind === 'neon') {
      PL.dashCh = PL.stats.dashCharges;
      PL.dashCd = 0;
      G.pingCd = 0;
      DL.audio.sfx.pickup();
      DL.addFloat(d.x, d.y, '氖核', '#b06bff', 13);
      DL.burst(d.x, d.y, 14, '#b06bff', 160, 2.6, 0.5);
    } else if (d.kind === 'cyst') {
      DL.audio.sfx.card();
      G.cysts++;
      DL.openCards('surge');
    }
  };

  /* ---------------- 敌人 ---------------- */
  DL.spawnEnemy = function (type, x, y, opt) {
    if (G.enemies.length >= T.limits.enemies) return null;
    var def = DL.ETYPE[type];
    if (!def) return null;
    var sc = DL.enemyScale();
    var e = {
      type: type,
      x: x, y: y, vx: 0, vy: 0,
      r: def.r,
      hp: def.hp * sc.hp * (opt && opt.hpMul || 1),
      maxHp: def.hp * sc.hp * (opt && opt.hpMul || 1),
      spd: (def.spd || 0) * sc.spd,
      spd2: (def.spd2 || def.spd || 0) * sc.spd,
      dashSpd: (def.dash || 900) * sc.spd,
      dmg: def.dmg,
      score: def.score,
      elite: !!def.elite,
      t: U.rnd(0, 10),
      ang: U.rnd(0, U.TAU),
      tele: 0, state: 'idle', stT: 0,
      fireCd: (def.fireCd || 2) * U.rnd(0.7, 1.2),
      flash: 0, dead: false,
      glow: 1,
      phase: U.rnd(0, U.TAU),
      orbR: 0, orbA: 0,
      dark: 0,
      kind: type
    };
    if (type === 'hatchet') {
      e.orbR = U.rnd(200, 280);
      e.orbA = U.rnd(0, U.TAU);
    }
    if (type === 'worm') {
      e.x = x; e.y = y;
      e.fireCd = U.rnd(0.6, 1.6);
    }
    G.enemies.push(e);
    return e;
  };

  DL.enemyScaleSmooth = function () { };

  function steer(e, tx, ty, rate, spd) {
    var a = Math.atan2(ty - e.y, tx - e.x);
    var wantVx = Math.cos(a) * spd, wantVy = Math.sin(a) * spd;
    var k = Math.min(1, rate);
    e.vx += (wantVx - e.vx) * k;
    e.vy += (wantVy - e.vy) * k;
  }

  DL.updateEnemies = function (dt) {
    var S = DL.S;
    for (var i = G.enemies.length - 1; i >= 0; i--) {
      var e = G.enemies[i];
      if (e.dead) { G.enemies.splice(i, 1); continue; }
      e.t += dt;
      e.flash = Math.max(0, e.flash - dt);
      e.tele = Math.max(0, e.tele - dt);

      switch (e.type) {
        case 'lantern': {
          var cycle = e.t % 1.6;
          var lit = cycle < 0.6;
          e.lit = lit;
          var sp = lit ? e.spd2 : e.spd;
          steer(e, PL.x, PL.y, 1.7 * dt, sp);
          e.angle = Math.atan2(e.vy, e.vx);
          break;
        }
        case 'jelly': {
          steer(e, PL.x, PL.y, 0.7 * dt, e.spd);
          e.fireCd -= dt;
          if (e.fireCd <= 0 && e.tele <= 0) { e.tele = 0.5; e.willAim = Math.random() < 0.5; }
          if (e.tele > 0 && e.tele <= dt + 0.001) {
            DL.jellyFire(e);
            e.fireCd = 2.4 * (0.85 + Math.random() * 0.3) / DL.enemyScale().dens;
          }
          break;
        }
        case 'squid': {
          if (e.state === 'idle') {
            var d = U.dist(e.x, e.y, PL.x, PL.y);
            if (d > 340) steer(e, PL.x, PL.y, 1.6 * dt, e.spd);
            else {
              var a = Math.atan2(PL.y - e.y, PL.x - e.x) + Math.PI / 2;
              e.vx += Math.cos(a) * e.spd * 2 * dt;
              e.vy += Math.sin(a) * e.spd * 2 * dt;
              e.vx *= Math.exp(-1.5 * dt); e.vy *= Math.exp(-1.5 * dt);
            }
            e.stT -= dt;
            if (e.stT <= 0) { e.state = 'charge'; e.stT = 0.7; e.tele = 0.7; }
          } else if (e.state === 'charge') {
            e.vx *= Math.exp(-6 * dt); e.vy *= Math.exp(-6 * dt);
            e.stT -= dt;
            e.ang = Math.atan2(PL.y - e.y, PL.x - e.x);
            if (e.stT <= 0) {
              e.state = 'dash'; e.stT = 0.35;
              e.vx = Math.cos(e.ang) * e.dashSpd; e.vy = Math.sin(e.ang) * e.dashSpd;
              DL.audio.sfx.dash();
            }
          } else if (e.state === 'dash') {
            e.stT -= dt;
            if (e.stT <= 0) { e.state = 'rest'; e.stT = 0.9; }
          } else {
            e.vx *= Math.exp(-3 * dt); e.vy *= Math.exp(-3 * dt);
            e.stT -= dt;
            if (e.stT <= 0) { e.state = 'idle'; e.stT = U.rnd(1.2, 2.0); }
          }
          e.angle = Math.atan2(e.vy, e.vx);
          break;
        }
        case 'worm': {
          e.stT -= dt;
          if (e.stT <= 0) {
            if (e.hidden) { e.hidden = false; e.stT = 6.0; }
            else { e.hidden = true; e.stT = 1.5; }
          }
          if (!e.hidden) {
            e.fireCd -= dt;
            if (e.fireCd <= 0) { e.tele = 0.45; e.fireCd = 1.8 / DL.enemyScale().dens; }
            if (e.tele > 0 && e.tele <= dt + 0.001) { DL.wormFire(e); }
          }
          e.vx = e.vy = 0;
          break;
        }
        case 'hatchet': {
          e.orbA += dt * 1.35;
          var orbR = e.orbR - Math.sin(G.t * 0.9) * 46;
          var tx = PL.x + Math.cos(e.orbA + e.phase) * orbR;
          var ty = PL.y + Math.sin(e.orbA + e.phase) * orbR;
          steer(e, tx, ty, 2.4 * dt, e.spd);
          e.angle = Math.atan2(e.vy, e.vx);
          break;
        }
        case 'angler': {
          steer(e, PL.x, PL.y, 0.8 * dt, e.spd);
          e.angle = Math.atan2(e.vy, e.vx);
          e.fireCd -= dt;
          if (e.fireCd <= 0) {
            if (!e.mode || e.mode === 'pull') { e.mode = 'pull'; e.tele = 0.5; e.stT = 1.6; }
            else { e.mode = 'decoy'; e.tele = 0.3; e.stT = 2.0; }
            e.fireCd = 4;
          }
          if (e.mode === 'pull') {
            e.stT -= dt;
            if (e.tele <= 0) {
              var dd = U.dist(e.x, e.y, PL.x, PL.y);
              if (dd < 420) {
                var aa = Math.atan2(e.y - PL.y, e.x - PL.x);
                PL.vx += Math.cos(aa) * 260 * dt * (1 - dd / 500);
                PL.vy += Math.sin(aa) * 260 * dt * (1 - dd / 500);
              }
            }
            if (e.stT <= 0) e.mode = 'decoy';
          } else if (e.mode === 'decoy') {
            e.stT -= dt;
            if (e.tele <= 0 && e.stT > 0 && !e._dop) {
              e._dop = true;
              DL.spawnDecoy(e.x, e.y);
            }
            if (e.stT <= 0) { e.mode = 'idle'; e._dop = false; e.fireCd = U.rnd(2.5, 4); }
          }
          break;
        }
        case 'swarm': {
          /* 磷虾：不走直线，绕着玩家做布朗漂移，贴脸就炸 */
          e.phase += dt * 3.1;
          var sa = Math.atan2(PL.y - e.y, PL.x - e.x) + Math.sin(e.phase) * 0.9;
          steer(e, e.x + Math.cos(sa) * 60, e.y + Math.sin(sa) * 60, 3.2 * dt, e.spd);
          e.angle = Math.atan2(e.vy, e.vx);
          break;
        }
        case 'veil': {
          /* 帷幕：合拢时减伤且缓慢逼近，展开时停顿并三连射 */
          e.cycle = (e.cycle === undefined) ? U.rnd(0, 1) : e.cycle;
          e.cycle += dt;
          var period = 5.0;
          var ph = e.cycle % period;
          e.open = ph > period - 1.5;          // 最后 1.5s 展开
          if (e.open) {
            e.vx *= Math.exp(-4 * dt); e.vy *= Math.exp(-4 * dt);
            e.tele = Math.max(0, e.tele);
            e.fireCd -= dt;
            if (e.fireCd <= 0) {
              e.fireCd = 1.1;
              var va = Math.atan2(PL.y - e.y, PL.x - e.x);
              for (var vi = -1; vi <= 1; vi++) {
                DL.spawnEBullet(e.x, e.y, va + vi * 0.16, 260 * DL.enemyScale().bspd, 6);
              }
              DL.audio.sfx.hit();
            }
          } else {
            steer(e, PL.x, PL.y, 0.8 * dt, e.spd);
            e.fireCd = 0.35;
          }
          e.angle = Math.atan2(PL.y - e.y, PL.x - e.x);
          break;
        }
        case 'decoy': {
          var da = Math.atan2(PL.y - e.y, PL.x - e.x);
          e.vx += Math.cos(da) * 60 * dt;
          e.vy += Math.sin(da) * 60 * dt;
          e.vx *= Math.exp(-1.2 * dt); e.vy *= Math.exp(-1.2 * dt);
          e.stT -= dt;
          if (e.stT <= 0) {
            DL.explodeAt(e.x, e.y, 62, 1);
            e.dead = true;
          }
          break;
        }
      }

      if (e.type !== 'worm') {
        /* 迟滞场：范围内的敌人整体变慢 */
        var slowK = 1;
        var sf = PL.stats.slowField;
        if (sf > 0) {
          var sfR = sf === 1 ? 180 : 240;
          if (U.dist2(e.x, e.y, PL.x, PL.y) < sfR * sfR) slowK = sf === 1 ? 0.82 : 0.72;
        }
        e.x += e.vx * dt * slowK; e.y += e.vy * dt * slowK;
      }

      /* 见过就解锁图鉴（只有真正进入视野才算） */
      if (!e.seenNote && DL.visOf(e.x, e.y) > 0.25) {
        e.seenNote = true;
        if (DL.seen) DL.seen.enemy(e.type);
      }

      /* 边界：拉回场内 */
      var m = 12;
      if (e.x < -m) e.x = -m; if (e.x > S.W + m) e.x = S.W + m;
      if (e.y < -m) e.y = -m; if (e.y > S.H + m) e.y = S.H + m;

      /* 接触伤害 */
      if (e.dmg > 0 && PL.alive) {
        var rr = e.r + PL.r;
        if (U.dist2(e.x, e.y, PL.x, PL.y) < rr * rr) {
          DL.hurtPlayer(1, e.x, e.y);
          if (e.type !== 'angler' && e.type !== 'decoy') {
            var ka = Math.atan2(e.y - PL.y, e.x - PL.x);
            e.vx += Math.cos(ka) * 220; e.vy += Math.sin(ka) * 220;
            DL.damageEnemy(e, 6, PL.x, PL.y);
          }
        }
      }

      /* 敌人之间轻推 */
      for (var j = i - 1; j >= 0; j--) {
        var o = G.enemies[j];
        if (o.dead) continue;
        var dx = o.x - e.x, dy = o.y - e.y;
        var d2 = dx * dx + dy * dy;
        var mr = (e.r + o.r) * 0.82;
        if (d2 < mr * mr && d2 > 0.01) {
          var d = Math.sqrt(d2);
          var push = (mr - d) / d * 0.5;
          e.x -= dx * push * 0.5; e.y -= dy * push * 0.5;
          o.x += dx * push * 0.5; o.y += dy * push * 0.5;
        }
      }

      if (!Number.isFinite(e.x) || !Number.isFinite(e.y)) {
        e.x = U.rnd(60, S.W - 60); e.y = U.rnd(60, S.H - 60);
        e.vx = 0; e.vy = 0;
      }
    }
  };

  DL.spawnDecoy = function (x, y) {
    var n = 0;
    for (var i = 0; i < G.enemies.length; i++) if (G.enemies[i].type === 'decoy') n++;
    if (n >= T.sonar.maxDecoy) return;
    G.enemies.push({
      type: 'decoy', x: x + U.rnd(-40, 40), y: y, vx: 0, vy: 0, r: 9,
      hp: 1, maxHp: 1, spd: 60, dmg: 1, score: 0, elite: false,
      t: 0, ang: 0, tele: 0, state: 'idle', stT: 3.0, fireCd: 0,
      flash: 0, dead: false, glow: 0.55, phase: 0, decoy: true
    });
  };

  DL.jellyFire = function (e) {
    var sc = DL.enemyScale();
    if (e.willAim) {
      var base = Math.atan2(PL.y - e.y, PL.x - e.x);
      for (var i = -1; i <= 1; i++) {
        DL.spawnEBullet(e.x, e.y, base + i * 0.22, 280 * sc.bspd, 6);
      }
    } else {
      var n = 6;
      var off = Math.random() * U.TAU;
      for (var k = 0; k < n; k++) DL.spawnEBullet(e.x, e.y, off + k * U.TAU / n, 180 * sc.bspd, 6);
    }
    DL.audio.sfx.hit();
  };

  DL.wormFire = function (e) {
    var sc = DL.enemyScale();
    var a = Math.atan2(PL.y - e.y, PL.x - e.x);
    for (var i = -1; i <= 1; i++) {
      DL.spawnEBullet(e.x, e.y, a + i * 0.16, 200 * sc.bspd, 6, 1.2);
    }
  };

  DL.spawnEBullet = function (x, y, ang, spd, r, homing, dmg) {
    if (G.ebullets.length > T.limits.ebullets) G.ebullets.shift();
    G.ebullets.push({
      x: x, y: y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
      r: r || 6, dmg: dmg || 1, life: 6, homing: homing || 0, ang: ang
    });
  };

  /* 腐蚀粘液：慢速追踪弹，绕一个圈撒出去（「锈」用） */
  DL.spawnSludge = function (x, y, n) {
    n = n || 3;
    var base = Math.random() * U.TAU;
    for (var i = 0; i < n; i++) {
      var a = base + i * U.TAU / n;
      DL.spawnEBullet(x + Math.cos(a) * 24, y + Math.sin(a) * 24, a, 76, 5, 0.9);
      var eb = G.ebullets[G.ebullets.length - 1];
      if (eb) { eb.col = '#d08a54'; eb.life = 7.5; }
    }
  };

  DL.updateEBullets = function (dt) {
    for (var i = G.ebullets.length - 1; i >= 0; i--) {
      var b = G.ebullets[i];
      b.life -= dt;
      if (b.homing > 0) {
        var want = Math.atan2(PL.y - b.y, PL.x - b.x);
        var cur = Math.atan2(b.vy, b.vx);
        var d = U.angDiff(cur, want);
        var na = cur + U.clamp(d, -b.homing * dt, b.homing * dt);
        var sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
        b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp;
      }
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.life <= 0 || b.x < -40 || b.x > DL.S.W + 40 || b.y < -40 || b.y > DL.S.H + 40) {
        G.ebullets.splice(i, 1); continue;
      }
      if (PL.alive) {
        var rr = b.r + PL.r;
        if (U.dist2(b.x, b.y, PL.x, PL.y) < rr * rr) {
          DL.hurtPlayer(b.dmg, b.x, b.y);
          G.ebullets.splice(i, 1);
        }
      }
    }
  };

  DL.explodeAt = function (x, y, r, dmg) {
    DL.burst(x, y, 22, C.enemy, 300, 3.2, 0.6);
    G.rings.push({ x: x, y: y, r: 6, to: r, life: 0.35, max: 0.35, color: C.enemy, width: 3 });
    if (PL.alive && U.dist(x, y, PL.x, PL.y) < r + PL.r) DL.hurtPlayer(dmg || 1, x, y);
  };

  /* ---------------- 环绕物与无人机 ---------------- */
  DL.updateOrbits = function (dt) {
    var s = PL.stats;
    if (s.orbit <= 0) return;
    var n = s.orbit, R = 74;
    for (var i = 0; i < n; i++) {
      var a = G.t * 2.2 + i * U.TAU / n;
      var ox = PL.x + Math.cos(a) * R;
      var oy = PL.y + Math.sin(a) * R;
      for (var j = 0; j < G.enemies.length; j++) {
        var e = G.enemies[j];
        if (e.dead) continue;
        if (U.dist2(ox, oy, e.x, e.y) < (e.r + 12) * (e.r + 12)) {
          DL.damageEnemy(e, 34 * dt * (1 + s.dmgMul * 0.4), ox, oy);
        }
      }
      if (G.boss && !G.boss.dead) {
        var rr = G.boss.r * G.boss.hitScale + 12;
        if (U.dist2(ox, oy, G.boss.x, G.boss.y) < rr * rr) DL.damageBoss(34 * dt * (1 + s.dmgMul * 0.4), ox, oy);
      }
    }
  };

  DL.updateDrones = function (dt) {
    var s = PL.stats;
    if (s.drone <= 0) return;
    if (!G.droneT) G.droneT = 0;
    G.droneT -= dt;
    if (G.droneT > 0) return;
    G.droneT = s.droneRate || 0.5;
    for (var i = 0; i < s.drone; i++) {
      var a = -G.t * 1.6 + i * Math.PI;
      var dx = PL.x + Math.cos(a) * 58;
      var dy = PL.y + Math.sin(a) * 58;
      var tgt = null, bd = 1e9;
      for (var j = 0; j < G.enemies.length; j++) {
        var e = G.enemies[j];
        if (e.dead) continue;
        var d = U.dist2(dx, dy, e.x, e.y);
        if (d < bd) { bd = d; tgt = e; }
      }
      if (!tgt && G.boss && !G.boss.dead) tgt = G.boss;
      if (tgt) {
        var ang = Math.atan2(tgt.y - dy, tgt.x - dx);
        DL.spawnBullet(dx, dy, ang, 9, { r: 2.6, spd: 760 * (s.droneSpd || 1) });
        G.parts.push(DL.mkPart(dx, dy, -Math.cos(a) * 60, -Math.sin(a) * 60, 0.18, C.self, 1.6));
      }
    }
  };

  /* ---------------- 受伤 ---------------- */
  DL.hurtPlayer = function (dmg, sx, sy) {
    if (G.god) return;
    if (!PL.alive || PL.ifr > 0) return;
    if (PL.shield > 0) {
      PL.shield--;
      PL.ifr = 0.7;
      G.shake = Math.max(G.shake, 6);
      DL.audio.sfx.shield();
      DL.burst(PL.x, PL.y, 16, C.self, 220, 2.6, 0.5);
      return;
    }
    PL.hp -= 1;
    PL.sym = 0;
    PL.ifr = T.player.hurtIfr + (DL.meta.ifrHurt || 0);
    PL.coatT = PL.stats.coat > 0 ? (PL.stats.coat === 1 ? 1.2 : PL.stats.coat === 2 ? 1.8 : 1.8) : 0;
    G.shake = Math.max(G.shake, T.shake.hit);
    G.freeze = Math.max(G.freeze, T.hitstop.hurt);
    G.flash = T.fx.flashHurt;
    G.flashCol = '#ff3b5c';
    G.combo = 0;
    G.comboT = 0;
    DL.audio.sfx.hurt();
    DL.burst(PL.x, PL.y, 24, '#ff5c7a', 300, 3.2, 0.7);
    if (PL.hp <= 0) DL.playerDie();
  };

  DL.damageEnemy = function (e, dmg, bx, by) {
    if (e.dead) return;
    /* 帷幕合拢时外层甲壳吸收大部分伤害 */
    if (e.type === 'veil' && !e.open) dmg *= 0.45;
    e.hp -= dmg;
    e.flash = 0.06;
    if (Math.random() < 0.5 && G.parts.length < 380) {
      G.parts.push(DL.mkPart(bx || e.x, by || e.y, U.rnd(-60, 60), U.rnd(-60, 60), 0.22, C.white, U.rnd(0.8, 1.8)));
    }
    if (e.hp <= 0) DL.killEnemy(e);
  };

  DL.killEnemy = function (e) {
    if (e.dead) return;
    e.dead = true;
    var s = PL.stats;

    if (s.sym > 0) PL.sym = Math.min(10, PL.sym + 1);

    if (e.score > 0) DL.addKill(e.x, e.y, e.score, e.elite);

    DL.burst(e.x, e.y, e.elite ? 40 : 12, C.enemy, e.elite ? 380 : 220, e.elite ? 4.5 : 2.8, e.elite ? 0.9 : 0.55, -30);
    DL.burst(e.x, e.y, 6, C.gold, 120, 2.2, 0.5, -60);

    if (G.lights) {
      G.lights.push({ x: e.x, y: e.y, r: s.killLightR * (e.elite ? 1.4 : 0.75), life: s.killLightT * (e.elite ? 1.6 : 0.9), max: s.killLightT });
    }

    if (s.detonate > 0) {
      var dr = 48, dd = T.player.dmg * s.detonateScale;
      DL.burst(e.x, e.y, 10, C.gold, 260, 3, 0.4);
      G.rings.push({ x: e.x, y: e.y, r: 4, to: dr, life: 0.24, max: 0.24, color: C.gold, width: 2 });
      for (var i = 0; i < G.enemies.length; i++) {
        var o = G.enemies[i];
        if (o.dead || o === e) continue;
        if (U.dist2(e.x, e.y, o.x, o.y) < dr * dr) DL.damageEnemy(o, dd, o.x, o.y);
      }
    }

    /* 汲取：每 N 次击杀回 1 格 */
    if (s.leech > 0) {
      PL.leechN++;
      if (PL.leechN >= s.leech) {
        PL.leechN = 0;
        if (PL.hp < PL.maxHp) {
          PL.hp++;
          DL.addFloat(PL.x, PL.y - 28, '+1 船体', C.self, 12);
          DL.burst(PL.x, PL.y, 12, C.self, 160, 2.2, 0.5);
        }
      }
    }

    /* 掉落 */
    var r = Math.random();
    var rep = T.drops.repair + s.dropBonus;
    if (r < rep) DL.spawnDrop(e.x, e.y, 'repair');
    else if (r < rep + T.drops.neon + (s.dropNeon || 0)) DL.spawnDrop(e.x, e.y, 'neon');
    else if (G.cysts < T.drops.cystPerLayer && Math.random() < (e.elite ? T.drops.cystElite : T.drops.cyst)) DL.spawnDrop(e.x, e.y, 'cyst');

    G.shake = Math.max(G.shake, e.elite ? T.shake.elite : T.shake.kill);
    G.freeze = Math.max(G.freeze, e.elite ? T.hitstop.elite : T.hitstop.kill);
    if (e.elite) DL.audio.sfx.elite(); else DL.audio.sfx.kill();

    if (e.type === 'angler') {
      DL.spawnEnemy('lantern', e.x + 30, e.y);
      DL.spawnEnemy('lantern', e.x - 30, e.y);
    }
  };

})();
