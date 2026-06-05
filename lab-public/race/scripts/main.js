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
}

function init() {
  bindEvents();
  resetCars();
  refreshShop();
  renderGarage();
  setPhase('idle');
  setActivePage('race');
  setLights('none');
  updateStats();
  addLog('横线赛车经营赛启动。');
  addLog('先报名比赛，等绿灯后点“起步 / 踩油门”。红灯或黄灯点击会抢跑。');
}

init();
