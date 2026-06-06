#!/usr/bin/env node
/* eslint-disable no-console */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { performance } from 'node:perf_hooks';

const ROOT_DIR = path.resolve(import.meta.dirname, '..');
const SOURCE_FILES = {
  config: path.join(ROOT_DIR, 'lab-public/race/scripts/config.js'),
  core: path.join(ROOT_DIR, 'lab-public/race/scripts/core.js'),
  race: path.join(ROOT_DIR, 'lab-public/race/scripts/race.js'),
};

const DEFAULT_CHECKPOINTS = [0, 8, 18];
const DEFAULT_REACTION_SECONDS = 0.38;
const DEFAULT_SAMPLE_COUNT = 320;
const DEFAULT_TOP_K = 24;
const DEFAULT_FOCUS = {
  easy: [0, 8],
  normal: [0, 8],
  hard: [8, 18],
  expert: [8, 18],
  nightmare: [8, 18],
};

const PERSONALITY_BY_ID = {
  2: 0.02,
  3: 0.05,
  4: -0.04,
  5: 0,
};

const MEAN_RANDOMS = {
  variance: 0.02,
  acceleration: 0.0005,
  launch: 0.025,
  mid: 0.01,
  stability: 0.5,
};

const DIFFICULTY_TARGETS = {
  easy: { stableWinRate: 0.62, budgetWinRate: 0.55, lateFloor: 0.52 },
  normal: { stableWinRate: 0.58, budgetWinRate: 0.5, lateFloor: 0.48 },
  hard: { stableWinRate: 0.48, budgetWinRate: 0.4, lateFloor: 0.42 },
  expert: { stableWinRate: 0.42, budgetWinRate: 0.36, lateFloor: 0.38 },
  nightmare: { stableWinRate: 0.34, budgetWinRate: 0.25, lateFloor: 0.3 },
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value, digits = 2) {
  return Number(value).toFixed(digits);
}

function createHash(input) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createMulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function randomBetween(rng, min, max) {
  return min + rng() * (max - min);
}

function parseArgs(argv) {
  const args = {
    checkpoints: DEFAULT_CHECKPOINTS.slice(),
    reactionSeconds: DEFAULT_REACTION_SECONDS,
    sampleCount: DEFAULT_SAMPLE_COUNT,
    topK: DEFAULT_TOP_K,
    difficultyFilter: null,
    seed: 'race-balance-check',
  };

  argv.forEach((arg) => {
    if (arg.startsWith('--checkpoints=')) {
      args.checkpoints = arg
        .slice('--checkpoints='.length)
        .split(',')
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isFinite(value) && value >= 0)
        .sort((left, right) => left - right);
    } else if (arg.startsWith('--reaction=')) {
      const value = Number(arg.slice('--reaction='.length));
      if (Number.isFinite(value) && value >= 0) {
        args.reactionSeconds = value;
      }
    } else if (arg.startsWith('--samples=')) {
      const value = Number(arg.slice('--samples='.length));
      if (Number.isInteger(value) && value > 0) {
        args.sampleCount = value;
      }
    } else if (arg.startsWith('--top=')) {
      const value = Number(arg.slice('--top='.length));
      if (Number.isInteger(value) && value > 0) {
        args.topK = value;
      }
    } else if (arg.startsWith('--difficulty=')) {
      const value = arg.slice('--difficulty='.length).trim();
      args.difficultyFilter = value || null;
    } else if (arg.startsWith('--seed=')) {
      args.seed = arg.slice('--seed='.length) || args.seed;
    }
  });

  if (args.checkpoints.length === 0) {
    args.checkpoints = DEFAULT_CHECKPOINTS.slice();
  }

  return args;
}

function loadRaceData() {
  Object.values(SOURCE_FILES).forEach((filePath) => {
    fs.accessSync(filePath, fs.constants.R_OK);
  });

  const configCode = fs.readFileSync(SOURCE_FILES.config, 'utf8');
  const coreSource = fs.readFileSync(SOURCE_FILES.core, 'utf8');
  const raceSource = fs.readFileSync(SOURCE_FILES.race, 'utf8');

  const context = { console };
  vm.createContext(context);
  vm.runInContext(
    `${configCode}
globalThis.__raceBalanceData = {
  BASE_PLAYER_STATS,
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  ENTRY_FEE,
  EQUIPMENT_SLOTS,
  FINISH,
  LOOT_POOLS,
  OPPONENT_CHASE_CAP,
  OPPONENT_CHASE_RAMP_RACES,
  OPPONENT_CHASE_START_RACE,
  PART_POOL,
  PRIZES,
  TICK_MS,
};`,
    context,
    { filename: SOURCE_FILES.config }
  );

  return {
    ...context.__raceBalanceData,
    sourceText: {
      core: coreSource,
      race: raceSource,
    },
  };
}

function validateSourceTexts(sourceText) {
  const requiredCoreTokens = ['function getDifficultyEntryFee', 'Math.round((ENTRY_FEE * multiplier)'];
  const requiredRaceTokens = [
    'function getPlayerPower',
    'function getPlayerRating',
    'function getOpponentPower',
    'function getOpponentCarPower',
    'function tickRace',
  ];

  requiredCoreTokens.forEach((token) => {
    if (!sourceText.core.includes(token)) {
      throw new Error(`未在 core.js 中找到关键公式片段：${token}`);
    }
  });

  requiredRaceTokens.forEach((token) => {
    if (!sourceText.race.includes(token)) {
      throw new Error(`未在 race.js 中找到关键公式片段：${token}`);
    }
  });
}

function buildDifficultyOptions(raceData, difficultyKey) {
  const allowedRarities = new Set(raceData.LOOT_POOLS[difficultyKey] || []);

  return raceData.EQUIPMENT_SLOTS.map((slot) => {
    const options = [
      {
        slot,
        key: `${slot}:none`,
        name: '-',
        rarity: 'none',
        price: 0,
        engine: 0,
        tire: 0,
        gearbox: 0,
        stability: 0,
        weight: 0,
        hp: 0,
      },
    ];

    raceData.PART_POOL.forEach((part) => {
      if (part.type !== slot || !allowedRarities.has(part.rarity)) {
        return;
      }

      options.push({
        slot,
        key: `${slot}:${part.name}`,
        name: part.name,
        rarity: part.rarity,
        price: part.price,
        engine: Number(part.changes.engine || 0),
        tire: Number(part.changes.tire || 0),
        gearbox: Number(part.changes.gearbox || 0),
        stability: Number(part.changes.stability || 0),
        weight: Number(part.changes.weight || 0),
        hp: Number(part.changes.hp || 0),
      });
    });

    return options;
  });
}

function computeEntryFee(raceData, difficultyKey) {
  const difficulty = raceData.DIFFICULTIES[difficultyKey];
  const multiplier = difficulty && difficulty.entryFeeMultiplier ? difficulty.entryFeeMultiplier : 1;
  return Math.round((raceData.ENTRY_FEE * multiplier) / 10) * 10;
}

function computePlayerStats(raceData, totals) {
  return {
    engine: totals.engine,
    tire: totals.tire,
    gearbox: totals.gearbox,
    stability: clamp(totals.stability, 1, 80),
    weight: clamp(totals.weight, 760, 1250),
    hp: totals.hp,
  };
}

function computePlayerPower(stats) {
  const weightPenalty = (stats.weight - 1000) / 85;
  const lowStabilityPenalty = Math.max(0, 8 - clamp(stats.stability, 1, 8));
  return {
    base:
      0.53 +
      stats.hp / 580 +
      stats.engine / 165 -
      weightPenalty / 75 -
      lowStabilityPenalty * 0.045,
    acceleration:
      0.02 + stats.engine / 3800 + stats.gearbox / 4500 - lowStabilityPenalty * 0.0012,
    launch: stats.tire / 85,
    mid: stats.gearbox / 195 - lowStabilityPenalty * 0.01,
    stability: clamp(stats.stability, 1, 80),
  };
}

function computePlayerRating(stats) {
  return (
    stats.hp * 0.0026 +
    stats.engine * 0.019 +
    stats.gearbox * 0.014 +
    stats.tire * 0.02 +
    stats.stability * 0.012 -
    Math.max(0, stats.weight - 1000) * 0.0012
  );
}

function computeOpponentStrength(raceData, difficultyKey, raceCount, playerRating) {
  const difficulty = raceData.DIFFICULTIES[difficultyKey];
  let base;

  if (raceCount < 5) {
    base = 1 + raceCount * 0.1;
  } else if (raceCount < 12) {
    base = 1.45 + (raceCount - 5) * 0.07;
  } else {
    base = Math.min(2.35, 1.95 + (raceCount - 12) * 0.035);
  }

  const growth = Math.min(raceCount * 0.015, 1.5);
  const scaledBase = base * (1 + growth * 0.18) * difficulty.opponentMultiplier;
  const lateGameFactor = clamp(
    (raceCount - raceData.OPPONENT_CHASE_START_RACE) / raceData.OPPONENT_CHASE_RAMP_RACES,
    0,
    1
  );
  const chaseBonus = clamp(
    playerRating * (difficulty.chaseRate || 0) * lateGameFactor,
    0,
    raceData.OPPONENT_CHASE_CAP
  );

  return scaledBase + chaseBonus;
}

function computeOpponentPowerFromStrength(opponentStrength, id, rng) {
  const lateBoost = Math.max(0, opponentStrength - 2.2);

  return {
    base:
      0.53 +
      opponentStrength * 0.092 +
      lateBoost * 0.048 +
      randomBetween(rng, -0.05, 0.09) +
      (PERSONALITY_BY_ID[id] || 0),
    acceleration:
      0.021 +
      opponentStrength * 0.0023 +
      lateBoost * 0.0008 +
      randomBetween(rng, -0.0015, 0.0025),
    launch:
      0.1 +
      opponentStrength * 0.017 +
      lateBoost * 0.0045 +
      randomBetween(rng, 0, 0.05),
    mid:
      0.08 +
      opponentStrength * 0.023 +
      lateBoost * 0.009 +
      randomBetween(rng, -0.02, 0.04),
    stability:
      10 +
      opponentStrength * 2.2 +
      lateBoost * 2.7 +
      randomBetween(rng, -3, 4),
  };
}

function computeMeanOpponentPower(opponentStrength, id) {
  const lateBoost = Math.max(0, opponentStrength - 2.2);

  return {
    base:
      0.53 +
      opponentStrength * 0.092 +
      lateBoost * 0.048 +
      MEAN_RANDOMS.variance +
      (PERSONALITY_BY_ID[id] || 0),
    acceleration:
      0.021 +
      opponentStrength * 0.0023 +
      lateBoost * 0.0008 +
      MEAN_RANDOMS.acceleration,
    launch:
      0.1 +
      opponentStrength * 0.017 +
      lateBoost * 0.0045 +
      MEAN_RANDOMS.launch,
    mid:
      0.08 +
      opponentStrength * 0.023 +
      lateBoost * 0.009 +
      MEAN_RANDOMS.mid,
    stability:
      10 + opponentStrength * 2.2 + lateBoost * 2.7 + MEAN_RANDOMS.stability,
  };
}

function computePowerScore(power) {
  return (
    power.base * 1000 +
    power.acceleration * 42000 +
    power.launch * 140 +
    power.mid * 260 +
    power.stability * 0.4
  );
}

function computeProxyMargins(raceData, difficultyKey, checkpoints, playerRating, playerPower) {
  const playerScore = computePowerScore(playerPower);

  return checkpoints.reduce((margins, checkpoint) => {
    const opponentStrength = computeOpponentStrength(
      raceData,
      difficultyKey,
      checkpoint,
      playerRating
    );
    const meanOpponentScore =
      [2, 3, 4, 5].reduce((sum, id) => {
        return sum + computePowerScore(computeMeanOpponentPower(opponentStrength, id));
      }, 0) / 4;

    margins[checkpoint] = {
      playerScore,
      opponentScore: meanOpponentScore,
      gap: playerScore - meanOpponentScore,
      opponentStrength,
    };
    return margins;
  }, {});
}

function summarizeStatProfile(raceData, stats) {
  const positives = {
    engine: Math.max(0, stats.engine - raceData.BASE_PLAYER_STATS.engine),
    tire: Math.max(0, stats.tire - raceData.BASE_PLAYER_STATS.tire),
    gearbox: Math.max(0, stats.gearbox - raceData.BASE_PLAYER_STATS.gearbox),
    stability: Math.max(0, stats.stability - raceData.BASE_PLAYER_STATS.stability),
    hp: Math.max(0, stats.hp - raceData.BASE_PLAYER_STATS.hp),
    weight: Math.max(0, raceData.BASE_PLAYER_STATS.weight - stats.weight),
  };

  const entries = Object.entries(positives);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  const [dominantStat, dominantValue] = entries.reduce(
    (best, current) => (current[1] > best[1] ? current : best),
    ['engine', 0]
  );

  return {
    positives,
    dominantStat,
    dominantShare: total > 0 ? dominantValue / total : 0,
  };
}

function createCandidateSnapshot({
  raceData,
  difficultyKey,
  checkpoints,
  focusCheckpoints,
  selectedOptions,
  totals,
  totalCost,
}) {
  const stats = computePlayerStats(raceData, totals);
  const playerRating = computePlayerRating(stats);
  const playerPower = computePlayerPower(stats);
  const proxyMargins = computeProxyMargins(
    raceData,
    difficultyKey,
    checkpoints,
    playerRating,
    playerPower
  );
  const focusGaps = focusCheckpoints.map((checkpoint) => proxyMargins[checkpoint].gap);
  const profile = summarizeStatProfile(raceData, stats);

  return {
    difficultyKey,
    configKey: selectedOptions.map((option) => option.key).join('|'),
    options: selectedOptions.map((option) => ({
      slot: option.slot,
      name: option.name,
      rarity: option.rarity,
      price: option.price,
    })),
    stats,
    totalCost,
    playerRating,
    playerPower,
    proxyMargins,
    focus: {
      averageGap: focusGaps.reduce((sum, value) => sum + value, 0) / focusGaps.length,
      minimumGap: Math.min(...focusGaps),
    },
    profile,
    simulations: {},
  };
}

function maybePushTop(list, size, score, snapshot) {
  if (list.length < size) {
    list.push({ score, snapshot });
    list.sort((left, right) => left.score - right.score);
    return;
  }

  if (score <= list[0].score) {
    return;
  }

  list[0] = { score, snapshot };
  list.sort((left, right) => left.score - right.score);
}

function maybePushBudget(list, size, snapshot) {
  if (snapshot.focus.minimumGap < 0) {
    return;
  }

  list.push(snapshot);
  list.sort((left, right) => {
    if (left.totalCost !== right.totalCost) {
      return left.totalCost - right.totalCost;
    }
    return right.focus.minimumGap - left.focus.minimumGap;
  });

  const seen = new Set();
  const deduped = [];

  for (const candidate of list) {
    if (seen.has(candidate.configKey)) {
      continue;
    }
    seen.add(candidate.configKey);
    deduped.push(candidate);
    if (deduped.length >= size) {
      break;
    }
  }

  list.length = 0;
  list.push(...deduped);
}

function simulateRace(raceData, candidate, difficultyKey, raceCount, seed, reactionSeconds) {
  const rng = createMulberry32(seed);
  const opponentStrength = computeOpponentStrength(
    raceData,
    difficultyKey,
    raceCount,
    candidate.playerRating
  );
  const playerPower = candidate.playerPower;
  const reactionBonus = clamp(0.45 - reactionSeconds, 0, 0.35);
  const slowPenalty = clamp(reactionSeconds - 0.65, 0, 1.2);
  const startTick = Math.max(0, Math.ceil(reactionSeconds / (raceData.TICK_MS / 1000)));

  const cars = [
    {
      id: 1,
      isPlayer: true,
      position: 0,
      currentSpeed: 0,
      started: false,
      finishTick: null,
      reactionPenalty: slowPenalty,
      launchBonus: playerPower.launch + reactionBonus,
      power: playerPower,
    },
    ...[2, 3, 4, 5].map((id) => ({
      id,
      isPlayer: false,
      position: 0,
      currentSpeed: 0,
      started: true,
      finishTick: null,
      reactionPenalty: 0,
      launchBonus: 0,
      power: computeOpponentPowerFromStrength(opponentStrength, id, rng),
    })),
  ];

  for (let tick = 0; tick < 600; tick += 1) {
    const elapsed = (tick * raceData.TICK_MS) / 1000;
    if (!cars[0].started && tick >= startTick) {
      cars[0].started = true;
    }

    cars.forEach((car) => {
      if (!car.started || car.finishTick !== null) {
        return;
      }

      const stabilityNoise =
        (18 - clamp(car.power.stability, 1, 18)) * randomBetween(rng, -0.0018, 0.0024);
      const midBoost = car.position > 34 && car.position < 78 ? car.power.mid * 0.012 : 0;
      const launchFade = Math.max(0, 1 - elapsed / 1.2) * car.launchBonus * 0.08;

      car.currentSpeed += car.power.acceleration + stabilityNoise;
      car.currentSpeed = clamp(car.currentSpeed, 0.28, 2.2);
      car.position +=
        car.power.base +
        car.currentSpeed +
        midBoost +
        launchFade -
        car.reactionPenalty * 0.035;

      if (car.position >= raceData.FINISH) {
        car.position = raceData.FINISH;
        car.finishTick = tick;
      }
    });

    if (cars.every((car) => car.finishTick !== null)) {
      break;
    }
  }

  const ranked = cars
    .slice()
    .sort((left, right) => (left.finishTick ?? Number.MAX_SAFE_INTEGER) - (right.finishTick ?? Number.MAX_SAFE_INTEGER));
  const playerRank = ranked.findIndex((car) => car.isPlayer) + 1;
  const prize = raceData.PRIZES[playerRank - 1] || 0;

  return {
    playerRank,
    prize,
  };
}

function simulateCandidate({
  raceData,
  candidate,
  checkpoints,
  sampleCount,
  seedPrefix,
  reactionSeconds,
}) {
  checkpoints.forEach((checkpoint) => {
    let winCount = 0;
    let topTwoCount = 0;
    let totalRank = 0;
    let totalPrize = 0;

    for (let sample = 0; sample < sampleCount; sample += 1) {
      const seed = createHash(
        `${seedPrefix}|${candidate.difficultyKey}|${candidate.configKey}|${checkpoint}|${sample}`
      );
      const result = simulateRace(
        raceData,
        candidate,
        candidate.difficultyKey,
        checkpoint,
        seed,
        reactionSeconds
      );

      totalRank += result.playerRank;
      totalPrize += result.prize;
      if (result.playerRank === 1) {
        winCount += 1;
      }
      if (result.playerRank <= 2) {
        topTwoCount += 1;
      }
    }

    const entryFee = computeEntryFee(raceData, candidate.difficultyKey);
    candidate.simulations[checkpoint] = {
      winRate: winCount / sampleCount,
      topTwoRate: topTwoCount / sampleCount,
      averageRank: totalRank / sampleCount,
      expectedPrize: totalPrize / sampleCount,
      expectedValue: totalPrize / sampleCount - entryFee,
      repairRiskCost: 0,
    };
  });

  return candidate;
}

function getFocusStats(candidate, focusCheckpoints) {
  const simulations = focusCheckpoints.map((checkpoint) => candidate.simulations[checkpoint]);

  return {
    averageWinRate: simulations.reduce((sum, item) => sum + item.winRate, 0) / simulations.length,
    minimumWinRate: Math.min(...simulations.map((item) => item.winRate)),
    averageExpectedValue:
      simulations.reduce((sum, item) => sum + item.expectedValue, 0) / simulations.length,
    averageRank:
      simulations.reduce((sum, item) => sum + item.averageRank, 0) / simulations.length,
  };
}

function enumerateDifficulty({
  raceData,
  difficultyKey,
  checkpoints,
  topK,
}) {
  const focusCheckpoints = DEFAULT_FOCUS[difficultyKey] || checkpoints;
  const slotOptions = buildDifficultyOptions(raceData, difficultyKey);
  const selectedOptions = new Array(slotOptions.length);
  const totals = {
    engine: raceData.BASE_PLAYER_STATS.engine,
    tire: raceData.BASE_PLAYER_STATS.tire,
    gearbox: raceData.BASE_PLAYER_STATS.gearbox,
    stability: raceData.BASE_PLAYER_STATS.stability,
    weight: raceData.BASE_PLAYER_STATS.weight,
    hp: raceData.BASE_PLAYER_STATS.hp,
  };

  const tracker = {
    comboCount: 0,
    checkpointProxyPassCount: Object.fromEntries(checkpoints.map((checkpoint) => [checkpoint, 0])),
    focusProxyPassCount: 0,
    strongest: [],
    stablest: [],
    value: [],
    budget: [],
    emptyConfig: null,
  };

  function visitSlot(slotIndex, totalCost) {
    if (slotIndex >= slotOptions.length) {
      tracker.comboCount += 1;
      const snapshot = createCandidateSnapshot({
        raceData,
        difficultyKey,
        checkpoints,
        focusCheckpoints,
        selectedOptions,
        totals,
        totalCost,
      });

      checkpoints.forEach((checkpoint) => {
        if (snapshot.proxyMargins[checkpoint].gap >= 0) {
          tracker.checkpointProxyPassCount[checkpoint] += 1;
        }
      });

      if (snapshot.focus.minimumGap >= 0) {
        tracker.focusProxyPassCount += 1;
      }

      if (snapshot.options.every((option) => option.name === '-')) {
        tracker.emptyConfig = snapshot;
      }

      const strongestScore = snapshot.focus.averageGap;
      const stableScore = snapshot.focus.minimumGap;
      const valueScore = snapshot.focus.averageGap / Math.max(snapshot.totalCost, 120);

      maybePushTop(tracker.strongest, topK, strongestScore, snapshot);
      maybePushTop(tracker.stablest, topK, stableScore, snapshot);
      maybePushTop(tracker.value, topK, valueScore, snapshot);
      maybePushBudget(tracker.budget, topK, snapshot);
      return;
    }

    slotOptions[slotIndex].forEach((option) => {
      selectedOptions[slotIndex] = option;
      totals.engine += option.engine;
      totals.tire += option.tire;
      totals.gearbox += option.gearbox;
      totals.stability += option.stability;
      totals.weight += option.weight;
      totals.hp += option.hp;

      visitSlot(slotIndex + 1, totalCost + option.price);

      totals.engine -= option.engine;
      totals.tire -= option.tire;
      totals.gearbox -= option.gearbox;
      totals.stability -= option.stability;
      totals.weight -= option.weight;
      totals.hp -= option.hp;
    });
  }

  visitSlot(0, 0);

  return {
    difficultyKey,
    focusCheckpoints,
    slotOptionCounts: Object.fromEntries(
      raceData.EQUIPMENT_SLOTS.map((slot, index) => [slot, slotOptions[index].length])
    ),
    ...tracker,
  };
}

function collectUniqueCandidates(result) {
  const byKey = new Map();

  [
    ...result.strongest.map((item) => item.snapshot),
    ...result.stablest.map((item) => item.snapshot),
    ...result.value.map((item) => item.snapshot),
    ...result.budget,
    result.emptyConfig,
  ]
    .filter(Boolean)
    .forEach((candidate) => {
      byKey.set(candidate.configKey, candidate);
    });

  return [...byKey.values()];
}

function pickBestCandidate(candidates, focusCheckpoints, scoreGetter) {
  return candidates
    .slice()
    .sort((left, right) => scoreGetter(right, focusCheckpoints) - scoreGetter(left, focusCheckpoints))[0];
}

function formatConfig(candidate) {
  return candidate.options
    .filter((option) => option.name !== '-')
    .map((option) => `${option.slot}=${option.name}`)
    .join(' / ') || '全空配';
}

function buildDifficultyDiagnosis({ result, simulatedCandidates }) {
  const focusCheckpoints = result.focusCheckpoints;
  const target = DIFFICULTY_TARGETS[result.difficultyKey] || DIFFICULTY_TARGETS.normal;
  const strongest = pickBestCandidate(
    simulatedCandidates,
    focusCheckpoints,
    (candidate, focus) => getFocusStats(candidate, focus).averageWinRate
  );
  const stablest = pickBestCandidate(
    simulatedCandidates,
    focusCheckpoints,
    (candidate, focus) =>
      getFocusStats(candidate, focus).minimumWinRate * 100 - getFocusStats(candidate, focus).averageRank
  );
  const valuePool = simulatedCandidates.filter((candidate) => {
    const focusStats = getFocusStats(candidate, focusCheckpoints);
    return (
      focusStats.averageExpectedValue > 0 &&
      focusStats.minimumWinRate >= Math.max(0.18, target.budgetWinRate)
    );
  });
  const value = pickBestCandidate(valuePool, focusCheckpoints, (candidate, focus) => {
    const focusStats = getFocusStats(candidate, focus);
    return (
      focusStats.averageExpectedValue / Math.max(candidate.totalCost, 120) +
      focusStats.averageWinRate * 0.01
    );
  });
  const budget = simulatedCandidates
    .filter(
      (candidate) =>
        getFocusStats(candidate, focusCheckpoints).minimumWinRate >=
        target.budgetWinRate
    )
    .sort((left, right) => {
      if (left.totalCost !== right.totalCost) {
        return left.totalCost - right.totalCost;
      }
      return (
        getFocusStats(right, focusCheckpoints).minimumWinRate -
        getFocusStats(left, focusCheckpoints).minimumWinRate
      );
    })[0];
  const emptyStats = result.emptyConfig
    ? getFocusStats(result.emptyConfig, focusCheckpoints)
    : null;
  const strongestFocus = strongest ? getFocusStats(strongest, focusCheckpoints) : null;
  const stablestFocus = stablest ? getFocusStats(stablest, focusCheckpoints) : null;
  const valueFocus = value ? getFocusStats(value, focusCheckpoints) : null;
  const lateCheckpoint = Math.max(...focusCheckpoints);
  const lateStrongestRate = strongest ? strongest.simulations[lateCheckpoint].winRate : 0;
  const earlyCheckpoint = Math.min(...DEFAULT_CHECKPOINTS);
  const earlyStrongestRate = strongest && strongest.simulations[earlyCheckpoint]
    ? strongest.simulations[earlyCheckpoint].winRate
    : 0;
  const obviousBrailsThreshold =
    result.difficultyKey === 'nightmare' ? 0.68 : result.difficultyKey === 'hard' ? 0.78 : 0.9;
  const brainless =
    Boolean(budget) &&
    getFocusStats(budget, focusCheckpoints).minimumWinRate >= obviousBrailsThreshold;
  const impossibleGap =
    !strongest ||
    lateStrongestRate < target.lateFloor ||
    result.focusProxyPassCount === 0;

  return {
    strongest,
    stablest,
    value: value || strongest || stablest || null,
    budget,
    emptyStats,
    strongestFocus,
    stablestFocus,
    valueFocus,
    findings: {
      brainless,
      impossibleGap,
      nightmareEarlyOverrun:
        result.difficultyKey === 'nightmare' && earlyStrongestRate >= 0.7,
      singleStatSmash:
        Boolean(strongest) &&
        ['hard', 'expert', 'nightmare'].includes(result.difficultyKey) &&
        strongest.profile.dominantShare >= 0.48 &&
        strongestFocus &&
        strongestFocus.averageWinRate >= 0.55,
    },
  };
}

function printDifficultyReport({ raceData, result, diagnosis, checkpoints }) {
  const difficulty = raceData.DIFFICULTIES[result.difficultyKey];
  const focusCheckpoints = result.focusCheckpoints;
  const positiveShare = result.focusProxyPassCount / result.comboCount;
  const baseRow = {
    难度: `${result.difficultyKey} / ${difficulty.name}`,
    组合数: result.comboCount,
    焦点检查点: focusCheckpoints.join(', '),
    代理过线占比: formatPercent(positiveShare),
    报名费: computeEntryFee(raceData, result.difficultyKey),
  };

  console.log(`\n=== ${difficulty.name} (${result.difficultyKey}) ===`);
  console.table([baseRow]);
  console.table(
    checkpoints.map((checkpoint) => ({
      检查点: checkpoint,
      代理过线组合占比: formatPercent(result.checkpointProxyPassCount[checkpoint] / result.comboCount),
    }))
  );

  const rows = [
    ['最强配置', diagnosis.strongest, diagnosis.strongestFocus],
    ['最稳配置', diagnosis.stablest, diagnosis.stablestFocus],
    ['性价比配置', diagnosis.value, diagnosis.valueFocus],
  ]
    .filter(([, candidate]) => candidate)
    .map(([label, candidate, focus]) => {
      const lateCheckpoint = Math.max(...focusCheckpoints);
      const earlyCheckpoint = Math.min(...checkpoints);
      return {
        类型: label,
        成本: candidate.totalCost,
        Rating: formatNumber(candidate.playerRating, 3),
        焦点平均胜率: formatPercent(focus.averageWinRate),
        焦点最低胜率: formatPercent(focus.minimumWinRate),
        焦点平均收益: formatNumber(focus.averageExpectedValue, 1),
        早期胜率: candidate.simulations[earlyCheckpoint]
          ? formatPercent(candidate.simulations[earlyCheckpoint].winRate)
          : '-',
        后期胜率: candidate.simulations[lateCheckpoint]
          ? formatPercent(candidate.simulations[lateCheckpoint].winRate)
          : '-',
        主属性倾向: `${candidate.profile.dominantStat} ${formatPercent(
          candidate.profile.dominantShare
        )}`,
      };
    });

  console.table(rows);

  [
    ['最强配置', diagnosis.strongest],
    ['最稳配置', diagnosis.stablest],
    ['性价比配置', diagnosis.value],
    ['低成本过线参考', diagnosis.budget],
  ]
    .filter(([, candidate]) => candidate)
    .forEach(([label, candidate]) => {
      console.log(`${label}: ${formatConfig(candidate)}`);
    });

  const notes = [];
  if (diagnosis.emptyStats) {
    notes.push(`空配焦点平均胜率 ${formatPercent(diagnosis.emptyStats.averageWinRate)}`);
  }
  notes.push(
    `维修风险成本按 0 计（当前 race 逻辑无维修/耐久扣费公式，脚本只验算现有玩法）`
  );

  if (diagnosis.findings.brainless) {
    notes.push('存在明显无脑通关配置：低成本过线参考在焦点检查点仍保持极高胜率');
  } else {
    notes.push('未发现明显无脑通关配置');
  }

  if (diagnosis.findings.impossibleGap) {
    notes.push('存在断层风险：顶配后期胜率或代理过线占比仍偏低');
  } else {
    notes.push('未发现明显断层：至少存在一段可达配置区间');
  }

  if (diagnosis.findings.nightmareEarlyOverrun) {
    notes.push('噩梦难度前期过强：顶配在早期检查点已接近轻松碾压');
  }

  if (diagnosis.findings.singleStatSmash) {
    notes.push('高难度存在单一属性碾压倾向：最强配置主属性占比过高');
  }

  notes.forEach((note) => {
    console.log(`- ${note}`);
  });
}

function main() {
  const startedAt = performance.now();
  const args = parseArgs(process.argv.slice(2));
  const raceData = loadRaceData();
  validateSourceTexts(raceData.sourceText);

  const difficultyKeys = raceData.DIFFICULTY_ORDER.filter((key) => {
    if (!args.difficultyFilter) {
      return true;
    }
    return key === args.difficultyFilter;
  });

  if (difficultyKeys.length === 0) {
    throw new Error(`未找到难度：${args.difficultyFilter}`);
  }

  console.log('Race balance check');
  console.table([
    {
      来源: 'lab-public/race/scripts/{config,core,race}.js',
      检查点: args.checkpoints.join(', '),
      样本数: args.sampleCount,
      候选保留数: args.topK,
      反应时间: `${args.reactionSeconds}s`,
      维修风险成本: '0',
    },
  ]);

  difficultyKeys.forEach((difficultyKey) => {
    const enumerated = enumerateDifficulty({
      raceData,
      difficultyKey,
      checkpoints: args.checkpoints,
      topK: args.topK,
    });

    const candidates = collectUniqueCandidates(enumerated).map((candidate) =>
      simulateCandidate({
        raceData,
        candidate,
        checkpoints: args.checkpoints,
        sampleCount: args.sampleCount,
        seedPrefix: args.seed,
        reactionSeconds: args.reactionSeconds,
      })
    );

    const diagnosis = buildDifficultyDiagnosis({
      result: enumerated,
      simulatedCandidates: candidates,
    });

    printDifficultyReport({
      raceData,
      result: enumerated,
      diagnosis,
      checkpoints: args.checkpoints,
    });
  });

  console.log(`\n耗时 ${(performance.now() - startedAt).toFixed(1)} ms`);
}

main();
