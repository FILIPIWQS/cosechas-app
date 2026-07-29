'use client';

import { useEffect, useRef, useState } from 'react';
import { DEFAULT_STORE } from '../../lib/stores';

// O app instalado roda direto no computador de uma loja só, então não existe
// escolha de loja aqui — cada instalação já "sabe" qual loja é a dela.
const STORE_ID = DEFAULT_STORE;

const DIAS_ALERTA = 2;

// Produtos de manipulação que a loja produz internamente (compra in natura,
// descasca/porciona, congela e guarda no estoque — não são as cubas de
// exposição, que têm etiqueta própria trocada em grupo). Cada lote produzido
// é rastreado à parte, na aba "Produção", que permite várias etiquetas ativas
// do mesmo produto ao mesmo tempo (lotes diferentes no estoque).
const PRODUTOS_PRODUCAO = [
  'Hortelã', 'Aipo',
  'Maçã congelada', 'Abacate congelado', 'Mamão congelado', 'Melancia congelada',
  'Pêssego congelado', 'Abacaxi congelado', 'Banana congelada', 'Kiwi congelado',
  'Gengibre congelado', 'Laranja congelada', 'Uva verde congelada',
  'Uva vermelha congelada', 'Cenoura congelada', 'Beterraba congelada', 'Pepino',
];

function playAlert() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const beep = (t, freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'square';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.setValueAtTime(0, t + 0.17);
      osc.start(t);
      osc.stop(t + 0.17);
    };
    const t = ctx.currentTime;
    [0, 0.2, 0.4, 0.6, 0.8, 1.0].forEach((offset, i) => {
      beep(t + offset, i % 2 === 0 ? 1040 : 784);
    });
  } catch (e) {}
}

function hojeISO() {
  // new Date().toISOString() dá a data em UTC — perto da meia-noite local
  // (21h-23h59 no horário de Brasília) o UTC já virou o dia seguinte, o que
  // fazia etiquetas ainda válidas aparecerem como vencendo/vencidas um dia
  // antes da hora. Usa os componentes locais da data em vez disso.
  const d = new Date();
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function formatarBR(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function diasEntre(isoA, isoB) {
  const a = new Date(`${isoA}T00:00:00`);
  const b = new Date(`${isoB}T00:00:00`);
  return Math.round((b - a) / 86400000);
}

// Numa troca antecipada, acha a data de validade que o resto do grupo (mesma
// duração dias-a-dias) já está usando, pra nova etiqueta entrar alinhada em
// vez de criar uma data só dela — evita o grupo desalinhar com o tempo.
function dataValidadeDoGrupo(listaCompleta, itensSendoTrocados) {
  const duracaoAntiga = diasEntre(itensSendoTrocados[0].dataManipulacao, itensSendoTrocados[0].dataValidade);
  const idsTrocados = new Set(itensSendoTrocados.map((e) => e.id));
  const outrosDoGrupo = listaCompleta.filter(
    (e) => !idsTrocados.has(e.id) && diasEntre(e.dataManipulacao, e.dataValidade) === duracaoAntiga
  );
  if (outrosDoGrupo.length === 0) return null;
  return outrosDoGrupo.reduce((a, b) => (a.dataValidade < b.dataValidade ? a : b)).dataValidade;
}

export default function EtiquetasPage() {
  const [aba, setAba] = useState('ativas');
  const [produtos, setProdutos] = useState([]);
  const [etiquetas, setEtiquetas] = useState([]);
  const [procedencias, setProcedencias] = useState([]);
  const [config, setConfig] = useState({ larguraMm: 60, alturaMm: 40, nomeLoja: '' });
  const [loading, setLoading] = useState(true);

  const [produtoId, setProdutoId] = useState('');
  const [dias, setDias] = useState('');
  const [dataManip, setDataManip] = useState(hojeISO());
  const [colaborador, setColaborador] = useState('');
  const [qtdNova, setQtdNova] = useState(1);
  const [salvando, setSalvando] = useState(false);
  const [erroNova, setErroNova] = useState('');

  const [producao, setProducao] = useState([]);
  const [producaoProdutoId, setProducaoProdutoId] = useState('');
  const [producaoDias, setProducaoDias] = useState('');
  const [producaoDataManip, setProducaoDataManip] = useState(hojeISO());
  const [producaoColaborador, setProducaoColaborador] = useState('');
  const [producaoQtdNova, setProducaoQtdNova] = useState(1);
  const [producaoSalvando, setProducaoSalvando] = useState(false);
  const [erroProducao, setErroProducao] = useState('');
  const [qtdReimprimirProducao, setQtdReimprimirProducao] = useState({});

  const [procProdutoId, setProcProdutoId] = useState('');
  const [procDias, setProcDias] = useState('');
  const [procFornecedor, setProcFornecedor] = useState('');
  const [procLote, setProcLote] = useState('');
  const [procSif, setProcSif] = useState('');
  const [procDataValidadeOriginal, setProcDataValidadeOriginal] = useState('');
  const [procDataManip, setProcDataManip] = useState(hojeISO());
  const [procColaborador, setProcColaborador] = useState('');
  const [procQtdNova, setProcQtdNova] = useState(1);
  const [procSalvando, setProcSalvando] = useState(false);
  const [erroProc, setErroProc] = useState('');
  const [qtdReimprimirProc, setQtdReimprimirProc] = useState({});
  const [grupoProcWizard, setGrupoProcWizard] = useState(null); // { produtos, indice, diasNum, dataManipulacao, colaborador, novosIds } | null
  const [grupoProcCampo, setGrupoProcCampo] = useState({ fornecedor: '', lote: '', sif: '', dataValidadeOriginal: '' });

  const [novoNome, setNovoNome] = useState('');
  const [novoDias, setNovoDias] = useState('');
  const [novoTipo, setNovoTipo] = useState('manipulacao');

  const [cfgLargura, setCfgLargura] = useState(60);
  const [cfgAltura, setCfgAltura] = useState(40);
  const [cfgNomeLoja, setCfgNomeLoja] = useState('');
  const [nomeLojaInicial, setNomeLojaInicial] = useState('');
  const [salvandoNomeLojaInicial, setSalvandoNomeLojaInicial] = useState(false);

  const [telegramChats, setTelegramChats] = useState([]);
  const [telegramCandidatos, setTelegramCandidatos] = useState([]);
  const [telegramDetectando, setTelegramDetectando] = useState(false);
  const [telegramSalvando, setTelegramSalvando] = useState(false);

  const [qtdReimprimir, setQtdReimprimir] = useState({});

  const [reminderOpen, setReminderOpen] = useState(false);
  const [confirmacaoTroca, setConfirmacaoTroca] = useState(null); // { mensagem, aoConfirmar } | null
  const [pedirColaboradorLote, setPedirColaboradorLote] = useState(null); // { mensagem, aoConfirmar } | null
  const [colaboradorLoteInput, setColaboradorLoteInput] = useState('');
  const [pedirDadosLoteProcedencia, setPedirDadosLoteProcedencia] = useState(null); // { itens } | null
  const [dadosLoteProcedenciaForm, setDadosLoteProcedenciaForm] = useState({}); // { [id]: {colaborador, fornecedor, lote, sif, dataValidadeOriginal} }
  const etiquetasRef = useRef([]);
  const procedenciasRef = useRef([]);
  const producaoRef = useRef([]);
  const didFirstReminder = useRef(false);
  // Trava contra envio duplicado quando duas checagens rodam sobrepostas
  // (ex: Strict Mode do React em dev, ou o intervalo de 5min coincidindo
  // com o carregamento inicial) — guarda "id:tipo" que já está em voo.
  const avisosEmVooRef = useRef(new Set());
  // Controle do aviso sonoro/notificação local (véspera uma vez, dia a cada 15min).
  const alertaLocalVesperaRef = useRef(new Set());
  const ultimoAlertaDiaRef = useRef(0);

  useEffect(() => {
    carregarTudo();
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    etiquetasRef.current = etiquetas;
  }, [etiquetas]);

  useEffect(() => {
    procedenciasRef.current = procedencias;
  }, [procedencias]);

  useEffect(() => {
    producaoRef.current = producao;
  }, [producao]);

  // O app fica dias abertos na bandeja sem recarregar a página, então o
  // valor inicial de hojeISO() (calculado só uma vez, no primeiro carregamento)
  // fica desatualizado — reabrir a aba de "nova" etiqueta dias depois ainda
  // mostrava a data antiga em vez da data real de hoje. Recalcula toda vez
  // que a aba de registro é aberta, pra data de manipulação ser sempre "hoje".
  useEffect(() => {
    if (aba === 'nova') setDataManip(hojeISO());
    else if (aba === 'nova-procedencia') setProcDataManip(hojeISO());
    else if (aba === 'producao-nova') setProducaoDataManip(hojeISO());
  }, [aba]);

  function precisamTrocar(lista) {
    const hoje = hojeISO();
    return lista.filter((e) => diasEntre(hoje, e.dataValidade) <= DIAS_ALERTA).length;
  }

  function avisar(qtd) {
    setReminderOpen(true);
    playAlert();
    if (navigator.vibrate) navigator.vibrate([400, 150, 400, 150, 400]);
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification('⚠️ Etiqueta(s) para trocar', {
          body: `${qtd} etiqueta${qtd > 1 ? 's' : ''} vencida(s) ou perto de vencer.`,
          requireInteraction: true,
        });
      } catch (e) {}
    }
  }

  // Som/notificação local: véspera dispara uma vez só; dia da troca fica
  // repetindo a cada 15 minutos até a etiqueta ser trocada/removida (mais
  // insistente que a véspera, de propósito). Controlado só na memória da
  // sessão (não precisa sobreviver a reiniciar o app, diferente do Telegram).
  function verificarAvisoLocal(listaEtiquetas, listaProcedencias) {
    const hoje = hojeISO();
    const todos = [...listaEtiquetas, ...listaProcedencias];
    let temVesperaNova = false;
    let temDiaHoje = false;
    for (const item of todos) {
      const dias = diasEntre(hoje, item.dataValidade);
      if (dias === 1 && !alertaLocalVesperaRef.current.has(item.id)) {
        alertaLocalVesperaRef.current.add(item.id);
        temVesperaNova = true;
      }
      if (dias <= 0) temDiaHoje = true;
    }
    if (temVesperaNova) {
      avisar(1);
    }
    if (temDiaHoje) {
      const agora = Date.now();
      if (agora - ultimoAlertaDiaRef.current >= 15 * 60 * 1000) {
        ultimoAlertaDiaRef.current = agora;
        avisar(precisamTrocar(listaEtiquetas) + precisamTrocar(listaProcedencias));
      }
    }
  }

  // Roda a cada 5 minutos: checa se precisa de aviso local (véspera/dia) e
  // também dispara/reenvia o Telegram pendente — é essa checagem que, dentro
  // do app instalado, continua rodando com a janela minimizada na bandeja.
  useEffect(() => {
    const iv = setInterval(() => {
      verificarAvisoLocal(etiquetasRef.current, procedenciasRef.current);
      checarEEnviarAvisosTelegram(etiquetasRef.current, procedenciasRef.current, producaoRef.current);
    }, 5 * 60 * 1000);
    return () => clearInterval(iv);
    // eslint-disable-next-line
  }, []);

  // Manda Telegram uma vez na véspera e uma vez no dia da troca, por
  // etiqueta/procedência — usa o campo "avisos" salvo no registro pra nunca
  // mandar duas vezes o mesmo aviso (persiste no servidor, sobrevive a
  // reabrir o app ou recarregar a página).
  // Roda ao abrir o app e a cada 5min. Usa limiar (<=) em vez de igualdade
  // exata, pra funcionar como "catch-up": se o app ficou fechado no dia
  // certo, o aviso não se perde — dispara assim que o app é reaberto,
  // mesmo que já esteja atrasado (inclusive os dois avisos de uma vez, se
  // ambos ainda não tiverem sido mandados).
  async function checarEEnviarAvisosTelegram(listaEtiquetas, listaProcedencias, listaProducao) {
    const hoje = hojeISO();
    function textoQuando(dias) {
      if (dias === 1) return 'vence amanhã';
      if (dias === 0) return 'vence hoje';
      const atraso = Math.abs(dias);
      return `venceu há ${atraso} dia${atraso === 1 ? '' : 's'}`;
    }
    async function enviarAviso(item, endpoint, tipoRegistro, tipo, dias) {
      const chave = `${item.id}:${tipo}`;
      if (avisosEmVooRef.current.has(chave)) return; // já está sendo enviado por outra checagem sobreposta
      avisosEmVooRef.current.add(chave);
      const linhas = [
        `🏷️ Etiqueta de ${tipoRegistro} ${textoQuando(dias)}`,
        `Produto: ${item.produto}`,
        `Colaborador: ${item.colaborador || '—'}`,
        `Válido até: ${formatarBR(item.dataValidade)}`,
      ];
      try {
        await fetch('/api/etiquetas/avisar-telegram', {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({ mensagem: linhas.join('\n') }),
        });
        await fetch(endpoint, {
          method: 'PATCH',
          headers: headers(),
          body: JSON.stringify({ id: item.id, tipo }),
        });
      } catch (e) {
        // silencioso — tenta de novo na próxima checagem (a cada 5min)
      }
    }
    async function processar(item, endpoint, tipoRegistro) {
      const dias = diasEntre(hoje, item.dataValidade);
      if (dias <= 1 && !item.avisos?.vespera) await enviarAviso(item, endpoint, tipoRegistro, 'vespera', dias);
      if (dias <= 0 && !item.avisos?.dia) await enviarAviso(item, endpoint, tipoRegistro, 'dia', dias);
    }
    for (const e of listaEtiquetas) await processar(e, '/api/etiquetas/ativas', 'manipulação');
    for (const p of listaProcedencias) await processar(p, '/api/etiquetas/procedencias', 'procedência');
    for (const pr of listaProducao || []) await processar(pr, '/api/etiquetas/producao', 'produção');
  }

  async function carregarTudo() {
    setLoading(true);
    try {
      const headers = { 'x-store-id': STORE_ID };
      const [rProdutos, rEtiquetas, rProcedencias, rProducao, rConfig, rTelegram] = await Promise.all([
        fetch('/api/etiquetas/produtos', { cache: 'no-store', headers }),
        fetch('/api/etiquetas/ativas', { cache: 'no-store', headers }),
        fetch('/api/etiquetas/procedencias', { cache: 'no-store', headers }),
        fetch('/api/etiquetas/producao', { cache: 'no-store', headers }),
        fetch('/api/etiquetas/config', { cache: 'no-store', headers }),
        fetch('/api/etiquetas/telegram-chats', { cache: 'no-store', headers }),
      ]);
      const dProdutos = await rProdutos.json();
      const dEtiquetas = await rEtiquetas.json();
      const dProcedencias = await rProcedencias.json();
      const dProducao = await rProducao.json();
      const dConfig = await rConfig.json();
      const dTelegram = await rTelegram.json();

      const listaProdutos = dProdutos.produtos || [];
      const listaEtiquetas = dEtiquetas.etiquetas || [];
      const listaProcedencias = dProcedencias.procedencias || [];
      const listaProducao = dProducao.producao || [];
      setProdutos(listaProdutos);
      setEtiquetas(listaEtiquetas);
      setProcedencias(listaProcedencias);
      setProducao(listaProducao);
      setTelegramChats(dTelegram.chats || []);
      checarEEnviarAvisosTelegram(listaEtiquetas, listaProcedencias, listaProducao);
      if (!didFirstReminder.current) {
        didFirstReminder.current = true;
        verificarAvisoLocal(listaEtiquetas, listaProcedencias);
      }
      if (dConfig.config) {
        setConfig(dConfig.config);
        setCfgLargura(dConfig.config.larguraMm);
        setCfgAltura(dConfig.config.alturaMm);
        setCfgNomeLoja(dConfig.config.nomeLoja || '');
      }
      const listaManip = listaProdutos.filter((p) => (p.tipoEtiqueta || 'manipulacao') === 'manipulacao');
      const listaProc = listaProdutos.filter((p) => p.tipoEtiqueta === 'procedencia');
      const listaProducaoProdutos = listaManip.filter((p) => PRODUTOS_PRODUCAO.includes(p.nome));
      if (listaManip.length > 0 && !produtoId) {
        setProdutoId(listaManip[0].id);
        setDias(listaManip[0].dias);
      }
      if (listaProc.length > 0 && !procProdutoId) {
        setProcProdutoId(listaProc[0].id);
        setProcDias(listaProc[0].dias);
      }
      if (listaProducaoProdutos.length > 0 && !producaoProdutoId) {
        setProducaoProdutoId(listaProducaoProdutos[0].id);
        setProducaoDias(listaProducaoProdutos[0].dias);
      }
    } catch (e) {
      // silencioso — a lista fica vazia e a pessoa pode tentar de novo
    } finally {
      setLoading(false);
    }
  }

  function headers() {
    return { 'Content-Type': 'application/json', 'x-store-id': STORE_ID };
  }

  function selecionarProduto(id) {
    setProdutoId(id);
    const p = produtos.find((x) => x.id === id);
    if (p) setDias(p.dias);
  }

  async function adicionarProduto() {
    const nome = novoNome.trim();
    const diasNum = parseInt(novoDias, 10);
    if (!nome || Number.isNaN(diasNum)) return;
    const res = await fetch('/api/etiquetas/produtos', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ nome, dias: diasNum, tipoEtiqueta: novoTipo }),
    });
    if (res.ok) {
      setNovoNome('');
      setNovoDias('');
      setNovoTipo('manipulacao');
      carregarTudo();
    }
  }

  async function removerProduto(id) {
    await fetch(`/api/etiquetas/produtos?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: headers(),
    });
    carregarTudo();
  }

  async function abrirPdf({ produto, dataManipulacao, dataValidade, colaborador, quantidade }) {
    const res = await fetch('/api/etiquetas/pdf', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ produto, dataManipulacao, dataValidade, colaborador, quantidade }),
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  }

  async function salvarEtiqueta() {
    const produto = produtos.find((p) => p.id === produtoId);
    const diasNum = parseInt(dias, 10);
    const faltaAlgo = !produto || Number.isNaN(diasNum) || diasNum < 0 || !dataManip || !colaborador.trim();
    if (faltaAlgo) {
      setErroNova('Preencha produto, validade, data de manipulação e colaborador antes de gerar a etiqueta.');
      return;
    }
    setErroNova('');

    // Se já existe etiqueta ativa desse mesmo produto, avisa (modal próprio,
    // não window.confirm) e substitui em vez de deixar as duas ativas juntas.
    const existentes = etiquetas.filter((e) => e.produto === produto.nome);
    if (existentes.length > 0) {
      const maisRecente = existentes.reduce((a, b) => (a.dataValidade > b.dataValidade ? a : b));
      const dataGrupo = dataValidadeDoGrupo(etiquetas, existentes);
      const mensagem = dataGrupo
        ? `Já existe uma etiqueta ativa de "${produto.nome}" (válida até ${formatarBR(maisRecente.dataValidade)}).\n\nEsse produto faz parte de um grupo de validade — a nova etiqueta vai ficar válida até ${formatarBR(dataGrupo)} (mesma data do grupo), em vez dos ${diasNum} dias completos. Confirma a troca?`
        : `Já existe uma etiqueta ativa de "${produto.nome}" (válida até ${formatarBR(maisRecente.dataValidade)}). Confirma a troca? A etiqueta antiga será removida.`;
      setConfirmacaoTroca({
        mensagem,
        aoConfirmar: async () => {
          for (const e of existentes) {
            await fetch(`/api/etiquetas/ativas?id=${encodeURIComponent(e.id)}`, { method: 'DELETE', headers: headers() });
          }
          await executarSalvarEtiqueta(produto, diasNum, dataGrupo);
        },
      });
      return;
    }

    await executarSalvarEtiqueta(produto, diasNum);
  }

  async function executarSalvarEtiqueta(produto, diasNum, dataValidadeGrupo) {
    setSalvando(true);
    try {
      const res = await fetch('/api/etiquetas/ativas', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          produto: produto.nome,
          dias: diasNum,
          dataManipulacao: dataManip || hojeISO(),
          colaborador: colaborador.trim(),
          dataValidadeGrupo: dataValidadeGrupo || undefined,
        }),
      });
      if (!res.ok) {
        setErroNova('Não foi possível salvar a etiqueta. Tente de novo.');
        return;
      }
      const data = await res.json();
      const etiqueta = data.etiqueta;
      await abrirPdf({
        produto: etiqueta.produto,
        dataManipulacao: etiqueta.dataManipulacao,
        dataValidade: etiqueta.dataValidade,
        colaborador: etiqueta.colaborador,
        quantidade: qtdNova,
      });
      setQtdNova(1);
      setColaborador('');
      setDataManip(hojeISO());
      await carregarTudo();
      setAba('ativas');
    } finally {
      setSalvando(false);
    }
  }

  async function removerEtiqueta(id) {
    await fetch(`/api/etiquetas/ativas?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: headers(),
    });
    carregarTudo();
  }

  function selecionarProdutoProducao(id) {
    setProducaoProdutoId(id);
    const p = produtos.find((x) => x.id === id);
    if (p) setProducaoDias(p.dias);
  }

  // Produção é sempre avulsa: cada lote produzido (descascado/porcionado/
  // congelado e guardado no estoque) vira uma etiqueta independente, sem
  // checar se já existe uma ativa do mesmo produto — é normal ter vários
  // lotes em estoque ao mesmo tempo.
  async function salvarProducao() {
    const produto = produtos.find((p) => p.id === producaoProdutoId);
    const diasNum = parseInt(producaoDias, 10);
    const faltaAlgo = !produto || Number.isNaN(diasNum) || diasNum < 0 || !producaoDataManip || !producaoColaborador.trim();
    if (faltaAlgo) {
      setErroProducao('Preencha produto, validade, data de manipulação e colaborador antes de gerar a etiqueta.');
      return;
    }
    setErroProducao('');
    setProducaoSalvando(true);
    try {
      const res = await fetch('/api/etiquetas/producao', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          produto: produto.nome,
          dias: diasNum,
          dataManipulacao: producaoDataManip || hojeISO(),
          colaborador: producaoColaborador.trim(),
        }),
      });
      if (!res.ok) {
        setErroProducao('Não foi possível salvar a etiqueta. Tente de novo.');
        return;
      }
      const data = await res.json();
      const etiqueta = data.etiqueta;
      await abrirPdf({
        produto: etiqueta.produto,
        dataManipulacao: etiqueta.dataManipulacao,
        dataValidade: etiqueta.dataValidade,
        colaborador: etiqueta.colaborador,
        quantidade: producaoQtdNova,
      });
      setProducaoQtdNova(1);
      setProducaoColaborador('');
      setProducaoDataManip(hojeISO());
      await carregarTudo();
      setAba('producao-ativas');
    } finally {
      setProducaoSalvando(false);
    }
  }

  async function removerProducao(id) {
    await fetch(`/api/etiquetas/producao?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: headers(),
    });
    carregarTudo();
  }

  async function reimprimirProducao(etiqueta) {
    const qtd = Math.max(1, parseInt(qtdReimprimirProducao[etiqueta.id], 10) || 1);
    await abrirPdf({
      produto: etiqueta.produto,
      dataManipulacao: etiqueta.dataManipulacao,
      dataValidade: etiqueta.dataValidade,
      colaborador: etiqueta.colaborador,
      quantidade: qtd,
    });
  }

  async function reimprimir(etiqueta) {
    const qtd = Math.max(1, parseInt(qtdReimprimir[etiqueta.id], 10) || 1);
    await abrirPdf({
      produto: etiqueta.produto,
      dataManipulacao: etiqueta.dataManipulacao,
      dataValidade: etiqueta.dataValidade,
      colaborador: etiqueta.colaborador,
      quantidade: qtd,
    });
  }

  async function imprimirLoteManipulacao(ids) {
    if (ids.length === 0) return;
    const res = await fetch('/api/etiquetas/pdf-lote', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) return;
    const blob = await res.blob();
    window.open(URL.createObjectURL(blob), '_blank');
  }

  // Imprimir em lote de manipulação = renovar, não só reimprimir a etiqueta
  // velha: a manipulação de cada uma vira hoje (mesma validade em dias do
  // produto), e pede o colaborador que está fazendo a troca agora — quem
  // gerou a primeira etiqueta pode não ser quem está trocando hoje.
  function abrirPedidoColaboradorLote(itens) {
    if (itens.length === 0) return;
    setColaboradorLoteInput('');
    setPedirColaboradorLote({
      mensagem: `Vai renovar ${itens.length} etiqueta${itens.length === 1 ? '' : 's'} com data de manipulação de hoje. Quem está fazendo a troca agora?`,
      aoConfirmar: (colaborador) => renovarEImprimirLoteManipulacao(itens, colaborador),
    });
  }

  async function renovarEImprimirLoteManipulacao(itens, colaborador) {
    const hoje = hojeISO();
    const novosIds = [];
    for (const item of itens) {
      const diasOriginal = diasEntre(item.dataManipulacao, item.dataValidade);
      await fetch(`/api/etiquetas/ativas?id=${encodeURIComponent(item.id)}`, { method: 'DELETE', headers: headers() });
      const res = await fetch('/api/etiquetas/ativas', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ produto: item.produto, dias: diasOriginal, dataManipulacao: hoje, colaborador }),
      });
      const data = await res.json();
      if (data.etiqueta) novosIds.push(data.etiqueta.id);
    }
    await imprimirLoteManipulacao(novosIds);
    await carregarTudo();
  }

  // Cria de uma vez uma etiqueta pra cada produto de manipulação com a mesma
  // validade (dias) do que está no formulário — menos os produtos de exceção
  // (frutas/hortifruti), que continuam sempre manuais. Reaproveita colaborador
  // e data de manipulação já preenchidos, e substitui sem perguntar qualquer
  // etiqueta ativa que esses produtos já tivessem.
  async function criarGrupoManipulacao(diasNum, grupo) {
    if (!dataManip || !colaborador.trim()) {
      setErroNova('Preencha data de manipulação e colaborador antes de criar o grupo.');
      return;
    }
    setErroNova('');
    setSalvando(true);
    try {
      const novosIds = [];
      for (const produto of grupo) {
        const existentes = etiquetas.filter((e) => e.produto === produto.nome);
        for (const e of existentes) {
          await fetch(`/api/etiquetas/ativas?id=${encodeURIComponent(e.id)}`, { method: 'DELETE', headers: headers() });
        }
        const res = await fetch('/api/etiquetas/ativas', {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({ produto: produto.nome, dias: diasNum, dataManipulacao: dataManip, colaborador: colaborador.trim() }),
        });
        const data = await res.json();
        if (data.etiqueta) novosIds.push(data.etiqueta.id);
      }
      await imprimirLoteManipulacao(novosIds);
      setColaborador('');
      setDataManip(hojeISO());
      await carregarTudo();
      setAba('ativas');
    } finally {
      setSalvando(false);
    }
  }

  function selecionarProdutoProc(id) {
    setProcProdutoId(id);
    const p = produtos.find((x) => x.id === id);
    if (p) setProcDias(p.dias);
  }

  async function abrirPdfProcedencia({ produto, fornecedor, lote, sif, dataValidadeOriginal, dataManipulacao, dataValidade, colaborador, quantidade }) {
    const res = await fetch('/api/etiquetas/pdf-procedencia', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ produto, fornecedor, lote, sif, dataValidadeOriginal, dataManipulacao, dataValidade, colaborador, quantidade }),
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  }

  async function salvarProcedencia() {
    const produto = produtos.find((p) => p.id === procProdutoId);
    const diasNum = parseInt(procDias, 10);
    const faltaAlgo = !produto || Number.isNaN(diasNum) || diasNum < 0 || !procFornecedor.trim() || !procLote.trim()
      || !procDataValidadeOriginal.trim() || !procDataManip || !procColaborador.trim();
    if (faltaAlgo) {
      setErroProc('Preencha todos os campos (exceto SIF, que é opcional) antes de gerar a etiqueta.');
      return;
    }
    setErroProc('');

    // Mesma trava da manipulação: avisa (modal próprio) e substitui em vez de duplicar.
    const existentesProc = procedencias.filter((e) => e.produto === produto.nome);
    if (existentesProc.length > 0) {
      const maisRecente = existentesProc.reduce((a, b) => (a.dataValidade > b.dataValidade ? a : b));
      const dataGrupoProc = dataValidadeDoGrupo(procedencias, existentesProc);
      const mensagemProc = dataGrupoProc
        ? `Já existe uma procedência ativa de "${produto.nome}" (válida até ${formatarBR(maisRecente.dataValidade)}).\n\nEsse produto faz parte de um grupo de validade — a nova etiqueta vai ficar válida até ${formatarBR(dataGrupoProc)} (mesma data do grupo), em vez dos ${diasNum} dias completos. Confirma a troca?`
        : `Já existe uma procedência ativa de "${produto.nome}" (válida até ${formatarBR(maisRecente.dataValidade)}). Confirma a troca? A etiqueta antiga será removida.`;
      setConfirmacaoTroca({
        mensagem: mensagemProc,
        aoConfirmar: async () => {
          for (const e of existentesProc) {
            await fetch(`/api/etiquetas/procedencias?id=${encodeURIComponent(e.id)}`, { method: 'DELETE', headers: headers() });
          }
          await executarSalvarProcedencia(produto, diasNum, dataGrupoProc);
        },
      });
      return;
    }

    await executarSalvarProcedencia(produto, diasNum);
  }

  async function executarSalvarProcedencia(produto, diasNum, dataValidadeGrupo) {
    setProcSalvando(true);
    try {
      const res = await fetch('/api/etiquetas/procedencias', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          produto: produto.nome,
          dias: diasNum,
          fornecedor: procFornecedor.trim(),
          lote: procLote.trim(),
          sif: procSif.trim(),
          dataValidadeOriginal: procDataValidadeOriginal.trim(),
          dataManipulacao: procDataManip || hojeISO(),
          colaborador: procColaborador.trim(),
          dataValidadeGrupo: dataValidadeGrupo || undefined,
        }),
      });
      if (!res.ok) {
        setErroProc('Não foi possível salvar a etiqueta. Tente de novo.');
        return;
      }
      const data = await res.json();
      const procedencia = data.procedencia;
      await abrirPdfProcedencia({
        produto: procedencia.produto,
        fornecedor: procedencia.fornecedor,
        lote: procedencia.lote,
        sif: procedencia.sif,
        dataValidadeOriginal: procedencia.dataValidadeOriginal,
        dataManipulacao: procedencia.dataManipulacao,
        dataValidade: procedencia.dataValidade,
        colaborador: procedencia.colaborador,
        quantidade: procQtdNova,
      });
      setProcQtdNova(1);
      setProcFornecedor('');
      setProcLote('');
      setProcSif('');
      setProcDataValidadeOriginal('');
      setProcColaborador('');
      setProcDataManip(hojeISO());
      await carregarTudo();
      setAba('procedencias-ativas');
    } finally {
      setProcSalvando(false);
    }
  }

  async function removerProcedencia(id) {
    await fetch(`/api/etiquetas/procedencias?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: headers(),
    });
    carregarTudo();
  }

  async function reimprimirProcedencia(procedencia) {
    const qtd = Math.max(1, parseInt(qtdReimprimirProc[procedencia.id], 10) || 1);
    await abrirPdfProcedencia({
      produto: procedencia.produto,
      fornecedor: procedencia.fornecedor,
      lote: procedencia.lote,
      sif: procedencia.sif,
      dataValidadeOriginal: procedencia.dataValidadeOriginal,
      dataManipulacao: procedencia.dataManipulacao,
      dataValidade: procedencia.dataValidade,
      colaborador: procedencia.colaborador,
      quantidade: qtd,
    });
  }

  async function imprimirLoteProcedencia(ids) {
    if (ids.length === 0) return;
    const res = await fetch('/api/etiquetas/pdf-procedencia-lote', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) return;
    const blob = await res.blob();
    window.open(URL.createObjectURL(blob), '_blank');
  }

  // Cria todos os produtos de procedência da mesma validade (dias), um de
  // cada vez — diferente da manipulação, cada produto de procedência tem seu
  // próprio fornecedor/lote/SIF/validade original, então o operador responde
  // produto por produto e cada etiqueta é gerada assim que ele confirma
  // aquele produto (não espera preencher todos pra só então salvar tudo).
  function abrirCriarGrupoProcedencia(diasNum, grupo) {
    if (!procDataManip || !procColaborador.trim()) {
      setErroProc('Preencha data de manipulação e colaborador antes de criar o grupo.');
      return;
    }
    setErroProc('');
    setGrupoProcCampo({ fornecedor: '', lote: '', sif: '', dataValidadeOriginal: '' });
    setGrupoProcWizard({
      produtos: grupo,
      indice: 0,
      diasNum,
      dataManipulacao: procDataManip,
      colaborador: procColaborador.trim(),
      novosIds: [],
    });
  }

  function cancelarGrupoProcedencia() {
    setGrupoProcWizard(null);
  }

  async function confirmarProdutoGrupoProcedencia() {
    const { produtos, indice, diasNum, dataManipulacao, colaborador, novosIds } = grupoProcWizard;
    const { fornecedor, lote, sif, dataValidadeOriginal } = grupoProcCampo;
    if (!fornecedor.trim() || !lote.trim() || !dataValidadeOriginal.trim()) return;

    const produtoAtual = produtos[indice];
    const existentes = procedencias.filter((e) => e.produto === produtoAtual.nome);
    for (const e of existentes) {
      await fetch(`/api/etiquetas/procedencias?id=${encodeURIComponent(e.id)}`, { method: 'DELETE', headers: headers() });
    }
    const res = await fetch('/api/etiquetas/procedencias', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        produto: produtoAtual.nome,
        dias: diasNum,
        fornecedor: fornecedor.trim(),
        lote: lote.trim(),
        sif: sif.trim(),
        dataValidadeOriginal: dataValidadeOriginal.trim(),
        dataManipulacao,
        colaborador,
      }),
    });
    const data = await res.json();
    const novosIdsAtualizados = data.procedencia ? [...novosIds, data.procedencia.id] : novosIds;

    if (indice + 1 < produtos.length) {
      setGrupoProcWizard({ ...grupoProcWizard, indice: indice + 1, novosIds: novosIdsAtualizados });
      setGrupoProcCampo({ fornecedor: '', lote: '', sif: '', dataValidadeOriginal: '' });
    } else {
      setGrupoProcWizard(null);
      await imprimirLoteProcedencia(novosIdsAtualizados);
      await carregarTudo();
      setAba('procedencias-ativas');
    }
  }

  // Igual à manipulação, mas a procedência pede tudo de novo (colaborador,
  // fornecedor, lote, SIF, validade original) por produto — cada um do lote
  // pode ter vindo de um fornecedor/lote diferente na hora da troca.
  function abrirPedidoDadosLoteProcedencia(itens) {
    if (itens.length === 0) return;
    const formInicial = {};
    for (const item of itens) {
      formInicial[item.id] = {
        colaborador: '',
        fornecedor: item.fornecedor || '',
        lote: item.lote || '',
        sif: item.sif || '',
        dataValidadeOriginal: item.dataValidadeOriginal || '',
      };
    }
    setDadosLoteProcedenciaForm(formInicial);
    setPedirDadosLoteProcedencia({ itens });
  }

  async function renovarEImprimirLoteProcedencia() {
    const itens = pedirDadosLoteProcedencia.itens;
    const hoje = hojeISO();
    const novosIds = [];
    for (const item of itens) {
      const dados = dadosLoteProcedenciaForm[item.id];
      const diasOriginal = diasEntre(item.dataManipulacao, item.dataValidade);
      await fetch(`/api/etiquetas/procedencias?id=${encodeURIComponent(item.id)}`, { method: 'DELETE', headers: headers() });
      const res = await fetch('/api/etiquetas/procedencias', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          produto: item.produto,
          dias: diasOriginal,
          dataManipulacao: hoje,
          fornecedor: dados.fornecedor.trim(),
          lote: dados.lote.trim(),
          sif: dados.sif.trim(),
          dataValidadeOriginal: dados.dataValidadeOriginal,
          colaborador: dados.colaborador.trim(),
        }),
      });
      const data = await res.json();
      if (data.procedencia) novosIds.push(data.procedencia.id);
    }
    setPedirDadosLoteProcedencia(null);
    await imprimirLoteProcedencia(novosIds);
    await carregarTudo();
  }

  async function salvarConfig() {
    const larguraMm = parseInt(cfgLargura, 10);
    const alturaMm = parseInt(cfgAltura, 10);
    if (!larguraMm || !alturaMm) return;
    const res = await fetch('/api/etiquetas/config', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ larguraMm, alturaMm, nomeLoja: cfgNomeLoja.trim() }),
    });
    if (res.ok) {
      const data = await res.json();
      setConfig(data.config);
    }
  }

  // Tela de primeira execução: pergunta o nome da loja uma vez só (fica
  // salvo no banco local dessa instalação) e nunca mais pergunta depois disso.
  async function salvarNomeLojaInicial() {
    const nome = nomeLojaInicial.trim();
    if (!nome) return;
    setSalvandoNomeLojaInicial(true);
    try {
      const res = await fetch('/api/etiquetas/config', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ larguraMm: cfgLargura, alturaMm: cfgAltura, nomeLoja: nome }),
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
        setCfgNomeLoja(data.config.nomeLoja);
      }
    } finally {
      setSalvandoNomeLojaInicial(false);
    }
  }

  async function salvarTelegramChats(novaLista) {
    setTelegramSalvando(true);
    try {
      const res = await fetch('/api/etiquetas/telegram-chats', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ chats: novaLista }),
      });
      if (res.ok) {
        const data = await res.json();
        setTelegramChats(data.chats);
      }
    } finally {
      setTelegramSalvando(false);
    }
  }

  async function detectarConversasTelegram() {
    setTelegramDetectando(true);
    try {
      const res = await fetch('/api/etiquetas/telegram-detectar', { cache: 'no-store' });
      const data = await res.json();
      const jaSalvos = new Set(telegramChats.map((c) => c.id));
      setTelegramCandidatos((data.candidatos || []).filter((c) => !jaSalvos.has(c.id)));
    } finally {
      setTelegramDetectando(false);
    }
  }

  function adicionarChatTelegram(candidato) {
    const novaLista = [...telegramChats, candidato];
    setTelegramCandidatos((lista) => lista.filter((c) => c.id !== candidato.id));
    salvarTelegramChats(novaLista);
  }

  function removerChatTelegram(id) {
    salvarTelegramChats(telegramChats.filter((c) => c.id !== id));
  }

  const hoje = hojeISO();
  const produtosManipulacao = produtos.filter((p) => (p.tipoEtiqueta || 'manipulacao') === 'manipulacao');
  const produtosProcedencia = produtos.filter((p) => p.tipoEtiqueta === 'procedencia');
  const produtosProducao = produtosManipulacao.filter((p) => PRODUTOS_PRODUCAO.includes(p.nome));

  // Um grupo por validade (dias) existente no catálogo, sempre disponível
  // como botão fixo — não depende de qual produto está selecionado no
  // formulário.
  function agruparPorDiasCatalogo(lista) {
    const mapa = new Map();
    for (const p of lista) {
      if (!mapa.has(p.dias)) mapa.set(p.dias, []);
      mapa.get(p.dias).push(p);
    }
    return Array.from(mapa.entries()).sort((a, b) => a[0] - b[0]).map(([diasGrupo, produtosGrupo]) => ({ dias: diasGrupo, produtos: produtosGrupo }));
  }
  const gruposCatalogoManipulacao = agruparPorDiasCatalogo(produtosManipulacao);
  const gruposCatalogoProcedencia = agruparPorDiasCatalogo(produtosProcedencia);
  function comStatusDe(lista) {
    return lista
      .map((e) => {
        const restam = diasEntre(hoje, e.dataValidade);
        let status = 'ok';
        if (restam < 0) status = 'vencido';
        else if (restam <= DIAS_ALERTA) status = 'atencao';
        return { ...e, restam, status };
      })
      .sort((a, b) => a.restam - b.restam);
  }

  // Agrupa por validade em dias (ex: todos os de "30 dias" juntos, os de "5
  // dias" juntos) — usa a duração real de cada etiqueta (data de validade
  // menos data de manipulação), não o cadastro do produto, que pode mudar.
  function agruparPorDuracao(listaComStatus) {
    const grupos = new Map();
    for (const item of listaComStatus) {
      const duracao = diasEntre(item.dataManipulacao, item.dataValidade);
      if (!grupos.has(duracao)) grupos.set(duracao, []);
      grupos.get(duracao).push(item);
    }
    return Array.from(grupos.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([duracao, itens]) => ({ duracao, itens }));
  }

  const comStatus = comStatusDe(etiquetas);
  const vencidas = comStatus.filter((e) => e.status === 'vencido').length;
  const atencao = comStatus.filter((e) => e.status === 'atencao').length;

  const comStatusProc = comStatusDe(procedencias);
  const vencidasProc = comStatusProc.filter((e) => e.status === 'vencido').length;
  const atencaoProc = comStatusProc.filter((e) => e.status === 'atencao').length;

  // Produção não entra no alarme sonoro/reminder pulsante (precisamTrocarQtd)
  // nem no aviso local de véspera/dia — é raro um lote vencer, já que a
  // produção não é feita pra muitos dias. O aviso continua indo por
  // Telegram (ver checarEEnviarAvisosTelegram), só sem a insistência do
  // alarme local, que é pra troca obrigatória (cubas/procedência).
  const comStatusProducao = comStatusDe(producao);
  const vencidasProducao = comStatusProducao.filter((e) => e.status === 'vencido').length;
  const atencaoProducao = comStatusProducao.filter((e) => e.status === 'atencao').length;

  const precisamTrocarQtd = vencidas + atencao + vencidasProc + atencaoProc;

  const gruposManipulacao = agruparPorDuracao(comStatus);
  const gruposProcedencia = agruparPorDuracao(comStatusProc);
  // "Vence hoje" pra fins de impressão em lote = já venceu ou vence hoje
  // (restam <= 0), diferente do limiar de 2 dias usado no aviso sonoro.
  const itensVenceHojeManipulacao = comStatus.filter((e) => e.restam <= 0);
  const itensVenceHojeProcedencia = comStatusProc.filter((e) => e.restam <= 0);

  // Primeira vez que o app abre nessa instalação (nome da loja ainda não
  // configurado) — pergunta antes de liberar o resto da tela. Uma vez salvo,
  // config.nomeLoja nunca mais fica vazio, então essa tela não volta a aparecer.
  if (!loading && !config.nomeLoja) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div className="card" style={{ maxWidth: 420, width: '100%' }}>
          <h2 style={{ marginBottom: 6 }}>Bem-vindo(a)!</h2>
          <p className="empty" style={{ textAlign: 'left', padding: '0 0 14px' }}>
            Antes de começar, qual o nome desta loja? Isso identifica de onde veio o aviso quando
            chega no Telegram — só precisa preencher uma vez.
          </p>
          <div className="field">
            <label>Nome da loja</label>
            <input
              type="text"
              placeholder="Ex: Niterói"
              value={nomeLojaInicial}
              onChange={(ev) => setNomeLojaInicial(ev.target.value)}
            />
          </div>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!nomeLojaInicial.trim() || salvandoNomeLojaInicial}
            onClick={salvarNomeLojaInicial}
            style={{ marginTop: 10 }}
          >
            {salvandoNomeLojaInicial ? 'Salvando…' : 'Salvar e continuar'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="app-header">
        <div className="logo-lockup">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 248" height="38" aria-hidden="true" style={{ display: 'block', flexShrink: 0 }}>
            <circle cx="100" cy="158" r="58" fill="none" stroke="#6CAE2C" strokeWidth="29" />
            <ellipse cx="100" cy="158" rx="19" ry="23" fill="#E8A23D" />
            <path d="M100 139 C93 149 93 167 100 177" fill="none" stroke="#C9821F" strokeWidth="3" strokeLinecap="round" />
            <path d="M100 160 L100 66" fill="none" stroke="#3F7A2A" strokeWidth="8" strokeLinecap="round" />
            <path d="M100 74 C83 75 56 67 39 45 C35 41 37 34 43 34 C72 37 96 50 100 74 Z" fill="#5EA126" />
            <path d="M98 72 C81 62 63 52 45 41" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
            <path d="M100 74 C117 75 144 67 161 45 C165 41 163 34 157 34 C128 37 104 50 100 74 Z" fill="#84C63C" />
            <path d="M102 72 C119 62 137 52 155 41" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <span className="logo-wordmark">s<span className="logo-i">i</span>embras</span>
        </div>
        <div className="spacer" />
      </header>

      <main className="wrap">
        <div className="section-title">Controle de Etiquetas</div>

        <nav className="admin-tabs">
          <button type="button" className={`admin-tab${aba === 'ativas' ? ' active' : ''}`} onClick={() => setAba('ativas')}>
            Manipulação ativas
          </button>
          <button type="button" className={`admin-tab${aba === 'nova' ? ' active' : ''}`} onClick={() => setAba('nova')}>
            Nova manipulação
          </button>
          <button type="button" className={`admin-tab${aba === 'procedencias-ativas' ? ' active' : ''}`} onClick={() => setAba('procedencias-ativas')}>
            Procedências ativas
          </button>
          <button type="button" className={`admin-tab${aba === 'nova-procedencia' ? ' active' : ''}`} onClick={() => setAba('nova-procedencia')}>
            Nova procedência
          </button>
          <button type="button" className={`admin-tab${aba === 'producao-ativas' ? ' active' : ''}`} onClick={() => setAba('producao-ativas')}>
            Produção ativas
          </button>
          <button type="button" className={`admin-tab${aba === 'producao-nova' ? ' active' : ''}`} onClick={() => setAba('producao-nova')}>
            Nova produção
          </button>
          <button type="button" className={`admin-tab${aba === 'produtos' ? ' active' : ''}`} onClick={() => setAba('produtos')}>
            Produtos
          </button>
          <button type="button" className={`admin-tab${aba === 'config' ? ' active' : ''}`} onClick={() => setAba('config')}>
            Config. impressão
          </button>
          <button type="button" className={`admin-tab${aba === 'config-telegram' ? ' active' : ''}`} onClick={() => setAba('config-telegram')}>
            Destinatários
          </button>
        </nav>

        <div className="notif-hint ok">🔔 Avisos ativados — você recebe aviso uma vez na véspera, e a cada 15 min no dia da troca.</div>

        {reminderOpen && precisamTrocarQtd > 0 ? (
          <div className="reminder reminder-pulse">
            <button className="reminder-x" onClick={() => setReminderOpen(false)} aria-label="Fechar">
              ×
            </button>
            <div className="reminder-title">🚨 ETIQUETA PARA TROCAR!</div>
            <div className="reminder-body">
              <strong>{precisamTrocarQtd} etiqueta{precisamTrocarQtd > 1 ? 's' : ''}</strong> vencida(s) ou perto de vencer.
              Você recebe esse aviso uma vez na véspera, e a cada <strong>15 minutos</strong> no dia da troca, até trocar a etiqueta.
            </div>
          </div>
        ) : null}

        {confirmacaoTroca ? (
          <div className="modal-overlay">
            <div className="modal-box">
              <p>{confirmacaoTroca.mensagem}</p>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmacaoTroca(null)}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={async () => {
                    const fn = confirmacaoTroca.aoConfirmar;
                    setConfirmacaoTroca(null);
                    await fn();
                  }}
                >
                  Confirmar troca
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {pedirColaboradorLote ? (
          <div className="modal-overlay">
            <div className="modal-box">
              <p>{pedirColaboradorLote.mensagem}</p>
              <div className="field" style={{ marginBottom: 20 }}>
                <label>Colaborador</label>
                <input
                  type="text"
                  autoFocus
                  placeholder="Nome de quem está trocando"
                  value={colaboradorLoteInput}
                  onChange={(ev) => setColaboradorLoteInput(ev.target.value)}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPedirColaboradorLote(null)}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={!colaboradorLoteInput.trim()}
                  onClick={async () => {
                    const fn = pedirColaboradorLote.aoConfirmar;
                    const colaborador = colaboradorLoteInput.trim();
                    setPedirColaboradorLote(null);
                    await fn(colaborador);
                  }}
                >
                  Confirmar e imprimir
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {pedirDadosLoteProcedencia ? (
          <div className="modal-overlay">
            <div className="modal-box" style={{ maxWidth: 560, maxHeight: '80vh', overflowY: 'auto' }}>
              <p>
                Vai renovar {pedirDadosLoteProcedencia.itens.length} procedência
                {pedirDadosLoteProcedencia.itens.length === 1 ? '' : 's'} com data de manipulação de hoje.
                Confirme os dados de cada produto:
              </p>
              {pedirDadosLoteProcedencia.itens.map((item) => {
                const dados = dadosLoteProcedenciaForm[item.id] || {
                  colaborador: '', fornecedor: '', lote: '', sif: '', dataValidadeOriginal: '',
                };
                function atualizar(campo, valor) {
                  setDadosLoteProcedenciaForm((atual) => ({
                    ...atual,
                    [item.id]: { ...atual[item.id], [campo]: valor },
                  }));
                }
                return (
                  <div key={item.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 12 }}>
                    <strong style={{ display: 'block', marginBottom: 8 }}>{item.produto}</strong>
                    <div className="field" style={{ marginBottom: 8 }}>
                      <label>Colaborador</label>
                      <input type="text" placeholder="Nome de quem está trocando"
                        value={dados.colaborador} onChange={(ev) => atualizar('colaborador', ev.target.value)} />
                    </div>
                    <div className="field" style={{ marginBottom: 8 }}>
                      <label>Fornecedor</label>
                      <input type="text" value={dados.fornecedor} onChange={(ev) => atualizar('fornecedor', ev.target.value)} />
                    </div>
                    <div className="field" style={{ marginBottom: 8 }}>
                      <label>Lote</label>
                      <input type="text" value={dados.lote} onChange={(ev) => atualizar('lote', ev.target.value)} />
                    </div>
                    <div className="field" style={{ marginBottom: 8 }}>
                      <label>SIF (opcional)</label>
                      <input type="text" value={dados.sif} onChange={(ev) => atualizar('sif', ev.target.value)} />
                    </div>
                    <div className="field">
                      <label>Validade original</label>
                      <input type="date" value={dados.dataValidadeOriginal} onChange={(ev) => atualizar('dataValidadeOriginal', ev.target.value)} />
                    </div>
                  </div>
                );
              })}
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPedirDadosLoteProcedencia(null)}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={pedirDadosLoteProcedencia.itens.some((item) => {
                    const dados = dadosLoteProcedenciaForm[item.id];
                    return !dados || !dados.colaborador.trim() || !dados.fornecedor.trim() || !dados.lote.trim() || !dados.dataValidadeOriginal;
                  })}
                  onClick={renovarEImprimirLoteProcedencia}
                >
                  Confirmar e imprimir
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {grupoProcWizard ? (
          <div className="modal-overlay">
            <div className="modal-box">
              <p>
                Criando grupo de {grupoProcWizard.diasNum} dia{grupoProcWizard.diasNum === 1 ? '' : 's'} —
                {' '}produto {grupoProcWizard.indice + 1} de {grupoProcWizard.produtos.length}
              </p>
              <strong style={{ display: 'block', marginBottom: 8 }}>
                {grupoProcWizard.produtos[grupoProcWizard.indice].nome}
              </strong>
              <div className="field" style={{ marginBottom: 8 }}>
                <label>Fornecedor/Marca</label>
                <input
                  type="text"
                  placeholder="Ex: Benassi RJ"
                  value={grupoProcCampo.fornecedor}
                  onChange={(ev) => setGrupoProcCampo({ ...grupoProcCampo, fornecedor: ev.target.value })}
                />
              </div>
              <div className="grid2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="field">
                  <label>Lote</label>
                  <input
                    type="text"
                    value={grupoProcCampo.lote}
                    onChange={(ev) => setGrupoProcCampo({ ...grupoProcCampo, lote: ev.target.value })}
                  />
                </div>
                <div className="field">
                  <label>SIF (opcional)</label>
                  <input
                    type="text"
                    value={grupoProcCampo.sif}
                    onChange={(ev) => setGrupoProcCampo({ ...grupoProcCampo, sif: ev.target.value })}
                  />
                </div>
              </div>
              <div className="field">
                <label>Validade original (embalagem)</label>
                <input
                  type="date"
                  value={grupoProcCampo.dataValidadeOriginal}
                  onChange={(ev) => setGrupoProcCampo({ ...grupoProcCampo, dataValidadeOriginal: ev.target.value })}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={cancelarGrupoProcedencia}>
                  Cancelar grupo
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={!grupoProcCampo.fornecedor.trim() || !grupoProcCampo.lote.trim() || !grupoProcCampo.dataValidadeOriginal}
                  onClick={confirmarProdutoGrupoProcedencia}
                >
                  {grupoProcWizard.indice + 1 < grupoProcWizard.produtos.length ? 'Gerar e ir pro próximo' : 'Gerar e finalizar grupo'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className="spinner">Carregando…</div>
        ) : (
          <>
            {aba === 'ativas' && (
              <div className="card">
                <h2 style={{ marginBottom: 14 }}>
                  Etiquetas em uso
                  {comStatus.length > 0 && (
                    <span style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--muted)' }}>
                      {' '}— {vencidas} vencida(s), {atencao} para trocar em breve
                    </span>
                  )}
                </h2>
                {comStatus.length === 0 ? (
                  <div className="empty">Nenhuma etiqueta ativa. Vá em &quot;Nova etiqueta&quot; para registrar uma manipulação.</div>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      style={{ marginBottom: 16 }}
                      disabled={itensVenceHojeManipulacao.length === 0}
                      onClick={() => abrirPedidoColaboradorLote(itensVenceHojeManipulacao)}
                    >
                      Imprimir tudo que vence hoje ({itensVenceHojeManipulacao.length})
                    </button>
                    {gruposManipulacao.map((grupo) => {
                      const itensGrupoVenceHoje = grupo.itens.filter((e) => e.restam <= 0);
                      return (
                        <div key={grupo.duracao} style={{ marginBottom: 22 }}>
                          <div className="etq-grupo-header">
                            <h3 style={{ margin: 0, fontSize: 14 }}>Validade: {grupo.duracao} dia{grupo.duracao === 1 ? '' : 's'} ({grupo.itens.length})</h3>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              disabled={itensGrupoVenceHoje.length === 0}
                              onClick={() => abrirPedidoColaboradorLote(itensGrupoVenceHoje)}
                            >
                              Imprimir os que vencem deste grupo ({itensGrupoVenceHoje.length})
                            </button>
                          </div>
                          {grupo.itens.map((e) => {
                            let textoStatus = 'Ok';
                            if (e.status === 'vencido') textoStatus = `Vencida há ${Math.abs(e.restam)}d`;
                            else if (e.status === 'atencao') textoStatus = e.restam === 0 ? 'Vence hoje' : `Vence em ${e.restam}d`;
                            return (
                              <div key={e.id} className={`etq-item etq-${e.status}`}>
                                <div className="etq-info">
                                  <div className="etq-nome">{e.produto}</div>
                                  <div className="etq-meta">
                                    Manipulado {formatarBR(e.dataManipulacao)} · Colaborador: {e.colaborador || '—'} · Válido até {formatarBR(e.dataValidade)}
                                  </div>
                                </div>
                                <span className="etq-status">{textoStatus}</span>
                                <div className="etq-actions">
                                  <input
                                    type="number"
                                    min="1"
                                    className="etq-qtd-input"
                                    value={qtdReimprimir[e.id] ?? 1}
                                    onChange={(ev) => setQtdReimprimir({ ...qtdReimprimir, [e.id]: ev.target.value })}
                                  />
                                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => reimprimir(e)}>
                                    Imprimir
                                  </button>
                                  <button type="button" className="btn btn-danger btn-sm" onClick={() => removerEtiqueta(e.id)}>
                                    Trocada
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            )}

            {aba === 'nova' && (
              <div className="card">
                <h2 style={{ marginBottom: 14 }}>Registrar manipulação</h2>
                {produtosManipulacao.length === 0 ? (
                  <div className="empty">Cadastre um produto do tipo &quot;manipulação&quot; na aba &quot;Produtos&quot; antes de registrar uma etiqueta.</div>
                ) : (
                  <>
                    <div className="field">
                      <label>Produto</label>
                      <select value={produtoId} onChange={(ev) => selecionarProduto(ev.target.value)}>
                        {produtosManipulacao.map((p) => (
                          <option key={p.id} value={p.id}>{p.nome}</option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label>Validade (dias) — do produto selecionado</label>
                      <input type="number" min="0" value={dias} disabled />
                    </div>
                    <div className="field">
                      <label>Data de manipulação</label>
                      <input type="date" value={dataManip} onChange={(ev) => setDataManip(ev.target.value)} />
                    </div>
                    <div className="field">
                      <label>Colaborador</label>
                      <input
                        type="text"
                        placeholder="Nome de quem preparou"
                        value={colaborador}
                        onChange={(ev) => { setColaborador(ev.target.value); setErroNova(''); }}
                      />
                    </div>
                    <div className="field">
                      <label>Quantidade de etiquetas a imprimir</label>
                      <input type="number" min="1" value={qtdNova} onChange={(ev) => setQtdNova(ev.target.value)} />
                    </div>
                    {erroNova ? <div className="name-required">⚠️ {erroNova}</div> : null}
                    <button type="button" className="btn btn-primary" disabled={salvando} onClick={salvarEtiqueta} style={{ marginTop: 10 }}>
                      {salvando ? 'Salvando…' : 'Salvar e gerar etiqueta'}
                    </button>
                    {gruposCatalogoManipulacao.map((g) => (
                      <button
                        key={g.dias}
                        type="button"
                        className="btn btn-ghost"
                        disabled={salvando}
                        onClick={() => criarGrupoManipulacao(g.dias, g.produtos)}
                        style={{ marginTop: 10, marginLeft: 10 }}
                      >
                        Criar grupo de {g.dias}d ({g.produtos.length} produtos)
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}

            {aba === 'procedencias-ativas' && (
              <div className="card">
                <h2 style={{ marginBottom: 14 }}>
                  Procedências em uso
                  {comStatusProc.length > 0 && (
                    <span style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--muted)' }}>
                      {' '}— {vencidasProc} vencida(s), {atencaoProc} para trocar em breve
                    </span>
                  )}
                </h2>
                {comStatusProc.length === 0 ? (
                  <div className="empty">Nenhuma procedência ativa. Vá em &quot;Nova procedência&quot; para registrar uma.</div>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      style={{ marginBottom: 16 }}
                      disabled={itensVenceHojeProcedencia.length === 0}
                      onClick={() => abrirPedidoDadosLoteProcedencia(itensVenceHojeProcedencia)}
                    >
                      Imprimir tudo que vence hoje ({itensVenceHojeProcedencia.length})
                    </button>
                    {gruposProcedencia.map((grupo) => {
                      const itensGrupoVenceHojeProc = grupo.itens.filter((e) => e.restam <= 0);
                      return (
                        <div key={grupo.duracao} style={{ marginBottom: 22 }}>
                          <div className="etq-grupo-header">
                            <h3 style={{ margin: 0, fontSize: 14 }}>Validade: {grupo.duracao} dia{grupo.duracao === 1 ? '' : 's'} ({grupo.itens.length})</h3>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              disabled={itensGrupoVenceHojeProc.length === 0}
                              onClick={() => abrirPedidoDadosLoteProcedencia(itensGrupoVenceHojeProc)}
                            >
                              Imprimir os que vencem deste grupo ({itensGrupoVenceHojeProc.length})
                            </button>
                          </div>
                          {grupo.itens.map((e) => {
                            let textoStatus = 'Ok';
                            if (e.status === 'vencido') textoStatus = `Vencida há ${Math.abs(e.restam)}d`;
                            else if (e.status === 'atencao') textoStatus = e.restam === 0 ? 'Vence hoje' : `Vence em ${e.restam}d`;
                            return (
                              <div key={e.id} className={`etq-item etq-${e.status}`}>
                                <div className="etq-info">
                                  <div className="etq-nome">{e.produto}</div>
                                  <div className="etq-meta">
                                    {e.fornecedor} · Lote {e.lote} · SIF {e.sif} · Manipulado {formatarBR(e.dataManipulacao)} · Colaborador: {e.colaborador || '—'} · Válido até {formatarBR(e.dataValidade)}
                                  </div>
                                </div>
                                <span className="etq-status">{textoStatus}</span>
                                <div className="etq-actions">
                                  <input
                                    type="number"
                                    min="1"
                                    className="etq-qtd-input"
                                    value={qtdReimprimirProc[e.id] ?? 1}
                                    onChange={(ev) => setQtdReimprimirProc({ ...qtdReimprimirProc, [e.id]: ev.target.value })}
                                  />
                                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => reimprimirProcedencia(e)}>
                                    Imprimir
                                  </button>
                                  <button type="button" className="btn btn-danger btn-sm" onClick={() => removerProcedencia(e.id)}>
                                    Trocada
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            )}

            {aba === 'nova-procedencia' && (
              <div className="card">
                <h2 style={{ marginBottom: 14 }}>Registrar procedência</h2>
                {produtosProcedencia.length === 0 ? (
                  <div className="empty">Cadastre um produto do tipo &quot;procedência&quot; na aba &quot;Produtos&quot; antes de registrar uma etiqueta.</div>
                ) : (
                  <>
                    <div className="field">
                      <label>Produto</label>
                      <select value={procProdutoId} onChange={(ev) => selecionarProdutoProc(ev.target.value)}>
                        {produtosProcedencia.map((p) => (
                          <option key={p.id} value={p.id}>{p.nome}</option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label>Validade (dias) — do produto selecionado</label>
                      <input type="number" min="0" value={procDias} disabled />
                    </div>
                    <div className="field">
                      <label>Fornecedor/Marca</label>
                      <input
                        type="text"
                        placeholder="Ex: Benassi RJ"
                        value={procFornecedor}
                        onChange={(ev) => { setProcFornecedor(ev.target.value); setErroProc(''); }}
                      />
                    </div>
                    <div className="grid2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                      <div className="field">
                        <label>Lote</label>
                        <input
                          type="text"
                          value={procLote}
                          onChange={(ev) => { setProcLote(ev.target.value); setErroProc(''); }}
                        />
                      </div>
                      <div className="field">
                        <label>SIF (opcional)</label>
                        <input
                          type="text"
                          value={procSif}
                          onChange={(ev) => { setProcSif(ev.target.value); setErroProc(''); }}
                        />
                      </div>
                    </div>
                    <div className="field">
                      <label>Validade original (embalagem)</label>
                      <input
                        type="date"
                        value={procDataValidadeOriginal}
                        onChange={(ev) => { setProcDataValidadeOriginal(ev.target.value); setErroProc(''); }}
                      />
                    </div>
                    <div className="field">
                      <label>Data de manipulação</label>
                      <input type="date" value={procDataManip} onChange={(ev) => setProcDataManip(ev.target.value)} />
                    </div>
                    <div className="field">
                      <label>Colaborador</label>
                      <input
                        type="text"
                        placeholder="Nome de quem preparou"
                        value={procColaborador}
                        onChange={(ev) => { setProcColaborador(ev.target.value); setErroProc(''); }}
                      />
                    </div>
                    <div className="field">
                      <label>Quantidade de etiquetas a imprimir</label>
                      <input type="number" min="1" value={procQtdNova} onChange={(ev) => setProcQtdNova(ev.target.value)} />
                    </div>
                    {erroProc ? <div className="name-required">⚠️ {erroProc}</div> : null}
                    <button type="button" className="btn btn-primary" disabled={procSalvando} onClick={salvarProcedencia} style={{ marginTop: 10 }}>
                      {procSalvando ? 'Salvando…' : 'Salvar e gerar etiqueta'}
                    </button>
                    {gruposCatalogoProcedencia.map((g) => (
                      <button
                        key={g.dias}
                        type="button"
                        className="btn btn-ghost"
                        disabled={procSalvando}
                        onClick={() => abrirCriarGrupoProcedencia(g.dias, g.produtos)}
                        style={{ marginTop: 10, marginLeft: 10 }}
                      >
                        Criar grupo de {g.dias}d ({g.produtos.length} produtos)
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}

            {aba === 'producao-ativas' && (
              <div className="card">
                <h2 style={{ marginBottom: 14 }}>
                  Produção em estoque
                  {comStatusProducao.length > 0 && (
                    <span style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--muted)' }}>
                      {' '}— {vencidasProducao} vencida(s), {atencaoProducao} para verificar em breve
                    </span>
                  )}
                </h2>
                <p className="empty" style={{ textAlign: 'left', padding: '0 0 14px' }}>
                  Cada lote produzido (descascado/porcionado/congelado e guardado no estoque) é
                  independente — é normal ter vários lotes do mesmo produto ativos ao mesmo tempo.
                </p>
                {comStatusProducao.length === 0 ? (
                  <div className="empty">Nenhuma etiqueta de produção ativa. Vá em &quot;Nova produção&quot; para registrar um lote.</div>
                ) : (
                  comStatusProducao.map((e) => {
                    let textoStatus = 'Ok';
                    if (e.status === 'vencido') textoStatus = `Vencida há ${Math.abs(e.restam)}d`;
                    else if (e.status === 'atencao') textoStatus = e.restam === 0 ? 'Vence hoje' : `Vence em ${e.restam}d`;
                    return (
                      <div key={e.id} className={`etq-item etq-${e.status}`}>
                        <div className="etq-info">
                          <div className="etq-nome">{e.produto}</div>
                          <div className="etq-meta">
                            Manipulado {formatarBR(e.dataManipulacao)} · Colaborador: {e.colaborador || '—'} · Válido até {formatarBR(e.dataValidade)}
                          </div>
                        </div>
                        <span className="etq-status">{textoStatus}</span>
                        <div className="etq-actions">
                          <input
                            type="number"
                            min="1"
                            className="etq-qtd-input"
                            value={qtdReimprimirProducao[e.id] ?? 1}
                            onChange={(ev) => setQtdReimprimirProducao({ ...qtdReimprimirProducao, [e.id]: ev.target.value })}
                          />
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => reimprimirProducao(e)}>
                            Imprimir
                          </button>
                          <button type="button" className="btn btn-danger btn-sm" onClick={() => removerProducao(e.id)}>
                            Remover
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {aba === 'producao-nova' && (
              <div className="card">
                <h2 style={{ marginBottom: 14 }}>Registrar produção</h2>
                {produtosProducao.length === 0 ? (
                  <div className="empty">Nenhum produto de produção cadastrado.</div>
                ) : (
                  <>
                    <div className="field">
                      <label>Produto</label>
                      <select value={producaoProdutoId} onChange={(ev) => selecionarProdutoProducao(ev.target.value)}>
                        {produtosProducao.map((p) => (
                          <option key={p.id} value={p.id}>{p.nome}</option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label>Validade (dias) — do produto selecionado</label>
                      <input type="number" min="0" value={producaoDias} disabled />
                    </div>
                    <div className="field">
                      <label>Data de manipulação</label>
                      <input type="date" value={producaoDataManip} onChange={(ev) => setProducaoDataManip(ev.target.value)} />
                    </div>
                    <div className="field">
                      <label>Colaborador</label>
                      <input
                        type="text"
                        placeholder="Nome de quem produziu"
                        value={producaoColaborador}
                        onChange={(ev) => { setProducaoColaborador(ev.target.value); setErroProducao(''); }}
                      />
                    </div>
                    <div className="field">
                      <label>Quantidade de etiquetas a imprimir</label>
                      <input type="number" min="1" value={producaoQtdNova} onChange={(ev) => setProducaoQtdNova(ev.target.value)} />
                    </div>
                    {erroProducao ? <div className="name-required">⚠️ {erroProducao}</div> : null}
                    <button type="button" className="btn btn-primary" disabled={producaoSalvando} onClick={salvarProducao} style={{ marginTop: 10 }}>
                      {producaoSalvando ? 'Salvando…' : 'Salvar e gerar etiqueta'}
                    </button>
                  </>
                )}
              </div>
            )}

            {aba === 'produtos' && (
              <div className="card">
                <h2 style={{ marginBottom: 14 }}>Catálogo de produtos</h2>
                <div className="grid2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, alignItems: 'flex-end' }}>
                  <div className="field">
                    <label>Nome do produto</label>
                    <input
                      type="text"
                      placeholder="Ex: Suco de laranja 500ml"
                      value={novoNome}
                      onChange={(ev) => setNovoNome(ev.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label>Validade padrão (dias)</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="Ex: 30"
                      value={novoDias}
                      onChange={(ev) => setNovoDias(ev.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label>Tipo de etiqueta</label>
                    <select value={novoTipo} onChange={(ev) => setNovoTipo(ev.target.value)}>
                      <option value="manipulacao">Manipulação</option>
                      <option value="procedencia">Procedência</option>
                    </select>
                  </div>
                </div>
                <button type="button" className="btn btn-primary btn-sm" onClick={adicionarProduto}>
                  Adicionar produto
                </button>
                <div style={{ marginTop: 16 }}>
                  {produtos.length === 0 ? (
                    <div className="empty">Nenhum produto cadastrado ainda.</div>
                  ) : (
                    produtos.map((p) => (
                      <div key={p.id} className="etq-produto-row">
                        <div className="etq-produto-nome">{p.nome}</div>
                        <div className="etq-produto-dias">
                          {(p.tipoEtiqueta || 'manipulacao') === 'procedencia' ? 'Procedência' : 'Manipulação'} · {p.dias} dia{p.dias === 1 ? '' : 's'}
                        </div>
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => removerProduto(p.id)}>
                          Remover
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {aba === 'config' && (
              <div className="card" style={{ marginBottom: 16 }}>
                <h2 style={{ marginBottom: 6 }}>Nome da loja</h2>
                <p className="empty" style={{ textAlign: 'left', padding: '0 0 14px' }}>
                  Identifica de qual loja veio o aviso quando chega no Telegram — importante quando
                  tiver mais de uma loja usando o app, já que cada instalação é separada das outras.
                </p>
                <div className="etq-config-row">
                  <div className="field">
                    <label>Nome desta loja</label>
                    <input
                      type="text"
                      placeholder="Ex: Niterói"
                      value={cfgNomeLoja}
                      onChange={(ev) => setCfgNomeLoja(ev.target.value)}
                    />
                  </div>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={salvarConfig}>
                    Salvar nome
                  </button>
                </div>
                {!config.nomeLoja ? (
                  <div className="name-required" style={{ marginTop: 10 }}>⚠️ Nome da loja ainda não configurado — os avisos no Telegram vão sair como "Loja (nome não configurado)".</div>
                ) : null}
              </div>
            )}

            {aba === 'config' && (
              <div className="card">
                <h2 style={{ marginBottom: 6 }}>Tamanho da etiqueta</h2>
                <p className="empty" style={{ textAlign: 'left', padding: '0 0 14px' }}>
                  Ajuste a largura e a altura para bater com o tamanho físico da etiqueta usada nessa loja.
                </p>
                <div className="etq-config-row">
                  <div className="field">
                    <label>Largura (mm)</label>
                    <input type="number" min="20" value={cfgLargura} onChange={(ev) => setCfgLargura(ev.target.value)} />
                  </div>
                  <div className="field">
                    <label>Altura (mm)</label>
                    <input type="number" min="20" value={cfgAltura} onChange={(ev) => setCfgAltura(ev.target.value)} />
                  </div>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={salvarConfig}>
                    Salvar tamanho
                  </button>
                </div>
                <p className="empty" style={{ textAlign: 'left', padding: '14px 0 0' }}>
                  Tamanho atual salvo: {config.larguraMm}mm x {config.alturaMm}mm.
                </p>
              </div>
            )}

            {aba === 'config-telegram' && (
              <div className="card">
                <h2 style={{ marginBottom: 6 }}>Aviso de etiqueta por Telegram</h2>
                <p className="empty" style={{ textAlign: 'left', padding: '0 0 14px' }}>
                  Quem deve receber aviso quando uma etiqueta dessa loja vence amanhã ou hoje. Cada pessoa precisa mandar uma mensagem pro bot pelo menos uma vez antes de aparecer aqui pra adicionar.
                </p>

                <div style={{ marginTop: 16 }}>
                  {telegramChats.length === 0 ? (
                    <div className="empty">Nenhum contato salvo ainda — enquanto isso, o aviso não é enviado por Telegram.</div>
                  ) : (
                    telegramChats.map((c) => (
                      <div key={c.id} className="etq-produto-row">
                        <div className="etq-produto-nome">{c.nome}</div>
                        <button type="button" className="btn btn-danger btn-sm" disabled={telegramSalvando} onClick={() => removerChatTelegram(c.id)}>
                          Remover
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 14 }} disabled={telegramDetectando} onClick={detectarConversasTelegram}>
                  {telegramDetectando ? 'Procurando...' : 'Detectar conversas novas'}
                </button>

                {telegramCandidatos.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    {telegramCandidatos.map((c) => (
                      <div key={c.id} className="etq-produto-row">
                        <div className="etq-produto-nome">{c.nome}</div>
                        <button type="button" className="btn btn-ghost btn-sm" disabled={telegramSalvando} onClick={() => adicionarChatTelegram(c)}>
                          Adicionar
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
