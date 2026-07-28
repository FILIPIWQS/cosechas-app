import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { LOGO_COSECHAS_PRETO_PNG_B64 } from './etiquetaAssets';

// 1mm = 2.8346456693pt — é essa conversão que garante que a página do PDF já
// nasça no tamanho físico exato da etiqueta, sem depender de "retrato/paisagem"
// de caixa de diálogo nenhuma.
const MM_TO_PT = 2.8346456693;
const BLACK = rgb(0, 0, 0);
const WHITE = rgb(1, 1, 1);

// Mesmo ícone (avocado) usado no cabeçalho do app, viewBox 200x248, redesenhado
// aqui com as funções nativas do pdf-lib em vez de um arquivo de imagem.
const SIEMBRAS_VIEWBOX = { w: 200, h: 248 };

// pdf-lib não tem um "retângulo arredondado" pronto, então desenhamos o
// contorno como um caminho (4 lados retos + 4 cantos em curva).
function drawRoundedRectBorder(page, { x, y, width, height, radius, borderColor, borderWidth }) {
  const r = Math.min(radius, width / 2, height / 2);
  const path = `M ${r} 0 L ${width - r} 0 A ${r} ${r} 0 0 1 ${width} ${r} L ${width} ${height - r} A ${r} ${r} 0 0 1 ${width - r} ${height} L ${r} ${height} A ${r} ${r} 0 0 1 0 ${height - r} L 0 ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;
  page.drawSvgPath(path, { x, y: y + height, scale: 1, borderColor, borderWidth });
}

function drawSiembrasIcon(page, { x, yTop, height }) {
  const scale = height / SIEMBRAS_VIEWBOX.h;
  const opts = { x, y: yTop, scale };
  const cx = x + 100 * scale;
  const cy = yTop - 158 * scale;
  page.drawEllipse({ x: cx, y: cy, xScale: 58 * scale, yScale: 58 * scale, borderColor: BLACK, borderWidth: 29 * scale });
  page.drawEllipse({ x: cx, y: cy, xScale: 19 * scale, yScale: 23 * scale, color: BLACK });
  page.drawSvgPath('M100 139 C93 149 93 167 100 177', { ...opts, borderColor: BLACK, borderWidth: 3 * scale });
  page.drawSvgPath('M100 160 L100 66', { ...opts, borderColor: BLACK, borderWidth: 8 * scale });
  page.drawSvgPath('M100 74 C83 75 56 67 39 45 C35 41 37 34 43 34 C72 37 96 50 100 74 Z', { ...opts, color: BLACK });
  page.drawSvgPath('M98 72 C81 62 63 52 45 41', { ...opts, borderColor: WHITE, borderWidth: 3 * scale });
  page.drawSvgPath('M100 74 C117 75 144 67 161 45 C165 41 163 34 157 34 C128 37 104 50 100 74 Z', { ...opts, color: BLACK });
  page.drawSvgPath('M102 72 C119 62 137 52 155 41', { ...opts, borderColor: WHITE, borderWidth: 3 * scale });
  return SIEMBRAS_VIEWBOX.w * scale;
}

function partesData(iso) {
  const [ano, mes, dia] = String(iso || '').split('-');
  return { dia: dia || '--', mes: mes || '--', ano: ano || '----' };
}

// Desenha um texto e, se pedido, sublinha exatamente a largura dele — é assim
// que "Produto: ___", os números de data e "Colaborador: ___" ficam com o
// traço embaixo só do valor, igual ao protótipo original.
function drawSegment(page, { x, y, text, font, size, underline }) {
  page.drawText(text, { x, y, size, font, color: BLACK });
  const width = font.widthOfTextAtSize(text, size);
  if (underline) {
    const thickness = Math.max(0.6, size * 0.06);
    page.drawLine({
      start: { x, y: y - size * 0.16 },
      end: { x: x + width, y: y - size * 0.16 },
      thickness,
      color: BLACK,
    });
  }
  return x + width;
}

function lineWidth(fontReg, fontBold, size, parts) {
  return parts.reduce((sum, p) => sum + (p.bold ? fontBold : fontReg).widthOfTextAtSize(p.text, size), 0);
}

function linhaData(label, iso) {
  const d = partesData(iso);
  return [
    { text: label, bold: false, underline: false },
    { text: d.dia, bold: true, underline: true },
    { text: '/', bold: false, underline: false },
    { text: d.mes, bold: true, underline: true },
    { text: '/', bold: false, underline: false },
    { text: d.ano, bold: true, underline: true },
  ];
}

// Monta as "partes" de cada linha do corpo (label normal + valores em negrito,
// com data quebrada em dia/mês/ano cada um sublinhado à parte e a barra "/" solta).
function buildLinesManipulacao(registro) {
  const colaborador = registro.colaborador || '—';
  return [
    [
      { text: 'Produto: ', bold: false, underline: false },
      { text: registro.produto || '', bold: true, underline: true },
    ],
    linhaData('Data de manipulação: ', registro.dataManipulacao),
    linhaData('Válido até: ', registro.dataValidade),
    [
      { text: 'Colaborador: ', bold: false, underline: false },
      { text: colaborador, bold: true, underline: true },
    ],
  ];
}

// registro: { produto, fornecedor, lote, sif, dataValidadeOriginal (ISO yyyy-mm-dd),
// dataManipulacao, dataValidade, colaborador }
function buildLinesProcedencia(registro) {
  const colaborador = registro.colaborador || '—';
  return [
    [
      { text: 'Produto: ', bold: false, underline: false },
      { text: registro.produto || '', bold: true, underline: true },
    ],
    [
      { text: 'Fornecedor/Marca: ', bold: false, underline: false },
      { text: registro.fornecedor || '', bold: true, underline: true },
    ],
    [
      { text: 'Lote: ', bold: false, underline: false },
      { text: registro.lote || '', bold: true, underline: true },
      { text: '   SIF: ', bold: false, underline: false },
      { text: registro.sif || '', bold: true, underline: true },
    ],
    linhaData('Validade original (embalagem): ', registro.dataValidadeOriginal),
    linhaData('Data de manipulação: ', registro.dataManipulacao),
    linhaData('Válido até: ', registro.dataValidade),
    [
      { text: 'Colaborador: ', bold: false, underline: false },
      { text: colaborador, bold: true, underline: true },
    ],
  ];
}

// "cosechas" no canto esquerdo e "siembras" no canto direito ficam na mesma
// linha (só não podem se encostar); o título fica centralizado numa linha só
// dele, embaixo dos dois — por isso só precisa caber sozinho na largura toda.
function headerFitsAtScale(scale, { fontBold, innerWidth, logoImg, logoHeight, siembrasHeight, tituloSize, titulo }) {
  const logoW = logoHeight * scale * (logoImg.width / logoImg.height);
  const tituloW = fontBold.widthOfTextAtSize(titulo, tituloSize * scale);
  const iconW = (siembrasHeight * scale) * (SIEMBRAS_VIEWBOX.w / SIEMBRAS_VIEWBOX.h);
  const siembrasTextW = fontBold.widthOfTextAtSize('siembras', siembrasHeight * scale * 0.8);
  const siembrasRowW = iconW + innerWidth * 0.006 + siembrasTextW;
  const linhaDeCimaCabe = logoW + innerWidth * 0.03 + siembrasRowW <= innerWidth;
  const tituloCabe = tituloW <= innerWidth;
  return linhaDeCimaCabe && tituloCabe;
}

// Maior tamanho de fonte que ainda cabe na largura da etiqueta pra essa linha
// (a largura de um texto cresce de forma linear com o tamanho da fonte, então
// dá pra calcular direto em vez de ir tentando tamanho por tamanho).
function maxSizeForLineWidth(fontReg, fontBold, parts, innerWidth) {
  const widthAt1 = lineWidth(fontReg, fontBold, 1, parts);
  if (widthAt1 <= 0) return Infinity;
  return innerWidth / widthAt1;
}

async function drawEtiqueta(page, { titulo, lines }, { fontReg, fontBold, logoImg, wPt, hPt, padEsquerdaAjusteMm = 0 }) {
  const padX = wPt * 0.045 + 1 * MM_TO_PT;
  const padY = padX; // mesmo espaço da borda até o conteúdo nos 4 lados
  // Encolhe a área útil pela esquerda (borda + conteúdo juntos), pra compensar
  // corte da impressora nessa lateral — a direita não muda.
  const leftOffset = padEsquerdaAjusteMm * MM_TO_PT;
  const innerLeft = padX + leftOffset;
  const innerRight = wPt - padX;
  const innerWidth = innerRight - innerLeft;

  const borderWidth = Math.max(0.75, hPt * 0.012);
  // Encolhe só a moldura (a linha da borda) 1mm pra dentro em cada lado —
  // o texto/conteúdo não muda de lugar, só a borda fica mais recuada.
  const molduraInset = 1 * MM_TO_PT;
  drawRoundedRectBorder(page, {
    x: borderWidth / 2 + leftOffset + molduraInset,
    y: borderWidth / 2 + molduraInset,
    width: wPt - borderWidth - leftOffset - 2 * molduraInset,
    height: hPt - borderWidth - 2 * molduraInset,
    radius: hPt * 0.05,
    borderWidth,
    borderColor: BLACK,
  });

  const siembrasHeightBase = hPt * 0.24;
  const logoHeightBase = siembrasHeightBase; // "cosechas" sempre do mesmo tamanho que "siembras"
  const tituloSizeBase = hPt * 0.19 + 1 * MM_TO_PT;
  const n = lines.length;

  // Cabeçalho: tamanho fixo (não muda), só encolhe no caso raro de não caber.
  let headerScale = 1;
  const headerOpts = { fontBold, innerWidth, logoImg, logoHeight: logoHeightBase, siembrasHeight: siembrasHeightBase, tituloSize: tituloSizeBase, titulo };
  for (let i = 0; i < 24 && headerScale > 0.35 && !headerFitsAtScale(headerScale, headerOpts); i++) {
    headerScale -= 0.04;
  }
  const logoHeight = logoHeightBase * headerScale;
  const siembrasHeight = siembrasHeightBase * headerScale;
  const tituloSize = tituloSizeBase * headerScale;

  // Posições do cabeçalho calculadas primeiro, porque o corpo começa
  // exatamente onde o título termina — nada de espaço sobrando.
  // Linha 1: "cosechas" no canto esquerdo, "siembras" no canto direito.
  const topOfHeader = hPt - padY;
  const logoWidth = logoHeight * (logoImg.width / logoImg.height) + 4 * MM_TO_PT;
  const logoImgY = topOfHeader - logoHeight;
  const iconWidth = siembrasHeight * (SIEMBRAS_VIEWBOX.w / SIEMBRAS_VIEWBOX.h);
  const siembrasTextSize = siembrasHeight * 0.8;
  const siembrasTextWidth = fontBold.widthOfTextAtSize('siembras', siembrasTextSize);
  const siembrasRowWidth = iconWidth + innerWidth * 0.006 + siembrasTextWidth;
  const siembrasRowX = innerRight - siembrasRowWidth;
  const siembrasIconY = topOfHeader - siembrasHeight;

  // Linha 2: título centralizado, embaixo da linha 1.
  const linha1Bottom = topOfHeader - Math.max(logoHeight, siembrasHeight);
  const tituloTop = linha1Bottom - Math.max(logoHeight, siembrasHeight) * 0.3;

  // Corpo: a fonte cresce até o limite que a linha mais larga permitir (nunca
  // estoura a largura da etiqueta) e qualquer espaço que sobrar na altura vira
  // espaçamento entre as linhas, em vez de ficar vazio embaixo.
  const corpoTop = tituloTop - tituloSize * 1.05;
  const disponivel = Math.max(0, corpoTop - padY);
  const GAP_RATIO_MIN = 0.05;

  const maiorSizeQueCabeNaLargura = Math.min(...lines.map((parts) => maxSizeForLineWidth(fontReg, fontBold, parts, innerWidth)));
  const maiorSizeQueCabeNaAltura = disponivel / (n * (1 + GAP_RATIO_MIN));
  const linhaSize = Math.max(1, Math.min(maiorSizeQueCabeNaLargura, maiorSizeQueCabeNaAltura));

  const lineHeight = linhaSize;
  const gap = Math.max(GAP_RATIO_MIN * linhaSize, (disponivel - n * lineHeight) / n);

  // Cabeçalho: "cosechas" no canto esquerdo, "siembras" no canto direito
  // (mesma linha), e o título centralizado numa linha só dele, embaixo dos dois.
  page.drawImage(logoImg, { x: innerLeft, y: logoImgY, width: logoWidth, height: logoHeight });
  drawSiembrasIcon(page, { x: siembrasRowX, yTop: topOfHeader, height: siembrasHeight });
  page.drawText('siembras', {
    x: siembrasRowX + iconWidth + innerWidth * 0.006,
    y: siembrasIconY + siembrasHeight * 0.15,
    size: siembrasTextSize,
    font: fontBold,
    color: BLACK,
  });
  const tituloWidth = fontBold.widthOfTextAtSize(titulo, tituloSize);
  page.drawText(titulo, {
    x: innerLeft + (innerWidth - tituloWidth) / 2,
    y: tituloTop - tituloSize * 0.8,
    size: tituloSize,
    font: fontBold,
    color: BLACK,
  });

  lines.forEach((parts, i) => {
    const slotTop = corpoTop - (i + 1) * gap - i * lineHeight;
    const baseline = slotTop - lineHeight * 0.8;
    let x = innerLeft;
    for (const part of parts) {
      x = drawSegment(page, {
        x,
        y: baseline,
        text: part.text,
        font: part.bold ? fontBold : fontReg,
        size: linhaSize,
        underline: part.underline,
      });
    }
  });
}

async function buildPdf(titulo, lines, quantidade, larguraMm, alturaMm, padEsquerdaAjusteMm = 0) {
  const doc = await PDFDocument.create();
  const fontReg = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logoImg = await doc.embedPng(Buffer.from(LOGO_COSECHAS_PRETO_PNG_B64, 'base64'));

  const wPt = larguraMm * MM_TO_PT;
  const hPt = alturaMm * MM_TO_PT;
  const qtd = Math.max(1, Number(quantidade) || 1);

  for (let i = 0; i < qtd; i++) {
    const page = doc.addPage([wPt, hPt]);
    await drawEtiqueta(page, { titulo, lines }, { fontReg, fontBold, logoImg, wPt, hPt, padEsquerdaAjusteMm });
  }

  return doc.save();
}

// registro: { produto, dataManipulacao, dataValidade, colaborador } (datas em ISO yyyy-mm-dd)
export async function buildEtiquetaPdf(registro, quantidade, larguraMm, alturaMm) {
  return buildPdf('ETIQUETA DE MANIPULAÇÃO', buildLinesManipulacao(registro), quantidade, larguraMm, alturaMm);
}

// registro: { produto, fornecedor, lote, sif, dataValidadeOriginal, dataManipulacao, dataValidade, colaborador }
// margem esquerda 0.5mm menor que as outras 3 laterais, a pedido do usuário.
export async function buildProcedenciaPdf(registro, quantidade, larguraMm, alturaMm) {
  return buildPdf('ETIQUETA DE PROCEDÊNCIA', buildLinesProcedencia(registro), quantidade, larguraMm, alturaMm, 0.5);
}

// Impressão em lote: um PDF só, com uma página por registro (registros
// diferentes entre si, ao contrário de buildPdf que repete o mesmo N vezes).
// Não mexe em nada da lógica de desenho — só chama drawEtiqueta várias vezes.
async function buildLotePdf(itens, larguraMm, alturaMm) {
  const doc = await PDFDocument.create();
  const fontReg = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logoImg = await doc.embedPng(Buffer.from(LOGO_COSECHAS_PRETO_PNG_B64, 'base64'));

  const wPt = larguraMm * MM_TO_PT;
  const hPt = alturaMm * MM_TO_PT;

  for (const item of itens) {
    const page = doc.addPage([wPt, hPt]);
    await drawEtiqueta(page, { titulo: item.titulo, lines: item.lines }, {
      fontReg, fontBold, logoImg, wPt, hPt, padEsquerdaAjusteMm: item.padEsquerdaAjusteMm || 0,
    });
  }

  return doc.save();
}

// registros: [{ produto, dataManipulacao, dataValidade, colaborador }, ...]
export async function buildEtiquetasLotePdf(registros, larguraMm, alturaMm) {
  const itens = registros.map((r) => ({ titulo: 'ETIQUETA DE MANIPULAÇÃO', lines: buildLinesManipulacao(r) }));
  return buildLotePdf(itens, larguraMm, alturaMm);
}

// registros: [{ produto, fornecedor, lote, sif, dataValidadeOriginal, dataManipulacao, dataValidade, colaborador }, ...]
export async function buildProcedenciasLotePdf(registros, larguraMm, alturaMm) {
  const itens = registros.map((r) => ({ titulo: 'ETIQUETA DE PROCEDÊNCIA', lines: buildLinesProcedencia(r), padEsquerdaAjusteMm: 0.5 }));
  return buildLotePdf(itens, larguraMm, alturaMm);
}
