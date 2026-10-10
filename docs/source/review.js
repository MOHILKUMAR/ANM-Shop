// Prints the last built document (doc.html, from build.js) in groups of sections and reports
// how many pages each takes, to spot a part that grew onto a new page or left a page nearly
// empty. Sections: 0 cover, 1 contents, 2–15 Parts 1–14. Output goes to review/.
//   node docs/source/review.js                 default groups
//   node docs/source/review.js "[[10],[11]]"   chosen sections
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');
const { findChrome } = require('./chrome');

const chrome = findChrome();
const html = fs.readFileSync(path.join(__dirname, 'doc.html'), 'utf8');
const [head, rest] = html.split('<body>');
const body = rest.replace('</body></html>', '');
const parts = body.split(/(?=<section class=")/).filter((s) => s.trim());
const groups = JSON.parse(process.argv[2] || '[[0,1],[2,3],[4],[5],[6],[7],[8],[9,10],[11,12],[13,14,15]]');
fs.mkdirSync(path.join(__dirname, 'review'), { recursive: true });
groups.forEach((g, i) => {
  const file = path.join(__dirname, 'review', `part${i}.html`);
  fs.writeFileSync(file, `${head}<body>${g.map((n) => parts[n] || '').join('')}</body></html>`);
  const pdf = path.join(__dirname, 'review', `part${i}.pdf`);
  try { execFileSync(chrome, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', `--print-to-pdf=${pdf}`, pathToFileURL(file).href], { stdio: 'ignore' }); } catch (e) {}
  const pages = (fs.readFileSync(pdf, 'latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  console.log(`part${i}: sections ${g.join(',')} → ${pages} pages`);
});
console.log('total sections:', parts.length);
