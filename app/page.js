'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

export default function StorePage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState('ok'); // ok | db | error
  const [savedId, setSavedId] = useState(null);
  const timers = useRef({});

  useEffect(() => {
    load();
    const t = timers.current;
    return () => Object.values(t).forEach((id) => clearTimeout(id));
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/products', { cache: 'no-store' });
      if (res.status === 503) {
        setState('db');
        setLoading(false);
        return;
      }
      const data = await res.json();
      setProducts(data.products || []);
      setState('ok');
    } catch (e) {
      setState('error');
    } finally {
      setLoading(false);
    }
  }

  function updateLocal(id, count) {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, count } : p)));
  }

  function queueSave(id, count) {
    clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(() => saveCount(id, count), 450);
  }

  async function saveCount(id, count) {
    try {
      await fetch('/api/count', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, count }),
      });
      setSavedId(id);
      setTimeout(() => setSavedId((s) => (s === id ? null : s)), 1400);
    } catch (e) {
      /* mantém valor local; tentará de novo na próxima edição */
    }
  }

  function onInput(id, value) {
    let count = parseInt(value, 10);
    if (Number.isNaN(count) || count < 0) count = 0;
    updateLocal(id, count);
    queueSave(id, count);
  }

  function step(id, delta) {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    let count = (Number(p.count) || 0) + delta;
    if (count < 0) count = 0;
    updateLocal(id, count);
    queueSave(id, count);
  }

  return (
    <>
      <header className="app-header">
        <div className="mark">🥥</div>
        <div className="titles">
          <span className="brand">Cosechas</span>
          <span className="sub">Contagem de estoque</span>
        </div>
        <div className="spacer" />
        <Link className="header-link" href="/admin">
          Admin
        </Link>
      </header>

      <main className="wrap">
        {loading ? (
          <div className="spinner">Carregando produtos…</div>
        ) : state === 'db' ? (
          <div className="notice notice-warn">
            O banco de dados ainda não foi conectado. No painel do Vercel, vá em{' '}
            <strong>Storage → Create Database → Upstash (Redis)</strong> e conecte ao projeto.
            Depois faça um novo deploy. (Detalhes no arquivo <code>LEIA-ME.md</code>.)
          </div>
        ) : state === 'error' ? (
          <div className="notice notice-warn">
            Não foi possível carregar os produtos.{' '}
            <button className="btn btn-ghost btn-sm" onClick={load}>
              Tentar de novo
            </button>
          </div>
        ) : products.length === 0 ? (
          <div className="card empty">
            <h2>Nenhum produto ainda</h2>
            <p>Peça ao responsável para cadastrar os produtos na área Admin.</p>
          </div>
        ) : (
          <>
            <p className="intro">
              Conte cada produto e digite a quantidade. Tudo é salvo automaticamente.
            </p>
            {products.map((p) => (
              <div className="product" key={p.id}>
                <div className="info">
                  <div className="pname">{p.name}</div>
                  {p.unit ? <div className="punit">Unidade: {p.unit}</div> : null}
                  <span className={'saved' + (savedId === p.id ? ' show' : '')}>✓ salvo</span>
                </div>
                <div className="stepper">
                  <button
                    className="step-btn"
                    aria-label={`Diminuir ${p.name}`}
                    onClick={() => step(p.id, -1)}
                  >
                    −
                  </button>
                  <input
                    className="count-input"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    value={Number(p.count) || 0}
                    onChange={(e) => onInput(p.id, e.target.value)}
                    onFocus={(e) => e.target.select()}
                  />
                  <button
                    className="step-btn"
                    aria-label={`Aumentar ${p.name}`}
                    onClick={() => step(p.id, 1)}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        <div className="foot-link">
          <Link href="/admin">Área do administrador →</Link>
        </div>
      </main>
    </>
  );
}
