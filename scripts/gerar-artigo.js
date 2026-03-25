#!/usr/bin/env node
/**
 * gerar-artigo.js
 * Gera um artigo SEO sobre aluguel por temporada usando Claude Haiku
 * e salva no Supabase na tabela "artigos".
 *
 * Uso: node scripts/gerar-artigo.js "Tema do artigo"
 *
 * Vars de ambiente necessárias:
 *   ANTHROPIC_API_KEY
 *   SUPABASE_URL
 *   SUPABASE_KEY
 */

const https = require('https');

// ── Helpers ──────────────────────────────────────────────────────────────────

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 80);
}

function estimateReadTime(html) {
  const words = html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  return Math.max(3, Math.round(words / 200));
}

function postJson(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = https.request(
      { hostname, path, method: 'POST', headers: { ...headers, 'Content-Length': Buffer.byteLength(payload) } },
      (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
          catch { resolve({ status: res.statusCode, body: data }); }
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ── Gerar artigo via Anthropic ────────────────────────────────────────────────

async function gerarArtigo(tema) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY não definida');

  const prompt = `Você é um especialista em mercado de aluguel por temporada (short-term rental / STR) no Brasil, com foco em investimentos imobiliários e revenue management.

Crie um artigo SEO completo sobre o tema: "${tema}"

O artigo deve:
- Ter entre 600 e 900 palavras
- Ser em português do Brasil, tom profissional e acessível
- Focar no mercado brasileiro (mencionar regiões como Rio de Janeiro, Cabo Frio, Florianópolis, Nordeste quando relevante)
- Ser otimizado para SEO com palavra-chave natural no texto

Responda APENAS com um JSON válido, sem texto antes ou depois, neste formato exato:
{
  "titulo": "Título do artigo (60-70 caracteres, inclui palavra-chave principal)",
  "meta_description": "Descrição para SEO (150-160 caracteres, CTA incluso)",
  "slug": "titulo-em-formato-slug-sem-acentos",
  "tempo_leitura": 5,
  "conteudo_html": "<p>Introdução...</p><h2>Subtítulo 1</h2><p>...</p><ul><li>...</li></ul><h2>Subtítulo 2</h2><p>...</p><h2>Conclusão</h2><p>...</p>"
}

O conteudo_html deve usar apenas: <p>, <h2>, <h3>, <ul>, <ol>, <li>, <strong>, <em>, <blockquote>.
NÃO inclua <html>, <body>, <head>, <style> ou qualquer outra tag.`;

  const res = await postJson(
    'api.anthropic.com',
    '/v1/messages',
    {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    {
      model: 'claude-haiku-3-5-20241022',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    }
  );

  if (res.status !== 200) {
    throw new Error(`Anthropic API error ${res.status}: ${JSON.stringify(res.body)}`);
  }

  const raw = res.body.content[0].text.trim();

  // Strip possible markdown fences
  const clean = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
  const artigo = JSON.parse(clean);

  // Ensure slug is clean
  artigo.slug = artigo.slug ? slugify(artigo.slug) : slugify(artigo.titulo);

  // Estimate read time from actual content
  artigo.tempo_leitura = estimateReadTime(artigo.conteudo_html);

  return artigo;
}

// ── Salvar no Supabase ────────────────────────────────────────────────────────

async function salvarNoSupabase(artigo) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;
  if (!supabaseUrl || !supabaseKey) throw new Error('SUPABASE_URL ou SUPABASE_KEY não definidas');

  const url = new URL(supabaseUrl);

  const payload = {
    slug:             artigo.slug,
    titulo:           artigo.titulo,
    meta_description: artigo.meta_description,
    conteudo_html:    artigo.conteudo_html,
    tempo_leitura:    artigo.tempo_leitura,
    publicado:        true,
  };

  const res = await postJson(
    url.hostname,
    '/rest/v1/artigos',
    {
      'Content-Type':  'application/json',
      'apikey':        supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Prefer':        'return=minimal',
    },
    payload
  );

  if (res.status === 409) {
    // Slug duplicado — adiciona sufixo com timestamp
    payload.slug = artigo.slug + '-' + Date.now().toString(36);
    const retry = await postJson(
      url.hostname,
      '/rest/v1/artigos',
      {
        'Content-Type':  'application/json',
        'apikey':        supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer':        'return=minimal',
      },
      payload
    );
    if (retry.status >= 300) {
      throw new Error(`Supabase INSERT error ${retry.status}: ${JSON.stringify(retry.body)}`);
    }
    return payload.slug;
  }

  if (res.status >= 300) {
    throw new Error(`Supabase INSERT error ${res.status}: ${JSON.stringify(res.body)}`);
  }

  return payload.slug;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const tema = process.argv[2];
  if (!tema) {
    console.error('Uso: node scripts/gerar-artigo.js "Tema do artigo"');
    process.exit(1);
  }

  console.log(`[gerar-artigo] Tema: "${tema}"`);
  console.log('[gerar-artigo] Gerando conteúdo com Claude Haiku…');

  const artigo = await gerarArtigo(tema);
  console.log(`[gerar-artigo] Título: ${artigo.titulo}`);
  console.log(`[gerar-artigo] Slug: ${artigo.slug}`);
  console.log(`[gerar-artigo] Leitura: ~${artigo.tempo_leitura} min`);

  console.log('[gerar-artigo] Salvando no Supabase…');
  const slug = await salvarNoSupabase(artigo);
  console.log(`[gerar-artigo] ✓ Artigo salvo com slug: ${slug}`);
  console.log(`[gerar-artigo] URL: https://daliastays.com/blog/artigo.html?slug=${encodeURIComponent(slug)}`);
}

main().catch(err => {
  console.error('[gerar-artigo] ERRO:', err.message);
  process.exit(1);
});
