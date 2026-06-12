/**
 * Netlify Serverless Function — Denní menu
 * Stáhne aktuální menu z menicka.cz a vrátí JSON jen pro DNEŠNÍ den.
 * URL: /.netlify/functions/menu
 */
exports.handler = async function () {
  const MENICKA_URL =
    'https://www.menicka.cz/7384-restaurace-a-bowling-smetanova.html';

  try {
    const res = await fetch(MENICKA_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RestauraceSmetanova/1.0)' },
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    // menicka.cz používá windows-1250 kódování
    const buffer = await res.arrayBuffer();
    const html = new TextDecoder('windows-1250').decode(buffer);

    /* --- dnešní datum v českém formátu (d.m.yyyy) -------------------- */
    const now = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'Europe/Prague' })
    );
    const todayStr = `${now.getDate()}.${now.getMonth() + 1}.${now.getFullYear()}`;
    const todayEsc = todayStr.replace(/\./g, '\\.');

    /* --- najdi sekci pro dnešní den ----------------------------------- */
    const dayBlocks = html.split("<div class='menicka'>");
    let section = html;
    const nadpisDateRe = new RegExp(`<div class='nadpis'>[^<]*${todayEsc}`);
    for (const block of dayBlocks) {
      if (nadpisDateRe.test(block)) {
        section = block;
        break;
      }
    }

    /* --- datum pro zobrazení ----------------------------------------- */
    let datum = '';
    const dateMatch = html.match(
      new RegExp(`<div class='nadpis'>([^<]*${todayEsc}[^<]*)`)
    );
    if (dateMatch) datum = dateMatch[1].trim();

    /* --- polévky ------------------------------------------------------- */
    const soups = [];
    const soupRe =
      /<li class='polevka'>\s*<div class='polozka'>([\s\S]*?)<\/div>\s*<div class='cena'>([^<]*)<\/div>/g;
    let m;
    while ((m = soupRe.exec(section)) !== null) {
      soups.push({ name: m[1].trim(), price: m[2].trim() });
    }

    /* --- hlavní jídla -------------------------------------------------- */
    const mains = [];
    const mainRe =
      /<li class='jidlo'>\s*<div class='polozka'>([\s\S]*?)<\/div>\s*<div class='cena'>([^<]*)<\/div>/g;
    while ((m = mainRe.exec(section)) !== null) {
      const name = m[1]
        .replace(/<span class='poradi'>[^<]*<\/span>/g, '')
        .replace(/^\s*\d+\.\s*/, '')  // záloha: odstraní "7. " pokud zůstalo mimo span
        .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(parseInt(code))) // emoji &#127829; → 🍕
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>') // ostatní entity
        .trim();
      mains.push({ name, price: m[2].trim() });
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store',
      },
      body: JSON.stringify({ datum, soups, mains }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
