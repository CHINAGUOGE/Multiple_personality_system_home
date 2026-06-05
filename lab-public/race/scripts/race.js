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
  let base;
  if (count < 5) {
    base = 1 + count * 0.1;
  } else if (count < 12) {
    base = 1.45 + (count - 5) * 0.07;
  } else {
    base = Math.min(2.35, 1.95 + (count - 12) * 0.035);
  }

  // 随局数温和成长（上限 +150% 原始增量），叠加难度倍率，
  // 避免后期全金装碾压，同时不无限膨胀。
  const growth = Math.min(count * 0.015, 1.5);
  return base * (1 + growth * 0.18) * getDifficulty().opponentMultiplier;
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
  if (gameState.cash < getEntryFee()) {
    if (checkGameFailure()) {
      return;
    }
    addLog(`现金不足以支付「${getDifficulty().name}」难度报名费 ${getEntryFee()} 元。`);
    if (gameState.cash >= getMinEntryFee()) {
      addLog('可降低难度以减少报名费，或进仓库卸下/卖掉零件。');
    } else {
      addLog('可以进仓库卸下或卖掉零件，仓库回收价为原价 8 折。');
    }
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
  const basePrize = PRIZES[playerRank - 1] || 0;
  const rewardMultiplier = getDifficulty().rewardMultiplier;
  const prize = Math.floor(basePrize * rewardMultiplier);

  gameState.cash += prize;
  gameState.raceCount += 1;
  gameState.lastRank = `第 ${playerRank} 名`;
  setPhase('finished');
  setLights('none');

  addLog('比赛结束！');
  addLog(`本场排名：第 ${playerRank} 名`);
  addLog(`难度「${getDifficulty().name}」奖金×${rewardMultiplier}`);
  addLog(`获得奖金 ${prize} 元`);
  finishPostRace();
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
