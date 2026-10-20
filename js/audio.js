/* ==========================================================================
   光溺 DROWNLIGHT · audio.js
   全部音效与音乐由 WebAudio 实时合成，无任何音频文件。
   音乐分四层：环境 drone / 和声 pad / 战斗节奏 / Boss 压迫
   ========================================================================== */
window.DL = window.DL || {};
(function () {
  'use strict';

  var A = {
    ctx: null, master: null, sfxGain: null, musGain: null, musFilt: null,
    ready: false, failed: false,
    nodes: 0,
    noiseBuf: null,
    beat: 0, nextBeat: 0, nextBoss: 0,
    /* 场景混音：play 是本体，menu 是标题/暂停/选卡等一切静止画面 */
    mix: { scene: 'menu', muted: false }
  };

  function opt() { return DL.save.get().settings; }

  /* 音效节流：同一类音效在 ms 内只响一次，避免弹幕多时炸成一团 */
  var lastSfx = {};
  function allow(name, ms) {
    var now = (A.ctx ? A.ctx.currentTime : 0) * 1000;
    if (lastSfx[name] !== undefined && now - lastSfx[name] < ms) return false;
    lastSfx[name] = now;
    return true;
  }

  /* ---------------- 生命周期 ---------------- */
  A.unlock = function () {
    if (A.ready || A.failed) { if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume(); return; }
    try {
      var C = window.AudioContext || window.webkitAudioContext;
      if (!C) { A.failed = true; return; }
      A.ctx = new C();
      A.master = A.ctx.createGain(); A.master.gain.value = 0.85; A.master.connect(A.ctx.destination);
      A.sfxGain = A.ctx.createGain(); A.sfxGain.gain.value = (opt().sfx / 100); A.sfxGain.connect(A.master);

      /* 音乐总线过一道低通：削掉高频毛刺，静止画面再压低 */
      A.musGain = A.ctx.createGain();
      A.musGain.gain.value = opt().musicOn ? (opt().music / 100) : 0;
      A.musFilt = A.ctx.createBiquadFilter();
      A.musFilt.type = 'lowpass';
      A.musFilt.frequency.value = 3400;
      A.musFilt.Q.value = 0.4;
      A.musGain.connect(A.musFilt);
      A.musFilt.connect(A.master);

      var len = Math.floor(A.ctx.sampleRate * 1.2);
      var buf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.6);
      A.noiseBuf = buf;

      A.ready = true;
      startBeds();
    } catch (e) { A.failed = true; }
  };

  A.setVolumes = function () {
    if (!A.ready) return;
    var s = opt();
    try {
      A.sfxGain.gain.value = s.sfx / 100;
      A.master.gain.value = s.muted ? 0 : 0.85;
    } catch (e) { }
    applyMix(true);
  };

  /* 按场景算出各总线的目标音量 */
  function applyMix(instant) {
    if (!A.ready) return;
    var s = opt();
    var base = s.musicOn ? s.music / 100 : 0;
    var menu = A.mix.scene !== 'play';
    var t = A.ctx.currentTime;
    var tc = instant ? 0.02 : 0.5;
    var musVol = A.mix.muted ? 0.0001 : Math.max(0.0001, base * (menu ? 0.55 : 1));
    try {
      A.musGain.gain.setTargetAtTime(musVol, t, tc);
      A.musFilt.frequency.setTargetAtTime(menu ? 1150 : 3400, t, tc);
      if (beds) {
        /* 静止画面里把 41Hz 的次低音压下去：它在小音箱上最容易糊成噪声 */
        beds.subGain.gain.setTargetAtTime(A.mix.muted ? 0.0001 : (menu ? 0.13 : 0.46), t, tc);
        beds.noiseGain.gain.setTargetAtTime(A.mix.muted ? 0.0001 : (menu ? 0.05 : 0.035), t, tc);
        beds.padGain.gain.setTargetAtTime(A.mix.muted ? 0.0001 : (menu ? 0.13 : 0.17), t, tc);
      }
    } catch (e) { }
  }

  /* 场景切换：play / menu */
  A.scene = function (name) {
    if (A.mix.scene === name) return;
    A.mix.scene = name;
    applyMix(false);
  };

  function track(n) { A.nodes += n; if (A.nodes < 0) A.nodes = 0; }
  function busy() { return A.nodes > 30; }

  /* ---------------- 基础发声 ---------------- */
  function tone(freq, dur, type, vol, slideTo, dest, attack) {
    if (!A.ready || busy()) return;
    try {
      var t = A.ctx.currentTime;
      var o = A.ctx.createOscillator();
      var g = A.ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(15, slideTo), t + dur);
      var at = attack || 0.012;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + at);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(dest || A.sfxGain);
      o.start(t); o.stop(t + dur + 0.03);
      track(1);
      o.onended = function () { track(-1); };
    } catch (e) { }
  }

  function noise(dur, vol, freq, q, dest, sweepTo) {
    if (!A.ready || !A.noiseBuf || busy()) return;
    try {
      var t = A.ctx.currentTime;
      var src = A.ctx.createBufferSource(); src.buffer = A.noiseBuf;
      var f = A.ctx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.setValueAtTime(freq || 900, t); f.Q.value = q || 1.2;
      if (sweepTo) f.frequency.exponentialRampToValueAtTime(Math.max(60, sweepTo), t + dur);
      var g = A.ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(g); g.connect(dest || A.sfxGain);
      src.start(t); src.stop(t + dur + 0.02);
      track(1);
      src.onended = function () { track(-1); };
    } catch (e) { }
  }

  /* ---------------- 音效 ---------------- */
  var S = {
    shoot: function () { if (allow('shoot', 55)) tone(DL.U.rnd(880, 980), 0.06, 'triangle', 0.035, 520); },
    hit: function () { if (allow('hit', 45)) noise(0.05, 0.06, 1600, 2.5); },
    kill: function () {
      if (!allow('kill', 40)) return;
      noise(0.16, 0.10, 520, 1.1);
      tone(DL.U.rnd(210, 260), 0.18, 'sine', 0.05, 70);
    },
    elite: function () {
      noise(0.3, 0.14, 380, 0.9);
      tone(120, 0.35, 'sine', 0.08, 45);
    },
    hurt: function () {
      tone(150, 0.28, 'sawtooth', 0.10, 60);
      noise(0.2, 0.12, 300, 1.4);
      tone(2800, 0.5, 'sine', 0.012, 2600);
    },
    dash: function () { noise(0.22, 0.10, 700, 0.8); },
    blade: function () {
      if (!allow('blade', 80)) return;
      noise(0.12, 0.05, 2400, 1.6, null, 700);
      tone(520, 0.12, 'triangle', 0.02, 900);
    },
    ping: function () {
      tone(720, 0.55, 'sine', 0.06, 240);
      tone(1440, 0.4, 'sine', 0.02, 480);
    },
    pickup: function () { tone(660, 0.08, 'sine', 0.05); setTimeout(function () { tone(990, 0.1, 'sine', 0.05); }, 60); },
    shield: function () { tone(420, 0.3, 'sine', 0.07, 900); noise(0.15, 0.05, 2200, 2); },
    card: function () {
      tone(660, 0.5, 'sine', 0.03, 990);
      tone(990, 0.6, 'sine', 0.02, 1320);
      setTimeout(function () { tone(1320, 0.5, 'sine', 0.02, 1760); }, 90);
    },
    /* UI：全部换成正弦/三角，不用方波，音量再压一档 */
    hover: function () { if (allow('hover', 40)) tone(820, 0.055, 'sine', 0.014); },
    click: function () { if (allow('click', 40)) tone(600, 0.07, 'triangle', 0.020, 460); },
    confirm: function () { tone(392, 0.18, 'triangle', 0.050); tone(588, 0.24, 'triangle', 0.040); },
    back: function () { tone(320, 0.12, 'triangle', 0.035, 220); },
    boss: function () {
      tone(48, 1.2, 'sine', 0.13, 38);
      noise(1.0, 0.10, 200, 0.6);
    },
    bossDie: function () {
      tone(60, 1.6, 'sine', 0.14, 26);
      noise(1.4, 0.16, 300, 0.5);
      tone(880, 1.2, 'sine', 0.04, 140);
    },
    implode: function () {
      if (!A.ready) return;
      try {
        A.master.gain.setValueAtTime(0.85, A.ctx.currentTime);
        A.master.gain.exponentialRampToValueAtTime(0.02, A.ctx.currentTime + 0.12);
        A.master.gain.setValueAtTime(0.02, A.ctx.currentTime + 0.45);
        A.master.gain.exponentialRampToValueAtTime(0.85, A.ctx.currentTime + 1.4);
      } catch (e) { }
      noise(0.5, 0.3, 220, 0.6);
      tone(70, 0.7, 'sine', 0.16, 28);
    },
    surge: function () { tone(520, 0.35, 'sine', 0.05, 780); },
    layer: function () { tone(220, 1.1, 'sine', 0.07, 110); tone(440, 0.9, 'sine', 0.03, 220); },
    menu: function () { tone(660, 0.06, 'sine', 0.016); }
  };
  A.sfx = S;

  /* ---------------- 常驻底层：次低音 + 和声 pad + 水流 ---------------- */
  var beds = null;

  function startBeds() {
    if (!A.ready || beds) return;
    try {
      var t = A.ctx.currentTime;

      // 次低音：根音 + 纯五度（不用两个相差 0.7Hz 的同音，避免低频"打摆"）
      var subGain = A.ctx.createGain(); subGain.gain.value = 0.46;
      subGain.connect(A.musGain);
      var o1 = A.ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = 41;
      var o2 = A.ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 61.74;
      var o2g = A.ctx.createGain(); o2g.gain.value = 0.55;
      o1.connect(subGain); o2.connect(o2g); o2g.connect(subGain);
      o1.start(t); o2.start(t);

      // 和声 pad：小三和弦，经低通，缓慢呼吸
      var padGain = A.ctx.createGain(); padGain.gain.value = 0.0;
      var filt = A.ctx.createBiquadFilter();
      filt.type = 'lowpass'; filt.frequency.value = 420; filt.Q.value = 0.8;
      filt.connect(padGain); padGain.connect(A.musGain);
      var padOscs = [];
      var chord = [55, 65.41, 82.41, 110];
      var chordGain = [0.30, 0.14, 0.34, 0.10];   // 三度压轻：保留小调的阴暗，去掉粗糙拍频
      for (var i = 0; i < chord.length; i++) {
        var o = A.ctx.createOscillator();
        o.type = i === 3 ? 'triangle' : 'sine';
        o.frequency.value = chord[i];
        o.detune.value = (i - 1.5) * 3;
        var g = A.ctx.createGain(); g.gain.value = chordGain[i];
        o.connect(g); g.connect(filt);
        o.start(t);
        padOscs.push(o);
      }
      padGain.gain.value = 0.0001;

      var lfo = A.ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.06;
      var lfoG = A.ctx.createGain(); lfoG.gain.value = 130;
      lfo.connect(lfoG); lfoG.connect(filt.frequency);
      lfo.start(t);

      // 水流：循环噪声 + 带通
      var nb = A.ctx.createBuffer(1, Math.floor(A.ctx.sampleRate * 2), A.ctx.sampleRate);
      var nd = nb.getChannelData(0);
      for (var k = 0; k < nd.length; k++) nd[k] = (Math.random() * 2 - 1) * 0.6;
      var src = A.ctx.createBufferSource(); src.buffer = nb; src.loop = true;
      var nf = A.ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 320; nf.Q.value = 0.6;
      var ng = A.ctx.createGain(); ng.gain.value = 0.035;
      src.connect(nf); nf.connect(ng); ng.connect(A.musGain);
      src.start(t);

      beds = { subGain: subGain, o1: o1, o2: o2, padGain: padGain, filt: filt, padOscs: padOscs, noiseGain: ng };
      applyMix(true);
    } catch (e) { }
  }

  /* 深度 → 音色变暗、音高下沉 */
  A.setDepthMood = function (depth) {
    if (!beds || !A.ready) return;
    try {
      var k = DL.U.clamp(depth / 4200, 0, 1);
      var t = A.ctx.currentTime;
      beds.o1.frequency.setTargetAtTime(41 - k * 8, t, 1.4);
      beds.o2.frequency.setTargetAtTime(61.74 - k * 12, t, 1.4);
      beds.filt.frequency.setTargetAtTime(420 - k * 160, t, 1.6);
      var detune = k * -40;
      for (var i = 0; i < beds.padOscs.length; i++) {
        beds.padOscs[i].detune.setTargetAtTime((i - 1.5) * 3 + detune, t, 2.0);
      }
    } catch (e) { }
  };

  /* ---------------- 战斗 / Boss 节奏层 ---------------- */
  var MINOR = [0, 3, 5, 7, 10, 12, 15];
  var mus = {
    nextBeat: 0, nextHat: 0, nextBoss: 0, nextStab: 0,
    arp: 0, bossOn: false, bossBeat: 0
  };

  function kick(t, vol) {
    if (!A.ready || busy()) return;
    try {
      var o = A.ctx.createOscillator(), g = A.ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(78, t);
      o.frequency.exponentialRampToValueAtTime(38, t + 0.16);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
      o.connect(g); g.connect(A.musGain);
      o.start(t); o.stop(t + 0.26);
      track(1); o.onended = function () { track(-1); };
    } catch (e) { }
  }

  function pluck(t, freq, vol, dur) {
    if (!A.ready || busy()) return;
    try {
      var o = A.ctx.createOscillator(), g = A.ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(A.musGain);
      o.start(t); o.stop(t + dur + 0.02);
      track(1); o.onended = function () { track(-1); };
    } catch (e) { }
  }

  function hat(t, vol) {
    if (!A.ready || !A.noiseBuf || busy()) return;
    try {
      var src = A.ctx.createBufferSource(); src.buffer = A.noiseBuf;
      src.playbackRate.value = 2.2;
      var f = A.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000;
      var g = A.ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      src.connect(f); f.connect(g); g.connect(A.musGain);
      src.start(t); src.stop(t + 0.09);
      track(1); src.onended = function () { track(-1); };
    } catch (e) { }
  }

  function bossBass(t, freq, vol) {
    if (!A.ready || busy()) return;
    try {
      var o = A.ctx.createOscillator(), g = A.ctx.createGain(), f = A.ctx.createBiquadFilter();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(freq, t);
      f.type = 'lowpass';
      f.frequency.setValueAtTime(180, t);
      f.frequency.exponentialRampToValueAtTime(420, t + 0.06);
      f.frequency.exponentialRampToValueAtTime(160, t + 0.24);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
      o.connect(f); f.connect(g); g.connect(A.musGain);
      o.start(t); o.stop(t + 0.28);
      track(1); o.onended = function () { track(-1); };
    } catch (e) { }
  }

  function stab(t, vol) {
    if (!A.ready || busy()) return;
    try {
      var o1 = A.ctx.createOscillator(), o2 = A.ctx.createOscillator();
      var g = A.ctx.createGain(), f = A.ctx.createBiquadFilter();
      o1.type = 'sawtooth'; o2.type = 'sawtooth';
      o1.frequency.value = 146.8; o2.frequency.value = 155.6;   // 小二度：只留一点不安，不再是一根刺
      f.type = 'lowpass'; f.frequency.value = 420;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
      o1.connect(f); o2.connect(f); f.connect(g); g.connect(A.musGain);
      o1.start(t); o2.start(t); o1.stop(t + 0.44); o2.stop(t + 0.44);
      track(2); o1.onended = function () { track(-1); };
    } catch (e) { }
  }

  /* Boss 登场：上升噪声 + 次低音冲击 */
  A.bossRiser = function () {
    if (!A.ready) return;
    noise(1.1, 0.16, 380, 1.4, A.musGain, 5200);
    tone(70, 1.2, 'sawtooth', 0.06, 220, A.musGain, 0.4);
    try {
      var t = A.ctx.currentTime;
      var o = A.ctx.createOscillator(), g = A.ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(30, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + 1.0);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      o.connect(g); g.connect(A.musGain);
      o.start(t); o.stop(t + 1.7);
      track(1); o.onended = function () { track(-1); };
    } catch (e) { }
  };

  /* Boss 死亡：低频坠落 */
  A.bossDrop = function () {
    tone(120, 1.4, 'sine', 0.12, 24, A.musGain, 0.05);
    noise(1.6, 0.10, 900, 0.5, A.musGain, 80);
  };

  A.update = function (dt, intensity, bossOn) {
    if (!A.ready) return;
    var opts = opt();
    if (!opts.musicOn) return;

    var t = A.ctx.currentTime;

    if (bossOn && !mus.bossOn) { mus.bossOn = true; A.bossRiser(); mus.nextBoss = t + 0.9; }
    if (!bossOn && mus.bossOn) { mus.bossOn = false; A.bossDrop(); }

    // 战斗脉冲：90 BPM
    if (mus.nextBeat === 0) mus.nextBeat = t + 0.15;
    if (intensity > 0.12 && t >= mus.nextBeat) {
      mus.nextBeat = t + 0.66;
      kick(t, 0.05 + intensity * 0.075);
      // 琶音：越紧张越高
      var idx = (mus.arp++) % MINOR.length;
      var base = 220 * Math.pow(2, (MINOR[idx] + Math.floor(intensity * 3) * 12) / 12);
      pluck(t + 0.005, base, 0.014 + intensity * 0.024, 0.5);
      if (intensity > 0.72) pluck(t + 0.33, base * 1.5, 0.010, 0.35);
    }

    // 高频沙锤：紧张时才出现
    if (mus.nextHat === 0) mus.nextHat = t + 0.2;
    if (intensity > 0.42 && t >= mus.nextHat) {
      mus.nextHat = t + 0.33;
      hat(t, 0.012 + intensity * 0.022);
    }

    // Boss 层：八分音符锯齿贝斯 + 定期不和谐刺
    if (mus.bossOn) {
      if (t >= mus.nextBoss) {
        mus.nextBoss = t + 0.335;
        mus.bossBeat++;
        var seq = [55, 55, 58.27, 55, 51.91, 55, 46.25, 49];
        bossBass(t, seq[mus.bossBeat % seq.length], 0.075);
      }
      if (mus.nextStab === 0) mus.nextStab = t + 2.0;
      if (t >= mus.nextStab) {
        mus.nextStab = t + 3.9;
        stab(t, 0.045);
      }
    }
  };

  A.silence = function (on) {
    if (!A.ready) return;
    A.mix.muted = !!on;
    applyMix(false);
  };

  DL.audio = A;
})();
