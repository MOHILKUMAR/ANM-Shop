// Small SVG helpers for the documentation diagrams: sequence diagrams, flowcharts, ER boxes.
const C = {
  ink: '#2a1f25', muted: '#6b5d65', brand: '#754656', dark: '#3d2733', mid: '#ac6d7e',
  line: '#c9a9b3', soft: '#fbf5f4', gold: '#b8873f', goldFill: '#fbf3e2', goldLine: '#dfbd7b',
  ok: '#2f7a4d', okFill: '#e7f3ec', bad: '#a33a3a', badFill: '#f9e6e6', blueFill: '#e8eef5', blue: '#2f5a7a',
};
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const lines = (t) => String(t).split('\n');

const defs = (id) => `<defs>
  <marker id="${id}a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${C.brand}"/></marker>
  <marker id="${id}g" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${C.gold}"/></marker>
  <marker id="${id}r" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${C.bad}"/></marker>
</defs>`;

let uid = 0;
const svgOpen = (w, h, id) => `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" font-family="Segoe UI, Arial, sans-serif">${defs(id)}`;

function textBlock(x, y, t, { size = 12, weight = 400, fill = C.ink, anchor = 'middle', lh = 1.28, halo = false } = {}) {
  const ls = lines(t);
  const start = y - ((ls.length - 1) * size * lh) / 2;
  return ls.map((l, i) => {
    const ty = start + i * size * lh;
    // A white box behind labels that cross lines (a stroked text halo would duplicate the PDF text).
    let bg = '';
    if (halo) {
      const w = l.length * size * 0.55 + 8;
      const bx = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w + 4 : x - 4;
      bg = `<rect x="${bx.toFixed(1)}" y="${(ty - size * 0.68).toFixed(1)}" width="${w.toFixed(1)}" height="${(size * 1.36).toFixed(1)}" fill="#fff"/>`;
    }
    return `${bg}<text x="${x}" y="${ty.toFixed(1)}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" dominant-baseline="middle">${esc(l)}</text>`;
  }).join('');
}

// ---------- Sequence diagram ----------
// participants: [{id, name, sub, kind:'client'|'svc'|'ext'}]
// rows: {from,to,label,reply?,bad?} | {note, over:[id,id], tone?} | {section}
function sequence({ participants, rows, width = 920 }) {
  const id = `s${uid++}`;
  const n = participants.length;
  const boxW = Math.min((width - 40) / n - 14, 168);
  const margin = boxW / 2 + 12;
  const gap = (width - 2 * margin) / (n - 1);
  const X = Object.fromEntries(participants.map((p, i) => [p.id, margin + i * gap]));
  let y = 66;
  const body = [];
  let num = 0;
  for (const r of rows) {
    if (r.section) {
      y += 8;
      body.push(`<rect x="12" y="${y}" width="${width - 24}" height="22" rx="4" fill="${C.soft}" stroke="${C.line}" stroke-dasharray="4 3"/>`);
      body.push(textBlock(22, y + 11, r.section, { size: 12, weight: 700, fill: C.brand, anchor: 'start' }));
      y += 30;
      continue;
    }
    if (r.note) {
      const ls = lines(r.note).length;
      const h = ls * 16 + 12;
      const xs = r.over.map((p) => X[p]);
      const textW = Math.max(...lines(r.note).map((l) => l.length)) * 6.2 + 28;
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
      const half = Math.max((Math.max(...xs) - Math.min(...xs)) / 2 + 70, textW / 2);
      const x1 = Math.max(10, cx - half), x2 = Math.min(width - 10, cx + half);
      const fill = r.tone === 'bad' ? C.badFill : r.tone === 'ok' ? C.okFill : C.goldFill;
      const stroke = r.tone === 'bad' ? '#e0a9a9' : r.tone === 'ok' ? '#9fcfb2' : C.goldLine;
      body.push(`<rect x="${x1}" y="${y}" width="${x2 - x1}" height="${h}" rx="5" fill="${fill}" stroke="${stroke}"/>`);
      body.push(textBlock((x1 + x2) / 2, y + h / 2, r.note, { size: 11.6, fill: C.ink }));
      y += h + 12;
      continue;
    }
    num += 1;
    const ls = lines(r.label);
    y += ls.length * 15 + 8;
    const x1 = X[r.from], x2 = X[r.to];
    const color = r.bad ? C.bad : r.reply ? C.gold : C.brand;
    const mk = r.bad ? 'r' : r.reply ? 'g' : 'a';
    const dash = r.reply ? ' stroke-dasharray="5 4"' : '';
    if (x1 === x2) {
      body.push(`<path d="M${x1},${y - 6} h36 v14 h-34" fill="none" stroke="${color}" stroke-width="1.5"${dash} marker-end="url(#${id}${mk})"/>`);
      body.push(textBlock(x1 + 42, y + 1, `${num}. ${r.label}`, { size: 11.6, fill: C.ink, anchor: 'start', halo: true }));
      y += 18;
    } else {
      body.push(`<line x1="${x1}" y1="${y}" x2="${x2 + (x2 > x1 ? -2 : 2)}" y2="${y}" stroke="${color}" stroke-width="1.5"${dash} marker-end="url(#${id}${mk})"/>`);
      const lx = (x1 + x2) / 2;
      const labelY = y - 7 - ((ls.length - 1) * 15) / 2 - 2;
      body.push(textBlock(lx, labelY, `${num}. ${r.label}`, { size: 11.6, fill: r.bad ? C.bad : C.ink, halo: true }));
    }
    y += 10;
  }
  const height = y + 20;
  const head = participants.map((p) => {
    const x = X[p.id];
    const fill = p.kind === 'client' ? C.dark : p.kind === 'ext' ? C.goldFill : '#fff';
    const stroke = p.kind === 'client' ? C.dark : p.kind === 'ext' ? C.goldLine : C.brand;
    const tc = p.kind === 'client' ? '#fff' : C.dark;
    const sc = p.kind === 'client' ? '#e9cfd3' : C.muted;
    return `<line x1="${x}" y1="56" x2="${x}" y2="${height - 10}" stroke="#d9c7cd" stroke-width="1.2" stroke-dasharray="3 4"/>
      <rect x="${x - boxW / 2}" y="10" width="${boxW}" height="46" rx="8" fill="${fill}" stroke="${stroke}" stroke-width="1.4"/>
      ${textBlock(x, 27, p.name, { size: 13.5, weight: 700, fill: tc })}${p.sub ? textBlock(x, 45, p.sub, { size: 10.8, fill: sc }) : ''}`;
  }).join('');
  return `${svgOpen(width, height, id)}${head}${body.join('')}</svg>`;
}

// ---------- Flowchart ----------
// nodes: {id, x, y, w, h, t, kind:'start'|'step'|'decision'|'ext'|'end'|'bad'|'info'}
// edges: {from, to, fp, tp, label, l:[x,y], dashed, bad, via:[[x,y]...]}
function flow({ width, height, nodes, edges, frames = [] }) {
  const id = `f${uid++}`;
  const N = Object.fromEntries(nodes.map((n) => [n.id, { w: 210, h: 54, ...n }]));
  const port = (n, p, dx = 0, dy = 0) => {
    if (p === 't') return [n.x + dx, n.y - n.h / 2];
    if (p === 'b') return [n.x + dx, n.y + n.h / 2];
    if (p === 'l') return [n.x - n.w / 2, n.y + dy];
    return [n.x + n.w / 2, n.y + dy];
  };
  const out = [];
  for (const f of frames) {
    out.push(`<rect x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" rx="12" fill="${f.fill || C.soft}" stroke="${f.stroke || C.line}" stroke-dasharray="6 4"/>`);
    out.push(textBlock(f.x + 12, f.y + 15, f.t, { size: 12, weight: 700, fill: C.brand, anchor: 'start' }));
  }
  for (const e of edges) {
    const a = N[e.from], b = N[e.to];
    const fp = e.fp || 'b', tp = e.tp || 't';
    const [x1, y1] = port(a, fp, e.sdx, e.sdy), [x2, y2] = port(b, tp, e.tdx, e.tdy);
    let d = `M${x1},${y1}`;
    let mid;
    if (e.via) {
      for (const [vx, vy] of e.via) d += ` L${vx},${vy}`;
      d += ` L${x2},${y2}`;
    } else if ((fp === 'b' || fp === 't') && (tp === 't' || tp === 'b')) {
      if (x1 === x2) d += ` L${x2},${y2}`;
      else { const my = (y1 + y2) / 2; d += ` L${x1},${my} L${x2},${my} L${x2},${y2}`; mid = [(x1 + x2) / 2, my]; }
    } else if ((fp === 'r' || fp === 'l') && (tp === 'l' || tp === 'r')) {
      if (y1 === y2) d += ` L${x2},${y2}`;
      else { const mx = (x1 + x2) / 2; d += ` L${mx},${y1} L${mx},${y2} L${x2},${y2}`; mid = [mx, (y1 + y2) / 2]; }
    } else if (fp === 'r' || fp === 'l') {
      d += ` L${x2},${y1} L${x2},${y2}`; mid = [(x1 + x2) / 2, y1];
    } else {
      d += ` L${x1},${y2} L${x2},${y2}`; mid = [x1, (y1 + y2) / 2];
    }
    const color = e.bad ? C.bad : e.dashed ? C.gold : C.brand;
    const mk = e.bad ? 'r' : e.dashed ? 'g' : 'a';
    out.push(`<path d="${d}" fill="none" stroke="${color}" stroke-width="1.5"${e.dashed ? ' stroke-dasharray="5 4"' : ''} marker-end="url(#${id}${mk})"/>`);
    if (e.label) {
      const [lx, ly] = e.l || mid || [(x1 + x2) / 2, (y1 + y2) / 2];
      const w = Math.max(...lines(e.label).map((l) => l.length)) * 6.3 + 12;
      const h = lines(e.label).length * 14.5 + 5;
      out.push(`<rect x="${lx - w / 2}" y="${ly - h / 2}" width="${w}" height="${h}" rx="3" fill="#fff"/>`);
      out.push(textBlock(lx, ly, e.label, { size: 11, weight: 600, fill: e.bad ? C.bad : C.brand }));
    }
  }
  for (const n of Object.values(N)) {
    const { x, y, w, h } = n;
    const k = n.kind || 'step';
    if (k === 'decision') {
      out.push(`<polygon points="${x},${y - h / 2} ${x + w / 2},${y} ${x},${y + h / 2} ${x - w / 2},${y}" fill="${C.goldFill}" stroke="${C.goldLine}" stroke-width="1.4"/>`);
      out.push(textBlock(x, y, n.t, { size: 12, weight: 600, fill: C.dark }));
      continue;
    }
    const style = {
      start: [C.dark, C.dark, '#fff', h / 2], end: [C.okFill, '#9fcfb2', '#1f5a37', h / 2], bad: [C.badFill, '#e0a9a9', '#7a2525', 8],
      ext: [C.goldFill, C.goldLine, C.dark, 8], info: [C.blueFill, '#a9c0d6', C.blue, 8], step: ['#fff', C.line, C.dark, 8],
    }[k];
    out.push(`<rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="${style[3]}" fill="${style[0]}" stroke="${style[1]}" stroke-width="1.4"/>`);
    out.push(textBlock(x, y, n.t, { size: 12.2, weight: k === 'start' ? 700 : 500, fill: style[2] }));
  }
  // Crop the view box to the drawing so narrow diagrams print larger.
  const xs = [], ys = [];
  for (const n of Object.values(N)) { xs.push(n.x - n.w / 2, n.x + n.w / 2); ys.push(n.y - n.h / 2, n.y + n.h / 2); }
  for (const f of frames) { xs.push(f.x, f.x + f.w); ys.push(f.y, f.y + f.h); }
  for (const e of edges) for (const [vx, vy] of e.via || []) { xs.push(vx); ys.push(vy); }
  const x0 = Math.max(0, Math.min(...xs) - 14), x1 = Math.min(width, Math.max(...xs) + 14);
  const y0 = Math.max(0, Math.min(...ys) - 12), y1 = Math.min(height, Math.max(...ys) + 12);
  return `<svg viewBox="${x0} ${y0} ${x1 - x0} ${y1 - y0}" xmlns="http://www.w3.org/2000/svg" font-family="Segoe UI, Arial, sans-serif">${defs(id)}${out.join('')}</svg>`;
}

// ---------- Entity box (for the ER diagram) ----------
function entity(x, y, w, name, fields, { accent = C.brand } = {}) {
  const rowH = 16;
  const h = 26 + fields.length * rowH + 8;
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7" fill="#fff" stroke="${C.line}" stroke-width="1.3"/>`;
  s += `<path d="M${x},${y + 7} a7,7 0 0 1 7,-7 h${w - 14} a7,7 0 0 1 7,7 v19 h-${w} z" fill="${accent}"/>`;
  s += `<text x="${x + w / 2}" y="${y + 17}" font-size="13.5" font-weight="700" fill="#fff" text-anchor="middle">${esc(name)}</text>`;
  fields.forEach((f, i) => {
    const [fname, ftype] = f;
    const ty = y + 26 + 4 + i * rowH + rowH / 2;
    const key = /^(PK|FK|UQ)/.test(ftype || '');
    s += `<text x="${x + 8}" y="${ty}" font-size="11.4" fill="${C.ink}" dominant-baseline="middle"${key ? ' font-weight="700"' : ''}>${esc(fname)}</text>`;
    s += `<text x="${x + w - 8}" y="${ty}" font-size="10.4" fill="${C.muted}" text-anchor="end" dominant-baseline="middle">${esc(ftype || '')}</text>`;
  });
  return { svg: s, h };
}

module.exports = { C, esc, sequence, flow, entity, svgOpen, textBlock, defs };
