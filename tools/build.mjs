// Bundles the game into a single self-contained HTML file.
//   dist/index.html    – full document (open directly, host anywhere, wrap with Capacitor)
//   dist/fragment.html – same page without <html>/<head>/<body>, for embedding hosts
import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FONT = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IM+Fell+English+SC&family=IM+Fell+English:ital@0;1&display=swap">';

async function make() {
  const out = await build({
    entryPoints: [path.join(root, 'src/main.js')],
    bundle: true, minify: true, format: 'iife', target: 'es2020', write: false, legalComments: 'none',
  });
  const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const css = await readFile(path.join(root, 'src/style.css'), 'utf8');
  const body = await readFile(path.join(root, 'src/body.html'), 'utf8');
  const head = `<title>Pirate's Life</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n${FONT}\n<style>\n${css}\n</style>`;
  const page = `${body}\n<script>\n${js}\n</script>`;
  const full = `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n` +
    `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">\n` +
    `<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="mobile-web-app-capable" content="yes">\n<meta name="theme-color" content="#0b1418">\n` +
    `${head}\n</head>\n<body>\n${page}\n</body>\n</html>\n`;
  await mkdir(path.join(root, 'dist'), { recursive: true });
  await writeFile(path.join(root, 'dist/index.html'), full);
  await writeFile(path.join(root, 'dist/fragment.html'), `${head}\n${page}\n`);
  return full;
}

if (process.argv.includes('--serve')) {
  const port = Number(process.env.PORT || 5173);
  createServer(async (req, res) => {
    try {
      const html = await make();
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      res.end(html);
    } catch (e) {
      res.writeHead(500, { 'content-type': 'text/plain' });
      res.end(String(e && e.message || e));
    }
  }).listen(port, () => console.log(`Pirate's Life dev server: http://localhost:${port}`));
} else {
  const html = await make();
  console.log(`built dist/index.html (${(html.length / 1024).toFixed(0)} KB)`);
}
