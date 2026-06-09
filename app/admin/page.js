'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

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

  // formulário de novo produto
  const [newName, setNewName] = useState('');
  const [newUnit, setNewUnit] = useState('');
  const [newPar, setNewPar] = useState('');
  const [copied, setCopied] = useState(false);

  // tenta reusar senha salva na sessão
  useEffect(() => {
    const saved = sessionStorage.getItem('cosechas_admin_pw');
    if (saved) {
      verify(saved).then((code) => {
        if (code === 'ok') {
          setPassword(saved);
          setAuthed(true);
          loadProducts(saved);
        } else {
          sessionStorage.removeItem('cosechas_admin_pw');
        }
        setChecking(false);
      });
    } else {
      setChecking(false);
    }
  }, []);

  // retorna: 'ok' | 'bad' | 'noenv' | 'neterr'
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
      loadProducts(pwInput);
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

  async function addProduct(e) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ name, unit: newUnit.trim(), par: Number(newPar) || 0 }),
    });
    if (res.ok) {
      const data = await res.json();
      setProducts((prev) => [...prev, data.product]);
      setNewName('');
      setNewUnit('');
      setNewPar('');
    }
  }

  function updateLocal(id, patch) {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
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

  async function removeProduct(id) {
    const p = products.find((x) => x.id === id);
    if (!confirm(`Remover "${p?.name}"? Essa ação não pode ser desfeita.`)) return;
    setProducts((prev) => prev.filter((x) => x.id !== id));
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

  function copyList() {
    const toBuy = products.filter((p) => buyQty(p) > 0);
    const text =
      'Lista de compras — Cosechas\n' +
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
          <div className="mark">🔒</div>
          <div className="titles">
            <span className="brand">Cosechas</span>
            <span className="sub">Área do administrador</span>
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
  const toBuyCount = products.filter((p) => buyQty(p) > 0).length;

  return (
    <>
      <header className="app-header">
        <div className="mark">🥥</div>
        <div className="titles">
          <span className="brand">Cosechas</span>
          <span className="sub">Painel do administrador</span>
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
                  {toBuyCount > 0 ? (
                    <span className="count-pill">{toBuyCount} item(ns)</span>
                  ) : null}
                  <button className="btn btn-citrus btn-sm" onClick={copyList} disabled={toBuyCount === 0}>
                    {copied ? '✓ Copiado' : 'Copiar lista'}
                  </button>
                </div>
              </div>
              {products.length === 0 ? (
                <div className="empty">Cadastre produtos abaixo para ver o que comprar.</div>
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
                    {products.map((p) => {
                      const q = buyQty(p);
                      return (
                        <tr key={p.id} className={q > 0 ? 'row-go' : ''}>
                          <td>
                            {p.name}
                            {p.unit ? <span style={{ color: 'var(--muted)' }}> · {p.unit}</span> : null}
                          </td>
                          <td className="num">{Number(p.count) || 0}</td>
                          <td className="num">{Number(p.par) || 0}</td>
                          <td className="num">
                            <span className={'buy-qty ' + (q > 0 ? 'go' : 'ok')}>{q > 0 ? q : '—'}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="section-title">Produtos e estoque regulador</div>

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
              <button className="btn btn-primary" type="submit">
                Adicionar
              </button>
            </form>

            {products.map((p) => (
              <div className="padmin" key={p.id}>
                <div className="info">
                  <div className="pname">{p.name}</div>
                  <div className="punit">
                    {p.unit ? p.unit + ' · ' : ''}contado: {Number(p.count) || 0}
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
                    onBlur={(e) => updatePar(p.id, e.target.value)}
                  />
                </div>
                <button className="btn btn-danger btn-sm" onClick={() => removeProduct(p.id)}>
                  Remover
                </button>
              </div>
            ))}

            <div className="foot-link">
              <Link href="/">← Ir para a tela de contagem</Link>
            </div>
          </>
        )}
      </main>
    </>
  );
}
