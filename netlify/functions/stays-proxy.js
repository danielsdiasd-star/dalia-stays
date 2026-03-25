/**
 * stays-proxy.js — Netlify Function
 *
 * Proxy server-side para a API do Stays.net.
 * Resolve o problema de CORS e mantém as credenciais fora do frontend.
 *
 * Uso: /.netlify/functions/stays-proxy?endpoint=/external/v1/booking/listings
 *      /.netlify/functions/stays-proxy?endpoint=/external/v1/booking/reservations&dateFrom=2026-01-01&dateTo=2026-03-31
 *      /.netlify/functions/stays-proxy?endpoint=/external/v1/owner/balance
 *
 * Para ativar dados reais quando as credenciais estiverem corretas:
 *   Mude MOCK_MODE para false.
 */

const https = require('https');

// ─── Credenciais ───────────────────────────────────────────────────────────────
const STAYS_BASE  = 'dla.stays.net';
const CLIENT_ID   = '1e92700c';
const CLIENT_SECRET = '80761cdb';
const BASIC_TOKEN = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

// ─── Modo mock: true = sempre retorna dados simulados (credenciais inativas) ───
const MOCK_MODE   = true;

// ─── Mock data realista ────────────────────────────────────────────────────────
const MOCK_LISTINGS = [
  {
    _id: 'stays-imovel-001',
    publicDescription: { name: 'Apartamento Beira-Mar' },
    address: { city: 'Florianópolis', state: 'SC' },
    bedrooms: 2,
    accommodates: 5,
    prices: { basePrice: 380 },
    channellistings: [{ channel: 'airbnb' }, { channel: 'booking' }],
  },
  {
    _id: 'stays-imovel-002',
    publicDescription: { name: 'Casa com Piscina' },
    address: { city: 'Florianópolis', state: 'SC' },
    bedrooms: 3,
    accommodates: 8,
    prices: { basePrice: 620 },
    channellistings: [{ channel: 'airbnb' }, { channel: 'direto' }],
  },
];

const MOCK_RESERVATIONS = [
  // Janeiro/2026 — 3 reservas
  { _id: 'r01', listingId: 'stays-imovel-001', checkIn: '2026-01-05', checkOut: '2026-01-08', guestName: 'Ana Souza',     nights: 3, totalPrice: 1260, ownerPayout: 1050, channelFee: 210, status: 'checked_out', channel: 'airbnb'  },
  { _id: 'r02', listingId: 'stays-imovel-002', checkIn: '2026-01-10', checkOut: '2026-01-14', guestName: 'Carlos Lima',   nights: 4, totalPrice: 2480, ownerPayout: 2100, channelFee: 380, status: 'checked_out', channel: 'airbnb'  },
  { _id: 'r03', listingId: 'stays-imovel-001', checkIn: '2026-01-20', checkOut: '2026-01-24', guestName: 'Maria Oliveira',nights: 4, totalPrice: 1680, ownerPayout: 1400, channelFee: 280, status: 'checked_out', channel: 'booking' },
  // Fevereiro/2026 — 2 reservas
  { _id: 'r04', listingId: 'stays-imovel-002', checkIn: '2026-02-07', checkOut: '2026-02-11', guestName: 'Pedro Alves',   nights: 4, totalPrice: 2480, ownerPayout: 2100, channelFee: 380, status: 'checked_out', channel: 'airbnb'  },
  { _id: 'r05', listingId: 'stays-imovel-001', checkIn: '2026-02-14', checkOut: '2026-02-18', guestName: 'Julia Santos',  nights: 4, totalPrice: 1680, ownerPayout: 1400, channelFee: 280, status: 'checked_out', channel: 'direto'  },
  // Março/2026 — 3 reservas
  { _id: 'r06', listingId: 'stays-imovel-002', checkIn: '2026-03-01', checkOut: '2026-03-05', guestName: 'Bruno Costa',   nights: 4, totalPrice: 2480, ownerPayout: 2100, channelFee: 380, status: 'confirmed',   channel: 'airbnb'  },
  { _id: 'r07', listingId: 'stays-imovel-001', checkIn: '2026-03-15', checkOut: '2026-03-18', guestName: 'Fernanda Reis', nights: 3, totalPrice: 1260, ownerPayout: 1050, channelFee: 210, status: 'confirmed',   channel: 'booking' },
  { _id: 'r08', listingId: 'stays-imovel-002', checkIn: '2026-03-22', checkOut: '2026-03-26', guestName: 'Ricardo Nunes', nights: 4, totalPrice: 2480, ownerPayout: 2100, channelFee: 380, status: 'checked_in',  channel: 'airbnb'  },
];

const MOCK_BALANCE = {
  ownerId: 'stays-owner-001',
  totalRevenue: 15800,
  totalPayout: 13300,
  commission: 2500,
  currency: 'BRL',
};

// ─── Utilitário: chamada HTTPS ─────────────────────────────────────────────────
function staysRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: STAYS_BASE,
      path,
      method: 'GET',
      headers: {
        Authorization: `Basic ${BASIC_TOKEN}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(body)); } catch { resolve(body); }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

// ─── Handler principal ─────────────────────────────────────────────────────────
exports.handler = async function (event) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  const params  = event.queryStringParameters || {};
  const endpoint = params.endpoint || '';

  // Monta path com query strings extras (dateFrom, dateTo, etc.)
  const qs = Object.entries(params)
    .filter(([k]) => k !== 'endpoint')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  const fullPath = qs ? `${endpoint}?${qs}` : endpoint;

  // Determina mock baseado no endpoint
  function mockForEndpoint() {
    if (endpoint.includes('/listings'))     return MOCK_LISTINGS;
    if (endpoint.includes('/reservations')) return MOCK_RESERVATIONS;
    if (endpoint.includes('/balance'))      return MOCK_BALANCE;
    return { error: 'endpoint não mapeado', endpoint };
  }

  if (MOCK_MODE) {
    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'X-Data-Source': 'mock' },
      body: JSON.stringify(mockForEndpoint()),
    };
  }

  try {
    const data = await staysRequest(fullPath);
    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'X-Data-Source': 'live' },
      body: JSON.stringify(data),
    };
  } catch (err) {
    // Fallback para mock se a API real falhar
    console.error('[stays-proxy] API error, fallback to mock:', err.message);
    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'X-Data-Source': 'mock-fallback', 'X-Error': err.message },
      body: JSON.stringify(mockForEndpoint()),
    };
  }
};
