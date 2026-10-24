// lib/servoStorage.js
// ============================================================
// Helper terpusat untuk menyimpan & membaca data sudut servo
// Digunakan oleh index.js, history.js, dan settings.js
// ============================================================

// --- Kunci localStorage ---
export const KEYS = {
  ANGLE: 'servoAngle',              // sudut aktif saat ini
  ANGLE_HISTORY: 'servoAngleHistory', // riwayat perubahan sudut
  SETTINGS: 'servoSettings',         // batas & default sudut
};

// --- Nilai default pengaturan servo ---
export const DEFAULT_SETTINGS = {
  minAngle: 90,
  maxAngle: 360,
  defaultAngle: 90,
};

// ✅ Simpan sudut aktif + catat ke riwayat
export function saveAngle(angle) {
  if (typeof window === 'undefined') return;

  const parsed = parseInt(angle);
  localStorage.setItem(KEYS.ANGLE, parsed.toString());

  // Tambahkan entri baru ke riwayat sudut
  const history = getAngleHistory();
  const newEntry = {
    id: Date.now(),
    angle: parsed,
    date: new Date().toLocaleString('id-ID'),
    timestamp: Date.now(),
  };
  history.unshift(newEntry);

  // Batasi riwayat maksimal 100 entri
  const trimmed = history.slice(0, 100);
  localStorage.setItem(KEYS.ANGLE_HISTORY, JSON.stringify(trimmed));

  // Broadcast perubahan ke semua halaman
  window.dispatchEvent(new Event('servo-angle-updated'));
  window.dispatchEvent(new Event('settings-updated'));
}

// ✅ Ambil sudut aktif
export function getAngle() {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS.defaultAngle;
  const saved = localStorage.getItem(KEYS.ANGLE);
  return saved !== null ? parseInt(saved) : DEFAULT_SETTINGS.defaultAngle;
}

// ✅ Ambil riwayat perubahan sudut
export function getAngleHistory() {
  if (typeof window === 'undefined') return [];
  return JSON.parse(localStorage.getItem(KEYS.ANGLE_HISTORY)) || [];
}

// ✅ Hapus riwayat sudut
export function clearAngleHistory() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(KEYS.ANGLE_HISTORY);
  window.dispatchEvent(new Event('servo-angle-updated'));
}

// ✅ Simpan pengaturan servo (min, max, default)
export function saveSettings(settings) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
  window.dispatchEvent(new Event('settings-updated'));
}

// ✅ Ambil pengaturan servo
export function getSettings() {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  const saved = localStorage.getItem(KEYS.SETTINGS);
  return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
}
