'use strict';

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
  autoSaveGame();
}

function renderGarage() {
  renderTuning();
  renderStorage();
}

function renderTuning() {
  el.garageSlotsBody.innerHTML = '';
  el.tuningEquippedBody.innerHTML = '';
  el.tuningUnequippedBody.innerHTML = '';

  EQUIPMENT_SLOTS.forEach((type) => {
    const parts = gameState.inventory.filter((part) => part.type === type);
    const equippedPart = getEquippedPart(type);
    const card = document.createElement('article');
    card.className = 'slot-card';

    const select = document.createElement('select');
    select.className = 'slot-card-select';
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
    if (equippedPart) {
      select.classList.add(`part-quality-${getPartRarity(equippedPart)}`);
    }
    select.addEventListener('change', () => changeEquipment(type, select.value));

    const details = document.createElement('div');
    details.className = 'slot-card-details';
    details.innerHTML = `
      <h3>${formatPartType(type)}</h3>
      <p class="slot-card-current">${equippedPart ? `当前：${renderPartName(equippedPart, true)}` : '当前：未装备'}</p>
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
                    ${renderPartOptionLabel(part, equippedPart)}
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
  card.className = `inventory-card${equipped ? ' is-current' : ''}`;
  card.innerHTML = `
    <div>
      <div class="card-title-row">
        <h3>${renderPartName(part, true)}</h3>
        ${renderPartRarity(part)}
      </div>
      <p>类型：${formatPartType(part.type)}</p>
      ${renderPartComparison(part, equippedPart)}
      <small>${equipped ? '当前车辆已装备' : '仓库零件，可装备或出售'}</small>
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

function renderStorage() {
  el.storageInventoryBody.innerHTML = '';
  el.storageMaterialsBody.innerHTML = '';

  if (gameState.inventory.length === 0) {
    el.storageInventoryBody.appendChild(
      createTuningEmptyCard('暂无零件', '去商店购买零件后会显示在这里。')
    );
  } else {
    gameState.inventory.forEach((part) => {
      const equipped = gameState.equippedParts[part.type] === part.id;
      const card = document.createElement('article');
      card.className = `inventory-card${equipped ? ' is-current' : ''}`;
      card.innerHTML = `
        <div>
          <div class="card-title-row">
            <h3>${renderPartName(part, true)}</h3>
            ${renderPartRarity(part)}
          </div>
          <p>类型：${formatPartType(part.type)}</p>
          <p>效果：${part.effectText}</p>
          <small>${equipped ? '已装备在当前车辆' : '仓库库存零件'}</small>
        </div>
      `;
      el.storageInventoryBody.appendChild(card);
    });
  }

  el.storageMaterialsBody.appendChild(
    createTuningEmptyCard('暂无材料', '材料系统尚未开放，敬请期待。')
  );
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

  addLog(`仓库出售 ${part.name}，回收 ${sellPrice} 元。`);
  addLog(`现金余额：${gameState.cash} 元`);
  updateStats();
  renderGarage();
  checkGameFailure();
  autoSaveGame();
}

// 装备图鉴：只读展示，按零件类型分组。
// 所有出现率数值从配置计算（getPartShopRate），不在模板写死。
function renderAtlas() {
  if (!el.atlasBody) {
    return;
  }

  const difficulty = getDifficulty();
  const pool = getCurrentLootPool();

  if (el.atlasDifficultyText) {
    const poolNames = pool.map((rarity) => PART_RARITY_LABELS[rarity]).join(' / ');
    el.atlasDifficultyText.textContent = `当前难度「${difficulty.name}」：商店奖池 ${poolNames}`;
  }

  el.atlasBody.innerHTML = '';

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
    group.appendChild(heading);

    const list = document.createElement('div');
    list.className = 'atlas-cards';

    sorted.forEach((part) => {
      const rate = getPartShopRate(part);
      const inPool = pool.includes(getPartRarity(part));
      const card = document.createElement('article');
      card.className = `atlas-card${inPool ? '' : ' is-out-of-pool'}`;
      card.innerHTML = `
        <div class="atlas-card-head">
          <h4>${renderPartName(part)}</h4>
          ${renderPartRarity(part)}
        </div>
        <div class="atlas-rate">
          <span class="atlas-rate-label">当前难度基础出现率</span>
          <span class="atlas-rate-value">${inPool ? formatShopRate(rate) : '本难度不出现'}</span>
        </div>
        ${renderPartChangeList(part.changes)}
      `;
      list.appendChild(card);
    });

    group.appendChild(list);
    el.atlasBody.appendChild(group);
  });
}
