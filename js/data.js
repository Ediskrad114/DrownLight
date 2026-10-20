/* ==========================================================================
   光溺 DROWNLIGHT · data.js
   第 0 节：所有可调数值、敌型、卡牌、Boss、编队、技能树的唯一所在地。
   其余文件不允许出现魔法数字。
   ========================================================================== */
window.DL = window.DL || {};
(function () {
  'use strict';

  var D = Math.PI / 180;

  /* ---------------- 调参表 ---------------- */
  var T = {
    minW: 960, minH: 540, maxDPR: 2,
    /* 逻辑步长：120Hz，配合高刷屏；所有数值都是按秒计的，改这个不影响手感 */
    step: 1 / 120,

    player: {
      r: 12,
      hp: 4,
      dmg: 10,
      fireCd: 0.135,
      bspd: 980,
      move: 320,
      accel: 4200,
      damp: 14,
      dashDist: 144,
      dashTime: 0.12,
      dashCd: 1.1,
      dashIfr: 0.2,
      hurtIfr: 1.4,
      buff: 0.15
    },

    cone: { len: 420, ang: 62 * D, lag: 10 },

    near: 260,          // 近距弱光半径
    dark: 0.45,         // 锥外压暗系数
    farFade: 26,        // 距离淡出过渡带

    sonar: {
      period: 2.4,
      sweepTime: 0.9,
      pingCd: 4,
      pingDark: 0.8,
      blipFade: 3.0,
      decoyFade: 1.6,
      maxDecoy: 2,
      markTime: 0,
      revealT: 1.5
    },

    killLight: { r: 260, t: 0.25 },

    combo: { per: 0.15, cap: 6, window: 2.6 },

    depth: { perLayer: 600, mult: 0.001 },

    layer: { surges: 3 },

    /* Boss 池：每局随机抽 perRun 个，按 rank 排序后依次排在第 1~6 层。
       rankHp 是「该威胁等级在第 n 层应有的血量」，Boss 用自己的 hp/rankHp[rank] 折算。
       无尽模式：每多打一轮（6 层）血量乘 cycleHp，轮内每层再乘 layerHp。 */
    boss: {
      perRun: 6,
      rankHp: [0, 800, 1300, 1800, 2050, 2950, 3800],
      cycleHp: 1.55,
      layerHp: 1.055,
      slowField: 0.45       /* 「眠」的减速场最多把移速压到 55% */
    },

    surge: {
      quota: [18, 22, 26, 30, 34, 38],
      onscreen: [10, 13, 16, 19, 22, 25],
      idleGap: 0.35
    },

    scale: {
      hp: 1.22,
      spd: 1.035,
      spdCap: 1.35,
      dens: 1.05,
      bspd: 1.02,
      bspdCap: 1.12,
      layerBulletDensity: 1.05
    },

    drops: {
      repair: 0.04,
      neon: 0.08,
      cyst: 0.012,
      cystElite: 0.25,
      cystPerLayer: 2,
      magnet: 200,
      life: 22
    },

    score: {
      lantern: 10, hatchet: 12, squid: 25, jelly: 35, worm: 50, angler: 150, boss: 1500,
      surgeBonus: 200, layerBonus: 800, clearBonus: 50000
    },

    salvage: { depthDiv: 10, perKill: 1, perBoss: 60, milestone: 100, milestoneStep: 500, clearBase: 900, clearLayer: 220 },

    limits: {
      parts: 520, pbullets: 90, ebullets: 220, enemies: 28, drops: 12,
      maxDmgMul: 8, maxRateMul: 1 / 2.2
    },

    /* 渲染预算：超过这个像素数就降采样，避免大窗口下填率爆炸 */
    perf: { maxPixels: 4000000 },

    /* 默认按键（可在设置里改，存档覆盖） */
    keys: {
      up: ['KeyW', 'ArrowUp'],
      down: ['KeyS', 'ArrowDown'],
      left: ['KeyA', 'ArrowLeft'],
      right: ['KeyD', 'ArrowRight'],
      dash: ['Space', 'ShiftLeft', 'ShiftRight'],
      ping: ['KeyQ'],
      bag: ['KeyB', 'Tab'],
      pause: ['Escape', 'KeyP'],
      mute: ['KeyM'],
      fullscreen: ['KeyF']
    },
    keyNames: {
      up: '上', down: '下', left: '左', right: '右',
      dash: '冲刺', ping: '主动声呐', bag: '背包',
      pause: '暂停', mute: '静音', fullscreen: '全屏'
    },

    shake: { hit: 12, dash: 3, ping: 2, kill: 1.5, elite: 6, boss: 18, layer: 5 },

    hitstop: { kill: 0.03, elite: 0.08, boss: 0.25, hurt: 0.06 },

    fx: { flashHurt: 0.12, flashBoss: 0.45, slowBoss: 0.4 },

    colors: {
      bg0: '#03101a', bg1: '#07242b', bg2: '#01060b',
      self: '#3ef0c8', enemy: '#ff4fa3', gold: '#ffce5c',
      boss: '#6a3cff', white: '#eafcff', decoy: '#9a6f92',
      ink: '#04080f', dim: 'rgba(160,200,220,0.55)'
    }
  };

  /* ---------------- 稀有度 ---------------- */
  var RARITY = {
    c: { name: '普通', col: '#3ef0c8', w1: 68, w2: 55, w3: 42 },
    r: { name: '稀有', col: '#ffce5c', w1: 30, w2: 38, w3: 45 },
    l: { name: '传说', col: '#6a3cff', w1: 2, w2: 7, w3: 13 }
  };

  /* ---------------- 敌型 ---------------- */
  var ETYPE = {
    lantern: { name: '灯笼鱼', r: 15, hp: 10, spd: 40, spd2: 98, dmg: 1, score: 10, first: 1, elite: false,
      desc: '头顶一盏诱饵灯。灯亮起时它会突然加速扑来——那也是它唯一会暴露自己的时刻。' },
    jelly: { name: '水母', r: 18, hp: 30, spd: 26, dmg: 1, score: 35, first: 1, elite: false, fireCd: 2.4,
      desc: '慢速漂移，停顿时蓄力：一半概率打出瞄准三连，一半概率环形散射。' },
    squid: { name: '乌贼', r: 14, hp: 20, spd: 46, dash: 620, dmg: 1, score: 25, first: 2, elite: false,
      desc: '保持距离绕圈游动，蓄力 0.7 秒后直线冲锋，撞上会被击退。' },
    worm: { name: '管虫', r: 16, hp: 50, spd: 0, dmg: 0, score: 50, first: 3, elite: false, fireCd: 1.8,
      desc: '固定炮台。每 6 秒缩回管内 1.5 秒，缩回时打不到它。' },
    hatchet: { name: '斧头鱼', r: 10, hp: 8, spd: 124, dmg: 1, score: 12, first: 4, elite: false,
      desc: '贴着玩家高速绕圈，杀伤力低，但会持续消耗你的注意力。' },
    angler: { name: '鮟鱇', r: 34, hp: 140, spd: 42, dmg: 2, score: 150, first: 5, elite: true,
      desc: '精英。先把你吸向它，再放出假诱饵；诱饵贴近后会爆炸。' },
    swarm: { name: '磷虾群', r: 9, hp: 7, spd: 168, dmg: 1, score: 8, first: 3, elite: false,
      desc: '成群高速漂移，路线飘忽，一发就能打碎，但被围住会瞬间掉血。' },
    veil: { name: '帷幕', r: 24, hp: 95, spd: 30, dmg: 1, score: 95, first: 4, elite: false, fireCd: 3.2,
      desc: '合拢时外层甲壳减伤 55%，缓慢逼近；展开 1.5 秒露出三只眼并打出三连射。' }
  };

  /* ---------------- 编队模板 ---------------- */
  var FORMATIONS = [
    { id: 'pure', minLayer: 1, w: 3, list: [['lantern', 8]] },
    { id: 'pincer', minLayer: 1, w: 3, list: [['lantern', 6], ['jelly', 1]] },
    { id: 'hunt', minLayer: 2, w: 2.2, list: [['lantern', 4], ['squid', 1]] },
    { id: 'grid', minLayer: 3, w: 2, list: [['jelly', 2], ['worm', 2]] },
    { id: 'school', minLayer: 4, w: 2, list: [['hatchet', 7]] },
    { id: 'press', minLayer: 5, w: 1.6, list: [['angler', 1], ['jelly', 2]] },
    { id: 'mix', minLayer: 2, w: 1.8, list: [['lantern', 3], ['hatchet', 3], ['squid', 1]] },
    { id: 'krill', minLayer: 3, w: 2.2, list: [['swarm', 9]] },
    { id: 'curtain', minLayer: 4, w: 1.7, list: [['veil', 2], ['lantern', 3]] },
    { id: 'storm', minLayer: 5, w: 1.5, list: [['swarm', 7], ['squid', 2], ['veil', 1]] }
  ];

  /* ---------------- 基础属性（每次重算） ---------------- */
  function baseStats() {
    return {
      dmgMul: 1, rateMul: 1, bspdMul: 1, moveMul: 1,
      maxHp: T.player.hp,
      count: 1, spread: 0,
      pierce: 0, homing: 0, split: 0, detonate: 0, detonateScale: 0.45,
      orbit: 0, chargeEvery: 0, chargeDmg: 0,
      echo: 0, echoScale: 0.5, rear: 0,
      coneLen: T.cone.len, coneAng: T.cone.ang,
      killLightR: T.killLight.r, killLightT: T.killLight.t,
      nearR: T.near,
      pingCd: T.sonar.pingCd, sonarPeriod: T.sonar.period, markTime: 0,
      dashCd: T.player.dashCd, dashIfr: T.player.dashIfr, dashDist: T.player.dashDist,
      dashCharges: 1,
      shieldEvery: 0, shieldStart: 0,
      magnet: T.drops.magnet,
      comboWin: T.combo.window,
      dropBonus: 0, crit: 0, closeDmg: 0, deepBonus: 0,
      coat: 0, sym: 0, drone: 0, melt: 0, eye: 0,
      rerolls: 0,
      bulletR: 1,

      /* 近战：光刃（身前弧形横扫） */
      blade: 0, bladeR: 104, bladeDmg: 30, bladeCd: 0.58, bladeArc: 100 * D, bladeTwin: 0,
      /* 灼环：贴身持续伤害 */
      auraR: 0, auraDmg: 0,
      /* 光雷：后撤时布设 */
      mineEvery: 0, mineDmg: 0,
      /* 迟滞场：减速周围敌人 */
      slowField: 0,
      /* 暴击倍率 / 击杀回血 / 拾取半径 */
      critPow: 2, leech: 0, magnetMul: 1, dropNeon: 0,
      droneRate: 0.5, droneSpd: 1,

      /* 运行时用的计数（不进属性重算，但放这里统一初始化） */
      bladeT: 0
    };
  }

  /* ---------------- 卡牌池 ----------------
     cat: w 武器 / u 辅助 / p 被动 / l 传说
     tags: 抽卡权重用的流派标签 —— 同类卡拿得越多，后续越容易抽到同流派
     apply(s, lv) 只叠加「该等级」的增量，重算时逐级调用。            */
  var CARDS = [
    /* ==== 武器改造 · 射击 ==== */
    { id: 'twin', name: '双联', cat: 'w', rar: 'c', max: 3, icon: 'twin', tags: ['shot'],
      desc: ['平行发射 2 发，单发 70%', '平行发射 3 发，单发 64%', '平行发射 4 发，单发 58%'],
      apply: function (s, l) { s.count += 1; s.dmgMul *= (l === 1 ? 0.70 : l === 2 ? 0.92 : 0.90); } },

    { id: 'fan', name: '扇面', cat: 'w', rar: 'c', max: 3, icon: 'fan', tags: ['shot'],
      desc: ['额外 +2 发，扇形 ±12°', '额外 +1 发，扇形 +3°', '额外 +1 发，扇形 +3°'],
      apply: function (s, l) { s.count += (l === 1 ? 2 : 1); s.spread += (l === 1 ? 12 : 3) * D; s.dmgMul *= 0.84; } },

    { id: 'pierce', name: '贯穿', cat: 'w', rar: 'c', max: 3, icon: 'pierce', tags: ['shot'],
      desc: ['穿透 1 个敌人，伤害 −12%', '穿透 2 个敌人', '穿透 3 个敌人'],
      apply: function (s) { s.pierce += 1; s.dmgMul *= 0.92; } },

    { id: 'refract', name: '折射', cat: 'w', rar: 'r', max: 3, icon: 'refract', tags: ['shot', 'boom'],
      desc: ['命中后分裂 1 道次级光（40%）', '分裂 2 道', '分裂 3 道'],
      apply: function (s) { s.split += 1; } },

    { id: 'homing', name: '追踪', cat: 'w', rar: 'r', max: 3, icon: 'homing', tags: ['shot'],
      desc: ['转向 2.5 rad/s', '转向 4.5 rad/s', '转向 7 rad/s'],
      apply: function (s, l) { s.homing += [2.5, 2.0, 2.5][l - 1]; } },

    { id: 'charge', name: '蓄能', cat: 'w', rar: 'r', max: 3, icon: 'charge', tags: ['shot', 'crit'],
      desc: ['每 5 发追加重矛（320%）', '每 4 发追加重矛（380%）', '每 3 发追加重矛（450%）'],
      apply: function (s, l) { s.chargeEvery = [5, 4, 3][l - 1]; s.chargeDmg = [3.2, 3.8, 4.5][l - 1]; } },

    { id: 'echo', name: '回响', cat: 'w', rar: 'r', max: 3, icon: 'echo', tags: ['shot'],
      desc: ['0.12s 后复制射击（50%）', '复制（65%）', '复制（80%）'],
      apply: function (s, l) { s.echo += 1; s.echoScale = [0.5, 0.65, 0.8][l - 1]; } },

    { id: 'boom', name: '光爆', cat: 'w', rar: 'r', max: 3, icon: 'boom', tags: ['shot', 'boom'],
      desc: ['击杀爆光 48px（45%）', '爆光（65%）', '爆光（85%）'],
      apply: function (s, l) { s.detonate += 1; s.detonateScale = [0.45, 0.65, 0.85][l - 1]; } },

    { id: 'rear', name: '后射', cat: 'w', rar: 'c', max: 3, icon: 'rear', tags: ['shot'],
      desc: ['背后发射 1 发（60%）', '背后发射 2 发', '背后发射 2 发（75%）'],
      apply: function (s, l) { s.rear += (l === 2 ? 2 : 1); s.dmgMul *= 0.94; } },

    { id: 'caliber', name: '口径', cat: 'w', rar: 'c', max: 3, icon: 'caliber', tags: ['shot'],
      desc: ['光束更粗，伤害 +9%', '再粗，伤害 +9%', '再粗，伤害 +9%'],
      apply: function (s) { s.bulletR = Math.min(2.2, s.bulletR + 0.18); s.dmgMul *= 1.09; } },

    /* ==== 武器改造 · 近战 ==== */
    { id: 'blade', name: '光刃', cat: 'w', rar: 'r', max: 3, icon: 'blade', tags: ['melee'],
      desc: ['身前凝聚光刃，每 0.58s 横扫 100°（30）', '刃长 +12，伤害 42', '刃长再 +12，伤害 56'],
      apply: function (s, l) {
        s.blade = l;
        s.bladeR = 104 + (l - 1) * 12;
        s.bladeDmg = [30, 42, 56][l - 1];
      } },

    { id: 'bladeLong', name: '长刃', cat: 'w', rar: 'c', max: 3, icon: 'bladeLong', tags: ['melee'], need: ['blade'],
      desc: ['光刃半径 +22，伤害 +8', '再 +22 / +8', '再 +22 / +8'],
      apply: function (s) { s.bladeR += 22; s.bladeDmg += 8; } },

    { id: 'bladeTwin', name: '双刃', cat: 'w', rar: 'r', max: 2, icon: 'bladeTwin', tags: ['melee'], need: ['blade'],
      desc: ['身后也横扫一道（70%）', '身后刀锋补正到 100%'],
      apply: function (s, l) { s.bladeTwin = l; } },

    { id: 'bladeDance', name: '刃舞', cat: 'w', rar: 'r', max: 2, icon: 'bladeDance', tags: ['melee'], need: ['blade'],
      desc: ['横扫间隔 −25%，角度 +30°', '间隔再 −25%，角度再 +30°'],
      apply: function (s) { s.bladeCd *= 0.75; s.bladeArc = Math.min(260 * D, s.bladeArc + 30 * D); } },

    { id: 'orbit', name: '环刃', cat: 'w', rar: 'c', max: 3, icon: 'orbit', tags: ['melee'],
      desc: ['1 把环绕光刃', '2 把环绕光刃', '3 把环绕光刃'],
      apply: function (s) { s.orbit += 1; } },

    /* ==== 辅助系统 ==== */
    { id: 'dblDash', name: '双冲', cat: 'u', rar: 'r', max: 3, icon: 'dblDash', tags: ['mobility'],
      desc: ['冲刺充能 2 次', '冲刺冷却 −10%', '冲刺充能 3 次'],
      apply: function (s, l) { if (l === 1) s.dashCharges = 2; if (l === 2) s.dashCd *= 0.9; if (l === 3) s.dashCharges = 3; } },

    { id: 'longIfr', name: '长无敌', cat: 'u', rar: 'c', max: 3, icon: 'longIfr', tags: ['guts'],
      desc: ['冲刺无敌 +0.08s', '+0.12s', '+0.16s'],
      apply: function (s, l) { s.dashIfr += [0.08, 0.04, 0.04][l - 1]; } },

    { id: 'sonarArr', name: '声呐阵列', cat: 'u', rar: 'c', max: 3, icon: 'sonarArr', tags: ['sonar'],
      desc: ['ping 冷却 −0.8s', '−1.5s', '−2.2s'],
      apply: function (s, l) { s.pingCd -= [0.8, 0.7, 0.7][l - 1]; } },

    { id: 'markSonar', name: '标记声呐', cat: 'u', rar: 'r', max: 3, icon: 'markSonar', tags: ['sonar'],
      desc: ['被扫到的敌人标记 2s', '标记 3s', '标记 4s'],
      apply: function (s, l) { s.markTime = [2, 3, 4][l - 1]; } },

    { id: 'wideCone', name: '广角灯', cat: 'u', rar: 'c', max: 3, icon: 'wideCone', tags: ['light'],
      desc: ['灯锥张角 +8°', '+14°', '+20°'],
      apply: function (s, l) { s.coneAng += [8, 6, 6][l - 1] * D; } },

    { id: 'longCone', name: '长距灯', cat: 'u', rar: 'c', max: 3, icon: 'longCone', tags: ['light'],
      desc: ['灯锥长度 +70px', '+130px', '+190px'],
      apply: function (s, l) { s.coneLen += [70, 60, 60][l - 1]; } },

    { id: 'killLit', name: '光域', cat: 'u', rar: 'c', max: 3, icon: 'killLit', tags: ['light', 'boom'],
      desc: ['击杀照明 +100px', '照明再扩，时长 +0.12s', '照明再扩'],
      apply: function (s) { s.killLightR += 100; s.killLightT += 0.12; } },

    { id: 'sense', name: '感知', cat: 'u', rar: 'c', max: 3, icon: 'sense', tags: ['light'],
      desc: ['近距弱光 +60px', '+110px', '+160px'],
      apply: function (s, l) { s.nearR += [60, 50, 50][l - 1]; } },

    { id: 'shieldGen', name: '护盾发生器', cat: 'u', rar: 'r', max: 3, icon: 'shieldGen', tags: ['guts'],
      desc: ['每 26s 生成 1 层护盾', '每 22s', '每 18s'],
      apply: function (s, l) { s.shieldEvery = [26, 22, 18][l - 1]; } },

    { id: 'repair', name: '应急维修', cat: 'u', rar: 'c', max: 99, icon: 'repair', repeat: true, tags: ['guts'],
      desc: ['立即修复 2 格船体', '立即修复 2 格船体', '立即修复 2 格船体'],
      heal: 2,
      apply: function () { } },

    { id: 'droneUp', name: '无人机强化', cat: 'u', rar: 'r', max: 2, icon: 'drone', tags: ['shot'],
      desc: ['补 1 台无人机，射速 0.42s', '再补 1 台，弹速 +25%'],
      apply: function (s, l) { s.drone += 1; s.droneRate = l === 1 ? 0.42 : 0.36; if (l === 2) s.droneSpd = 1.25; } },

    { id: 'mine', name: '光雷', cat: 'u', rar: 'r', max: 2, icon: 'mine', tags: ['boom', 'mobility'],
      desc: ['冲刺后原地留一颗光雷（60）', '光雷伤害 +60，上限 6 颗'],
      apply: function (s, l) { s.mineEvery = l; s.mineDmg = 60 + (l - 1) * 60; } },

    { id: 'magnet', name: '磁力回收', cat: 'u', rar: 'c', max: 2, icon: 'magnet', tags: ['guts'],
      desc: ['拾取半径 +90px', '再 +120px'],
      apply: function (s, l) { s.magnetMul += 0.45; } },

    /* ==== 被动强化 ==== */
    { id: 'dmg', name: '增伤', cat: 'p', rar: 'c', max: 3, icon: 'dmg', tags: ['shot'],
      desc: ['伤害 +12%', '+24%', '+36%'],
      apply: function (s) { s.dmgMul *= 1.12; } },

    { id: 'rate', name: '射速', cat: 'p', rar: 'c', max: 3, icon: 'rate', tags: ['shot'],
      desc: ['射击间隔 −10%', '−18%', '−26%'],
      apply: function (s) { s.rateMul *= 0.90; } },

    { id: 'speed', name: '航速', cat: 'p', rar: 'c', max: 3, icon: 'speed', tags: ['mobility'],
      desc: ['移速 +7%', '+13%', '+19%'],
      apply: function (s) { s.moveMul *= 1.07; } },

    { id: 'hull', name: '加固船体', cat: 'p', rar: 'r', max: 3, icon: 'hull', tags: ['guts'],
      desc: ['最大船体 +1', '最大船体 +1', '最大船体 +2'],
      heal: 1,
      apply: function (s, l) { s.maxHp += (l === 3 ? 2 : 1); } },

    { id: 'combo', name: '连击', cat: 'p', rar: 'c', max: 3, icon: 'combo', tags: ['crit'],
      desc: ['断连时间 +40%', '+70%', '+100%'],
      apply: function (s) { s.comboWin *= 1.4; } },

    { id: 'loot', name: '掠夺', cat: 'p', rar: 'c', max: 3, icon: 'loot', tags: ['guts'],
      desc: ['修复包掉落 +4%', '+7%', '+10%'],
      apply: function (s) { s.dropBonus += 0.04; } },

    { id: 'crit', name: '暴击', cat: 'p', rar: 'r', max: 3, icon: 'crit', tags: ['crit', 'shot'],
      desc: ['8% 概率双倍伤害', '16%', '24%'],
      apply: function (s) { s.crit += 0.08; } },

    { id: 'critPow', name: '锐利', cat: 'p', rar: 'r', max: 2, icon: 'critPow', tags: ['crit'], need: ['crit'],
      desc: ['暴击伤害 ×2.5', '暴击伤害 ×3'],
      apply: function (s, l) { s.critPow = [2.5, 3][l - 1]; } },

    { id: 'close', name: '近战强化', cat: 'p', rar: 'c', max: 3, icon: 'close', tags: ['melee'],
      desc: ['近距伤害 +20%', '+35%', '+50%'],
      apply: function (s) { s.closeDmg += 0.20; } },

    { id: 'deep', name: '深潜者', cat: 'p', rar: 'c', max: 3, icon: 'deep', tags: ['guts'],
      desc: ['深度倍率 +15%', '+28%', '+40%'],
      apply: function (s) { s.deepBonus += 0.15; } },

    { id: 'coat', name: '光学镀膜', cat: 'p', rar: 'r', max: 3, icon: 'coat', tags: ['mobility', 'guts'],
      desc: ['受击后 1.2s 移速 +30%', '时长 1.8s', '移速 +45%'],
      apply: function (s, l) { s.coat = l; } },

    { id: 'aura', name: '灼环', cat: 'p', rar: 'r', max: 3, icon: 'aura', tags: ['melee'],
      desc: ['身周 86px 持续灼烧（14/s）', '范围 +26px', '伤害 +14/s'],
      apply: function (s, l) {
        s.auraR = l === 1 ? 86 : s.auraR + 26;
        s.auraDmg = l === 1 ? 14 : s.auraDmg + 14;
      } },

    { id: 'slowField', name: '迟滞场', cat: 'p', rar: 'r', max: 2, icon: 'slow', tags: ['sonar'],
      desc: ['周围 180px 敌人减速 18%', '范围 240px，减速 28%'],
      apply: function (s, l) { s.slowField = l === 1 ? 1 : 2; } },

    /* ==== 传说 ==== */
    { id: 'sym', name: '生物荧光共生', cat: 'l', rar: 'l', max: 1, icon: 'sym', tags: ['shot', 'crit'],
      desc: ['每击杀使下次射击 +6%，可叠 10 层；受击清零'],
      apply: function (s) { s.sym = 1; } },

    { id: 'drone', name: '伴航无人机', cat: 'l', rar: 'l', max: 1, icon: 'drone', tags: ['shot'],
      desc: ['2 台无人机环绕，自动索敌，射速 0.5s'],
      apply: function (s) { s.drone = 2; } },

    { id: 'echoRoom', name: '回声室', cat: 'l', rar: 'l', max: 1, icon: 'echoRoom', tags: ['shot'],
      desc: ['子弹体积 +40%、穿透 +1、弹速 +25%'],
      apply: function (s) { s.bulletR = 1.4; s.pierce += 1; s.bspdMul *= 1.25; } },

    { id: 'melt', name: '熔核', cat: 'l', rar: 'l', max: 1, icon: 'melt', tags: ['mobility', 'melee'],
      desc: ['冲刺沿途留下 1.5s 灼烧轨迹'],
      apply: function (s) { s.melt = 1; } },

    { id: 'eye', name: '深渊之眼', cat: 'l', rar: 'l', max: 1, icon: 'eye', tags: ['light'],
      desc: ['灯锥消失，改为 360° 半径 210px 环形光晕'],
      apply: function (s) { s.eye = 1; } },

    { id: 'leech', name: '汲取', cat: 'l', rar: 'l', max: 1, icon: 'leech', tags: ['guts', 'melee'],
      desc: ['每 12 次击杀修复 1 格船体'],
      apply: function (s) { s.leech = 12; } }
  ];

  /* ---------------- Boss ----------------
     12 个 Boss 组成 Boss 池。每一局只随机抽取 T.boss.perRun（=6）个，
     按 rank（威胁等级）从低到高排在第 1~6 层；无尽模式每多打一轮重新抽一批。
     rank 只影响血量基准，不影响机制。 */
  var BOSSES = [
    {
      id: 'ying', name: '荧', sub: '巨型水母', rank: 1,
      r: 90, hp: 800, dur: 16,
      phases: [0.5],
      tips: '环形弹幕 · 触手横扫',
      color: '#ff7ab8',
      desc: '巨型水母。伞盖下悬着六条触手，会周期性向四周泼洒环形弹幕；血量过半后弹幕密度翻倍。'
    },
    {
      id: 'xiu', name: '锈', sub: '寄生沉船', rank: 1,
      r: 66, hp: 850, dur: 15,
      phases: [0.5],
      tips: '冲撞预警 · 腐蚀粘液',
      color: '#c9835a',
      desc: '寄生在沉船残骸上的锈蚀体。它先亮起腹部裂口，随后笔直撞过来，留下一路会追人的腐蚀粘液；撞到边界会硬直一会儿。'
    },
    {
      id: 'mo', name: '墨', sub: '大王乌贼', rank: 2,
      r: 78, hp: 1300, dur: 20,
      phases: [0.5],
      tips: '墨汁遮挡视野 · 触手横扫',
      color: '#8a5cff',
      desc: '大王乌贼。喷出墨云遮蔽视野，八条腕足横扫；它移动时会把你从藏身处推出去。'
    },
    {
      id: 'chao', name: '潮', sub: '潮汐母体', rank: 2,
      r: 82, hp: 1320, dur: 18,
      phases: [0.55],
      tips: '留缺口的环 · 潮汐群',
      color: '#48f0d0',
      desc: '潮汐母体。它把水推成一圈闭环的浪墙，只在某个方向留一道缺口，而缺口每次都会转向；血量过半后浪墙更密、缺口更窄。'
    },
    {
      id: 'deng', name: '灯', sub: '鮟鱇王', rank: 3,
      r: 84, hp: 1800, dur: 24,
      phases: [0.55, 0.25],
      tips: '假光点 · 吸入 · 咬合',
      color: '#ffb347',
      desc: '鮟鱇王。用假光点诱导你靠近，张口吸入，随后咬合；灯笼本身就是它最脆弱的地方。'
    },
    {
      id: 'mian', name: '眠', sub: '梦魇水母', rank: 3,
      r: 80, hp: 1700, dur: 22,
      phases: [0.5],
      tips: '催眠雾 · 减速场 · 幻影',
      color: '#9fd8ff',
      desc: '梦魇水母。它不追你，只是把整片水域变成梦：雾一层层吞掉视野，推进器越来越拖不动，暗处还会浮出你的影子。'
    },
    {
      id: 'mirror', name: '镜', sub: '镜像体', rank: 3,
      r: 72, hp: 1750, dur: 22,
      phases: [0.5],
      tips: '三重镜像 · 只打本体',
      color: '#a9f0ff',
      desc: '镜像体。它把自己分成三个一模一样的形体，只有本体吃伤害，被打碎的假身会散成光；声呐能分辨谁在真正移动。'
    },
    {
      id: 'qun', name: '群', sub: '管虫珊瑚', rank: 4,
      r: 70, hp: 2000, dur: 26,
      phases: [0.5],
      tips: '部位拆解 · 边缘炮茧',
      color: '#57e0ff',
      desc: '管虫珊瑚。四角炮茧持续压制，本体在炮茧存活时减伤 20%；拆掉炮茧会进入长时间硬直。'
    },
    {
      id: 'whale', name: '鲸', sub: '骸骨鲸', rank: 4,
      r: 124, hp: 2150, dur: 24, hitScale: 1.05,
      phases: [0.5],
      tips: '横穿战场 · 眼部弱点',
      color: '#cfd8ff',
      desc: '骸骨鲸。它在战场上缓慢横穿，骨缝里漏出蓝光；只有颅骨上那只转动的眼睛是弱点，其余骨面几乎不吃伤害。被它撞到不会有任何提示音。'
    },
    {
      id: 'crystal', name: '晶', sub: '结晶海葵', rank: 5,
      r: 74, hp: 2900, dur: 28,
      phases: [0.5],
      tips: '晶簇公转 · 旋涡弹幕',
      color: '#7cf0ff',
      desc: '结晶海葵。六枚晶簇绕着本体公转，一边转一边把水绞成旋涡；敲碎晶簇会让它短暂停摆，但晶簇会重新长回来。'
    },
    {
      id: 'yuan', name: '渊', sub: '热泉巨蠕虫', rank: 5,
      r: 76, hp: 3000, dur: 28,
      phases: [0.5],
      tips: '引燃热泉 · 分裂',
      color: '#ff8a5c',
      desc: '热泉巨蠕虫。点燃场地热泉，血量过半后分裂出子体；体节越多，横扫范围越大。'
    },
    {
      id: 'guangni', name: '光溺', sub: '终末体', rank: 6,
      r: 96, hp: 3800, dur: 34,
      phases: [0.62, 0.3],
      tips: '深渊挤压 · 感官剥夺',
      color: '#b06bff',
      desc: '终末体。把战场一点点压缩，并周期性剥夺你的灯光；竖瞳睁开时是它唯一的弱点窗口。'
    }
  ];

  /* ---------------- 技能树 ---------------- */
  var TREE_ARMS = [
    { id: 'optics', name: '光学', ang: -Math.PI / 2 },
    { id: 'sonar', name: '声呐', ang: -Math.PI / 6 },
    { id: 'combat', name: '战斗', ang: Math.PI / 6 },
    { id: 'struct', name: '结构', ang: Math.PI / 2 },
    { id: 'power', name: '动力', ang: Math.PI * 5 / 6 },
    { id: 'harvest', name: '采集', ang: -Math.PI * 5 / 6 }
  ];

  var TREE_NODES = [
    /* 光学 */
    { arm: 'optics', i: 0, name: '灯锥校准', cost: 60, desc: '灯锥长度 +8px', eff: { coneLen: 8 } },
    { arm: 'optics', i: 1, name: '广角透镜', cost: 110, desc: '灯锥角度 +2°', eff: { coneAng: 2 } },
    { arm: 'optics', i: 2, name: '聚光管', cost: 180, desc: '灯锥长度 +8px', eff: { coneLen: 8 } },
    { arm: 'optics', i: 3, name: '爆散反射', cost: 280, desc: '击杀照明 +40px', eff: { killLightR: 40 } },
    { arm: 'optics', i: 4, name: '暗视觉', cost: 420, desc: '近距弱光 +20px', eff: { nearR: 20 } },
    { arm: 'optics', i: 5, name: '深渊之瞳', cost: 620, desc: '灯锥长度 +14px，击杀照明 +60px', eff: { coneLen: 14, killLightR: 60 } },
    { arm: 'optics', i: 6, name: '棱镜阵列', cost: 900, desc: '灯锥长度 +12px，角度 +2°', eff: { coneLen: 12, coneAng: 2 } },
    { arm: 'optics', i: 7, name: '深海灯塔', cost: 1300, desc: '近距弱光 +40px，击杀照明 +80px', eff: { nearR: 40, killLightR: 80 } },

    /* 声呐 */
    { arm: 'sonar', i: 0, name: '换能器', cost: 60, desc: 'ping 冷却 −0.3s', eff: { pingCd: -0.3 } },
    { arm: 'sonar', i: 1, name: '快速扫描', cost: 110, desc: '扫描间隔 −0.2s', eff: { sonarPeriod: -0.2 } },
    { arm: 'sonar', i: 2, name: '备用方案', cost: 180, desc: '每次抽卡额外重抽 +1', eff: { rerolls: 1 } },
    { arm: 'sonar', i: 3, name: '功率补偿', cost: 280, desc: 'ping 冷却 −0.4s', eff: { pingCd: -0.4 } },
    { arm: 'sonar', i: 4, name: '阵列叠加', cost: 420, desc: '扫描间隔 −0.2s', eff: { sonarPeriod: -0.2 } },
    { arm: 'sonar', i: 5, name: '全频段', cost: 620, desc: '每次抽卡额外重抽 +1', eff: { rerolls: 1 } },
    { arm: 'sonar', i: 6, name: '相控阵', cost: 900, desc: '扫描间隔 −0.15s，ping 冷却 −0.3s', eff: { sonarPeriod: -0.15, pingCd: -0.3 } },
    { arm: 'sonar', i: 7, name: '听海', cost: 1300, desc: '每次抽卡额外重抽 +1，标记时长 +1.5s', eff: { rerolls: 1, markTime: 1.5 } },

    /* 结构 */
    { arm: 'struct', i: 0, name: '缓冲层', cost: 60, desc: '受击无敌 +0.1s', eff: { ifrHurt: 0.1 } },
    { arm: 'struct', i: 1, name: '回收协议', cost: 110, desc: '修复包掉落率 +1%', eff: { dropBonus: 0.01 } },
    { arm: 'struct', i: 2, name: '加固壳', cost: 180, desc: '初始船体 +1', eff: { maxHp: 1 } },
    { arm: 'struct', i: 3, name: '减震支架', cost: 280, desc: '受击无敌 +0.1s', eff: { ifrHurt: 0.1 } },
    { arm: 'struct', i: 4, name: '预充护盾', cost: 420, desc: '开局携带 1 层护盾', eff: { shieldStart: 1 } },
    { arm: 'struct', i: 5, name: '耐压壳', cost: 620, desc: '最大船体 +1', eff: { maxHp: 1 } },
    { arm: 'struct', i: 6, name: '蜂窝骨架', cost: 900, desc: '最大船体 +1，修复包掉落率 +2%', eff: { maxHp: 1, dropBonus: 0.02 } },
    { arm: 'struct', i: 7, name: '深渊船坞', cost: 1300, desc: '最大船体 +2，开局护盾 +1', eff: { maxHp: 2, shieldStart: 1 } },

    /* 动力 */
    { arm: 'power', i: 0, name: '推进优化', cost: 60, desc: '移速 +2%', eff: { moveMul: 0.02 } },
    { arm: 'power', i: 1, name: '流体外形', cost: 110, desc: '移速 +2%', eff: { moveMul: 0.02 } },
    { arm: 'power', i: 2, name: '冷却回路', cost: 180, desc: '冲刺冷却 −3%', eff: { dashCd: -0.03 } },
    { arm: 'power', i: 3, name: '矢量喷口', cost: 280, desc: '移速 +3%', eff: { moveMul: 0.03 } },
    { arm: 'power', i: 4, name: '超载推进', cost: 420, desc: '冲刺距离 +10px', eff: { dashDist: 10 } },
    { arm: 'power', i: 5, name: '双推进舱', cost: 620, desc: '冲刺充能 +1', eff: { dashCharges: 1 } },
    { arm: 'power', i: 6, name: '磁轨推进', cost: 900, desc: '移速 +3%，冲刺冷却 −4%', eff: { moveMul: 0.03, dashCd: -0.04 } },
    { arm: 'power', i: 7, name: '潮汐引擎', cost: 1300, desc: '冲刺充能 +1，冲刺距离 +12px', eff: { dashCharges: 1, dashDist: 12 } },

    /* 战斗 */
    { arm: 'combat', i: 0, name: '弹道校准', cost: 60, desc: '伤害 +2%', eff: { dmgMul: 1.02 } },
    { arm: 'combat', i: 1, name: '快速装填', cost: 110, desc: '射速 +2%', eff: { rateMul: 0.98 } },
    { arm: 'combat', i: 2, name: '稳定击发', cost: 180, desc: '伤害 +3%', eff: { dmgMul: 1.03 } },
    { arm: 'combat', i: 3, name: '弱点识别', cost: 280, desc: '暴击率 +2%', eff: { critAdd: 0.02 } },
    { arm: 'combat', i: 4, name: '过载弹头', cost: 420, desc: '伤害 +4%', eff: { dmgMul: 1.04 } },
    { arm: 'combat', i: 5, name: '致命精准', cost: 620, desc: '暴击率 +3%，暴击伤害 ×2.2', eff: { critAdd: 0.03, critPow: 2.2 } },
    { arm: 'combat', i: 6, name: '火控网络', cost: 900, desc: '射速 +3%，伤害 +3%', eff: { rateMul: 0.97, dmgMul: 1.03 } },
    { arm: 'combat', i: 7, name: '歼灭协议', cost: 1300, desc: '伤害 +6%', eff: { dmgMul: 1.06 } },

    /* 采集 */
    { arm: 'harvest', i: 0, name: '磁力线圈', cost: 60, desc: '拾取半径 +40px', eff: { magnet: 40 } },
    { arm: 'harvest', i: 1, name: '回收协议 II', cost: 110, desc: '修复包掉落率 +1%', eff: { dropBonus: 0.01 } },
    { arm: 'harvest', i: 2, name: '氖核提纯', cost: 180, desc: '氖核掉落率 +2%', eff: { neon: 0.02 } },
    { arm: 'harvest', i: 3, name: '磁力强化', cost: 280, desc: '拾取半径 +60px', eff: { magnet: 60 } },
    { arm: 'harvest', i: 4, name: '深度采集', cost: 420, desc: '修复包掉落率 +1.5%', eff: { dropBonus: 0.015 } },
    { arm: 'harvest', i: 5, name: '循环利用', cost: 620, desc: '每次抽卡额外重抽 +1', eff: { rerolls: 1 } },
    { arm: 'harvest', i: 6, name: '富集矿脉', cost: 900, desc: '氖核掉落率 +3%', eff: { neon: 0.03 } },
    { arm: 'harvest', i: 7, name: '深渊馈赠', cost: 1300, desc: '拾取半径 +100px，修复包 +2%', eff: { magnet: 100, dropBonus: 0.02 } }
  ];

  DL.T = T;
  DL.RARITY = RARITY;
  DL.ETYPE = ETYPE;
  DL.FORMATIONS = FORMATIONS;
  DL.CARDS = CARDS;
  DL.BOSSES = BOSSES;
  DL.TREE_ARMS = TREE_ARMS;
  DL.TREE_NODES = TREE_NODES;

  var CARD_BY_ID = {};
  for (var _ci = 0; _ci < CARDS.length; _ci++) CARD_BY_ID[CARDS[_ci].id] = CARDS[_ci];
  DL.cardById = function (id) { return CARD_BY_ID[id]; };
  DL.CARD_TAGS = {
    shot: '射击', melee: '近战', light: '光域', sonar: '声呐',
    guts: '生存', mobility: '机动', crit: '暴击', boom: '爆破'
  };
  DL.baseStats = baseStats;
  DL.D2 = D;
})();
