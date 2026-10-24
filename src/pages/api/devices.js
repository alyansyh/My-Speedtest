// pages/api/devices.js
import { exec } from 'child_process';

export default async function handler(req, res) {
  try {
    // Jalankan perintah ARP (Windows)
    exec('arp -a', (error, stdout, stderr) => {
      if (error) {
        console.error('Error exec:', error);
        return res.status(500).json({ error: 'Gagal membaca data jaringan' });
      }

      // Pisah baris dan ambil baris yang berisi alamat IP
      const lines = stdout.split('\n').filter(line => line.includes('.'));
      const deviceCount = lines.length;

      res.status(200).json({ devices: deviceCount });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Terjadi kesalahan sistem' });
  }
}
