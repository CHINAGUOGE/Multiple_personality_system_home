import {
  FOODS,
  HOUR_MS,
  POSTCARD_DESCRIPTIONS,
  POSTCARD_TITLES,
  ROUTES,
  SOUVENIRS,
  SOUVENIR_CHANCE,
  SPECIAL_POSTCARD_DESCRIPTIONS,
  SPECIAL_POSTCARD_TITLES,
  WEATHERS,
} from './data.js';

/*
 * 旅行模块负责创建旅程、到点结算和生成收集结果。
 * 结果使用 trip.resultSeed 生成，避免重复结算时出现不同奖励。
 */

export function createTrip(
  foodId,
  toolIds,
  now = Date.now(),
  randomSource = Math.random,
  hourMs = HOUR_MS
) {
  const food = FOODS.find((item) => item.id === foodId);

  if (!food) {
    return null;
  }

  const durationHours = roundToTenth(
    food.tripHoursMin + randomSource() * (food.tripHoursMax - food.tripHoursMin)
  );
  const route = chooseRoute(durationHours, toolIds, randomSource);
  const resultSeed = Math.floor(randomSource() * 2_147_483_647);
  const effectiveHourMs = Number.isFinite(hourMs) && hourMs > 0 ? hourMs : HOUR_MS;

  return {
    id: createId('trip', now, randomSource),
    routeId: route.id,
    startedAt: now,
    returnsAt: now + Math.max(1, durationHours) * effectiveHourMs,
    foodId,
    toolIds: [...toolIds],
    resultSeed,
  };
}

// 结算时先检查是否已生成过同 tripId 的明信片，避免刷新页面后重复领奖。
export function settleTrip(save, now = Date.now()) {
  const trip = save.traveler.trip;

  if (!trip || now < trip.returnsAt) {
    return null;
  }

  if (save.postcards.some((postcard) => postcard.tripId === trip.id)) {
    clearFinishedTrip(save, now, '猫回来了。');
    return {
      postcard: null,
      souvenir: null,
      alreadySettled: true,
    };
  }

  const rng = seededRandom(trip.resultSeed || trip.startedAt);
  const route = ROUTES.find((item) => item.id === trip.routeId) || ROUTES[0];
  const postcard = createPostcard(trip, route, rng);
  const souvenir = rng() < SOUVENIR_CHANCE ? createSouvenir(trip, route, rng) : null;

  save.postcards.unshift(postcard);
  save.stats.tripsCompleted += 1;
  save.stats.postcardsReceived += 1;

  if (souvenir) {
    addSouvenir(save, souvenir, now);
    save.stats.souvenirsReceived += 1;
  }

  clearFinishedTrip(
    save,
    now,
    souvenir ? '猫回来了，还带回了一件奇怪的小东西。' : '猫回来了，还带回了一张明信片。'
  );

  return {
    postcard,
    souvenir,
    alreadySettled: false,
  };
}

export function getRouteName(routeId) {
  return ROUTES.find((route) => route.id === routeId)?.name || '不知道哪里';
}

// 路线权重由食物时长和工具共同决定，长时长更容易走到基础耗时更高的路线。
function chooseRoute(durationHours, toolIds, randomSource) {
  const weightedRoutes = ROUTES.map((route) => {
    const distanceFit = 1 / (0.35 + Math.abs(route.baseHours - durationHours));
    let weight = 0.8 + distanceFit * 2.4;

    if (durationHours >= route.baseHours) {
      weight *= 1.25;
    }

    if (toolIds.includes('old_map') && route.baseHours >= 4) {
      weight *= 1.45;
    }

    if (toolIds.includes('glass_bottle') && ['river_path', 'sea_wall'].includes(route.id)) {
      weight *= 1.8;
    }

    if (toolIds.includes('folding_mat') && ['near_rooftop', 'old_station'].includes(route.id)) {
      weight *= 1.55;
    }

    if (toolIds.includes('tiny_scarf') && route.id === 'snow_alley') {
      weight *= 2;
    }

    return {
      route,
      weight,
    };
  });

  return chooseWeighted(weightedRoutes, randomSource).route;
}

function createPostcard(trip, route, rng) {
  const hasBell = trip.toolIds.includes('small_bell');
  const useSpecial = hasBell && rng() < 0.35;
  const titlePool = useSpecial ? SPECIAL_POSTCARD_TITLES : POSTCARD_TITLES;
  const descriptionPool = useSpecial ? SPECIAL_POSTCARD_DESCRIPTIONS : POSTCARD_DESCRIPTIONS;

  return {
    id: `postcard_${trip.id}`,
    tripId: trip.id,
    title: choose(titlePool, rng),
    description: choose(descriptionPool, rng),
    routeId: route.id,
    routeName: route.name,
    weather: choose(WEATHERS, rng),
    createdAt: Date.now(),
  };
}

function createSouvenir(trip, route, rng) {
  const weightedSouvenirs = SOUVENIRS.map((souvenir) => {
    let weight = rarityWeight(souvenir.rarity);

    if (trip.toolIds.includes('glass_bottle') && souvenir.id === 'small_shell') {
      weight *= 1.6;
    }

    if (route.id === 'old_station' && souvenir.id === 'half_ticket') {
      weight *= 1.5;
    }

    return {
      souvenir,
      weight,
    };
  });
  const picked = chooseWeighted(weightedSouvenirs, rng).souvenir;

  return {
    ...picked,
    fromRoute: route.id,
    fromRouteName: route.name,
    obtainedAt: Date.now(),
  };
}

function addSouvenir(save, souvenir, now) {
  const existing = save.inventory.souvenirs[souvenir.id];

  if (existing) {
    save.inventory.souvenirs[souvenir.id] = {
      ...existing,
      fromRoute: souvenir.fromRoute,
      fromRouteName: souvenir.fromRouteName,
      lastObtainedAt: now,
      count: existing.count + 1,
    };
    return;
  }

  save.inventory.souvenirs[souvenir.id] = {
    ...souvenir,
    lastObtainedAt: souvenir.obtainedAt,
    count: 1,
  };
}

function clearFinishedTrip(save, now, message) {
  save.traveler.trip = null;
  save.traveler.status = 'home';
  save.traveler.lastActionAt = now;
  save.traveler.lastReturnAt = now;
  save.traveler.lastReturnMessage = message;
}

function chooseWeighted(items, randomSource) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let cursor = randomSource() * total;

  for (const item of items) {
    cursor -= item.weight;

    if (cursor <= 0) {
      return item;
    }
  }

  return items.at(-1);
}

function choose(items, randomSource) {
  return items[Math.floor(randomSource() * items.length)] || items[0];
}

function rarityWeight(rarity) {
  if (rarity === 'rare') {
    return 1;
  }

  if (rarity === 'uncommon') {
    return 3;
  }

  return 6;
}

// 使用轻量可复现随机数，保证同一个 resultSeed 对应同一批结算内容。
function seededRandom(seed) {
  let state = seed || 1;

  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function createId(prefix, now, randomSource) {
  const randomPart = Math.floor(randomSource() * 1_000_000).toString(36);
  return `${prefix}_${now.toString(36)}_${randomPart}`;
}

function roundToTenth(value) {
  return Math.round(value * 10) / 10;
}
