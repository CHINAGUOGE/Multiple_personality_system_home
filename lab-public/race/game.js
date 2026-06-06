'use strict';

const RACE_GAME_SCRIPTS = [
  'config.js',
  'state.js',
  'core.js',
  'achievements.js',
  'race.js',
  'parts.js',
  'storage.js',
  'main.js',
];

const raceGameEntryScript =
  document.currentScript || document.querySelector('script[src$="game.js"]');
const raceGameScriptBaseUrl = new URL(
  './scripts/',
  raceGameEntryScript ? raceGameEntryScript.src : window.location.href
);

function loadRaceGameScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');

    script.src = new URL(src, raceGameScriptBaseUrl).href;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load race game script: ${src}`));
    document.head.appendChild(script);
  });
}

RACE_GAME_SCRIPTS.reduce(
  (chain, src) => chain.then(() => loadRaceGameScript(src)),
  Promise.resolve()
).catch((error) => {
  console.error(error);
});
