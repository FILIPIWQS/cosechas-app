'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { STORES, DEFAULT_STORE } from '../../../lib/stores';

const PERIODS = [
  { key: 'latest', label: 'Atual vs Última Contagem', mode: 'latest' },
  { key: '7d', label: 'Últimos 7 dias', mode: 'range', days: 7 },
  { key: '15d', label: 'Últimos 15 dias', mode: 'range', days: 15 },
];

function todayBRT() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function addDays(dateStr, delta) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

function lastNDates(n) {
  const today = todayBRT();
  const arr = [];
  for (let i = n - 1; i >= 0; i--) arr.push(addDays(today, -i));
  return arr;
}

function formatLabel(dateStr) {
  const [, m, d] = dateStr.split('-');
  return `${d}/${m}`;
}

function computeVariation(prev, last) {
  if (prev === 0) return { pct: last === 0 ? 0 : 100, direction: last > 0 ? 'up' : 'flat' };
  const pct = ((last - prev) / prev) * 100;
  const direction = last > prev ? 'up' : last < prev ? 'down' : 'flat';
  return { pct, direction };
}

function buildLookups(products) {
  const byId = new Map(products.map((p) => [p.id, p]));
  const byName = new Map(products.map((p) => [p.name, p]));
  return { byId, byName };
}

// Resolves a log entry to its current product record. Newer logs carry
// productId, which survives renames; older logs fall back to matching by the
// name recorded at the time. Returns null when the product was excluded.
function resolveProduct(log, byId, byName) {
  if (log.productId && byId.has(log.productId)) return byId.get(log.productId);
  if (byName.has(log.productName)) return byName.get(log.productName);
  return null;
}

// One row per product, comparing the 2 most recent confirmed counts overall —
// regardless of calendar gap (a weekly product may not have a count "yesterday").
function buildLatestRows(logs, byId, byName) {
  const grouped = new Map(); // product.id -> { product, entries }
  for (const log of logs) {
    const product = resolveProduct(log, byId, byName);
    if (!product) continue;
    if (!grouped.has(product.id)) grouped.set(product.id, { product, entries: [] });
    grouped.get(product.id).entries.push(log);
  }

  const rows = [];
  for (const { product, entries } of grouped.values()) {
    entries.sort((a, b) => b.ts - a.ts);
    const last = entries[0];
    const prev = entries[1] || null;
    const lastValue = Number(last.next) || 0;
    const prevValue = prev ? Number(prev.next) || 0 : null;

    let variationPct = null;
    let direction = 'flat';
    let suspicious = false;
    if (prevValue !== null) {
      const v = computeVariation(prevValue, lastValue);
      variationPct = v.pct;
      direction = v.direction;
      const avg = (prevValue + lastValue) / 2;
      suspicious = avg > 0 && lastValue <= avg * 0.3;
    }

    rows.push({
      name: product.name,
      fornecedor: product.fornecedor || '',
      prevValue,
      prevDate: prev ? prev.date : null,
      lastValue,
      lastDate: last.date,
      variationPct,
      direction,
      suspicious,
    });
  }

  rows.sort((a, b) => Math.abs(b.variationPct ?? -1) - Math.abs(a.variationPct ?? -1));
  return rows;
}

// One row per product with a log inside `dates`, one column per calendar day
// (or "-" if not counted that day) and the variation between the last two
// counted days within the period.
function buildRangeRows(logs, byId, byName, dates) {
  const dateSet = new Set(dates);
  const latestByKey = new Map();
  const products = new Map(); // product.id -> product

  for (const log of logs) {
    if (!dateSet.has(log.date)) continue;
    const product = resolveProduct(log, byId, byName);
    if (!product) continue;
    products.set(product.id, product);
    const key = `${product.id}||${log.date}`;
    const existing = latestByKey.get(key);
    if (!existing || log.ts > existing.ts) latestByKey.set(key, { ts: log.ts, value: Number(log.next) || 0 });
  }

  const rows = [];
  for (const product of products.values()) {
    const values = dates.map((date) => {
      const hit = latestByKey.get(`${product.id}||${date}`);
      return hit ? hit.value : null;
    });
    const counted = values.filter((v) => v !== null);

    let variationPct = null;
    let direction = 'flat';
    if (counted.length >= 2) {
      const v = computeVariation(counted[counted.length - 2], counted[counted.length - 1]);
      variationPct = v.pct;
      direction = v.direction;
    }

    const avg = counted.length ? counted.reduce((a, b) => a + b, 0) / counted.length : null;
    const lastValue = counted.length ? counted[counted.length - 1] : null;
    const suspicious = avg !== null && avg > 0 && lastValue !== null && lastValue <= avg * 0.3;

    rows.push({ name: product.name, fornecedor: product.fornecedor || '', values, variationPct, direction, suspicious });
  }

  rows.sort((a, b) => Math.abs(b.variationPct ?? -1) - Math.abs(a.variationPct ?? -1));
  return rows;
}

function VariationTag({ variationPct, direction }) {
  if (variationPct === null) return <span className="variation flat">-</span>;
  return (
    <span className={`variation ${direction}`}>
      {direction === 'up' ? '▲' : direction === 'down' ? '▼' : '→'} {Math.abs(Math.round(variationPct))}%
    </span>
  );
}

function Header({ onLogout }) {
  return (
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
      {onLogout ? (
        <button className="header-link" onClick={onLogout}>Sair</button>
      ) : (
        <Link className="header-link" href="/">Voltar</Link>
      )}
    </header>
  );
}

function formatDateShort(dateStr) {
  if (!dateStr) return '—';
  const [, m, d] = dateStr.split('-');
  return `${d}/${m}`;
}

export default function AnalisePage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState('');
  const [pwInput, setPwInput] = useState('');
  const [checking, setChecking] = useState(true);
  const [loginError, setLoginError] = useState('');

  const [logs, setLogs] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [periodKey, setPeriodKey] = useState('latest');
  const [search, setSearch] = useState('');
  const [storeId, setStoreId] = useState(DEFAULT_STORE);

  useEffect(() => {
    const saved = sessionStorage.getItem('cosechas_admin_pw');
    if (saved) {
      verify(saved).then((code) => {
        if (code === 'ok') {
          setPassword(saved);
          setAuthed(true);
          loadData(saved);
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
      loadData(pwInput);
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
    setLogs([]);
    setProducts([]);
  }

  useEffect(() => {
    if (authed) loadData(password);
    // eslint-disable-next-line
  }, [storeId]);

  async function loadData(pw) {
    setLoading(true);
    setLoadError('');
    try {
      const [logsRes, productsRes] = await Promise.all([
        fetch('/api/logs', { headers: { 'x-admin-password': pw, 'x-store-id': storeId }, cache: 'no-store' }),
        fetch('/api/products', { headers: { 'x-admin-password': pw, 'x-store-id': storeId }, cache: 'no-store' }),
      ]);
      if (!logsRes.ok) {
        setLoadError(logsRes.status === 503 ? 'Banco de dados não configurado.' : 'Erro ao carregar histórico.');
        return;
      }
      const logsData = await logsRes.json();
      const productsData = productsRes.ok ? await productsRes.json() : { products: [] };
      setLogs(logsData.logs || []);
      setProducts(productsData.products || []);
    } catch (e) {
      setLoadError('Erro de conexão.');
    } finally {
      setLoading(false);
    }
  }

  const { byId, byName } = useMemo(() => buildLookups(products), [products]);
  const period = PERIODS.find((p) => p.key === periodKey) || PERIODS[0];
  const dates = useMemo(() => (period.mode === 'range' ? lastNDates(period.days) : []), [period.mode, period.days]);

  const latestRows = useMemo(
    () => (period.mode === 'latest' ? buildLatestRows(logs, byId, byName) : []),
    [period.mode, logs, byId, byName]
  );
  const rangeRows = useMemo(
    () => (period.mode === 'range' ? buildRangeRows(logs, byId, byName, dates) : []),
    [period.mode, logs, byId, byName, dates]
  );

  const searchLower = search.trim().toLowerCase();
  const visibleLatestRows = latestRows.filter((r) => r.name.toLowerCase().includes(searchLower));
  const visibleRangeRows = rangeRows.filter((r) => r.name.toLowerCase().includes(searchLower));
  const isEmpty = period.mode === 'latest' ? visibleLatestRows.length === 0 : visibleRangeRows.length === 0;

  if (checking) {
    return (
      <>
        <Header />
        <main className="wrap">
          <div className="spinner">Verificando…</div>
        </main>
      </>
    );
  }

  if (!authed) {
    return (
      <>
        <Header />
        <main className="wrap">
          <form className="card login-box" onSubmit={handleLogin}>
            <h2 style={{ marginBottom: 14 }}>Entrar como admin</h2>
            <div className="field">
              <label htmlFor="pw">Senha</label>
              <input id="pw" type="password" value={pwInput} onChange={(e) => setPwInput(e.target.value)} autoFocus />
            </div>
            {loginError ? <div className="error-text">{loginError}</div> : null}
            <button className="btn btn-primary" type="submit" style={{ width: '100%', marginTop: 6 }}>
              Entrar
            </button>
          </form>
        </main>
      </>
    );
  }

  return (
    <>
      <Header onLogout={logout} />
      <main className="wrap">
        <nav className="admin-tabs">
          <Link className="admin-tab" href="/admin">Produtos</Link>
          <span className="admin-tab active">Análise</span>
        </nav>

        <div className="section-title">Análise de contagens</div>

        <div className="pills">
          {STORES.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`pill${s.id === storeId ? ' active' : ''}`}
              onClick={() => setStoreId(s.id)}
            >
              {s.emoji} {s.name}
            </button>
          ))}
        </div>

        <div className="pills">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              className={`pill${p.key === periodKey ? ' active' : ''}`}
              onClick={() => setPeriodKey(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>

        <input
          className="search"
          type="search"
          placeholder="🔍 Buscar produto…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {loading ? (
          <div className="spinner">Carregando…</div>
        ) : loadError ? (
          <div className="empty">{loadError}</div>
        ) : isEmpty ? (
          <div className="empty">Nenhuma contagem encontrada.</div>
        ) : period.mode === 'latest' ? (
          <div className="report">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>Fornecedor</th>
                    <th className="num">Contagem anterior</th>
                    <th className="num">Contagem atual</th>
                    <th className="num">Variação</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleLatestRows.map((r) => (
                    <tr key={r.name}>
                      <td>
                        {r.name}
                        {r.suspicious ? <span className="badge-suspeito">⚠️ Suspeito</span> : null}
                      </td>
                      <td>{r.fornecedor || '—'}</td>
                      <td className="num">
                        {r.prevValue === null ? '-' : `${r.prevValue} (${formatDateShort(r.prevDate)})`}
                      </td>
                      <td className="num">{r.lastValue} ({formatDateShort(r.lastDate)})</td>
                      <td className="num"><VariationTag variationPct={r.variationPct} direction={r.direction} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="report">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>Fornecedor</th>
                    {dates.map((d) => (
                      <th key={d} className="num">{formatLabel(d)}</th>
                    ))}
                    <th className="num">Variação</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRangeRows.map((r) => (
                    <tr key={r.name}>
                      <td>
                        {r.name}
                        {r.suspicious ? <span className="badge-suspeito">⚠️ Suspeito</span> : null}
                      </td>
                      <td>{r.fornecedor || '—'}</td>
                      {r.values.map((v, i) => (
                        <td key={i} className="num">{v === null ? '-' : v}</td>
                      ))}
                      <td className="num"><VariationTag variationPct={r.variationPct} direction={r.direction} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="foot-link">
          <Link href="/admin">← Voltar para produtos</Link>
        </div>
      </main>
    </>
  );
}
