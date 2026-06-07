type D1PreparedStatement = {
  bind: (...values: unknown[]) => D1PreparedStatement;
  run: () => Promise<unknown>;
};

type D1DatabaseBinding = {
  prepare: (query: string) => D1PreparedStatement;
};

type LogFunctionContext = {
  request: Request;
  env: {
    DB?: D1DatabaseBinding;
  };
};

type JsonObject = Record<string, unknown>;

const ALLOWED_EVENTS = new Set(['lab_race_finish', 'lab_error']);
const ALLOWED_DIFFICULTIES = new Set(['easy', 'normal', 'hard', 'expert', 'nightmare']);
const MAX_BODY_BYTES = 4096;
const MAX_PAYLOAD_BYTES = 2048;
const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
};

const textEncoder = new TextEncoder();

function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: JSON_HEADERS,
  });
}

function byteLength(value: string) {
  return textEncoder.encode(value).length;
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cleanString(value: unknown, maxLength: number) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, maxLength);
}

function cleanSessionId(value: unknown) {
  const sessionId = cleanString(value, 80);

  if (!sessionId || !/^[A-Za-z0-9_-]{8,80}$/.test(sessionId)) {
    return null;
  }

  return sessionId;
}

function cleanInteger(value: unknown, min: number, max: number) {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return null;
  }

  if (value < min || value > max) {
    return null;
  }

  return value;
}

function cleanFiniteNumber(value: unknown, min: number, max: number, digits = 3) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  if (value < min || value > max) {
    return null;
  }

  return Number(value.toFixed(digits));
}

function cleanBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : null;
}

function cleanRaceFinishPayload(payload: unknown) {
  if (!isJsonObject(payload)) {
    return null;
  }

  const difficulty = cleanString(payload.difficulty, 20);
  const rank = cleanInteger(payload.rank, 1, 5);
  const raceCount = cleanInteger(payload.raceCount, 0, 1000000);
  const isPractice = cleanBoolean(payload.isPractice);
  const isAiAssist = cleanBoolean(payload.isAiAssist);
  const money = cleanInteger(payload.money, -1000000, 100000000);
  const winStreak = cleanInteger(payload.winStreak, 0, 1000000);
  const version = cleanString(payload.version, 32);

  if (
    !difficulty ||
    !ALLOWED_DIFFICULTIES.has(difficulty) ||
    rank === null ||
    raceCount === null ||
    isPractice === null ||
    isAiAssist === null ||
    money === null ||
    winStreak === null ||
    !version
  ) {
    return null;
  }

  return {
    difficulty,
    rank,
    reactionTime: cleanFiniteNumber(payload.reactionTime, 0, 10),
    opponentReactionTime: cleanFiniteNumber(payload.opponentReactionTime, 0, 10),
    raceCount,
    isPractice,
    isAiAssist,
    money,
    winStreak,
    version,
  };
}

function cleanErrorPayload(payload: unknown) {
  if (!isJsonObject(payload)) {
    return null;
  }

  return {
    message: cleanString(payload.message, 180) || 'unknown_error',
    file: cleanString(payload.file, 160),
    line: cleanInteger(payload.line, 0, 1000000),
    column: cleanInteger(payload.column, 0, 1000000),
  };
}

function cleanPayload(eventName: string, payload: unknown) {
  if (eventName === 'lab_race_finish') {
    return cleanRaceFinishPayload(payload);
  }

  if (eventName === 'lab_error') {
    return cleanErrorPayload(payload);
  }

  return null;
}

export async function onRequest(context: LogFunctionContext) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: { allow: 'POST, OPTIONS' },
    });
  }

  if (request.method !== 'POST') {
    return new Response(null, {
      status: 405,
      headers: { allow: 'POST' },
    });
  }

  if (!env.DB) {
    return jsonError(500, 'D1 binding DB is not configured');
  }

  const bodyText = await request.text();
  if (byteLength(bodyText) > MAX_BODY_BYTES) {
    return jsonError(413, 'Request body is too large');
  }

  let body: unknown;
  try {
    body = JSON.parse(bodyText);
  } catch {
    return jsonError(400, 'Invalid JSON body');
  }

  if (!isJsonObject(body)) {
    return jsonError(400, 'Invalid log body');
  }

  const eventName = cleanString(body.event_name, 80);
  const source = cleanString(body.source, 40);
  const path = cleanString(body.path, 160);
  const sessionId = cleanSessionId(body.session_id);

  if (!eventName || !ALLOWED_EVENTS.has(eventName)) {
    return jsonError(400, 'Unsupported event_name');
  }

  if (source !== 'race') {
    return jsonError(400, 'Unsupported source');
  }

  if (!sessionId) {
    return jsonError(400, 'Invalid session_id');
  }

  const payload = cleanPayload(eventName, body.payload);
  if (!payload) {
    return jsonError(400, 'Invalid payload');
  }

  const payloadJson = JSON.stringify(payload);
  if (byteLength(payloadJson) > MAX_PAYLOAD_BYTES) {
    return jsonError(413, 'Payload is too large');
  }

  const appVersion =
    cleanString(body.app_version, 32) ||
    (isJsonObject(payload) ? cleanString((payload as JsonObject).version, 32) : null);

  await env.DB.prepare(
    `INSERT INTO user_logs (event_name, source, path, session_id, app_version, payload)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(eventName, source, path, sessionId, appVersion, payloadJson)
    .run();

  return new Response(null, { status: 204 });
}
