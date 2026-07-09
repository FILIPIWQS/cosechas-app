import { Redis } from '@upstash/redis';
import { DEFAULT_STORE } from '../../../lib/stores';
import { getStores } from '../../../lib/storesServer';

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const redisConfigured = Boolean(url && token);
const redis = redisConfigured ? new Redis({ url, token }) : null;

// Global catalog: name/image/fornecedor/frequency are shared across every store.
const GLOBAL_HASH_KEY = 'siembras:products:hash';
const GLOBAL_SEED_VERSION_KEY = 'siembras:seedver';

// Per-store: only counting/par state lives here.
function countsKeyFor(storeId) { return `siembras:${storeId}:counts`; }
function logsKeyFor(storeId) { return `siembras:${storeId}:logs`; }
function dateKeyFor(storeId) { return `siembras:${storeId}:countdate`; }

// Per-store feira (market stall) counts — never resets at midnight, only
// manually via the "Nova contagem de feira" action.
function feiraCountsKeyFor(storeId) { return `siembras:${storeId}:feira:counts`; }

// Pre-refactor per-store hash that combined catalog + counts — kept only so the
// default store's existing data can be migrated once into the new layout.
function legacyStoreHashKeyFor(storeId) { return `siembras:${storeId}:products:hash`; }

// Store ids are managed dynamically (see app/api/stores/route.js), so this only
// sanitizes the header value to a safe key-namespace segment rather than
// checking it against a fixed list.
function getStoreId(request) {
  const id = request.headers.get('x-store-id');
  return id && /^[a-z0-9-]{1,64}$/i.test(id) ? id : DEFAULT_STORE;
}

const SEED_VERSION = 6;
const MAX_LOGS = 3000;
const FREQS = ['diaria', 'semanal', 'quinzenal', 'mensal'];

const SEED = [
  { name: 'Selo (1 Rolo)', image: '/img/selo.jpg', fornecedor: 'Brassi' },
  { name: 'Sacola Plástica (1000 Unidades)', image: '/img/sacola-plastica.jpg', fornecedor: 'Brassi' },
  { name: 'Sacola Kraft + Base para copos (100 unidades)', image: '/img/sacola-kraft.jpg', fornecedor: 'Brassi' },
  { name: 'Guardanapos (1000 unidades)', image: '/img/guardanapos.jpg', fornecedor: 'Brassi' },
  { name: 'Copo M + Canudos (500 unidades)', image: 'https://d1siijb9yj77t6.cloudfront.net/85/thumb/1280w/4d059cd1-24a2-4953-87e8-0e779fd84ab8COOOPO.jpg', fornecedor: 'Brassi' },
  { name: 'Copo G + Canudos (500 unidades)', image: 'https://res.cloudinary.com/dxv7tpwlo/image/upload/v1/foto_1.jpg', fornecedor: 'Brassi' },

  { name: 'Bowl Grande (100 unidades)', image: 'https://d1siijb9yj77t6.cloudfront.net/85/thumb/1280w/1ea84832-5aef-4483-9410-3ca5008742c6bowl.jpg', fornecedor: 'Brassi' },
  { name: 'Colher TRIO (200 unidades)', image: 'https://res.cloudinary.com/dxv7tpwlo/image/upload/v1/foto_2.jpg', fornecedor: 'Nechio' },
  { name: 'Canudo BIO (500 unidades)', image: 'https://res.cloudinary.com/dxv7tpwlo/image/upload/v1/foto_3.jpg', fornecedor: 'Brassi' },
  { name: 'Água 510ml (12 unidades)', image: 'https://d1siijb9yj77t6.cloudfront.net/85/thumb/1280w/f9e5105f-84c1-4b4e-a499-e3ddb47343e11._Agua.png', fornecedor: 'Benassi RJ' },
  { name: 'Whey Protein 900g', image: 'https://d1siijb9yj77t6.cloudfront.net/85/thumb/1280w/a2cde2a6-bd1d-4f71-a978-d990c1c0af19WhatsApp_Image_2023-03-24_at_12.12.12.jpeg', fornecedor: 'Nechio' },
  { name: 'Uva Vermelha KG', image: 'https://d1siijb9yj77t6.cloudfront.net/85/thumb/1280w/c52177d4-ab80-4087-9001-2b24be24fa18Uva_crimson.jpg', fornecedor: 'Benassi RJ' },
  { name: 'Uva Verde KG', image: 'https://d1siijb9yj77t6.cloudfront.net/85/thumb/1280w/565a0aa1-e922-4d3c-a4f1-d33af77c6b0buva-thompson.png', fornecedor: 'Benassi RJ' },
  { name: 'Uva Tompson (Verde) Sem Caroço', image: 'https://res.cloudinary.com/dxv7tpwlo/image/upload/v1/foto_4.jpg', fornecedor: 'Benassi RJ' },
  { name: 'Uva Crimson (Vermelha) Sem Caroço', image: 'https://d1siijb9yj77t6.cloudfront.net/85/thumb/1280w/385102a8-422f-4913-852d-c150acb7580eUVA_VERMELHA.jpeg', fornecedor: 'Benassi RJ' },
  { name: 'Suco de Laranja (Galão 3.5L)', image: 'https://d1siijb9yj77t6.cloudfront.net/85/thumb/1280w/b4206208-ced0-418a-b5d3-3a1cab7c4c45Imagem_do_WhatsApp_de_2025-09-11_as_13.31.02_96216f58.jpg', fornecedor: 'Life RJ' },
  { name: 'Suco de Laranja (Bag 5L)', image: 'https://d1siijb9yj77t6.cloudfront.net/85/thumb/1280w/284a7b3c-b9f0-4ce7-94cf-17405b791dc5life_bag.jpg', fornecedor: 'Life RJ' },
  { name: 'Sorvete de Chocolate 10L', image: 'https://d1siijb9yj77t6.cloudfront.net/85/thumb/1280w/bb3c26a2-afe7-414f-b564-379c92892a7bsorvete_choco.png', fornecedor: 'D+ sorvete' },
  { name: 'Sorvete de Baunilha 10L', image: 'https://d1siijb9yj77t6.cloudfront.net/85/thumb/1280w/30ce2c06-207c-4cf8-aff3-d99523bcf5b0sorvete_creme.png', fornecedor: 'D+ sorvete' },
  { name: 'Salsa UN', image: 'https://d1siijb9yj77t6.cloudfront.net/85/thumb/1280w/8f58c953-6f35-4d9b-8736-6255a053847cSalsa.jpg', fornecedor: 'Benassi RJ' },
  { name: 'Pitaya Barra (1KG)', image: 'https://d1siijb9yj77t6.cloudfront.net/85/thumb/1280w/f8c190c5-e817-4def-b28c-44d77095718dimagem-do-whatsapp-de-2025-04-14---s--11-58-33_da7e6699-pinll9bbod.jpeg', fornecedor: 'Nechio' },
  { name: 'Pepino KG', image: 'https://d1siijb9yj77t6.cloudfront.net/85/thumb/1280w/2a9de215-471d-4483-9f37-b7e8d80c2e66Pepino.jpg', fornecedor: 'Benassi RJ' },
  { name: 'Pasta de Amendoim 1 KG', image: 'https://d1siijb9yj77t6.cloudfront.net/85/thumb/1280w/8ff07249-3d62-475c-9e19-bd3babc9a80epasta_de_amendoim.png', fornecedor: 'Benassi RJ' },
  { name: 'Nuts (Sabor Cranberry) 10 unds.', image: 'https://d1siijb9yj77t6.cloudfront.net/85/thumb/1280w/b557cfda-9e7e-4cd0-9dbd-afb6bc0f2b6aNuts_-_cranberry.png', fornecedor: '' },
  { name: 'Nuts (Sabor Classico) 10 unds.', image: 'https://d1siijb9yj77t6.cloudfront.net/85/thumb/1280w/5499b6f6-e847-4c62-89df-9e4678efe41bNuts_-_classica.png', fornecedor: '' },
  { name: 'Morango In Natura (1KG)', image: 'https://res.cloudinary.com/dxv7tpwlo/image/upload/v1/foto_5.jpg', fornecedor: 'Benassi RJ' },
  { name: 'Morango 1KG', image: 'https://d1siijb9yj77t6.cloudfront.net/85/thumb/1280w/4c57af7a-2a51-4ecd-aba8-6705f1c7e99fMorango.jpg', fornecedor: 'Nechio' },
  { name: 'Mix Sementes Secas 1 (Bubble Waffle) 1KG', image: 'https://d1siijb9yj77t6.cloudfront.net/85/thumb/1280w/c25b6062-3f97-446b-8a61-1c8aa1496ea0Mix_1.jpeg', fornecedor: 'Nechio' },
  { name: 'Melancia KG', image: 'https://d1siijb9yj77t6.cloudfront.net/85/thumb/1280w/a0275b24-3d80-4328-8b06-2f29f593ff58melancia.jpg', fornecedor: 'Benassi RJ' },
  { name: 'Mel 1.1KG (Floresta Verde)', image: 'https://d1siijb9yj77t6.cloudfront.net/85/thumb/1280w/18b20e91-ee0c-4458-ac90-dabc15d7337fMel.jpg', fornecedor: 'Nechio' },
  { name: 'Maça Nacional KG', image: 'https://d1siijb9yj77t6.cloudfront.net/85/thumb/1280w/33afcd5e-57f3-4910-94de-85e74bcb996eMaca.jpg', fornecedor: 'Benassi RJ' },
  { name: 'Maracujá Polpa 1.2KG (Sempre Viva)', image: 'https://d1siijb9yj77t6.cloudfront.net/85/thumb/1280w/367031e2-1e51-4a35-a7e2-3b4341548ba4Maracuja.png', fornecedor: 'Nechio' },
  { name: 'Manga Polpa 1.2KG (Sempre Viva)', image: 'https://d1siijb9yj77t6.cloudfront.net/85/thumb/1280w/44224388-974d-46ed-80cb-797d94754902manga.png', fornecedor: 'Nechio' },
  { name: 'Mamão KG', image: 'https://d1siijb9yj77t6.cloudfront.net/85/thumb/1280w/3bf12179-591c-45f2-b59b-4012d1af5711mamao.jpg', fornecedor: 'Benassi RJ' },
  { name: 'Limão Siciliano', image: 'https://d1siijb9yj77t6.cloudfront.net/85/thumb/1280w/9283f2a7-5732-4d1a-bfbc-1c9d99690db8Limao_siciliano.jpg', fornecedor: 'Benassi RJ' },
  { name: 'Limão KG', image: 'https://d1siijb9yj77t6.cloudfront.net/85/thumb/1280w/c01a0c5f-e000-4cc0-9f3c-7f644fa81f81Limao.jpg', fornecedor: 'Benassi RJ' },
  { name: 'Leite Em Pó [Fardo com 25 unidades x (360g)]', image: 'https://res.cloudinary.com/dxv7tpwlo/image/upload/v1/foto_6.jpg', fornecedor: 'Nechio' },
  { name: 'Laranja Pera', image: 'https://d1siijb9yj77t6.cloudfront.net/85/thumb/1280w/094e66e4-b0f6-49f6-a416-253f63d7db6eLaranja.jpg', fornecedor: 'Benassi RJ' },
  { name: 'Kiwi KG', image: 'https://d1siijb9yj77t6.cloudfront.net/85/thumb/1280w/953e4f55-e1f7-4c4a-8dda-f660971a0841kiwi.jpg', fornecedor: 'Benassi RJ' },
  { name: 'Iogurte Grego 450g (Itambé)', image: 'https://res.cloudinary.com/dxv7tpwlo/image/upload/v1/foto_7.jpg', fornecedor: 'Nechio' },
  { name: 'Iogurte 1000g', image: 'https://res.cloudinary.com/dxv7tpwlo/image/upload/v1/foto_8.jpg', fornecedor: 'D+ sorvete' },
  { name: 'Hortelã', image: 'https://d1siijb9yj77t6.cloudfront.net/85/thumb/1280w/69945986-ff07-413e-b2bb-5abbaf1b6d9fhortela-pimenta.jpg', fornecedor: 'Benassi RJ' },
  { name: 'Graviola Polpa 1.2KG (Sempre Viva)', image: 'https://d1siijb9yj77t6.cloudfront.net/85/thumb/1280w/e604f074-3fc0-4fe2-be62-a77e2a5e96b7graviola.png', fornecedor: 'Nechio' },
  { name: 'Granola Nechio 500g', image: 'https://d1siijb9yj77t6.cloudfront.net/85/thumb/1280w/2d874f09-52b4-4874-b470-ce34db9c9c65granola.jpg', fornecedor: 'Nechio' },
  { name: 'Gengibre KG', image: 'https://d1siijb9yj77t6.cloudfront.net/85/thumb/1280w/2418025f-5f3f-442d-a8e2-d3b3d957f540gengibre.jpg', fornecedor: 'Benassi RJ' },
  { name: 'Espinafre', image: 'https://d1siijb9yj77t6.cloudfront.net/85/thumb/1280w/0ceb6ba5-0dfc-453c-be4c-c500b4caed7despinafre_1.jpg', fornecedor: 'Benassi RJ' },
  { name: 'Framboesa 1.02KG', image: 'https://d1siijb9yj77t6.cloudfront.net/85/thumb/1280w/4e181896-afe6-4c9a-af4f-7df95ebf742aframboesa.jpg', fornecedor: 'Nechio' },
  { name: 'Doce de Leite 1.05KG (Vabene)', image: 'https://d1siijb9yj77t6.cloudfront.net/85/thumb/1280w/ecab4f43-37b8-47f8-a762-9df8dab4cb1fWhatsApp_Image_2022-11-17_at_11.23.15.jpeg', fornecedor: 'Nechio' },
  { name: 'Damasco 500g (Bubble Waffle)', image: 'https://d1siijb9yj77t6.cloudfront.net/85/thumb/1280w/11afc51c-ed95-4926-a52e-7b1988d842b0Damasco.jpeg', fornecedor: 'Nechio' },
  { name: 'Creme de Cupuaçu (7L)', image: 'https://d1siijb9yj77t6.cloudfront.net/85/thumb/1280w/983285e5-2a31-4503-a13a-3f01846420deWhatsApp_Image_2022-10-26_at_10.45.39.jpeg', fornecedor: 'Nechio' },
  { name: 'Creme de Coco (3.4 KG)', image: 'https://d1siijb9yj77t6.cloudfront.net/85/thumb/1280w/aec17148-17f1-43b4-b85d-5eb95d197656creme_de_coco.jpg', fornecedor: 'Benassi Brasil' },
  { name: 'Creme de Avelã 1.01KG (Specialita)', image: 'https://d1siijb9yj77t6.cloudfront.net/85/thumb/1280w/912342d8-5ae4-46de-87ae-52c2d92e7900WhatsApp_Image_2022-11-17_at_11.24.51.jpeg', fornecedor: 'Nechio' },
  { name: 'Cranberry (2KG)', image: 'https://res.cloudinary.com/dxv7tpwlo/image/upload/v1/foto_9.jpg', fornecedor: 'Benassi Brasil' },
  { name: 'Cranberry (11.34KG)', image: 'https://d1siijb9yj77t6.cloudfront.net/85/thumb/1280w/e224ef9d-ce24-4292-8bad-6dc687d6aa4bcranberry.jpg', fornecedor: 'Benassi Brasil' },
  { name: 'Chocolate cremoso 1 kg (Frete a combinar com vendedor)', image: 'https://res.cloudinary.com/dxv7tpwlo/image/upload/v1/foto_10.jpg', fornecedor: 'i9 café' },
  { name: 'Cereja Congelada (1KG)', image: 'https://res.cloudinary.com/dxv7tpwlo/image/upload/v1/foto_11.jpg', fornecedor: 'Nechio' },
  { name: 'Cenoura KG', image: 'https://d1siijb9yj77t6.cloudfront.net/85/thumb/1280w/f52f27e7-a2a5-4dbb-b916-dc5d9536e8d3cenoura.png', fornecedor: 'Benassi RJ' },
  { name: 'Caju Polpa 1.2KG (Sempre Viva)', image: 'https://d1siijb9yj77t6.cloudfront.net/85/thumb/1280w/6bbc323e-4515-4a38-97c7-65ccefb88dd0WhatsApp_Image_2024-06-24_at_17.28.01_1.jpeg', fornecedor: 'Nechio' },
  { name: 'Blend Pura Energia (200G) [15 Und]', image: 'https://d1siijb9yj77t6.cloudfront.net/85/thumb/1280w/4cef3392-f7ff-404f-89c4-02c6057de0a5WhatsApp_Image_2026-04-16_at_16.59.27.jpeg', fornecedor: '' },
  { name: 'Blend Melancia Limão (200G) [15 Und]', image: 'https://d1siijb9yj77t6.cloudfront.net/85/thumb/1280w/4cef3392-f7ff-404f-89c4-02c6057de0a5WhatsApp_Image_2026-04-16_at_16.59.27.jpeg', fornecedor: '' },
  { name: 'Blend Limonada de Coco (200G) [15 Und]', image: 'https://d1siijb9yj77t6.cloudfront.net/85/thumb/1280w/4cef3392-f7ff-404f-89c4-02c6057de0a5WhatsApp_Image_2026-04-16_at_16.59.27.jpeg', fornecedor: '' },
  { name: 'Blend Enamorados (200G) [15 Und]', image: 'https://d1siijb9yj77t6.cloudfront.net/85/thumb/1280w/4cef3392-f7ff-404f-89c4-02c6057de0a5WhatsApp_Image_2026-04-16_at_16.59.27.jpeg', fornecedor: '' },
  { name: 'Blend Controle de Peso (200G) [15 Und]', image: 'https://d1siijb9yj77t6.cloudfront.net/85/thumb/1280w/4cef3392-f7ff-404f-89c4-02c6057de0a5WhatsApp_Image_2026-04-16_at_16.59.27.jpeg', fornecedor: '' },
  { name: 'Blend Colibri Roxo (200G) [15 Und]', image: 'https://d1siijb9yj77t6.cloudfront.net/85/thumb/1280w/4cef3392-f7ff-404f-89c4-02c6057de0a5WhatsApp_Image_2026-04-16_at_16.59.27.jpeg', fornecedor: '' },
  { name: 'Beterraba KG', image: 'https://d1siijb9yj77t6.cloudfront.net/85/thumb/1280w/b8fd83e0-1d58-45c1-8ec5-4082af0cd175beterraba1-1000x1000.jpg', fornecedor: 'Benassi RJ' },
  { name: "Banana D'Agua KG", image: 'https://d1siijb9yj77t6.cloudfront.net/85/thumb/1280w/49330959-4e09-435e-a408-b800333200e0banana.jpg', fornecedor: 'Benassi RJ' },
  { name: 'Açaí (10L)', image: 'https://d1siijb9yj77t6.cloudfront.net/85/thumb/1280w/ff814fec-fb10-4f25-bda5-396b84f5e12facai.jpg', fornecedor: 'Nechio' },
  { name: 'Aveia Nechio 500g', image: 'https://d1siijb9yj77t6.cloudfront.net/85/thumb/1280w/24ee7527-a4e0-44e8-8dbe-9406c91b5178Aveia.jpg', fornecedor: 'Nechio' },
  { name: 'Amora Fruta 1.02KG', image: 'https://d1siijb9yj77t6.cloudfront.net/85/thumb/1280w/74331c99-d277-46c3-b0c8-cf27dfc41249amora.jpg', fornecedor: 'Nechio' },
  { name: 'Aipo UN', image: 'https://d1siijb9yj77t6.cloudfront.net/85/thumb/1280w/66afca3c-7ee0-4481-9667-cd1b52cacc6faipo.jpg', fornecedor: 'Benassi RJ' },
  { name: 'Acerola Polpa 1.2KG (Sempre Viva)', image: 'https://d1siijb9yj77t6.cloudfront.net/85/thumb/1280w/a012e302-6430-4f59-b13e-4bb299f06724Acerola.jpg', fornecedor: 'Nechio' },
  { name: 'Abacaxi KG', image: 'https://d1siijb9yj77t6.cloudfront.net/85/thumb/1280w/63885f48-f112-4bc6-8a1f-f55e214b86d2abacaxi.png', fornecedor: 'Benassi RJ' },
  { name: 'Abacaxi Em Pedaços (Pct 3KG)', image: 'https://res.cloudinary.com/dxv7tpwlo/image/upload/v1/foto_12.jpg', fornecedor: 'NATURCONGELADOS' },
  { name: 'Abacate KG', image: 'https://d1siijb9yj77t6.cloudfront.net/85/thumb/1280w/11bd9399-ae9f-4cb0-964e-95739d6e6404abacate.jpg', fornecedor: 'Benassi RJ' },

  { name: 'SACO PLASTICO 30X40 5KG', image: 'https://http2.mlstatic.com/D_NQ_NP_2X_732801-MLB77379863793_072024-F.webp', fornecedor: '' },
  { name: 'PROTEINA DE SOJA ISOLADA 500g', image: 'https://http2.mlstatic.com/D_NQ_NP_2X_719777-MLB96504770705_102025-F.webp', fornecedor: '' },
  { name: 'PLASTICO FILME', image: 'https://http2.mlstatic.com/D_NQ_NP_2X_897344-MLB92318213493_092025-F.webp', fornecedor: '' },
  { name: 'PESSEGO EM CALDA', image: 'https://encrypted-tbn1.gstatic.com/shopping?q=tbn:ANd9GcSFoK_7j4H1pKzXYsKRkmfLYz-ZDcJQ7oyEarBn6Hg2pGnlC6-xYlnf6zJJcLN4Zt5j5k1EObg8i64uCjUDS5YILjmuyorvpBJSzTrVy2jVoG66LkzGSJ87CO8ps8EIXuMR5zDeJw&usqp=CAc', fornecedor: '' },
  { name: 'LUVA DESCARTAVEL 100UN', image: 'https://http2.mlstatic.com/D_NQ_NP_2X_660148-MLA110430589285_042026-F.webp', fornecedor: '' },
  { name: 'LEITE EM PÓ DESNATADO', image: 'https://http2.mlstatic.com/D_NQ_NP_2X_706442-MLA99931620127_112025-F.webp', fornecedor: '' },
  { name: 'COPO PARA PROVA', image: 'https://http2.mlstatic.com/D_NQ_NP_2X_609928-MLB73541781451_122023-F-copo-descartavel-50ml-cafe-cafezinho-5000-uni-caixa-full.webp', fornecedor: '' },
  { name: 'COLHER PEQUENA', image: 'https://http2.mlstatic.com/D_NQ_NP_2X_817496-MLB89138203383_082025-F.webp', fornecedor: '' },
  { name: 'COCO EM LASCAS 500g', image: 'https://http2.mlstatic.com/D_NQ_NP_2X_810220-MLB74700135866_022024-F.webp', fornecedor: '' },
  { name: 'COCO RALADO 500g', image: 'https://casaspedro.vteximg.com.br/arquivos/ids/214206-550-550/coco-ralado-grosso-kg.png?v=639116946775800000', fornecedor: '' },
  { name: 'CAFÉ SOLUVEL', image: 'https://http2.mlstatic.com/D_NQ_NP_2X_685516-MLA99420381356_112025-F.webp', fornecedor: '' },
  { name: 'AMENDOIM PICADO 500g', image: 'https://http2.mlstatic.com/D_NQ_NP_2X_672345-MLB92386915926_092025-F.webp', fornecedor: '' },
  { name: 'Açucar Cristal 1KG', image: 'https://http2.mlstatic.com/D_NQ_NP_2X_774088-MLU72851295114_112023-F.webp', fornecedor: '' },
];

export const dynamic = 'force-dynamic';

function todayBRT() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function isAdmin(request) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  return request.headers.get('x-admin-password') === expected;
}

function parseProduct(raw) {
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return null; }
  }
  return raw && typeof raw === 'object' ? raw : null;
}

// ---------- Global catalog ----------

async function getCatalogRaw() {
  if (!redis) return [];
  const hash = await redis.hgetall(GLOBAL_HASH_KEY);
  if (!hash || Object.keys(hash).length === 0) return [];
  return Object.values(hash).map(parseProduct).filter(Boolean);
}

async function saveCatalogProduct(product) {
  await redis.hset(GLOBAL_HASH_KEY, { [product.id]: JSON.stringify(product) });
}

// One-time migration: the pre-refactor per-store hash combined catalog fields
// (name/image/fornecedor/frequency) with counting fields (count/par/etc) for
// one store at a time. Split it into the new global catalog + that store's counts.
async function migrateLegacyStoreHash(storeId) {
  const oldHash = await redis.hgetall(legacyStoreHashKeyFor(storeId));
  if (!oldHash || Object.keys(oldHash).length === 0) return false;

  const catalogFields = {};
  const countsFields = {};
  const now = Date.now();
  for (const [id, raw] of Object.entries(oldHash)) {
    const p = parseProduct(raw);
    if (!p) continue;
    catalogFields[id] = JSON.stringify({
      id,
      name: p.name,
      unit: p.unit || '',
      image: p.image || '',
      fornecedor: p.fornecedor || '',
      frequency: p.frequency || 'diaria',
      feira: !!p.feira,
      parFeira: Number(p.parFeira) || 0,
      updatedAt: p.updatedAt || now,
    });
    countsFields[id] = JSON.stringify({
      count: Number(p.count) || 0,
      countedToday: !!p.countedToday,
      lastBy: p.lastBy || '',
      updatedAt: p.updatedAt || now,
      par: Number(p.par) || 0,
    });
  }
  if (Object.keys(catalogFields).length > 0) await redis.hset(GLOBAL_HASH_KEY, catalogFields);
  if (Object.keys(countsFields).length > 0) await redis.hset(countsKeyFor(storeId), countsFields);
  return Object.keys(catalogFields).length > 0;
}

// Guarantees a populated global catalog: use it if present, else migrate the
// default store's pre-refactor hash, else bootstrap directly from SEED.
async function ensureCatalog() {
  let catalog = await getCatalogRaw();
  if (catalog.length > 0) return catalog;

  const migrated = await migrateLegacyStoreHash(DEFAULT_STORE);
  if (migrated) {
    catalog = await getCatalogRaw();
    if (catalog.length > 0) return catalog;
  }

  const now = Date.now();
  const fields = {};
  const seeded = SEED.map((s) => {
    const p = {
      id: genId(),
      name: s.name,
      unit: '',
      image: s.image || '',
      fornecedor: s.fornecedor || '',
      frequency: 'diaria',
      feira: false,
      parFeira: 0,
      updatedAt: now,
    };
    fields[p.id] = JSON.stringify(p);
    return p;
  });
  if (Object.keys(fields).length > 0) {
    await redis.hset(GLOBAL_HASH_KEY, fields);
    await redis.set(GLOBAL_SEED_VERSION_KEY, String(SEED_VERSION));
  }
  return seeded;
}

// Applies image/fornecedor touch-ups from SEED onto the global catalog, once per SEED_VERSION bump.
async function syncSeedIfNeeded(catalog) {
  const ver = Number(await redis.get(GLOBAL_SEED_VERSION_KEY)) || 0;
  if (ver >= SEED_VERSION) return catalog;
  const byName = new Map(catalog.map((p) => [p.name, p]));
  const toUpdate = {};
  for (const s of SEED) {
    const ex = byName.get(s.name);
    if (ex) {
      let changed = false;
      if (s.image && ex.image !== s.image) { ex.image = s.image; changed = true; }
      if (s.fornecedor && !ex.fornecedor) { ex.fornecedor = s.fornecedor; changed = true; }
      if (changed) toUpdate[ex.id] = JSON.stringify(ex);
    }
  }
  if (Object.keys(toUpdate).length > 0) await redis.hset(GLOBAL_HASH_KEY, toUpdate);
  await redis.set(GLOBAL_SEED_VERSION_KEY, String(SEED_VERSION));
  return catalog;
}

// ---------- Per-store counts/logs ----------

async function getCounts(storeId) {
  const hash = await redis.hgetall(countsKeyFor(storeId));
  const out = {};
  if (hash) {
    for (const [id, raw] of Object.entries(hash)) {
      const c = parseProduct(raw);
      if (c) out[id] = c;
    }
  }
  return out;
}

async function getLogs(storeId) {
  if (!redis) return [];
  let data = await redis.get(logsKeyFor(storeId));
  if (data == null) return [];
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch { return []; }
  }
  return Array.isArray(data) ? data : [];
}
async function saveLogs(storeId, logs) { await redis.set(logsKeyFor(storeId), logs.slice(0, MAX_LOGS)); }

// Resets this store's counts when the calendar day (BRT) changes.
// Returns the current countDate string.
async function ensureCurrentDay(storeId) {
  const today = todayBRT();
  const dateKey = dateKeyFor(storeId);
  const stored = await redis.get(dateKey);
  if (stored == null) {
    await redis.set(dateKey, today);
    return today;
  }
  if (stored !== today) {
    const countsKey = countsKeyFor(storeId);
    const hash = await redis.hgetall(countsKey);
    if (hash && Object.keys(hash).length > 0) {
      const now = Date.now();
      const fields = {};
      for (const [id, raw] of Object.entries(hash)) {
        const c = parseProduct(raw);
        if (c) {
          c.count = 0;
          c.countedToday = false;
          c.updatedAt = now;
          fields[id] = JSON.stringify(c);
        }
      }
      if (Object.keys(fields).length > 0) await redis.hset(countsKey, fields);
    }
    await redis.set(dateKey, today);
  }
  return today;
}

function mergeProduct(product, countEntry) {
  const c = countEntry || {};
  return {
    id: product.id,
    name: product.name,
    unit: product.unit || '',
    image: product.image || '',
    fornecedor: product.fornecedor || '',
    frequency: product.frequency || 'diaria',
    feira: !!product.feira,
    parFeira: Number(product.parFeira) || 0,
    count: Number(c.count) || 0,
    par: Number(c.par) || 0,
    countedToday: !!c.countedToday,
    lastBy: c.lastBy || '',
    updatedAt: c.updatedAt || product.updatedAt || 0,
  };
}

export async function GET(request, { params }) {
  const storeId = getStoreId(request);

  if (params.action === 'logs') {
    if (!redisConfigured) return Response.json({ error: 'db_not_configured' }, { status: 503 });
    if (!isAdmin(request)) return Response.json({ error: 'unauthorized' }, { status: 401 });
    return Response.json({ logs: await getLogs(storeId) });
  }
  if (params.action !== 'products') {
    return Response.json({ error: 'not_found' }, { status: 404 });
  }
  if (!redisConfigured) {
    return Response.json({ error: 'db_not_configured' }, { status: 503 });
  }
  try {
    let catalog = await ensureCatalog();
    catalog = await syncSeedIfNeeded(catalog);
    // Day rollover first, then read (so we always return the post-reset state).
    const countDate = await ensureCurrentDay(storeId);
    const counts = await getCounts(storeId);
    const products = catalog.map((p) => mergeProduct(p, counts[p.id]));
    return Response.json({ products, countDate });
  } catch (e) {
    return Response.json({ error: 'read_failed' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  const action = params.action;
  const storeId = getStoreId(request);

  if (action === 'verify') {
    if (!process.env.ADMIN_PASSWORD) {
      return Response.json({ error: 'admin_password_not_set' }, { status: 503 });
    }
    return isAdmin(request)
      ? Response.json({ ok: true })
      : Response.json({ ok: false }, { status: 401 });
  }

  if (action === 'count') {
    if (!redisConfigured) return Response.json({ error: 'db_not_configured' }, { status: 503 });
    try {
      const body = await request.json();
      const id = body.id;
      const count = Number(body.count);
      const by = String(body.by || '').trim().slice(0, 40);
      const confirmed = body.confirmed !== false;
      if (!id) return Response.json({ error: 'id_required' }, { status: 400 });
      if (Number.isNaN(count) || count < 0) {
        return Response.json({ error: 'invalid_count' }, { status: 400 });
      }
      const catalogRaw = await redis.hget(GLOBAL_HASH_KEY, id);
      if (!catalogRaw) return Response.json({ error: 'not_found' }, { status: 404 });
      const product = parseProduct(catalogRaw);

      // Handle day rollover, then read/update only this product's counts entry.
      const countDate = await ensureCurrentDay(storeId);
      const countsKey = countsKeyFor(storeId);
      const existingRaw = await redis.hget(countsKey, id);
      const existing = existingRaw ? parseProduct(existingRaw) : null;
      const prev = existing ? Number(existing.count) || 0 : 0;
      const par = existing ? Number(existing.par) || 0 : 0;
      const entry = { count, countedToday: confirmed, lastBy: by, updatedAt: Date.now(), par };
      await redis.hset(countsKey, { [id]: JSON.stringify(entry) });
      if (confirmed) {
        const logs = await getLogs(storeId);
        logs.unshift({ id: genId(), productId: id, productName: product.name, prev, next: count, by, ts: Date.now(), date: countDate });
        await saveLogs(storeId, logs);
      }
      return Response.json({ ok: true });
    } catch (e) {
      return Response.json({ error: 'count_failed' }, { status: 500 });
    }
  }

  if (action === 'sync-images') {
    if (!isAdmin(request)) return Response.json({ error: 'unauthorized' }, { status: 401 });
    if (!redisConfigured) return Response.json({ error: 'db_not_configured' }, { status: 503 });
    try {
      const catalog = await ensureCatalog();
      const seedMap = new Map(SEED.filter((s) => s.image).map((s) => [s.name.toLowerCase().trim(), s.image]));
      const toUpdate = {};
      let updated = 0;
      for (const p of catalog) {
        const img = seedMap.get(p.name.toLowerCase().trim());
        if (img && p.image !== img) { p.image = img; toUpdate[p.id] = JSON.stringify(p); updated++; }
      }
      if (updated > 0) await redis.hset(GLOBAL_HASH_KEY, toUpdate);
      return Response.json({ ok: true, updated });
    } catch (e) {
      return Response.json({ error: 'sync_failed' }, { status: 500 });
    }
  }

  if (action === 'sync-fornecedores') {
    if (!isAdmin(request)) return Response.json({ error: 'unauthorized' }, { status: 401 });
    if (!redisConfigured) return Response.json({ error: 'db_not_configured' }, { status: 503 });
    try {
      const catalog = await ensureCatalog();
      const seedMap = new Map(SEED.filter((s) => s.fornecedor).map((s) => [s.name.toLowerCase().trim(), s.fornecedor]));
      const toUpdate = {};
      let updated = 0;
      for (const p of catalog) {
        const forn = seedMap.get(p.name.toLowerCase().trim());
        if (forn && !p.fornecedor) { p.fornecedor = forn; toUpdate[p.id] = JSON.stringify(p); updated++; }
      }
      if (updated > 0) await redis.hset(GLOBAL_HASH_KEY, toUpdate);
      return Response.json({ ok: true, updated });
    } catch (e) {
      return Response.json({ error: 'sync_failed' }, { status: 500 });
    }
  }

  if (action === 'reset') {
    if (!isAdmin(request)) return Response.json({ error: 'unauthorized' }, { status: 401 });
    if (!redisConfigured) return Response.json({ error: 'db_not_configured' }, { status: 503 });
    try {
      const countsKey = countsKeyFor(storeId);
      const hash = await redis.hgetall(countsKey);
      const now = Date.now();
      const fields = {};
      if (hash) {
        for (const [id, raw] of Object.entries(hash)) {
          const c = parseProduct(raw);
          if (c) {
            c.count = 0;
            c.countedToday = false;
            c.updatedAt = now;
            fields[id] = JSON.stringify(c);
          }
        }
      }
      if (Object.keys(fields).length > 0) await redis.hset(countsKey, fields);
      await redis.set(dateKeyFor(storeId), todayBRT());
      return Response.json({ ok: true });
    } catch (e) {
      return Response.json({ error: 'reset_failed' }, { status: 500 });
    }
  }

  if (action === 'products') {
    if (!isAdmin(request)) return Response.json({ error: 'unauthorized' }, { status: 401 });
    if (!redisConfigured) return Response.json({ error: 'db_not_configured' }, { status: 503 });
    try {
      const body = await request.json();
      const name = String(body.name || '').trim();
      if (!name) return Response.json({ error: 'name_required' }, { status: 400 });
      const freq = FREQS.includes(body.frequency) ? body.frequency : 'diaria';
      const product = {
        id: genId(),
        name,
        unit: String(body.unit || '').trim(),
        image: String(body.image || '').trim(),
        fornecedor: String(body.fornecedor || '').trim(),
        frequency: freq,
        feira: !!body.feira,
        parFeira: Math.max(0, Number(body.parFeira) || 0),
        updatedAt: Date.now(),
      };
      await saveCatalogProduct(product);
      return Response.json({ product: mergeProduct(product, null) });
    } catch (e) {
      return Response.json({ error: 'create_failed' }, { status: 500 });
    }
  }

  return Response.json({ error: 'not_found' }, { status: 404 });
}

// Handles both catalog edits (name/unit/image/fornecedor/frequency, global) and
// par edits (per store, via x-store-id) — the two admin tabs that write here
// only ever send the fields relevant to what they're editing.
export async function PUT(request, { params }) {
  if (params.action !== 'products') return Response.json({ error: 'not_found' }, { status: 404 });
  if (!isAdmin(request)) return Response.json({ error: 'unauthorized' }, { status: 401 });
  if (!redisConfigured) return Response.json({ error: 'db_not_configured' }, { status: 503 });
  try {
    const body = await request.json();
    if (!body.id) return Response.json({ error: 'id_required' }, { status: 400 });
    const raw = await redis.hget(GLOBAL_HASH_KEY, body.id);
    if (!raw) return Response.json({ error: 'not_found' }, { status: 404 });
    const p = parseProduct(raw);

    let catalogChanged = false;
    if (body.name !== undefined) { p.name = String(body.name).trim(); catalogChanged = true; }
    if (body.unit !== undefined) { p.unit = String(body.unit).trim(); catalogChanged = true; }
    if (body.image !== undefined) { p.image = String(body.image).trim(); catalogChanged = true; }
    if (body.fornecedor !== undefined) { p.fornecedor = String(body.fornecedor).trim(); catalogChanged = true; }
    if (body.frequency !== undefined && FREQS.includes(body.frequency)) { p.frequency = body.frequency; catalogChanged = true; }
    if (body.feira !== undefined) { p.feira = !!body.feira; catalogChanged = true; }
    if (body.parFeira !== undefined) { p.parFeira = Math.max(0, Number(body.parFeira) || 0); catalogChanged = true; }
    if (catalogChanged) {
      p.updatedAt = Date.now();
      await saveCatalogProduct(p);
    }

    let countEntry = null;
    if (body.par !== undefined) {
      const storeId = getStoreId(request);
      const countsKey = countsKeyFor(storeId);
      const existingRaw = await redis.hget(countsKey, body.id);
      countEntry = existingRaw ? parseProduct(existingRaw) : { count: 0, countedToday: false, lastBy: '', updatedAt: 0, par: 0 };
      countEntry.par = Math.max(0, Number(body.par) || 0);
      countEntry.updatedAt = Date.now();
      await redis.hset(countsKey, { [body.id]: JSON.stringify(countEntry) });
    }

    return Response.json({ product: mergeProduct(p, countEntry) });
  } catch (e) {
    return Response.json({ error: 'update_failed' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  if (params.action !== 'products') return Response.json({ error: 'not_found' }, { status: 404 });
  if (!isAdmin(request)) return Response.json({ error: 'unauthorized' }, { status: 401 });
  if (!redisConfigured) return Response.json({ error: 'db_not_configured' }, { status: 503 });
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return Response.json({ error: 'id_required' }, { status: 400 });
    await redis.hdel(GLOBAL_HASH_KEY, id);
    // Best-effort cleanup of this product's counts entry across every known store.
    try {
      const stores = await getStores();
      await Promise.all(stores.map((s) => Promise.all([
        redis.hdel(countsKeyFor(s.id), id),
        redis.hdel(feiraCountsKeyFor(s.id), id),
      ])));
    } catch (e) { /* cleanup is best-effort */ }
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: 'delete_failed' }, { status: 500 });
  }
}
