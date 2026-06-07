(() => {
  const WORLD_WIDTH = 960;
  const WORLD_HEIGHT = 540;
  const GROUND_Y = 438;
  const GRAVITY = 0.35;
  const WIND_MAX = 0.08;
  const PROJECTILE_RADIUS = 6;
  const BASE_DAMAGE = 18;
  const POWER_STEP = 1.5;
  const AI_DELAY_MS = 650;
  const MIN_THROW_ANGLE = 25;
  const MAX_THROW_ANGLE = 70;
  const DEFAULT_THROW_ANGLE = 45;
  const HEAL_AMOUNT = 20;
  const HEAVY_DAMAGE_BONUS = 8;
  const HEAVY_RADIUS_BONUS = 2;
  const SPLASH_RADIUS = 74;

  const DIFFICULTY_ERROR = {
    easy: 20,
    normal: 12,
    hard: 6,
  };

  const AI_ANGLE_ERROR = {
    easy: 9,
    normal: 6,
    hard: 3,
  };

  const canvas = document.querySelector('#gameCanvas');
  const ctx = canvas.getContext('2d');
  const chargeBtn = document.querySelector('#chargeBtn');
  const restartBtn = document.querySelector('#restartBtn');
  const modalRestartBtn = document.querySelector('#modalRestartBtn');
  const resultModal = document.querySelector('#resultModal');
  const resultTitle = document.querySelector('#resultTitle');
  const resultText = document.querySelector('#resultText');
  const statusBadge = document.querySelector('#statusBadge');
  const turnText = document.querySelector('#turnText');
  const windText = document.querySelector('#windText');
  const messageText = document.querySelector('#messageText');
  const powerFill = document.querySelector('#powerFill');
  const powerText = document.querySelector('#powerText');
  const angleInput = document.querySelector('#angleInput');
  const angleText = document.querySelector('#angleText');
  const itemText = document.querySelector('#itemText');
  const playerNameText = document.querySelector('#playerNameText');
  const opponentNameText = document.querySelector('#opponentNameText');
  const playerHpText = document.querySelector('#playerHpText');
  const opponentHpText = document.querySelector('#opponentHpText');
  const playerHpFill = document.querySelector('#playerHpFill');
  const opponentHpFill = document.querySelector('#opponentHpFill');
  const difficultyButtons = Array.from(document.querySelectorAll('[data-difficulty]'));
  const modeButtons = Array.from(document.querySelectorAll('[data-mode]'));
  const itemButtons = Array.from(document.querySelectorAll('[data-item]'));

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  const randomBetween = (min, max) => Math.random() * (max - min) + min;
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  let game = createGame('ai', 'normal');
  let lastFrame = 0;
  let aiTimer = 0;
  let turnTimer = 0;
  let lastPointerInputAt = 0;
  let lastTouchInputAt = 0;

  function createItems() {
    return {
      heal: true,
      heavy: true,
    };
  }

  function createActor(config) {
    return {
      hp: 100,
      maxHp: 100,
      radius: config.radius,
      x: config.x,
      groundY: GROUND_Y,
      side: config.side,
      name: config.name,
      species: config.species,
      controller: config.controller,
      color: config.color,
      accent: config.accent,
      projectileColor: config.projectileColor,
      projectileName: config.projectileName,
      items: createItems(),
    };
  }

  function createGame(mode, difficulty) {
    return {
      mode,
      difficulty,
      phase: 'aiming',
      currentIndex: 0,
      power: 0,
      aimAngle: DEFAULT_THROW_ANGLE,
      selectedItem: null,
      charging: false,
      wind: randomBetween(-WIND_MAX, WIND_MAX),
      projectile: null,
      message: '按住画面或按钮开始蓄力。',
      impact: null,
      actors: [
        createActor({
          x: 150,
          side: 1,
          radius: 32,
          name: '猫猫',
          species: 'cat',
          controller: 'human',
          color: '#f5b95f',
          accent: '#8f5a2d',
          projectileColor: '#f06292',
          projectileName: '毛线球',
        }),
        createActor({
          x: 810,
          side: -1,
          radius: 34,
          name: mode === 'local' ? '狗狗玩家' : '狗狗 AI',
          species: 'dog',
          controller: mode === 'local' ? 'human' : 'ai',
          color: '#c98b5a',
          accent: '#70452c',
          projectileColor: '#e6d5a8',
          projectileName: '软骨头',
        }),
      ],
    };
  }

  function currentActor() {
    return game.actors[game.currentIndex];
  }

  function targetActor() {
    return game.actors[game.currentIndex === 0 ? 1 : 0];
  }

  function actorCenter(actor) {
    return {
      x: actor.x,
      y: actor.groundY - actor.radius,
    };
  }

  function throwAngleFor(actor, degrees = game.aimAngle) {
    const radians = (clamp(degrees, MIN_THROW_ANGLE, MAX_THROW_ANGLE) * Math.PI) / 180;
    return actor.side === 1 ? -radians : Math.PI + radians;
  }

  function isHumanAiming() {
    return game.phase === 'aiming' && currentActor().controller === 'human';
  }

  function canUseItem(itemKey) {
    const actor = currentActor();
    if (!isHumanAiming() || game.charging || !actor.items[itemKey]) {
      return false;
    }

    if (itemKey === 'heal') {
      return actor.hp < actor.maxHp;
    }

    return itemKey === 'heavy';
  }

  function resetGame(mode = game.mode, difficulty = game.difficulty) {
    clearTimeout(aiTimer);
    clearTimeout(turnTimer);
    aiTimer = 0;
    turnTimer = 0;
    game = createGame(mode, difficulty);
    updateUi();
  }

  function setWindForNextTurn() {
    game.wind = randomBetween(-WIND_MAX, WIND_MAX);
  }

  function startCharge(event) {
    if (shouldIgnoreFallbackMouse(event) || !isHumanAiming() || game.charging) {
      return;
    }

    markInputEvent(event);
    event.preventDefault?.();
    capturePointer(event);
    game.charging = true;
    game.power = 0;
    game.message = `${currentActor().name} 正在蓄力。`;
    updateUi();
  }

  function releaseCharge(event) {
    if (shouldIgnoreFallbackMouse(event) || !game.charging) {
      return;
    }

    markInputEvent(event);
    event.preventDefault?.();
    game.charging = false;
    fireForCurrent(game.power);
  }

  function markInputEvent(event) {
    if (event.type.startsWith('pointer')) {
      lastPointerInputAt = performance.now();
    }

    if (event.type.startsWith('touch')) {
      lastTouchInputAt = performance.now();
    }
  }

  function shouldIgnoreFallbackMouse(event) {
    if (!event.type.startsWith('mouse')) {
      return false;
    }

    const now = performance.now();
    return now - lastPointerInputAt < 700 || now - lastTouchInputAt < 700;
  }

  function capturePointer(event) {
    if (event.pointerId === undefined || !event.currentTarget?.setPointerCapture) {
      return;
    }

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic pointer events used in tests do not have an active pointer to capture.
    }
  }

  function fireForCurrent(rawPower) {
    const actor = currentActor();
    const power = clamp(rawPower, 8, 100);
    const itemKey = game.selectedItem;
    const usingHeavy = itemKey === 'heavy' && actor.items.heavy;
    const angle = throwAngleFor(actor);
    const speed = 4.5 + (power / 100) * 11;

    if (usingHeavy) {
      actor.items.heavy = false;
    }

    game.projectile = {
      x: actor.x + actor.side * (actor.radius + 12),
      y: actor.groundY - actor.radius - 10,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: PROJECTILE_RADIUS + (usingHeavy ? HEAVY_RADIUS_BONUS : 0),
      ownerIndex: game.currentIndex,
      color: actor.projectileColor,
      damage: BASE_DAMAGE + (usingHeavy ? HEAVY_DAMAGE_BONUS : 0),
      splashRadius: SPLASH_RADIUS + (usingHeavy ? 16 : 0),
      name: actor.projectileName,
      itemKey: usingHeavy ? itemKey : null,
      spin: 0,
    };

    game.phase = 'flying';
    game.power = 0;
    game.selectedItem = null;
    game.message = usingHeavy
      ? `${actor.name} 用重球强化了这次投掷。`
      : `${actor.name} 投出了${actor.projectileName}。`;
    updateUi();
  }

  function maybeUseAiItem(actor, target) {
    let usedHeal = false;

    if (actor.items.heal && actor.hp <= 46) {
      actor.items.heal = false;
      actor.hp = clamp(actor.hp + HEAL_AMOUNT, 0, actor.maxHp);
      game.message = `${actor.name} 使用急救包，恢复 ${HEAL_AMOUNT} HP。`;
      usedHeal = true;
      updateUi();
    }

    if (!actor.items.heavy) {
      return usedHeal;
    }

    const canFinish = target.hp <= BASE_DAMAGE + HEAVY_DAMAGE_BONUS;
    const pressured = actor.hp <= 58;
    const chance = game.difficulty === 'hard' ? 0.45 : game.difficulty === 'normal' ? 0.3 : 0.18;
    if (canFinish || pressured || Math.random() < chance) {
      game.selectedItem = 'heavy';
    }

    return usedHeal;
  }

  function beginAiTurn() {
    clearTimeout(aiTimer);
    game.phase = 'aiThinking';
    game.power = 0;
    game.message = '狗狗 AI 正在估算风向。';
    updateUi();

    aiTimer = window.setTimeout(() => {
      if (game.phase !== 'aiThinking' || currentActor().controller !== 'ai') {
        return;
      }

      const actor = currentActor();
      const target = targetActor();
      const error = DIFFICULTY_ERROR[game.difficulty] ?? DIFFICULTY_ERROR.normal;
      const angleError = AI_ANGLE_ERROR[game.difficulty] ?? AI_ANGLE_ERROR.normal;
      const distanceToTarget = Math.abs(actor.x - target.x);
      const windCompensation = actor.side === -1 ? game.wind * 90 : -game.wind * 90;
      const aiPower = clamp(
        distanceToTarget / 6 + windCompensation + randomBetween(-error, error),
        30,
        95
      );
      game.aimAngle = clamp(
        DEFAULT_THROW_ANGLE + randomBetween(-angleError, angleError),
        MIN_THROW_ANGLE,
        MAX_THROW_ANGLE
      );
      const usedHeal = maybeUseAiItem(actor, target);
      const throwNow = () => {
        if (game.phase === 'aiThinking' && currentActor().controller === 'ai') {
          fireForCurrent(aiPower);
        }
      };

      if (usedHeal) {
        aiTimer = window.setTimeout(throwNow, 420);
        return;
      }

      throwNow();
    }, AI_DELAY_MS);
  }

  function switchTurn() {
    game.currentIndex = game.currentIndex === 0 ? 1 : 0;
    game.selectedItem = null;
    setWindForNextTurn();

    if (currentActor().controller === 'ai') {
      beginAiTurn();
      return;
    }

    game.aimAngle = DEFAULT_THROW_ANGLE;
    game.phase = 'aiming';
    game.message = `${currentActor().name} 回合，按住蓄力。`;
    updateUi();
  }

  function finishThrow(result) {
    const actor = game.actors[game.projectile.ownerIndex];
    const target = game.actors[game.projectile.ownerIndex === 0 ? 1 : 0];
    game.impact = {
      x: game.projectile.x,
      y: game.projectile.y,
      ttl: 34,
      hit: result.hit,
    };
    game.projectile = null;

    if (result.hit) {
      target.hp = clamp(target.hp - result.damage, 0, target.maxHp);
      game.message = result.splash
        ? `${actor.name} 溅射命中，${target.name} -${result.damage} HP。`
        : `${actor.name} 命中，${target.name} -${result.damage} HP。`;
    } else {
      game.message = `${actor.name} 没打中。`;
    }

    if (target.hp <= 0) {
      game.phase = 'gameOver';
      game.charging = false;
      game.power = 0;
      game.message = `${actor.name} 获胜。`;
      showResult(actor, target);
      updateUi();
      return;
    }

    clearTimeout(turnTimer);
    turnTimer = window.setTimeout(
      () => {
        turnTimer = 0;
        if (game.phase !== 'gameOver') {
          switchTurn();
        }
      },
      result.hit ? 520 : 360
    );

    updateUi();
  }

  function showResult(winner, loser) {
    resultTitle.textContent = `${winner.name}获胜`;
    resultText.textContent = `${loser.name} 的 HP 归零。点击按钮可以立刻重开。`;
    resultModal.hidden = false;
  }

  function hideResult() {
    resultModal.hidden = true;
  }

  function updateProjectile(dt) {
    if (!game.projectile) {
      return;
    }

    const projectile = game.projectile;
    projectile.vx += game.wind * dt;
    projectile.vy += GRAVITY * dt;
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    projectile.spin += projectile.vx * 0.04 * dt;

    const target = game.actors[projectile.ownerIndex === 0 ? 1 : 0];
    if (distance(projectile, actorCenter(target)) < target.radius + projectile.radius) {
      finishThrow({ hit: true, damage: projectile.damage, splash: false });
      return;
    }

    const missedGround = projectile.y + projectile.radius >= GROUND_Y;
    const missedBounds =
      projectile.x < -80 || projectile.x > WORLD_WIDTH + 80 || projectile.y > WORLD_HEIGHT + 80;

    if (missedGround || missedBounds) {
      finishThrow(
        missedGround ? resolveGroundImpact(projectile, target) : { hit: false, damage: 0 }
      );
    }
  }

  function resolveGroundImpact(projectile, target) {
    const gap = Math.abs(projectile.x - target.x);
    if (gap > projectile.splashRadius) {
      return { hit: false, damage: 0 };
    }

    const ratio = 1 - gap / projectile.splashRadius;
    const damage = clamp(Math.round(5 + ratio * (projectile.damage * 0.48)), 5, 16);
    return { hit: true, damage, splash: true };
  }

  function updateCharge(dt) {
    if (!game.charging || game.phase !== 'aiming') {
      return;
    }

    game.power = clamp(game.power + POWER_STEP * dt, 0, 100);
    updateUi();
  }

  function updateImpact(dt) {
    if (!game.impact) {
      return;
    }

    game.impact.ttl -= dt;
    if (game.impact.ttl <= 0) {
      game.impact = null;
    }
  }

  function updateUi() {
    const actor = currentActor();
    const opponent = game.actors[1];
    const player = game.actors[0];
    const powerRatio = game.power / 100;

    turnText.textContent = actor.name;
    windText.textContent = formatWind(game.wind);
    messageText.textContent = game.message;
    powerText.textContent = `${Math.round(game.power)}`;
    powerFill.style.transform = `scaleX(${powerRatio})`;
    angleInput.value = String(Math.round(game.aimAngle));
    angleInput.disabled = !isHumanAiming() || game.charging;
    angleText.textContent = `${Math.round(game.aimAngle)}°`;
    playerNameText.textContent = player.name;
    opponentNameText.textContent = opponent.name;
    playerHpText.textContent = `${player.hp} / ${player.maxHp}`;
    opponentHpText.textContent = `${opponent.hp} / ${opponent.maxHp}`;
    playerHpFill.style.transform = `scaleX(${player.hp / player.maxHp})`;
    opponentHpFill.style.transform = `scaleX(${opponent.hp / opponent.maxHp})`;
    chargeBtn.disabled = !isHumanAiming();
    chargeBtn.textContent = chargeButtonText();
    statusBadge.textContent = statusText();
    updateItemUi(actor);

    difficultyButtons.forEach((button) => {
      const isActive = button.dataset.difficulty === game.difficulty;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });

    modeButtons.forEach((button) => {
      const isActive = button.dataset.mode === game.mode;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
  }

  function updateItemUi(actor) {
    itemButtons.forEach((button) => {
      const itemKey = button.dataset.item;
      const isSelected = game.selectedItem === itemKey;
      const isAvailable = Boolean(actor.items[itemKey]);
      button.disabled = !canUseItem(itemKey);
      button.classList.toggle('is-active', isSelected);
      button.classList.toggle('is-used', !isAvailable);
      button.setAttribute('aria-pressed', String(isSelected));
    });

    if (!isHumanAiming()) {
      itemText.textContent = '等待真人回合时可使用道具。';
      return;
    }

    if (game.selectedItem === 'heavy') {
      itemText.textContent = '重球已准备，下一次投掷伤害更高、溅射范围更大。';
      return;
    }

    const healText = actor.items.heal ? `急救包 +${HEAL_AMOUNT} HP` : '急救包已用';
    const heavyText = actor.items.heavy ? `重球 +${HEAVY_DAMAGE_BONUS} 伤害` : '重球已用';
    itemText.textContent = `${healText} · ${heavyText}`;
  }

  function chargeButtonText() {
    if (game.phase === 'gameOver') {
      return '比赛结束';
    }

    if (game.phase === 'flying') {
      return '投掷中';
    }

    if (game.phase === 'aiThinking') {
      return '等待 AI';
    }

    if (game.charging) {
      return '松开投掷';
    }

    return '按住蓄力';
  }

  function statusText() {
    if (game.phase === 'gameOver') {
      return '比赛结束';
    }

    if (game.phase === 'flying') {
      return '飞行中';
    }

    if (game.phase === 'aiThinking') {
      return 'AI 思考';
    }

    return `${currentActor().name}回合`;
  }

  function formatWind(wind) {
    if (Math.abs(wind) < 0.005) {
      return '几乎无风';
    }

    const direction = wind > 0 ? '向右' : '向左';
    return `${direction} ${Math.abs(wind).toFixed(2)}`;
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(
      (rect.width * dpr) / WORLD_WIDTH,
      0,
      0,
      (rect.height * dpr) / WORLD_HEIGHT,
      0,
      0
    );
  }

  function draw() {
    resizeCanvas();
    drawSky();
    drawBackyard();
    drawHud();
    drawAimGuide();
    drawTrajectoryPreview();
    game.actors.forEach(drawActor);
    drawProjectile();
    drawImpact();
  }

  function drawSky() {
    const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    sky.addColorStop(0, '#82cfff');
    sky.addColorStop(0.62, '#ccefff');
    sky.addColorStop(1, '#fff1c8');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(92, 76, 34, 0, Math.PI * 2);
    ctx.fill();

    drawCloud(230, 92, 1);
    drawCloud(650, 74, 0.82);
    drawCloud(805, 142, 0.66);
  }

  function drawCloud(x, y, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
    ctx.beginPath();
    ctx.arc(0, 10, 22, 0, Math.PI * 2);
    ctx.arc(28, 0, 30, 0, Math.PI * 2);
    ctx.arc(60, 12, 24, 0, Math.PI * 2);
    ctx.roundRect(-22, 10, 104, 28, 14);
    ctx.fill();
    ctx.restore();
  }

  function drawBackyard() {
    ctx.fillStyle = '#b98558';
    for (let x = 0; x < WORLD_WIDTH; x += 58) {
      ctx.fillRect(x, 328, 38, 122);
      ctx.fillStyle = 'rgba(92, 54, 32, 0.16)';
      ctx.fillRect(x + 34, 328, 4, 122);
      ctx.fillStyle = '#b98558';
    }

    ctx.fillStyle = '#99633f';
    ctx.fillRect(0, 356, WORLD_WIDTH, 14);
    ctx.fillRect(0, 410, WORLD_WIDTH, 14);

    const grass = ctx.createLinearGradient(0, GROUND_Y, 0, WORLD_HEIGHT);
    grass.addColorStop(0, '#64bd6d');
    grass.addColorStop(1, '#2e7c4f');
    ctx.fillStyle = grass;
    ctx.fillRect(0, GROUND_Y, WORLD_WIDTH, WORLD_HEIGHT - GROUND_Y);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    for (let x = 18; x < WORLD_WIDTH; x += 42) {
      ctx.beginPath();
      ctx.ellipse(x, GROUND_Y + 26 + (x % 3) * 2, 11, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawHud() {
    drawCanvasHp(game.actors[0], 24, 22, false);
    drawCanvasHp(game.actors[1], WORLD_WIDTH - 264, 22, true);

    ctx.fillStyle = 'rgba(23, 32, 51, 0.72)';
    ctx.font = '800 18px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(statusText(), WORLD_WIDTH / 2, 34);

    drawWindArrow();

    if (game.phase === 'aiming' && currentActor().controller === 'human') {
      drawCanvasPower();
    }
  }

  function drawCanvasHp(actor, x, y, alignRight) {
    const width = 240;
    const height = 18;
    const ratio = actor.hp / actor.maxHp;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
    ctx.beginPath();
    ctx.roundRect(x, y, width, 48, 8);
    ctx.fill();

    ctx.fillStyle = 'rgba(23, 32, 51, 0.8)';
    ctx.font = '800 14px system-ui, sans-serif';
    ctx.textAlign = alignRight ? 'right' : 'left';
    ctx.fillText(`${actor.name} HP ${actor.hp}`, alignRight ? x + width - 12 : x + 12, y + 18);

    ctx.fillStyle = '#d8e2ee';
    ctx.beginPath();
    ctx.roundRect(x + 12, y + 26, width - 24, height, 9);
    ctx.fill();

    if (ratio > 0) {
      ctx.fillStyle = actor.side === 1 ? '#48b46d' : '#ef7d6d';
      ctx.beginPath();
      ctx.roundRect(x + 12, y + 26, (width - 24) * ratio, height, 9);
      ctx.fill();
    }
  }

  function drawWindArrow() {
    const centerX = WORLD_WIDTH / 2;
    const y = 62;
    const length = clamp(Math.abs(game.wind) / WIND_MAX, 0.08, 1) * 62;
    const side = game.wind >= 0 ? 1 : -1;

    ctx.strokeStyle = 'rgba(23, 32, 51, 0.58)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(centerX - side * length * 0.5, y);
    ctx.lineTo(centerX + side * length * 0.5, y);
    ctx.stroke();

    ctx.fillStyle = 'rgba(23, 32, 51, 0.58)';
    ctx.beginPath();
    ctx.moveTo(centerX + side * length * 0.5, y);
    ctx.lineTo(centerX + side * (length * 0.5 - 12), y - 8);
    ctx.lineTo(centerX + side * (length * 0.5 - 12), y + 8);
    ctx.closePath();
    ctx.fill();

    ctx.font = '800 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(formatWind(game.wind), centerX, y + 24);
  }

  function drawCanvasPower() {
    const width = 220;
    const height = 14;
    const x = WORLD_WIDTH / 2 - width / 2;
    const y = WORLD_HEIGHT - 48;
    const ratio = game.power / 100;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
    ctx.beginPath();
    ctx.roundRect(x - 12, y - 20, width + 24, 44, 8);
    ctx.fill();
    ctx.fillStyle = '#d8e2ee';
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 8);
    ctx.fill();

    if (ratio > 0) {
      const powerGradient = ctx.createLinearGradient(x, y, x + width, y);
      powerGradient.addColorStop(0, '#ffd166');
      powerGradient.addColorStop(0.58, '#ff9858');
      powerGradient.addColorStop(1, '#f47c7c');
      ctx.fillStyle = powerGradient;
      ctx.beginPath();
      ctx.roundRect(x, y, width * ratio, height, 8);
      ctx.fill();
    }

    ctx.fillStyle = 'rgba(23, 32, 51, 0.72)';
    ctx.font = '800 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`力度 ${Math.round(game.power)}`, WORLD_WIDTH / 2, y - 6);
  }

  function drawAimGuide() {
    if (!isHumanAiming()) {
      return;
    }

    const actor = currentActor();
    const angle = throwAngleFor(actor);
    const startX = actor.x + actor.side * (actor.radius + 10);
    const startY = actor.groundY - actor.radius - 10;
    const length = 86;
    const endX = startX + Math.cos(angle) * length;
    const endY = startY + Math.sin(angle) * length;

    ctx.save();
    ctx.strokeStyle =
      game.selectedItem === 'heavy' ? 'rgba(244, 124, 124, 0.9)' : 'rgba(23, 32, 51, 0.56)';
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    ctx.translate(endX, endY);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-13, -7);
    ctx.lineTo(-13, 7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawTrajectoryPreview() {
    if (!game.charging || game.phase !== 'aiming') {
      return;
    }

    const actor = currentActor();
    const power = clamp(game.power, 8, 100);
    const angle = throwAngleFor(actor);
    const speed = 4.5 + (power / 100) * 11;
    let x = actor.x + actor.side * (actor.radius + 12);
    let y = actor.groundY - actor.radius - 10;
    let vx = Math.cos(angle) * speed;
    let vy = Math.sin(angle) * speed;

    ctx.save();
    ctx.fillStyle = 'rgba(23, 32, 51, 0.34)';
    for (let i = 0; i < 38; i += 1) {
      vx += game.wind;
      vy += GRAVITY;
      x += vx;
      y += vy;
      if (i % 4 === 0) {
        ctx.beginPath();
        ctx.arc(x, y, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
      if (y > GROUND_Y) {
        break;
      }
    }
    ctx.restore();
  }

  function drawActor(actor) {
    const center = actorCenter(actor);
    const isCurrent = actor === currentActor() && game.phase !== 'gameOver';

    ctx.save();
    ctx.translate(center.x, center.y);

    ctx.fillStyle = 'rgba(39, 55, 77, 0.2)';
    ctx.beginPath();
    ctx.ellipse(0, actor.radius + 8, actor.radius * 1.2, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    if (isCurrent) {
      ctx.strokeStyle = 'rgba(255, 209, 102, 0.85)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 0, actor.radius + 8, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (actor.species === 'cat') {
      drawCat(actor);
    } else {
      drawDog(actor);
    }

    ctx.fillStyle = 'rgba(23, 32, 51, 0.76)';
    ctx.font = '800 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(actor.name, 0, actor.radius + 30);
    ctx.restore();
  }

  function drawCat(actor) {
    ctx.fillStyle = actor.color;
    ctx.beginPath();
    ctx.moveTo(-21, -22);
    ctx.lineTo(-7, -47);
    ctx.lineTo(5, -21);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(21, -22);
    ctx.lineTo(7, -47);
    ctx.lineTo(-5, -21);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = actor.color;
    ctx.beginPath();
    ctx.arc(0, 0, actor.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = actor.accent;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(-actor.side * 30, 10, 18, 0.25 * Math.PI, 1.2 * Math.PI);
    ctx.stroke();

    drawFace(actor.accent, '#fff3d8');
    ctx.strokeStyle = actor.accent;
    ctx.lineWidth = 2;
    [-1, 1].forEach((side) => {
      ctx.beginPath();
      ctx.moveTo(side * 10, 6);
      ctx.lineTo(side * 27, 2);
      ctx.moveTo(side * 10, 11);
      ctx.lineTo(side * 28, 13);
      ctx.stroke();
    });
  }

  function drawDog(actor) {
    ctx.fillStyle = actor.accent;
    ctx.beginPath();
    ctx.ellipse(-28, -6, 13, 25, 0.2, 0, Math.PI * 2);
    ctx.ellipse(28, -6, 13, 25, -0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = actor.color;
    ctx.beginPath();
    ctx.arc(0, 0, actor.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f3c996';
    ctx.beginPath();
    ctx.ellipse(0, 10, 18, 13, 0, 0, Math.PI * 2);
    ctx.fill();

    drawFace(actor.accent, '#fff3d8');
  }

  function drawFace(lineColor, eyeColor) {
    ctx.fillStyle = eyeColor;
    ctx.beginPath();
    ctx.arc(-11, -7, 5, 0, Math.PI * 2);
    ctx.arc(11, -7, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = lineColor;
    ctx.beginPath();
    ctx.arc(-11, -6, 2.2, 0, Math.PI * 2);
    ctx.arc(11, -6, 2.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 3, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-5, 7, 6, 0, Math.PI * 0.9);
    ctx.arc(5, 7, 6, Math.PI * 0.1, Math.PI);
    ctx.stroke();
  }

  function drawProjectile() {
    const projectile = game.projectile;
    if (!projectile) {
      return;
    }

    ctx.save();
    ctx.translate(projectile.x, projectile.y);
    ctx.rotate(projectile.spin);
    ctx.fillStyle = projectile.color;
    ctx.beginPath();
    ctx.arc(0, 0, projectile.radius + 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(23, 32, 51, 0.42)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, projectile.radius - 1, -0.3, Math.PI * 1.25);
    ctx.stroke();
    ctx.restore();
  }

  function drawImpact() {
    if (!game.impact) {
      return;
    }

    const ratio = game.impact.ttl / 34;
    ctx.save();
    ctx.globalAlpha = ratio;
    ctx.strokeStyle = game.impact.hit ? '#f47c7c' : 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(game.impact.x, game.impact.y, 30 * (1 - ratio) + 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function setAimAngle(value) {
    game.aimAngle = clamp(Number(value) || DEFAULT_THROW_ANGLE, MIN_THROW_ANGLE, MAX_THROW_ANGLE);
    updateUi();
  }

  function useItem(itemKey) {
    if (!canUseItem(itemKey)) {
      return;
    }

    const actor = currentActor();
    if (itemKey === 'heal') {
      actor.items.heal = false;
      actor.hp = clamp(actor.hp + HEAL_AMOUNT, 0, actor.maxHp);
      game.message = `${actor.name} 使用急救包，恢复 ${HEAL_AMOUNT} HP。`;
      updateUi();
      return;
    }

    if (itemKey === 'heavy') {
      game.selectedItem = game.selectedItem === 'heavy' ? null : 'heavy';
      game.message = game.selectedItem
        ? `${actor.name} 准备使用重球。`
        : `${actor.name} 收起了重球。`;
      updateUi();
    }
  }

  function frame(timestamp) {
    const dt = clamp((timestamp - lastFrame) / 16.67 || 1, 0.5, 2);
    lastFrame = timestamp;
    updateCharge(dt);
    updateProjectile(dt);
    updateImpact(dt);
    draw();
    requestAnimationFrame(frame);
  }

  [canvas, chargeBtn].forEach((target) => {
    target.addEventListener('pointerdown', startCharge);
    target.addEventListener('pointerup', releaseCharge);
    target.addEventListener('pointercancel', releaseCharge);
    target.addEventListener('mousedown', startCharge);
    target.addEventListener('touchstart', startCharge, { passive: false });
  });

  window.addEventListener('mouseup', releaseCharge);
  window.addEventListener('touchend', releaseCharge, { passive: false });
  window.addEventListener('touchcancel', releaseCharge, { passive: false });

  angleInput.addEventListener('input', () => {
    setAimAngle(angleInput.value);
  });

  itemButtons.forEach((button) => {
    button.addEventListener('click', () => {
      useItem(button.dataset.item);
    });
  });

  restartBtn.addEventListener('click', () => {
    hideResult();
    resetGame();
  });

  modalRestartBtn.addEventListener('click', () => {
    hideResult();
    resetGame();
  });

  difficultyButtons.forEach((button) => {
    button.addEventListener('click', () => {
      game.difficulty = button.dataset.difficulty;
      updateUi();
    });
  });

  modeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      hideResult();
      resetGame(button.dataset.mode, game.difficulty);
    });
  });

  window.addEventListener('resize', draw);
  updateUi();
  requestAnimationFrame(frame);
})();
