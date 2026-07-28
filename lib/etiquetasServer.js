import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import { DEFAULT_STORE } from './stores';

// Banco local — cada instalação (cada loja) tem o seu próprio arquivo,
// sem sincronizar com nenhuma outra loja nem com a nuvem. Quando roda
// dentro do Electron empacotado, ETIQUETAS_DATA_DIR aponta pra pasta de
// dados do usuário (Program Files não é gravável sem admin); em dev local
// continua usando a pasta do projeto, igual sempre foi.
const dataDir = process.env.ETIQUETAS_DATA_DIR || path.join(process.cwd(), 'data');
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, 'etiquetas.db'));
db.pragma('journal_mode = WAL');

// Precisa saber se a tabela já existia ANTES de criar — é o que diferencia
// "banco novo, nunca usado" (aí sim entra o catálogo padrão) de "tabela já
// existia mas está vazia porque alguém apagou tudo de propósito" (não deve
// trazer os produtos padrão de volta escondido).
const produtosJaExistia = !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='produtos'").get();
const telegramChatsJaExistia = !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='telegram_chats'").get();

db.exec(`
  CREATE TABLE IF NOT EXISTS produtos (
    id TEXT PRIMARY KEY, nome TEXT NOT NULL, dias INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS etiquetas_manipulacao (
    id TEXT PRIMARY KEY, produto TEXT NOT NULL, data_manipulacao TEXT NOT NULL,
    data_validade TEXT NOT NULL, colaborador TEXT NOT NULL, avisos TEXT NOT NULL DEFAULT '{}'
  );
  CREATE TABLE IF NOT EXISTS etiquetas_producao (
    id TEXT PRIMARY KEY, produto TEXT NOT NULL, data_manipulacao TEXT NOT NULL,
    data_validade TEXT NOT NULL, colaborador TEXT NOT NULL, avisos TEXT NOT NULL DEFAULT '{}'
  );
  CREATE TABLE IF NOT EXISTS procedencias (
    id TEXT PRIMARY KEY, produto TEXT NOT NULL, fornecedor TEXT NOT NULL, lote TEXT NOT NULL,
    sif TEXT NOT NULL, data_validade_original TEXT NOT NULL, data_manipulacao TEXT NOT NULL,
    data_validade TEXT NOT NULL, colaborador TEXT NOT NULL, avisos TEXT NOT NULL DEFAULT '{}'
  );
  CREATE TABLE IF NOT EXISTS telegram_chats (
    chat_id TEXT PRIMARY KEY, nome TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS config (
    id INTEGER PRIMARY KEY CHECK (id = 1), largura_mm INTEGER NOT NULL, altura_mm INTEGER NOT NULL
  );
`);

// Migração: adiciona a coluna de tipo de etiqueta se o banco foi criado
// antes dela existir. Produto já cadastrado vira "manipulacao" por padrão
// (dá pra trocar depois pela tela).
const colunasProdutos = db.prepare("PRAGMA table_info(produtos)").all().map((c) => c.name);
if (!colunasProdutos.includes('tipo_etiqueta')) {
  db.exec("ALTER TABLE produtos ADD COLUMN tipo_etiqueta TEXT NOT NULL DEFAULT 'manipulacao'");
}

// Migração: nome da loja dessa instalação — cada loja tem seu próprio banco
// local, então precisa de um nome próprio pra identificar de qual loja veio
// o aviso no Telegram (antes disso usava uma lista de lojas compartilhada
// com o outro app via Redis, que não existe dentro do instalador e sempre
// caía no mesmo nome fixo pra qualquer loja).
const colunasConfig = db.prepare("PRAGMA table_info(config)").all().map((c) => c.name);
if (!colunasConfig.includes('nome_loja')) {
  db.exec("ALTER TABLE config ADD COLUMN nome_loja TEXT NOT NULL DEFAULT ''");
}

// Catálogo padrão — só entra uma vez, na primeira criação do banco (nunca
// mais depois disso, nem se o catálogo ficar vazio por remoção manual).
// Atualizado em jul/2026: nomes e validades corrigidos (ver migração logo
// abaixo, que atualiza instalações que já existiam com o catálogo antigo).
const DEFAULT_PRODUTOS = [
  { id: 'mrzefz1eu9x2g', nome: 'Limão', dias: 1, tipoEtiqueta: 'manipulacao' },
  { id: 'mrzefz1f6x8mez', nome: 'Leite', dias: 2, tipoEtiqueta: 'manipulacao' },
  { id: 'mrzefz1fkl3pge', nome: 'Suco de laranja', dias: 2, tipoEtiqueta: 'manipulacao' },
  { id: 'mrzefz1fyq7t3v', nome: 'Hortelã', dias: 5, tipoEtiqueta: 'manipulacao' },
  { id: 'mrzefz1gaxi14e', nome: 'Aipo', dias: 5, tipoEtiqueta: 'manipulacao' },
  { id: 'mrzefz1gnzqhg1', nome: 'Morango in natura', dias: 5, tipoEtiqueta: 'manipulacao' },
  { id: 'mrzefz1h05h9xm', nome: 'Mamão in natura', dias: 5, tipoEtiqueta: 'manipulacao' },
  { id: 'mrzefz1hex4o0f', nome: 'Abacaxi in natura', dias: 5, tipoEtiqueta: 'manipulacao' },
  { id: 'mrzefz1hr2v3ns', nome: 'Uva vermelha in natura', dias: 5, tipoEtiqueta: 'manipulacao' },
  { id: 'mrzefz1i460e8h', nome: 'Banana in natura', dias: 5, tipoEtiqueta: 'manipulacao' },
  { id: 'mrzefz1ihkk63b', nome: 'Iogurte', dias: 5, tipoEtiqueta: 'manipulacao' },
  { id: 'mrzefz1iucfrgt', nome: 'Xarope de açaí', dias: 5, tipoEtiqueta: 'manipulacao' },
  { id: 'mrzefz1j75hd0e', nome: 'Xarope de açúcar', dias: 5, tipoEtiqueta: 'manipulacao' },
  { id: 'mrzefz1jjcz44m', nome: 'Maçã congelada', dias: 30, tipoEtiqueta: 'manipulacao' },
  { id: 'mrzefz1jw0mvdc', nome: 'Abacate congelado', dias: 30, tipoEtiqueta: 'manipulacao' },
  { id: 'mrzefz1k8j5c4p', nome: 'Mamão congelado', dias: 30, tipoEtiqueta: 'manipulacao' },
  { id: 'mrzefz1kkuvxwb', nome: 'Melancia congelada', dias: 30, tipoEtiqueta: 'manipulacao' },
  { id: 'mrzefz1kx8p1by', nome: 'Pêssego congelado', dias: 30, tipoEtiqueta: 'manipulacao' },
  { id: 'mrzefz1l9k5m1x', nome: 'Abacaxi congelado', dias: 30, tipoEtiqueta: 'manipulacao' },
  { id: 'mrzefz1lm7ozzq', nome: 'Banana congelada', dias: 30, tipoEtiqueta: 'manipulacao' },
  { id: 'mrzefz1lyy9r68', nome: 'Kiwi congelado', dias: 30, tipoEtiqueta: 'manipulacao' },
  { id: 'mrzefz1mb9tvfl', nome: 'Gengibre congelado', dias: 30, tipoEtiqueta: 'manipulacao' },
  { id: 'mrzefz1mnwif0c', nome: 'Laranja congelada', dias: 30, tipoEtiqueta: 'manipulacao' },
  { id: 'mrzefz1mzo3wq4', nome: 'Uva verde congelada', dias: 30, tipoEtiqueta: 'manipulacao' },
  { id: 'mrzefz1nbxu77h', nome: 'Uva vermelha congelada', dias: 30, tipoEtiqueta: 'manipulacao' },
  { id: 'mrzefz1nokm3ie', nome: 'Cenoura congelada', dias: 30, tipoEtiqueta: 'manipulacao' },
  { id: 'mrzefz1o0dt2ip', nome: 'Beterraba congelada', dias: 30, tipoEtiqueta: 'manipulacao' },
  { id: 'mrzefz1odaqfmb', nome: 'Pepino', dias: 30, tipoEtiqueta: 'manipulacao' },
  { id: 'mrzefz1opk9x2c', nome: 'Adoçante', dias: 30, tipoEtiqueta: 'procedencia' },
  { id: 'mrzefz1p2xf1yw', nome: 'Açúcar', dias: 30, tipoEtiqueta: 'procedencia' },
  { id: 'mrzefz1pey81pn', nome: 'Álcool de limpeza', dias: 30, tipoEtiqueta: 'procedencia' },
  { id: 'mrzefz1pr2ovxe', nome: 'Creme de coco', dias: 30, tipoEtiqueta: 'procedencia' },
  { id: 'mrzefz1q3wgqzb', nome: 'Flocos de arroz', dias: 30, tipoEtiqueta: 'procedencia' },
  { id: 'mrzefz1qftl80v', nome: 'Aveia', dias: 30, tipoEtiqueta: 'procedencia' },
  { id: 'mrzefz1qrgxm2h', nome: 'Granola', dias: 30, tipoEtiqueta: 'procedencia' },
  { id: 'mrzefz1r3l7t1c', nome: 'Coco em lascas', dias: 30, tipoEtiqueta: 'procedencia' },
  { id: 'mrzefz1rf99vwq', nome: 'Coco ralado', dias: 30, tipoEtiqueta: 'procedencia' },
  { id: 'mrzefz1rrmkq3i', nome: 'Proteína de soja', dias: 30, tipoEtiqueta: 'procedencia' },
  { id: 'mrzefz1s3dt8ye', nome: 'Leite integral - pó', dias: 30, tipoEtiqueta: 'procedencia' },
  { id: 'mrzefz1sfz5m4l', nome: 'Leite desnatado - pó', dias: 30, tipoEtiqueta: 'procedencia' },
  { id: 'mrzefz1srqi7ob', nome: 'Gojiberry', dias: 30, tipoEtiqueta: 'procedencia' },
  { id: 'mrzefz1t3vxswd', nome: 'Cranberry', dias: 30, tipoEtiqueta: 'procedencia' },
  { id: 'mrzefz1tg81mya', nome: 'Amendoim', dias: 30, tipoEtiqueta: 'procedencia' },
  { id: 'mrzefz1tszd0nn', nome: 'Café solúvel', dias: 30, tipoEtiqueta: 'procedencia' },
  { id: 'mrzefz1u4uh3wt', nome: 'Colágeno', dias: 30, tipoEtiqueta: 'procedencia' },
  { id: 'mrzefz1uh8m9xf', nome: 'Chia', dias: 30, tipoEtiqueta: 'procedencia' },
  { id: 'mrzefz1utk2q7l', nome: 'Cardamomo', dias: 30, tipoEtiqueta: 'procedencia' },
  { id: 'mrzefz1v5rf6bx', nome: 'Leite de soja', dias: 30, tipoEtiqueta: 'procedencia' },
  { id: 'mrzefz1vhy1zk9', nome: 'Canela', dias: 30, tipoEtiqueta: 'procedencia' },
  { id: 'mrzefz1vu4dwqc', nome: 'Gérmen de trigo', dias: 30, tipoEtiqueta: 'procedencia' },
  { id: 'mrzefz1w6zohvp', nome: 'Chá verde', dias: 30, tipoEtiqueta: 'procedencia' },
  { id: 'mrzefz1wiljc2y', nome: 'Polpas de manga', dias: 30, tipoEtiqueta: 'procedencia' },
  { id: 'mrzefz1wvo6t1i', nome: 'Polpas de caju', dias: 30, tipoEtiqueta: 'procedencia' },
  { id: 'mrzefz1x7t9xme', nome: 'Polpas de maracujá', dias: 30, tipoEtiqueta: 'procedencia' },
  { id: 'mrzefz1xk3n4wq', nome: 'Polpas de acerola', dias: 30, tipoEtiqueta: 'procedencia' },
  { id: 'mrzefz1xwz7q8l', nome: 'Polpas de graviola', dias: 30, tipoEtiqueta: 'procedencia' },
  { id: 'mrzefz1y9m1vye', nome: 'Polpas de pitaia', dias: 30, tipoEtiqueta: 'procedencia' },
  { id: 'mrzefz1yl6d0xa', nome: 'Morango congelado', dias: 30, tipoEtiqueta: 'procedencia' },
  { id: 'mrzefz1yxq3o7n', nome: 'Blueberry congelado', dias: 30, tipoEtiqueta: 'procedencia' },
  { id: 'mrzefz1z9v6zjc', nome: 'Amora congelada', dias: 30, tipoEtiqueta: 'procedencia' },
  { id: 'mrzefz1zlz9c1x', nome: 'Cereja congelada', dias: 30, tipoEtiqueta: 'procedencia' },
  { id: 'mrzefz1zy2f4mp', nome: 'Framboesa', dias: 30, tipoEtiqueta: 'procedencia' },
  { id: 'mrzefz209l8pwe', nome: 'Blend Colibri Roxo', dias: 30, tipoEtiqueta: 'procedencia' },
  { id: 'mrzefz20nrbzk8', nome: 'Gelo', dias: 30, tipoEtiqueta: 'procedencia' },
];

if (!produtosJaExistia) {
  const inserirPadrao = db.prepare('INSERT INTO produtos (id, nome, dias, tipo_etiqueta) VALUES (?, ?, ?, ?)');
  for (const p of DEFAULT_PRODUTOS) inserirPadrao.run(p.id, p.nome, p.dias, p.tipoEtiqueta);
}

// Migração pontual: instalações que já existiam antes dessa correção ficaram
// presas nos 4 produtos de exemplo antigos (ids fixos "p1".."p4" — só esse
// catálogo de exemplo usava esses ids). Detecta especificamente esse caso e
// troca pelo catálogo real; se a loja já tiver cadastrado produtos próprios
// (removendo os de exemplo), esses ids não existem mais e nada é tocado.
// Etiquetas já impressas não são afetadas — elas guardam o nome do produto,
// não o id do catálogo.
const temCatalogoExemploAntigo = !!db.prepare(
  "SELECT id FROM produtos WHERE id IN ('p1', 'p2', 'p3', 'p4') LIMIT 1"
).get();
if (produtosJaExistia && temCatalogoExemploAntigo) {
  const trocarPeloCatalogoReal = db.transaction(() => {
    db.prepare('DELETE FROM produtos').run();
    const inserir = db.prepare('INSERT INTO produtos (id, nome, dias, tipo_etiqueta) VALUES (?, ?, ?, ?)');
    for (const p of DEFAULT_PRODUTOS) inserir.run(p.id, p.nome, p.dias, p.tipoEtiqueta);
  });
  trocarPeloCatalogoReal();
}

// Migração pontual (jul/2026): catálogo antigo tinha nomes e validades
// errados (ex: "Limão" com 30 dias em vez de 1, vários "congelado"/"in
// natura" sem essa distinção no nome). Detecta pelos ids fixos do catálogo
// antigo — só troca se TODO produto cadastrado na loja bater com algum
// desses ids, ou seja, só se a loja nunca cadastrou nada por conta própria
// (nenhuma loja tinha feito isso até essa correção). Se a loja tiver
// cadastrado algo próprio, o id não vai bater e a migração não mexe em nada.
const IDS_CATALOGO_2026_07_DESATUALIZADO = [
  'mrustbfau7kuwb', 'mrustbfrbt8vqr', 'mrustbg9fq19z1', 'mrustbgu40vbdw', 'mrustbhbtq1g8e',
  'mrustbhtsc32hq', 'mrustbic3mon88', 'mrustbitvl6nhq', 'mrustbjck7im4i', 'mrustbjqa2c3o2',
  'mrustbk5qtiet3', 'mrustbkie5o6xa', 'mrustbkvysokbe', 'mrustblc2eu38d', 'mrustblrz76lp7',
  'mrustbm3d05z2o', 'mrustbmfmhilc6', 'mrustbms2zk36s', 'mrustbn57kqk7u', 'mrustbnhm4qmyr',
  'mrustbnuakoou4', 'mrustbo6g3ojv6', 'mrustboi0i1q0y', 'mrustbow5vr16w', 'mrustbp9ahzakw',
  'mrustbpoon0mxs', 'mrustbq3tnnza4', 'mrustbqffiew9i', 'mrustbqu3v8vgy', 'mrustbr9vbqr6r',
  'mrustbrn61n0x0', 'mrustbs0v01xec', 'mrustbsda80dvb', 'mrustbsseoevyr', 'mrustbt5g1ler1',
  'mrustbtiiyf0fi', 'mrustbtvv2sfeb', 'mrustbu6dhmmgm', 'mrustbuid02pz2', 'mrustbutg9sdr1',
  'mrustbv441joe1', 'mrustbvlmwg8a8', 'mrustbvyyil9l7', 'mrustbwblwo66l', 'mrustbwt6qph82',
  'mrustbxaslo1zt', 'mrustbxqe1et2v', 'mrustby1hdj34b', 'mrustbyf9217fw', 'mrustbyr9jf2h8',
  'mrustbz6otdnf1', 'mrustbziwj4yp9', 'mrustbzymhpd4i', 'mrustc0d9zzngh', 'mrustc0rg2f282',
  'mrustc159mywv4', 'mrustc1lhylgsz', 'mrustc20r7ug2b', 'mrustc2ct8v6w6', 'mrustc2u9d1din',
  'mrustc350jc8dp', 'mrustc3l95c77c',
];
const idsCadastrados = produtosJaExistia ? db.prepare('SELECT id FROM produtos').all().map((r) => r.id) : [];
const catalogoAntigoIntacto = idsCadastrados.length > 0
  && idsCadastrados.every((id) => IDS_CATALOGO_2026_07_DESATUALIZADO.includes(id));
if (catalogoAntigoIntacto) {
  const trocarPeloCatalogoCorrigido = db.transaction(() => {
    db.prepare('DELETE FROM produtos').run();
    const inserir = db.prepare('INSERT INTO produtos (id, nome, dias, tipo_etiqueta) VALUES (?, ?, ?, ?)');
    for (const p of DEFAULT_PRODUTOS) inserir.run(p.id, p.nome, p.dias, p.tipoEtiqueta);
  });
  trocarPeloCatalogoCorrigido();
}

// Migração pontual (jul/2026): lojas que já tinham customizado o catálogo
// próprio antes dos produtos de "Produção" existirem nunca ganharam esses
// itens (as migrações acima só trocam o catálogo inteiro quando ele está
// intacto/não-customizado). Aqui só insere pelo nome os que ainda faltam,
// sem mexer em mais nada — não afeta produto nenhum que a loja já tenha.
const NOMES_PRODUCAO_OBRIGATORIOS = [
  'Hortelã', 'Aipo',
  'Maçã congelada', 'Abacate congelado', 'Mamão congelado', 'Melancia congelada',
  'Pêssego congelado', 'Abacaxi congelado', 'Banana congelada', 'Kiwi congelado',
  'Gengibre congelado', 'Laranja congelada', 'Uva verde congelada',
  'Uva vermelha congelada', 'Cenoura congelada', 'Beterraba congelada', 'Pepino',
];
const nomesCadastrados = new Set(db.prepare('SELECT nome FROM produtos').all().map((r) => r.nome));
const produtosProducaoFaltantes = DEFAULT_PRODUTOS.filter(
  (p) => NOMES_PRODUCAO_OBRIGATORIOS.includes(p.nome) && !nomesCadastrados.has(p.nome)
);
if (produtosProducaoFaltantes.length > 0) {
  const inserirFaltante = db.prepare('INSERT INTO produtos (id, nome, dias, tipo_etiqueta) VALUES (?, ?, ?, ?)');
  for (const p of produtosProducaoFaltantes) inserirFaltante.run(p.id, p.nome, p.dias, p.tipoEtiqueta);
}

// Destinatários padrão do aviso por Telegram — só entram na primeira
// criação do banco (ex: instalador novo), igual o catálogo de produtos.
// Se alguém remover os dois pela tela depois, não volta sozinho.
const DEFAULT_TELEGRAM_CHATS = [
  { id: '5847745107', nome: 'F2' },
  { id: '5490929115', nome: 'Augusto Fernandes' },
];

if (!telegramChatsJaExistia) {
  const inserirChatPadrao = db.prepare('INSERT INTO telegram_chats (chat_id, nome) VALUES (?, ?)');
  for (const c of DEFAULT_TELEGRAM_CHATS) inserirChatPadrao.run(c.id, c.nome);
}

// Tamanho padrão de etiqueta (impressora térmica da loja).
export const DEFAULT_CONFIG = { larguraMm: 60, alturaMm: 40, nomeLoja: '' };

export function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Mantido por compatibilidade com as rotas existentes — cada instalação já
// é uma loja só, então o valor não influencia mais qual banco é lido.
export function getStoreId(request) {
  const id = request.headers.get('x-store-id');
  return id && /^[a-z0-9-]{1,64}$/i.test(id) ? id : DEFAULT_STORE;
}

function linhaEtiquetaParaRegistro(row) {
  return {
    id: row.id,
    produto: row.produto,
    dataManipulacao: row.data_manipulacao,
    dataValidade: row.data_validade,
    colaborador: row.colaborador,
    avisos: JSON.parse(row.avisos || '{}'),
  };
}

function linhaProcedenciaParaRegistro(row) {
  return {
    id: row.id,
    produto: row.produto,
    fornecedor: row.fornecedor,
    lote: row.lote,
    sif: row.sif,
    dataValidadeOriginal: row.data_validade_original,
    dataManipulacao: row.data_manipulacao,
    dataValidade: row.data_validade,
    colaborador: row.colaborador,
    avisos: JSON.parse(row.avisos || '{}'),
  };
}

export async function getProdutos() {
  return db.prepare('SELECT id, nome, dias, tipo_etiqueta as tipoEtiqueta FROM produtos').all();
}

export async function saveProdutos(produtos) {
  const tx = db.transaction((lista) => {
    db.prepare('DELETE FROM produtos').run();
    const inserir = db.prepare('INSERT INTO produtos (id, nome, dias, tipo_etiqueta) VALUES (?, ?, ?, ?)');
    for (const p of lista) inserir.run(p.id, p.nome, p.dias, p.tipoEtiqueta === 'procedencia' ? 'procedencia' : 'manipulacao');
  });
  tx(produtos);
}

export async function getEtiquetas() {
  return db.prepare('SELECT * FROM etiquetas_manipulacao').all().map(linhaEtiquetaParaRegistro);
}

export async function saveEtiquetas(_storeId, etiquetas) {
  const tx = db.transaction((lista) => {
    db.prepare('DELETE FROM etiquetas_manipulacao').run();
    const inserir = db.prepare(`
      INSERT INTO etiquetas_manipulacao (id, produto, data_manipulacao, data_validade, colaborador, avisos)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const e of lista) inserir.run(e.id, e.produto, e.dataManipulacao, e.dataValidade, e.colaborador, JSON.stringify(e.avisos || {}));
  });
  tx(etiquetas);
}

export async function getProducao() {
  return db.prepare('SELECT * FROM etiquetas_producao').all().map(linhaEtiquetaParaRegistro);
}

export async function saveProducao(_storeId, etiquetas) {
  const tx = db.transaction((lista) => {
    db.prepare('DELETE FROM etiquetas_producao').run();
    const inserir = db.prepare(`
      INSERT INTO etiquetas_producao (id, produto, data_manipulacao, data_validade, colaborador, avisos)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const e of lista) inserir.run(e.id, e.produto, e.dataManipulacao, e.dataValidade, e.colaborador, JSON.stringify(e.avisos || {}));
  });
  tx(etiquetas);
}

export async function getProcedencias() {
  return db.prepare('SELECT * FROM procedencias').all().map(linhaProcedenciaParaRegistro);
}

export async function saveProcedencias(_storeId, procedencias) {
  const tx = db.transaction((lista) => {
    db.prepare('DELETE FROM procedencias').run();
    const inserir = db.prepare(`
      INSERT INTO procedencias (id, produto, fornecedor, lote, sif, data_validade_original, data_manipulacao, data_validade, colaborador, avisos)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const p of lista) {
      inserir.run(p.id, p.produto, p.fornecedor, p.lote, p.sif, p.dataValidadeOriginal, p.dataManipulacao, p.dataValidade, p.colaborador, JSON.stringify(p.avisos || {}));
    }
  });
  tx(procedencias);
}

// chats: [{ id: '123456', nome: 'João' }, ...]
export async function getTelegramChats() {
  return db.prepare('SELECT chat_id as id, nome FROM telegram_chats').all();
}

export async function saveTelegramChats(_storeId, chats) {
  const tx = db.transaction((lista) => {
    db.prepare('DELETE FROM telegram_chats').run();
    const inserir = db.prepare('INSERT INTO telegram_chats (chat_id, nome) VALUES (?, ?)');
    for (const c of lista) inserir.run(c.id, c.nome);
  });
  tx(chats);
}

export async function getConfig() {
  const row = db.prepare('SELECT * FROM config WHERE id = 1').get();
  return row ? { larguraMm: row.largura_mm, alturaMm: row.altura_mm, nomeLoja: row.nome_loja || '' } : DEFAULT_CONFIG;
}

export async function saveConfig(_storeId, config) {
  const atual = await getConfig();
  const nomeLoja = config.nomeLoja !== undefined ? config.nomeLoja : atual.nomeLoja;
  db.prepare('INSERT OR REPLACE INTO config (id, largura_mm, altura_mm, nome_loja) VALUES (1, ?, ?, ?)')
    .run(config.larguraMm, config.alturaMm, nomeLoja);
}
