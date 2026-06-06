export const prerender = true;

const script = `// ==UserScript==
// @name         MPS Lab 赛车绿灯自动起步
// @namespace    https://lab.mpsteam.cn/race/
// @version      1.0.1
// @description  在 MPS Lab 赛车小游戏绿灯亮起后立即点击“起步 / 踩油门”按钮。
// @match        *://lab.mpsteam.cn/race*
// @run-at       document-idle
// @grant        none
// @downloadURL  https://lab.mpsteam.cn/race/auto-start.user.js
// @updateURL    https://lab.mpsteam.cn/race/auto-start.user.js
// ==/UserScript==

(function () {
  'use strict';

  const GREEN_LIGHT_SELECTOR = '#greenLight';
  const START_BUTTON_SELECTOR = '#startBtn';
  const LOG_SELECTOR = '#logOutput';

  let lastStartAt = 0;

  function writeLog(message) {
    const logOutput = document.querySelector(LOG_SELECTOR);
    const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });

    if (logOutput) {
      logOutput.textContent += \`[\${time}] \${message}\\n\`;
      logOutput.scrollTop = logOutput.scrollHeight;
    }

    console.log(\`[MPS Auto Start \${time}] \${message}\`);
  }

  function canStart() {
    const greenLight = document.querySelector(GREEN_LIGHT_SELECTOR);
    const startButton = document.querySelector(START_BUTTON_SELECTOR);

    return Boolean(
      greenLight &&
        startButton &&
        greenLight.classList.contains('active') &&
        !startButton.disabled
    );
  }

  function clickStartIfGreen() {
    if (!canStart()) {
      return;
    }

    const now = performance.now();
    if (now - lastStartAt < 300) {
      return;
    }

    lastStartAt = now;
    document.querySelector(START_BUTTON_SELECTOR)?.click();
    writeLog('绿灯已亮，已自动起步。');
  }

  function install() {
    const greenLight = document.querySelector(GREEN_LIGHT_SELECTOR);
    const startButton = document.querySelector(START_BUTTON_SELECTOR);

    if (!greenLight || !startButton) {
      return false;
    }

    const observer = new MutationObserver(clickStartIfGreen);
    observer.observe(greenLight, {
      attributes: true,
      attributeFilter: ['class'],
    });
    observer.observe(startButton, {
      attributes: true,
      attributeFilter: ['disabled'],
    });

    setInterval(clickStartIfGreen, 50);
    clickStartIfGreen();
    writeLog('自动起步脚本已启动。');
    return true;
  }

  if (install()) {
    return;
  }

  const bootObserver = new MutationObserver(() => {
    if (install()) {
      bootObserver.disconnect();
    }
  });

  bootObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
`;

export function GET() {
  return new Response(script, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Content-Disposition': 'inline; filename="auto-start.user.js"',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
