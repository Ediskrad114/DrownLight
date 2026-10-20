# Contributing

欢迎改数值、加内容、修 bug。这个项目的结构是刻意做成「数据驱动」的，加一张卡或一个 Boss
不需要动引擎。

## 先跑起来

```
# 1. 直接试玩（不需要构建）
start index.html                  # 或者双击

# 2. 构建 exe（只需要 Windows 自带的 .NET Framework 4.8）
powershell -ExecutionPolicy Bypass -File build\build.ps1

# 3. 改完 js/ 后免打包调试
.\光溺.exe --dev

# 4. 提交前跑验收（会用临时存档，不碰你的进度）
powershell -ExecutionPolicy Bypass -File test.ps1 -Dev
```

## 铁律

1. **数值只写在 `js/data.js` 的 `T` 里。** 其他文件不允许出现魔法数字；改平衡应该是一次
   `T.xxx` 的调整，而不是散落在十几个函数里的 `* 1.2`。
2. **不引入外部依赖、图片、字体、音频文件。** 美术与声音都用 Canvas / WebAudio 现画现合成。
3. **不用 ES Module。** 全部是传统 `<script>` + 全局 `window.DL`，因为 `file://` 下 ES Module
   会被 CORS 拦，双击就打不开了。
4. **`build/*.ps1` 保持纯 ASCII。** Windows PowerShell 5.1 读 UTF-8 无 BOM 的中文脚本会乱码，
   需要中文文件名就用字符码拼（见 `build.ps1` 里的 `[char]0x5149`）。
5. **不要提交 `光溺.exe`**（已在 `.gitignore`），二进制走 Releases。

## 加一张卡

只需要改 `js/data.js` 的 `CARDS` 数组，一条记录就是一张卡：

```js
{ id: 'fan', name: '扇面', cat: 'w', rar: 'c', max: 3, icon: 'fan', tags: ['shot'],
  desc: ['额外 +2 发，扇形 ±12°', '额外 +1 发，扇形 +3°', '额外 +1 发，扇形 +3°'],
  apply: function (s, l) {
    s.count += (l === 1 ? 2 : 1);
    s.spread += (l === 1 ? 12 : 3) * D;
    s.dmgMul *= 0.84;
  } },
```

| 字段 | 说明 |
|---|---|
| `id` | 唯一键，存档和前置判断都用它 |
| `cat` | `w` 武器 / `u` 辅助 / `p` 被动 / `l` 传说 |
| `rar` | `c` 普通 / `r` 稀有 / `l` 传说（决定抽取权重 `T` 之外的 `RARITY` 表） |
| `max` | 最高等级；`repeat: true` 表示可无限叠 |
| `desc` | 每个等级一行说明，图鉴和选卡界面直接用 |
| `apply(s, l)` | 按等级 `l` 修改属性对象 `s`；**不要再改别的全局状态** |
| `tags` | 流派标签（`shot` / `melee` / `light` / `sonar` / `survive` / `move` / `crit` / `blast`），影响后续抽卡权重 |
| `need` | 前置卡 id 数组，没拿到前置就不会出现在池子里 |
| `icon` | `drawIcon()` 里的图形名，`js/ui.js` |

要加新的**属性**（不只是改已有的），在 `js/systems.js` 的 `recomputeStats()` 里初始化默认值，
在 `js/entities.js` 里消费它。

## 加一个 Boss

三处，按顺序：

1. **`js/data.js` → `BOSSES`**：一条数据

   ```js
   { id: 'whale', name: '鲸', sub: '骸骨鲸', rank: 4,
     r: 124, hp: 2150, dur: 24, phases: [0.5],
     tips: '横穿战场 · 眼部弱点', color: '#cfd8ff',
     desc: '……（图鉴里显示的两句话）' }
   ```

   `rank` 是威胁等级（1~6），决定它会被排进第几层；血量会按层折算，不用自己算。
   不需要身体圆碰撞就加 `hitScale`。

2. **`js/systems.js` → `bossAI()`**：一个 `else if (b.id === 'whale') { ... }` 分支。
   可用的状态都挂在 `b` 上（在 `makeBoss()` 里加默认值），发射弹幕用
   `DL.spawnEBullet / DL.aimedVolley / DL.spawnEnemy / DL.spawnDecoy / DL.spawnSludge`，
   伤害玩家用 `DL.hurtPlayer`。**不要自己写冷却计时器**，`b.atk0 / atk1 / atk2` 已经每帧递减。

3. **`js/render.js` → `drawBoss()`**：绘制分支。整体画风是「深色躯体 + 发光核心 + 加色混合」，
   参考 `crystal`（多边形本体 + 部件）与 `whale`（完全自定义，提前 return）。

新 Boss 会自动出现在图鉴里，`DL.seen.boss(id)` 在进战斗时解锁。

## 加一个小怪

`ETYPE`（数据）→ `DL.spawnEnemy`（初始化）→ `updateEnemies` 的行为分支 → `drawEnemy` 的绘制分支。
敌人只在被看到时显形，绘制时用 `DL.visOf(x, y, r)` 拿可见度，别自己算。

## 调平衡

- 本体手感：`T.player.*`、`T.cone.*`、`T.sonar.*`
- 难度曲线：`T.scale.*`（每层血量/速度/密度）、`T.surge.*`（同屏数量与时长）
- 经济：`T.score.*`、`T.salvage.*`、`T.drops.*`
- Boss 强度：`T.boss.rankHp`（每层基准血量）、`T.boss.cycleHp` / `layerHp`（无尽缩放）

改完顺手跑一遍 `test.ps1`，并在 PR 描述里写清楚「改了什么、为什么、体感如何」。

## 提交

- 分支随意，PR 指向 `main`
- 一次 PR 只做一件事；纯数值调整和大改架构不要混在一起
- 改了玩法就更新 `CHANGELOG.md` 的 `Unreleased` 段
- 新增/修改的注释、文案用中文；代码标识符用英文
- 提交信息用中文或英文都行，但要说清楚做了什么

## 目录速查

| 文件 | 职责 |
|---|---|
| `js/data.js` | **唯一**的数值与内容表（敌型 / 卡牌 / Boss / 技能树 / 编队） |
| `js/core.js` | 主循环、输入与改键、画布缩放、存档、全局状态 `G` |
| `js/audio.js` | 程序化音效与四层音乐 |
| `js/entities.js` | 玩家、敌人、子弹、粒子、掉落 |
| `js/systems.js` | 属性重算、涌潮与层、计分、卡牌抽取、Boss AI、环境 |
| `js/render.js` | 背景、光域、实体、HUD、声呐盘 |
| `js/ui.js` | 所有界面与状态机 |
| `js/console.js` | 内置控制台 |
| `js/main.js` | 启动、调度、无头测试入口 |
| `build/` | C# + WebView2 外壳与构建脚本 |
| `docs/光溺-设计规格书.md` | 设计文档，改动设计前先看这里 |
