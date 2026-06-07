'use strict';

/*
 * GSafe 反作弊系统 v2.0.0
 *
 * Powered by Guoge
 * GitHub  : https://github.com/CHINAGUOGE
 * 主页    : https://me.51320721.xyz
 *
 * v2.0.0 变更：
 *   - 初犯制度：首次进入安全期仅 5 分钟
 *   - 反应检测：<30ms 高度异常、30~80ms 可疑、连续 3 次 <80ms 触发
 *   - 成就系统：增加累计判定次数阈值，避免误封
 *   - 存档版本校验：版本升级造成的存档问题不处罚
 *   - gsafeResetSession()：重开/刷新时重置安全期
 *   - IndexedDB evidence 存储
 *   - 下载本地数据 API
 *   - 违规记录持久化到存档和 cookie
 */

const GSafe = (() => {
  /* ═══ 字符串编码 ═══ */
  const _s = (arr) => arr.map((c) => String.fromCharCode(c)).join('');
  const TAG = _s([91, 71, 83, 97, 102, 101, 93]); // [GSafe]
  const COOKIE_KEY = _s([103, 115, 97, 102, 101, 95, 115, 97, 102, 101, 116, 121]); // gsafe_safety
  const FP_KEY = _s([103, 115, 102, 112]); // gsfp
  const REC_KEY = _s([103, 115, 97, 102, 101, 95, 114, 101, 99]); // gsafe_rec
  const VER = '2.0.2';
  const DB_NAME = 'gsafe_evidence';
  const DB_STORE = 'events';

  /* ═══ FNV-1a 32 位哈希 ═══ */
  function fnv1a(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    return h;
  }

  function sortedJSON(obj) {
    if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
    if (Array.isArray(obj)) return '[' + obj.map(sortedJSON).join(',') + ']';
    const keys = Object.keys(obj).sort();
    return '{' + keys.map((k) => JSON.stringify(k) + ':' + sortedJSON(obj[k])).join(',') + '}';
  }

  /* ═══ 暴露校验和函数 ═══ */
  globalThis.gsafeChecksum = function (data) {
    return fnv1a(sortedJSON(data));
  };

  globalThis.gsafeVerifyChecksum = function (data) {
    if (!data || typeof data._gsafeChecksum !== 'number') return false;
    const copy = {};
    for (const k in data) {
      if (k !== '_gsafeChecksum') copy[k] = data[k];
    }
    return fnv1a(sortedJSON(copy)) === data._gsafeChecksum;
  };

  /* ═══ 安全期状态 ═══ */
  let safetyActive = false;
  let safetyUntil = 0;
  let safetyCode = '';
  let softCount = 0;
  let isFirstOffense = true; // 初犯标记
  const violations = [];

  /* ═══ 证据收集 ═══ */
  const evidence = [];

  let lastFlagCode = '';
  let lastFlagTs = 0;

  function flag(code, detail, severity) {
    const now = Date.now();

    // 去重：同一违规码 10 秒内不重复记录
    if (code === lastFlagCode && now - lastFlagTs < 10000) {
      return;
    }
    lastFlagCode = code;
    lastFlagTs = now;

    const entry = { flag: code, ts: now, detail: detail || '', severity: severity || 'soft' };
    evidence.push(entry);
    violations.push(entry);
    writeEvidenceToDB(entry);
    console.warn(TAG + ' ' + code + ': ' + (detail || ''));

    // 已在安全期内且不是升级处罚，跳过重复处罚
    if (safetyActive && now < safetyUntil) {
      saveViolationRecords();
      return;
    }

    if (severity === 'hard_high') {
      enterSafety(code, 600);
    } else if (severity === 'hard') {
      enterSafety(code, 120);
    } else if (severity === 'hard_low') {
      enterSafety(code, 60);
    } else {
      softCount++;
      if (softCount >= 10) {
        enterSafety(code, 180);
      } else if (softCount >= 5) {
        enterSafety(code, 30);
      }
    }

    saveViolationRecords();
  }

  /* ═══ 生成安全期代码 ═══ */
  function genSafetyCode(reason) {
    const ts = Date.now().toString(36);
    const rh = fnv1a(reason + ts).toString(36).toUpperCase().slice(0, 6);
    return 'GS-' + ts.toUpperCase().slice(-4) + '-' + rh;
  }

  /* ═══ 进入安全期 ═══ */
  let overlayShown = false; // 弹窗去重

  function enterSafety(reason, baseMinutes) {
    const now = Date.now();

    // 已在安全期内且未到期，只延长不弹窗
    if (safetyActive && now < safetyUntil) {
      return;
    }

    // 初犯制度：首次仅 5 分钟
    let minutes;
    if (isFirstOffense) {
      minutes = 5;
      isFirstOffense = false;
    } else {
      minutes = Math.max(10, Math.min(600, baseMinutes));
    }

    const newUntil = now + minutes * 60 * 1000;

    safetyActive = true;
    safetyUntil = newUntil;
    safetyCode = genSafetyCode(reason);

    // 扣款 500-3000
    let deducted = 0;
    if (typeof gameState !== 'undefined' && gameState && typeof gameState.cash === 'number') {
      const maxDeduct = Math.min(3000, gameState.cash);
      deducted = Math.floor(500 + Math.random() * Math.max(0, maxDeduct - 500));
      deducted = Math.min(deducted, gameState.cash);
      gameState.cash -= deducted;
      try { if (typeof updateStats === 'function') updateStats(); } catch (_) {}
      try { if (typeof autoSaveGame === 'function') autoSaveGame(); } catch (_) {}
    }

    const fp = getFingerprint();
    const payload = JSON.stringify({
      v: 3,
      ts: now,
      until: safetyUntil,
      minutes: minutes,
      reason: reason,
      code: safetyCode,
      deducted: deducted,
      softCount: softCount,
      isFirstOffense: !isFirstOffense, // 已经翻转过了
      fp: fp,
    });
    setCookie(COOKIE_KEY, payload, 31536000);
    try { sessionStorage.setItem(FP_KEY, fp); } catch (_) {}

    if (typeof gameState !== 'undefined' && gameState) {
      gameState._gsafeSafety = true;
      gameState._gsafeSafetyUntil = safetyUntil;
    }

    showSafetyOverlay(reason, minutes, safetyCode, deducted);
    console.error(TAG + ' Safety: ' + minutes + 'min | Code: ' + safetyCode + ' | -' + deducted);

    patchCashLock();
  }

  /* ═══ 暂停资金获取 ═══ */
  let cashLocked = false;
  let lockedCashValue = 0;

  function patchCashLock() {
    if (cashLocked || typeof gameState === 'undefined' || !gameState) return;
    cashLocked = true;
    lockedCashValue = gameState.cash;

    const lockInterval = setInterval(() => {
      if (!safetyActive || Date.now() > safetyUntil) {
        cashLocked = false;
        clearInterval(lockInterval);
        return;
      }
      if (gameState.cash > lockedCashValue) {
        gameState.cash = lockedCashValue;
      }
      if (gameState.cash < lockedCashValue) {
        lockedCashValue = gameState.cash;
      }
    }, 500);
  }

  /* ═══ 安全期查询 API ═══ */
  globalThis.gsafeInSafety = function () {
    if (!safetyActive) return false;
    if (Date.now() > safetyUntil) {
      safetyActive = false;
      if (typeof gameState !== 'undefined' && gameState) {
        gameState._gsafeSafety = false;
      }
      return false;
    }
    return true;
  };

  globalThis.gsafeGetSafetyInfo = function () {
    if (!safetyActive || Date.now() > safetyUntil) return null;
    return {
      active: true,
      until: safetyUntil,
      remaining: Math.ceil((safetyUntil - Date.now()) / 60000),
      code: safetyCode,
      softCount: softCount,
    };
  };

  /* ═══ 重开/刷新时重置安全期 ═══ */
  globalThis.gsafeResetSession = function () {
    safetyActive = false;
    safetyUntil = 0;
    safetyCode = '';
    cashLocked = false;
    isFirstOffense = true;
    // 清除安全期 cookie（保留违规记录 cookie）
    setCookie(COOKIE_KEY, '', 0);
    if (typeof gameState !== 'undefined' && gameState) {
      gameState._gsafeSafety = false;
      gameState._gsafeSafetyUntil = 0;
    }
    // 移除遮罩
    const overlay = document.getElementById('gsafe-overlay');
    if (overlay) overlay.remove();
    const css = document.getElementById('gsafe-css');
    if (css) css.remove();
    console.log(TAG + ' Session reset.');
  };

  /* ═══ IndexedDB evidence 写入 ═══ */
  let dbInstance = null;

  function openEvidenceDB() {
    return new Promise((resolve, reject) => {
      if (dbInstance) { resolve(dbInstance); return; }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function (e) {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(DB_STORE)) {
          db.createObjectStore(DB_STORE, { keyPath: 'id', autoIncrement: true });
        }
      };
      req.onsuccess = function (e) {
        dbInstance = e.target.result;
        resolve(dbInstance);
      };
      req.onerror = function () { reject(req.error); };
    });
  }

  function writeEvidenceToDB(entry) {
    openEvidenceDB().then((db) => {
      try {
        const tx = db.transaction(DB_STORE, 'readwrite');
        tx.objectStore(DB_STORE).add(Object.assign({}, entry, { id: undefined }));
      } catch (_) {}
    }).catch(() => {});
  }

  function readAllEvidence() {
    return new Promise((resolve, reject) => {
      openEvidenceDB().then((db) => {
        const tx = db.transaction(DB_STORE, 'readonly');
        const req = tx.objectStore(DB_STORE).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      }).catch(() => resolve([]));
    });
  }

  /* ═══ 下载本地数据 API ═══ */
  globalThis.gsafeExportData = async function () {
    const dbEvidence = await readAllEvidence();
    const data = {
      exportedAt: new Date().toISOString(),
      gsafeVersion: VER,
      localStorage: {},
      currentSave: null,
      safetyState: {
        active: safetyActive,
        until: safetyUntil,
        code: safetyCode,
        softCount: softCount,
        isFirstOffense: isFirstOffense,
      },
      violations: violations,
      evidence: dbEvidence,
    };

    // 读取 localStorage
    try {
      const keys = [STORAGE_KEY, 'mpsteam-race-local-logs-v1', 'raceAudioEnabled'];
      keys.forEach((k) => {
        const v = localStorage.getItem(k);
        if (v !== null) data.localStorage[k] = v;
      });
    } catch (_) {}

    // 当前存档
    try {
      if (typeof createSaveData === 'function') {
        data.currentSave = createSaveData();
      }
    } catch (_) {}

    return data;
  };

  globalThis.gsafeDownloadData = async function () {
    const data = await globalThis.gsafeExportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gsafe-data-' + Date.now() + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log(TAG + ' Data exported.');
  };

  /* ═══ 浏览器指纹 ═══ */
  function getFingerprint() {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 50;
      const ctx = canvas.getContext('2d');
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('GSafe-fp', 2, 2);
      const ch = fnv1a(canvas.toDataURL());
      const ua = fnv1a(navigator.userAgent || '');
      const sc = fnv1a(screen.width + 'x' + screen.height);
      const lg = fnv1a(navigator.language || '');
      return ((ch ^ ua ^ sc ^ lg) >>> 0).toString(36);
    } catch (_) {
      return fnv1a(navigator.userAgent + screen.width).toString(36);
    }
  }

  /* ═══ Cookie 读写 ═══ */
  function setCookie(name, value, maxAge) {
    document.cookie = name + '=' + encodeURIComponent(value) + ';path=/;max-age=' + maxAge + ';SameSite=Strict';
  }

  function getCookie(name) {
    const m = document.cookie.match(new RegExp('(?:^|;\\s*)' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  }

  /* ═══ 违规记录持久化 ═══ */
  function saveViolationRecords() {
    try {
      const data = JSON.stringify({
        v: 1,
        ts: Date.now(),
        softCount: softCount,
        isFirstOffense: isFirstOffense,
        violations: violations.slice(-50),
      });
      setCookie(REC_KEY, data, 31536000);
    } catch (_) {}
    if (typeof gameState !== 'undefined' && gameState) {
      gameState._gsafeViolations = violations.slice(-50);
      gameState._gsafeSoftCount = softCount;
    }
  }

  function loadViolationRecords() {
    try {
      const raw = getCookie(REC_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data && Array.isArray(data.violations)) {
          data.violations.forEach((v) => violations.push(v));
          softCount = data.softCount || 0;
          if (typeof data.isFirstOffense === 'boolean') isFirstOffense = data.isFirstOffense;
        }
      }
    } catch (_) {}
    if (typeof gameState !== 'undefined' && gameState && Array.isArray(gameState._gsafeViolations)) {
      gameState._gsafeViolations.forEach((v) => {
        if (!violations.find((x) => x.ts === v.ts && x.flag === v.flag)) {
          violations.push(v);
        }
      });
      if (typeof gameState._gsafeSoftCount === 'number') {
        softCount = Math.max(softCount, gameState._gsafeSoftCount);
      }
    }
  }

  /* ═══ 检查已有安全期 ═══ */
  function checkExistingSafety() {
    const raw = getCookie(COOKIE_KEY);
    if (raw) {
      try {
        const data = JSON.parse(raw);
        if (data && data.until && Date.now() < data.until) {
          safetyActive = true;
          safetyUntil = data.until;
          safetyCode = data.code || genSafetyCode(data.reason || '');
          softCount = data.softCount || 0;
          if (typeof data.isFirstOffense === 'boolean') isFirstOffense = data.isFirstOffense;
          if (typeof gameState !== 'undefined' && gameState) {
            gameState._gsafeSafety = true;
            gameState._gsafeSafetyUntil = safetyUntil;
          }
          patchCashLock();
          showSafetyOverlay(data.reason, data.minutes || 0, safetyCode, 0, true);
          return true;
        }
      } catch (_) {}
    }
    return false;
  }

  /* ═══ 安全期 UI ═══ */
  function formatTime(ts) {
    try { return new Date(ts).toLocaleTimeString('zh-CN', { hour12: false }); }
    catch (_) { return '--:--:--'; }
  }

  function showSafetyOverlay(reason, minutes, code, deducted, isResume) {
    if (document.getElementById('gsafe-overlay')) return;
    const now = Date.now();
    const remaining = safetyActive ? Math.ceil((safetyUntil - now) / 60000) : minutes;
    const startTime = formatTime(now);
    const endTime = formatTime(safetyActive ? safetyUntil : now + minutes * 60000);

    // 违规原因中文映射
    const reasonMap = {
      FN_OVERRIDE: '关键函数被替换',
      MATH_RANDOM_HOOK: 'Math.random 被篡改',
      PERFORMANCE_NOW_HOOK: 'performance.now 被篡改',
      DATE_NOW_HOOK: 'Date.now 被篡改',
      CASH_ANOMALY: '资金异常变动',
      CASH_FARMING: '疑似刷钱行为',
      RACE_COUNT_ANOMALY: '比赛场次异常',
      STATS_MISMATCH: '统计数据不匹配',
      STATS_ROLLBACK: '统计数据回滚',
      STAT_CEILING_BREACH: '车辆属性超出上限',
      STAT_CLAMP_BREACH: '车辆属性突破边界',
      ACHIEVEMENT_INJECTION: '成就异常解锁',
      ACHIEVEMENT_FARMING: '疑似刷成就',
      REACTION_INHUMAN: '反应时间异常 (<8ms)',
      REACTION_ULTRA_FAST: '反应时间持续异常 (8-10ms×10)',
      AUTO_START_DETECTED: '疑似自动发车脚本',
      EVAL_USAGE: '检测到代码注入',
      INVENTORY_ANOMALY: '库存异常变动',
      PHASE_INVALID: '游戏状态非法',
      PHASE_SKIP: '游戏状态跳转异常',
      SCRIPT_REMOVED: '安全脚本被移除',
    };
    const reasonText = reasonMap[reason] || reason || '未知';

    const css = document.createElement('style');
    css.id = 'gsafe-css';
    css.textContent =
      '#gsafe-overlay{position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,.88);display:flex;align-items:center;justify-content:center;font-family:"Segoe UI","Microsoft YaHei",sans-serif}' +
      '#gsafe-card{background:#fff;border:2px solid #808080;box-shadow:4px 4px 0 #000;max-width:440px;width:90%}' +
      '#gsafe-titlebar{background:#e65100;color:#fff;padding:5px 8px;font-size:12px;font-weight:700;display:flex;justify-content:space-between;align-items:center}' +
      '#gsafe-body{padding:16px;text-align:center}' +
      '#gsafe-body p{margin:0 0 8px;font-size:13px;color:#333;line-height:1.6}' +
      '#gsafe-body .gs-code{display:inline-block;margin:6px 0;padding:5px 14px;background:#fff3e0;border:1px solid #ffcc80;border-radius:4px;font-family:monospace;font-size:12px;color:#e65100;letter-spacing:1px;user-select:all}' +
      '#gsafe-body .gs-info{font-size:11px;color:#777;margin-top:3px;line-height:1.5}' +
      '#gsafe-body .gs-time{font-size:18px;font-weight:700;color:#e65100;margin:8px 0}' +
      '#gsafe-body .gs-timeline{margin:10px 0;padding:8px 12px;background:#f5f5f5;border-radius:6px;text-align:left}' +
      '#gsafe-body .gs-timeline div{font-size:12px;color:#555;line-height:1.8}' +
      '#gsafe-body .gs-timeline span{font-weight:600;color:#333}' +
      '#gsafe-body .gs-reason-tag{display:inline-block;margin:6px 0;padding:3px 10px;background:#ffebee;border:1px solid #ef9a9a;border-radius:12px;font-size:12px;color:#c62828}' +
      '#gsafe-actions{padding:8px 16px 16px;text-align:center;display:flex;gap:8px;justify-content:center}' +
      '#gsafe-actions button{background:#d4d0c8;border:2px outset #fff;padding:4px 18px;font-size:12px;cursor:pointer;font-family:inherit}' +
      '#gsafe-actions button:active{border-style:inset}';
    document.head.appendChild(css);

    const overlay = document.createElement('div');
    overlay.id = 'gsafe-overlay';
    overlay.innerHTML =
      '<div id="gsafe-card">' +
        '<div id="gsafe-titlebar"><span>GSafe v' + VER + ' - 安全期通知</span><span>&#10006;</span></div>' +
        '<div id="gsafe-body">' +
          '<p>' + (isResume ? '你仍在安全期内，如有问题请申诉。' : '检测到异常操作，已进入安全期。') + '</p>' +
          '<div class="gs-reason-tag">' + reasonText + '</div>' +
          '<div class="gs-time">' + remaining + ' 分钟</div>' +
          '<div class="gs-code">' + (code || 'N/A') + '</div>' +
          '<div class="gs-timeline">' +
            '<div>开始时间：<span>' + startTime + '</span></div>' +
            '<div>结束时间：<span>' + endTime + '</span></div>' +
          '</div>' +
          '<div class="gs-info">安全期内成绩不计入 · 资金获取暂停</div>' +
          (deducted > 0 ? '<div class="gs-info">已扣除 ' + deducted + ' 元</div>' : '') +
        '</div>' +
        '<div id="gsafe-actions">' +
          '<button id="gsafe-ok">确定</button>' +
          '<button id="gsafe-dl">下载数据</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    document.getElementById('gsafe-ok').addEventListener('click', function () {
      overlay.remove();
      css.remove();
    });
    document.getElementById('gsafe-dl').addEventListener('click', function () {
      if (typeof globalThis.gsafeDownloadData === 'function') globalThis.gsafeDownloadData();
    });
  }

  /* ═══ 1. 函数完整性检查 ═══ */
  const fnSigs = {};
  const fnWatch = [];

  function captureFn(obj, key, path) {
    try {
      const fn = obj ? obj[key] : undefined;
      if (typeof fn === 'function') {
        fnSigs[path] = Function.prototype.toString.call(fn);
        fnWatch.push({ obj: obj, key: key, path: path });
      }
    } catch (_) {}
  }

  function initFnChecks() {
    captureFn(globalThis, 'pressStart', 'pressStart');
    captureFn(globalThis, 'onGreenLight', 'onGreenLight');
    captureFn(globalThis, 'completeRace', 'completeRace');
    captureFn(globalThis, 'startPlayerCar', 'startPlayerCar');
    captureFn(globalThis, 'setPhase', 'setPhase');
    captureFn(globalThis, 'recalculatePlayerStats', 'recalculatePlayerStats');
    captureFn(globalThis, 'sanitizeSaveData', 'sanitizeSaveData');
    captureFn(globalThis, 'createSaveData', 'createSaveData');
    captureFn(globalThis, 'autoSaveGame', 'autoSaveGame');
    captureFn(globalThis, 'saveGame', 'saveGame');
    captureFn(globalThis, 'loadGame', 'loadGame');
    captureFn(globalThis, 'checkAchievements', 'checkAchievements');
    captureFn(globalThis, 'unlockAchievementById', 'unlockAchievementById');
    captureFn(globalThis, 'rollOpponentReactionTime', 'rollOpponentReactionTime');
    captureFn(globalThis, 'handleFalseStart', 'handleFalseStart');
    captureFn(globalThis, 'registerRace', 'registerRace');
    captureFn(globalThis, 'startRaceMotion', 'startRaceMotion');
    captureFn(globalThis, 'tickRace', 'tickRace');
    captureFn(globalThis, 'buyPart', 'buyPart');
    captureFn(globalThis, 'changeEquipment', 'changeEquipment');
    captureFn(globalThis, 'refreshShop', 'refreshShop');
    captureFn(globalThis, 'setDifficulty', 'setDifficulty');
    captureFn(globalThis, 'applyPersistentState', 'applyPersistentState');
    captureFn(globalThis, 'resetPersistentState', 'resetPersistentState');

    if (typeof RaceFormulaUtils === 'object' && RaceFormulaUtils) {
      captureFn(RaceFormulaUtils, 'computePlayerPower', 'RFU.computePlayerPower');
      captureFn(RaceFormulaUtils, 'computeOpponentStrength', 'RFU.computeOpponentStrength');
      captureFn(RaceFormulaUtils, 'computeReactionOutcome', 'RFU.computeReactionOutcome');
      captureFn(RaceFormulaUtils, 'computeOpponentCarPower', 'RFU.computeOpponentCarPower');
      captureFn(RaceFormulaUtils, 'computePlayerRating', 'RFU.computePlayerRating');
    }

    fnSigs['Math.random'] = Function.prototype.toString.call(Math.random);
    fnSigs['performance.now'] = Function.prototype.toString.call(performance.now);
    fnSigs['Date.now'] = Function.prototype.toString.call(Date.now);
  }

  function checkFnIntegrity() {
    for (let i = 0; i < fnWatch.length; i++) {
      const w = fnWatch[i];
      try {
        const current = Function.prototype.toString.call(w.obj[w.key]);
        if (current !== fnSigs[w.path]) {
          flag('FN_OVERRIDE', w.path + ' replaced', 'hard_high');
          return;
        }
      } catch (_) {}
    }
    try {
      if (Function.prototype.toString.call(Math.random) !== fnSigs['Math.random']) {
        flag('MATH_RANDOM_HOOK', 'Math.random replaced', 'hard_high');
      }
    } catch (_) {}
    try {
      if (Function.prototype.toString.call(performance.now) !== fnSigs['performance.now']) {
        flag('PERFORMANCE_NOW_HOOK', 'performance.now replaced', 'hard');
      }
    } catch (_) {}
    try {
      if (Function.prototype.toString.call(Date.now) !== fnSigs['Date.now']) {
        flag('DATE_NOW_HOOK', 'Date.now replaced', 'hard');
      }
    } catch (_) {}
  }

  /* ═══ 2. 状态快照差分 ═══ */
  let prevSnap = null;
  let cashHistory = [];
  let achvCheckCount = 0; // 成就累计判定次数

  let statCeilings = {};
  function computeCeilings() {
    if (typeof BASE_PLAYER_STATS !== 'object' || typeof PART_POOL === 'undefined' || typeof EQUIPMENT_SLOTS === 'undefined') {
      statCeilings = { engine: 500, tire: 500, gearbox: 500, stability: 80, weight: 760, hp: 500 };
      return;
    }
    const base = Object.assign({}, BASE_PLAYER_STATS);
    const maxBySlot = {};
    EQUIPMENT_SLOTS.forEach(function (slot) {
      maxBySlot[slot] = {};
      PART_POOL.forEach(function (part) {
        if (part.type !== slot) return;
        Object.keys(part.changes || {}).forEach(function (k) {
          const v = part.changes[k];
          if (typeof maxBySlot[slot][k] === 'undefined' || v > maxBySlot[slot][k]) {
            maxBySlot[slot][k] = v;
          }
        });
      });
    });
    const ce = Object.assign({}, base);
    EQUIPMENT_SLOTS.forEach(function (slot) {
      Object.keys(maxBySlot[slot] || {}).forEach(function (k) {
        ce[k] = (ce[k] || 0) + maxBySlot[slot][k];
      });
    });
    ce.stability = Math.min(ce.stability, 80);
    ce.weight = Math.max(ce.weight, 760);
    Object.keys(ce).forEach(function (k) {
      ce[k] = Math.ceil(ce[k] * 1.1);
    });
    statCeilings = ce;
  }

  function takeSnap() {
    if (typeof gameState === 'undefined' || !gameState) return null;
    try {
      const p = gameState.player || {};
      return {
        cash: gameState.cash,
        raceCount: gameState.raceCount,
        winStreak: gameState.currentWinStreak,
        phase: gameState.phase,
        achvCount: Object.keys(gameState.achievements && gameState.achievements.completed || {}).length,
        invLen: (gameState.inventory || []).length,
        engine: p.engine,
        tire: p.tire,
        gearbox: p.gearbox,
        stability: p.stability,
        weight: p.weight,
        hp: p.hp,
        equipped: JSON.stringify(gameState.equippedParts || {}),
        statsTotalWins: (gameState.stats || {}).totalWins || 0,
        statsTotalRaces: (gameState.stats || {}).totalRaces || 0,
      };
    } catch (_) {
      return null;
    }
  }

  /* ═══ 存档版本校验 ═══ */
  let lastSaveVersion = null;

  function checkSaveVersion() {
    if (typeof gameState === 'undefined' || !gameState) return;
    try {
      const raw = localStorage.getItem(typeof STORAGE_KEY !== 'undefined' ? STORAGE_KEY : 'mpsteam-race-save-v1');
      if (!raw) return;
      const data = JSON.parse(raw);
      const savedVer = data && data._saveVersion;
      const currentVer = typeof GAME_VERSION !== 'undefined' ? GAME_VERSION : null;
      if (!currentVer) return;

      if (savedVer && savedVer !== currentVer) {
        // 版本升级：不处罚，记录
        console.log(TAG + ' Save version changed: ' + savedVer + ' -> ' + currentVer + ' (no penalty)');
        lastSaveVersion = currentVer;
      } else if (!savedVer && lastSaveVersion === null) {
        // 旧存档无版本号：首次加载不处罚
        lastSaveVersion = currentVer;
      }
      // 版本一致或无版本号：正常
    } catch (_) {}
  }

  function diffSnap(cur) {
    if (!prevSnap || !cur) return;
    const p = prevSnap;

    // ─── 刷钱检测 ───
    const cashDelta = cur.cash - p.cash;
    if (cashDelta > 3000 && p.phase !== 'finished') {
      flag('CASH_ANOMALY', 'cash ' + p.cash + ' -> ' + cur.cash, 'soft');
    }
    cashHistory.push({ ts: Date.now(), cash: cur.cash });
    if (cashHistory.length > 10) cashHistory.shift();
    if (cashHistory.length >= 3) {
      let abnormalCount = 0;
      for (let i = 1; i < cashHistory.length; i++) {
        const d = cashHistory[i].cash - cashHistory[i - 1].cash;
        if (d > 3000) abnormalCount++;
      }
      if (abnormalCount >= 2) {
        flag('CASH_FARMING', abnormalCount + ' abnormal cash jumps', 'soft');
        cashHistory = [];
      }
    }

    // ─── 场次篡改 ───
    if (cur.raceCount < p.raceCount) {
      flag('RACE_COUNT_ANOMALY', 'raceCount ' + p.raceCount + ' -> ' + cur.raceCount, 'hard_low');
    }
    if (cur.raceCount - p.raceCount > 1 && p.phase === 'idle') {
      flag('RACE_COUNT_ANOMALY', 'raceCount jumped ' + p.raceCount + ' -> ' + cur.raceCount, 'soft');
    }

    // ─── 统计篡改 ───
    if (cur.statsTotalWins > cur.statsTotalRaces) {
      flag('STATS_MISMATCH', 'wins(' + cur.statsTotalWins + ') > races(' + cur.statsTotalRaces + ')', 'hard_low');
    }
    if (cur.statsTotalRaces < p.statsTotalRaces) {
      flag('STATS_ROLLBACK', 'totalRaces ' + p.statsTotalRaces + ' -> ' + cur.statsTotalRaces, 'hard_low');
    }

    // ─── 属性突破上限 ───
    ['engine', 'tire', 'gearbox', 'hp'].forEach(function (k) {
      if (statCeilings[k] && cur[k] > statCeilings[k]) {
        flag('STAT_CEILING_BREACH', k + '=' + cur[k] + ' > max ' + statCeilings[k], 'hard');
      }
    });
    if (cur.stability > 80) flag('STAT_CLAMP_BREACH', 'stability=' + cur.stability + ' > 80', 'hard');
    if (cur.weight < 760) flag('STAT_CLAMP_BREACH', 'weight=' + cur.weight + ' < 760', 'hard');

    // ─── 成就检测（累计判定，避免误封） ───
    achvCheckCount++;
    const achvDelta = cur.achvCount - p.achvCount;
    if (achvDelta > 3) {
      // 只有累计判定次数 >= 3 才触发，避免正常游玩误判
      if (achvCheckCount >= 3) {
        flag('ACHIEVEMENT_INJECTION', achvDelta + ' achievements at once (check #' + achvCheckCount + ')', 'soft');
        achvCheckCount = 0;
      }
    } else if (achvDelta > 0) {
      // 正常范围内的成就解锁，重置累计
      achvCheckCount = Math.max(0, achvCheckCount - 1);
    }

    // ─── 库存异常 ───
    if (cur.invLen - p.invLen > 3 && p.phase !== 'idle') {
      flag('INVENTORY_ANOMALY', 'inventory +' + (cur.invLen - p.invLen) + ' outside shop', 'soft');
    }

    // ─── 阶段非法值 ───
    if (typeof PHASE_LABELS !== 'undefined' && cur.phase && !PHASE_LABELS[cur.phase] && cur.phase !== 'gsafe_safety') {
      flag('PHASE_INVALID', 'phase=' + cur.phase, 'hard');
    }

    checkPhaseTransition(p.phase, cur.phase);
  }

  const VALID_TRANSITIONS = {
    idle: ['countdown_red', 'game_over'],
    countdown_red: ['countdown_yellow', 'false_start'],
    countdown_yellow: ['countdown_green', 'false_start'],
    countdown_green: ['racing', 'false_start'],
    racing: ['finished'],
    finished: ['idle'],
    false_start: ['idle'],
    game_over: ['idle'],
  };

  function checkPhaseTransition(from, to) {
    if (!from || !to || from === to) return;
    const valid = VALID_TRANSITIONS[from];
    if (valid && valid.indexOf(to) === -1) {
      flag('PHASE_SKIP', from + ' -> ' + to, 'hard');
    }
  }

  /* ═══ 3. 反应时间校验 ═══ */
  // 0.020s~0.010s：不触发
  // 0.010s~0.008s：累计 10 次触发
  // <0.008s：直接触发
  let prevReactionCheck = { time: null, control: null };
  let ultraFastCount = 0; // 0.008~0.010 累计

  function checkReaction() {
    if (typeof gameState === 'undefined') return;
    const t = gameState.lastReactionTime;
    const c = gameState.lastReactionControl;
    if (t === null || t === prevReactionCheck.time || c !== 'manual') {
      prevReactionCheck = { time: t, control: c };
      return;
    }
    prevReactionCheck = { time: t, control: c };

    if (t < 0.008) {
      // <8ms：直接触发
      flag('REACTION_INHUMAN', 'reaction=' + t.toFixed(3) + 's (<8ms)', 'soft');
    } else if (t < 0.010) {
      // 8~10ms：累计 10 次触发
      ultraFastCount++;
      if (ultraFastCount >= 10) {
        flag('REACTION_ULTRA_FAST', ultraFastCount + ' reactions 8-10ms', 'soft');
        ultraFastCount = 0;
      }
    }
    // 10~20ms：不触发，不累计
  }

  /* ═══ 4. 脚本自保护 ═══ */
  let selfScript = null;

  function initSelfProtect() {
    try { selfScript = document.currentScript; } catch (_) {}
  }

  function checkSelfIntegrity() {
    if (!selfScript) return;
    try {
      if (!document.contains(selfScript)) {
        flag('SCRIPT_REMOVED', 'gsafe.js removed', 'hard_high');
      }
    } catch (_) {}
  }

  /* ═══ 5. 自动发车检测 ═══ */
  let fastStartCount = 0;
  let lastGreenAt = 0;
  let lastPlayerStarted = false;

  function checkAutoStart() {
    if (typeof gameState === 'undefined') return;
    if (gameState.greenAt !== lastGreenAt && gameState.greenAt > 0) {
      lastGreenAt = gameState.greenAt;
      lastPlayerStarted = false;
    }
    if (gameState.playerStarted && !lastPlayerStarted && gameState.lastReactionControl === 'manual') {
      lastPlayerStarted = true;
      const t = gameState.lastReactionTime;
      if (t !== null && t < 0.080) {
        fastStartCount++;
        if (fastStartCount >= 3) {
          flag('AUTO_START_DETECTED', fastStartCount + ' sub-80ms starts', 'soft');
          fastStartCount = 0;
        }
      } else {
        fastStartCount = Math.max(0, fastStartCount - 1);
      }
    }
  }

  /* ═══ 6. 控制台注入检测 ═══ */
  let consoleUsageCount = 0;

  function initConsoleDetection() {
    try {
      const origEval = window.eval;
      window.eval = function () {
        consoleUsageCount++;
        if (consoleUsageCount > 5) {
          flag('EVAL_USAGE', 'eval() called ' + consoleUsageCount + ' times', 'soft');
        }
        return origEval.apply(this, arguments);
      };
    } catch (_) {}
  }

  /* ═══ 安全期内成绩无效化 ═══ */
  function patchRaceCompletion() {
    if (typeof window.completeRace !== 'function') return;
    const orig = window.completeRace;
    window.completeRace = function () {
      const wasInSafety = gsafeInSafety();
      orig.call(this);
      if (wasInSafety && typeof gameState !== 'undefined' && gameState) {
        gameState.currentWinStreak = 0;
      }
    };
  }

  /* ═══ 主循环 ═══ */
  function jitter(ms) {
    return Math.floor(ms * (0.7 + Math.random() * 0.6));
  }

  function startMonitoring() {
    function loopFnCheck() {
      checkFnIntegrity();
      checkSelfIntegrity();
      setTimeout(loopFnCheck, jitter(5000));
    }
    setTimeout(loopFnCheck, jitter(3000));

    function loopSnap() {
      if (safetyActive && Date.now() > safetyUntil) {
        safetyActive = false;
        if (typeof gameState !== 'undefined' && gameState) {
          gameState._gsafeSafety = false;
        }
        cashLocked = false;
        console.log(TAG + ' Safety period expired.');
      }

      checkSaveVersion();
      const cur = takeSnap();
      diffSnap(cur);
      prevSnap = cur;
      checkReaction();
      checkAutoStart();
      setTimeout(loopSnap, jitter(3000));
    }
    setTimeout(loopSnap, jitter(2000));
  }

  /* ═══ 初始化 ═══ */
  function init() {
    loadViolationRecords();
    openEvidenceDB().catch(() => {});

    if (checkExistingSafety()) {
      console.log(TAG + ' Resumed safety. Remaining: ' + Math.ceil((safetyUntil - Date.now()) / 60000) + 'min');
    }

    initSelfProtect();
    computeCeilings();
    initFnChecks();
    initConsoleDetection();
    patchRaceCompletion();
    checkSaveVersion();
    prevSnap = takeSnap();
    startMonitoring();

    try { sessionStorage.setItem('_gs', '1'); } catch (_) {}
    console.log(TAG + ' Anti-cheat v' + VER + ' initialized. Violations: ' + violations.length);
  }

  return {
    init: init,
    inSafety: globalThis.gsafeInSafety,
    getSafetyInfo: globalThis.gsafeGetSafetyInfo,
    resetSession: globalThis.gsafeResetSession,
    exportData: globalThis.gsafeExportData,
    downloadData: globalThis.gsafeDownloadData,
    getViolations: function () { return violations.slice(); },
    version: VER,
  };
})();

GSafe.init();
