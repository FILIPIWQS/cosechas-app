const path = require('path');
const http = require('http');
const { app, BrowserWindow, Tray, Menu, nativeImage, session } = require('electron');
const { autoUpdater } = require('electron-updater');

const PORT = 3500;
const ABERTO_NA_INICIALIZACAO = process.argv.includes('--hidden') || app.getLoginItemSettings().wasOpenedAtLogin;

// Sem isso, a pasta de dados usa o nome do package.json ("cosechas-estoque")
// em vez do nome de marca do produto — só cosmético, mas confunde quem for
// procurar a pasta depois.
app.setName('Siembras Etiquetas');

// Pasta de dados do usuário (gravável sem admin) — o SQLite grava aqui
// dentro do app empacotado, em vez da pasta de instalação.
process.env.ETIQUETAS_DATA_DIR = path.join(app.getPath('userData'), 'data');
process.env.NODE_ENV = 'production';

// Token do bot de Telegram (aviso de etiqueta vencendo) — precisa estar
// disponível dentro do instalador, já que o .env.local de desenvolvimento
// não vai junto no pacote gerado pelo electron-builder. Sem isso, o app
// empacotado nunca manda aviso nenhum (falha silenciosa: "bot_nao_configurado").
if (!process.env.TELEGRAM_BOT_TOKEN) {
  process.env.TELEGRAM_BOT_TOKEN = '8695773971:AAG1xY8C31xhpuJu6Vzt9Ii0tp8GwLH9eLg';
}

let janela = null;
let bandeja = null;
let saindoDeVerdade = false;

async function iniciarServidorNext() {
  // Roda o Next.js dentro do próprio processo do Electron (mesmo Node),
  // em vez de abrir um processo filho separado — mais simples e confiável
  // dentro do app empacotado.
  const next = require('next');
  const nextApp = next({ dev: false, dir: path.join(__dirname, '..') });
  const handle = nextApp.getRequestHandler();
  await nextApp.prepare();
  const servidor = http.createServer((req, res) => handle(req, res));
  await new Promise((resolve) => servidor.listen(PORT, '127.0.0.1', resolve));
}

function criarJanela({ mostrar }) {
  janela = new BrowserWindow({
    width: 1200,
    height: 800,
    show: mostrar,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      backgroundThrottling: false, // mantém os timers de aviso rodando com a janela escondida/minimizada
    },
  });
  janela.loadURL(`http://localhost:${PORT}/etiquetas`);

  // Fechar a janela (X) minimiza pra bandeja em vez de encerrar o programa
  // — só sai de verdade pelo menu da bandeja ("Sair").
  janela.on('close', (evento) => {
    if (!saindoDeVerdade) {
      evento.preventDefault();
      janela.hide();
    }
  });
}

function criarBandeja() {
  const icone = nativeImage.createFromPath(path.join(__dirname, 'build', 'icon.png'));
  bandeja = new Tray(icone.resize({ width: 16, height: 16 }));
  bandeja.setToolTip('Siembras — Controle de Etiquetas');
  bandeja.setContextMenu(Menu.buildFromTemplate([
    {
      label: 'Abrir',
      click: () => {
        if (janela) { janela.show(); janela.focus(); }
      },
    },
    { type: 'separator' },
    {
      label: 'Sair',
      click: () => {
        saindoDeVerdade = true;
        app.quit();
      },
    },
  ]));
  bandeja.on('double-click', () => {
    if (janela) { janela.show(); janela.focus(); }
  });
}

// Atualização automática via GitHub Releases — silenciosa de propósito
// (a loja não precisa saber que existe atualização rodando). Baixa sozinho
// em segundo plano e só instala na próxima vez que o app fechar de verdade
// (reinício do Windows ou "Sair" na bandeja), nunca interrompendo quem
// estiver usando a janela. "error" precisa de listener sempre — sem isso,
// qualquer falha de rede derruba o processo inteiro.
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.on('error', () => {});

function iniciarAutoUpdate() {
  if (!app.isPackaged) return; // em dev não existe app-update.yml, checkForUpdates só falharia
  autoUpdater.checkForUpdates().catch(() => {});
  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 4 * 60 * 60 * 1000);
}

app.whenReady().then(async () => {
  // Garante que o Windows abre o app sozinho ao ligar o computador, em
  // segundo plano (não abrindo a janela sozinha toda vez que liga).
  app.setLoginItemSettings({ openAtLogin: true, args: ['--hidden'] });

  // Aprova a notificação de desktop sozinho, sem depender de alguém abrir a
  // janela e clicar em "Ativar avisos" — a página só carrega conteúdo nosso
  // (não é navegador genérico), então não tem risco em conceder isso direto.
  // Sem isso, o pop-up de etiqueta vencendo só funcionava depois desse clique manual.
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => permission === 'notifications');
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'notifications');
  });

  await iniciarServidorNext();
  criarJanela({ mostrar: !ABERTO_NA_INICIALIZACAO });
  criarBandeja();
  iniciarAutoUpdate();
});

app.on('window-all-closed', () => {
  // Não encerra o app quando a janela fecha (fica rodando na bandeja) —
  // só o menu "Sair" da bandeja encerra de verdade.
});
