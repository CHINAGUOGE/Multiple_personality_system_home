'use strict';

const RaceFormulaUtils = (() => {
  const OPPONENT_PERSONALITY_BY_ID = {
    2: 0.02,
    3: 0.05,
    4: -0.04,
    5: 0,
  };

  function clampValue(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function computePlayerPower(stats) {
    const weightPenalty = (stats.weight - 1000) / 85;
    const lowStabilityPenalty = Math.max(0, 8 - clampValue(stats.stability, 1, 8));

    return {
      base:
        0.53 +
        stats.hp / 580 +
        stats.engine / 165 -
        weightPenalty / 75 -
        lowStabilityPenalty * 0.045,
      acceleration:
        0.02 +
        stats.engine / 3800 +
        stats.gearbox / 4500 -
        lowStabilityPenalty * 0.0012,
      launch: stats.tire / 85,
      mid: stats.gearbox / 195 - lowStabilityPenalty * 0.01,
      stability: clampValue(stats.stability, 1, 80),
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

  function computeOpponentStrength(options) {
    const {
      raceCount,
      difficulty,
      playerRating,
      chaseStartRace,
      chaseRampRaces,
      chaseCap,
    } = options;
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
    const chaseStart =
      typeof difficulty.opponentChaseStartRace === 'number'
        ? difficulty.opponentChaseStartRace
        : chaseStartRace;
    const chaseRamp =
      typeof difficulty.opponentChaseRampRaces === 'number'
        ? difficulty.opponentChaseRampRaces
        : chaseRampRaces;
    const effectiveChaseCap =
      typeof difficulty.opponentChaseCap === 'number' ? difficulty.opponentChaseCap : chaseCap;
    const lateGameFactor = clampValue(
      (raceCount - chaseStart) / chaseRamp,
      0,
      1
    );
    const chaseBonus = clampValue(
      playerRating * (difficulty.chaseRate || 0) * lateGameFactor,
      0,
      effectiveChaseCap
    );
    const earlyRaceAssist =
      raceCount < 5 ? (difficulty.earlyRaceAssist || 0) * ((6 - raceCount) / 6) : 0;
    const uncappedStrength = scaledBase + chaseBonus - earlyRaceAssist;
    const maxOpponentStrength = difficulty.maxOpponentStrength;
    const finalStrength = Number.isFinite(maxOpponentStrength)
      ? Math.min(uncappedStrength, maxOpponentStrength)
      : uncappedStrength;

    return Math.max(0.6, finalStrength);
  }

  function computeOpponentCarPower(options) {
    const { opponentStrength, id, randomBetween } = options;
    const personality = OPPONENT_PERSONALITY_BY_ID[id] || 0;
    const lateBoost = Math.max(0, opponentStrength - 2.2);

    return {
      base:
        0.53 +
        opponentStrength * 0.092 +
        lateBoost * 0.048 +
        randomBetween(-0.05, 0.09) +
        personality,
      acceleration:
        0.021 +
        opponentStrength * 0.0023 +
        lateBoost * 0.0008 +
        randomBetween(-0.0015, 0.0025),
      launch:
        0.1 +
        opponentStrength * 0.017 +
        lateBoost * 0.0045 +
        randomBetween(0, 0.05),
      mid:
        0.08 +
        opponentStrength * 0.023 +
        lateBoost * 0.009 +
        randomBetween(-0.02, 0.04),
      stability:
        10 +
        opponentStrength * 2.2 +
        lateBoost * 2.7 +
        randomBetween(-3, 4),
    };
  }

  function computeReactionOutcome(options) {
    const reactionSeconds = Number(options.reactionSeconds) || 0;
    const reactionGrace = Number(options.reactionGrace) || 0;
    const effectiveReactionSeconds = Math.max(0, reactionSeconds - reactionGrace);

    return {
      effectiveReactionSeconds,
      reactionBonus: clampValue(0.45 - effectiveReactionSeconds, 0, 0.35),
      slowPenalty: clampValue(effectiveReactionSeconds - 0.65, 0, 1.2),
    };
  }

  return {
    computePlayerPower,
    computePlayerRating,
    computeOpponentStrength,
    computeOpponentCarPower,
    computeReactionOutcome,
  };
})();

globalThis.RaceFormulaUtils = RaceFormulaUtils;
