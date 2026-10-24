// pages/history.js
import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import {
  FiHome, FiClock, FiDownload, FiUpload, FiActivity,
  FiTrash2, FiServer, FiArrowLeft, FiWifi, FiSettings, FiMenu, FiX
} from 'react-icons/fi';

// ✅ DITAMBAHKAN: import helper terpusat
import { getAngleHistory, clearAngleHistory } from '../lib/servoStorage';

export default function History() {
  const [history, setHistory] = useState([]);

  // ✅ DITAMBAHKAN: state untuk riwayat perubahan sudut servo
  const [angleHistory, setAngleHistory] = useState([]);

  // ✅ DITAMBAHKAN: tab aktif ('speed' atau 'servo')
  const [activeTab, setActiveTab] = useState('speed');

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Riwayat speed test (sudah ada sebelumnya)
      const savedHistory = JSON.parse(localStorage.getItem('speedTestHistory')) || [];
      setHistory(savedHistory);

      // ✅ DITAMBAHKAN: Baca riwayat sudut servo
      setAngleHistory(getAngleHistory());
    }

    // ✅ DITAMBAHKAN: Sinkron saat sudut berubah dari halaman lain
    const syncAngleHistory = () => {
      setAngleHistory(getAngleHistory());
    };
    window.addEventListener('servo-angle-updated', syncAngleHistory);

    return () => {
      window.removeEventListener('servo-angle-updated', syncAngleHistory);
    };
  }, []);

  const clearHistory = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('speedTestHistory');
      setHistory([]);
    }
  };

  // ✅ DITAMBAHKAN: hapus riwayat sudut servo
  const handleClearAngleHistory = () => {
    clearAngleHistory();
    setAngleHistory([]);
  };

  return (
    <>
      <Head>
        <title>Riwayat Tes - My Speedtest</title>
        <meta name="description" content="Lihat riwayat tes kecepatan internet Anda" />
        <link rel="preconnect" href="[fonts.googleapis.com](https://fonts.googleapis.com)" />
        <link rel="preconnect" href="[fonts.gstatic.com](https://fonts.gstatic.com)" crossOrigin="true" />
        <link href="[fonts.googleapis.com](https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap)" rel="stylesheet" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white">
        {/* Navbar — tidak ada perubahan */}
        <nav className="bg-white/10 backdrop-blur-md border-b border-white/20 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center">
                <div className="flex-shrink-0 flex items-center">
                  <img src="/yagiwifi.png" alt="Logo" width={90} height={100} />
                  <span className="text-xl font-bold text-white">SpeedTest</span>
                </div>
              </div>
              <div className="hidden md:block">
                <div className="ml-10 flex items-baseline space-x-4">
                  <Link href="/" className="text-gray-300 hover:bg-white/10 hover:text-white px-3 py-2 rounded-md text-sm font-medium flex items-center">
                    <FiHome className="mr-2" /> Beranda
                  </Link>
                  <Link href="/history" className="bg-blue-600 text-white px-3 py-2 rounded-md text-sm font-medium flex items-center">
                    <FiClock className="mr-2" /> Riwayat
                  </Link>
                  <Link href="/settings" className="text-gray-300 hover:bg-white/10 hover:text-white px-3 py-2 rounded-md text-sm font-medium flex items-center">
                    <FiSettings className="mr-2" /> Pengaturan
                  </Link>
                </div>
              </div>
              <div className="md:hidden">
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="bg-white/10 inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white"
                >
                  {mobileMenuOpen ? <FiX className="block h-6 w-6" /> : <FiMenu className="block h-6 w-6" />}
                </button>
              </div>
            </div>
          </div>
          {mobileMenuOpen && (
            <div className="md:hidden">
              <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
                <Link href="/" className="text-gray-300 hover:bg-white/10 hover:text-white block px-3 py-2 rounded-md text-base font-medium flex items-center">
                  <FiHome className="mr-2" /> Beranda
                </Link>
                <Link href="/history" className="bg-blue-600 text-white block px-3 py-2 rounded-md text-base font-medium flex items-center">
                  <FiClock className="mr-2" /> Riwayat
                </Link>
                <Link href="/settings" className="text-gray-300 hover:bg-white/10 hover:text-white block px-3 py-2 rounded-md text-base font-medium flex items-center">
                  <FiSettings className="mr-2" /> Pengaturan
                </Link>
              </div>
            </div>
          )}
        </nav>

        <main className="px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold flex items-center gap-2">
                  <FiClock className="text-blue-400" /> Riwayat Tes
                </h1>
                <p className="text-blue-200 mt-1">Lihat hasil tes kecepatan dan riwayat sudut antena.</p>
              </div>
              <Link href="/" className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg font-semibold transition-all flex items-center gap-2">
                <FiArrowLeft /> Tes Lagi
              </Link>
            </div>

            {/* ✅ DITAMBAHKAN: Tab pilih jenis riwayat */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setActiveTab('speed')}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                  activeTab === 'speed' ? 'bg-blue-600 text-white' : 'bg-white/10 hover:bg-white/20 text-blue-200'
                }`}
              >
                📶 Speed Test ({history.length})
              </button>
              <button
                onClick={() => setActiveTab('servo')}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                  activeTab === 'servo' ? 'bg-yellow-600 text-white' : 'bg-white/10 hover:bg-white/20 text-blue-200'
                }`}
              >
                📡 Sudut Antena ({angleHistory.length})
              </button>
            </div>

            {/* ✅ TAB: Riwayat Speed Test (tidak ada perubahan isi card) */}
            {activeTab === 'speed' && (
              history.length > 0 ? (
                <div className="space-y-4">
                  {history.map((result) => (
                    <div key={result.id} className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <p className="text-xs text-blue-300">{result.date}</p>
                          <p className="text-sm text-blue-200 flex items-center gap-1 mt-1">
                            <FiServer className="text-xs" />
                            {result.server.name} ({result.server.location})
                          </p>
                        </div>
                        {result.servoAngle !== undefined && (
                          <div className="flex items-center gap-1 bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 text-xs font-semibold px-3 py-1 rounded-full">
                            <FiWifi className="text-xs" /> Antena {result.servoAngle}°
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                        <div>
                          <p className="text-xs text-blue-300 mb-1">Download</p>
                          <p className="text-lg font-semibold text-green-400">{result.download} <span className="text-xs font-normal">Mbps</span></p>
                        </div>
                        <div>
                          <p className="text-xs text-blue-300 mb-1">Upload</p>
                          <p className="text-lg font-semibold text-blue-400">{result.upload} <span className="text-xs font-normal">Mbps</span></p>
                        </div>
                        <div>
                          <p className="text-xs text-blue-300 mb-1">Ping</p>
                          <p className="text-lg font-semibold">{result.ping} <span className="text-sm font-normal text-blue-200">ms</span></p>
                        </div>
                        <div>
                          <p className="text-xs text-blue-300 mb-1">Jitter</p>
                          <p className="text-lg font-semibold">{result.jitter} <span className="text-sm font-normal text-blue-200">ms</span></p>
                        </div>
                        <div>
                          <p className="text-xs text-blue-300 mb-1">Sudut Antena</p>
                          <p className="text-lg font-semibold text-yellow-400">
                            {result.servoAngle !== undefined ? result.servoAngle : '-'}
                            <span className="text-xs font-normal text-blue-200"> °</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="text-center mt-8">
                    <button onClick={clearHistory} className="px-6 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-300 rounded-lg font-medium transition-all flex items-center gap-2 mx-auto">
                      <FiTrash2 /> Hapus Semua Riwayat Speed Test
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-20">
                  <FiClock className="w-16 h-16 text-blue-400/50 mx-auto mb-4" />
                  <h2 className="text-2xl font-semibold text-blue-200">Belum Ada Riwayat</h2>
                  <p className="text-blue-300 mt-2">Anda belum melakukan tes kecepatan.</p>
                  <Link href="/" className="inline-block mt-6 px-6 py-3 bg-blue-500 hover:bg-blue-600 rounded-xl font-semibold transition-all">
                    Mulai Tes Sekarang
                  </Link>
                </div>
              )
            )}

            {/* ✅ DITAMBAHKAN: TAB riwayat perubahan sudut servo */}
            {activeTab === 'servo' && (
              angleHistory.length > 0 ? (
                <div className="space-y-3">
                  {angleHistory.map((entry) => (
                    <div key={entry.id} className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FiWifi className="text-yellow-400 text-xl" />
                        <div>
                          <p className="text-sm font-semibold text-yellow-300">
                            Antena diputar ke <span className="text-lg">{entry.angle}°</span>
                          </p>
                          <p className="text-xs text-blue-300 mt-0.5">{entry.date}</p>
                        </div>
                      </div>
                      {/* Indikator visual sudut */}
                      <div className="w-12 h-12 rounded-full border-2 border-yellow-500/40 flex items-center justify-center bg-yellow-500/10 flex-shrink-0">
                        <span className="text-xs font-bold text-yellow-300">{entry.angle}°</span>
                      </div>
                    </div>
                  ))}
                  <div className="text-center mt-8">
                    <button onClick={handleClearAngleHistory} className="px-6 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-300 rounded-lg font-medium transition-all flex items-center gap-2 mx-auto">
                      <FiTrash2 /> Hapus Riwayat Sudut Antena
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-20">
                  <FiWifi className="w-16 h-16 text-yellow-400/50 mx-auto mb-4" />
                  <h2 className="text-2xl font-semibold text-blue-200">Belum Ada Riwayat Sudut</h2>
                  <p className="text-blue-300 mt-2">Ubah sudut antena dari halaman utama atau pengaturan.</p>
                </div>
              )
            )}
          </div>
        </main>
      </div>
    </>
  );
}
