// pages/index.js
import { SERVERS } from '../lib/servers';
import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import {
  FiWifi, FiDownload, FiUpload, FiActivity, FiLoader,
  FiRefreshCw, FiServer, FiMenu, FiX, FiHome, FiClock,
  FiSettings,
} from 'react-icons/fi';

import { saveAngle, getAngle, getSettings } from '../lib/servoStorage';

function calcSignalStrength(angle, minAngle, maxAngle) {
  const optimalAngle = (minAngle + maxAngle) / 2;
  const halfRange    = (maxAngle - minAngle) / 2;
  if (halfRange === 0) return 1.0;
  const delta = angle - optimalAngle;
  const sigma = halfRange * 0.5;
  return Math.max(0, Math.min(1, Math.exp(-(delta * delta) / (2 * sigma * sigma))));
}

function calcNetworkMetrics(strength) {
  const signal       = Math.round(10 + strength * 90);
  const rssi         = Math.round(-95 + strength * 65);
  const rateFactor   = Math.pow(strength, 1.5);
  const receiveRate  = Math.round(10 + rateFactor * 856);
  const transmitRate = Math.round(receiveRate * 0.85);
  return { signal, rssi, receiveRate, transmitRate };
}

function getActiveServer() {
  if (typeof window === 'undefined') return SERVERS[0];
  const savedId = localStorage.getItem('selectedServerId');
  if (!savedId) return SERVERS[0];
  return SERVERS.find(s => s.id === Number(savedId)) ?? SERVERS[0];
}

function Esp32Badge({ status, staleMs, esp32IP, clientIP }) {
  const cfgMap = {
    online:     { dot: 'bg-green-400 animate-pulse',  wrap: 'bg-green-500/20  border-green-500/40  text-green-300'  },
    connecting: { dot: 'bg-yellow-400 animate-pulse', wrap: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300' },
    offline:    { dot: 'bg-red-400',                  wrap: 'bg-red-500/20    border-red-500/40    text-red-300'    },
  };
  const cfg   = cfgMap[status] ?? cfgMap.offline;
  const label = status === 'online'
    ? `ESP32 Online (${Math.round((staleMs ?? 0) / 1000)}s ago)`
    : status === 'connecting'
    ? 'ESP32 Connecting…'
    : 'ESP32 Offline — Fallback Mode';

  return (
    <div className="flex flex-col items-end gap-1 mb-3">
      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border transition-all ${cfg.wrap}`}>
        <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
        {label}
      </span>
      {(esp32IP || clientIP) && (
        <span className="text-[10px] text-blue-400 flex gap-3">
          {esp32IP  && <span>ESP32: <b className="text-white">{esp32IP}</b></span>}
          {clientIP && <span>Anda: <b className="text-white">{clientIP}</b></span>}
          {esp32IP && clientIP && (
            <span className={status === 'online' ? 'text-green-400' : 'text-red-400'}>
              {status === 'online' ? '✓ Satu subnet' : '✗ Beda jaringan / offline'}
            </span>
          )}
        </span>
      )}
    </div>
  );
}

export default function InternetSpeedTest() {
  const [isTesting, setIsTesting]   = useState(false);
  const [testPhase, setTestPhase]   = useState('idle');
  const [results,   setResults]     = useState(null);
  const [liveSpeed, setLiveSpeed]   = useState(0);
  const [linkStats, setLinkStats]   = useState(null);

  const [servoAngle,    setServoAngle]    = useState(null);
  const [servoSettings, setServoSettings] = useState(getSettings());

  const [esp32Data,    setEsp32Data]    = useState(null);
  const [esp32Online,  setEsp32Online]  = useState(false);
  const [esp32StaleMs, setEsp32StaleMs] = useState(null);

  const [esp32Status, setEsp32Status] = useState('connecting');
  const [clientIP,    setClientIP]    = useState(null);
  const [esp32IP,     setEsp32IP]     = useState(null);

  const [serverInfo,     setServerInfo]     = useState(SERVERS[0]);
  const [connectionMode, setConnectionMode] = useState('multi');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const intervalRef    = useRef(null);
  const pollRef        = useRef(null);
  const esp32OnlineRef = useRef(false);
  // ✅ Tandai apakah ESP32 sudah pernah berhasil connect sejak page load
  const everOnlineRef  = useRef(false);

  const updateLinkStatsFromServo = (angle, settings) => {
    if (angle === null || angle === undefined) return;
    const strength = calcSignalStrength(
      angle,
      settings?.minAngle ?? 0,
      settings?.maxAngle ?? 180
    );
    setLinkStats(calcNetworkMetrics(strength));
  };

  const fetchWifiStats = async () => {
    try {
      const res  = await fetch('/api/wifi-stats');
      const data = await res.json();

      setClientIP(data.clientIP ?? null);
      setEsp32IP(data.esp32IP   ?? null);

      if (!data.available) {
        setEsp32Online(false);
        // ✅ Hanya pakai fallback jika belum pernah online sama sekali
        if (!everOnlineRef.current) {
          setEsp32Status('offline');
          updateLinkStatsFromServo(getAngle(), getSettings());
        } else {
          setEsp32Status('offline');
        }
        esp32OnlineRef.current = false;
        return;
      }

      const fresh   = data.staleMs < 10_000;
      const sameNet = data.sameSubnet === true;

      setEsp32StaleMs(data.staleMs);

      if (fresh && sameNet) {
        setEsp32Online(true);
        setEsp32Status('online');
        esp32OnlineRef.current = true;
        everOnlineRef.current  = true;   // ✅ Tandai sudah pernah online
        setEsp32Data(data);

        setLinkStats({
          signal:       data.signal       != null ? data.signal       : null,
          rssi:         data.rssi         != null ? data.rssi         : null,
          receiveRate:  data.receiveRate  != null ? Math.round(data.receiveRate)  : null,
          transmitRate: data.transmitRate != null ? Math.round(data.transmitRate) : null,
        });

        if (data.angleH != null) setServoAngle(data.angleH);

      } else {
        setEsp32Online(false);
        setEsp32Status('offline');
        esp32OnlineRef.current = false;
        setEsp32Data(null);
        // ✅ Hanya fallback ke servo jika belum pernah dapat data ESP32
        if (!everOnlineRef.current) {
          updateLinkStatsFromServo(getAngle(), getSettings());
        }
      }

    } catch (err) {
      console.error('[wifi-stats poll]', err);
      setEsp32Online(false);
      setEsp32Status('offline');
      esp32OnlineRef.current = false;
      if (!everOnlineRef.current) {
        updateLinkStatsFromServo(getAngle(), getSettings());
      }
    }
  };

  useEffect(() => {
    const initialAngle    = getAngle();
    const initialSettings = getSettings();
    setServoAngle(initialAngle);
    setServoSettings(initialSettings);
    // ✅ Jangan set fallback dulu, tunggu hasil fetch pertama
    // updateLinkStatsFromServo hanya dipanggil jika ESP32 benar-benar offline

    fetchWifiStats();
    pollRef.current = setInterval(fetchWifiStats, 3000);

    const loadSettings = () => {
      setServerInfo(getActiveServer());
      const savedMode = localStorage.getItem('defaultConnectionMode');
      if (savedMode) setConnectionMode(savedMode);
      setServoSettings(getSettings());
    };
    loadSettings();

    const syncAngle = () => {
      const freshAngle    = getAngle();
      const freshSettings = getSettings();
      setServoAngle(freshAngle);
      if (!esp32OnlineRef.current) updateLinkStatsFromServo(freshAngle, freshSettings);
    };

    window.addEventListener('settings-updated',    loadSettings);
    window.addEventListener('servo-angle-updated', syncAngle);

    return () => {
      clearInterval(pollRef.current);
      window.removeEventListener('settings-updated',    loadSettings);
      window.removeEventListener('servo-angle-updated', syncAngle);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAngleChange = async (rawAngle) => {
    const settings = getSettings();
    const clamped  = Math.min(Math.max(parseInt(rawAngle), settings.minAngle), settings.maxAngle);
    saveAngle(clamped);
    setServoAngle(clamped);
    try {
      const res = await fetch(`/api/servo?angle=${clamped}`);
      if (!res.ok) throw new Error('ESP32 error');
    } catch (err) {
      console.error('ESP32 tidak terhubung:', err);
    }
  };

  const saveTestResult = (result) => {
    if (typeof window === 'undefined') return;
    const history   = JSON.parse(localStorage.getItem('speedTestHistory') || '[]');
    const newResult = { ...result, id: Date.now(), date: new Date().toLocaleString('id-ID') };
    history.unshift(newResult);
    localStorage.setItem('speedTestHistory', JSON.stringify(history.slice(0, 50)));
  };

  const runSpeedTest = async () => {
    if (isTesting) return;
    setIsTesting(true); setTestPhase('ping'); setLiveSpeed(0); setResults(null);

    await new Promise(r => setTimeout(r, 1500));
    setTestPhase('download');
    let dl = 0;
    intervalRef.current = setInterval(() => { dl += Math.random() * 2 + 1; setLiveSpeed(dl.toFixed(2)); }, 100);
    await new Promise(r => setTimeout(r, 4000));
    clearInterval(intervalRef.current);
    const finalDl = 30 + Math.random() * 20;

    setTestPhase('upload');
    let ul = 0;
    intervalRef.current = setInterval(() => { ul += Math.random() * 1 + 0.5; setLiveSpeed(ul.toFixed(2)); }, 150);
    await new Promise(r => setTimeout(r, 3000));
    clearInterval(intervalRef.current);
    const finalUl = 5 + Math.random() * 10;

    setTestPhase('complete'); setLiveSpeed(0);
    const mockResults = {
      download: finalDl.toFixed(2), upload: finalUl.toFixed(2),
      ping:   (30 + Math.random() * 10).toFixed(0),
      jitter: (1  + Math.random() * 1).toFixed(1),
      server: serverInfo, servoAngle: getAngle(),
    };
    setResults(mockResults); setIsTesting(false); setTestPhase('idle');
    saveTestResult(mockResults);
  };

  const resetTest    = () => { setResults(null); setTestPhase('idle'); setLiveSpeed(0); };
  const getPhaseText = () => ({ ping:'Mengukur Latensi...', download:'Mengukur Kecepatan Unduh...', upload:'Mengukur Kecepatan Unggah...', complete:'Tes Selesai!' }[testPhase] ?? 'Siap untuk Tes');
  const getPhaseIcon = () => ({ ping:<FiActivity className="w-6 h-6 md:w-8 md:h-8"/>, download:<FiDownload className="w-6 h-6 md:w-8 md:h-8"/>, upload:<FiUpload className="w-6 h-6 md:w-8 md:h-8"/> }[testPhase] ?? <FiWifi className="w-6 h-6 md:w-8 md:h-8"/>);

  return (
    <>
      <Head>
        <title>My Speedtest</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white">

        {/* ── Navbar ── */}
        <nav className="bg-white/10 backdrop-blur-md border-b border-white/20 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-2">
                <img src="/yagiwifi.png" alt="Logo" width={90} height={100} />
                <span className="text-lg sm:text-xl font-bold text-white">SpeedTest</span>
              </div>
              <div className="hidden md:flex items-baseline space-x-4">
                <Link href="/" className="bg-blue-600 text-white px-3 py-2 rounded-md text-sm font-medium flex items-center"><FiHome className="mr-2" /> Beranda</Link>
                <Link href="/history" className="text-gray-300 hover:bg-white/10 px-3 py-2 rounded-md text-sm font-medium flex items-center"><FiClock className="mr-2" /> Riwayat</Link>
                <Link href="/settings" className="text-gray-300 hover:bg-white/10 px-3 py-2 rounded-md text-sm font-medium flex items-center"><FiSettings className="mr-2" /> Pengaturan</Link>
              </div>
              <div className="md:hidden">
                <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="bg-white/10 p-2 rounded-md text-gray-400 hover:text-white">
                  {mobileMenuOpen ? <FiX className="h-6 w-6" /> : <FiMenu className="h-6 w-6" />}
                </button>
              </div>
            </div>
          </div>
          {mobileMenuOpen && (
            <div className="md:hidden px-2 pt-2 pb-3 space-y-1">
              <Link href="/" className="bg-blue-600 text-white block px-3 py-2 rounded-md flex items-center"><FiHome className="mr-2" /> Beranda</Link>
              <Link href="/history" className="text-gray-300 block px-3 py-2 rounded-md flex items-center"><FiClock className="mr-2" /> Riwayat</Link>
              <Link href="/settings" className="text-gray-300 block px-3 py-2 rounded-md flex items-center"><FiSettings className="mr-2" /> Pengaturan</Link>
            </div>
          )}
        </nav>

        <header className="py-6 md:py-8 px-4">
          <div className="max-w-6xl mx-auto text-center">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-2">My Speedtest</h1>
            <p className="text-base sm:text-lg text-blue-200">Pantau performa internet Anda</p>
          </div>
        </header>

        <main className="px-4 pb-12 md:pb-20">
          <div className="max-w-4xl mx-auto">

            <div className="flex justify-end">
              <Esp32Badge
                status={esp32Status}
                staleMs={esp32StaleMs}
                esp32IP={esp32IP}
                clientIP={clientIP}
              />
            </div>

            {/* ── Server Info & WiFi Stats ── */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 sm:p-6 mb-6 md:mb-8 border border-white/20">
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 w-full">
                <div className="flex items-center gap-3 w-full lg:w-auto">
                  <FiServer className="text-blue-400 text-xl flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm text-blue-200">Server</p>
                    <p className="font-semibold text-sm sm:text-base truncate">{serverInfo.name}</p>
                    <p className="text-xs text-blue-300 truncate">{serverInfo.ip} • {serverInfo.location}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 w-full lg:w-auto">
                  {[
                    {
                      label: 'Receive Rate',
                      value: linkStats?.receiveRate  != null ? linkStats.receiveRate  : null,
                      unit:  linkStats?.receiveRate  != null ? 'Mbps' : '',
                    },
                    {
                      label: 'Transmit Rate',
                      value: linkStats?.transmitRate != null ? linkStats.transmitRate : null,
                      unit:  linkStats?.transmitRate != null ? 'Mbps' : '',
                    },
                    {
                      label: 'Signal',
                      value: linkStats?.signal != null ? `${linkStats.signal}%` : null,
                      unit:  '',
                    },
                    {
                      label: 'RSSI',
                      value: linkStats?.rssi != null ? linkStats.rssi : null,
                      unit:  'dBm',
                    },
                  ].map(({ label, value, unit }) => (
                    <div key={label} className="text-center">
                      <p className="text-[10px] sm:text-xs text-blue-200 mb-1">{label}</p>
                      <p className="text-lg sm:text-xl lg:text-2xl font-bold">
                        {value != null ? value : <FiLoader className="animate-spin inline text-sm" />}
                      </p>
                      <p className="text-[10px] sm:text-xs text-blue-300 mt-0.5">{unit || '\u00A0'}</p>
                    </div>
                  ))}
                </div>
              </div>

              {esp32Data && (
                <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap gap-x-6 gap-y-1 text-xs text-blue-300">
                  {esp32Data.angleH != null && <span>Antena : <b className="text-yellow-300">{esp32Data.angleH}°</b></span>}
                </div>
              )}
            </div>

            {/* ── Test Area ── */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 sm:p-8 md:p-12 border border-white/20">
              {!results ? (
                <div className="text-center">
                  <div className="relative inline-block mb-6 sm:mb-8">
                    {isTesting && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 rounded-full border-4 border-blue-400/30 animate-ping" />
                      </div>
                    )}
                    <button onClick={runSpeedTest} disabled={isTesting}
                      className={`relative w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 rounded-full font-bold text-4xl sm:text-5xl md:text-6xl transition-all transform ${
                        isTesting
                          ? 'bg-blue-600/20 border-4 border-blue-400 cursor-default'
                          : 'bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 hover:scale-105 active:scale-95 shadow-2xl'
                      }`}>
                      {isTesting ? (
                        <div className="flex flex-col items-center justify-center">
                          {getPhaseIcon()}
                          <span className="text-xl sm:text-2xl md:text-3xl mt-2 font-bold">
                            {(testPhase === 'download' || testPhase === 'upload') ? liveSpeed : ''}
                          </span>
                          <span className="text-[10px] sm:text-xs mt-1 font-normal">
                            {(testPhase === 'download' || testPhase === 'upload') ? 'Mbps' : ''}
                          </span>
                        </div>
                      ) : 'GO'}
                    </button>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-semibold mb-2">{getPhaseText()}</h2>
                  {isTesting && (
                    <div className="flex justify-center gap-2 mt-4">
                      {['ping', 'download', 'upload'].map(p => (
                        <div key={p} className={`w-2 h-2 rounded-full bg-blue-400 ${testPhase === p ? 'animate-pulse' : ''}`} />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center animate-fade-in">
                  {results.servoAngle !== undefined && (
                    <div className="inline-flex items-center gap-1 bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 text-xs font-semibold px-3 py-1 rounded-full mb-6">
                      <FiWifi className="text-xs" /> Antena {results.servoAngle}°
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 md:gap-8 mb-6">
                    <div className="bg-white/10 rounded-xl p-4 sm:p-6 border border-white/20">
                      <div className="flex items-center justify-center gap-2 mb-2 text-green-400">
                        <FiDownload className="text-xl sm:text-2xl" />
                        <span className="text-xs sm:text-sm font-medium">DOWNLOAD</span>
                      </div>
                      <p className="text-3xl sm:text-4xl md:text-5xl font-bold">{results.download}</p>
                      <p className="text-base sm:text-lg text-blue-200">Mbps</p>
                    </div>
                    <div className="bg-white/10 rounded-xl p-4 sm:p-6 border border-white/20">
                      <div className="flex items-center justify-center gap-2 mb-2 text-blue-400">
                        <FiUpload className="text-xl sm:text-2xl" />
                        <span className="text-xs sm:text-sm font-medium">UPLOAD</span>
                      </div>
                      <p className="text-3xl sm:text-4xl md:text-5xl font-bold">{results.upload}</p>
                      <p className="text-base sm:text-lg text-blue-200">Mbps</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
                    <div className="bg-white/5 rounded-xl p-3 sm:p-4 border border-white/10">
                      <p className="text-xs sm:text-sm text-blue-200 mb-1">Ping</p>
                      <p className="text-xl sm:text-2xl font-semibold">{results.ping} <span className="text-xs font-normal text-blue-200">ms</span></p>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3 sm:p-4 border border-white/10">
                      <p className="text-xs sm:text-sm text-blue-200 mb-1">Jitter</p>
                      <p className="text-xl sm:text-2xl font-semibold">{results.jitter} <span className="text-xs font-normal text-blue-200">ms</span></p>
                    </div>
                  </div>
                  <button onClick={resetTest}
                    className="px-6 sm:px-8 py-2.5 sm:py-3 bg-blue-500 hover:bg-blue-600 rounded-xl font-semibold transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2 mx-auto">
                    <FiRefreshCw /> Tes Lagi
                  </button>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      <style jsx>{`
        @keyframes fade-in { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .animate-fade-in { animation: fade-in 0.5s ease-out; }
      `}</style>
    </>
  );
}