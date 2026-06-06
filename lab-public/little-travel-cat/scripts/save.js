import {
  ACTIVE_SLOT_KEY,
  DEV_TIME_SCALE,
  RESOURCE_CAP,
  RESOURCE_INTERVAL_MS,
  SAVE_KEY_PREFIX,
  SAVE_VERSION,
  SLOT_COUNT,
} from './data.js';

const nowValue = () => Date.now();

const isRecord = (value) => value && typeof value === 'object' && !Array.isArray(value);

export function clampSlot(slot) {
  const parsed = Number.parseInt(slot, 10);

  if (!Number.isInteger(parsed)) {
    return 1;
  }

  return Math.min(SLOT_COUNT, Math.max(1, parsed));
}

export function getSlotSaveKey(slot) {
  return `${SAVE_KEY_PREFIX}${clampSlot(slot)}`;
}

export function getActiveSlot() {
  const stored = localStorage.getItem(ACTIVE_SLOT_KEY);
  const slot = clampSlot(stored || 1);
  localStorage.setItem(ACTIVE_SLOT_KEY, String(slot));
  return slot;
}

export function setActiveSlot(slot) {
  const nextSlot = clampSlot(slot);
  localStorage.setItem(ACTIVE_SLOT_KEY, String(nextSlot));
  return nextSlot;
}

export function createDefaultSave(now = nowValue()) {
  return {
    version: SAVE_VERSION,
    dew: 0,
    inventory: {
      foods: {},
      tools: {},
      souvenirs: {},
    },
    postcards: [],
    traveler: {
      name: '小旅猫',
      status: 'home',
      trip: null,
      lastActionAt: now,
      lastReturnAt: null,
      lastReturnMessage: '',
    },
    garden: {
      lastGeneratedAt: now,
      pending: 0,
    },
    stats: {
      tripsCompleted: 0,
      postcardsReceived: 0,
      souvenirsReceived: 0,
    },
    settings: {
      devTimeScale: DEV_TIME_SCALE,
    },
  };
}

export function normalizeSave(input, now = nowValue()) {
  const fallback = createDefaultSave(now);
  const save = isRecord(input) ? input : fallback;

  return {
    version: SAVE_VERSION,
    dew: normalizeCount(save.dew),
    inventory: {
      foods: normalizeInventoryMap(save.inventory?.foods),
      tools: normalizeInventoryMap(save.inventory?.tools),
      souvenirs: normalizeSouvenirMap(save.inventory?.souvenirs),
    },
    postcards: Array.isArray(save.postcards) ? save.postcards.filter(isRecord) : [],
    traveler: {
      name: typeof save.traveler?.name === 'string' ? save.traveler.name : '小旅猫',
      status: normalizeStatus(save.traveler?.status, save.traveler?.trip),
      trip: isRecord(save.traveler?.trip) ? normalizeTrip(save.traveler.trip) : null,
      lastActionAt: normalizeTimestamp(save.traveler?.lastActionAt, now),
      lastReturnAt: normalizeOptionalTimestamp(save.traveler?.lastReturnAt),
      lastReturnMessage:
        typeof save.traveler?.lastReturnMessage === 'string' ? save.traveler.lastReturnMessage : '',
    },
    garden: {
      lastGeneratedAt: normalizeTimestamp(save.garden?.lastGeneratedAt, now),
      pending: Math.min(RESOURCE_CAP, normalizeCount(save.garden?.pending)),
    },
    stats: {
      tripsCompleted: normalizeCount(save.stats?.tripsCompleted),
      postcardsReceived: normalizeCount(save.stats?.postcardsReceived),
      souvenirsReceived: normalizeCount(save.stats?.souvenirsReceived),
    },
    settings: {
      devTimeScale:
        typeof save.settings?.devTimeScale === 'boolean'
          ? save.settings.devTimeScale
          : DEV_TIME_SCALE,
    },
  };
}

export function loadSave(slot = getActiveSlot()) {
  const key = getSlotSaveKey(slot);
  const raw = localStorage.getItem(key);

  if (!raw) {
    const created = createDefaultSave();
    saveGame(created, slot);
    return created;
  }

  try {
    const parsed = JSON.parse(raw);
    const normalized = normalizeSave(parsed);
    saveGame(normalized, slot);
    return normalized;
  } catch {
    const created = createDefaultSave();
    saveGame(created, slot);
    return created;
  }
}

export function saveGame(save, slot = getActiveSlot()) {
  localStorage.setItem(getSlotSaveKey(slot), JSON.stringify(normalizeSave(save)));
}

export function resetSave(slot = getActiveSlot()) {
  const nextSave = createDefaultSave();
  saveGame(nextSave, slot);
  return nextSave;
}

export function updateGardenByOfflineTime(save, now = nowValue()) {
  const garden = save.garden;
  const elapsed = Math.max(0, now - garden.lastGeneratedAt);
  const generated = Math.floor(elapsed / RESOURCE_INTERVAL_MS);

  if (generated <= 0 || garden.pending >= RESOURCE_CAP) {
    if (garden.pending >= RESOURCE_CAP) {
      garden.lastGeneratedAt = now;
    }
    return 0;
  }

  const before = garden.pending;
  garden.pending = Math.min(RESOURCE_CAP, garden.pending + generated);
  garden.lastGeneratedAt =
    garden.pending >= RESOURCE_CAP
      ? now
      : garden.lastGeneratedAt + generated * RESOURCE_INTERVAL_MS;

  return garden.pending - before;
}

export function getSlotSummaries() {
  return Array.from({ length: SLOT_COUNT }, (_, index) => {
    const slot = index + 1;
    const raw = localStorage.getItem(getSlotSaveKey(slot));

    if (!raw) {
      return {
        slot,
        isEmpty: true,
        dew: 0,
        status: 'home',
        tripsCompleted: 0,
        postcardsReceived: 0,
      };
    }

    try {
      const save = normalizeSave(JSON.parse(raw));
      return {
        slot,
        isEmpty: false,
        dew: save.dew,
        status: save.traveler.status,
        tripsCompleted: save.stats.tripsCompleted,
        postcardsReceived: save.stats.postcardsReceived,
      };
    } catch {
      return {
        slot,
        isEmpty: true,
        dew: 0,
        status: 'home',
        tripsCompleted: 0,
        postcardsReceived: 0,
      };
    }
  });
}

function normalizeCount(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function normalizeTimestamp(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeOptionalTimestamp(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeInventoryMap(value) {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, count]) => [key, normalizeCount(count)])
      .filter(([, count]) => count > 0)
  );
}

function normalizeSouvenirMap(value) {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, item]) => isRecord(item))
      .map(([key, item]) => {
        const obtainedAt = normalizeTimestamp(item.obtainedAt, nowValue());
        return [
          key,
          {
            id: typeof item.id === 'string' ? item.id : key,
            name: typeof item.name === 'string' ? item.name : key,
            description: typeof item.description === 'string' ? item.description : '',
            rarity: typeof item.rarity === 'string' ? item.rarity : 'common',
            fromRoute: typeof item.fromRoute === 'string' ? item.fromRoute : '',
            obtainedAt,
            lastObtainedAt: normalizeTimestamp(item.lastObtainedAt, obtainedAt),
            count: Math.max(1, normalizeCount(item.count)),
          },
        ];
      })
  );
}

function normalizeStatus(status, trip) {
  if (trip) {
    return 'traveling';
  }

  if (status === 'traveling') {
    return 'home';
  }

  return ['home', 'traveling', 'returned', 'resting'].includes(status) ? status : 'home';
}

function normalizeTrip(trip) {
  return {
    id: typeof trip.id === 'string' ? trip.id : `trip_${Date.now()}`,
    routeId: typeof trip.routeId === 'string' ? trip.routeId : '',
    startedAt: normalizeTimestamp(trip.startedAt, nowValue()),
    returnsAt: normalizeTimestamp(trip.returnsAt, nowValue()),
    foodId: typeof trip.foodId === 'string' ? trip.foodId : '',
    toolIds: Array.isArray(trip.toolIds) ? trip.toolIds.filter((id) => typeof id === 'string') : [],
    resultSeed: normalizeTimestamp(trip.resultSeed, nowValue()),
  };
}
