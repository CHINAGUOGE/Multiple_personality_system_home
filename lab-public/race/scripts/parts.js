'use strict';

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
}
