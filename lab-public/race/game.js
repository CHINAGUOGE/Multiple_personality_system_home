"use strict";

const PHASE_LABELS = {
  idle: "待机",
  registered: "已报名",
  countdown_red: "红灯",
  countdown_yellow: "黄灯",
  countdown_green: "绿灯",
  racing: "比赛中",
  finished: "比赛结束",
  false_start: "抢跑犯规",
  shop: "商店",
  garage: "车库"
};

const PRIZES = [1200, 800, 500, 200, 100];
const ENTRY_FEE = 200;
const PART_SELL_RATE = 0.8;
const FINISH = 100;
const TICK_MS = 45;

const BASE_PLAYER_STATS = {
  engine: 10,
  tire: 10,
  gearbox: 10,
  stability: 10,
  weight: 1000,
  hp: 100
};

const EQUIPMENT_SLOTS = ["Engine", "Tire", "Gearbox", "Body", "Intake", "Exhaust", "Turbo", "Stability"];

const PART_TYPE_LABELS = {
  Engine: "引擎",
  Tire: "轮胎",
  Gearbox: "变速箱",
  Body: "车身",
  Intake: "进气",
  Exhaust: "排气",
  Turbo: "涡轮",
  Stability: "稳定件"
};

const PART_POOL = [
  { name: "高压火花塞", type: "Engine", price: 600, effectText: "引擎 +8，稳定性 -2", changes: { engine: 8, stability: -2 } },
  { name: "运动轮胎", type: "Tire", price: 750, effectText: "轮胎 +6，稳定性 +1", changes: { tire: 6, stability: 1 } },
  { name: "轻量化飞轮", type: "Gearbox", price: 650, effectText: "变速箱 +5，重量 -20kg", changes: { gearbox: 5, weight: -20 } },
  { name: "空气滤清器", type: "Intake", price: 300, effectText: "马力 +3", changes: { hp: 3 } },
  { name: "排气管", type: "Exhaust", price: 500, effectText: "马力 +5，重量 +2kg", changes: { hp: 5, weight: 2 } },
  { name: "改装变速箱", type: "Gearbox", price: 900, effectText: "变速箱 +8", changes: { gearbox: 8 } },
  { name: "宽胎", type: "Tire", price: 700, effectText: "轮胎 +5，稳定性 +3，重量 +10kg", changes: { tire: 5, stability: 3, weight: 10 } },
  { name: "二手引擎", type: "Engine", price: 350, effectText: "引擎 +5，稳定性 -3", changes: { engine: 5, stability: -3 } },
  { name: "竞速引擎", type: "Engine", price: 1800, effectText: "引擎 +15，马力 +20", changes: { engine: 15, hp: 20 } },
  { name: "旧货市场涡轮", type: "Turbo", price: 1100, effectText: "引擎 +10，马力 +12，稳定性 -4", changes: { engine: 10, hp: 12, stability: -4 } },
  { name: "车身补强杆", type: "Body", price: 520, effectText: "稳定性 +6，重量 +12kg", changes: { stability: 6, weight: 12 } },
  { name: "钻孔刹车盘", type: "Stability", price: 480, effectText: "稳定性 +4，重量 -3kg", changes: { stability: 4, weight: -3 } },
  { name: "短尾牙", type: "Gearbox", price: 580, effectText: "变速箱 +4，轮胎 +2", changes: { gearbox: 4, tire: 2 } },
  { name: "塑料机盖", type: "Body", price: 430, effectText: "重量 -18kg，稳定性 -1", changes: { weight: -18, stability: -1 } },
  { name: "便宜机油", type: "Engine", price: 180, effectText: "引擎 +2", changes: { engine: 2 } },
  { name: "街边进气套件", type: "Intake", price: 620, effectText: "马力 +7，稳定性 -1", changes: { hp: 7, stability: -1 } }
];

const gameState = {
  phase: "idle",
  cash: 1500,
  raceCount: 0,
  lastRank: "-",
  greenAt: 0,
  reactionTime: null,
  playerStarted: false,
  countdownTimers: [],
  raceTimer: null,
  raceStartedAt: 0,
  shopItems: [],
  panelReturnPhase: "idle",
  inventory: [],
  equippedParts: EQUIPMENT_SLOTS.reduce((slots, type) => {
    slots[type] = null;
    return slots;
  }, {}),
  nextPartId: 1,
  cars: [],
  player: { ...BASE_PLAYER_STATS }
};

const el = {
  registerBtn: document.getElementById("registerBtn"),
  startBtn: document.getElementById("startBtn"),
  nextBtn: document.getElementById("nextBtn"),
  garageBtn: document.getElementById("garageBtn"),
  shopBtn: document.getElementById("shopBtn"),
  exitBtn: document.getElementById("exitBtn"),
  lanes: document.getElementById("lanes"),
  shopPanel: document.getElementById("shopPanel"),
  shopBody: document.getElementById("shopBody"),
  garagePanel: document.getElementById("garagePanel"),
  garageSlotsBody: document.getElementById("garageSlotsBody"),
  garageInventoryBody: document.getElementById("garageInventoryBody"),
  logOutput: document.getElementById("logOutput"),
  redLight: document.getElementById("redLight"),
  yellowLight: document.getElementById("yellowLight"),
  greenLight: document.getElementById("greenLight"),
  lightLabel: document.getElementById("lightLabel"),
  phaseText: document.getElementById("phaseText"),
  entryFeeText: document.getElementById("entryFeeText"),
  opponentPowerText: document.getElementById("opponentPowerText"),
  engineStat: document.getElementById("engineStat"),
  tireStat: document.getElementById("tireStat"),
  gearboxStat: document.getElementById("gearboxStat"),
  stabilityStat: document.getElementById("stabilityStat"),
  weightStat: document.getElementById("weightStat"),
  hpStat: document.getElementById("hpStat"),
  cashStat: document.getElementById("cashStat"),
  raceCountStat: document.getElementById("raceCountStat"),
  lastRankStat: document.getElementById("lastRankStat")
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
    id: gameState.nextPartId++
  };
}

function getPartSellPrice(part) {
  return Math.floor(part.price * PART_SELL_RATE);
}

function isRaceLockedPhase(phase) {
  return ["countdown_red", "countdown_yellow", "countdown_green", "racing"].includes(phase);
}

function isPostRacePhase(phase) {
  return ["finished", "false_start", "shop"].includes(phase);
}

function setPhase(phase) {
  gameState.phase = phase;
  el.phaseText.textContent = PHASE_LABELS[phase];
  updateVisiblePanel();
  updateButtons();
}

function addLog(message) {
  const time = new Date().toLocaleTimeString("zh-CN", { hour12: false });
  el.logOutput.textContent += `[${time}] ${message}\n`;
  el.logOutput.scrollTop = el.logOutput.scrollHeight;
}

function updateButtons() {
  const phase = gameState.phase;
  const countdownOrRace = isRaceLockedPhase(phase);
  const garageFromPostRace = phase === "garage" && isPostRacePhase(gameState.panelReturnPhase);
  const canOpenPanels = !countdownOrRace;
  const canPrepareNextRace = isPostRacePhase(phase) || phase === "garage";
  const canShowShop = isPostRacePhase(phase) || garageFromPostRace;

  el.registerBtn.disabled = phase !== "idle";
  el.startBtn.disabled = !countdownOrRace || gameState.playerStarted;
  el.nextBtn.disabled = !canPrepareNextRace;
  el.garageBtn.disabled = !canOpenPanels;
  el.shopBtn.disabled = !canShowShop;
  el.exitBtn.disabled = phase === "idle" || countdownOrRace;

  const canShop = isPostRacePhase(phase);
  const canGarage = phase === "garage";

  Array.from(el.shopBody.querySelectorAll("button")).forEach((button) => {
    const index = Number(button.dataset.index);
    button.disabled = !canShop || gameState.shopItems[index].bought || gameState.cash < gameState.shopItems[index].price;
  });

  Array.from(el.garageSlotsBody.querySelectorAll("select")).forEach((select) => {
    select.disabled = !canGarage || select.options.length <= 1;
  });

  Array.from(el.garageInventoryBody.querySelectorAll("button")).forEach((button) => {
    const part = getPartById(Number(button.dataset.partId));
    const equipped = part && gameState.equippedParts[part.type] === part.id;
    button.disabled = !canGarage || !part || equipped;
  });
}

function updateVisiblePanel() {
  const showGarage = gameState.phase === "garage";
  el.shopPanel.classList.toggle("is-hidden", showGarage);
  el.garagePanel.classList.toggle("is-hidden", !showGarage);
}

function setLights(active) {
  el.redLight.classList.toggle("active", active === "red");
  el.yellowLight.classList.toggle("active", active === "yellow");
  el.greenLight.classList.toggle("active", active === "green");

  const labels = {
    none: "未报名",
    red: "红灯",
    yellow: "黄灯",
    green: "绿灯"
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
  el.raceCountStat.textContent = gameState.raceCount;
  el.lastRankStat.textContent = gameState.lastRank;
  el.entryFeeText.textContent = ENTRY_FEE;
  el.opponentPowerText.textContent = getOpponentPower().toFixed(2);
  updateButtons();
}

function renderLanes() {
  el.lanes.innerHTML = "";
  gameState.cars.forEach((car, index) => {
    const lane = document.createElement("div");
    lane.className = "lane";

    const label = document.createElement("span");
    label.className = "lane-label";
    label.textContent = `车${index + 1}${car.isPlayer ? " 我" : ""}`;

    const carNode = document.createElement("div");
    carNode.className = `car${car.isPlayer ? " player-car" : ""}`;
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
    createCar(1, "玩家破车", "#d00000", true),
    createCar(2, "电脑蓝车", "#0060c8", false),
    createCar(3, "电脑黄车", "#d8b000", false),
    createCar(4, "电脑绿车", "#008c28", false),
    createCar(5, "电脑灰车", "#707070", false)
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
    power: isPlayer ? getPlayerPower() : getOpponentCarPower(id)
  };
}

function getPlayerPower() {
  const p = gameState.player;
  const weightPenalty = (p.weight - 1000) / 85;
  return {
    base: 0.53 + p.hp / 520 + p.engine / 155 - weightPenalty / 100,
    acceleration: 0.020 + p.engine / 3600 + p.gearbox / 4300,
    launch: p.tire / 85,
    mid: p.gearbox / 185,
    stability: clamp(p.stability, 1, 80)
  };
}

function getOpponentPower() {
  return 1 + gameState.raceCount * 0.14;
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
    stability: 10 + difficulty * 1.8 + randomBetween(-3, 4)
  };
}

function registerRace() {
  if (gameState.cash < ENTRY_FEE) {
    addLog("现金不足，连报名费都交不起。");
    addLog("可以进车库卖掉未装备零件，仓库回收价为原价 8 折。");
    return;
  }

  clearRaceTimers();
  gameState.cash -= ENTRY_FEE;
  gameState.reactionTime = null;
  gameState.playerStarted = false;
  resetCars();
  updateStats();

  addLog(`报名费 ${ENTRY_FEE} 元`);
  addLog("等待绿灯……红灯期间点击会抢跑。");

  setPhase("countdown_red");
  setLights("red");

  gameState.countdownTimers.push(setTimeout(() => {
    setPhase("countdown_yellow");
    setLights("yellow");
    addLog("黄灯……别急。");
  }, 900));

  gameState.countdownTimers.push(setTimeout(() => {
    setPhase("countdown_green");
    setLights("green");
    gameState.greenAt = performance.now();
    addLog("绿灯！电脑车已经起跑！");
    startRaceMotion();
  }, 1850));
}

function pressStart() {
  if (["countdown_red", "countdown_yellow"].includes(gameState.phase)) {
    handleFalseStart();
    return;
  }

  if (!["countdown_green", "racing"].includes(gameState.phase) || gameState.playerStarted) {
    return;
  }

  startPlayerCar();
}

function handleFalseStart() {
  clearRaceTimers();
  gameState.playerStarted = false;
  gameState.lastRank = "犯规";
  setPhase("false_start");
  setLights("red");
  addLog("闯红灯！抢跑犯规！");
  addLog("本场成绩无效，奖金 0 元，报名费不退。");
  finishPostRace();
}

function startRaceMotion() {
  if (gameState.raceTimer) {
    return;
  }

  gameState.raceStartedAt = performance.now();
  gameState.cars.forEach((car) => {
    if (!car.isPlayer) {
      car.started = true;
      car.launchBonus = car.power.launch;
    }
  });

  setPhase("racing");
  gameState.raceTimer = setInterval(tickRace, TICK_MS);
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
    addLog("无违规，起步完美！");
  } else if (reactionSeconds < 0.55) {
    addLog("合法起步，反应还行。");
  } else {
    addLog("起步偏慢，电脑车已经拉开。");
  }
  updateButtons();
}

function tickRace() {
  const now = performance.now();
  const elapsed = (now - gameState.raceStartedAt) / 1000;

  gameState.cars.forEach((car) => {
    if (!car.started || car.finishTime !== null) {
      return;
    }

    const stabilityNoise = (18 - clamp(car.power.stability, 1, 18)) * randomBetween(-0.0018, 0.0024);
    const midBoost = car.position > 34 && car.position < 78 ? car.power.mid * 0.012 : 0;
    const launchFade = Math.max(0, 1 - elapsed / 1.2) * car.launchBonus * 0.08;

    // The formula is intentionally blunt so upgrades visibly move the car faster.
    car.currentSpeed += car.power.acceleration + stabilityNoise;
    car.currentSpeed = clamp(car.currentSpeed, 0.28, 2.2);
    car.position += car.power.base + car.currentSpeed + midBoost + launchFade - car.reactionPenalty * 0.035;

    if (car.position >= FINISH) {
      car.position = FINISH;
      car.finishTime = now;
      addLog(`${car.name} 冲线。`);
    }
  });

  updateCarPositions();

  if (gameState.cars.every((car) => car.finishTime !== null || !car.started && car.isPlayer)) {
    completeRace();
  }
}

function completeRace() {
  clearRaceTimers();

  const ranked = gameState.cars
    .slice()
    .sort((a, b) => {
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
  setPhase("finished");
  setLights("none");

  addLog("比赛结束！");
  addLog(`本场排名：第 ${playerRank} 名`);
  addLog(`获得奖金 ${prize} 元`);
  finishPostRace();
}

function finishPostRace() {
  refreshShop();
  addLog("商店已刷新");
  addLog(`现金余额：${gameState.cash} 元`);
  updateStats();
}

function nextRace() {
  clearRaceTimers();
  gameState.reactionTime = null;
  gameState.playerStarted = false;
  gameState.panelReturnPhase = "idle";
  resetCars();
  setLights("none");
  setPhase("idle");
  addLog("下一场准备完毕，请报名比赛。");
  updateStats();
}

function refreshShop() {
  const count = Math.floor(randomBetween(4, 7));
  gameState.shopItems = pickRandomItems(PART_POOL, count).map((part) => ({
    ...part,
    bought: false
  }));
  renderShop();
  setPhase(gameState.phase === "false_start" ? "false_start" : "shop");
}

function renderShop() {
  el.shopBody.innerHTML = "";

  gameState.shopItems.forEach((part, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${part.name}</td>
      <td>${formatPartType(part.type)}</td>
      <td>${part.effectText}</td>
      <td>${part.price} 元</td>
      <td></td>
    `;

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = part.bought ? "已买" : "购买";
    button.dataset.index = String(index);
    button.addEventListener("click", () => buyPart(index));
    row.lastElementChild.appendChild(button);
    el.shopBody.appendChild(row);
  });

  updateButtons();
}

function buyPart(index) {
  const part = gameState.shopItems[index];
  if (!part || part.bought) {
    return;
  }

  if (gameState.cash < part.price) {
    addLog(`现金不足，买不起 ${part.name}。`);
    return;
  }

  gameState.cash -= part.price;
  const ownedPart = createOwnedPart(part);
  const replacedPart = getEquippedPart(ownedPart.type);
  gameState.inventory.push(ownedPart);
  gameState.equippedParts[ownedPart.type] = ownedPart.id;
  recalculatePlayerStats();
  part.bought = true;

  addLog(`购买 ${part.name}，${part.effectText}，花费 ${part.price} 元。`);
  if (replacedPart) {
    addLog(`${formatPartType(ownedPart.type)}槽：${replacedPart.name} 已换成 ${ownedPart.name}。`);
  } else {
    addLog(`${ownedPart.name} 已装到${formatPartType(ownedPart.type)}槽。`);
  }
  updateStats();
  renderShop();
  renderGarage();
}

function renderGarage() {
  el.garageSlotsBody.innerHTML = "";
  el.garageInventoryBody.innerHTML = "";

  EQUIPMENT_SLOTS.forEach((type) => {
    const parts = gameState.inventory.filter((part) => part.type === type);
    const equippedPart = getEquippedPart(type);
    const row = document.createElement("tr");

    const slotCell = document.createElement("td");
    slotCell.textContent = formatPartType(type);

    const selectCell = document.createElement("td");
    const select = document.createElement("select");
    select.dataset.slot = type;

    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = parts.length > 0 ? "无部件" : "无可用零件";
    select.appendChild(emptyOption);

    parts.forEach((part) => {
      const option = document.createElement("option");
      option.value = String(part.id);
      option.textContent = `#${part.id} ${part.name}`;
      select.appendChild(option);
    });

    select.value = equippedPart ? String(equippedPart.id) : "";
    select.addEventListener("change", () => changeEquipment(type, select.value));
    selectCell.appendChild(select);

    const effectCell = document.createElement("td");
    effectCell.textContent = equippedPart ? equippedPart.effectText : "-";

    row.appendChild(slotCell);
    row.appendChild(selectCell);
    row.appendChild(effectCell);
    el.garageSlotsBody.appendChild(row);
  });

  if (gameState.inventory.length === 0) {
    const emptyRow = document.createElement("tr");
    emptyRow.innerHTML = `<td colspan="4">仓库空。比赛后去商店买零件。</td>`;
    el.garageInventoryBody.appendChild(emptyRow);
  } else {
    gameState.inventory.forEach((part) => {
      const equipped = gameState.equippedParts[part.type] === part.id;
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>#${part.id} ${part.name}</td>
        <td>${formatPartType(part.type)}</td>
        <td>${equipped ? "已装车" : "仓库"}</td>
        <td></td>
      `;

      const sellButton = document.createElement("button");
      sellButton.type = "button";
      sellButton.textContent = equipped ? "先卸下" : `出售 ${getPartSellPrice(part)} 元`;
      sellButton.dataset.partId = String(part.id);
      sellButton.addEventListener("click", () => sellPart(part.id));
      row.lastElementChild.appendChild(sellButton);
      el.garageInventoryBody.appendChild(row);
    });
  }

  updateButtons();
}

function changeEquipment(type, value) {
  if (gameState.phase !== "garage") {
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
}

function sellPart(partId) {
  if (gameState.phase !== "garage") {
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
}

function clearRaceTimers() {
  gameState.countdownTimers.forEach((timer) => clearTimeout(timer));
  gameState.countdownTimers = [];

  if (gameState.raceTimer) {
    clearInterval(gameState.raceTimer);
    gameState.raceTimer = null;
  }
}

function showGarageInfo() {
  if (isRaceLockedPhase(gameState.phase)) {
    addLog("比赛期间不能进车库。");
    return;
  }
  if (gameState.phase !== "garage") {
    gameState.panelReturnPhase = gameState.phase;
  }
  setPhase("garage");
  renderGarage();
  addLog("已切到车库。可以切换同类型零件，未装备零件可按 8 折出售。");
}

function showShopInfo() {
  if (!["finished", "false_start", "shop", "garage"].includes(gameState.phase)) {
    addLog("比赛期间不能逛商店。");
    return;
  }
  setPhase("shop");
  addLog("已切到商店。比赛后商品会随机刷新。");
}

function exitGame() {
  clearRaceTimers();
  addLog("退出按钮被按下。浏览器版不会关闭窗口，请直接关闭标签页。");
}

function bindEvents() {
  el.registerBtn.addEventListener("click", registerRace);
  el.startBtn.addEventListener("click", pressStart);
  el.nextBtn.addEventListener("click", nextRace);
  el.garageBtn.addEventListener("click", showGarageInfo);
  el.shopBtn.addEventListener("click", showShopInfo);
  el.exitBtn.addEventListener("click", exitGame);
}

function init() {
  bindEvents();
  resetCars();
  refreshShop();
  renderGarage();
  setPhase("idle");
  setLights("none");
  updateStats();
  addLog("横线赛车经营赛启动。");
  addLog("先报名比赛，等绿灯后点开始比赛。");
}

init();
