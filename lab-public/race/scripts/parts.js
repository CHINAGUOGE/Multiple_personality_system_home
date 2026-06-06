'use strict';

const tuningLayoutMedia =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(max-width: 900px)')
    : null;
let activeTuningSlot = EQUIPMENT_SLOTS[0] || null;
let expandedTuningSlot = null;
let lastTuningLayout = null;

if (tuningLayoutMedia) {
  const rerenderTuningForLayout = () => {
    if (el.garageSlotsBody) {
      renderTuning();
    }
  };

  if (typeof tuningLayoutMedia.addEventListener === 'function') {
    tuningLayoutMedia.addEventListener('change', rerenderTuningForLayout);
  } else if (typeof tuningLayoutMedia.addListener === 'function') {
    tuningLayoutMedia.addListener(rerenderTuningForLayout);
  }
}

function getShopPartWeight(part) {
  return hasOwnedPart(part) ? SHOP_OWNED_PART_WEIGHT : 1;
}

function pickWeightedBucketItem(parts, weightAdjuster = null) {
  if (parts.length === 0) {
    return null;
  }

  const weights = parts.map((part) => {
    if (!weightAdjuster) {
      return 1;
    }

    const weight = Number(weightAdjuster(part));
    return Number.isFinite(weight) && weight > 0 ? weight : 0;
  });
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

  if (totalWeight <= 0) {
    return parts.splice(Math.floor(Math.random() * parts.length), 1)[0];
  }

  let roll = Math.random() * totalWeight;
  for (let i = 0; i < parts.length; i += 1) {
    roll -= weights[i];
    if (roll <= 0) {
      return parts.splice(i, 1)[0];
    }
  }

  return parts.pop();
}

// 先按 PART_RARITY_WEIGHTS 抽稀有度，再在该稀有度内抽零件，去重。
// 商店内已拥有零件只会在同稀有度内被降权，不改动整体稀有度概率。
function pickWeightedParts(pool, count, options = {}) {
  const weightAdjuster =
    options && typeof options.weightAdjuster === 'function' ? options.weightAdjuster : null;
  const buckets = new Map();
  pool.forEach((part) => {
    const rarity = getPartRarity(part);
    if (!buckets.has(rarity)) {
      buckets.set(rarity, []);
    }
    buckets.get(rarity).push(part);
  });

  const picked = [];

  while (picked.length < count && buckets.size > 0) {
    const rarities = Array.from(buckets.keys());
    const totalWeight = rarities.reduce(
      (sum, rarity) => sum + (PART_RARITY_WEIGHTS[rarity] || 0),
      0
    );
    if (totalWeight <= 0) {
      break;
    }

    let roll = Math.random() * totalWeight;
    let chosenRarity = rarities[rarities.length - 1];
    for (let i = 0; i < rarities.length; i += 1) {
      roll -= PART_RARITY_WEIGHTS[rarities[i]] || 0;
      if (roll <= 0) {
        chosenRarity = rarities[i];
        break;
      }
    }

    const partsInRarity = buckets.get(chosenRarity);
    const pickedPart = pickWeightedBucketItem(partsInRarity, weightAdjuster);
    if (!pickedPart) {
      buckets.delete(chosenRarity);
      continue;
    }
    picked.push(pickedPart);
    if (partsInRarity.length === 0) {
      buckets.delete(chosenRarity);
    }
  }

  return picked;
}

function refreshShop() {
  const pool = getCurrentLootPool();
  const available = PART_POOL.filter((part) => pool.includes(getPartRarity(part)));
  const count = Math.min(available.length, Math.floor(randomBetween(4, 7)));

  gameState.shopItems = pickWeightedParts(available, count, {
    weightAdjuster: getShopPartWeight,
  }).map((part) => ({
    ...part,
    bought: false,
  }));
  renderShop();
  autoSaveGame();
}

function renderShop() {
  el.shopBody.innerHTML = '';

  gameState.shopItems.forEach((part, index) => {
    const card = document.createElement('article');
    card.className = `shop-card ${getPartRarityFrameClass(part)}`;
    card.innerHTML = `
      <div class="card-main">
        <div class="card-title-row">
          <h3>${renderPartName(part)}</h3>
          ${renderPartBadges(part)}
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
  gameState.stats.partsPurchasedCount = (gameState.stats.partsPurchasedCount || 0) + 1;
  if (!equippedPart) {
    gameState.equippedParts[ownedPart.type] = ownedPart.id;
    recalculatePlayerStats();
  }
  part.bought = true;

  addLog(`购买 ${part.name}，${part.effectText}，花费 ${part.price} 元。`);
  addLog(`${ownedPart.name} 已收入车队库存。`);
  if (equippedPart) {
    addLog(`${formatPartType(ownedPart.type)}槽已有 ${equippedPart.name}，如需替换请去改装页手动换装。`);
  } else {
    addLog(`${formatPartType(ownedPart.type)}槽为空，已自动装备 ${ownedPart.name}。`);
  }
  updateStats();
  renderShop();
  renderGarage();
  renderAtlas();
  if (typeof checkAchievements === 'function') {
    checkAchievements({ source: 'buyPart' });
  }
  autoSaveGame();
}

function renderGarage() {
  renderTuning();
}

function isTuningMobileLayout() {
  return tuningLayoutMedia ? tuningLayoutMedia.matches : window.innerWidth <= 900;
}

function syncTuningLayoutState() {
  const nextLayout = isTuningMobileLayout() ? 'mobile' : 'desktop';

  if (!EQUIPMENT_SLOTS.includes(activeTuningSlot)) {
    activeTuningSlot = EQUIPMENT_SLOTS[0] || null;
  }

  if (expandedTuningSlot && !EQUIPMENT_SLOTS.includes(expandedTuningSlot)) {
    expandedTuningSlot = null;
  }

  if (nextLayout === 'desktop') {
    activeTuningSlot = activeTuningSlot || expandedTuningSlot || EQUIPMENT_SLOTS[0] || null;
  } else if (lastTuningLayout === null) {
    expandedTuningSlot = null;
  }

  lastTuningLayout = nextLayout;
  return nextLayout;
}

function getTuningPartsByType(type) {
  const equippedPart = getEquippedPart(type);
  return gameState.inventory
    .filter((part) => part.type === type)
    .sort((a, b) => {
      if (equippedPart) {
        if (a.id === equippedPart.id) {
          return -1;
        }
        if (b.id === equippedPart.id) {
          return 1;
        }
      }

      return a.id - b.id;
    });
}

function getSlotSummaryTags(part) {
  return renderPartChangeTags(part ? part.changes : {}, part ? '属性无变化' : '当前无加成');
}

function createSlotSummaryCard(type, layout) {
  const equippedPart = getEquippedPart(type);
  const active = layout === 'desktop' ? activeTuningSlot === type : expandedTuningSlot === type;
  const triggerAction = layout === 'desktop' ? 'select-slot' : 'toggle-slot';
  const stateLabel = active ? (layout === 'desktop' ? '已选中' : '已展开') : '更换';
  const card = document.createElement('article');

  card.className = `slot-summary-card${active ? ' is-active' : ''}${
    equippedPart ? ` ${getPartRarityFrameClass(equippedPart)}` : ''
  }`;
  card.innerHTML = `
    <button
      type="button"
      class="slot-summary-trigger"
      data-action="${triggerAction}"
      data-slot="${type}"
      ${layout === 'mobile' ? `aria-expanded="${active}"` : ''}
    >
      <div class="slot-summary-top">
        <div class="slot-summary-copy">
          <h3>${formatPartType(type)}</h3>
          <p class="slot-summary-current">${
            equippedPart ? `当前：${renderPartInlineLabel(equippedPart, true)}` : '当前：未装备'
          }</p>
        </div>
        <span class="slot-summary-state">${stateLabel}</span>
      </div>
      <p class="slot-summary-effect">${
        equippedPart ? `效果：${equippedPart.effectText}` : '效果：没有装备效果'
      }</p>
      ${getSlotSummaryTags(equippedPart)}
    </button>
  `;

  if (layout === 'mobile' && active) {
    card.appendChild(createSlotDetailPanel(type, true));
  }

  return card;
}

function createPartOptionList(type) {
  const parts = getTuningPartsByType(type);
  const equippedPart = getEquippedPart(type);
  const choices = document.createElement('div');

  choices.className = 'slot-choices';
  if (parts.length === 0) {
    choices.innerHTML = `
      <div class="slot-empty-state">
        <p>当前槽位还没有可用零件。</p>
      </div>
    `;
    return choices;
  }

  choices.innerHTML = `
    <div class="slot-choice-scroller">
      <ul class="part-option-list">
        ${parts
          .map((part) => {
            const equipped = equippedPart && equippedPart.id === part.id;
            return `
              <li class="part-option-row${equipped ? ' is-current' : ''} ${getPartRarityFrameClass(
                part
              )}">
                <div class="part-option-top">
                  <div class="part-option-meta">
                    ${renderPartBadges(part)}
                    <span class="part-option-id">#${part.id}</span>
                    <span class="part-option-name part-quality part-quality-${getPartRarity(part)}">${part.name}</span>
                  </div>
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
                ${renderPartChangeTags(getPartComparisonChanges(part, equippedPart))}
              </li>
            `;
          })
          .join('')}
      </ul>
    </div>
  `;

  return choices;
}

function createSlotDetailPanel(type, mobile = false) {
  const equippedPart = getEquippedPart(type);
  const panel = document.createElement(mobile ? 'div' : 'section');

  panel.className = `slot-detail-panel${mobile ? ' is-mobile' : ''}${
    equippedPart ? ` ${getPartRarityFrameClass(equippedPart)}` : ''
  }`;
  panel.innerHTML = `
    <div class="slot-detail-header">
      <div class="slot-detail-copy">
        <small class="slot-detail-kicker">${mobile ? '候选零件' : '当前槽位'}</small>
        <h3>${formatPartType(type)}</h3>
        <p class="slot-detail-current">${
          equippedPart ? `当前装备：${renderPartInlineLabel(equippedPart, true)}` : '当前装备：未装备'
        }</p>
      </div>
      <button
        type="button"
        class="slot-detail-unequip"
        data-action="unequip-slot"
        data-slot="${type}"
        ${equippedPart ? '' : 'disabled'}
      >
        ${equippedPart ? '卸下当前' : '当前空槽'}
      </button>
    </div>
    <p class="slot-detail-effect">${
      equippedPart ? `效果：${equippedPart.effectText}` : '效果：没有装备效果'
    }</p>
    ${getSlotSummaryTags(equippedPart)}
  `;
  panel.appendChild(createPartOptionList(type));
  return panel;
}

function bindTuningSlotEvents() {
  Array.from(el.garageSlotsBody.querySelectorAll('[data-action="select-slot"]')).forEach(
    (button) => {
      button.addEventListener('click', () => {
        activeTuningSlot = button.dataset.slot;
        renderTuning();
      });
    }
  );

  Array.from(el.garageSlotsBody.querySelectorAll('[data-action="toggle-slot"]')).forEach(
    (button) => {
      button.addEventListener('click', () => {
        const slot = button.dataset.slot;
        expandedTuningSlot = expandedTuningSlot === slot ? null : slot;
        activeTuningSlot = slot;
        renderTuning();
      });
    }
  );

  Array.from(el.garageSlotsBody.querySelectorAll('[data-action="equip-slot"]')).forEach((button) => {
    button.addEventListener('click', () => {
      const part = getPartById(Number(button.dataset.partId));
      if (!part) {
        return;
      }

      activeTuningSlot = part.type;
      expandedTuningSlot = part.type;
      changeEquipment(part.type, button.dataset.partId);
    });
  });

  Array.from(el.garageSlotsBody.querySelectorAll('[data-action="unequip-slot"]')).forEach(
    (button) => {
      button.addEventListener('click', () => {
        activeTuningSlot = button.dataset.slot;
        expandedTuningSlot = button.dataset.slot;
        changeEquipment(button.dataset.slot, '');
      });
    }
  );
}

function renderTuning() {
  el.garageSlotsBody.innerHTML = '';
  el.tuningEquippedBody.innerHTML = '';
  el.tuningUnequippedBody.innerHTML = '';
  const layout = syncTuningLayoutState();
  const tuningLayout = document.createElement('div');
  const slotOverview = document.createElement('div');

  tuningLayout.className = `tuning-layout tuning-layout-${layout}`;
  slotOverview.className = 'slot-overview';

  EQUIPMENT_SLOTS.forEach((type) => {
    slotOverview.appendChild(createSlotSummaryCard(type, layout));
  });

  tuningLayout.appendChild(slotOverview);
  if (layout === 'desktop' && activeTuningSlot) {
    tuningLayout.appendChild(createSlotDetailPanel(activeTuningSlot));
  }
  el.garageSlotsBody.appendChild(tuningLayout);
  bindTuningSlotEvents();

  const equippedItems = gameState.inventory.filter(
    (part) => gameState.equippedParts[part.type] === part.id
  );
  const unequippedItems = gameState.inventory.filter(
    (part) => gameState.equippedParts[part.type] !== part.id
  );

  if (equippedItems.length === 0) {
    el.tuningEquippedBody.appendChild(
      createTuningEmptyCard('暂无已装备零件', '在上方槽位选择零件后会显示在这里。')
    );
  } else {
    equippedItems.forEach((part) => {
      el.tuningEquippedBody.appendChild(createTuningPartCard(part, true));
    });
  }

  if (unequippedItems.length === 0) {
    el.tuningUnequippedBody.appendChild(
      createTuningEmptyCard('暂无未装备零件', '去商店购买零件后会显示在这里。')
    );
  } else {
    unequippedItems.forEach((part) => {
      el.tuningUnequippedBody.appendChild(createTuningPartCard(part, false));
    });
  }

  updateButtons();
}

function createTuningEmptyCard(title, hint) {
  const card = document.createElement('article');
  card.className = 'inventory-card';
  card.innerHTML = `
    <div>
      <h3>${title}</h3>
      <p>${hint}</p>
    </div>
  `;
  return card;
}

function createTuningPartCard(part, equipped) {
  const equippedPart = getEquippedPart(part.type);
  const card = document.createElement('article');
  card.className = `inventory-card${equipped ? ' is-current' : ''} ${getPartRarityFrameClass(
    part
  )}`;
  card.innerHTML = `
    <div>
      <div class="card-title-row">
        <h3>${renderPartName(part, true)}</h3>
        ${renderPartBadges(part)}
      </div>
      <p>类型：${formatPartType(part.type)}</p>
      ${renderPartComparison(part, equippedPart)}
      <small>${equipped ? '当前车辆已装备' : '库存零件，可装备或出售'}</small>
    </div>
  `;

  const actionButton = document.createElement('button');
  actionButton.type = 'button';
  actionButton.dataset.partId = String(part.id);
  if (equipped) {
    actionButton.textContent = '卸下';
    actionButton.dataset.action = 'unequip';
    actionButton.addEventListener('click', () => unequipPart(part.id));
  } else {
    actionButton.textContent = `出售 ${getPartSellPrice(part)} 元`;
    actionButton.dataset.action = 'sell';
    actionButton.addEventListener('click', () => sellPart(part.id));
  }
  card.appendChild(actionButton);
  return card;
}

function changeEquipment(type, value) {
  if (!canManageTuning()) {
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
  renderAtlas();
  if (typeof checkAchievements === 'function') {
    checkAchievements({ source: 'equipPart' });
  }
  checkGameFailure();
  autoSaveGame();
}

function unequipPart(partId) {
  if (!canManageTuning()) {
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
  renderAtlas();
  if (typeof checkAchievements === 'function') {
    checkAchievements({ source: 'equipPart' });
  }
  checkGameFailure();
  autoSaveGame();
}

function sellPart(partId) {
  if (!canManageTuning()) {
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

  addLog(`库存出售 ${part.name}，回收 ${sellPrice} 元。`);
  addLog(`现金余额：${gameState.cash} 元`);
  updateStats();
  renderGarage();
  renderAtlas();
  if (typeof checkAchievements === 'function') {
    checkAchievements({ source: 'cashChange' });
  }
  checkGameFailure();
  autoSaveGame();
}

function shouldShowAtlasPart(part, filter, ownedCount, inPool) {
  if (filter === 'owned') {
    return ownedCount > 0;
  }
  if (filter === 'unowned') {
    return ownedCount === 0;
  }
  if (filter === 'pool') {
    return inPool;
  }
  return true;
}

function getAtlasOwnershipText(ownedCount) {
  if (ownedCount <= 0) {
    return '未拥有';
  }
  return ownedCount > 1 ? `已拥有 ×${ownedCount}` : '已拥有';
}

function createAtlasEmptyState(filter) {
  const messages = {
    owned: ['暂无已拥有零件', '去商店买到第一件零件后，这里会开始记录。'],
    unowned: ['图鉴已收集完毕', '当前筛选下已经没有未拥有零件。'],
    pool: ['当前奖池没有匹配零件', '可以切换难度查看别的奖池范围。'],
    all: ['暂无图鉴数据', '当前没有可展示的零件。'],
  };
  const [title, hint] = messages[filter] || messages.all;
  const card = document.createElement('article');
  card.className = 'atlas-card atlas-card-empty';
  card.innerHTML = `
    <h4>${title}</h4>
    <p>${hint}</p>
  `;
  return card;
}

// 图鉴页只负责查看数据和收集状态，不承担装备操作。
function renderAtlas() {
  if (!el.atlasBody) {
    return;
  }

  const difficulty = getDifficulty();
  const pool = getCurrentLootPool();
  const ownedCounts = getOwnedPartCounts();
  const filter = gameState.atlasFilter || 'all';
  const totalParts = PART_POOL.length;
  const ownedTemplates = PART_POOL.filter((part) => (ownedCounts[part.templateId] || 0) > 0).length;
  const equippedCount = EQUIPMENT_SLOTS.filter((type) => Boolean(gameState.equippedParts[type])).length;
  const poolCount = PART_POOL.filter((part) => pool.includes(getPartRarity(part))).length;

  if (el.atlasDifficultyText) {
    const poolNames = pool.map((rarity) => PART_RARITY_LABELS[rarity]).join(' / ');
    el.atlasDifficultyText.textContent = `当前难度「${difficulty.name}」：商店奖池 ${poolNames}`;
  }
  if (el.atlasSummaryText) {
    el.atlasSummaryText.textContent = `已收集 ${ownedTemplates} / ${totalParts} 件，当前已装备 ${equippedCount} / ${EQUIPMENT_SLOTS.length} 槽，本难度奖池共 ${poolCount} 件。`;
  }
  el.atlasFilters.forEach((button) => {
    const active = button.dataset.atlasFilter === filter;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });

  el.atlasBody.innerHTML = '';
  let renderedCount = 0;

  EQUIPMENT_SLOTS.forEach((type) => {
    const parts = PART_POOL.filter((part) => part.type === type);
    if (parts.length === 0) {
      return;
    }

    const sorted = parts
      .slice()
      .sort(
        (a, b) =>
          PART_RARITY_ORDER.indexOf(getPartRarity(a)) - PART_RARITY_ORDER.indexOf(getPartRarity(b))
      );

    const group = document.createElement('section');
    group.className = 'atlas-group';

    const heading = document.createElement('h3');
    heading.className = 'atlas-group-title';
    heading.textContent = `${formatPartType(type)}（${parts.length} 件）`;

    const list = document.createElement('div');
    list.className = 'atlas-cards';

    sorted.forEach((part) => {
      const rate = getPartShopRate(part);
      const inPool = pool.includes(getPartRarity(part));
      const ownedCount = ownedCounts[part.templateId] || 0;
      if (!shouldShowAtlasPart(part, filter, ownedCount, inPool)) {
        return;
      }
      renderedCount += 1;
      const equipped = gameState.equippedParts[part.type]
        ? getPartById(gameState.equippedParts[part.type])
        : null;
      const isEquipped = equipped ? getPartTemplateId(equipped) === part.templateId : false;
      const card = document.createElement('article');
      card.className = `atlas-card ${getPartRarityFrameClass(part)}${
        inPool ? '' : ' is-out-of-pool'
      }${ownedCount ? ' is-owned' : ' is-unowned'}`;
      card.innerHTML = `
        <div class="atlas-card-head">
          <h4>${renderPartName(part)}</h4>
          ${renderPartBadges(part)}
        </div>
        <div class="atlas-meta-list">
          <p><strong>槽位</strong><span>${formatPartType(part.type)}</span></p>
          <p><strong>品质</strong><span>${PART_RARITY_LABELS[getPartRarity(part)]}</span></p>
          <p><strong>等级</strong><span>${formatPartLevel(part)}</span></p>
          <p><strong>属性效果</strong><span>${part.effectText}</span></p>
          <p><strong>基础出现率</strong><span>${inPool ? formatShopRate(rate) : '0%'}</span></p>
          <p><strong>当前难度</strong><span>${inPool ? '可刷出' : '不可刷出'}</span></p>
          <p><strong>拥有状态</strong><span>${getAtlasOwnershipText(ownedCount)}</span></p>
          <p><strong>装备状态</strong><span>${isEquipped ? '已装备' : '未装备'}</span></p>
        </div>
        <div class="atlas-rate">
          <span class="atlas-rate-label">${ownedCount > 0 ? '收集状态' : '当前状态'}</span>
          <span class="atlas-rate-value">${ownedCount > 0 ? getAtlasOwnershipText(ownedCount) : `未拥有｜${inPool ? '当前难度可刷出' : '当前难度不可刷出'}`}</span>
        </div>
        ${renderPartChangeList(part.changes)}
      `;
      list.appendChild(card);
    });

    if (!list.childNodes.length) {
      return;
    }

    group.appendChild(heading);
    group.appendChild(list);
    el.atlasBody.appendChild(group);
  });

  if (!renderedCount) {
    el.atlasBody.appendChild(createAtlasEmptyState(filter));
  }
}
