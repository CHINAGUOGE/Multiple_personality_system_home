const TRAVEL_CAT_LOG_ENDPOINT = '/api/log';
const TRAVEL_CAT_SESSION_STORAGE_KEY = 'little-travel-cat-session-id-v1';
const TRAVEL_CAT_SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const TRAVEL_CAT_SOURCE = 'little-travel-cat';
const TRAVEL_CAT_APP_VERSION = 'v0.1';
const TRAVEL_CAT_HOOK_EVENT = 'little-travel-cat:event';
const TRAVEL_CAT_ALLOWED_TELEMETRY_EVENTS = new Set([
  'lab_little_travel_cat_ready',
  'lab_little_travel_cat_trip_start',
  'lab_little_travel_cat_trip_return',
  'lab_little_travel_cat_dew_collect',
  'lab_little_travel_cat_shop_buy',
  'lab_little_travel_cat_slot_switch',
  'lab_little_travel_cat_save_reset',
  'lab_little_travel_cat_theme_change',
  'lab_little_travel_cat_debug_force_return',
  'lab_error',
]);

function createTravelCatSessionId() {
  const bytes = new Uint8Array(16);

  if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
    window.crypto.getRandomValues(bytes);
    const token = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `travel_cat_${token}`;
  }

  return `travel_cat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

function getTravelCatSessionId() {
  const now = Date.now();

  try {
    const storedSession = JSON.parse(
      window.localStorage.getItem(TRAVEL_CAT_SESSION_STORAGE_KEY) || 'null'
    );

    if (
      storedSession &&
      typeof storedSession.id === 'string' &&
      Number.isFinite(storedSession.createdAt) &&
      now - storedSession.createdAt < TRAVEL_CAT_SESSION_MAX_AGE_MS
    ) {
      return storedSession.id;
    }

    const nextSessionId = createTravelCatSessionId();
    window.localStorage.setItem(
      TRAVEL_CAT_SESSION_STORAGE_KEY,
      JSON.stringify({ id: nextSessionId, createdAt: now })
    );
    return nextSessionId;
  } catch {
    return createTravelCatSessionId();
  }
}

function getTravelCatTelemetryPath() {
  const path = window.location.pathname;

  if (path.endsWith('/little-travel-cat/index.html')) {
    return path.replace(/index\.html$/, '');
  }

  return path || '/little-travel-cat/';
}

function clonePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return {};
  }

  try {
    return JSON.parse(JSON.stringify(payload));
  } catch {
    return {};
  }
}

function shouldWriteConsoleLog() {
  const params = new URLSearchParams(window.location.search);
  return params.has('debug') || params.has('log');
}

function sendTravelCatTelemetry(body) {
  if (window.location.protocol === 'file:') {
    return;
  }

  let serializedBody = '';

  try {
    serializedBody = JSON.stringify(body);
  } catch {
    return;
  }

  if (!serializedBody || serializedBody.length > 4096) {
    return;
  }

  if (typeof navigator.sendBeacon === 'function') {
    const blob = new Blob([serializedBody], { type: 'application/json' });

    if (navigator.sendBeacon(TRAVEL_CAT_LOG_ENDPOINT, blob)) {
      return;
    }
  }

  if (typeof fetch === 'function') {
    fetch(TRAVEL_CAT_LOG_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: serializedBody,
      keepalive: true,
    }).catch(() => {});
  }
}

export function emitTravelCatHook(eventName, payload = {}) {
  const detail = {
    eventName,
    source: TRAVEL_CAT_SOURCE,
    path: getTravelCatTelemetryPath(),
    sessionId: getTravelCatSessionId(),
    occurredAt: new Date().toISOString(),
    payload: clonePayload(payload),
  };

  window.dispatchEvent(new CustomEvent(TRAVEL_CAT_HOOK_EVENT, { detail }));

  return detail;
}

export function trackTravelCatEvent(eventName, payload = {}) {
  if (!TRAVEL_CAT_ALLOWED_TELEMETRY_EVENTS.has(eventName)) {
    return;
  }

  const detail = emitTravelCatHook(eventName, payload);

  if (shouldWriteConsoleLog()) {
    console.info('[LittleTravelCat]', detail.eventName, detail.payload);
  }

  sendTravelCatTelemetry({
    event_name: detail.eventName,
    source: detail.source,
    path: detail.path,
    session_id: detail.sessionId,
    app_version: TRAVEL_CAT_APP_VERSION,
    payload: detail.payload,
  });
}

function trackTravelCatError(errorPayload = {}) {
  trackTravelCatEvent('lab_error', {
    message:
      typeof errorPayload.message === 'string' ? errorPayload.message.slice(0, 180) : '',
    file: typeof errorPayload.file === 'string' ? errorPayload.file.slice(0, 160) : '',
    line: Number.isInteger(errorPayload.line) ? errorPayload.line : null,
    column: Number.isInteger(errorPayload.column) ? errorPayload.column : null,
  });
}

function installTravelCatHookApi() {
  if (window.littleTravelCatHooks) {
    return;
  }

  window.littleTravelCatHooks = {
    eventName: TRAVEL_CAT_HOOK_EVENT,
    on(handler) {
      window.addEventListener(TRAVEL_CAT_HOOK_EVENT, handler);
      return () => window.removeEventListener(TRAVEL_CAT_HOOK_EVENT, handler);
    },
    off(handler) {
      window.removeEventListener(TRAVEL_CAT_HOOK_EVENT, handler);
    },
  };
}

installTravelCatHookApi();

window.addEventListener('error', (event) => {
  trackTravelCatError({
    message: event.message,
    file: event.filename,
    line: event.lineno,
    column: event.colno,
  });
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const message =
    reason && typeof reason.message === 'string'
      ? reason.message
      : typeof reason === 'string'
        ? reason
        : 'unhandled_rejection';

  trackTravelCatError({ message });
});
