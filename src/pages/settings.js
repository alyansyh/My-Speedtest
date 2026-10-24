// pages/settings.js
import { SERVERS, matchServerByISP } from '../lib/servers';
import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import {
  FiHome, FiClock, FiSettings, FiServer, FiWifi, FiMenu, FiX,
  FiTrash2, FiInfo, FiSave, FiRefreshCw
} from 'react-icons/fi';

import {
  saveAngle, getAngle,
  saveSettings as saveServoSettings, getSettings,
  clearAngleHistory, DEFAULT_SETTINGS
} from '../lib/servoStorage';

// ✅ Tidak ada hardcode ESP32_IP — diambil dinamis dari /api/wifi-stats
const INIT_ANGLE = 90;

function persistServer(server) {
  if (!server || typeof window === 'undefined') return;
  localStorage.setItem('selectedServerId', String(server.id));
  window.dispatchEvent(new CustomEvent('settings-updated'));
}

export default function SettingsPage() {
  const [activeServer, setActiveServer] = useState(null);
  const [detectedISP, setDetectedISP]   = useState(null);
  const [ispLoading, setIspLoading]     = useState(false);
  const [ispError, setIspError]         = useState('');

  const [defaultConnectionMode, setDefaultConnectionMode] = useState('multi');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [saveMessage, setSaveMessage]   = useState('');

  const [servoAngle, setServoAngle]     = useState(INIT_ANGLE);
  const [servoStatus, setServoStatus]   = useState('');
  const [minAngle, setMinAngle]         = useState(DEFAULT_SETTINGS.minAngle ?? 0);
  const [maxAngle, setMaxAngle]         = useState(DEFAULT_SETTINGS.maxAngle ?? 180);
  const [defaultAngle, setDefaultAngle] = useState(INIT_ANGLE);

  // ✅ IP ESP32 diambil dinamis dari /api/wifi-stats
  const [esp32IP, setEsp32IP]           = useState(null);
  const [esp32Online, setEsp32Online]   = useState(false);

  // ─── Fetch IP ESP32 dari wifi-stats ──────────────────────────────────────
  const fetchEsp32IP = async () => {
    try {
      const res  = await fetch('/api/wifi-stats');
      const data = await res.json();
      if (data.available && data.esp32IP) {
        setEsp32IP(data.esp32IP);
        setEsp32Online(data.staleMs < 10_000);
      } else {
        setEsp32Online(false);
      }
    } catch {
      setEsp32Online(false);
    }
  };

  // ─── Deteksi ISP ─────────────────────────────────────────────────────────
  const detectISP = async () => {
    setIspLoading(true);
    setIspError('');
    try {
      const res  = await fetch('http://ip-api.com/json/?fields=status,isp,org,as,query');
      const data = await res.json();
      if (data.status !== 'success') {
        setIspError('Gagal mendeteksi provider jaringan.');
        return;
      }
      const ispName = data.isp || data.org || '';
      setDetectedISP({ name: ispName, ip: data.query });
      const matched = matchServerByISP(ispName);
      const server  = matched ?? SERVERS[0];
      setActiveServer(server);
      persistServer(server);
    } catch (err) {
      console.error(err);
      setIspError('Tidak dapat menghubungi layanan deteksi ISP.');
    } finally {
      setIspLoading(false);
    }
  };

  // ─── Mount ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const savedMode = localStorage.getItem('defaultConnectionMode');
    if (savedMode) setDefaultConnectionMode(savedMode);

    const savedAngle = getAngle();
    setServoAngle(savedAngle ?? INIT_ANGLE);

    const settings = getSettings();
    setMinAngle(settings.minAngle ?? 0);
    setMaxAngle(settings.maxAngle ?? 180);
    setDefaultAngle(settings.defaultAngle ?? INIT_ANGLE);

    detectISP();
    fetchEsp32IP(); // ambil IP ESP32 saat halaman dibuka

    // Poll IP ESP32 setiap 3 detik
    const poll = setInterval(fetchEsp32IP, 3000);

    const syncAngle = () => setServoAngle(getAngle() ?? INIT_ANGLE);
    window.addEventListener('servo-angle-updated', syncAngle);
    return () => {
      clearInterval(poll);
      window.removeEventListener('servo-angle-updated', syncAngle);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Servo ────────────────────────────────────────────────────────────────
  const sendServoAngle = async (angle) => {
    const parsed = parseInt(angle);
    saveAngle(parsed);
    setServoAngle(parsed);

    if (!esp32IP) {
      setServoStatus('❌ IP ESP32 belum terdeteksi, tunggu beberapa detik...');
      return;
    }

    try {
      const res  = await fetch(`/api/servo?angle=${parsed}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setServoStatus(`✅ Servo ke ${parsed}°`);
    } catch (err) {
      console.error(err);
      setServoStatus('❌ ESP32 tidak terhubung');
    }
  };

  // ─── Simpan pengaturan ────────────────────────────────────────────────────
  const saveSettings = () => {
    if (activeServer) persistServer(activeServer);
    localStorage.setItem('defaultConnectionMode', defaultConnectionMode);

    const validMin     = Math.max(0,       Math.min(parseInt(minAngle),    360));
    const validMax     = Math.max(validMin, Math.min(parseInt(maxAngle),    360));
    const validDefault = Math.max(validMin, Math.min(parseInt(defaultAngle), validMax));

    saveServoSettings({ minAngle: validMin, maxAngle: validMax, defaultAngle: validDefault });
    saveAngle(servoAngle);

    window.dispatchEvent(new CustomEvent('settings-updated'));
    setSaveMessage('Pengaturan berhasil disimpan!');
    setTimeout(() => setSaveMessage(''), 3000);
  };

  // ─── Reset semua data ─────────────────────────────────────────────────────
  const clearAllData = () => {
    if (!confirm('Apakah Anda yakin ingin menghapus semua data?')) return;
    ['speedTestHistory','selectedServerId','defaultConnectionMode',
     'servoAngle','servoAngleHistory','servoSettings','currentServoAngle']
      .forEach(k => localStorage.removeItem(k));
    clearAngleHistory();
    setDefaultConnectionMode('multi');
    setServoAngle(INIT_ANGLE);
    setMinAngle(DEFAULT_SETTINGS.minAngle ?? 0);
    setMaxAngle(DEFAULT_SETTINGS.maxAngle ?? 180);
    setDefaultAngle(INIT_ANGLE);
    setDetectedISP(null);
    setActiveServer(null);
    detectISP();
    window.dispatchEvent(new CustomEvent('settings-updated'));
    setSaveMessage('Semua data telah dihapus.');
    setTimeout(() => setSaveMessage(''), 3000);
  };

  // ─── UI ───────────────────────────────────────────────────────────────────
  return (
    <>
      <Head>
        <title>Pengaturan - My Speedtest</title>
        <meta name="description" content="Atur preferensi tes kecepatan internet Anda" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white">

        {/* ── Navbar ── */}
        <nav className="bg-white/10 backdrop-blur-md border-b border-white/20 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-2">
                <img src="/yagiwifi.png" alt="Logo" width={90} height={100} />
                <span className="text-xl font-bold text-white">SpeedTest</span>
              </div>
              <div className="hidden md:flex items-baseline space-x-4">
                <Link href="/" className="text-gray-300 hover:bg-white/10 hover:text-white px-3 py-2 rounded-md text-sm font-medium flex items-center">
                  <FiHome className="mr-2" /> Beranda
                </Link>
                <Link href="/history" className="text-gray-300 hover:bg-white/10 hover:text-white px-3 py-2 rounded-md text-sm font-medium flex items-center">
                  <FiClock className="mr-2" /> Riwayat
                </Link>
                <Link href="/settings" className="bg-blue-600 text-white px-3 py-2 rounded-md text-sm font-medium flex items-center">
                  <FiSettings className="mr-2" /> Pengaturan
                </Link>
              </div>
              <div className="md:hidden">
                <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="bg-white/10 inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white">
                  {mobileMenuOpen ? <FiX className="h-6 w-6" /> : <FiMenu className="h-6 w-6" />}
                </button>
              </div>
            </div>
          </div>
          {mobileMenuOpen && (
            <div className="md:hidden px-2 pt-2 pb-3 space-y-1 sm:px-3">
              <Link href="/" className="text-gray-300 hover:bg-white/10 block px-3 py-2 rounded-md text-base font-medium flex items-center">
                <FiHome className="mr-2" /> Beranda
              </Link>
              <Link href="/history" className="text-gray-300 hover:bg-white/10 block px-3 py-2 rounded-md text-base font-medium flex items-center">
                <FiClock className="mr-2" /> Riwayat
              </Link>
              <Link href="/settings" className="bg-blue-600 text-white block px-3 py-2 rounded-md text-base font-medium flex items-center">
                <FiSettings className="mr-2" /> Pengaturan
              </Link>
            </div>
          )}
        </nav>

        <main className="px-4 py-8">
          <div className="max-w-4xl mx-auto">

            <div className="mb-8">
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <FiSettings className="text-blue-400" /> Pengaturan
              </h1>
              <p className="text-blue-200 mt-1">Atur preferensi untuk pengalaman tes yang lebih baik.</p>
            </div>

            {saveMessage && (
              <div className="mb-6 p-4 bg-green-500/20 border border-green-500/50 text-green-300 rounded-lg text-center">
                {saveMessage}
              </div>
            )}

            <div className="space-y-6">

              {/* ── Kontrol Servo ── */}
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <FiWifi className="text-blue-400" /> Kontrol Servo Antena
                </h2>

                {/* ✅ IP ESP32 dari wifi-stats, bukan hardcode */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm text-blue-200">IP ESP32:</span>
                  {esp32IP ? (
                    <span className={`text-sm font-bold ${esp32Online ? 'text-green-300' : 'text-yellow-300'}`}>
                      {esp32IP}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400 animate-pulse">Mendeteksi...</span>
                  )}
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${
                    esp32Online
                      ? 'bg-green-500/20 border-green-500/40 text-green-300'
                      : 'bg-red-500/20 border-red-500/40 text-red-300'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${esp32Online ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
                    {esp32Online ? 'Online' : 'Offline'}
                  </span>
                </div>

                <p className="mb-3">
                  Sudut Aktif: <b className="text-yellow-300">{servoAngle}°</b>
                  <span className="ml-2 text-xs text-yellow-300 bg-yellow-500/20 border border-yellow-500/30 px-2 py-0.5 rounded-full">
                    Aktif & Tersimpan
                  </span>
                </p>
                <input
                  type="range" min={minAngle} max={maxAngle} value={servoAngle}
                  onChange={(e) => sendServoAngle(e.target.value)}
                  className="w-full accent-yellow-400"
                />
                <div className="mt-4 grid grid-cols-6 gap-2">
                  {[0, 30, 60, 90, 120, 180].map((angle) => (
                    <button key={angle} onClick={() => sendServoAngle(angle)}
                      className={`py-2 rounded-lg font-semibold text-sm transition-all ${
                        servoAngle === angle ? 'bg-yellow-500 text-black' : 'bg-white/10 hover:bg-white/20 text-white'
                      }`}>
                      {angle}°
                    </button>
                  ))}
                </div>
                {servoStatus && (
                  <p className={`mt-3 text-sm ${servoStatus.startsWith('✅') ? 'text-green-300' : 'text-red-300'}`}>
                    {servoStatus}
                  </p>
                )}
              </div>

              {/* ── Batas & Default Sudut ── */}
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <FiSettings className="text-blue-400" /> Batas & Default Sudut Servo
                </h2>
                <p className="text-sm text-blue-200 mb-4">Pengaturan ini digunakan sebagai validasi di halaman utama.</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { label: 'Sudut Minimum (°)', value: minAngle,    set: setMinAngle,    min: 0,        max: maxAngle  },
                    { label: 'Sudut Maksimum (°)', value: maxAngle,   set: setMaxAngle,    min: minAngle, max: 180       },
                    { label: 'Sudut Default (°)',  value: defaultAngle, set: setDefaultAngle, min: minAngle, max: maxAngle },
                  ].map(({ label, value, set, min, max }) => (
                    <div key={label}>
                      <label className="text-xs text-blue-300 block mb-1">{label}</label>
                      <input type="number" min={min} max={max} value={value}
                        onChange={(e) => set(parseInt(e.target.value))}
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-blue-400 mt-3">
                  Slider di halaman utama akan dibatasi antara {minAngle}° – {maxAngle}°, dengan default {defaultAngle}°.
                </p>
              </div>

              {/* ── Server Tes ── */}
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
                <h2 className="text-xl font-semibold mb-1 flex items-center gap-2">
                  <FiServer className="text-blue-400" /> Server Tes
                </h2>
                <p className="text-sm text-blue-200 mb-4">
                  Server dipilih & disinkronkan otomatis berdasarkan provider jaringan Anda.
                </p>
                <div className="mb-3 p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="text-xs text-blue-300 mb-1">Provider Terdeteksi</p>
                      {ispLoading ? (
                        <p className="text-sm text-blue-200 animate-pulse flex items-center gap-2">
                          <FiRefreshCw className="animate-spin" /> Mendeteksi jaringan...
                        </p>
                      ) : ispError ? (
                        <p className="text-sm text-red-300">{ispError}</p>
                      ) : detectedISP ? (
                        <>
                          <p className="text-base font-bold text-green-300">{detectedISP.name}</p>
                          <p className="text-xs text-blue-300 mt-0.5">IP Publik: {detectedISP.ip}</p>
                        </>
                      ) : (
                        <p className="text-sm text-blue-300">Belum terdeteksi</p>
                      )}
                    </div>
                    <button onClick={detectISP} disabled={ispLoading}
                      className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-300 rounded-lg text-xs font-medium transition-all disabled:opacity-50">
                      <FiRefreshCw className={ispLoading ? 'animate-spin' : ''} />
                      Deteksi Ulang
                    </button>
                  </div>
                </div>
                <div className="flex justify-center my-1 text-blue-400 text-lg select-none">↓</div>
                <div className="p-4 rounded-xl bg-blue-500/15 border border-blue-400/40">
                  <p className="text-xs text-blue-300 mb-1">Server Aktif</p>
                  {ispLoading ? (
                    <p className="text-sm text-blue-200 animate-pulse">Mencocokkan server...</p>
                  ) : activeServer ? (
                    <>
                      <p className="text-base font-bold text-white">{activeServer.name}</p>
                      <p className="text-xs text-blue-300 mt-0.5">{activeServer.location} — {activeServer.ip}</p>
                    </>
                  ) : (
                    <p className="text-sm text-blue-300">Menunggu deteksi ISP...</p>
                  )}
                </div>
                <p className="text-xs text-green-400 mt-3">
                  ✅ Server diperbarui otomatis setiap kali halaman ini dibuka.
                </p>
              </div>

              {/* ── Manajemen Data ── */}
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <FiTrash2 className="text-red-400" /> Manajemen Data
                </h2>
                <p className="text-sm text-blue-200 mb-4">Hapus semua riwayat tes dan kembalikan pengaturan ke default.</p>
                <button onClick={clearAllData}
                  className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-300 rounded-lg font-medium transition-all flex items-center gap-2">
                  <FiTrash2 /> Hapus Semua Data
                </button>
              </div>

              {/* ── Tentang ── */}
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <FiInfo className="text-blue-400" /> Tentang
                </h2>
                <div className="text-sm text-blue-200 space-y-1">
                  <p><b>My Speedtest</b></p>
                  <p>Versi 1.0.0</p>
                  <p>Layanan online yang dirancang untuk mengukur kecepatan unduh, kecepatan unggah, dan ping dari koneksi internet, yang digunakan untuk mengetahui kualitas dan performa jaringan, serta dilengkapi dengan fitur pengontrolan antena untuk mengoptimalkan arah dan kekuatan sinyal.</p>
                </div>
              </div>

            </div>

            <div className="mt-8 text-center">
              <button onClick={saveSettings}
                className="px-8 py-3 bg-blue-500 hover:bg-blue-600 rounded-xl font-semibold transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2 mx-auto">
                <FiSave /> Simpan Pengaturan
              </button>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}