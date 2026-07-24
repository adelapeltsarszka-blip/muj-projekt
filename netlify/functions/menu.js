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

    const buffer = await res.arrayBuffer();
    // menicka.cz nyní posílá obsah v UTF-8
    const html = new TextDecoder('utf-8').decode(buffer);

    /* Vyčistí text: HTML entity, emoji a sjednocení mezer/nových řádků */
    const cleanText = (s) =>
      s
        .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(parseInt(code)))
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .replace(/(\d),\s(\d)/g, '$1,$2')  // "0, 2 l" → "0,2 l"
        .trim();

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
      soups.push({ name: cleanText(m[1]), price: cleanText(m[2]) });
    }

    /* --- hlavní jídla -------------------------------------------------- */
    const mains = [];
    const mainRe =
      /<li class='jidlo'>\s*<div class='polozka'>([\s\S]*?)<\/div>\s*<div class='cena'>([^<]*)<\/div>/g;
    while ((m = mainRe.exec(section)) !== null) {
      const name = cleanText(
        m[1]
          .replace(/<span class='poradi'>[^<]*<\/span>/g, '')
          .replace(/^\s*\d+\.\s*/, '')  // záloha: odstraní "7. " pokud zůstalo mimo span
      );
      mains.push({ name, price: cleanText(m[2]) });
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
