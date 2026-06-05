'use strict';

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

function canManageTuning() {
  return (
    gameState.activePage === 'tuning' &&
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
    select.disabled = !canManageTuning() || select.options.length <= 1;
  });

  Array.from(el.garageSlotsBody.querySelectorAll('[data-action="equip-slot"]')).forEach(
    (button) => {
      const part = getPartById(Number(button.dataset.partId));
      const equipped = part && gameState.equippedParts[part.type] === part.id;
      button.disabled = !canManageTuning() || !part || equipped;
    }
  );

  const inventoryButtons = [
    ...el.tuningEquippedBody.querySelectorAll('button'),
    ...el.tuningUnequippedBody.querySelectorAll('button'),
  ];
  inventoryButtons.forEach((button) => {
    const part = getPartById(Number(button.dataset.partId));
    const equipped = part && gameState.equippedParts[part.type] === part.id;
    button.disabled =
      !canManageTuning() ||
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
  el.tuningCashStat.textContent = `${gameState.cash} 元`;
  el.storageCashStat.textContent = `${gameState.cash} 元`;
  el.raceCountStat.textContent = gameState.raceCount;
  el.raceTierText.textContent = getRaceTier().label;
  el.lastRankStat.textContent = gameState.lastRank;
  el.entryFeeText.textContent = ENTRY_FEE;
  el.opponentPowerText.textContent = getOpponentPower().toFixed(2);
  el.currentVehicleText.textContent = '玩家破车';
  updateButtons();
}
