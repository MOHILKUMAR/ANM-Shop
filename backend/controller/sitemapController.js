const Product = require('../model/Product');
const beautyCategories = require('../constants/beautyCategories');

// The storefront's address; FRONTEND_URL may list several origins and the first is the main one.
const storefrontUrl = () => (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim().replace(/\/+$/, '');
const escapeXml = (value) => String(value).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
// YYYY-MM-DD, or null for a missing or invalid date (e.g. a product imported without one).
const day = (date) => {
    const parsed = date ? new Date(date) : null;
    return parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : null;
};

// Public pages search engines should know about. Account, cart, checkout, and admin pages are
// left out (robots.txt keeps crawlers away from them).
const PAGES = [
    ['/', 'daily', '1.0'],
    ['/shop', 'daily', '0.9'],
    ['/about', 'monthly', '0.4'],
    ['/contact', 'monthly', '0.4'],
    ['/returns', 'yearly', '0.3'],
    ['/privacy', 'yearly', '0.2'],
    ['/terms', 'yearly', '0.2'],
];

// GET /sitemap.xml — every public page, category, and product. The storefront serves it at
// https://<shop>/sitemap.xml through a rewrite in frontend/vercel.json.
const sitemap = async (req, res) => {
    try {
        const site = storefrontUrl();
        const products = await Product.find({ category: { $in: beautyCategories } })
            .select('_id createdAt').sort({ createdAt: -1 }).limit(45000).lean();
        const urls = [
            ...PAGES.map(([path, changefreq, priority]) => ({ loc: `${site}${path}`, changefreq, priority })),
            ...beautyCategories.map((category) => ({ loc: `${site}/shop?category=${encodeURIComponent(category)}`, changefreq: 'daily', priority: '0.8' })),
            ...products.map((product) => ({ loc: `${site}/product/${product._id}`, lastmod: day(product.createdAt), changefreq: 'weekly', priority: '0.7' })),
        ];
        const body = urls.map((url) => [
            '  <url>',
            `    <loc>${escapeXml(url.loc)}</loc>`,
            url.lastmod ? `    <lastmod>${url.lastmod}</lastmod>` : null,
            `    <changefreq>${url.changefreq}</changefreq>`,
            `    <priority>${url.priority}</priority>`,
            '  </url>',
        ].filter(Boolean).join('\n')).join('\n');
        res.set('Content-Type', 'application/xml; charset=utf-8');
        res.set('Cache-Control', 'public, max-age=3600');
        return res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`);
    } catch (error) {
        console.error('Sitemap error:', error.message);
        return res.status(500).type('text/plain').send('Sitemap unavailable');
    }
};

module.exports = { sitemap };
