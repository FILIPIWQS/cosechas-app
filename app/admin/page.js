'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const FREQS = ['diaria', 'semanal', 'quinzenal', 'mensal'];
const FREQ_LABEL = { diaria: 'Diária', semanal: 'Semanal', quinzenal: 'Quinzenal', mensal: 'Mensal' };
function freqOf(p) {
  return FREQS.includes(p.frequency) ? p.frequency : 'diaria';
}

function buyQty(p) {
  return Math.max(0, (Number(p.par) || 0) - (Number(p.count) || 0));
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState('');
  const [pwInput, setPwInput] = useState('');
  const [checking, setChecking] = useState(true);
  const [loginError, setLoginError] = useState('');

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState(false);

  // novo produto
  const [newName, setNewName] = useState('');
  const [newUnit, setNewUnit] = useState('');
  const [newPar, setNewPar] = useState('');
  const [newImage, setNewImage] = useState('');
  const [newFreq, setNewFreq] = useState('diaria');

  // edição de produto
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({ name: '', unit: '', image: '', par: '', frequency: 'diaria' });

  // histórico de contagens
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
        } else {
          sessionStorage.removeItem('cosechas_admin_pw');
        }
        setChecking(false);
      });
    } else {
      setChecking(false);
    }
  }, []);

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
  }

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

  function authHeaders() {
    return { 'Content-Type': 'application/json', 'x-admin-password': password };
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
        unit: newUnit.trim(),
        par: Number(newPar) || 0,
        image: newImage.trim(),
        frequency: newFreq,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setProducts((prev) => [...prev, data.product]);
      setNewName('');
      setNewUnit('');
      setNewPar('');
      setNewImage('');
      setNewFreq('diaria');
    }
  }

  async function updatePar(id, par) {
    let value = parseInt(par, 10);
    if (Number.isNaN(value) || value < 0) value = 0;
    updateLocal(id, { par: value });
    await fetch('/api/products', {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ id, par: value }),
    });
  }

  function startEdit(p) {
    setEditingId(p.id);
    setEditData({
      name: p.name || '',
      unit: p.unit || '',
      image: p.image || '',
      par: String(Number(p.par) || 0),
      frequency: p.frequency || 'diaria',
    });
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(id) {
    const name = editData.name.trim();
    if (!name) return;
    const par = Math.max(0, Number(editData.par) || 0);
    const unit = editData.unit.trim();
    const image = editData.image.trim();
    const frequency = editData.frequency || 'diaria';
    updateLocal(id, { name, unit, image, par, frequency });
    setEditingId(null);
    await fetch('/api/products', {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ id, name, unit, image, par, frequency }),
    });
  }

  async function removeProduct(id) {
    const p = products.find((x) => x.id === id);
    if (!confirm(`Excluir "${p?.name}"? Essa ação não pode ser desfeita.`)) return;
    setProducts((prev) => prev.filter((x) => x.id !== id));
    if (editingId === id) setEditingId(null);
    await fetch(`/api/products?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'x-admin-password': password },
    });
  }

  async function resetCounts() {
    if (!confirm('Zerar todas as contagens da loja? Use isto antes de uma nova contagem.')) return;
    const res = await fetch('/api/reset', {
      method: 'POST',
      headers: { 'x-admin-password': password },
    });
    if (res.ok) setProducts((prev) => prev.map((p) => ({ ...p, count: 0 })));
  }

  async function loadLogs() {
    setLoadingLogs(true);
    try {
      const res = await fetch('/api/logs', { headers: { 'x-admin-password': password }, cache: 'no-store' });
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
    const toBuy = products.filter((p) => buyQty(p) > 0);
    const text =
      'Lista de compras — Siembras\n' +
      toBuy.map((p) => `• ${p.name}: ${buyQty(p)}${p.unit ? ' ' + p.unit : ''}`).join('\n');
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
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
  const toBuy = products
    .filter((p) => buyQty(p) > 0)
    .sort((a, b) => buyQty(b) - buyQty(a) || a.name.localeCompare(b.name, 'pt'));

  const visible = products
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'pt'))
    .filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()));

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
        <button className="header-link" onClick={logout}>
          Sair
        </button>
      </header>

      <main className="wrap">
        {loading ? (
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
                    {toBuy.map((p) => (
                      <tr key={p.id} className="row-go">
                        <td>
                          {p.name}
                          {p.unit ? <span style={{ color: 'var(--muted)' }}> · {p.unit}</span> : null}
                        </td>
                        <td className="num">{Number(p.count) || 0}</td>
                        <td className="num">{Number(p.par) || 0}</td>
                        <td className="num">
                          <span className="buy-qty go">{buyQty(p)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="section-title">Gerenciar produtos</div>

            <div className="toolbar">
              <button className="btn btn-ghost btn-sm" onClick={loadProducts}>
                ↻ Atualizar contagens
              </button>
              <button className="btn btn-ghost btn-sm" onClick={resetCounts}>
                Zerar contagens da loja
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
                <label>Unidade</label>
                <input
                  type="text"
                  placeholder="kg, un, cx…"
                  value={newUnit}
                  onChange={(e) => setNewUnit(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Regulador</label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={newPar}
                  onChange={(e) => setNewPar(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Frequência</label>
                <select className="freq-select" value={newFreq} onChange={(e) => setNewFreq(e.target.value)}>
                  {FREQS.map((f) => (
                    <option key={f} value={f}>{FREQ_LABEL[f]}</option>
                  ))}
                </select>
              </div>
              <div className="field field-image">
                <label>URL da foto (opcional)</label>
                <input
                  type="text"
                  placeholder="https://… ou /img/arquivo.jpg"
                  value={newImage}
                  onChange={(e) => setNewImage(e.target.value)}
                />
              </div>
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
                      <label>Unidade</label>
                      <input
                        type="text"
                        value={editData.unit}
                        onChange={(e) => setEditData({ ...editData, unit: e.target.value })}
                      />
                    </div>
                    <div className="field">
                      <label>Regulador</label>
                      <input
                        type="number"
                        min="0"
                        value={editData.par}
                        onChange={(e) => setEditData({ ...editData, par: e.target.value })}
                      />
                    </div>
                    <div className="field">
                      <label>Frequência</label>
                      <select className="freq-select" value={editData.frequency} onChange={(e) => setEditData({ ...editData, frequency: e.target.value })}>
                        {FREQS.map((f) => (
                          <option key={f} value={f}>{FREQ_LABEL[f]}</option>
                        ))}
                      </select>
                    </div>
                    <div className="field field-full">
                      <label>URL da foto</label>
                      <input
                        type="text"
                        placeholder="https://… ou /img/arquivo.jpg"
                        value={editData.image}
                        onChange={(e) => setEditData({ ...editData, image: e.target.value })}
                      />
                    </div>
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
                    <div className="pname">{p.name}</div>
                    <div className="punit">
                      <span className={'freq-tag freq-' + freqOf(p)}>{FREQ_LABEL[freqOf(p)]}</span>
                      {p.unit ? ' · ' + p.unit : ''} · contado: {Number(p.count) || 0}
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
      </main>
    </>
  );
}
