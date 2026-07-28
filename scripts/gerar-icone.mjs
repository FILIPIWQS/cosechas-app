import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import fs from 'fs';
import path from 'path';

const svg = fs.readFileSync('app/icon.svg', 'utf-8');
// Fundo branco redondo atrás do ícone, senão a transparência vira preto
// sólido em alguns lugares (bandeja do Windows, ícone do instalador).
const svgComFundo = svg.replace(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 248" aria-label="Siembras">',
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 248" aria-label="Siembras"><rect width="200" height="248" fill="white" rx="24"/>'
);

fs.mkdirSync('electron/build', { recursive: true });

const tamanhos = [16, 24, 32, 48, 64, 128, 256];
const buffers = [];
for (const tamanho of tamanhos) {
  const buf = await sharp(Buffer.from(svgComFundo)).resize(tamanho, tamanho).png().toBuffer();
  buffers.push(buf);
}
const icoBuffer = await pngToIco(buffers);
fs.writeFileSync('electron/build/icon.ico', icoBuffer);

// Também um PNG 256x256 solto, útil pro ícone da bandeja (tray) direto.
await sharp(Buffer.from(svgComFundo)).resize(256, 256).png().toFile('electron/build/icon.png');

console.log('Ícone gerado em electron/build/icon.ico e icon.png');
