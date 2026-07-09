'use client';

import { Fragment, Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { DEFAULT_STORE } from '../../lib/stores';

function ImageField({ value, onChange, label = 'Foto' }) {
  const fileRef = useRef(null);

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 700;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else { w = Math.round(w * MAX / h); h = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        onChange(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  return (
    <div className="field field-image">
      <label>{label}</label>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          type="text"
          placeholder="https://… ou /img/arquivo.jpg"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ flex: 1 }}
        />
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          title="Fazer upload de imagem"
          onClick={() => fileRef.current?.click()}
          style={{ whiteSpace: 'nowrap' }}
        >
          📁 Arquivo
        </button>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
      </div>
      {value ? (
        <img
          src={value}
          alt=""
          style={{ marginTop: 8, maxHeight: 72, maxWidth: 120, borderRadius: 6, objectFit: 'cover', border: '1px solid var(--border)' }}
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      ) : null}
    </div>
  );
}

function buyQty(p) {
  return Math.max(0, (Number(p.par) || 0) - (Number(p.count) || 0));
}

function TabSync({ onTab }) {
  const searchParams = useSearchParams();
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'produtos' || tab === 'compras' || tab === 'lojas') onTab(tab);
    // eslint-disable-next-line
  }, [searchParams]);
  return null;
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState('');
  const [pwInput, setPwInput] = useState('');
  const [checking, setChecking] = useState(true);
  const [loginError, setLoginError] = useState('');
  const [view, setView] = useState('produtos'); // produtos | compras | lojas

  // catálogo global (aba Produtos)
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState(false);

  // contagens por loja (aba Compras)
  const [storeId, setStoreId] = useState(DEFAULT_STORE);
  const [stores, setStores] = useState([]);
  const [storeProducts, setStoreProducts] = useState([]);
  const [loadingStoreProducts, setLoadingStoreProducts] = useState(false);
  const [comprasSearch, setComprasSearch] = useState('');

  // lojas
  const [newStoreName, setNewStoreName] = useState('');
  const [storeFormOpen, setStoreFormOpen] = useState(false);
  const [creatingStore, setCreatingStore] = useState(false);
  const [editingStoreId, setEditingStoreId] = useState(null);
  const [editStoreName, setEditStoreName] = useState('');

  // novo produto
  const [newName, setNewName] = useState('');
  const [newImage, setNewImage] = useState('');
  const [newFornecedor, setNewFornecedor] = useState('');
  const [newFeira, setNewFeira] = useState(false);
  const [newParFeira, setNewParFeira] = useState(0);

  // edição de produto
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({ name: '', image: '', fornecedor: '', feira: false, parFeira: 0 });

  // histórico de contagens (por loja)
  const [logs, setLogs] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem('cosechas_admin_pw');
    if (saved) {
      verify(saved).then((code) => {
        if (code === 'ok') {
          setPassword(saved);
          setAuthed(true);
          loadProducts();
          loadStores();
        } else {
          sessionStorage.removeItem('cosechas_admin_pw');
        }
        setChecking(false);
      });
    } else {
      setChecking(false);
    }
  }, []);

  async function loadStores() {
    try {
      const res = await fetch('/api/stores', { cache: 'no-store' });
      const data = await res.json();
      setStores(data.stores || []);
    } catch (e) {
      /* noop */
    }
  }

  async function verify(pw) {
    try {
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': pw },
      });
      if (res.status === 503) return 'noenv';
      if (res.ok) return 'ok';
      return 'bad';
    } catch (e) {
      return 'neterr';
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setLoginError('');
    const code = await verify(pwInput);
    if (code === 'ok') {
      setPassword(pwInput);
      setAuthed(true);
      sessionStorage.setItem('cosechas_admin_pw', pwInput);
      loadProducts();
      loadStores();
    } else if (code === 'noenv') {
      setLoginError('A senha de admin não foi definida no servidor (variável ADMIN_PASSWORD).');
    } else if (code === 'neterr') {
      setLoginError('Erro de conexão. Tente novamente.');
    } else {
      setLoginError('Senha incorreta.');
    }
  }

  function logout() {
    sessionStorage.removeItem('cosechas_admin_pw');
    setAuthed(false);
    setPassword('');
    setPwInput('');
    setProducts([]);
    setStoreProducts([]);
  }

  function authHeaders() {
    return { 'Content-Type': 'application/json', 'x-admin-password': password };
  }

  function storeAuthHeaders() {
    return { 'Content-Type': 'application/json', 'x-admin-password': password, 'x-store-id': storeId };
  }

  // ---------- Catálogo global (Produtos) ----------

  async function loadProducts() {
    setLoading(true);
    try {
      const res = await fetch('/api/products', { cache: 'no-store' });
      const data = await res.json();
      setProducts(data.products || []);
    } catch (e) {
      /* noop */
    } finally {
      setLoading(false);
    }
  }

  function updateLocal(id, patch) {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  async function addProduct(e) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        name,
        image: newImage.trim(),
        fornecedor: newFornecedor.trim(),
        feira: newFeira,
        parFeira: newParFeira,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setProducts((prev) => [...prev, data.product]);
      setNewName('');
      setNewImage('');
      setNewFornecedor('');
      setNewFeira(false);
      setNewParFeira(0);
      loadStoreProducts();
    }
  }

  function startEdit(p) {
    setEditingId(p.id);
    setEditData({
      name: p.name || '',
      image: p.image || '',
      fornecedor: p.fornecedor || '',
      feira: !!p.feira,
      parFeira: Number(p.parFeira) || 0,
    });
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(id) {
    const name = editData.name.trim();
    if (!name) return;
    const image = editData.image.trim();
    const fornecedor = editData.fornecedor.trim();
    const feira = !!editData.feira;
    const parFeira = Math.max(0, parseInt(editData.parFeira, 10) || 0);
    updateLocal(id, { name, image, fornecedor, feira, parFeira });
    setEditingId(null);
    await fetch('/api/products', {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ id, name, image, fornecedor, feira, parFeira }),
    });
    loadStoreProducts();
  }

  async function removeProduct(id) {
    const p = products.find((x) => x.id === id);
    if (!confirm(`Excluir "${p?.name}" do catálogo global? Isso remove o produto de todas as lojas.`)) return;
    setProducts((prev) => prev.filter((x) => x.id !== id));
    if (editingId === id) setEditingId(null);
    await fetch(`/api/products?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    loadStoreProducts();
  }

  async function syncImages() {
    const res = await fetch('/api/sync-images', {
      method: 'POST',
      headers: authHeaders(),
    });
    const data = await res.json();
    if (res.ok) {
      alert(`Fotos sincronizadas: ${data.updated} produto(s) atualizado(s).`);
      loadProducts();
      loadStoreProducts();
    } else {
      alert('Erro ao sincronizar fotos.');
    }
  }

  async function syncFornecedores() {
    const res = await fetch('/api/sync-fornecedores', {
      method: 'POST',
      headers: authHeaders(),
    });
    const data = await res.json();
    if (res.ok) {
      alert(`Fornecedores sincronizados: ${data.updated} produto(s) atualizado(s).`);
      loadProducts();
      loadStoreProducts();
    } else {
      alert('Erro ao sincronizar fornecedores.');
    }
  }

  // ---------- Contagens por loja (Compras) ----------

  async function loadStoreProducts() {
    setLoadingStoreProducts(true);
    try {
      const res = await fetch('/api/products', {
        cache: 'no-store',
        headers: { 'x-store-id': storeId },
      });
      const data = await res.json();
      setStoreProducts(data.products || []);
    } catch (e) {
      /* noop */
    } finally {
      setLoadingStoreProducts(false);
    }
  }

  useEffect(() => {
    if (authed) loadStoreProducts();
    // eslint-disable-next-line
  }, [storeId, authed]);

  function updateStoreLocal(id, patch) {
    setStoreProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  async function updatePar(id, par) {
    let value = parseInt(par, 10);
    if (Number.isNaN(value) || value < 0) value = 0;
    updateStoreLocal(id, { par: value });
    await fetch('/api/products', {
      method: 'PUT',
      headers: storeAuthHeaders(),
      body: JSON.stringify({ id, par: value }),
    });
  }

  async function resetCounts() {
    if (!confirm('Zerar todas as contagens da loja? Use isto antes de uma nova contagem.')) return;
    const res = await fetch('/api/reset', {
      method: 'POST',
      headers: storeAuthHeaders(),
    });
    if (res.ok) setStoreProducts((prev) => prev.map((p) => ({ ...p, count: 0 })));
  }

  async function loadLogs() {
    setLoadingLogs(true);
    try {
      const res = await fetch('/api/logs', {
        headers: storeAuthHeaders(),
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (e) {
    } finally {
      setLoadingLogs(false);
    }
  }

  function toggleHistory() {
    const next = !historyOpen;
    setHistoryOpen(next);
    if (next) loadLogs();
  }

  function copyList() {
    const lines = ['Lista de compras — Siembras'];
    for (const [supplier, items] of sortedGroups) {
      lines.push('');
      lines.push(`** ${supplier} **`);
      for (const p of items) lines.push(`• ${p.name}: ${buyQty(p)}`);
    }
    navigator.clipboard?.writeText(lines.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }

  // ---------- Lojas ----------

  async function createStore(e) {
    e.preventDefault();
    const name = newStoreName.trim();
    if (!name) return;
    setCreatingStore(true);
    try {
      const res = await fetch('/api/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        setNewStoreName('');
        setStoreFormOpen(false);
        loadStores();
      } else {
        alert('Erro ao criar loja.');
      }
    } catch (e) {
      alert('Erro ao criar loja.');
    } finally {
      setCreatingStore(false);
    }
  }

  function startEditStore(s) {
    setEditingStoreId(s.id);
    setEditStoreName(s.name);
  }

  function cancelEditStore() {
    setEditingStoreId(null);
  }

  async function saveEditStore(id) {
    const name = editStoreName.trim();
    if (!name) return;
    try {
      const res = await fetch('/api/stores', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
        body: JSON.stringify({ id, name }),
      });
      if (res.ok) {
        setEditingStoreId(null);
        loadStores();
      } else {
        alert('Erro ao salvar loja.');
      }
    } catch (e) {
      alert('Erro ao salvar loja.');
    }
  }

  // ---------- LOGIN ----------
  if (!authed) {
    return (
      <>
        <header className="app-header">
          <div className="logo-lockup">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 248" height="38" aria-hidden="true" style={{display:'block',flexShrink:0}}>
              <circle cx="100" cy="158" r="58" fill="none" stroke="#6CAE2C" strokeWidth="29"/>
              <ellipse cx="100" cy="158" rx="19" ry="23" fill="#E8A23D"/>
              <path d="M100 139 C93 149 93 167 100 177" fill="none" stroke="#C9821F" strokeWidth="3" strokeLinecap="round"/>
              <path d="M100 160 L100 66" fill="none" stroke="#3F7A2A" strokeWidth="8" strokeLinecap="round"/>
              <path d="M100 74 C83 75 56 67 39 45 C35 41 37 34 43 34 C72 37 96 50 100 74 Z" fill="#5EA126"/>
              <path d="M98 72 C81 62 63 52 45 41" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"/>
              <path d="M100 74 C117 75 144 67 161 45 C165 41 163 34 157 34 C128 37 104 50 100 74 Z" fill="#84C63C"/>
              <path d="M102 72 C119 62 137 52 155 41" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"/>
            </svg>
            <span className="logo-wordmark">s<span className="logo-i">i</span>embras</span>
          </div>
          <div className="spacer" />
          <Link className="header-link" href="/">
            Voltar
          </Link>
        </header>
        <main className="wrap">
          {checking ? (
            <div className="spinner">Verificando…</div>
          ) : (
            <form className="card login-box" onSubmit={handleLogin}>
              <h2 style={{ marginBottom: 14 }}>Entrar como admin</h2>
              <div className="field">
                <label htmlFor="pw">Senha</label>
                <input
                  id="pw"
                  type="password"
                  value={pwInput}
                  onChange={(e) => setPwInput(e.target.value)}
                  autoFocus
                />
              </div>
              {loginError ? <div className="error-text">{loginError}</div> : null}
              <button className="btn btn-primary" type="submit" style={{ width: '100%', marginTop: 6 }}>
                Entrar
              </button>
            </form>
          )}
        </main>
      </>
    );
  }

  // ---------- PAINEL ----------
  const toBuy = storeProducts.filter((p) => buyQty(p) > 0);

  const groupedToBuy = toBuy.reduce((acc, p) => {
    const key = p.fornecedor || 'Sem fornecedor';
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});
  const sortedGroups = Object.entries(groupedToBuy).sort(([a], [b]) => {
    if (a === 'Sem fornecedor') return 1;
    if (b === 'Sem fornecedor') return -1;
    return a.localeCompare(b, 'pt');
  });
  for (const [, items] of sortedGroups) items.sort((a, b) => a.name.localeCompare(b.name, 'pt'));

  const visible = products
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'pt'))
    .filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()));

  const visibleStoreProducts = storeProducts
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'pt'))
    .filter((p) => p.name.toLowerCase().includes(comprasSearch.trim().toLowerCase()));

  return (
    <>
      <Suspense fallback={null}>
        <TabSync onTab={setView} />
      </Suspense>
      <header className="app-header">
        <div className="logo-lockup">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 248" height="38" aria-hidden="true" style={{display:'block',flexShrink:0}}>
            <circle cx="100" cy="158" r="58" fill="none" stroke="#6CAE2C" strokeWidth="29"/>
            <ellipse cx="100" cy="158" rx="19" ry="23" fill="#E8A23D"/>
            <path d="M100 139 C93 149 93 167 100 177" fill="none" stroke="#C9821F" strokeWidth="3" strokeLinecap="round"/>
            <path d="M100 160 L100 66" fill="none" stroke="#3F7A2A" strokeWidth="8" strokeLinecap="round"/>
            <path d="M100 74 C83 75 56 67 39 45 C35 41 37 34 43 34 C72 37 96 50 100 74 Z" fill="#5EA126"/>
            <path d="M98 72 C81 62 63 52 45 41" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"/>
            <path d="M100 74 C117 75 144 67 161 45 C165 41 163 34 157 34 C128 37 104 50 100 74 Z" fill="#84C63C"/>
            <path d="M102 72 C119 62 137 52 155 41" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"/>
          </svg>
          <span className="logo-wordmark">s<span className="logo-i">i</span>embras</span>
        </div>
        <div className="spacer" />
        <button className="header-link" onClick={logout}>
          Sair
        </button>
      </header>

      <main className="wrap">
        <nav className="admin-tabs">
          <button
            type="button"
            className={`admin-tab${view === 'produtos' ? ' active' : ''}`}
            onClick={() => setView('produtos')}
          >
            Produtos
          </button>
          <button
            type="button"
            className={`admin-tab${view === 'compras' ? ' active' : ''}`}
            onClick={() => setView('compras')}
          >
            Compras
          </button>
          <Link className="admin-tab" href="/admin/analise">Análise</Link>
          <button
            type="button"
            className={`admin-tab${view === 'lojas' ? ' active' : ''}`}
            onClick={() => setView('lojas')}
          >
            Lojas
          </button>
        </nav>

        {view === 'lojas' ? (
          <>
            <div className="section-title">Lojas cadastradas</div>
            <div className="toolbar">
              <button className="btn btn-primary btn-sm" onClick={() => setStoreFormOpen((v) => !v)}>
                {storeFormOpen ? 'Cancelar' : '+ Nova Loja'}
              </button>
            </div>

            {storeFormOpen ? (
              <form className="add-form" onSubmit={createStore}>
                <div className="field field-name">
                  <label>Nome da loja</label>
                  <input
                    type="text"
                    placeholder="Ex.: Copacabana"
                    value={newStoreName}
                    onChange={(e) => setNewStoreName(e.target.value)}
                  />
                </div>
                <button className="btn btn-primary" type="submit" disabled={creatingStore}>
                  {creatingStore ? 'Criando…' : 'Criar'}
                </button>
              </form>
            ) : null}

            {stores.map((s) =>
              editingStoreId === s.id ? (
                <div className="padmin editing" key={s.id}>
                  <div className="edit-grid">
                    <div className="field field-full">
                      <label>Nome</label>
                      <input
                        type="text"
                        value={editStoreName}
                        onChange={(e) => setEditStoreName(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="edit-actions">
                    <button className="btn btn-primary btn-sm" onClick={() => saveEditStore(s.id)}>
                      Salvar
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={cancelEditStore}>
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="padmin" key={s.id}>
                  <div className="info">
                    <div className="pname">{s.name}</div>
                    <div className="punit">ID: {s.id}</div>
                  </div>
                  <div className="row-actions">
                    <button className="btn btn-edit btn-sm" onClick={() => startEditStore(s)}>
                      Editar
                    </button>
                  </div>
                </div>
              )
            )}

            {stores.length === 0 ? <div className="empty">Nenhuma loja cadastrada.</div> : null}
          </>
        ) : view === 'compras' ? (
          <>
            <div className="pills">
              {stores.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`pill${s.id === storeId ? ' active' : ''}`}
                  onClick={() => setStoreId(s.id)}
                >
                  {s.name}
                </button>
              ))}
            </div>

            {loadingStoreProducts ? (
              <div className="spinner">Carregando…</div>
            ) : (
              <>
                <div className="section-title">O que comprar</div>
                <div className="report">
                  <div className="report-head">
                    <h2>Lista de reposição</h2>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {toBuy.length > 0 ? <span className="count-pill">{toBuy.length} item(ns)</span> : null}
                      <button className="btn btn-citrus btn-sm" onClick={copyList} disabled={toBuy.length === 0}>
                        {copied ? '✓ Copiado' : 'Copiar lista'}
                      </button>
                    </div>
                  </div>
                  {toBuy.length === 0 ? (
                    <div className="empty">Tudo abastecido 🎉 (nada a comprar no momento)</div>
                  ) : (
                    <table>
                      <thead>
                        <tr>
                          <th>Produto</th>
                          <th className="num">Contado</th>
                          <th className="num">Regulador</th>
                          <th className="num">Comprar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedGroups.map(([supplier, items]) => (
                          <Fragment key={supplier}>
                            <tr className="supplier-row">
                              <td colSpan={4} className="supplier-cell">{supplier}</td>
                            </tr>
                            {items.map((p) => (
                              <tr key={p.id} className="row-go">
                                <td>{p.name}</td>
                                <td className="num">{Number(p.count) || 0}</td>
                                <td className="num">{Number(p.par) || 0}</td>
                                <td className="num">
                                  <span className="buy-qty go">{buyQty(p)}</span>
                                </td>
                              </tr>
                            ))}
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="section-title">Reguladores e contagens</div>

                <div className="toolbar">
                  <button className="btn btn-ghost btn-sm" onClick={loadStoreProducts}>
                    ↻ Atualizar contagens
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={resetCounts}>
                    Zerar contagens da loja
                  </button>
                </div>

                <input
                  className="search"
                  type="search"
                  placeholder={`🔍 Buscar entre ${storeProducts.length} produtos…`}
                  value={comprasSearch}
                  onChange={(e) => setComprasSearch(e.target.value)}
                />

                {visibleStoreProducts.map((p) => (
                  <div className="padmin" key={p.id}>
                    {p.image ? <img className="thumb thumb-sm" src={p.image} alt="" /> : null}
                    <div className="info">
                      <div className="pname">{p.name}</div>
                      <div className="punit">
                        {p.fornecedor ? <span style={{ color: 'var(--muted)' }}>{p.fornecedor} · </span> : null}
                        contado: {Number(p.count) || 0}
                        {p.lastBy ? ' · por ' + p.lastBy : ''}
                      </div>
                    </div>
                    <div className="par-edit">
                      <label htmlFor={`par-${p.id}`}>Regulador</label>
                      <input
                        id={`par-${p.id}`}
                        className="par-input"
                        type="number"
                        min="0"
                        defaultValue={Number(p.par) || 0}
                        key={`par-${p.id}-${p.par}`}
                        onBlur={(e) => updatePar(p.id, e.target.value)}
                      />
                    </div>
                  </div>
                ))}

                {visibleStoreProducts.length === 0 ? (
                  <div className="empty">Nenhum produto encontrado para "{comprasSearch}".</div>
                ) : null}

                <div className="section-title">Histórico de contagens</div>
                <button className="btn btn-ghost btn-sm" onClick={toggleHistory}>
                  {historyOpen ? 'Ocultar histórico' : 'Ver histórico'}
                </button>
                {historyOpen ? (
                  <div className="report" style={{ marginTop: 12 }}>
                    {loadingLogs ? (
                      <div className="empty">Carregando…</div>
                    ) : logs.length === 0 ? (
                      <div className="empty">Nenhuma contagem registrada ainda.</div>
                    ) : (
                      <table>
                        <thead>
                          <tr>
                            <th>Data/Hora</th>
                            <th>Produto</th>
                            <th>Quem</th>
                            <th className="num">Valor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {logs.map((l) => (
                            <tr key={l.id}>
                              <td>{new Date(l.ts).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</td>
                              <td>{l.productName}</td>
                              <td>{l.by || '—'}</td>
                              <td className="num">{l.next}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                ) : null}

                <div className="foot-link">
                  <Link href="/">← Ir para a tela de contagem</Link>
                </div>
              </>
            )}
          </>
        ) : (
          <>
            {loading ? (
              <div className="spinner">Carregando…</div>
            ) : (
              <>
                <div className="toolbar">
                  <button className="btn btn-ghost btn-sm" onClick={loadProducts}>
                    ↻ Atualizar
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={syncImages}>
                    Sincronizar fotos
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={syncFornecedores}>
                    Sincronizar fornecedores
                  </button>
                </div>

                <form className="add-form" onSubmit={addProduct}>
                  <div className="field field-name">
                    <label>Novo produto</label>
                    <input
                      type="text"
                      placeholder="Ex.: Polpa de morango"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label>Fornecedor</label>
                    <input
                      type="text"
                      placeholder="Ex.: Nechio"
                      value={newFornecedor}
                      onChange={(e) => setNewFornecedor(e.target.value)}
                    />
                  </div>
                  <ImageField label="Foto (opcional)" value={newImage} onChange={setNewImage} />
                  <label className="field field-feira-toggle" style={{ gridColumn: '1 / -1' }}>
                    <input
                      type="checkbox"
                      checked={newFeira}
                      onChange={(e) => setNewFeira(e.target.checked)}
                    />
                    <span>🏪 Faz parte do reabastecimento</span>
                  </label>
                  {newFeira ? (
                    <div className="field" style={{ gridColumn: '1 / -1' }}>
                      <label>Par de bancada</label>
                      <input
                        type="number"
                        min="0"
                        value={newParFeira}
                        onChange={(e) => setNewParFeira(e.target.value)}
                      />
                    </div>
                  ) : null}
                  <button className="btn btn-primary" type="submit">
                    Adicionar
                  </button>
                </form>

                <input
                  className="search"
                  type="search"
                  placeholder={`🔍 Buscar entre ${products.length} produtos…`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />

                {visible.map((p) =>
                  editingId === p.id ? (
                    <div className="padmin editing" key={p.id}>
                      <div className="edit-grid">
                        <div className="field field-full">
                          <label>Descrição</label>
                          <input
                            type="text"
                            value={editData.name}
                            onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                          />
                        </div>
                        <div className="field">
                          <label>Fornecedor</label>
                          <input
                            type="text"
                            value={editData.fornecedor}
                            onChange={(e) => setEditData({ ...editData, fornecedor: e.target.value })}
                          />
                        </div>
                        <div className="field-full">
                          <ImageField
                            label="Foto"
                            value={editData.image}
                            onChange={(v) => setEditData({ ...editData, image: v })}
                          />
                        </div>
                        <label className="field field-feira-toggle field-full">
                          <input
                            type="checkbox"
                            checked={editData.feira}
                            onChange={(e) => setEditData({ ...editData, feira: e.target.checked })}
                          />
                          <span>🏪 Faz parte do reabastecimento</span>
                        </label>
                        {editData.feira ? (
                          <div className="field field-full">
                            <label>Par de bancada</label>
                            <input
                              type="number"
                              min="0"
                              value={editData.parFeira}
                              onChange={(e) => setEditData({ ...editData, parFeira: e.target.value })}
                            />
                          </div>
                        ) : null}
                      </div>
                      <div className="edit-actions">
                        <button className="btn btn-primary btn-sm" onClick={() => saveEdit(p.id)}>
                          Salvar
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={cancelEdit}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="padmin" key={p.id}>
                      {p.image ? <img className="thumb thumb-sm" src={p.image} alt="" /> : null}
                      <div className="info">
                        <div className="pname">
                          {p.name}
                          {p.feira ? <span className="feira-tag" title="Faz parte do reabastecimento"> 🏪</span> : null}
                        </div>
                        <div className="punit">
                          {p.fornecedor || 'Sem fornecedor'}
                          {p.feira ? ` · par bancada: ${Number(p.parFeira) || 0}` : ''}
                        </div>
                      </div>
                      <div className="row-actions">
                        <button className="btn btn-edit btn-sm" onClick={() => startEdit(p)}>
                          Editar
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => removeProduct(p.id)}>
                          Excluir
                        </button>
                      </div>
                    </div>
                  )
                )}

                {visible.length === 0 ? (
                  <div className="empty">Nenhum produto encontrado para "{search}".</div>
                ) : null}
              </>
            )}
          </>
        )}
      </main>
    </>
  );
}
