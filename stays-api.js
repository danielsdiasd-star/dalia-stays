/**
 * stays-api.js
 *
 * Cliente para a API do Stays.net via proxy Netlify.
 * Normaliza os dados do formato Stays → formato interno do painel.
 *
 * Uso:
 *   import { getListings, getReservations, getOwnerBalance } from './stays-api.js';
 */

const PROXY = '/.netlify/functions/stays-proxy';

// ─── Busca de dados ────────────────────────────────────────────────────────────

export async function getListings() {
  const res = await fetch(`${PROXY}?endpoint=/external/v1/booking/listings`);
  if (!res.ok) throw new Error(`listings: HTTP ${res.status}`);
  return res.json();
}

export async function getReservations(dateFrom, dateTo) {
  const params = new URLSearchParams({
    endpoint: '/external/v1/booking/reservations',
    dateFrom,
    dateTo,
  });
  const res = await fetch(`${PROXY}?${params}`);
  if (!res.ok) throw new Error(`reservations: HTTP ${res.status}`);
  return res.json();
}

export async function getOwnerBalance() {
  const res = await fetch(`${PROXY}?endpoint=/external/v1/owner/balance`);
  if (!res.ok) throw new Error(`balance: HTTP ${res.status}`);
  return res.json();
}

// ─── Normalização: Stays → formato interno ────────────────────────────────────

const STATUS_MAP = {
  confirmed:    'confirmada',
  pending:      'pendente',
  checked_in:   'checkin_feito',
  check_in:     'checkin_feito',
  checked_out:  'checkout_feito',
  check_out:    'checkout_feito',
  cancelled:    'cancelada',
  canceled:     'cancelada',
};

export function normalizeListings(rawList) {
  return rawList.map((l) => ({
    id:          l._id,
    nome:        l.publicDescription?.name || l.internalName || l._id,
    cidade:      l.address?.city   || '—',
    estado:      l.address?.state  || '—',
    quartos:     l.bedrooms        || 1,
    capacidade:  l.accommodates    || 2,
    diaria_base: l.prices?.basePrice || 0,
    plataformas: (l.channellistings || []).map((c) => c.channel).filter(Boolean),
    ativo:       true,
    // campos extras para compatibilidade
    proprietario_id: 'stays',
  }));
}

export function normalizeReservations(rawList, imoveis) {
  // Monta lookup id → nome do imóvel
  const imovelMap = {};
  imoveis.forEach((im) => { imovelMap[im.id] = im; });

  return rawList.map((r) => {
    const checkin  = r.checkIn  || r.checkin  || '';
    const checkout = r.checkOut || r.checkout || '';
    const noites   = r.nights   || r.noites   || calcNights(checkin, checkout);
    const bruto    = +(r.totalPrice || r.valor_total || 0);
    const repasse  = +(r.ownerPayout || r.repasse_proprietario || bruto * 0.85);
    const comissao = +(r.channelFee || r.comissao_dalia || bruto - repasse);
    const imovelId = r.listingId || r.imovel_id || '';
    const imovelObj = imovelMap[imovelId] || null;

    return {
      id:                   r._id || r.id || String(Math.random()),
      imovel_id:            imovelId,
      proprietario_id:      'stays',
      nome_hospede:         r.guestName || r.nome_hospede || 'Hóspede',
      checkin,
      checkout,
      noites,
      valor_total:          bruto,
      repasse_proprietario: repasse,
      comissao_dalia:       comissao,
      plataforma:           normalizePlataforma(r.channel || r.plataforma),
      status:               STATUS_MAP[r.status] || r.status || 'confirmada',
      // campo de join esperado pelos renders
      imoveis: imovelObj
        ? { nome: imovelObj.nome, cidade: imovelObj.cidade }
        : { nome: '—', cidade: '—' },
    };
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcNights(checkin, checkout) {
  if (!checkin || !checkout) return 0;
  const ms = new Date(checkout + 'T12:00:00') - new Date(checkin + 'T12:00:00');
  return Math.max(0, Math.round(ms / 86400000));
}

function normalizePlataforma(raw) {
  if (!raw) return 'outro';
  const r = raw.toLowerCase();
  if (r.includes('airbnb'))  return 'airbnb';
  if (r.includes('booking')) return 'booking';
  if (r.includes('vrbo') || r.includes('homeaway')) return 'vrbo';
  if (r.includes('direct') || r.includes('direto')) return 'direto';
  return 'outro';
}
