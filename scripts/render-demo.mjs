// Renders the real `told demo` output to docs/assets/demo.svg (no screenshots, no fake output).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { main } from '../src/cli.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root); // keeps instruction-file paths relative in the output

const lines = [];
await main(['demo', '--limit', '6'], { out: (s) => lines.push(...s.split('\n')), err: () => {}, isTTY: true });

const COLORS = { 31: '#ff7b72', 32: '#7ee787', 33: '#e3b341', 36: '#79c0ff' };
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function spans(line) {
  let bold = false;
  let dim = false;
  let color = '';
  let out = '';
  for (const part of line.split(/(\u001b\[\d+m)/)) {
    const m = /^\u001b\[(\d+)m$/.exec(part);
    if (m) {
      const c = Number(m[1]);
      if (c === 1) bold = true;
      else if (c === 2) dim = true;
      else if (c === 22) (bold = false), (dim = false);
      else if (c === 39) color = '';
      else if (COLORS[c]) color = COLORS[c];
    } else if (part) {
      const fill = color || (dim ? '#8b949e' : '#e6edf3');
      out += `<tspan fill="${fill}"${bold ? ' font-weight="700"' : ''}>${esc(part)}</tspan>`;
    }
  }
  return out;
}

const cmd = '<tspan fill="#7ee787">$</tspan> <tspan fill="#e6edf3">npx github:Nithinfgs/told-twice demo</tspan>';
const lh = 20;
const top = 56;
const width = 940;
const height = top + (lines.length + 2) * lh + 24;
const body = [`<text x="24" y="${top}" xml:space="preserve">${cmd}</text>`]
  .concat(lines.map((l, i) => `<text x="24" y="${top + (i + 2) * lh}" xml:space="preserve">${spans(l)}</text>`))
  .join('\n');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="told-twice demo output: repeated instructions ranked, marked MISSING or IGNORED">
<rect width="${width}" height="${height}" rx="10" fill="#0d1117"/>
<rect width="${width}" height="32" rx="10" fill="#161b22"/><rect y="22" width="${width}" height="10" fill="#161b22"/>
<circle cx="20" cy="16" r="6" fill="#ff5f56"/><circle cx="40" cy="16" r="6" fill="#ffbd2e"/><circle cx="60" cy="16" r="6" fill="#27c93f"/>
<g font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace" font-size="13">
${body}
</g></svg>
`;
mkdirSync(join(root, 'docs', 'assets'), { recursive: true });
writeFileSync(join(root, 'docs', 'assets', 'demo.svg'), svg);
console.log(`wrote docs/assets/demo.svg (${svg.length} bytes, ${lines.length} lines)`);
