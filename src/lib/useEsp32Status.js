// ─── lib/useEsp32Status.js ────────────────────────────────────────────────────
// Hook ini mengelola state koneksi ESP32 dengan 3 status:
//   'connecting' → sedang cek
//   'online'     → se-subnet, data fresh, direct ping OK
//   'offline'    → beda subnet / stale / ping gagal
//
// Cara pakai di index.js / settings.js:
//   import { useEsp32Status } from '../lib/useEsp32Status';
//   const { status, esp32Data, staleMs, clientIP, esp32IP } = useEsp32Status();

import { useState, useEffect, useRef, useCallback } from 'react';

export function useEsp32Status(pollIntervalMs = 3000) {
  const [status,   setStatus]   = useState('connecting'); // 'connecting'|'online'|'offline'
  const [esp32Data, setEsp32Data] = useState(null);
  const [staleMs,  setStaleMs]  = useState(null);
  const [clientIP, setClientIP] = useState(null);
  const [esp32IP,  setEsp32IP]  = useState(null);

  const pingRef    = useRef(null);
  const pollRef    = useRef(null);
  const mountedRef = useRef(true);

  // ── Direct ping ke ESP32 /status (hanya berjalan jika se-subnet) ──────────
  const pingEsp32 = useCallback(async (ip) => {
    if (!ip) return false;
    try {
      const res = await fetch(`http://${ip}/status`, {
        signal: AbortSignal.timeout(2000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }, []);

  // ── Polling /api/wifi-stats ────────────────────────────────────────────────
  const poll = useCallback(async () => {
    try {
      const res  = await fetch('/api/wifi-stats');
      const data = await res.json();

      if (!mountedRef.current) return;

      setClientIP(data.clientIP ?? null);
      setEsp32IP(data.esp32IP   ?? null);

      if (!data.available) {
        setStatus('offline');
        setEsp32Data(null);
        return;
      }

      setStaleMs(data.staleMs);

      // ── Syarat "online":
      //    1. data tidak stale (< 10 detik)
      //    2. client se-subnet dengan ESP32
      //    3. direct ping ke ESP32 berhasil
      const fresh     = data.staleMs < 10_000;
      const sameNet   = data.sameSubnet === true;

      if (!fresh || !sameNet) {
        setStatus('offline');
        setEsp32Data(null);
        return;
      }

      // Jalankan ping langsung ke ESP32 — validasi akhir
      const pingOk = await pingEsp32(data.esp32IP);
      if (!mountedRef.current) return;

      if (pingOk) {
        setStatus('online');
        setEsp32Data(data);
      } else {
        // Se-subnet tapi ping gagal → mungkin firewall / port 80 blok
        setStatus('offline');
        setEsp32Data(null);
      }

    } catch {
      if (mountedRef.current) setStatus('offline');
    }
  }, [pingEsp32]);

  useEffect(() => {
    mountedRef.current = true;
    setStatus('connecting');

    poll(); // segera saat mount
    pollRef.current = setInterval(poll, pollIntervalMs);

    return () => {
      mountedRef.current = false;
      clearInterval(pollRef.current);
      clearTimeout(pingRef.current);
    };
  }, [poll, pollIntervalMs]);

  return { status, esp32Data, staleMs, clientIP, esp32IP };
}


// ─── components/Esp32Badge.jsx ────────────────────────────────────────────────
// Komponen badge indikator visual 3 status.
//
// Cara pakai:
//   import Esp32Badge from '../components/Esp32Badge';
//   <Esp32Badge status={status} staleMs={staleMs} esp32IP={esp32IP} clientIP={clientIP} />

export function Esp32Badge({ status, staleMs, esp32IP, clientIP }) {
  const cfg = {
    connecting: {
      dot:   'bg-yellow-400 animate-pulse',
      badge: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300',
      label: 'Connecting…',
    },
    online: {
      dot:   'bg-green-400 animate-pulse',
      badge: 'bg-green-500/20 border-green-500/40 text-green-300',
      label: `Online${staleMs != null ? ` (${Math.round(staleMs / 1000)}s ago)` : ''}`,
    },
    offline: {
      dot:   'bg-red-400',
      badge: 'bg-red-500/20 border-red-500/40 text-red-300',
      label: 'Offline — Fallback Mode',
    },
  }[status] ?? {};

  return (
    <div className="flex flex-col items-end gap-1">
      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border ${cfg.badge}`}>
        <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
        ESP32 {cfg.label}
      </span>

      {/* Info subnet — hanya tampil jika ada data */}
      {(esp32IP || clientIP) && (
        <span className="text-[10px] text-blue-400 flex gap-3">
          {esp32IP  && <span>ESP32: <b className="text-white">{esp32IP}</b></span>}
          {clientIP && <span>Anda: <b className="text-white">{clientIP}</b></span>}
          {esp32IP && clientIP && (
            <span className={
              status === 'online' ? 'text-green-400' : 'text-red-400'
            }>
              {status === 'online' ? '✓ Satu subnet' : '✗ Beda jaringan'}
            </span>
          )}
        </span>
      )}
    </div>
  );
}
