// lib/servers.js

export const SERVERS = [
  {
    id: 1,
    name: 'PT Telkom Indonesia',
    location: 'Makassar, Indonesia',
    ip: '192.168.8.100',
    // Kata kunci dari ip-api.com yang cocok dengan provider ini
    ispKeywords: ['telkom', 'telkomsel', 'indihome', 'tsel'],
  },
  {
    id: 2,
    name: 'PT Smartfren',
    location: 'Makassar, Indonesia',
    ip: '180.243.192.10',
    ispKeywords: ['smartfren', 'smart', 'fren'],
  },
  {
    id: 3,
    name: 'MyRepublic Indonesia',
    location: 'Makassar, Indonesia',
    ip: '103.10.150.20',
    ispKeywords: ['myrepublic', 'republic'],
  },
  {
    id: 4,
    name: 'PT Indosat Tbk',
    location: 'Makassar, Indonesia',
    ip: '10.104.77.239',
    ispKeywords: ['indosat', 'im3', 'ooredoo', 'hutchison', 'ioh'],
  },
];

/**
 * Cocokkan nama ISP dari ip-api.com dengan server yang tersedia.
 * Menggunakan ispKeywords agar matching tidak bergantung pada format nama ISP.
 * @param {string} ispName - Nama ISP dari ip-api.com (e.g. "PT. INDOSAT Tbk")
 * @returns {object|null} - Server yang cocok, atau null jika tidak ada
 */
export function matchServerByISP(ispName) {
  if (!ispName) return null;
  const lower = ispName.toLowerCase();

  // Cari server yang keywordnya muncul di nama ISP
  return SERVERS.find(server =>
    server.ispKeywords.some(kw => lower.includes(kw))
  ) || null;
}