'use strict';

function shouldIgnoreRaceShortcut(event) {
  const target = event.target;
  const tagName = target && target.tagName ? target.tagName.toLowerCase() : '';

  return (
    event.repeat ||
    ['input', 'textarea', 'select', 'button'].includes(tagName) ||
    (target && target.isContentEditable) ||
    (el.difficultyModal && !el.difficultyModal.hidden)
  );
}

function blurAfterPointerClick(event, node = event.currentTarget) {
  if (event.detail > 0 && node && typeof node.blur === 'function') {
    node.blur();
  }
}

function bindEvents() {
  el.registerBtn.addEventListener('click', (event) => {
    registerRace();
    blurAfterPointerClick(event);
  });
  el.startBtn.addEventListener('click', (event) => {
    pressStart();
    blurAfterPointerClick(event);
  });
  el.nextBtn.addEventListener('click', (event) => {
    nextRace();
    blurAfterPointerClick(event);
  });
  el.saveBtn.addEventListener('click', (event) => {
    saveGame();
    blurAfterPointerClick(event);
  });
  el.loadBtn.addEventListener('click', (event) => {
    loadGame();
    blurAfterPointerClick(event);
  });
  el.restartBtn.addEventListener('click', (event) => {
    restartGame();
    blurAfterPointerClick(event);
  });
  el.tabs.forEach((tab) => {
    tab.addEventListener('click', (event) => {
      setActivePage(tab.dataset.page);
      blurAfterPointerClick(event, tab);
    });
  });

  el.difficultyOpenButtons.forEach((button) => {
    button.addEventListener('click', (event) => {
      openDifficultyModal();
      blurAfterPointerClick(event);
    });
  });

  if (el.difficultyCloseBtn) {
    el.difficultyCloseBtn.addEventListener('click', (event) => {
      closeDifficultyModal();
      blurAfterPointerClick(event);
    });
  }

  if (el.difficultyModal) {
    el.difficultyModal.addEventListener('click', (event) => {
      if (event.target === el.difficultyModal) {
        closeDifficultyModal();
      }
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && el.difficultyModal && !el.difficultyModal.hidden) {
      closeDifficultyModal();
      return;
    }

    if (event.code !== 'Space' || shouldIgnoreRaceShortcut(event)) {
      return;
    }

    event.preventDefault();

    if (gameState.phase === 'idle') {
      registerRace();
      return;
    }

    if (['countdown_red', 'countdown_yellow', 'countdown_green', 'racing'].includes(gameState.phase)) {
      pressStart();
      return;
    }

    if (['finished', 'false_start'].includes(gameState.phase)) {
      nextRace();
    }
  });

  if (el.difficultyChoices) {
    el.difficultyChoices.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-difficulty]');
      if (button && !button.disabled) {
        setDifficulty(button.dataset.difficulty);
        closeDifficultyModal();
        blurAfterPointerClick(event, button);
      }
    });
  }

  el.atlasFilters.forEach((button) => {
    button.addEventListener('click', (event) => {
      const nextFilter = button.dataset.atlasFilter || 'all';
      if (gameState.atlasFilter === nextFilter) {
        blurAfterPointerClick(event, button);
        return;
      }
      gameState.atlasFilter = nextFilter;
      renderAtlas();
      blurAfterPointerClick(event, button);
    });
  });
}

function init() {
  bindEvents();
  el.registerBtn.textContent = `报名比赛（${getEntryFee()} 元）`;
  resetCars();
  refreshShop();
  renderGarage();
  renderDifficulty();
  renderAtlas();
  renderProfile();
  setPhase('idle');
  setActivePage('race');
  setLights('none');
  updateStats();
  gameState.ready = true;
  checkAchievements({ source: 'init', silent: true });
  addLog('横线赛车经营赛启动。');
  addLog(`${GAME_VERSION}：${GAME_VERSION_NOTE}`);
  addLog('电脑端可按空格键报名 / 起步 / 下一场。');
  addLog('先报名比赛，等绿灯后点“起步 / 踩油门”。红灯或黄灯点击会抢跑。');
}

init();
