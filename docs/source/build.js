// Builds docs/ANM-Shop-Project-Documentation.pdf: assembles the chapters (content1.js,
// content2.js, with diagrams from diagrams.js) into doc.html and prints it with headless Chrome.
// Run from anywhere: node docs/source/build.js (see README.md in this folder).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');
const c1 = require('./content1');
const c2 = require('./content2');
const { findChrome } = require('./chrome');

const root = path.resolve(__dirname, '..', '..');
const outDir = path.join(root, 'docs');
const outPdf = path.join(outDir, 'ANM-Shop-Project-Documentation.pdf');
const css = fs.readFileSync(path.join(__dirname, 'style.css'), 'utf8');
const logo = fs.readFileSync(path.join(root, 'frontend/src/assets/anm-shop-logo.svg'), 'utf8')
  .replace('<svg ', '<svg style="width:72mm;height:auto;display:block" ');

const inside = (chapter, extra) => chapter.replace(/<\/section>$/, `${extra}</section>`);
// Shorter parts continue on the previous page instead of starting a new one.
const flowOn = (chapter) => chapter.replace('<section class="chapter"', '<section class="chapter flow"');

const cover = `<section class="cover">
  <div class="logo">${logo}</div>
  <div class="eyebrow">Project documentation</div>
  <h1>ANM-Shop — online beauty store</h1>
  <p class="sub">Architecture (HLD), low-level design (LLD), user and API workflows, API and data reference, security, operations and roadmap.</p>
  <div class="meta">
    <div><b>Edition</b>4 · up to pull request #34</div>
    <div><b>Date</b>10 October 2026</div>
    <div><b>Stack</b>React 19 · Express 5 · MongoDB</div>
    <div><b>Live</b>anm-shop.vercel.app</div>
  </div>
</section>`;

const toc = [
  ['overview', '1', 'Project overview', 'Who uses it · What it does · Where it runs'],
  ['stack', '2', 'Technology stack', 'Frontend · Backend · External services · Folder structure'],
  ['hld', '3', 'High-level design (HLD)', 'System architecture · Deployment · Design decisions · Quality attributes'],
  ['user', '4', 'User workflows', 'Shopper journey · Sign-up · Sessions · Password reset · Checkout · Orders & reviews · Support · Admin'],
  ['api-flows', '5', 'API workflows', 'Sign-up · Sign-in · Password reset · Payment · Webhook · Cancel and return · Chat assistant'],
  ['lld', '6', 'Low-level design (LLD)', 'Request pipeline · Backend modules · Frontend architecture · Data model · Pricing engine · State machines · Fulfilment · Cancellations · AI internals'],
  ['api', '7', 'API reference', 'All 60 endpoints by area'],
  ['models', '8', 'Data model reference', 'Fields and rules for all 10 collections'],
  ['security', '9', 'Security', 'Headers, auth, codes, bots, payments, input, privacy'],
  ['limits', '10', 'Rate limits', '11 limiters'],
  ['frontend', '11', 'Frontend reference', 'Routes · SEO · Performance · Consent · Look and feel'],
  ['ops', '12', 'Configuration and operations', 'Environment variables · Local setup · Scripts · Start-up · Checklist'],
  ['history', '13', 'Project history', 'Pull requests #1–#34'],
  ['limitations', '14', 'Known limitations and next steps', 'What to improve next'],
];
const tocHtml = `<section class="chapter" style="break-before:auto"><div class="part-label">Contents</div><h1 class="part">Table of contents</h1>
<div class="toc">${toc.map(([id, n, t, s]) => `<div><b><a href="#${id}">${n}. ${t}</a></b><div class="s"><a href="#${id}">${s}</a></div></div>`).join('')}</div>
<h2>How to read this document</h2>
<p>Parts 1–3 give the big picture. Part 4 follows real people through the app; Part 5 shows the same journeys as API calls; Part 6 opens up the internals. Parts 7–12 are reference material to look things up. Diagram colours: dark boxes are starting points or people, white boxes are steps inside ANM-Shop, gold boxes are outside services or decisions, green boxes are good outcomes, red boxes are failures, and blue boxes are information or alternatives.</p>
</section>`;

const html = `<!doctype html><html lang="en-IN"><head><meta charset="utf-8"><title>ANM-Shop — Project documentation</title><style>${css}</style></head><body>
${cover}
${tocHtml}
${c1.ch1}
${flowOn(c1.ch2)}
${c1.ch3}
${inside(c1.ch4, c1.ch4b)}
${c1.ch5}
${inside(c1.ch6, c1.ch6b)}
${c2.ch7}
${c2.ch8}
${c2.ch9}
${c2.ch10}
${c2.ch11}
${c2.ch12}
${c2.ch13}
${c2.ch14}
</body></html>`;

const htmlPath = path.join(__dirname, 'doc.html');
fs.writeFileSync(htmlPath, html);
fs.mkdirSync(outDir, { recursive: true });
const before = fs.existsSync(outPdf) ? fs.statSync(outPdf).mtimeMs : 0;
try {
  execFileSync(findChrome(), ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', `--print-to-pdf=${outPdf}`, pathToFileURL(htmlPath).href], { stdio: 'ignore' });
} catch (e) { /* Chrome prints noise to stderr; whether the PDF changed is checked below */ }
const written = fs.existsSync(outPdf) && fs.statSync(outPdf).mtimeMs !== before;
console.log(written ? `${outPdf} ${(fs.statSync(outPdf).size / 1024).toFixed(0)} KB` : 'PDF not created (is Chrome or Edge installed? see README.md)');
if (!written) process.exitCode = 1;
