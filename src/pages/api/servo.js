import fs   from 'fs';
import path from 'path';

const STORE_PATH = path.join(process.cwd(), '.esp32-store.json');

function getEsp32IP() {
  try {
    const store = JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
    return store.esp32IP ?? null;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  const parsed = parseInt(req.query.angle);

  if (isNaN(parsed)) {
    return res.status(400).json({ error: 'Angle harus berupa angka' });
  }

  // Clamp ke rentang [90, 360] — sesuai rentang UI dan servo
  const physicalAngle = Math.min(180, Math.max(0, parsed));

  if (physicalAngle !== parsed) {
    console.warn(`[servo] ⚠️  Angle ${parsed}° di-clamp ke ${physicalAngle}°`);
  }

  const esp32IP = getEsp32IP();
  if (!esp32IP) {
    console.warn('[servo] ⚠️  ESP32 IP belum tersedia di store');
    return res.status(503).json({
      error:   'ESP32 belum terdeteksi. Pastikan ESP32 sudah mengirim data WiFi.',
      esp32IP: null,
    });
  }

  const url = `http://${esp32IP}/setServo?angle=${physicalAngle}`;
  console.log(`[servo] UI: ${parsed}° → Fisik: ${physicalAngle}°`);

  try {
    const r    = await fetch(url, { signal: AbortSignal.timeout(3000) });
    const text = await r.text();
    console.log(`[servo] ✅ Respons: ${text}`);
    return res.status(200).json({
      success:        true,
      angleRequested: parsed,
      angleSent:      physicalAngle,
      clamped:        physicalAngle !== parsed,
      esp32IP,
    });
  } catch (err) {
    console.error(`[servo] ❌ ${err.message}`);
    return res.status(500).json({
      error:   'ESP32 tidak dapat dihubungi',
      esp32IP,
      detail:  err.message,
    });
  }
}