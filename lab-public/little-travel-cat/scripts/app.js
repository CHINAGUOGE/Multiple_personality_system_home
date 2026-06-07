import {
  DEV_HOUR_MS,
  FOODS,
  HOME_LINES,
  PROD_HOUR_MS,
  RESOURCE_CAP,
  RESOURCE_INTERVAL_MS,
  RETURNED_LINES,
  THEME_KEY,
  TOOLS,
  TRAVELING_LINES,
} from './data.js';
import {
  getActiveSlot,
  getSlotSummaries,
  loadSave,
  resetSave,
  saveGame,
  setActiveSlot,
  updateGardenByOfflineTime,
} from './save.js';
import { createTrip, getRouteName, settleTrip } from './trip.js';

/*
 * 小旅猫页面入口。
 * 负责保存当前槽位状态、绑定交互、定时结算离线进度并渲染所有面板。
 */

// 只保存页面会话状态；可持久化数据放在 state.save 并交给 save.js 归一化。
const state = {
  slot: 1,
  save: null,
  theme: 'system',
  selectedFoodId: null,
  selectedToolIds: new Set(),
  collectionView: 'postcards',
  saveStatus: '',
  lastSavedAt: null,
  toastTimer: null,
};

const $ = (selector) => document.querySelector(selector);
const queryParams = new URLSearchParams(window.location.search);
const isDevMode = () => queryParams.has('dev');
const getTripHourMs = () => (isDevMode() ? DEV_HOUR_MS : PROD_HOUR_MS);
const THEME_SEQUENCE = ['system', 'light', 'dark'];
const THEME_LABELS = {
  system: '主题：跟随系统',
  light: '主题：浅色',
  dark: '主题：夜间',
};
const systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');

document.addEventListener('DOMContentLoaded', init);

// 初始化后每秒同步一次，确保旅行到点和庭院资源不用刷新也能结算。
function init() {
  initTheme();
  state.slot = getActiveSlot();
  state.save = loadSave(state.slot);
  state.save.settings.devTimeScale = isDevMode();
  state.saveStatus = `已自动加载 槽位 ${state.slot}`;
  bindEvents();
  syncCurrentSave();
  render();

  window.setInterval(() => {
    const result = syncCurrentSave();
    render();

    if (result?.postcard || result?.souvenir) {
      showToast(
        result.souvenir ? '猫回来了，还带回了一件奇怪的小东西。' : '猫回来了，还带回了一张明信片。'
      );
    }
  }, 1000);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      syncCurrentSave();
      render();
    }
  });
}

// 所有事件都绑定在固定容器上，动态渲染的卡片通过 data-* 进行事件委托。
function bindEvents() {
  $('#themeToggleBtn').addEventListener('click', cycleTheme);

  $('#slotButtons').addEventListener('click', (event) => {
    const button = event.target.closest('[data-slot]');

    if (!button) {
      return;
    }

    switchSlot(Number(button.dataset.slot));
  });

  $('#collectDewBtn').addEventListener('click', collectDew);
  $('#startTripBtn').addEventListener('click', startTrip);
  $('#resetSaveBtn').addEventListener('click', resetCurrentSlot);

  $('#shopLists').addEventListener('click', (event) => {
    const button = event.target.closest('[data-buy-id]');

    if (!button) {
      return;
    }

    buyItem(button.dataset.buyType, button.dataset.buyId);
  });

  $('#luggagePanel').addEventListener('change', (event) => {
    const input = event.target;

    if (input.matches("input[name='foodChoice']")) {
      state.selectedFoodId = input.value;
      renderLuggage();
    }

    if (input.matches("input[name='toolChoice']")) {
      toggleTool(input);
    }
  });

  $('#collectionTabs').addEventListener('click', (event) => {
    const button = event.target.closest('[data-collection-view]');

    if (!button) {
      return;
    }

    state.collectionView = button.dataset.collectionView;
    renderCollection();
  });
}

function initTheme() {
  state.theme = getSavedTheme();
  applyTheme(state.theme);
  renderThemeButton(state.theme);

  systemThemeQuery.addEventListener('change', () => {
    if (getSavedTheme() !== 'system') {
      return;
    }

    state.theme = 'system';
    applyTheme('system');
    renderThemeButton('system');
  });
}

function getSavedTheme() {
  try {
    const theme = localStorage.getItem(THEME_KEY);
    return THEME_SEQUENCE.includes(theme) ? theme : 'system';
  } catch {
    return 'system';
  }
}

function saveTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // 主题只影响显示，localStorage 不可用时继续按当前页面会话生效。
  }
}

function resolveTheme(theme) {
  if (theme === 'dark' || theme === 'light') {
    return theme;
  }

  return systemThemeQuery.matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  const normalizedTheme = THEME_SEQUENCE.includes(theme) ? theme : 'system';
  const resolvedTheme = resolveTheme(normalizedTheme);

  document.documentElement.dataset.theme = resolvedTheme;
  document.documentElement.dataset.themeMode = normalizedTheme;
}

function cycleTheme() {
  const currentTheme = THEME_SEQUENCE.includes(state.theme) ? state.theme : getSavedTheme();
  const nextTheme =
    currentTheme === 'system' ? 'light' : currentTheme === 'light' ? 'dark' : 'system';

  state.theme = nextTheme;
  saveTheme(nextTheme);
  applyTheme(nextTheme);
  renderThemeButton(nextTheme);
}

// 同步当前存档的可变时间状态：离线资源和已完成旅行会在这里落盘。
function syncCurrentSave() {
  const generated = updateGardenByOfflineTime(state.save);
  const result = settleTrip(state.save);

  if (generated > 0 || result) {
    autoSave(result ? '旅行已结算并保存' : '庭院已自动保存');
  }

  return result;
}

function autoSave(label = '已自动保存') {
  saveGame(state.save, state.slot);
  state.lastSavedAt = Date.now();
  state.saveStatus = label;
  renderSaveStatus();
}

// 切换槽位前先保存当前槽，避免未结算的旅行或露珠进度丢失。
function switchSlot(nextSlot) {
  if (nextSlot === state.slot) {
    return;
  }

  syncCurrentSave();
  autoSave('切换前已保存当前槽');
  state.slot = setActiveSlot(nextSlot);
  state.save = loadSave(state.slot);
  state.save.settings.devTimeScale = isDevMode();
  state.selectedFoodId = null;
  state.selectedToolIds.clear();
  state.saveStatus = `已自动加载 槽位 ${state.slot}`;

  const result = syncCurrentSave();
  render();
  showToast(
    result?.souvenir ? '猫回来了，还带回了一件奇怪的小东西。' : `已切换到槽位 ${state.slot}。`
  );
}

function collectDew() {
  syncCurrentSave();

  const amount = state.save.garden.pending;

  if (amount <= 0) {
    showToast('庭院还没有露珠。');
    return;
  }

  state.save.dew += amount;
  state.save.garden.pending = 0;
  state.save.garden.lastGeneratedAt = Date.now();
  autoSave('收集露珠后已保存');
  render();
  showToast(`收集了 ${amount} 个露珠。`);
}

function buyItem(type, id) {
  syncCurrentSave();

  const source = type === 'food' ? FOODS : TOOLS;
  const item = source.find((entry) => entry.id === id);

  if (!item) {
    return;
  }

  if (type === 'tool' && state.save.inventory.tools[id]) {
    showToast('这个道具已经在柜子里了。');
    return;
  }

  if (state.save.dew < item.price) {
    showToast('露珠不够。');
    return;
  }

  state.save.dew -= item.price;

  if (type === 'food') {
    state.save.inventory.foods[id] = (state.save.inventory.foods[id] || 0) + 1;
  } else {
    state.save.inventory.tools[id] = 1;
  }

  autoSave('购买后已保存');
  render();
  showToast(`买到了${item.name}。`);
}

function toggleTool(input) {
  const id = input.value;

  if (input.checked) {
    if (state.selectedToolIds.size >= 2) {
      input.checked = false;
      showToast('最多带 2 个道具。');
      return;
    }

    state.selectedToolIds.add(id);
  } else {
    state.selectedToolIds.delete(id);
  }

  renderLuggage();
}

// 开始旅行只消费食物；工具作为携带条件和结果权重，不在这里扣库存。
function startTrip() {
  syncCurrentSave();

  if (state.save.traveler.status === 'traveling') {
    showToast('猫已经出门了。');
    return;
  }

  if (!state.selectedFoodId) {
    showToast('你还没有选择食物。');
    return;
  }

  if ((state.save.inventory.foods[state.selectedFoodId] || 0) <= 0) {
    showToast('食物库存不足。');
    return;
  }

  const toolIds = [...state.selectedToolIds];
  const hasUnavailableTool = toolIds.some((id) => !state.save.inventory.tools[id]);

  if (hasUnavailableTool) {
    showToast('道具必须先买到手。');
    return;
  }

  const trip = createTrip(state.selectedFoodId, toolIds, Date.now(), Math.random, getTripHourMs());

  if (!trip) {
    showToast('行李好像没有准备好。');
    return;
  }

  state.save.inventory.foods[state.selectedFoodId] -= 1;
  state.save.traveler.trip = trip;
  state.save.traveler.status = 'traveling';
  state.save.traveler.lastActionAt = Date.now();
  state.save.traveler.lastReturnMessage = '';
  state.save.settings.devTimeScale = isDevMode();
  state.selectedFoodId = null;
  state.selectedToolIds.clear();
  autoSave('猫出门后已保存');
  render();
  showToast('猫带着行李出门了。');
}

function resetCurrentSlot() {
  if (!confirm('确定要重置存档吗？这会清空露珠、收藏和旅行记录。')) {
    return;
  }

  state.save = resetSave(state.slot);
  state.selectedFoodId = null;
  state.selectedToolIds.clear();
  state.saveStatus = '存档已重置。';
  state.lastSavedAt = Date.now();
  render();
  showToast('存档已重置。');
}

// 总渲染入口；各 render* 函数只负责 DOM，不直接写 localStorage。
function render() {
  renderHeader();
  renderHome();
  renderGarden();
  renderShop();
  renderLuggage();
  renderCollection();
  renderSaveStatus();
}

function renderHeader() {
  renderThemeButton(state.theme);
  $('#currentSlotText').textContent = `槽位 ${state.slot}`;
  $('#dewBalance').textContent = `${state.save.dew} 露珠`;
  $('#statusBadge').textContent = state.save.traveler.status === 'traveling' ? '旅行中' : '在家';
  $('#paceNote').textContent = isDevMode()
    ? '测试节奏：1 小时 = 1 分钟'
    : '真实节奏：旅行按真实时间';

  const summaries = getSlotSummaries();
  $('#slotButtons').innerHTML = summaries
    .map((summary) => {
      const active = summary.slot === state.slot;
      const label = summary.isEmpty ? '新存档' : `${summary.postcardsReceived} 张明信片`;
      return `
        <button class="slot-button${active ? ' is-active' : ''}" type="button" data-slot="${summary.slot}" aria-pressed="${active}">
          <span>槽 ${summary.slot}</span>
          <small>${escapeHtml(label)}</small>
        </button>
      `;
    })
    .join('');
}

function renderThemeButton(theme = getSavedTheme()) {
  const button = $('#themeToggleBtn');

  if (!button) {
    return;
  }

  const normalizedTheme = THEME_SEQUENCE.includes(theme) ? theme : 'system';
  const label = THEME_LABELS[normalizedTheme];
  button.textContent = label;
  button.dataset.themeMode = normalizedTheme;
  button.setAttribute('aria-label', `${label}，点击切换主题`);
}

function renderSaveStatus() {
  const savedAt = state.lastSavedAt ? ` · ${formatClock(state.lastSavedAt)}` : '';
  $('#saveStatus').textContent = `${state.saveStatus}${savedAt}`;
}

function renderHome() {
  const save = state.save;
  const trip = save.traveler.trip;
  const isTraveling = save.traveler.status === 'traveling' && trip;
  const justReturned =
    save.traveler.lastReturnAt && Date.now() - save.traveler.lastReturnAt < 3 * 60 * 1000;
  const copyLines = isTraveling
    ? TRAVELING_LINES
    : justReturned
      ? RETURNED_LINES
      : [pickStable(HOME_LINES, save.traveler.lastActionAt + state.slot)];

  $('#catScene').classList.toggle('is-away', Boolean(isTraveling));
  $('#catScene').classList.toggle('is-returned', Boolean(!isTraveling && justReturned));
  $('#homeText').innerHTML = copyLines.map((line) => `<span>${escapeHtml(line)}</span>`).join('');
  $('#tripRoute').textContent = isTraveling ? getRouteName(trip.routeId) : '还没出门';
  $('#tripReturnTime').textContent = isTraveling ? formatClock(trip.returnsAt) : '等待行李';
  $('#tripRemaining').textContent = isTraveling
    ? formatDuration(Math.max(0, trip.returnsAt - Date.now()))
    : '猫在家';

  const progress = isTraveling
    ? clamp((Date.now() - trip.startedAt) / Math.max(1, trip.returnsAt - trip.startedAt), 0, 1)
    : 0;
  $('#tripProgressBar').style.width = `${Math.round(progress * 100)}%`;
  $('#returnNotice').textContent =
    save.traveler.lastReturnMessage || '打开看看，猫可能正在盘算下一趟路。';
}

function renderGarden() {
  const pending = state.save.garden.pending;
  const elapsed = Math.max(0, Date.now() - state.save.garden.lastGeneratedAt);
  const nextMs = pending >= RESOURCE_CAP ? 0 : Math.max(0, RESOURCE_INTERVAL_MS - elapsed);
  const dropProgress = pending >= RESOURCE_CAP ? 1 : clamp(elapsed / RESOURCE_INTERVAL_MS, 0, 1);
  const gardenPanel = $('.garden-panel');
  const dewTop = 12 + dropProgress * 76;
  const landingScale = 0.56 + dropProgress * 0.44;
  const landingOpacity = 0.24 + dropProgress * 0.54;

  $('#gardenPending').textContent = `${pending} / ${RESOURCE_CAP}`;
  $('#gardenHint').textContent =
    pending >= RESOURCE_CAP
      ? '庭院已经满了，先收一下吧。'
      : `下一颗露珠约 ${formatDuration(nextMs)} 后出现。`;
  $('#collectDewBtn').disabled = pending <= 0;
  gardenPanel.style.setProperty('--dew-progress', dropProgress.toFixed(3));
  gardenPanel.style.setProperty('--dew-top', `${dewTop.toFixed(1)}px`);
  gardenPanel.style.setProperty('--dew-landing-scale', landingScale.toFixed(3));
  gardenPanel.style.setProperty('--dew-landing-opacity', landingOpacity.toFixed(3));
  gardenPanel.classList.toggle('is-full', pending >= RESOURCE_CAP);
  gardenPanel.classList.toggle('has-pending', pending > 0);
}

function renderShop() {
  const foodCards = FOODS.map((food) => {
    const count = state.save.inventory.foods[food.id] || 0;
    return itemCard({
      title: food.name,
      meta: `${food.price} 露珠`,
      description: food.description,
      detail: `库存 ${count} · ${food.tripHoursMin}-${food.tripHoursMax} 小时`,
      button: `<button type="button" data-buy-type="food" data-buy-id="${food.id}">购买</button>`,
    });
  }).join('');
  const toolCards = TOOLS.map((tool) => {
    const owned = Boolean(state.save.inventory.tools[tool.id]);
    return itemCard({
      title: tool.name,
      meta: owned ? '已拥有' : `${tool.price} 露珠`,
      description: tool.description,
      detail: owned ? '可重复使用' : '购买后永久保留',
      button: `<button type="button" data-buy-type="tool" data-buy-id="${tool.id}" ${owned ? 'disabled' : ''}>${
        owned ? '已拥有' : '购买'
      }</button>`,
    });
  }).join('');

  $('#shopLists').innerHTML = `
    <div class="shop-group">
      <h3>食物</h3>
      <div class="item-grid">${foodCards}</div>
    </div>
    <div class="shop-group">
      <h3>旅行道具</h3>
      <div class="item-grid">${toolCards}</div>
    </div>
  `;
}

function renderLuggage() {
  const isTraveling = state.save.traveler.status === 'traveling';
  const foodChoices = FOODS.map((food) => {
    const count = state.save.inventory.foods[food.id] || 0;
    const disabled = count <= 0 || isTraveling;
    const checked = state.selectedFoodId === food.id;
    return choiceCard({
      kind: 'radio',
      name: 'foodChoice',
      value: food.id,
      checked,
      disabled,
      title: food.name,
      meta: `库存 ${count}`,
      description: food.description,
    });
  }).join('');
  const toolChoices = TOOLS.map((tool) => {
    const owned = Boolean(state.save.inventory.tools[tool.id]);
    const checked = state.selectedToolIds.has(tool.id);
    return choiceCard({
      kind: 'checkbox',
      name: 'toolChoice',
      value: tool.id,
      checked,
      disabled: !owned || isTraveling,
      title: tool.name,
      meta: owned ? '柜子里有' : '还没买',
      description: tool.description,
    });
  }).join('');

  $('#foodChoices').innerHTML = foodChoices;
  $('#toolChoices').innerHTML = toolChoices;
  $('#toolCount').textContent = `${state.selectedToolIds.size} / 2`;
  $('#startTripBtn').disabled = isTraveling;
}

function renderCollection() {
  const isPostcards = state.collectionView === 'postcards';
  $('#postcardTab').classList.toggle('is-active', isPostcards);
  $('#souvenirTab').classList.toggle('is-active', !isPostcards);
  $('#postcardTab').setAttribute('aria-pressed', String(isPostcards));
  $('#souvenirTab').setAttribute('aria-pressed', String(!isPostcards));
  $('#collectionStats').textContent =
    `${state.save.stats.postcardsReceived} 张明信片 · ${state.save.stats.souvenirsReceived} 件小东西`;

  if (isPostcards) {
    $('#collectionList').innerHTML = renderPostcards();
    return;
  }

  $('#collectionList').innerHTML = renderSouvenirs();
}

function renderPostcards() {
  if (state.save.postcards.length === 0) {
    return emptyState('还没有明信片。等猫出门回来，它会叼一张回来。');
  }

  return state.save.postcards
    .map(
      (postcard) => `
        <article class="collection-card postcard-card">
          <div>
            <span class="route-pill">${escapeHtml(postcard.routeName || getRouteName(postcard.routeId))}</span>
            <span class="route-pill">${escapeHtml(postcard.weather || '微风')}</span>
          </div>
          <h3>${escapeHtml(postcard.title)}</h3>
          <p>${escapeHtml(postcard.description)}</p>
          <small>${formatDate(postcard.createdAt)}</small>
        </article>
      `
    )
    .join('');
}

function renderSouvenirs() {
  const souvenirs = Object.values(state.save.inventory.souvenirs).sort(
    (a, b) => (b.lastObtainedAt || b.obtainedAt || 0) - (a.lastObtainedAt || a.obtainedAt || 0)
  );

  if (souvenirs.length === 0) {
    return emptyState('还没有纪念品。猫偶尔会把奇怪的小东西带回来。');
  }

  return souvenirs
    .map(
      (souvenir) => `
        <article class="collection-card souvenir-card">
          <div>
            <span class="route-pill rarity-${escapeHtml(souvenir.rarity)}">${rarityText(souvenir.rarity)}</span>
            <span class="route-pill">x${souvenir.count}</span>
          </div>
          <h3>${escapeHtml(souvenir.name)}</h3>
          <p>${escapeHtml(souvenir.description)}</p>
          <small>${escapeHtml(souvenir.fromRouteName || getRouteName(souvenir.fromRoute))} · ${formatDate(
            souvenir.lastObtainedAt || souvenir.obtainedAt
          )}</small>
        </article>
      `
    )
    .join('');
}

function itemCard({ title, meta, description, detail, button }) {
  return `
    <article class="item-card">
      <div>
        <div class="item-heading">
          <h4>${escapeHtml(title)}</h4>
          <span>${escapeHtml(meta)}</span>
        </div>
        <p>${escapeHtml(description)}</p>
        <small>${escapeHtml(detail)}</small>
      </div>
      ${button}
    </article>
  `;
}

function choiceCard({ kind, name, value, checked, disabled, title, meta, description }) {
  return `
    <label class="choice-card${checked ? ' is-selected' : ''}${disabled ? ' is-disabled' : ''}">
      <input type="${kind}" name="${name}" value="${value}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''} />
      <span>
        <strong>${escapeHtml(title)}</strong>
        <small>${escapeHtml(meta)}</small>
        <em>${escapeHtml(description)}</em>
      </span>
    </label>
  `;
}

function emptyState(text) {
  return `<div class="empty-state">${escapeHtml(text)}</div>`;
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.hidden = false;

  window.clearTimeout(state.toastTimer);
  state.toastTimer = window.setTimeout(() => {
    toast.hidden = true;
  }, 3200);
}

function formatDuration(ms) {
  if (ms <= 0) {
    return '现在';
  }

  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes <= 0) {
    return `${seconds} 秒`;
  }

  return `${minutes} 分 ${seconds.toString().padStart(2, '0')} 秒`;
}

function formatClock(timestamp) {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

function formatDate(timestamp) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

function pickStable(items, seed) {
  const index = Math.abs(Math.floor(seed / 1000)) % items.length;
  return items[index];
}

function rarityText(rarity) {
  if (rarity === 'rare') {
    return '稀少';
  }

  if (rarity === 'uncommon') {
    return '少见';
  }

  return '普通';
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

if (queryParams.has('debug')) {
  window.littleTravelCatDebug = {
    getState: () => state,
    forceReturn: () => {
      if (!state.save.traveler.trip) {
        return false;
      }

      state.save.traveler.trip.returnsAt = Date.now();
      syncCurrentSave();
      render();
      return true;
    },
    isDevTimeScale: () => isDevMode(),
  };
}
