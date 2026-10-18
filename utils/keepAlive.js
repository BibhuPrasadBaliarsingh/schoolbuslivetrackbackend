const https = require('https');
const http = require('http');

/**
 * Pings the backend health endpoint periodically (every 14 minutes by default)
 * to prevent free-tier hosting (like Render.com) from idling / sleeping.
 */
function startKeepAlive() {
  const url =
    process.env.SELF_PING_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    process.env.BACKEND_URL;

  const intervalMinutes = parseInt(process.env.KEEP_ALIVE_INTERVAL_MINUTES, 10) || 14;
  const intervalMs = intervalMinutes * 60 * 1000;

  if (!url) {
    if (process.env.NODE_ENV === 'production') {
      console.log('⚠️ [Keep-Alive] No RENDER_EXTERNAL_URL or SELF_PING_URL detected.');
      console.log('💡 Set SELF_PING_URL=https://<your-render-app>.onrender.com in your Render environment variables.');
    }
    return null;
  }

  // Ensure clean target URL pointing to /api/health
  const targetBase = url.trim().replace(/\/+$/, '');
  const targetHealthUrl = targetBase.endsWith('/api/health')
    ? targetBase
    : `${targetBase}/api/health`;

  console.log(`⏱️ [Keep-Alive] Initialized: pinging ${targetHealthUrl} every ${intervalMinutes} minutes.`);

  const ping = async () => {
    try {
      if (typeof fetch === 'function') {
        const response = await fetch(targetHealthUrl, {
          method: 'GET',
          headers: { 'User-Agent': 'SchoolBusTracker-KeepAlive/1.0' },
        });
        const data = await response.json().catch(() => ({}));
        console.log(`[Keep-Alive] 🟢 ${new Date().toISOString()} - Ping ${targetHealthUrl} -> ${response.status} ${response.statusText}`, data);
      } else {
        const client = targetHealthUrl.startsWith('https') ? https : http;
        client.get(targetHealthUrl, (res) => {
          console.log(`[Keep-Alive] 🟢 ${new Date().toISOString()} - Ping ${targetHealthUrl} -> ${res.statusCode}`);
        }).on('error', (err) => {
          console.warn(`[Keep-Alive] ⚠️ Ping request failed: ${err.message}`);
        });
      }
    } catch (err) {
      console.warn(`[Keep-Alive] ⚠️ Ping error: ${err.message}`);
    }
  };

  // Initial ping 30 seconds after server launch
  setTimeout(ping, 30 * 1000);

  // Periodic recurring ping
  const timer = setInterval(ping, intervalMs);

  if (timer.unref) {
    timer.unref();
  }

  return timer;
}

module.exports = { startKeepAlive };
