'use strict';

const PHASE_LABELS = {
  idle: '待机',
  registered: '已报名',
  countdown_red: '红灯',
  countdown_yellow: '黄灯',
  countdown_green: '绿灯',
  racing: '比赛中',
  finished: '比赛结束',
  false_start: '抢跑犯规',
  shop: '商店',
  garage: '仓库',
  game_over: '游戏失败',
};

const PRIZES = [1200, 800, 500, 200, 100];
const ENTRY_FEE = 200;
const PART_SELL_RATE = 0.8;
const FINISH = 100;
const TICK_MS = 45;
const STORAGE_KEY = 'mpsteam-race-save-v1';

const BASE_PLAYER_STATS = {
  engine: 10,
  tire: 10,
  gearbox: 10,
  stability: 10,
  weight: 1000,
  hp: 100,
};

const EQUIPMENT_SLOTS = [
  'Engine',
  'Tire',
  'Gearbox',
  'Body',
  'Intake',
  'Exhaust',
  'Turbo',
  'Stability',
];

const PART_TYPE_LABELS = {
  Engine: '引擎',
  Tire: '轮胎',
  Gearbox: '变速箱',
  Body: '车身',
  Intake: '进气',
  Exhaust: '排气',
  Turbo: '涡轮',
  Stability: '稳定件',
};

const PART_STAT_ORDER = ['engine', 'tire', 'gearbox', 'stability', 'weight', 'hp'];

const PART_STAT_LABELS = {
  engine: '引擎',
  tire: '轮胎',
  gearbox: '变速箱',
  stability: '稳定性',
  weight: '重量',
  hp: '马力',
};

const PART_RARITY_LABELS = {
  common: '普通',
  uncommon: '少见',
  rare: '稀有',
  legendary: '传说',
};

const PART_RARITY_WEIGHTS = {
  common: 64,
  uncommon: 26,
  rare: 8,
  legendary: 2,
};

const RACE_TIERS = [
  { minRaceCount: 0, label: '街边练习赛' },
  { minRaceCount: 5, label: '城郊挑战赛' },
  { minRaceCount: 12, label: '地下高速赛' },
];

const PART_POOL = [
  {
    name: '便宜机油',
    type: 'Engine',
    price: 180,
    rarity: 'common',
    effectText: '引擎 +2，稳定性 -1',
    changes: { engine: 2, stability: -1 },
  },
  {
    name: '二手引擎',
    type: 'Engine',
    price: 350,
    rarity: 'common',
    effectText: '引擎 +5，稳定性 -3',
    changes: { engine: 5, stability: -3 },
  },
  {
    name: '高压火花塞',
    type: 'Engine',
    price: 600,
    rarity: 'common',
    effectText: '引擎 +8，稳定性 -2',
    changes: { engine: 8, stability: -2 },
  },
  {
    name: '强化缸垫',
    type: 'Engine',
    price: 850,
    rarity: 'uncommon',
    effectText: '引擎 +7，马力 +6，重量 +4kg',
    changes: { engine: 7, hp: 6, weight: 4 },
  },
  {
    name: '高压燃油泵',
    type: 'Engine',
    price: 1250,
    rarity: 'uncommon',
    effectText: '引擎 +10，马力 +10，稳定性 -3',
    changes: { engine: 10, hp: 10, stability: -3 },
  },
  {
    name: '竞速引擎',
    type: 'Engine',
    price: 1800,
    rarity: 'rare',
    effectText: '引擎 +15，马力 +20，稳定性 -4',
    changes: { engine: 15, hp: 20, stability: -4 },
  },
  {
    name: '厂队封存红头机',
    type: 'Engine',
    price: 3600,
    rarity: 'legendary',
    effectText: '引擎 +24，马力 +34，稳定性 -8，重量 +18kg',
    changes: { engine: 24, hp: 34, stability: -8, weight: 18 },
  },

  {
    name: '翻新街胎',
    type: 'Tire',
    price: 260,
    rarity: 'common',
    effectText: '轮胎 +3，稳定性 -1',
    changes: { tire: 3, stability: -1 },
  },
  {
    name: '运动轮胎',
    type: 'Tire',
    price: 750,
    rarity: 'common',
    effectText: '轮胎 +6，稳定性 +1',
    changes: { tire: 6, stability: 1 },
  },
  {
    name: '宽胎',
    type: 'Tire',
    price: 700,
    rarity: 'common',
    effectText: '轮胎 +5，稳定性 +3，重量 +10kg',
    changes: { tire: 5, stability: 3, weight: 10 },
  },
  {
    name: '半热熔胎',
    type: 'Tire',
    price: 1100,
    rarity: 'uncommon',
    effectText: '轮胎 +10，稳定性 +2，重量 +6kg',
    changes: { tire: 10, stability: 2, weight: 6 },
  },
  {
    name: '窄胎省钱套',
    type: 'Tire',
    price: 220,
    rarity: 'common',
    effectText: '轮胎 +2，重量 -6kg，稳定性 -2',
    changes: { tire: 2, weight: -6, stability: -2 },
  },
  {
    name: '雨战花纹胎',
    type: 'Tire',
    price: 1500,
    rarity: 'rare',
    effectText: '轮胎 +9，稳定性 +7，重量 +8kg',
    changes: { tire: 9, stability: 7, weight: 8 },
  },
  {
    name: '赛道热熔 slick',
    type: 'Tire',
    price: 2900,
    rarity: 'legendary',
    effectText: '轮胎 +18，稳定性 +5，重量 +12kg',
    changes: { tire: 18, stability: 5, weight: 12 },
  },

  {
    name: '短尾牙',
    type: 'Gearbox',
    price: 580,
    rarity: 'common',
    effectText: '变速箱 +4，轮胎 +2',
    changes: { gearbox: 4, tire: 2 },
  },
  {
    name: '轻量化飞轮',
    type: 'Gearbox',
    price: 650,
    rarity: 'common',
    effectText: '变速箱 +5，重量 -20kg，稳定性 -1',
    changes: { gearbox: 5, weight: -20, stability: -1 },
  },
  {
    name: '改装变速箱',
    type: 'Gearbox',
    price: 900,
    rarity: 'uncommon',
    effectText: '变速箱 +8',
    changes: { gearbox: 8 },
  },
  {
    name: '焊死差速器',
    type: 'Gearbox',
    price: 420,
    rarity: 'common',
    effectText: '变速箱 +5，稳定性 -4',
    changes: { gearbox: 5, stability: -4 },
  },
  {
    name: '密齿齿比组',
    type: 'Gearbox',
    price: 1350,
    rarity: 'uncommon',
    effectText: '变速箱 +11，马力 +3，重量 +5kg',
    changes: { gearbox: 11, hp: 3, weight: 5 },
  },
  {
    name: '序列式拨片盒',
    type: 'Gearbox',
    price: 2400,
    rarity: 'rare',
    effectText: '变速箱 +17，稳定性 -2，重量 +6kg',
    changes: { gearbox: 17, stability: -2, weight: 6 },
  },
  {
    name: '雪主任祖传扳手',
    type: 'Gearbox',
    price: 3100,
    rarity: 'legendary',
    effectText: '变速箱 +20，引擎 +8，稳定性 -3',
    changes: { gearbox: 20, engine: 8, stability: -3 },
  },

  {
    name: '塑料机盖',
    type: 'Body',
    price: 430,
    rarity: 'common',
    effectText: '重量 -18kg，稳定性 -1',
    changes: { weight: -18, stability: -1 },
  },
  {
    name: '拆空后座',
    type: 'Body',
    price: 240,
    rarity: 'common',
    effectText: '重量 -25kg，稳定性 -3',
    changes: { weight: -25, stability: -3 },
  },
  {
    name: '车身补强杆',
    type: 'Body',
    price: 520,
    rarity: 'common',
    effectText: '稳定性 +6，重量 +12kg',
    changes: { stability: 6, weight: 12 },
  },
  {
    name: '玻璃纤维门板',
    type: 'Body',
    price: 980,
    rarity: 'uncommon',
    effectText: '重量 -32kg，稳定性 -4',
    changes: { weight: -32, stability: -4 },
  },
  {
    name: '铆钉宽体套件',
    type: 'Body',
    price: 1200,
    rarity: 'uncommon',
    effectText: '稳定性 +5，轮胎 +3，重量 +18kg',
    changes: { stability: 5, tire: 3, weight: 18 },
  },
  {
    name: '晴川猫猫贴纸',
    type: 'Body',
    price: 888,
    rarity: 'rare',
    effectText: '稳定性 +4，重量 -2kg',
    changes: { stability: 4, weight: -2 },
  },
  {
    name: '碳纤维全车壳',
    type: 'Body',
    price: 3400,
    rarity: 'legendary',
    effectText: '重量 -70kg，稳定性 -5，马力 +6',
    changes: { weight: -70, stability: -5, hp: 6 },
  },

  {
    name: '空气滤清器',
    type: 'Intake',
    price: 300,
    rarity: 'common',
    effectText: '马力 +3',
    changes: { hp: 3 },
  },
  {
    name: '街边进气套件',
    type: 'Intake',
    price: 620,
    rarity: 'common',
    effectText: '马力 +7，稳定性 -1',
    changes: { hp: 7, stability: -1 },
  },
  {
    name: '短管进气',
    type: 'Intake',
    price: 520,
    rarity: 'common',
    effectText: '马力 +6，重量 -4kg，稳定性 -1',
    changes: { hp: 6, weight: -4, stability: -1 },
  },
  {
    name: '冷风箱',
    type: 'Intake',
    price: 980,
    rarity: 'uncommon',
    effectText: '马力 +10，稳定性 +1，重量 +5kg',
    changes: { hp: 10, stability: 1, weight: 5 },
  },
  {
    name: '大口径节气门',
    type: 'Intake',
    price: 1300,
    rarity: 'uncommon',
    effectText: '马力 +14，引擎 +4，稳定性 -3',
    changes: { hp: 14, engine: 4, stability: -3 },
  },
  {
    name: '脸脸低电量省油包',
    type: 'Intake',
    price: 760,
    rarity: 'rare',
    effectText: '重量 -10kg，稳定性 +3，马力 -2',
    changes: { weight: -10, stability: 3, hp: -2 },
  },
  {
    name: '风洞调校进气盒',
    type: 'Intake',
    price: 2800,
    rarity: 'legendary',
    effectText: '马力 +22，引擎 +8，稳定性 -2',
    changes: { hp: 22, engine: 8, stability: -2 },
  },

  {
    name: '排气管',
    type: 'Exhaust',
    price: 500,
    rarity: 'common',
    effectText: '马力 +5，重量 +2kg',
    changes: { hp: 5, weight: 2 },
  },
  {
    name: '破洞直通尾段',
    type: 'Exhaust',
    price: 260,
    rarity: 'common',
    effectText: '马力 +6，稳定性 -2',
    changes: { hp: 6, stability: -2 },
  },
  {
    name: '轻量中段',
    type: 'Exhaust',
    price: 720,
    rarity: 'common',
    effectText: '马力 +7，重量 -8kg，稳定性 -1',
    changes: { hp: 7, weight: -8, stability: -1 },
  },
  {
    name: '回压调校排气',
    type: 'Exhaust',
    price: 960,
    rarity: 'uncommon',
    effectText: '马力 +9，稳定性 +2，重量 +4kg',
    changes: { hp: 9, stability: 2, weight: 4 },
  },
  {
    name: '钛合金尾段',
    type: 'Exhaust',
    price: 1600,
    rarity: 'rare',
    effectText: '马力 +13，重量 -14kg，稳定性 -1',
    changes: { hp: 13, weight: -14, stability: -1 },
  },
  {
    name: '赛用等长头段',
    type: 'Exhaust',
    price: 2100,
    rarity: 'rare',
    effectText: '马力 +18，引擎 +5，稳定性 -3',
    changes: { hp: 18, engine: 5, stability: -3 },
  },
  {
    name: '午夜噪声投诉套件',
    type: 'Exhaust',
    price: 3200,
    rarity: 'legendary',
    effectText: '马力 +25，引擎 +7，稳定性 -5，重量 -6kg',
    changes: { hp: 25, engine: 7, stability: -5, weight: -6 },
  },

  {
    name: '旧货市场涡轮',
    type: 'Turbo',
    price: 1100,
    rarity: 'common',
    effectText: '引擎 +10，马力 +12，稳定性 -4',
    changes: { engine: 10, hp: 12, stability: -4 },
  },
  {
    name: '小号涡轮',
    type: 'Turbo',
    price: 900,
    rarity: 'common',
    effectText: '马力 +10，引擎 +4，稳定性 -2',
    changes: { hp: 10, engine: 4, stability: -2 },
  },
  {
    name: '拆车厂增压器',
    type: 'Turbo',
    price: 680,
    rarity: 'common',
    effectText: '马力 +12，稳定性 -6，重量 +8kg',
    changes: { hp: 12, stability: -6, weight: 8 },
  },
  {
    name: '双涡管套件',
    type: 'Turbo',
    price: 1850,
    rarity: 'uncommon',
    effectText: '马力 +20，引擎 +8，稳定性 -5，重量 +12kg',
    changes: { hp: 20, engine: 8, stability: -5, weight: 12 },
  },
  {
    name: '低延迟滚珠涡轮',
    type: 'Turbo',
    price: 2500,
    rarity: 'rare',
    effectText: '马力 +24，引擎 +10，稳定性 -4，重量 +7kg',
    changes: { hp: 24, engine: 10, stability: -4, weight: 7 },
  },
  {
    name: '大蜗牛高压套',
    type: 'Turbo',
    price: 2900,
    rarity: 'rare',
    effectText: '马力 +34，引擎 +12，稳定性 -9，重量 +16kg',
    changes: { hp: 34, engine: 12, stability: -9, weight: 16 },
  },
  {
    name: '禁区增压黑盒',
    type: 'Turbo',
    price: 4300,
    rarity: 'legendary',
    effectText: '马力 +48，引擎 +18，稳定性 -14，重量 +20kg',
    changes: { hp: 48, engine: 18, stability: -14, weight: 20 },
  },

  {
    name: '钻孔刹车盘',
    type: 'Stability',
    price: 480,
    rarity: 'common',
    effectText: '稳定性 +4，重量 -3kg',
    changes: { stability: 4, weight: -3 },
  },
  {
    name: '加粗防倾杆',
    type: 'Stability',
    price: 620,
    rarity: 'common',
    effectText: '稳定性 +7，重量 +8kg',
    changes: { stability: 7, weight: 8 },
  },
  {
    name: '二手避震',
    type: 'Stability',
    price: 320,
    rarity: 'common',
    effectText: '稳定性 +3，重量 +4kg，轮胎 -1',
    changes: { stability: 3, weight: 4, tire: -1 },
  },
  {
    name: '四轮定位券',
    type: 'Stability',
    price: 760,
    rarity: 'uncommon',
    effectText: '稳定性 +8，轮胎 +2',
    changes: { stability: 8, tire: 2 },
  },
  {
    name: '防火墙补强板',
    type: 'Stability',
    price: 950,
    rarity: 'uncommon',
    effectText: '稳定性 +10，重量 +18kg',
    changes: { stability: 10, weight: 18 },
  },
  {
    name: '小雨小报赞助',
    type: 'Stability',
    price: 666,
    rarity: 'rare',
    effectText: '稳定性 +6，重量 +3kg，马力 +2',
    changes: { stability: 6, weight: 3, hp: 2 },
  },
  {
    name: '拉力赛防滚架',
    type: 'Stability',
    price: 2600,
    rarity: 'legendary',
    effectText: '稳定性 +22，重量 +42kg，轮胎 +4',
    changes: { stability: 22, weight: 42, tire: 4 },
  },
];

function createEmptyEquippedParts() {
  return EQUIPMENT_SLOTS.reduce((slots, type) => {
    slots[type] = null;
    return slots;
  }, {});
}

const gameState = {
  phase: 'idle',
  cash: 1500,
  raceCount: 0,
  lastRank: '-',
  greenAt: 0,
  reactionTime: null,
  playerStarted: false,
  countdownTimers: [],
  raceTimer: null,
  raceStartedAt: 0,
  lastRaceTickAt: 0,
  raceAccumulator: 0,
  shopItems: [],
  panelReturnPhase: 'idle',
  activePage: 'race',
  restartArmed: false,
  restartArmedTimer: null,
  inventory: [],
  equippedParts: createEmptyEquippedParts(),
  nextPartId: 1,
  cars: [],
  player: { ...BASE_PLAYER_STATS },
};

const el = {
  registerBtn: document.getElementById('registerBtn'),
  startBtn: document.getElementById('startBtn'),
  nextBtn: document.getElementById('nextBtn'),
  saveBtn: document.getElementById('saveBtn'),
  loadBtn: document.getElementById('loadBtn'),
  restartBtn: document.getElementById('restartBtn'),
  tabs: Array.from(document.querySelectorAll('.page-tabs button')),
  pages: Array.from(document.querySelectorAll('.app-page')),
  lanes: document.getElementById('lanes'),
  shopPanel: document.getElementById('shopPanel'),
  shopBody: document.getElementById('shopBody'),
  garagePanel: document.getElementById('garagePanel'),
  garageSlotsBody: document.getElementById('garageSlotsBody'),
  garageInventoryBody: document.getElementById('garageInventoryBody'),
  logOutput: document.getElementById('logOutput'),
  redLight: document.getElementById('redLight'),
  yellowLight: document.getElementById('yellowLight'),
  greenLight: document.getElementById('greenLight'),
  lightLabel: document.getElementById('lightLabel'),
  phaseText: document.getElementById('phaseText'),
  raceTierText: document.getElementById('raceTierText'),
  entryFeeText: document.getElementById('entryFeeText'),
  opponentPowerText: document.getElementById('opponentPowerText'),
  engineStat: document.getElementById('engineStat'),
  tireStat: document.getElementById('tireStat'),
  gearboxStat: document.getElementById('gearboxStat'),
  stabilityStat: document.getElementById('stabilityStat'),
  weightStat: document.getElementById('weightStat'),
  hpStat: document.getElementById('hpStat'),
  cashStat: document.getElementById('cashStat'),
  raceCountStat: document.getElementById('raceCountStat'),
  raceTierStat: document.getElementById('raceTierStat'),
  lastRankStat: document.getElementById('lastRankStat'),
  currentVehicleText: document.getElementById('currentVehicleText'),
  resultMessage: document.getElementById('resultMessage'),
  shopCashStat: document.getElementById('shopCashStat'),
  storageCashStat: document.getElementById('storageCashStat'),
  storageEngineStat: document.getElementById('storageEngineStat'),
  storageTireStat: document.getElementById('storageTireStat'),
  storageGearboxStat: document.getElementById('storageGearboxStat'),
  storageStabilityStat: document.getElementById('storageStabilityStat'),
  storageWeightStat: document.getElementById('storageWeightStat'),
  storageHpStat: document.getElementById('storageHpStat'),
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function pickRandomItems(pool, count) {
  const copy = pool.slice();
  const picked = [];

  while (picked.length < count && copy.length > 0) {
    const index = Math.floor(Math.random() * copy.length);
    picked.push(copy.splice(index, 1)[0]);
  }

  return picked;
}

function formatPartType(type) {
  return PART_TYPE_LABELS[type] || type;
}

function getPartRarity(part) {
  return PART_RARITY_LABELS[part && part.rarity] ? part.rarity : 'common';
}

function formatPartRarity(part) {
  return PART_RARITY_LABELS[getPartRarity(part)];
}

function renderPartRarity(part) {
  const rarity = getPartRarity(part);
  return `<span class="part-quality part-quality-${rarity}">${PART_RARITY_LABELS[rarity]}</span>`;
}

function renderPartName(part, includeId = false) {
  const rarity = getPartRarity(part);
  const label = includeId ? `#${part.id} ${part.name}` : part.name;
  return `<span class="part-quality part-quality-${rarity}">${label}</span>`;
}

function getPartStatValue(part, key) {
  return Number((part && part.changes && part.changes[key]) || 0);
}

function getPartComparisonChanges(part, equippedPart) {
  return PART_STAT_ORDER.reduce((changes, key) => {
    const value =
      getPartStatValue(part, key) - (equippedPart ? getPartStatValue(equippedPart, key) : 0);

    if (value !== 0) {
      changes[key] = value;
    }

    return changes;
  }, {});
}

function getPartChangeTone(key, value) {
  if (value === 0) {
    return 'neutral';
  }

  if (key === 'weight') {
    return value < 0 ? 'good' : 'bad';
  }

  return value > 0 ? 'good' : 'bad';
}

function formatSignedPartChange(key, value) {
  const sign = value > 0 ? '+' : '';
  const unit = key === 'weight' ? 'kg' : '';
  return `${PART_STAT_LABELS[key] || key} ${sign}${value}${unit}`;
}

function formatPartChangeText(changes) {
  const items = PART_STAT_ORDER.filter((key) => changes[key]).map((key) =>
    formatSignedPartChange(key, changes[key])
  );

  return items.length > 0 ? items.join('，') : '属性无变化';
}

function renderPartChangeList(changes) {
  const items = PART_STAT_ORDER.filter((key) => changes[key]).reduce(
    (groups, key) => {
      const value = changes[key];
      const tone = getPartChangeTone(key, value);
      const item = `<span class="part-change part-change-${tone}">${formatSignedPartChange(
        key,
        value
      )}</span>`;

      groups[tone].push(item);
      return groups;
    },
    { good: [], bad: [], neutral: [] }
  );

  if (!items.good.length && !items.bad.length && !items.neutral.length) {
    return '<span class="part-change part-change-neutral">属性无变化</span>';
  }

  return `
    <div class="part-change-groups">
      ${
        items.good.length
          ? `<div class="part-change-group"><span>增益</span><div class="part-change-list">${items.good.join(
              ''
            )}</div></div>`
          : ''
      }
      ${
        items.bad.length
          ? `<div class="part-change-group"><span>代价</span><div class="part-change-list">${items.bad.join(
              ''
            )}</div></div>`
          : ''
      }
      ${
        items.neutral.length
          ? `<div class="part-change-group"><span>其它</span><div class="part-change-list">${items.neutral.join(
              ''
            )}</div></div>`
          : ''
      }
    </div>
  `;
}

function renderPartComparison(part, equippedPart) {
  const isCurrent = equippedPart && equippedPart.id === part.id;
  const referencePart = isCurrent ? null : equippedPart;
  const label = isCurrent ? '当前效果' : equippedPart ? '相对当前' : '自身效果';
  const changes = getPartComparisonChanges(part, referencePart);

  return `
    <div class="part-compare">
      <small class="part-compare-label">${label}</small>
      ${renderPartChangeList(changes)}
    </div>
  `;
}

function formatPartOption(part, equippedPart = null) {
  if (equippedPart && equippedPart.id === part.id) {
    return `[${formatPartRarity(part)}] #${part.id} ${part.name}（当前已装备）`;
  }

  return `[${formatPartRarity(part)}] #${part.id} ${part.name}（${formatPartChangeText(
    getPartComparisonChanges(part, equippedPart)
  )}）`;
}

function getRaceTier() {
  return (
    RACE_TIERS.slice()
      .reverse()
      .find((tier) => gameState.raceCount >= tier.minRaceCount) || RACE_TIERS[0]
  );
}

function getPartById(partId) {
  return gameState.inventory.find((part) => part.id === partId) || null;
}

function getEquippedPart(type) {
  const partId = gameState.equippedParts[type];
  return partId ? getPartById(partId) : null;
}

function recalculatePlayerStats() {
  const totals = { ...BASE_PLAYER_STATS };

  EQUIPMENT_SLOTS.forEach((type) => {
    const part = getEquippedPart(type);
    if (!part) {
      return;
    }

    Object.keys(part.changes).forEach((key) => {
      totals[key] += part.changes[key];
    });
  });

  totals.stability = clamp(totals.stability, 1, 80);
  totals.weight = clamp(totals.weight, 760, 1250);
  gameState.player = totals;
}

function createOwnedPart(part) {
  return {
    ...part,
    id: gameState.nextPartId++,
  };
}

function getPartSellPrice(part) {
  return Math.floor(part.price * PART_SELL_RATE);
}

function isSamePart(part, ownedPart) {
  return part.name === ownedPart.name && part.type === ownedPart.type;
}

function hasOwnedPart(part) {
  return gameState.inventory.some((ownedPart) => isSamePart(part, ownedPart));
}

function isVehicleStripped() {
  return EQUIPMENT_SLOTS.every((type) => !gameState.equippedParts[type]);
}

function shouldFailForNoEntryFee() {
  return gameState.cash < ENTRY_FEE && isVehicleStripped();
}

function checkGameFailure() {
  if (!shouldFailForNoEntryFee()) {
    return false;
  }

  if (gameState.phase !== 'game_over') {
    setPhase('game_over');
    setLights('none');
    addLog('游戏失败：车辆已无装备，现金不足以支付报名费。');
    addLog('请点击“重开”重新开始。');
  }

  return true;
}

function createSaveData() {
  return {
    cash: gameState.cash,
    raceCount: gameState.raceCount,
    lastRank: gameState.lastRank,
    inventory: gameState.inventory.map((part) => ({
      id: part.id,
      name: part.name,
      type: part.type,
      rarity: getPartRarity(part),
      price: part.price,
      effectText: part.effectText,
      changes: { ...part.changes },
    })),
    equippedParts: { ...gameState.equippedParts },
    nextPartId: gameState.nextPartId,
  };
}

function sanitizeSaveData(data) {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const inventory = Array.isArray(data.inventory)
    ? data.inventory.reduce((parts, part) => {
        if (!part || typeof part !== 'object' || !EQUIPMENT_SLOTS.includes(part.type)) {
          return parts;
        }

        const id = Number(part.id);
        const price = Number(part.price);
        if (!Number.isInteger(id) || id <= 0 || !Number.isFinite(price) || price < 0) {
          return parts;
        }

        const changes = {};
        Object.keys(BASE_PLAYER_STATS).forEach((key) => {
          const value = Number(part.changes && part.changes[key]);
          if (Number.isFinite(value) && value !== 0) {
            changes[key] = value;
          }
        });

        parts.push({
          id,
          name: String(part.name || '未命名零件'),
          type: part.type,
          rarity: PART_RARITY_LABELS[part.rarity] ? part.rarity : 'common',
          price: Math.floor(price),
          effectText: String(part.effectText || '-'),
          changes,
        });
        return parts;
      }, [])
    : [];

  const equippedParts = createEmptyEquippedParts();
  const equippedData =
    data.equippedParts && typeof data.equippedParts === 'object' ? data.equippedParts : {};
  EQUIPMENT_SLOTS.forEach((type) => {
    const partId = Number(equippedData[type]);
    const part = inventory.find((item) => item.id === partId && item.type === type);
    equippedParts[type] = part ? part.id : null;
  });

  const maxPartId = inventory.reduce((maxId, part) => Math.max(maxId, part.id), 0);
  const nextPartId = Math.max(Number(data.nextPartId) || 1, maxPartId + 1);

  return {
    cash: Math.max(0, Math.floor(Number(data.cash) || 0)),
    raceCount: Math.max(0, Math.floor(Number(data.raceCount) || 0)),
    lastRank: String(data.lastRank || '-'),
    inventory,
    equippedParts,
    nextPartId,
  };
}

function applyPersistentState(data) {
  gameState.cash = data.cash;
  gameState.raceCount = data.raceCount;
  gameState.lastRank = data.lastRank;
  gameState.inventory = data.inventory;
  gameState.equippedParts = data.equippedParts;
  gameState.nextPartId = data.nextPartId;
  recalculatePlayerStats();
}

function refreshAfterPersistentChange() {
  clearRaceTimers();
  gameState.reactionTime = null;
  gameState.playerStarted = false;
  gameState.panelReturnPhase = 'idle';
  gameState.restartArmed = false;
  el.restartBtn.textContent = '重开';
  resetCars();
  refreshShop();
  renderGarage();
  setLights('none');
  setPhase('idle');
  updateStats();
}

function isRaceLockedPhase(phase) {
  return ['countdown_red', 'countdown_yellow', 'countdown_green', 'racing'].includes(phase);
}

function isPostRacePhase(phase) {
  return ['finished', 'false_start'].includes(phase);
}

function canUseShop() {
  return !isRaceLockedPhase(gameState.phase) && gameState.phase !== 'game_over';
}

function canManageStorage() {
  return (
    gameState.activePage === 'storage' &&
    !isRaceLockedPhase(gameState.phase) &&
    gameState.phase !== 'game_over'
  );
}

function setPhase(phase) {
  gameState.phase = phase;
  el.phaseText.textContent = PHASE_LABELS[phase];
  updateResultMessage();
  updateButtons();
}

function setActivePage(page) {
  gameState.activePage = page;

  el.tabs.forEach((tab) => {
    const active = tab.dataset.page === page;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', active ? 'true' : 'false');
  });

  el.pages.forEach((pageNode) => {
    const active = pageNode.dataset.page === page;
    pageNode.classList.toggle('is-active', active);
    pageNode.hidden = !active;
  });

  updateButtons();
}

function addLog(message) {
  const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  el.logOutput.textContent += `[${time}] ${message}\n`;
  el.logOutput.scrollTop = el.logOutput.scrollHeight;
}

function updateButtons() {
  const phase = gameState.phase;
  const countdownOrRace = isRaceLockedPhase(phase);
  const canPrepareNextRace = isPostRacePhase(phase);
  const gameOver = phase === 'game_over';

  el.registerBtn.disabled = phase !== 'idle';
  el.startBtn.disabled = !countdownOrRace || gameState.playerStarted;
  el.nextBtn.disabled = !canPrepareNextRace;
  el.saveBtn.disabled = countdownOrRace || gameOver;
  el.loadBtn.disabled = countdownOrRace;
  el.restartBtn.disabled = countdownOrRace;

  Array.from(el.shopBody.querySelectorAll('button')).forEach((button) => {
    const index = Number(button.dataset.index);
    const part = gameState.shopItems[index];
    const reasonNode = button.closest('.shop-card').querySelector('.card-reason');
    const alreadyOwned = part && (part.bought || hasOwnedPart(part));
    const notEnoughCash = part && gameState.cash < part.price;

    button.disabled = !canUseShop() || !part || alreadyOwned || notEnoughCash;

    if (alreadyOwned) {
      button.textContent = '已拥有';
      reasonNode.textContent = '原因：已经拥有';
    } else if (notEnoughCash) {
      button.textContent = '现金不足';
      reasonNode.textContent = `原因：还差 ${part.price - gameState.cash} 元`;
    } else if (!canUseShop()) {
      button.textContent = countdownOrRace ? '比赛中' : '不可购买';
      reasonNode.textContent = countdownOrRace ? '原因：比赛中不能购买' : '原因：当前状态不可购买';
    } else {
      button.textContent = '购买';
      reasonNode.textContent = '可购买';
    }
  });

  Array.from(el.garageSlotsBody.querySelectorAll('select')).forEach((select) => {
    select.disabled = !canManageStorage() || select.options.length <= 1;
  });

  Array.from(el.garageSlotsBody.querySelectorAll('[data-action="equip-slot"]')).forEach(
    (button) => {
      const part = getPartById(Number(button.dataset.partId));
      const equipped = part && gameState.equippedParts[part.type] === part.id;
      button.disabled = !canManageStorage() || !part || equipped;
    }
  );

  Array.from(el.garageInventoryBody.querySelectorAll('button')).forEach((button) => {
    const part = getPartById(Number(button.dataset.partId));
    const equipped = part && gameState.equippedParts[part.type] === part.id;
    button.disabled =
      !canManageStorage() ||
      !part ||
      (button.dataset.action === 'sell' && equipped) ||
      (button.dataset.action === 'unequip' && !equipped);
  });
}

function updateResultMessage() {
  const messages = {
    idle: '先报名比赛，等绿灯后点击起步。',
    registered: '已报名，等待发车。',
    countdown_red: '红灯，先别踩油门。',
    countdown_yellow: '黄灯，继续等待绿灯。',
    countdown_green: '绿灯，可以起步。',
    racing: gameState.playerStarted ? '比赛进行中。' : '电脑车已起跑，立即点击起步。',
    finished: `比赛结束，上场名次：${gameState.lastRank}。`,
    false_start: '抢跑犯规，本场成绩无效。',
    game_over: '游戏失败：现金不足且车辆无装备，请重开。',
  };
  el.resultMessage.textContent = messages[gameState.phase] || PHASE_LABELS[gameState.phase];
}

function setLights(active) {
  el.redLight.classList.toggle('active', active === 'red');
  el.yellowLight.classList.toggle('active', active === 'yellow');
  el.greenLight.classList.toggle('active', active === 'green');

  const labels = {
    none: '未报名',
    red: '红灯',
    yellow: '黄灯',
    green: '绿灯',
  };
  el.lightLabel.textContent = labels[active] || labels.none;
}

function updateStats() {
  const player = gameState.player;
  el.engineStat.textContent = player.engine;
  el.tireStat.textContent = player.tire;
  el.gearboxStat.textContent = player.gearbox;
  el.stabilityStat.textContent = player.stability;
  el.weightStat.textContent = `${player.weight} kg`;
  el.hpStat.textContent = `${player.hp} hp`;
  el.cashStat.textContent = `${gameState.cash} 元`;
  el.shopCashStat.textContent = `${gameState.cash} 元`;
  el.storageCashStat.textContent = `${gameState.cash} 元`;
  el.raceCountStat.textContent = gameState.raceCount;
  el.raceTierText.textContent = getRaceTier().label;
  el.raceTierStat.textContent = getRaceTier().label;
  el.lastRankStat.textContent = gameState.lastRank;
  el.entryFeeText.textContent = ENTRY_FEE;
  el.opponentPowerText.textContent = getOpponentPower().toFixed(2);
  el.currentVehicleText.textContent = '玩家破车';
  el.storageEngineStat.textContent = player.engine;
  el.storageTireStat.textContent = player.tire;
  el.storageGearboxStat.textContent = player.gearbox;
  el.storageStabilityStat.textContent = player.stability;
  el.storageWeightStat.textContent = `${player.weight} kg`;
  el.storageHpStat.textContent = `${player.hp} hp`;
  updateButtons();
}

function renderLanes() {
  el.lanes.innerHTML = '';
  gameState.cars.forEach((car, index) => {
    const lane = document.createElement('div');
    lane.className = 'lane';

    const label = document.createElement('span');
    label.className = 'lane-label';
    label.textContent = `车${index + 1}${car.isPlayer ? ' 我' : ''}`;

    const carNode = document.createElement('div');
    carNode.className = `car${car.isPlayer ? ' player-car' : ''}`;
    carNode.id = `car-${car.id}`;
    carNode.style.background = car.color;
    carNode.title = car.name;

    lane.appendChild(label);
    lane.appendChild(carNode);
    el.lanes.appendChild(lane);
  });

  updateCarPositions();
}

function updateCarPositions() {
  gameState.cars.forEach((car) => {
    const node = document.getElementById(`car-${car.id}`);
    if (!node) {
      return;
    }
    const percent = clamp(car.position, 0, FINISH);
    node.style.left = `calc(${percent}% - ${percent * 0.32}px)`;
  });
}

function resetCars() {
  gameState.cars = [
    createCar(1, '玩家破车', '#d00000', true),
    createCar(2, '电脑蓝车', '#0060c8', false),
    createCar(3, '电脑黄车', '#d8b000', false),
    createCar(4, '电脑绿车', '#008c28', false),
    createCar(5, '电脑灰车', '#707070', false),
  ];
  renderLanes();
}

function createCar(id, name, color, isPlayer) {
  return {
    id,
    name,
    color,
    isPlayer,
    position: 0,
    finishTime: null,
    currentSpeed: 0,
    started: false,
    reactionPenalty: 0,
    launchBonus: 0,
    power: isPlayer ? getPlayerPower() : getOpponentCarPower(id),
  };
}

function getPlayerPower() {
  const p = gameState.player;
  const weightPenalty = (p.weight - 1000) / 85;
  return {
    base: 0.53 + p.hp / 520 + p.engine / 155 - weightPenalty / 100,
    acceleration: 0.02 + p.engine / 3600 + p.gearbox / 4300,
    launch: p.tire / 85,
    mid: p.gearbox / 185,
    stability: clamp(p.stability, 1, 80),
  };
}

function getOpponentPower() {
  const count = gameState.raceCount;
  if (count < 5) {
    return 1 + count * 0.1;
  }
  if (count < 12) {
    return 1.45 + (count - 5) * 0.07;
  }
  return Math.min(2.35, 1.95 + (count - 12) * 0.035);
}

function getOpponentCarPower(id) {
  const difficulty = getOpponentPower();
  const variance = randomBetween(-0.05, 0.09);
  const personality = [0, -0.02, 0.02, 0.05, -0.04][id] || 0;
  return {
    base: 0.53 + difficulty * 0.07 + variance + personality,
    acceleration: 0.021 + difficulty * 0.0018 + randomBetween(-0.0015, 0.0025),
    launch: 0.1 + difficulty * 0.015 + randomBetween(0, 0.05),
    mid: 0.08 + difficulty * 0.018 + randomBetween(-0.02, 0.04),
    stability: 10 + difficulty * 1.8 + randomBetween(-3, 4),
  };
}

function registerRace() {
  if (gameState.cash < ENTRY_FEE) {
    if (checkGameFailure()) {
      return;
    }
    addLog('现金不足，连报名费都交不起。');
    addLog('可以进仓库卸下或卖掉零件，仓库回收价为原价 8 折。');
    return;
  }

  clearRaceTimers();
  gameState.cash -= ENTRY_FEE;
  gameState.reactionTime = null;
  gameState.playerStarted = false;
  resetCars();
  updateStats();

  addLog(`报名费 ${ENTRY_FEE} 元`);
  addLog('等待绿灯……红灯或黄灯点击“起步 / 踩油门”会抢跑。');

  setPhase('countdown_red');
  setLights('red');

  gameState.countdownTimers.push(
    setTimeout(() => {
      setPhase('countdown_yellow');
      setLights('yellow');
      addLog('黄灯……还不能踩，黄灯点击也算抢跑。');
    }, 900)
  );

  gameState.countdownTimers.push(
    setTimeout(() => {
      setPhase('countdown_green');
      setLights('green');
      gameState.greenAt = performance.now();
      addLog('绿灯！电脑车已经起跑，快点“起步 / 踩油门”！');
      startRaceMotion();
    }, 1850)
  );
}

function pressStart() {
  if (['countdown_red', 'countdown_yellow'].includes(gameState.phase)) {
    handleFalseStart();
    return;
  }

  if (!['countdown_green', 'racing'].includes(gameState.phase) || gameState.playerStarted) {
    return;
  }

  startPlayerCar();
}

function handleFalseStart() {
  const falseStartPhase = gameState.phase;
  clearRaceTimers();
  gameState.playerStarted = false;
  gameState.lastRank = '犯规';
  setPhase('false_start');
  setLights('red');
  addLog(`${falseStartPhase === 'countdown_yellow' ? '黄灯' : '红灯'}抢跑犯规！`);
  addLog('本场成绩无效，奖金 0 元，报名费不退。');
  finishPostRace();
}

function startRaceMotion() {
  if (gameState.raceTimer) {
    return;
  }

  gameState.raceStartedAt = performance.now();
  gameState.lastRaceTickAt = gameState.raceStartedAt;
  gameState.raceAccumulator = 0;
  gameState.cars.forEach((car) => {
    if (!car.isPlayer) {
      car.started = true;
      car.launchBonus = car.power.launch;
    }
  });

  setPhase('racing');
  gameState.raceTimer = requestAnimationFrame(raceLoop);
}

function raceLoop(now) {
  if (!gameState.raceTimer || gameState.phase !== 'racing') {
    return;
  }

  gameState.raceAccumulator += now - gameState.lastRaceTickAt;
  gameState.lastRaceTickAt = now;

  while (
    gameState.raceAccumulator >= TICK_MS &&
    gameState.raceTimer &&
    gameState.phase === 'racing'
  ) {
    tickRace();
    gameState.raceAccumulator -= TICK_MS;
  }

  if (gameState.raceTimer && gameState.phase === 'racing') {
    gameState.raceTimer = requestAnimationFrame(raceLoop);
  }
}

function startPlayerCar() {
  const playerCar = gameState.cars.find((car) => car.isPlayer);
  const now = performance.now();
  const reactionSeconds = (now - gameState.greenAt) / 1000;
  const reactionBonus = clamp(0.45 - reactionSeconds, 0, 0.35);
  const slowPenalty = clamp(reactionSeconds - 0.65, 0, 1.2);

  gameState.reactionTime = reactionSeconds;
  gameState.playerStarted = true;
  playerCar.started = true;
  playerCar.reactionPenalty = slowPenalty;
  playerCar.launchBonus = playerCar.power.launch + reactionBonus;

  addLog(`你起步反应时间：${reactionSeconds.toFixed(3)} 秒`);
  if (reactionSeconds < 0.25) {
    addLog('无违规，起步完美！');
  } else if (reactionSeconds < 0.55) {
    addLog('合法起步，反应还行。');
  } else {
    addLog('起步偏慢，电脑车已经拉开。');
  }
  updateResultMessage();
  updateButtons();
}

function tickRace() {
  const now = performance.now();
  const elapsed = (now - gameState.raceStartedAt) / 1000;

  gameState.cars.forEach((car) => {
    if (!car.started || car.finishTime !== null) {
      return;
    }

    const stabilityNoise =
      (18 - clamp(car.power.stability, 1, 18)) * randomBetween(-0.0018, 0.0024);
    const midBoost = car.position > 34 && car.position < 78 ? car.power.mid * 0.012 : 0;
    const launchFade = Math.max(0, 1 - elapsed / 1.2) * car.launchBonus * 0.08;

    // The formula is intentionally blunt so upgrades visibly move the car faster.
    car.currentSpeed += car.power.acceleration + stabilityNoise;
    car.currentSpeed = clamp(car.currentSpeed, 0.28, 2.2);
    car.position +=
      car.power.base + car.currentSpeed + midBoost + launchFade - car.reactionPenalty * 0.035;

    if (car.position >= FINISH) {
      car.position = FINISH;
      car.finishTime = now;
      addLog(`${car.name} 冲线。`);
    }
  });

  updateCarPositions();

  const playerCar = gameState.cars.find((car) => car.isPlayer);
  const opponentsFinished = gameState.cars.every((car) => car.isPlayer || car.finishTime !== null);
  if (playerCar && !playerCar.started && opponentsFinished) {
    el.resultMessage.textContent = '电脑车已完赛，仍可点击起步完成本场。';
  }

  if (gameState.cars.every((car) => car.finishTime !== null)) {
    completeRace();
  }
}

function completeRace() {
  clearRaceTimers();

  const ranked = gameState.cars.slice().sort((a, b) => {
    if (a.finishTime === null && b.finishTime === null) return 0;
    if (a.finishTime === null) return 1;
    if (b.finishTime === null) return -1;
    return a.finishTime - b.finishTime;
  });

  const playerRank = ranked.findIndex((car) => car.isPlayer) + 1;
  const prize = PRIZES[playerRank - 1] || 0;

  gameState.cash += prize;
  gameState.raceCount += 1;
  gameState.lastRank = `第 ${playerRank} 名`;
  setPhase('finished');
  setLights('none');

  addLog('比赛结束！');
  addLog(`本场排名：第 ${playerRank} 名`);
  addLog(`获得奖金 ${prize} 元`);
  finishPostRace();
}

function finishPostRace() {
  refreshShop();
  addLog('商店已刷新');
  addLog(`现金余额：${gameState.cash} 元`);
  updateStats();
}

function nextRace() {
  clearRaceTimers();
  gameState.reactionTime = null;
  gameState.playerStarted = false;
  gameState.panelReturnPhase = 'idle';
  resetCars();
  setLights('none');
  setPhase('idle');
  addLog('下一场准备完毕，请报名比赛。');
  updateStats();
}

function refreshShop() {
  const count = Math.floor(randomBetween(4, 7));
  gameState.shopItems = pickRandomItems(PART_POOL, count).map((part) => ({
    ...part,
    bought: false,
  }));
  renderShop();
}

function renderShop() {
  el.shopBody.innerHTML = '';

  gameState.shopItems.forEach((part, index) => {
    const card = document.createElement('article');
    card.className = 'shop-card';
    card.innerHTML = `
      <div class="card-main">
        <div class="card-title-row">
          <h3>${renderPartName(part)}</h3>
          ${renderPartRarity(part)}
        </div>
        <p>类型：${formatPartType(part.type)}</p>
        <p>效果：${part.effectText}</p>
        <strong>价格：${part.price} 元</strong>
      </div>
    `;

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = part.bought || hasOwnedPart(part) ? '已拥有' : '购买';
    button.dataset.index = String(index);
    button.addEventListener('click', () => buyPart(index));

    const reason = document.createElement('small');
    reason.className = 'card-reason';
    reason.textContent = '可购买';

    card.appendChild(button);
    card.appendChild(reason);
    el.shopBody.appendChild(card);
  });

  updateButtons();
}

function buyPart(index) {
  const part = gameState.shopItems[index];
  if (!part || part.bought) {
    return;
  }

  if (hasOwnedPart(part)) {
    addLog(`${part.name} 已经拥有，不能重复购买。`);
    renderShop();
    return;
  }

  if (gameState.cash < part.price) {
    addLog(`现金不足，买不起 ${part.name}。`);
    return;
  }

  gameState.cash -= part.price;
  const ownedPart = createOwnedPart(part);
  const equippedPart = getEquippedPart(ownedPart.type);
  gameState.inventory.push(ownedPart);
  if (!equippedPart) {
    gameState.equippedParts[ownedPart.type] = ownedPart.id;
    recalculatePlayerStats();
  }
  part.bought = true;

  addLog(`购买 ${part.name}，${part.effectText}，花费 ${part.price} 元。`);
  addLog(`${ownedPart.name} 已进入仓库。`);
  if (equippedPart) {
    addLog(
      `${formatPartType(ownedPart.type)}槽已有 ${equippedPart.name}，如需替换请去仓库手动换装。`
    );
  } else {
    addLog(`${formatPartType(ownedPart.type)}槽为空，已自动装备 ${ownedPart.name}。`);
  }
  updateStats();
  renderShop();
  renderGarage();
}

function renderGarage() {
  el.garageSlotsBody.innerHTML = '';
  el.garageInventoryBody.innerHTML = '';

  EQUIPMENT_SLOTS.forEach((type) => {
    const parts = gameState.inventory.filter((part) => part.type === type);
    const equippedPart = getEquippedPart(type);
    const card = document.createElement('article');
    card.className = 'slot-card';

    const select = document.createElement('select');
    select.dataset.slot = type;
    select.setAttribute('aria-label', `${formatPartType(type)}槽位`);

    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = parts.length > 0 ? '无部件' : '无可用零件';
    select.appendChild(emptyOption);

    parts.forEach((part) => {
      const option = document.createElement('option');
      option.value = String(part.id);
      option.textContent = formatPartOption(part, equippedPart);
      option.className = `part-quality-${getPartRarity(part)}`;
      select.appendChild(option);
    });

    select.value = equippedPart ? String(equippedPart.id) : '';
    select.className = equippedPart ? `part-quality-${getPartRarity(equippedPart)}` : '';
    select.addEventListener('change', () => changeEquipment(type, select.value));

    const details = document.createElement('div');
    details.innerHTML = `
      <h3>${formatPartType(type)}</h3>
      <p>${equippedPart ? `当前：${renderPartName(equippedPart, true)}` : '当前：未装备'}</p>
      ${
        equippedPart
          ? renderPartComparison(equippedPart, equippedPart)
          : '<small>没有装备效果</small>'
      }
    `;

    const choices = document.createElement('div');
    choices.className = 'slot-choices';
    if (parts.length > 0) {
      choices.innerHTML = `
        <small class="part-compare-label">可选零件对比</small>
        <ul class="part-option-list">
          ${parts
            .map((part) => {
              const equipped = equippedPart && equippedPart.id === part.id;
              return `
                <li class="part-option-row${equipped ? ' is-current' : ''}">
                  <div class="part-option-heading">
                    ${renderPartName(part, true)}
                    <button
                      type="button"
                      class="part-option-button"
                      data-action="equip-slot"
                      data-part-id="${part.id}"
                      ${equipped ? 'disabled' : ''}
                    >
                      ${equipped ? '已装备' : '装备'}
                    </button>
                  </div>
                  ${renderPartComparison(part, equippedPart)}
                </li>
              `;
            })
            .join('')}
        </ul>
      `;
    } else {
      choices.innerHTML = '<small>当前槽位还没有可用零件。</small>';
    }
    Array.from(choices.querySelectorAll('[data-action="equip-slot"]')).forEach((button) => {
      button.addEventListener('click', () => changeEquipment(type, button.dataset.partId));
    });

    card.appendChild(details);
    card.appendChild(select);
    card.appendChild(choices);
    el.garageSlotsBody.appendChild(card);
  });

  if (gameState.inventory.length === 0) {
    const emptyCard = document.createElement('article');
    emptyCard.className = 'inventory-card';
    emptyCard.innerHTML = `
      <div>
        <h3>暂无零件</h3>
        <p>去商店购买零件后会显示在这里。</p>
      </div>
    `;
    el.garageInventoryBody.appendChild(emptyCard);
  } else {
    gameState.inventory.forEach((part) => {
      const equipped = gameState.equippedParts[part.type] === part.id;
      const equippedPart = getEquippedPart(part.type);
      const card = document.createElement('article');
      card.className = `inventory-card${equipped ? ' is-current' : ''}`;
      card.innerHTML = `
        <div>
          <div class="card-title-row">
            <h3>${renderPartName(part, true)}</h3>
            ${renderPartRarity(part)}
          </div>
          <p>类型：${formatPartType(part.type)}</p>
          ${renderPartComparison(part, equippedPart)}
          <small>${equipped ? '当前车辆已装备' : '仓库零件，可出售'}</small>
        </div>
      `;

      const sellButton = document.createElement('button');
      sellButton.type = 'button';
      sellButton.textContent = equipped ? '卸下' : `出售 ${getPartSellPrice(part)} 元`;
      sellButton.dataset.partId = String(part.id);
      sellButton.dataset.action = equipped ? 'unequip' : 'sell';
      sellButton.addEventListener('click', () => {
        if (equipped) {
          unequipPart(part.id);
        } else {
          sellPart(part.id);
        }
      });
      card.appendChild(sellButton);
      el.garageInventoryBody.appendChild(card);
    });
  }

  updateButtons();
}

function changeEquipment(type, value) {
  if (!canManageStorage()) {
    return;
  }

  const oldPart = getEquippedPart(type);
  const nextPart = value ? getPartById(Number(value)) : null;
  if (nextPart && nextPart.type !== type) {
    return;
  }

  gameState.equippedParts[type] = nextPart ? nextPart.id : null;
  recalculatePlayerStats();

  if (oldPart && nextPart) {
    addLog(`${formatPartType(type)}槽：${oldPart.name} 换成 ${nextPart.name}。`);
  } else if (nextPart) {
    addLog(`${nextPart.name} 已装到${formatPartType(type)}槽。`);
  } else if (oldPart) {
    addLog(`${formatPartType(type)}槽卸下 ${oldPart.name}。`);
  }

  updateStats();
  renderGarage();
  checkGameFailure();
}

function unequipPart(partId) {
  if (!canManageStorage()) {
    return;
  }

  const part = getPartById(partId);
  if (!part || gameState.equippedParts[part.type] !== part.id) {
    return;
  }

  gameState.equippedParts[part.type] = null;
  recalculatePlayerStats();
  addLog(`${formatPartType(part.type)}槽卸下 ${part.name}。`);
  updateStats();
  renderGarage();
  checkGameFailure();
}

function sellPart(partId) {
  if (!canManageStorage()) {
    return;
  }

  const part = getPartById(partId);
  if (!part) {
    return;
  }

  if (gameState.equippedParts[part.type] === part.id) {
    addLog(`${part.name} 正在装车，先在${formatPartType(part.type)}槽切换或卸下。`);
    renderGarage();
    return;
  }

  const sellPrice = getPartSellPrice(part);
  gameState.inventory = gameState.inventory.filter((ownedPart) => ownedPart.id !== part.id);
  gameState.cash += sellPrice;

  addLog(`仓库出售 ${part.name}，回收 ${sellPrice} 元。`);
  addLog(`现金余额：${gameState.cash} 元`);
  updateStats();
  renderGarage();
  checkGameFailure();
}

function saveGame() {
  if (isRaceLockedPhase(gameState.phase)) {
    addLog('比赛进行中不能保存，请等本场结束。');
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(createSaveData()));
    addLog('存档已保存到浏览器。');
  } catch (error) {
    addLog('存档失败：浏览器拒绝写入 localStorage。');
  }
}

function loadGame() {
  if (isRaceLockedPhase(gameState.phase)) {
    addLog('比赛进行中不能读取，请等本场结束。');
    return;
  }

  let rawData = null;
  try {
    rawData = localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    addLog('读取失败：浏览器拒绝访问 localStorage。');
    return;
  }

  if (!rawData) {
    addLog('没有找到本地存档。');
    return;
  }

  let parsedData = null;
  try {
    parsedData = JSON.parse(rawData);
  } catch (error) {
    addLog('读取失败：存档数据格式损坏。');
    return;
  }

  const saveData = sanitizeSaveData(parsedData);
  if (!saveData) {
    addLog('读取失败：存档数据不完整。');
    return;
  }

  applyPersistentState(saveData);
  refreshAfterPersistentChange();
  addLog('存档已读取，仓库、商店、状态栏和日志已刷新。');
}

function resetPersistentState() {
  gameState.cash = 1500;
  gameState.raceCount = 0;
  gameState.lastRank = '-';
  gameState.greenAt = 0;
  gameState.reactionTime = null;
  gameState.playerStarted = false;
  gameState.panelReturnPhase = 'idle';
  gameState.restartArmed = false;
  gameState.inventory = [];
  gameState.equippedParts = createEmptyEquippedParts();
  gameState.nextPartId = 1;
  recalculatePlayerStats();
}

function restartGame() {
  if (isRaceLockedPhase(gameState.phase)) {
    addLog('比赛进行中不能重开，请等本场结束。');
    return;
  }

  if (!gameState.restartArmed) {
    gameState.restartArmed = true;
    el.restartBtn.textContent = '再次点击确认重开';
    addLog('再次点击“重开”会清除当前进度和本地存档。');
    clearTimeout(gameState.restartArmedTimer);
    gameState.restartArmedTimer = setTimeout(() => {
      gameState.restartArmed = false;
      el.restartBtn.textContent = '重开';
    }, 4500);
    return;
  }

  clearTimeout(gameState.restartArmedTimer);
  gameState.restartArmed = false;
  el.restartBtn.textContent = '重开';

  clearRaceTimers();
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    addLog('本地存档清除失败，但当前进度会重置。');
  }

  resetPersistentState();
  el.logOutput.textContent = '';
  refreshAfterPersistentChange();
  addLog('游戏已重开。');
  addLog('先报名比赛，等绿灯后点“起步 / 踩油门”。');
}

function clearRaceTimers() {
  gameState.countdownTimers.forEach((timer) => clearTimeout(timer));
  gameState.countdownTimers = [];

  if (gameState.raceTimer) {
    cancelAnimationFrame(gameState.raceTimer);
    gameState.raceTimer = null;
  }
  gameState.lastRaceTickAt = 0;
  gameState.raceAccumulator = 0;
}

function bindEvents() {
  el.registerBtn.addEventListener('click', registerRace);
  el.startBtn.addEventListener('click', pressStart);
  el.nextBtn.addEventListener('click', nextRace);
  el.saveBtn.addEventListener('click', saveGame);
  el.loadBtn.addEventListener('click', loadGame);
  el.restartBtn.addEventListener('click', restartGame);
  el.tabs.forEach((tab) => {
    tab.addEventListener('click', () => setActivePage(tab.dataset.page));
  });
}

function init() {
  bindEvents();
  resetCars();
  refreshShop();
  renderGarage();
  setPhase('idle');
  setActivePage('race');
  setLights('none');
  updateStats();
  addLog('横线赛车经营赛启动。');
  addLog('先报名比赛，等绿灯后点“起步 / 踩油门”。红灯或黄灯点击会抢跑。');
}

init();
