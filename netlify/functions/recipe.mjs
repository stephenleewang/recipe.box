// Reads a recipe page and returns its structured recipe data.
// Most recipe sites publish a schema.org "Recipe" block (JSON-LD) for search engines;
// this function finds it and turns it into the shape the app expects.

const CATS = [
  [/dinner|main|entr[eé]e|supper/i, 'Dinner'],
  [/lunch/i, 'Lunch'],
  [/breakfast|brunch/i, 'Breakfast'],
  [/appetizer|snack|starter|finger food|dip/i, 'App/Snack'],
  [/side/i, 'Side'],
  [/sandwich|burger|wrap/i, 'Sandwich'],
  [/sauce|dressing|condiment|marinade/i, 'Sauce'],
  [/dessert|cake|cookie|pie|sweet|baking/i, 'Dessert'],
  [/drink|beverage|cocktail|smoothie/i, 'Drink'],
];

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

const decode = (s) =>
  String(s ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#?apos;|&rsquo;|&lsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&frac12;/g, '½').replace(/&frac14;/g, '¼').replace(/&frac34;/g, '¾')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();

// ISO 8601 duration (PT1H30M) to minutes
const minutes = (d) => {
  if (!d || typeof d !== 'string') return 0;
  const m = d.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i);
  if (!m) return 0;
  return (+m[1] || 0) * 1440 + (+m[2] || 0) * 60 + (+m[3] || 0);
};

const firstNumber = (y) => {
  const v = Array.isArray(y) ? y.find((x) => /\d/.test(String(x))) ?? y[0] : y;
  const m = String(v ?? '').match(/\d+(\.\d+)?/);
  return m ? +m[0] : 0;
};

const list = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);

function findRecipe(node) {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const n of node) { const r = findRecipe(n); if (r) return r; }
    return null;
  }
  const t = list(node['@type']).map(String);
  if (t.some((x) => /Recipe$/i.test(x))) return node;
  for (const k of ['@graph', 'mainEntity', 'itemListElement']) {
    const r = findRecipe(node[k]);
    if (r) return r;
  }
  return null;
}

function steps(instr) {
  const out = [];
  const walk = (x) => {
    if (!x) return;
    if (typeof x === 'string') { decode(x).split(/\n+/).map((s) => s.trim()).filter(Boolean).forEach((s) => out.push(s)); return; }
    if (Array.isArray(x)) { x.forEach(walk); return; }
    const t = list(x['@type']).join(' ');
    if (/HowToSection/i.test(t)) { walk(x.itemListElement); return; }
    if (x.text || x.name) out.push(decode(x.text || x.name));
    else if (x.itemListElement) walk(x.itemListElement);
  };
  walk(instr);
  return out.filter(Boolean);
}

function imageUrl(img) {
  const first = list(img)[0];
  if (!first) return '';
  return typeof first === 'string' ? first : first.url || first.contentUrl || '';
}

async function imageData(url, base) {
  try {
    const abs = new URL(url, base).href;
    const r = await fetch(abs, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(6000) });
    if (!r.ok) return '';
    const type = r.headers.get('content-type') || 'image/jpeg';
    if (!type.startsWith('image/')) return '';
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 3_000_000) return '';
    return `data:${type};base64,${buf.toString('base64')}`;
  } catch {
    return '';
  }
}

const UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

export default async (req) => {
  const target = new URL(req.url).searchParams.get('url') || '';
  let page;
  try {
    page = new URL(target);
    if (!/^https?:$/.test(page.protocol)) throw 0;
  } catch {
    return json({ error: 'badurl' }, 400);
  }

  let html;
  try {
    const r = await fetch(page.href, {
      headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml', 'accept-language': 'en-US,en;q=0.9' },
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    });
    if (r.status === 401 || r.status === 403 || r.status === 429) return json({ error: 'blocked' }, 502);
    if (!r.ok) return json({ error: 'fail' }, 502);
    html = await r.text();
  } catch {
    return json({ error: 'fail' }, 502);
  }

  let recipe = null;
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(re)) {
    try {
      recipe = findRecipe(JSON.parse(m[1].trim()));
    } catch {
      continue;
    }
    if (recipe) break;
  }
  if (!recipe) return json({ error: 'norecipe' }, 422);

  const site =
    decode(html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)/i)?.[1]) ||
    decode(list(recipe.publisher)[0]?.name) ||
    page.hostname.replace(/^www\./, '');

  const catText = [...list(recipe.recipeCategory), ...list(recipe.keywords)].join(' ');
  const categories = [...new Set(CATS.filter(([rx]) => rx.test(catText)).map(([, c]) => c))].slice(0, 2);
  const cuisine = decode(list(recipe.recipeCuisine)[0] || '');

  const prep = minutes(recipe.prepTime);
  const cook = minutes(recipe.cookTime);
  const img = imageUrl(recipe.image);

  return json({
    title: decode(recipe.name),
    servings: firstNumber(recipe.recipeYield),
    prep,
    cook,
    total: minutes(recipe.totalTime) || prep + cook,
    ingredients: list(recipe.recipeIngredient).map(decode).filter(Boolean),
    steps: steps(recipe.recipeInstructions),
    sourceName: site,
    categories,
    cuisine: cuisine.length < 30 ? cuisine : '',
    image: img ? await imageData(img, page.href) : '',
  });
};

export const config = { path: '/api/recipe' };
