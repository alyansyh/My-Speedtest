import fs   from 'fs';
import path from 'path';

const STORE_PATH = path.join(process.cwd(), '.esp32-store.json');

function readStore() {
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
  } catch {
    return { esp32IP: null, latestData: null, lastReceivedAt: null };
  }
}

function writeStore(data) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(data), 'utf-8');
}

function stripIPv6(ip) {
  if (!ip) return null;
  if (ip.startsWith('::ffff:')) return ip.slice(7);
  if (ip === '::1') return '127.0.0.1';
  return ip;
}

function getClientIP(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return stripIPv6(forwarded.split(',')[0].trim());
  return stripIPv6(req.socket?.remoteAddress ?? null);
}

function isSameSubnet(ip1, ip2) {
  if (!ip1 || !ip2) return false;
  const a = ip1.split('.');
  const b = ip2.split('.');
  return a.length === 4 && b.length === 4 &&
    a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

// Konversi RSSI ke signal % yang benar (server-side fallback)
function rssiToSignal(rssi) {
  if (rssi == null) return null;
  const s = Math.round(((rssi + 90) / 60) * 100);
  return Math.min(100, Math.max(0, s));
}

// Konversi RSSI ke rate Mbps
function rssiToRate(rssi) {
  if (rssi == null) return null;
  if (rssi >= -50) return 300;
  if (rssi >= -60) return 150;
  if (rssi >= -70) return 54;
  if (rssi >= -80) return 11;
  if (rssi >= -90) return 5.5;
  return 1;
}

export default function handler(req, res) {

  // ── ESP32 POST ──────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const body    = req.body ?? {};
    const esp32IP = getClientIP(req);

    console.log(`[wifi-stats] POST dari ${esp32IP}:`, JSON.stringify(body));

    const store          = readStore();
    store.latestData     = body;
    store.lastReceivedAt = Date.now();
    store.esp32IP        = esp32IP;
    writeStore(store);

    return res.status(200).json({ ok: true });
  }

  // ── Frontend GET ────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const store    = readStore();
    const clientIP = getClientIP(req);

    if (!store.latestData || !store.lastReceivedAt) {
      return res.status(200).json({
        available:  false,
        esp32IP:    null,
        clientIP,
        sameSubnet: false,
      });
    }

    const staleMs    = Date.now() - store.lastReceivedAt;
    const sameSubnet = isSameSubnet(clientIP, store.esp32IP);
    const d          = store.latestData;

    const rssi        = d.rssi ?? d.RSSI ?? null;
    const rawSignal   = d.signal ?? d.Signal ?? null;

    // Jika signal dari ESP32 overflow (>100), hitung ulang dari RSSI
    const signal = rawSignal != null
      ? (rawSignal > 100 ? rssiToSignal(rssi) : Math.max(0, rawSignal))
      : rssiToSignal(rssi);

    // Rate: pakai nilai ESP32 jika ada, fallback hitung dari RSSI
    const receiveRate  = d.receiveRate  ?? d.receive_rate  ?? rssiToRate(rssi);
    const transmitRate = d.transmitRate ?? d.transmit_rate ?? (receiveRate ? Math.round(receiveRate * 0.85) : null);

    return res.status(200).json({
      available:    true,
      staleMs,
      esp32IP:      store.esp32IP,
      clientIP,
      sameSubnet,
      rssi,
      signal,
      receiveRate,
      transmitRate,
      ssid:         d.ssid    ?? d.SSID    ?? null,
      channel:      d.channel ?? d.Channel ?? null,
      bssid:        d.bssid   ?? d.BSSID   ?? null,
      angleH:       d.angleH  ?? d.angle   ?? null,
      _raw:         d,
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}