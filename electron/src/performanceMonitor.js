'use strict';
// ============================================================
// NeuroTek AI — Performance Monitor
// Polls CPU %, RAM usage, and app uptime every 2 seconds
// ============================================================
const os = require('os');

let _interval = null;
let _prevCpuTimes = null;

function _getCpuPercent() {
  const cpus = os.cpus();
  const curr = cpus.map(c => ({
    total: Object.values(c.times).reduce((a, b) => a + b, 0),
    idle: c.times.idle,
  }));
  if (!_prevCpuTimes) { _prevCpuTimes = curr; return 0; }
  let totalDiff = 0, idleDiff = 0;
  curr.forEach((c, i) => {
    totalDiff += c.total - _prevCpuTimes[i].total;
    idleDiff  += c.idle  - _prevCpuTimes[i].idle;
  });
  _prevCpuTimes = curr;
  return totalDiff === 0 ? 0 : Math.min(100, Math.round((1 - idleDiff / totalDiff) * 100));
}

function getStats() {
  const memTotal = os.totalmem();
  const memFree  = os.freemem();
  const memUsed  = memTotal - memFree;
  let processMemMB = 0;
  try { processMemMB = Math.round(process.memoryUsage().rss / 1024 / 1024); } catch {}
  return {
    cpuPercent:   _getCpuPercent(),
    memUsedMB:    Math.round(memUsed  / 1024 / 1024),
    memTotalMB:   Math.round(memTotal / 1024 / 1024),
    memFreeMB:    Math.round(memFree  / 1024 / 1024),
    memPercent:   Math.round((memUsed / memTotal) * 100),
    processMemMB,
    uptimeSec:    Math.round(process.uptime()),
    systemUptimeSec: Math.round(os.uptime()),
    pid:          process.pid,
    cpuCount:     os.cpus().length,
    cpuModel:     os.cpus()[0]?.model ?? 'Unknown',
    timestamp:    Date.now(),
  };
}

function start(sendFn, intervalMs = 2000) {
  if (_interval) return;
  _interval = setInterval(() => {
    try { sendFn('perf-stats', getStats()); } catch {}
  }, intervalMs);
}

function stop() {
  if (_interval) { clearInterval(_interval); _interval = null; }
}

module.exports = { start, stop, getStats };
