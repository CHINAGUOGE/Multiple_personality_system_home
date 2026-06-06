'use strict';

function saveGame() {
  if (isRaceLockedPhase(gameState.phase)) {
    addLog('比赛进行中不能保存，请等本场结束。');
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(createSaveData()));
    addLog('存档已保存到浏览器。');
    if (typeof openNoticeModal === 'function') {
      openNoticeModal('保存成功', '当前进度已保存到本地浏览器。');
    }
  } catch (error) {
    addLog('存档失败：浏览器拒绝写入 localStorage。');
  }
}

function loadGame() {
  if (isRaceLockedPhase(gameState.phase)) {
    addLog('比赛进行中不能读取，请等本场结束。');
    return;
  }

  let rawData = null;
  try {
    rawData = localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    addLog('读取失败：浏览器拒绝访问 localStorage。');
    return;
  }

  if (!rawData) {
    addLog('没有找到本地存档。');
    return;
  }

  let parsedData = null;
  try {
    parsedData = JSON.parse(rawData);
  } catch (error) {
    addLog('读取失败：存档数据格式损坏。');
    return;
  }

  const saveData = sanitizeSaveData(parsedData);
  if (!saveData) {
    addLog('读取失败：存档数据不完整。');
    return;
  }

  applyPersistentState(saveData);
  if (typeof checkAchievements === 'function') {
    checkAchievements({ source: 'loadMigration', silent: true });
  }
  refreshAfterPersistentChange();
  addLog('存档已读取，图鉴、档案、商店、状态栏和日志已刷新。');
}

function resetPersistentState() {
  gameState.cash = 1500;
  gameState.raceCount = 0;
  gameState.lastRank = '-';
  gameState.bestReactionTime = null;
  gameState.lastReactionTime = null;
  gameState.currentWinStreak = 0;
  gameState.bestWinStreak = 0;
  gameState.difficulty = DEFAULT_DIFFICULTY;
  gameState.greenAt = 0;
  gameState.reactionTime = null;
  gameState.playerStarted = false;
  gameState.panelReturnPhase = 'idle';
  gameState.atlasFilter = 'all';
  gameState.inventory = [];
  gameState.equippedParts = createEmptyEquippedParts();
  gameState.nextPartId = 1;
  gameState.stats = createDefaultStats();
  gameState.achievements = createDefaultAchievementsState();
  recalculatePlayerStats();
}

function performRestartGame() {
  clearRaceTimers();
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    addLog('本地存档清除失败，但当前进度会重置。');
  }

  resetPersistentState();
  el.logOutput.textContent = '';
  refreshAfterPersistentChange();
  addLog('游戏已重开。');
  addLog('先报名比赛，等绿灯后点“起步 / 踩油门”。');
}

function confirmRestartGame() {
  const message = '确定要删除当前存档并重新开始吗？此操作无法撤销。';

  if (typeof openNoticeModal === 'function') {
    openNoticeModal('确认清档', message, {
      showCancel: true,
      cancelText: '取消',
      confirmText: '确认删除并重开',
      onConfirm: performRestartGame,
    });
    return;
  }

  if (window.confirm(message)) {
    performRestartGame();
  }
}

function restartGame() {
  if (isRaceLockedPhase(gameState.phase)) {
    addLog('比赛进行中不能重开，请等本场结束。');
    return;
  }

  confirmRestartGame();
}

function clearRaceTimers() {
  gameState.countdownTimers.forEach((timer) => clearTimeout(timer));
  gameState.countdownTimers = [];

  if (gameState.raceTimer) {
    cancelAnimationFrame(gameState.raceTimer);
    gameState.raceTimer = null;
  }
  gameState.lastRaceTickAt = 0;
  gameState.raceAccumulator = 0;
}
