import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { ROOT_DIR, UPLOADS_DIR } from '../config.js';
import { getDb, closeDb, ensureDataDirs } from './connection.js';
import { runMigrations } from './migrate.js';

const seedRequire = createRequire(import.meta.url);
function getSharp() {
  if (process.env.NETLIFY) return null;
  try {
    return seedRequire(['sh', 'arp'].join(''));
  } catch {
    return null;
  }
}

const seedFile = fileURLToPath(import.meta.url);

const CATEGORIES = [
  { name: 'Electronics', slug: 'electronics' },
  { name: 'Home & Kitchen', slug: 'home-kitchen' },
  { name: 'Fashion', slug: 'fashion' },
  { name: 'Sports', slug: 'sports' },
  { name: 'Beauty', slug: 'beauty' },
  { name: 'Books', slug: 'books' },
  { name: 'Toys', slug: 'toys' },
  { name: 'Auto', slug: 'auto' },
];

const SELLERS = [
  {
    email: 'aram@yerevantech.am',
    name: 'Aram Grigoryan',
    phone: '+374 91 440100',
    store_name: 'Yerevan Tech Hub',
  },
  {
    email: 'ani@ararathome.am',
    name: 'Ani Sargsyan',
    phone: '+374 93 550200',
    store_name: 'Ararat Home & Style',
  },
  {
    email: 'tigran@haykgear.am',
    name: 'Tigran Hakobyan',
    phone: '+374 94 660300',
    store_name: 'Hayk Outdoor & Auto',
  },
];

const BUYERS = [
  {
    email: 'narek@demo.am',
    name: 'Narek Petrosyan',
    phone: '+374 99 112233',
  },
  {
    email: 'mariam@demo.am',
    name: 'Mariam Avetisyan',
    phone: '+374 95 223344',
  },
];

const PALETTE = {
  electronics: { bg: '#0f172a', accent: '#f59e0b', badge: '#1e293b', icon: '⚡' },
  'home-kitchen': { bg: '#78350f', accent: '#fbbf24', badge: '#92400e', icon: '☕' },
  fashion: { bg: '#3f1d38', accent: '#f472b6', badge: '#581c4c', icon: '✦' },
  sports: { bg: '#064e3b', accent: '#34d399', badge: '#065f46', icon: '▲' },
  beauty: { bg: '#4c1d95', accent: '#f9a8d4', badge: '#5b21b6', icon: '✿' },
  books: { bg: '#1e3a5f', accent: '#fbbf24', badge: '#1e40af', icon: '▤' },
  toys: { bg: '#7c2d12', accent: '#fcd34d', badge: '#9a3412', icon: '★' },
  auto: { bg: '#1f2937', accent: '#f97316', badge: '#374151', icon: '⚙' },
};

const PRODUCTS = [
  // Electronics (7) -> seller 0 (Yerevan Tech Hub)
  {
    sellerIdx: 0,
    categorySlug: 'electronics',
    title: 'Anker Soundcore Space Q45 Wireless Headphones',
    description: 'Active noise cancelling over-ear headphones with 50-hour battery life, LDAC Hi-Res audio, and USB-C fast charging. Official warranty in Yerevan.',
    price_amd: 58900,
    stock: 14,
  },
  {
    sellerIdx: 0,
    categorySlug: 'electronics',
    title: 'Xiaomi 20000mAh 50W Fast Charge Power Bank',
    description: 'High-capacity portable charger capable of charging laptops, tablets, and smartphones simultaneously via USB-C and dual USB-A ports.',
    price_amd: 22500,
    stock: 25,
  },
  {
    sellerIdx: 0,
    categorySlug: 'electronics',
    title: 'Keychron K2 Pro Mechanical Wireless Keyboard',
    description: '75% layout hot-swappable QMK/VIA mechanical keyboard with PBT keycaps, Bluetooth 5.1, and tactile brown switches for Mac and Windows.',
    price_amd: 49500,
    stock: 9,
  },
  {
    sellerIdx: 0,
    categorySlug: 'electronics',
    title: 'TP-Link Archer AX55 Wi-Fi 6 Dual-Band Router',
    description: 'AX3000 Gigabit Wi-Fi 6 router built for stable fiber internet across thick stone apartments in Yerevan and regional cities.',
    price_amd: 34900,
    stock: 11,
  },
  {
    sellerIdx: 0,
    categorySlug: 'electronics',
    title: 'Logitech MX Master 3S Ergonomic Wireless Mouse',
    description: '8000 DPI quiet-click productivity mouse with MagSpeed electromagnetic scroll wheel and multi-device Flow support.',
    price_amd: 46000,
    stock: 8,
  },
  {
    sellerIdx: 0,
    categorySlug: 'electronics',
    title: 'Samsung T7 Shield 1TB Rugged Portable SSD',
    description: 'IP65 water- and dust-resistant external SSD with 1050MB/s read speeds over USB 3.2 Gen 2 Type-C.',
    price_amd: 54000,
    stock: 12,
  },
  {
    sellerIdx: 0,
    categorySlug: 'electronics',
    title: 'Baseus 65W GaN3 Pro 4-Port Fast Wall Charger',
    description: 'Compact EU-plug GaN charger with 2x USB-C and 2x USB-A outputs plus 100W braided Type-C cable included.',
    price_amd: 16800,
    stock: 30,
  },

  // Home & Kitchen (6) -> seller 1 (Ararat Home & Style)
  {
    sellerIdx: 1,
    categorySlug: 'home-kitchen',
    title: 'Armenian Hammered Copper Jazzve Coffee Pot (350ml)',
    description: 'Handcrafted tin-lined heavy copper jezve with walnut handle, ideal for traditional Armenian dark-roast coffee on gas or electric stoves.',
    price_amd: 14500,
    stock: 18,
  },
  {
    sellerIdx: 1,
    categorySlug: 'home-kitchen',
    title: 'DeLonghi Dedica Arte Manual Espresso Machine',
    description: 'Slim 15cm stainless steel espresso maker with 15-bar pump, My LatteArt steam wand, and precision tamper.',
    price_amd: 118000,
    stock: 5,
  },
  {
    sellerIdx: 1,
    categorySlug: 'home-kitchen',
    title: 'Walnut & Apricot Wood End-Grain Cutting Board',
    description: 'Oiled solid Armenian walnut and wild apricot wood kitchen board with recessed juice groove and non-slip feet.',
    price_amd: 19500,
    stock: 16,
  },
  {
    sellerIdx: 1,
    categorySlug: 'home-kitchen',
    title: 'Ceramic Pomegranate Serving Bowl Set (3 Pieces)',
    description: 'Hand-glazed Yerevan studio ceramic bowls inspired by classic Armenian motifs. Dishwasher and microwave safe.',
    price_amd: 16200,
    stock: 20,
  },
  {
    sellerIdx: 1,
    categorySlug: 'home-kitchen',
    title: 'Philips 4.1L Rapid Air Digital Air Fryer',
    description: 'Crispy roasting, baking, and reheating with up to 90% less oil, digital touch presets, and easy-clean non-stick basket.',
    price_amd: 52000,
    stock: 7,
  },
  {
    sellerIdx: 1,
    categorySlug: 'home-kitchen',
    title: 'Stonewashed Organic Linen Table Runner (220cm)',
    description: 'Soft breathable natural flax table runner in warm sandstone shade for everyday dining and festive gatherings.',
    price_amd: 13400,
    stock: 22,
  },

  // Fashion (5) -> seller 1 (Ararat Home & Style)
  {
    sellerIdx: 1,
    categorySlug: 'fashion',
    title: 'Handcrafted Full-Grain Leather Crossbody Bag',
    description: 'Vegetable-tanned brown leather everyday sling bag stitched in Gyumri with brass hardware and padded tablet sleeve.',
    price_amd: 32000,
    stock: 10,
  },
  {
    sellerIdx: 1,
    categorySlug: 'fashion',
    title: 'Merino Wool Classic Knit Scarf — Charcoal',
    description: 'Warm, itch-free 100% merino wool scarf woven for crisp Yerevan winters and mountain trips to Tsaghkadzor.',
    price_amd: 14900,
    stock: 19,
  },
  {
    sellerIdx: 1,
    categorySlug: 'fashion',
    title: 'Armenian Silk Ornament Pocket Square & Scarf',
    description: 'Printed pure mulberry silk accessory featuring geometric khachkar and eternity-wheel artwork in amber and navy.',
    price_amd: 18500,
    stock: 15,
  },
  {
    sellerIdx: 1,
    categorySlug: 'fashion',
    title: 'Minimalist Water-Resistant Urban Backpack 20L',
    description: 'Clean slate-gray commuter backpack with hidden anti-theft pocket, 16-inch laptop compartment, and luggage strap.',
    price_amd: 26500,
    stock: 13,
  },
  {
    sellerIdx: 1,
    categorySlug: 'fashion',
    title: 'Unisex Heavyweight Cotton Fleece Hoodie — Sand',
    description: '420gsm combed cotton relaxed-fit hoodie, pre-shrunk and enzyme-washed for lasting softness.',
    price_amd: 21000,
    stock: 24,
  },

  // Sports (5) -> seller 2 (Hayk Outdoor & Auto)
  {
    sellerIdx: 2,
    categorySlug: 'sports',
    title: 'Aragats Carbon Trekking Poles (Pair)',
    description: 'Ultralight telescopic trekking poles with cork grips, tungsten tips, and snow/mud baskets for Dilijan and Aragats trails.',
    price_amd: 17900,
    stock: 21,
  },
  {
    sellerIdx: 2,
    categorySlug: 'sports',
    title: '3-Person All-Season Mountain Dome Tent',
    description: '3000mm waterproof ripstop rainfly, aluminum poles, and dual vestibules built for Lake Sevan and high-altitude camping.',
    price_amd: 69000,
    stock: 6,
  },
  {
    sellerIdx: 2,
    categorySlug: 'sports',
    title: 'Adjustable Cast Iron Dumbbell Set 20kg',
    description: 'Compact home gym dumbbell pair with knurled steel bars, spinlock collars, and durable rubber-coated plates.',
    price_amd: 29500,
    stock: 11,
  },
  {
    sellerIdx: 2,
    categorySlug: 'sports',
    title: '6mm Non-Slip Natural Cork Yoga & Mobility Mat',
    description: 'High-density TPE base with antimicrobial cork surface and carrying strap, 183x66cm.',
    price_amd: 15500,
    stock: 17,
  },
  {
    sellerIdx: 2,
    categorySlug: 'sports',
    title: 'Vacuum Insulated Stainless Flask 1L — Matte Olive',
    description: 'Double-wall 18/8 steel bottle keeps mountain spring water cold for 24 hours or herbal tea hot for 12 hours.',
    price_amd: 9800,
    stock: 35,
  },

  // Beauty (5) -> seller 1 (Ararat Home & Style)
  {
    sellerIdx: 1,
    categorySlug: 'beauty',
    title: 'Cold-Pressed Armenian Apricot Kernel Facial Oil 50ml',
    description: '100% pure cold-pressed Ararat Valley apricot kernel oil rich in vitamins A and E for daily skin nourishment.',
    price_amd: 7900,
    stock: 28,
  },
  {
    sellerIdx: 1,
    categorySlug: 'beauty',
    title: 'Tavush Wild Rosehip & Clay Detox Mask 120g',
    description: 'Gentle mineral kaolin clay blended with wild Tavush rosehip extract to brighten and soothe combination skin.',
    price_amd: 8600,
    stock: 20,
  },
  {
    sellerIdx: 1,
    categorySlug: 'beauty',
    title: 'La Roche-Posay Anthelios UVMune 400 SPF50+ 50ml',
    description: 'Ultra-lightweight invisible fluid sunscreen offering broad-spectrum UVA/UVB protection under sunny Yerevan skies.',
    price_amd: 11200,
    stock: 23,
  },
  {
    sellerIdx: 1,
    categorySlug: 'beauty',
    title: 'High-Speed Ionic Ceramic Hair Dryer 1800W',
    description: 'Quiet brushless motor dryer with magnetic concentrator nozzle, diffuser, and cool-shot temperature control.',
    price_amd: 36500,
    stock: 9,
  },
  {
    sellerIdx: 1,
    categorySlug: 'beauty',
    title: 'Sea Buckthorn & Honey Nourishing Hand Cream Set',
    description: 'Trio of fast-absorbing botanical hand balms made with Syunik wildflower honey and sea buckthorn oil.',
    price_amd: 6400,
    stock: 32,
  },

  // Books (5) -> seller 0 (Yerevan Tech Hub) & seller 1
  {
    sellerIdx: 1,
    categorySlug: 'books',
    title: 'Armenian Cuisine: Regional Recipes & Stories (Hardcover)',
    description: 'Illustrated hardcover cookbook covering classic lavash, khorovats, tolma, gata, and forgotten village dishes across Armenia.',
    price_amd: 14800,
    stock: 15,
  },
  {
    sellerIdx: 0,
    categorySlug: 'books',
    title: 'Designing Data-Intensive Applications (Hardcover)',
    description: 'Martin Kleppmann classic engineering guide on reliable, scalable, and maintainable distributed systems.',
    price_amd: 23500,
    stock: 10,
  },
  {
    sellerIdx: 1,
    categorySlug: 'books',
    title: 'Walking Trails of Armenia: 40 GPS-Mapped Routes',
    description: 'Detailed trail guidebook covering Lori canyons, Syunik monasteries, Dilijan forests, and Geghama volcanic ridge.',
    price_amd: 11500,
    stock: 18,
  },
  {
    sellerIdx: 0,
    categorySlug: 'books',
    title: 'Clean Architecture & Practical System Design',
    description: 'Essential software architecture reference for senior backend and full-stack engineers.',
    price_amd: 17200,
    stock: 12,
  },
  {
    sellerIdx: 1,
    categorySlug: 'books',
    title: 'Yerevan Architectural Sketchbook & History',
    description: 'Bilingual art book celebrating pink tuff architecture, Cascade monuments, and historic Kond courtyards.',
    price_amd: 12900,
    stock: 14,
  },

  // Toys (4) -> seller 1 & seller 2
  {
    sellerIdx: 1,
    categorySlug: 'toys',
    title: 'Beechwood Magnetic Armenian Alphabet Blocks (39 pcs)',
    description: 'Child-safe water-based painted wooden blocks featuring all 39 Armenian letters and animal illustrations.',
    price_amd: 12400,
    stock: 22,
  },
  {
    sellerIdx: 2,
    categorySlug: 'toys',
    title: 'STEM Solar Rover & Robotics Building Kit (190 pcs)',
    description: 'Hands-on mechanical engineering kit for ages 8+ powered by a real mini solar panel or AAA battery.',
    price_amd: 16900,
    stock: 16,
  },
  {
    sellerIdx: 1,
    categorySlug: 'toys',
    title: 'Hand-Carved Walnut Backgammon (Nardi) Travel Set',
    description: 'Foldable solid walnut backgammon board with inlaid geometric star pattern, weighted checkers, and dice.',
    price_amd: 28000,
    stock: 9,
  },
  {
    sellerIdx: 2,
    categorySlug: 'toys',
    title: '3D Wooden Mechanical Observatory Puzzle',
    description: 'Laser-cut birch plywood gear model with working planetary rotation — 240 pieces, no glue needed.',
    price_amd: 13800,
    stock: 14,
  },

  // Auto (5) -> seller 2 (Hayk Outdoor & Auto)
  {
    sellerIdx: 2,
    categorySlug: 'auto',
    title: '70mai Dash Cam A500S Pro Plus+ 2.7K GPS',
    description: 'Sony IMX335 night-vision dash camera with built-in GPS, ADAS alerts, and parking surveillance mode.',
    price_amd: 44500,
    stock: 10,
  },
  {
    sellerIdx: 2,
    categorySlug: 'auto',
    title: 'Baseus 1000A Peak Car Jump Starter & Power Bank',
    description: 'Emergency 12V lithium jump starter for up to 6.0L petrol or 3.5L diesel engines in freezing winter mornings.',
    price_amd: 33900,
    stock: 13,
  },
  {
    sellerIdx: 2,
    categorySlug: 'auto',
    title: 'Digital Portable Tire Inflator Air Compressor 150 PSI',
    description: 'Cordless rechargeable car tire pump with auto-shutoff pressure gauge, LED work light, and Presta/Schrader adapters.',
    price_amd: 19900,
    stock: 19,
  },
  {
    sellerIdx: 2,
    categorySlug: 'auto',
    title: '3D Molded All-Weather Rubber Car Floor Mats (Universal)',
    description: 'Heavy-duty odorless TPE deep-dish mats protecting cabin carpets from mountain mud, snow, and road salt.',
    price_amd: 24500,
    stock: 12,
  },
  {
    sellerIdx: 2,
    categorySlug: 'auto',
    title: 'MagSafe Magnetic Car Air Vent Phone Mount (15W Qi)',
    description: 'CNC aluminum locking vent mount with 15W fast wireless charging and rock-solid grip on rough roads.',
    price_amd: 11800,
    stock: 27,
  },
];

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapLines(text, maxChars = 24, maxLines = 3) {
  const words = text.split(/\s+/);
  const lines = [];
  let current = '';
  for (const w of words) {
    if ((current + ' ' + w).trim().length <= maxChars) {
      current = (current + ' ' + w).trim();
    } else {
      if (current) lines.push(current);
      current = w;
      if (lines.length === maxLines) break;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines;
}

async function generateSeedProductImages(index, product, categoryName) {
  const num = String(index + 1).padStart(2, '0');
  const largeName = `seed-p${num}-large.webp`;
  const thumbName = `seed-p${num}-thumb.webp`;
  const largePath = path.join(UPLOADS_DIR, largeName);
  const thumbPath = path.join(UPLOADS_DIR, thumbName);

  if (fs.existsSync(largePath) && fs.existsSync(thumbPath)) {
    return largeName;
  }

  // Copy pre-generated static WebP assets if present (e.g. serverless / Netlify runtime)
  const staticDirs = [
    path.join(ROOT_DIR, 'dist/uploads'),
    path.join(ROOT_DIR, 'public/uploads'),
    path.resolve(process.cwd(), 'dist/uploads'),
    path.resolve(process.cwd(), 'public/uploads'),
  ];
  for (const dir of staticDirs) {
    const srcLarge = path.join(dir, largeName);
    const srcThumb = path.join(dir, thumbName);
    if (fs.existsSync(srcLarge) && fs.existsSync(srcThumb)) {
      fs.copyFileSync(srcLarge, largePath);
      fs.copyFileSync(srcThumb, thumbPath);
      return largeName;
    }
  }

  const sharp = getSharp();
  if (!sharp) {
    return largeName;
  }

  const theme = PALETTE[product.categorySlug] || PALETTE.electronics;
  const lines = wrapLines(product.title, 24, 3);
  const priceText = `${product.price_amd.toLocaleString('en-US')} AMD`;

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="1000" height="750" viewBox="0 0 1000 750">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${theme.bg}" />
        <stop offset="100%" stop-color="#090d16" />
      </linearGradient>
    </defs>
    <rect width="1000" height="750" fill="url(#g)" />
    <circle cx="840" cy="140" r="190" fill="${theme.accent}" fill-opacity="0.14" />
    <circle cx="150" cy="640" r="230" fill="${theme.accent}" fill-opacity="0.09" />
    <rect x="64" y="64" width="872" height="622" rx="32" fill="${theme.badge}" fill-opacity="0.45" stroke="${theme.accent}" stroke-opacity="0.35" stroke-width="2" />
    <rect x="108" y="108" width="230" height="46" rx="23" fill="${theme.accent}" />
    <text x="223" y="138" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="700" fill="#111827">${escapeXml(categoryName.toUpperCase())}</text>
    <text x="845" y="175" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="88" fill="${theme.accent}" fill-opacity="0.85">${escapeXml(theme.icon)}</text>
    ${lines
      .map(
        (line, i) =>
          `<text x="108" y="${265 + i * 64}" font-family="system-ui, -apple-system, sans-serif" font-size="48" font-weight="800" fill="#f8fafc">${escapeXml(line)}</text>`
      )
      .join('')}
    <rect x="108" y="535" width="320" height="78" rx="18" fill="#ffffff" fill-opacity="0.09" stroke="${theme.accent}" stroke-opacity="0.55" stroke-width="1.5" />
    <text x="136" y="586" font-family="system-ui, -apple-system, sans-serif" font-size="34" font-weight="800" fill="${theme.accent}">${escapeXml(priceText)}</text>
    <text x="892" y="586" text-anchor="end" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="600" fill="#94a3b8">SHUKA.AM</text>
  </svg>`;

  const svgBuf = Buffer.from(svg);
  await sharp(svgBuf)
    .resize(1000, 750, { fit: 'inside' })
    .webp({ quality: 86 })
    .toFile(largePath);

  await sharp(svgBuf)
    .resize(400, 400, { fit: 'cover' })
    .webp({ quality: 82 })
    .toFile(thumbPath);

  return largeName;
}

export async function seedDatabase(db = getDb()) {
  ensureDataDirs();
  const now = new Date().toISOString();

  // Pre-hash demo passwords once
  const sellerHash = bcrypt.hashSync('Seller123!', 10);
  const buyerHash = bcrypt.hashSync('Buyer123!', 10);

  // Pre-generate local product images outside DB transactions
  const catNameBySlug = Object.fromEntries(CATEGORIES.map((c) => [c.slug, c.name]));
  const imageNames = [];
  for (let i = 0; i < PRODUCTS.length; i += 1) {
    const fileName = await generateSeedProductImages(i, PRODUCTS[i], catNameBySlug[PRODUCTS[i].categorySlug]);
    imageNames.push(fileName);
  }

  const runSeedTx = db.transaction(() => {
    const insertCategory = db.prepare(
      `INSERT OR IGNORE INTO categories (name, slug) VALUES (?, ?)`
    );
    for (const c of CATEGORIES) {
      insertCategory.run(c.name, c.slug);
    }

    const getCategory = db.prepare(`SELECT id FROM categories WHERE slug = ?`);
    const categoryIdBySlug = {};
    for (const c of CATEGORIES) {
      categoryIdBySlug[c.slug] = getCategory.get(c.slug).id;
    }

    const insertUser = db.prepare(
      `INSERT OR IGNORE INTO users (email, password_hash, name, phone, store_name, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    const getUserByEmail = db.prepare(`SELECT id FROM users WHERE email = ?`);

    const sellerIds = [];
    for (const s of SELLERS) {
      insertUser.run(s.email, sellerHash, s.name, s.phone, s.store_name, now);
      sellerIds.push(getUserByEmail.get(s.email).id);
    }

    const buyerIds = [];
    for (const b of BUYERS) {
      insertUser.run(b.email, buyerHash, b.name, b.phone, null, now);
      buyerIds.push(getUserByEmail.get(b.email).id);
    }

    const findProduct = db.prepare(
      `SELECT id FROM products WHERE seller_id = ? AND title = ?`
    );
    const insertProduct = db.prepare(
      `INSERT INTO products (
        seller_id, category_id, title, description, price_amd, stock,
        is_published, rating_avg, rating_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 1, 0.0, 0, ?, ?)`
    );
    const insertImage = db.prepare(
      `INSERT OR IGNORE INTO product_images (product_id, file_path, position) VALUES (?, ?, 0)`
    );

    const productIds = [];
    const baseTime = Date.now() - PRODUCTS.length * 60 * 60 * 1000;

    for (let i = 0; i < PRODUCTS.length; i += 1) {
      const p = PRODUCTS[i];
      const sellerId = sellerIds[p.sellerIdx];
      const categoryId = categoryIdBySlug[p.categorySlug];
      const existing = findProduct.get(sellerId, p.title);
      const ts = new Date(baseTime + i * 60 * 60 * 1000).toISOString();

      let productId;
      if (existing) {
        productId = existing.id;
      } else {
        const res = insertProduct.run(
          sellerId,
          categoryId,
          p.title,
          p.description,
          p.price_amd,
          p.stock,
          ts,
          ts
        );
        productId = Number(res.lastInsertRowid);
      }

      insertImage.run(productId, imageNames[i]);
      productIds.push(productId);
    }

    // Seed 1 delivered multi-seller order + 3 authentic reviews if not yet created
    const existingOrder = db
      .prepare(`SELECT id FROM orders WHERE request_key = ?`)
      .get('seed-order-0001');

    if (!existingOrder) {
      const narekId = buyerIds[0];
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      const deliveredItems = [
        { idx: 0, qty: 1 }, // Yerevan Tech Hub
        { idx: 6, qty: 1 }, // Yerevan Tech Hub
        { idx: 7, qty: 1 }, // Ararat Home & Style
      ];

      const totalAmd = deliveredItems.reduce(
        (sum, item) => sum + PRODUCTS[item.idx].price_amd * item.qty,
        0
      );

      const orderRes = db
        .prepare(
          `INSERT INTO orders (
            buyer_id, recipient, phone, region, city, street, apartment, note,
            total_amd, request_key, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          narekId,
          'Narek Petrosyan',
          '+374 99 112233',
          'Yerevan',
          'Yerevan',
          'Abovyan St 22',
          'Apt 14',
          'Call 15 minutes before arrival',
          totalAmd,
          'seed-order-0001',
          twoDaysAgo
        );
      const orderId = Number(orderRes.lastInsertRowid);

      const bySeller = new Map();
      for (const item of deliveredItems) {
        const p = PRODUCTS[item.idx];
        const sId = sellerIds[p.sellerIdx];
        if (!bySeller.has(sId)) bySeller.set(sId, []);
        bySeller.get(sId).push({ ...item, product: p, productId: productIds[item.idx] });
      }

      for (const [sId, items] of bySeller.entries()) {
        const subtotal = items.reduce((s, it) => s + it.product.price_amd * it.qty, 0);
        const soRes = db
          .prepare(
            `INSERT INTO seller_orders (order_id, seller_id, status, subtotal_amd, updated_at)
             VALUES (?, ?, 'delivered', ?, ?)`
          )
          .run(orderId, sId, subtotal, twoDaysAgo);
        const soId = Number(soRes.lastInsertRowid);

        for (const it of items) {
          db.prepare(
            `INSERT INTO order_items (seller_order_id, product_id, title, unit_price_amd, quantity)
             VALUES (?, ?, ?, ?, ?)`
          ).run(soId, it.productId, it.product.title, it.product.price_amd, it.qty);
        }

        const histStmt = db.prepare(
          `INSERT INTO status_history (seller_order_id, from_status, to_status, changed_by, created_at)
           VALUES (?, ?, ?, ?, ?)`
        );
        histStmt.run(soId, null, 'placed', narekId, twoDaysAgo);
        histStmt.run(soId, 'placed', 'confirmed', sId, twoDaysAgo);
        histStmt.run(soId, 'confirmed', 'shipped', sId, twoDaysAgo);
        histStmt.run(soId, 'shipped', 'delivered', sId, twoDaysAgo);
      }

      const seedReviews = [
        {
          productId: productIds[0],
          rating: 5,
          body: 'Excellent noise cancellation on the Yerevan metro and super clear calls. Delivered the next afternoon.',
        },
        {
          productId: productIds[6],
          rating: 5,
          body: 'Charges my MacBook and phone together without heating up. Great compact EU plug.',
        },
        {
          productId: productIds[7],
          rating: 5,
          body: 'Thick copper and solid walnut handle. Makes rich Armenian coffee with thick foam every morning.',
        },
      ];

      for (const rev of seedReviews) {
        db.prepare(
          `INSERT OR IGNORE INTO reviews (product_id, buyer_id, rating, body, created_at)
           VALUES (?, ?, ?, ?, ?)`
        ).run(rev.productId, narekId, rev.rating, rev.body, now);

        const stats = db
          .prepare(
            `SELECT COUNT(*) AS cnt, COALESCE(AVG(rating), 0) AS avg_rating
             FROM reviews WHERE product_id = ?`
          )
          .get(rev.productId);
        db.prepare(
          `UPDATE products SET rating_avg = ?, rating_count = ? WHERE id = ?`
        ).run(Number(stats.avg_rating.toFixed(2)), stats.cnt, rev.productId);
      }
    }
  });

  runSeedTx();
  console.log(`[seed] Seeded ${CATEGORIES.length} categories, ${SELLERS.length} sellers, ${BUYERS.length} buyers, and ${PRODUCTS.length} products.`);
}

export async function seedIfEmpty(db = getDb()) {
  const row = db.prepare(`SELECT COUNT(*) AS count FROM categories`).get();
  if (row.count === 0) {
    await seedDatabase(db);
    return true;
  }
  return false;
}

if (process.argv[1] && path.resolve(process.argv[1]) === seedFile) {
  (async () => {
    try {
      const db = getDb();
      runMigrations(db);
      await seedDatabase(db);
    } finally {
      closeDb();
    }
  })();
}
