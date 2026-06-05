'use strict';

function bindEvents() {
  el.registerBtn.addEventListener('click', registerRace);
  el.startBtn.addEventListener('click', pressStart);
  el.nextBtn.addEventListener('click', nextRace);
  el.saveBtn.addEventListener('click', saveGame);
  el.loadBtn.addEventListener('click', loadGame);
  el.restartBtn.addEventListener('click', restartGame);
  el.tabs.forEach((tab) => {
    tab.addEventListener('click', () => setActivePage(tab.dataset.page));
  });

  if (el.difficultyOpenBtn) {
    el.difficultyOpenBtn.addEventListener('click', openDifficultyModal);
  }

  if (el.difficultyCloseBtn) {
    el.difficultyCloseBtn.addEventListener('click', closeDifficultyModal);
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
    }
  });

  if (el.difficultyChoices) {
    el.difficultyChoices.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-difficulty]');
      if (button && !button.disabled) {
        setDifficulty(button.dataset.difficulty);
        closeDifficultyModal();
      }
    });
  }
}

function init() {
  bindEvents();
  el.registerBtn.textContent = `报名比赛（${getEntryFee()} 元）`;
  resetCars();
  refreshShop();
  renderGarage();
  renderDifficulty();
  renderAtlas();
  setPhase('idle');
  setActivePage('race');
  setLights('none');
  updateStats();
  addLog('横线赛车经营赛启动。');
  addLog('先报名比赛，等绿灯后点“起步 / 踩油门”。红灯或黄灯点击会抢跑。');
  gameState.ready = true;
}

init();
