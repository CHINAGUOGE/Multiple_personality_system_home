'use strict';

const RACE_LOG_ENDPOINT = '/api/log';
const RACE_SESSION_STORAGE_KEY = 'mpsteam-race-session-id-v1';
const RACE_SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const RACE_ALLOWED_TELEMETRY_EVENTS = new Set(['lab_race_finish', 'lab_error']);

function createRaceSessionId() {
  const bytes = new Uint8Array(16);

  if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
    window.crypto.getRandomValues(bytes);
    const token = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `race_${token}`;
  }

  return `race_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

function getRaceSessionId() {
  const now = Date.now();

  try {
    const storedSession = JSON.parse(
      window.localStorage.getItem(RACE_SESSION_STORAGE_KEY) || 'null'
    );

    if (
      storedSession &&
      typeof storedSession.id === 'string' &&
      Number.isFinite(storedSession.createdAt) &&
      now - storedSession.createdAt < RACE_SESSION_MAX_AGE_MS
    ) {
      return storedSession.id;
    }

    const nextSessionId = createRaceSessionId();
    window.localStorage.setItem(
      RACE_SESSION_STORAGE_KEY,
      JSON.stringify({ id: nextSessionId, createdAt: now })
    );
    return nextSessionId;
  } catch {
    return createRaceSessionId();
  }
}

function getRaceTelemetryPath() {
  const path = window.location.pathname;

  if (path.endsWith('/race/index.html')) {
    return path.replace(/index\.html$/, '');
  }

  return path || '/race/';
}

function sendRaceTelemetry(body) {
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

    if (navigator.sendBeacon(RACE_LOG_ENDPOINT, blob)) {
      return;
    }
  }

  if (typeof fetch === 'function') {
    fetch(RACE_LOG_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: serializedBody,
      keepalive: true,
    }).catch(() => {});
  }
}

function trackRaceEvent(eventName, payload = {}) {
  if (!RACE_ALLOWED_TELEMETRY_EVENTS.has(eventName)) {
    return;
  }

  sendRaceTelemetry({
    event_name: eventName,
    source: 'race',
    path: getRaceTelemetryPath(),
    session_id: getRaceSessionId(),
    app_version: typeof GAME_VERSION === 'string' ? GAME_VERSION : null,
    payload,
  });
}

function trackRaceError(errorPayload = {}) {
  trackRaceEvent('lab_error', {
    message: typeof errorPayload.message === 'string' ? errorPayload.message.slice(0, 180) : '',
    file: typeof errorPayload.file === 'string' ? errorPayload.file.slice(0, 160) : '',
    line: Number.isInteger(errorPayload.line) ? errorPayload.line : null,
    column: Number.isInteger(errorPayload.column) ? errorPayload.column : null,
  });
}

window.addEventListener('error', (event) => {
  trackRaceError({
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

  trackRaceError({ message });
});
