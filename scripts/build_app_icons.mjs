import sharp from 'sharp';
import { mkdir, readFile } from 'node:fs/promises';
const logo = await readFile(new URL('../app/icon.svg', import.meta.url), 'utf8');
const output = new URL('../public/icons/', import.meta.url);
await mkdir(output, { recursive: true });
for (const [file, size] of [['app-192.png', 192], ['app-512.png', 512], ['maskable-512.png', 512], ['apple-touch-icon.png', 180]]) {
  // Inset the authored mark inside the maskable safe area; use an opaque brand field.
  const mark = logo.replace(/<svg[^>]*>/, '<g transform="translate(102.4 102.4) scale(.8)">').replace('</svg>', '</g>');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="#203029"/>${mark}</svg>`;
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(new URL(file, output).pathname);
}
console.log('Built four opaque app icons from the existing Arklyn mark.');
