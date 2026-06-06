'use strict';

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
  return RaceFormulaUtils.computePlayerPower(gameState.player);
}

function getPlayerRating() {
  return RaceFormulaUtils.computePlayerRating(gameState.player);
}

function getOpponentPower() {
  return RaceFormulaUtils.computeOpponentStrength({
    raceCount: gameState.raceCount,
    difficulty: getDifficulty(),
    playerRating: getPlayerRating(),
    chaseStartRace: OPPONENT_CHASE_START_RACE,
    chaseRampRaces: OPPONENT_CHASE_RAMP_RACES,
    chaseCap: OPPONENT_CHASE_CAP,
  });
}

function getOpponentCarPower(id) {
  return RaceFormulaUtils.computeOpponentCarPower({
    opponentStrength: getOpponentPower(),
    id,
    randomBetween,
  });
}

function registerRace() {
  if (gameState.cash < getEntryFee()) {
    const reachedGameOver = checkGameFailure();
    addLog(`现金不足以支付「${getDifficulty().name}」难度报名费 ${getEntryFee()} 元。`);
    if (!reachedGameOver && gameState.cash >= getMinEntryFee()) {
      addLog('可降低难度以减少报名费，或进改装页卸下/卖掉零件。');
    } else if (!reachedGameOver) {
      addLog('可以进改装页卸下或卖掉零件，未装备零件回收价为原价 8 折。');
    }
    unlockAchievementById('broke_entry_attempt');
    openNoticeModal('报名失败', '钱包空空，报名处拒绝了你的参赛申请。');
    return;
  }

  clearRaceTimers();
  const entryFee = getEntryFee();
  gameState.cash -= entryFee;
  gameState.reactionTime = null;
  gameState.playerStarted = false;
  resetCars();
  updateStats();

  addLog(`报名费 ${entryFee} 元`);
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

function updateBestReactionRecord(reactionSeconds) {
  if (!Number.isFinite(reactionSeconds) || reactionSeconds < 0) {
    return;
  }

  if (
    gameState.bestReactionTime === null ||
    reactionSeconds < gameState.bestReactionTime
  ) {
    gameState.bestReactionTime = reactionSeconds;
    addLog(`刷新最快反应记录：${gameState.bestReactionTime.toFixed(3)} 秒！`);
  }
}

function updateWinStreak(playerRank) {
  if (playerRank === 1) {
    gameState.currentWinStreak += 1;
    gameState.bestWinStreak = Math.max(
      gameState.bestWinStreak,
      gameState.currentWinStreak
    );
    return;
  }

  gameState.currentWinStreak = 0;
}

function handleFalseStart() {
  const falseStartPhase = gameState.phase;
  clearRaceTimers();
  gameState.reactionTime = null;
  gameState.lastReactionTime = null;
  gameState.playerStarted = false;
  gameState.currentWinStreak = 0;
  gameState.stats.secondPlaceStreak = 0;
  gameState.stats.fifthPlaceStreak = 0;
  syncProgressStats();
  gameState.lastRank = '犯规';
  setPhase('false_start');
  setLights('red');
  addLog(`${falseStartPhase === 'countdown_yellow' ? '黄灯' : '红灯'}抢跑犯规！`);
  addLog('本场成绩无效，奖金 0 元，报名费不退。');
  if (typeof unlockAchievementById === 'function') {
    unlockAchievementById('false_start_hot_tofu');
  }
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
  const reaction = RaceFormulaUtils.computeReactionOutcome({
    reactionSeconds,
    reactionGrace: getDifficulty().reactionGrace || 0,
  });

  gameState.reactionTime = reactionSeconds;
  gameState.lastReactionTime = reactionSeconds;
  gameState.playerStarted = true;
  playerCar.started = true;
  playerCar.reactionPenalty = reaction.slowPenalty;
  playerCar.launchBonus = playerCar.power.launch + reaction.reactionBonus;
  updateBestReactionRecord(reactionSeconds);

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
  const basePrize = PRIZES[playerRank - 1] || 0;
  const rewardMultiplier = getDifficulty().rewardMultiplier;
  const prize = Math.floor(basePrize * rewardMultiplier);

  gameState.cash += prize;
  gameState.raceCount += 1;
  gameState.lastRank = `第 ${playerRank} 名`;
  updateWinStreak(playerRank);
  const secondPlaceStreakBeforeRace = gameState.stats.secondPlaceStreak || 0;
  if (playerRank === 1 && secondPlaceStreakBeforeRace >= 10) {
    gameState.stats.hasWonAfterSecondPlaceStreak = true;
  }
  gameState.stats.secondPlaceStreak =
    playerRank === 2 ? secondPlaceStreakBeforeRace + 1 : 0;
  gameState.stats.fifthPlaceStreak =
    playerRank === 5 ? (gameState.stats.fifthPlaceStreak || 0) + 1 : 0;
  gameState.stats.totalRaces += 1;
  if (playerRank === 1) {
    const difficultyKey = getDifficultyKey();
    const equippedTemplateIds = EQUIPMENT_SLOTS.map((type) => getEquippedPart(type))
      .filter(Boolean)
      .map((part) => getPartTemplateId(part));
    const wonWithBuildAchievements =
      typeof getWinningAchievementTagsFromCurrentBuild === 'function'
        ? getWinningAchievementTagsFromCurrentBuild()
        : [];

    gameState.stats.totalWins += 1;
    gameState.stats.winsByDifficulty[difficultyKey] += 1;
    gameState.stats.bestStreakByDifficulty[difficultyKey] = Math.max(
      gameState.stats.bestStreakByDifficulty[difficultyKey] || 0,
      gameState.currentWinStreak
    );
    wonWithBuildAchievements.forEach((achievementId) => {
      if (!gameState.stats.wonWithBuildAchievements.includes(achievementId)) {
        gameState.stats.wonWithBuildAchievements.push(achievementId);
      }
    });

    ['gearbox_xue_wrench', 'stability_xiaoyu_sponsor'].forEach((templateId) => {
      if (
        equippedTemplateIds.includes(templateId) &&
        !gameState.stats.wonWithSpecialParts.includes(templateId)
      ) {
        gameState.stats.wonWithSpecialParts.push(templateId);
      }
    });
  } else {
    gameState.stats.totalLosses += 1;
  }
  syncProgressStats();
  setPhase('finished');
  setLights('none');

  addLog('比赛结束！');
  addLog(`本场排名：第 ${playerRank} 名`);
  addLog(`难度「${getDifficulty().name}」奖金×${rewardMultiplier}`);
  addLog(`获得奖金 ${prize} 元`);
  finishPostRace();
  if (typeof checkAchievements === 'function') {
    checkAchievements({ source: 'raceEnd' });
  }
  autoSaveGame();
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
