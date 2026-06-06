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
  rare: '稀有',
  epic: '史诗',
  legendary: '传说',
  mythic: '神话',
};

const PART_RARITY_ORDER = ['common', 'rare', 'epic', 'legendary', 'mythic'];

const PART_RARITY_WEIGHTS = {
  common: 70,
  rare: 22,
  epic: 6,
  legendary: 1.6,
  mythic: 0.4,
};

const SHOP_OWNED_PART_WEIGHT = 0.2;
const OPPONENT_CHASE_START_RACE = 6;
const OPPONENT_CHASE_RAMP_RACES = 14;
const OPPONENT_CHASE_CAP = 1.05;

// 旧存档/旧数据的稀有度迁移表：uncommon 统一并入 rare。
const PART_RARITY_MIGRATIONS = {
  uncommon: 'rare',
};

const DIFFICULTIES = {
  easy: {
    name: '休闲',
    opponentMultiplier: 0.98,
    rewardMultiplier: 0.8,
    dropRateMultiplier: 1.2,
    entryFeeMultiplier: 0.8,
    chaseRate: 0.02,
  },
  normal: {
    name: '标准',
    opponentMultiplier: 1.12,
    rewardMultiplier: 1.0,
    dropRateMultiplier: 1.0,
    entryFeeMultiplier: 1.0,
    chaseRate: 0.06,
  },
  hard: {
    name: '挑战',
    opponentMultiplier: 1.2,
    rewardMultiplier: 1.25,
    dropRateMultiplier: 0.85,
    entryFeeMultiplier: 1.3,
    chaseRate: 0.12,
  },
  expert: {
    name: '专家',
    opponentMultiplier: 1.42,
    rewardMultiplier: 1.6,
    dropRateMultiplier: 0.65,
    entryFeeMultiplier: 1.7,
    chaseRate: 0.24,
  },
  nightmare: {
    name: '噩梦',
    opponentMultiplier: 1.56,
    rewardMultiplier: 2.2,
    dropRateMultiplier: 0.45,
    entryFeeMultiplier: 2.4,
    chaseRate: 0.3,
  },
};

const DIFFICULTY_ORDER = ['easy', 'normal', 'hard', 'expert', 'nightmare'];
const DEFAULT_DIFFICULTY = 'normal';

// 各难度商店奖池允许出现的稀有度范围。
// 商店出现概率仅由 LOOT_POOLS + PART_RARITY_WEIGHTS 决定；
// dropRateMultiplier 不参与商店概率，预留给后续比赛掉落系统。
const LOOT_POOLS = {
  easy: ['common', 'rare'],
  normal: ['common', 'rare', 'epic'],
  hard: ['rare', 'epic', 'legendary'],
  expert: ['rare', 'epic', 'legendary'],
  nightmare: ['epic', 'legendary', 'mythic'],
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
    rarity: 'rare',
    effectText: '引擎 +7，马力 +6，重量 +4kg',
    changes: { engine: 7, hp: 6, weight: 4 },
  },
  {
    name: '高压燃油泵',
    type: 'Engine',
    price: 1250,
    rarity: 'epic',
    effectText: '引擎 +10，马力 +10，稳定性 -3',
    changes: { engine: 10, hp: 10, stability: -3 },
  },
  {
    name: '竞速引擎',
    type: 'Engine',
    price: 1800,
    rarity: 'rare',
    effectText: '引擎 +13，马力 +16，稳定性 -5',
    changes: { engine: 13, hp: 16, stability: -5 },
  },
  {
    name: '厂队封存红头机',
    type: 'Engine',
    price: 3600,
    rarity: 'legendary',
    effectText: '引擎 +22，马力 +30，稳定性 -9，重量 +20kg',
    changes: { engine: 22, hp: 30, stability: -9, weight: 20 },
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
    rarity: 'epic',
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
    effectText: '轮胎 +8，稳定性 +5，重量 +10kg',
    changes: { tire: 8, stability: 5, weight: 10 },
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
    rarity: 'rare',
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
    rarity: 'epic',
    effectText: '变速箱 +11，马力 +3，重量 +5kg',
    changes: { gearbox: 11, hp: 3, weight: 5 },
  },
  {
    name: '序列式拨片盒',
    type: 'Gearbox',
    price: 2400,
    rarity: 'rare',
    effectText: '变速箱 +15，稳定性 -3，重量 +8kg',
    changes: { gearbox: 15, stability: -3, weight: 8 },
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
    rarity: 'rare',
    effectText: '重量 -32kg，稳定性 -4',
    changes: { weight: -32, stability: -4 },
  },
  {
    name: '铆钉宽体套件',
    type: 'Body',
    price: 1200,
    rarity: 'rare',
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
    rarity: 'rare',
    effectText: '马力 +10，稳定性 +1，重量 +5kg',
    changes: { hp: 10, stability: 1, weight: 5 },
  },
  {
    name: '大口径节气门',
    type: 'Intake',
    price: 1300,
    rarity: 'epic',
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
    effectText: '马力 +20，引擎 +7，稳定性 -3',
    changes: { hp: 20, engine: 7, stability: -3 },
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
    rarity: 'rare',
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
    effectText: '马力 +16，引擎 +4，稳定性 -4',
    changes: { hp: 16, engine: 4, stability: -4 },
  },
  {
    name: '午夜噪声投诉套件',
    type: 'Exhaust',
    price: 3200,
    rarity: 'legendary',
    effectText: '马力 +22，引擎 +6，稳定性 -6，重量 -4kg',
    changes: { hp: 22, engine: 6, stability: -6, weight: -4 },
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
    rarity: 'epic',
    effectText: '马力 +20，引擎 +8，稳定性 -5，重量 +12kg',
    changes: { hp: 20, engine: 8, stability: -5, weight: 12 },
  },
  {
    name: '低延迟滚珠涡轮',
    type: 'Turbo',
    price: 2500,
    rarity: 'rare',
    effectText: '马力 +20，引擎 +8，稳定性 -5，重量 +9kg',
    changes: { hp: 20, engine: 8, stability: -5, weight: 9 },
  },
  {
    name: '大蜗牛高压套',
    type: 'Turbo',
    price: 2900,
    rarity: 'rare',
    effectText: '马力 +30，引擎 +10，稳定性 -10，重量 +18kg',
    changes: { hp: 30, engine: 10, stability: -10, weight: 18 },
  },
  {
    name: '禁区增压黑盒',
    type: 'Turbo',
    price: 4300,
    rarity: 'legendary',
    effectText: '马力 +42，引擎 +16，稳定性 -15，重量 +22kg',
    changes: { hp: 42, engine: 16, stability: -15, weight: 22 },
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
    rarity: 'rare',
    effectText: '稳定性 +8，轮胎 +2',
    changes: { stability: 8, tire: 2 },
  },
  {
    name: '防火墙补强板',
    type: 'Stability',
    price: 950,
    rarity: 'epic',
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

  // ===== v1.4 新增改装件：均带取舍副作用，优先补 epic / legendary / mythic =====
  {
    name: '锻造高压活塞',
    type: 'Engine',
    price: 2050,
    rarity: 'epic',
    effectText: '引擎 +16，马力 +10，稳定性 -8',
    changes: { engine: 16, hp: 10, stability: -8 },
  },
  {
    name: '航空燃料调校机',
    type: 'Engine',
    price: 5200,
    rarity: 'mythic',
    effectText: '引擎 +29，马力 +38，稳定性 -18，重量 +24kg',
    changes: { engine: 29, hp: 38, stability: -18, weight: 24 },
  },
  {
    name: '全热熔光头胎',
    type: 'Tire',
    price: 2150,
    rarity: 'epic',
    effectText: '轮胎 +14，稳定性 +7，重量 +12kg',
    changes: { tire: 14, stability: 7, weight: 12 },
  },
  {
    name: '碳陶刹车套装',
    type: 'Stability',
    price: 3300,
    rarity: 'legendary',
    effectText: '稳定性 +18，重量 -8kg，马力 -3',
    changes: { stability: 18, weight: -8, hp: -3 },
  },
  {
    name: '主动差速控制器',
    type: 'Gearbox',
    price: 2300,
    rarity: 'epic',
    effectText: '变速箱 +15，稳定性 +3，重量 +8kg',
    changes: { gearbox: 15, stability: 3, weight: 8 },
  },
  {
    name: '镁合金竞技壳',
    type: 'Body',
    price: 4600,
    rarity: 'mythic',
    effectText: '重量 -90kg，稳定性 -8，马力 +8',
    changes: { weight: -90, stability: -8, hp: 8 },
  },
  {
    name: '一级方程式头段',
    type: 'Exhaust',
    price: 3600,
    rarity: 'legendary',
    effectText: '马力 +25，引擎 +8，稳定性 -8，重量 -8kg',
    changes: { hp: 25, engine: 8, stability: -8, weight: -8 },
  },
  {
    name: '氮气加速瓶',
    type: 'Intake',
    price: 2400,
    rarity: 'epic',
    effectText: '马力 +20，引擎 +5，稳定性 -11',
    changes: { hp: 20, engine: 5, stability: -11 },
  },
  {
    name: '可变截面涡轮',
    type: 'Turbo',
    price: 3700,
    rarity: 'epic',
    effectText: '马力 +27，引擎 +10，稳定性 -7，重量 +11kg',
    changes: { hp: 27, engine: 10, stability: -7, weight: 11 },
  },
  {
    name: '军规增压核心',
    type: 'Turbo',
    price: 6200,
    rarity: 'mythic',
    effectText: '马力 +52，引擎 +20，稳定性 -22，重量 +26kg',
    changes: { hp: 52, engine: 20, stability: -22, weight: 26 },
  },

  // ===== 各类型神话补全：轮胎 / 变速箱 / 进气 / 排气 / 稳定件 =====
  {
    name: '赛道之神热熔胎',
    type: 'Tire',
    price: 5400,
    rarity: 'mythic',
    effectText: '轮胎 +24，稳定性 +16，重量 +20kg',
    changes: { tire: 24, stability: 16, weight: 20 },
  },
  {
    name: '零延迟序列变速箱',
    type: 'Gearbox',
    price: 5600,
    rarity: 'mythic',
    effectText: '变速箱 +30，引擎 +10，稳定性 -12，重量 +6kg',
    changes: { gearbox: 30, engine: 10, stability: -12, weight: 6 },
  },
  {
    name: '赛用氮氧加速系统',
    type: 'Intake',
    price: 5400,
    rarity: 'mythic',
    effectText: '马力 +46，引擎 +12，稳定性 -22，重量 +4kg',
    changes: { hp: 46, engine: 12, stability: -22, weight: 4 },
  },
  {
    name: '钛合金全段排气总成',
    type: 'Exhaust',
    price: 5800,
    rarity: 'mythic',
    effectText: '马力 +40，引擎 +16，稳定性 -13，重量 -16kg',
    changes: { hp: 40, engine: 16, stability: -13, weight: -16 },
  },
  {
    name: '主动液压悬挂系统',
    type: 'Stability',
    price: 5600,
    rarity: 'mythic',
    effectText: '稳定性 +32，轮胎 +6，重量 +34kg，马力 -4',
    changes: { stability: 32, tire: 6, weight: 34, hp: -4 },
  },
];
