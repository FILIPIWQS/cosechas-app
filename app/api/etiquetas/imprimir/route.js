import { LOGO_COSECHAS_PRETO_PNG_B64 } from '../../../../lib/etiquetaAssets';

// Rota "só a etiqueta", sem nada de app em volta — não é usada pela página web
// (que gera PDF). É pensada pra Etapa B (app instalado): ele carrega essa URL
// numa janela escondida, no tamanho exato da etiqueta, e manda imprimir
// silenciosamente. Fica em HTML puro pra não ter nenhum outro elemento na tela.
export const dynamic = 'force-dynamic';

// Mesmo ícone (avocado) do cabeçalho do app — aqui em SVG de verdade, já que
// numa página HTML (diferente do PDF) dá pra usar o SVG original direto.
const SIEMBRAS_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 248" style="display:block;">
  <circle cx="100" cy="158" r="58" fill="none" stroke="#000" stroke-width="29"/>
  <ellipse cx="100" cy="158" rx="19" ry="23" fill="#000"/>
  <path d="M100 139 C93 149 93 167 100 177" fill="none" stroke="#000" stroke-width="3" stroke-linecap="round"/>
  <path d="M100 160 L100 66" fill="none" stroke="#000" stroke-width="8" stroke-linecap="round"/>
  <path d="M100 74 C83 75 56 67 39 45 C35 41 37 34 43 34 C72 37 96 50 100 74 Z" fill="#000"/>
  <path d="M98 72 C81 62 63 52 45 41" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
  <path d="M100 74 C117 75 144 67 161 45 C165 41 163 34 157 34 C128 37 104 50 100 74 Z" fill="#000"/>
  <path d="M102 72 C119 62 137 52 155 41" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
</svg>`;

function partesData(iso) {
  const [ano, mes, dia] = String(iso || '').split('-');
  return { dia: dia || '--', mes: mes || '--', ano: ano || '----' };
}

function esc(str) {
  return String(str || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const produto = searchParams.get('produto') || '';
  const dataManipulacao = searchParams.get('dataManipulacao') || '';
  const dataValidade = searchParams.get('dataValidade') || '';
  const colaborador = searchParams.get('colaborador') || '';
  const larguraMm = Number(searchParams.get('larguraMm')) || 60;
  const alturaMm = Number(searchParams.get('alturaMm')) || 40;

  const manip = partesData(dataManipulacao);
  const validade = partesData(dataValidade);

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
  *{box-sizing:border-box;}
  html,body{margin:0; padding:0; width:${larguraMm}mm; height:${alturaMm}mm; overflow:hidden;}
  body{font-family:Arial, sans-serif; color:#000;}
  .etiqueta{
    --lw:${larguraMm}mm; --lh:${alturaMm}mm;
    width:100%; height:100%; box-sizing:border-box;
    border: calc(var(--lh) * 0.012) solid #000;
    border-radius: calc(var(--lh) * 0.05);
    padding: calc(var(--lw) * 0.045 + 1mm);
    display:flex; flex-direction:column; overflow:hidden;
  }
  .cabecalho{display:flex; flex-direction:column; flex:none;}
  .linha1{display:flex; align-items:flex-start; justify-content:space-between; gap:calc(var(--lw) * 0.03);}
  .logo-cosechas{height:calc(var(--lh) * 0.24); width:calc(var(--lh) * 0.24 * 2.634920634 + 4mm); display:block;}
  .logo-siembras-row{display:flex; align-items:center; gap:calc(var(--lw) * 0.006); flex-shrink:0;}
  .logo-siembras-row svg{height:calc(var(--lh) * 0.24); width:auto; flex-shrink:0;}
  .logo-siembras-row span{font-weight:700; font-size:calc(var(--lh) * 0.19); white-space:nowrap;}
  .titulo{font-weight:700; font-size:calc(var(--lh) * 0.19 + 1mm); text-align:center; line-height:1.05; margin-top:calc(var(--lh) * 0.072);}
  .corpo{flex:1; display:flex; flex-direction:column; justify-content:space-evenly;}
  .linha{font-weight:700; font-size:calc(var(--lh) * 0.08); line-height:1.2;}
  .linha .valor{font-weight:800; border-bottom: calc(var(--lh) * 0.007) solid #000; padding-bottom:1px;}
</style>
</head>
<body>
  <div class="etiqueta">
    <div class="cabecalho">
      <div class="linha1">
        <img class="logo-cosechas" src="data:image/png;base64,${LOGO_COSECHAS_PRETO_PNG_B64}" alt="cosechas">
        <div class="logo-siembras-row">${SIEMBRAS_ICON_SVG}<span>siembras</span></div>
      </div>
      <div class="titulo">ETIQUETA DE MANIPULAÇÃO</div>
    </div>
    <div class="corpo">
      <div class="linha">Produto: <span class="valor">${esc(produto)}</span></div>
      <div class="linha">Data de manipulação: <span class="valor">${esc(manip.dia)}</span>/<span class="valor">${esc(manip.mes)}</span>/<span class="valor">${esc(manip.ano)}</span></div>
      <div class="linha">Válido até: <span class="valor">${esc(validade.dia)}</span>/<span class="valor">${esc(validade.mes)}</span>/<span class="valor">${esc(validade.ano)}</span></div>
      <div class="linha">Colaborador: <span class="valor">${esc(colaborador) || '—'}</span></div>
    </div>
  </div>
</body>
</html>`;

  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
