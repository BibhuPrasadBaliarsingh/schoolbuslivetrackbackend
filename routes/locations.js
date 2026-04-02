const express = require('express');
const https = require('https');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');

const SCCOCT_URL = process.env.SCCOCT_URL || 'https://api.sccoct.io';

const callSccoct = async (lat, lng) => {
  if (typeof global.fetch === 'function') {
    const response = await fetch(`${SCCOCT_URL}/transform`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lng }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  return new Promise((resolve, reject) => {
    const url = new URL(`${SCCOCT_URL}/transform`);
    const payload = JSON.stringify({ lat, lng });

    const options = {
      method: 'POST',
      hostname: url.hostname,
      path: url.pathname + (url.search || ''),
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`SCCOCT HTTP ${res.statusCode}`));
        }
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
};

router.post('/transform', async (req, res) => {
  const { lat, lng } = req.body;
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return res.status(400).json({ success: false, message: 'lat and lng are required numbers' });
  }

  if (!SCCOCT_URL) {
    return res.json({ success: true, lat, lng });
  }

  try {
    const response = await fetch(`${SCCOCT_URL}/transform`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lng }),
    });

    if (!response.ok) {
      return res.status(response.status).json({ success: false, message: 'SCCOCT transform failed' });
    }

    const data = await callSccoct(lat, lng);
    return res.json({ success: true, lat: data.lat ?? lat, lng: data.lng ?? lng });
  } catch (err) {
    console.error('SCCOCT transform proxy failed', err);
    return res.status(500).json({ success: false, message: 'SCCOCT transform proxy error', error: err.message });
  }
});

module.exports = router;
