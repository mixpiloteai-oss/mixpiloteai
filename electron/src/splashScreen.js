'use strict';
// Splash screen window — shown during app cold start
const { BrowserWindow } = require('electron');
const path = require('path');

let splashWindow = null;

function createSplash() {
  splashWindow = new BrowserWindow({
    width: 480,
    height: 300,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    backgroundColor: '#00000000',
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 480px; height: 300px;
    background: linear-gradient(135deg, #1a0a2e 0%, #0d1a2c 100%);
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    border-radius: 16px;
    border: 1px solid rgba(167,139,250,0.2);
    box-shadow: 0 32px 80px rgba(0,0,0,0.8);
    overflow: hidden;
  }
  .logo { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 24px; }
  .sq { width: 32px; height: 32px; border-radius: 6px; background: linear-gradient(135deg,#a78bfa,#06b6d4); }
  .sq:nth-child(2) { opacity: 0.7; }
  .sq:nth-child(3) { opacity: 0.7; }
  .sq:nth-child(4) { opacity: 0.5; }
  h1 { color: #fff; font-size: 22px; font-weight: 800; letter-spacing: -0.04em; margin-bottom: 6px; }
  .sub { color: rgba(255,255,255,0.45); font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 28px; }
  .bar-wrap { width: 200px; height: 3px; background: rgba(255,255,255,0.08); border-radius: 2px; overflow: hidden; }
  .bar { height: 100%; background: linear-gradient(90deg,#a78bfa,#06b6d4); border-radius: 2px; animation: load 1.8s ease-in-out infinite; }
  @keyframes load { 0%{width:0%} 60%{width:85%} 100%{width:100%} }
  .version { color: rgba(255,255,255,0.25); font-size: 11px; margin-top: 16px; }
</style></head>
<body>
  <div class="logo"><div class="sq"></div><div class="sq"></div><div class="sq"></div><div class="sq"></div></div>
  <h1>NeuroTek AI</h1>
  <div class="sub">AI Music Production</div>
  <div class="bar-wrap"><div class="bar"></div></div>
  <div class="version">v1.0.0-beta.1</div>
</body></html>`;

  splashWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  return splashWindow;
}

function closeSplash() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
    splashWindow = null;
  }
}

module.exports = { createSplash, closeSplash };
