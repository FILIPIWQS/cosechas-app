'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

const PERIODS = [
  { key: 'today_yesterday', label: 'Hoje vs Ontem', days: 2 },
  { key: '7d', label: 'Últimos 7 dias', days: 7 },
  { key: '15d', label: 'Últimos 15 dias', days: 15 },
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

// Builds one row per product that has at least one log within `dates`, with
// the latest counted value per day and the variation between the last two
// counted days (which may not be adjacent if a day was skipped).
function buildRows(logs, fornecedorByName, dates) {
  const dateSet = new Set(dates);
  const latestByKey = new Map();
  const names = new Set();
  for (const log of logs) {
    if (!dateSet.has(log.date)) continue;
    names.add(log.productName);
    const key = `${log.productName}||${log.date}`;
    const existing = latestByKey.get(key);
    if (!existing || log.ts > existing.ts) latestByKey.set(key, { ts: log.ts, value: Number(log.next) || 0 });
  }

  const rows = [];
  for (const name of names) {
    const values = dates.map((date) => {
      const hit = latestByKey.get(`${name}||${date}`);
      return hit ? hit.value : null;
    });
    const counted = values.filter((v) => v !== null);

    let variationPct = null;
    let direction = 'flat';
    if (counted.length >= 2) {
      const prev = counted[counted.length - 2];
      const last = counted[counted.length - 1];
      variationPct = prev === 0 ? (last === 0 ? 0 : 100) : ((last - prev) / prev) * 100;
      direction = last > prev ? 'up' : last < prev ? 'down' : 'flat';
    }

    const avg = counted.length ? counted.reduce((a, b) => a + b, 0) / counted.length : null;
    const lastValue = counted.length ? counted[counted.length - 1] : null;
    const suspicious = avg !== null && avg > 0 && lastValue !== null && lastValue <= avg * 0.3;

    rows.push({ name, fornecedor: fornecedorByName.get(name) || '', values, variationPct, direction, suspicious });
  }

  rows.sort((a, b) => Math.abs(b.variationPct ?? -1) - Math.abs(a.variationPct ?? -1));
  return rows;
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
  const [periodKey, setPeriodKey] = useState('7d');
  const [search, setSearch] = useState('');

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

  async function loadData(pw) {
    setLoading(true);
    setLoadError('');
    try {
      const [logsRes, productsRes] = await Promise.all([
        fetch('/api/logs', { headers: { 'x-admin-password': pw }, cache: 'no-store' }),
        fetch('/api/products', { headers: { 'x-admin-password': pw }, cache: 'no-store' }),
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

  const fornecedorByName = useMemo(() => new Map(products.map((p) => [p.name, p.fornecedor || ''])), [products]);
  const period = PERIODS.find((p) => p.key === periodKey) || PERIODS[1];
  const dates = useMemo(() => lastNDates(period.days), [period.days]);
  const rows = useMemo(() => buildRows(logs, fornecedorByName, dates), [logs, fornecedorByName, dates]);
  const visibleRows = rows.filter((r) => r.name.toLowerCase().includes(search.trim().toLowerCase()));

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
        ) : visibleRows.length === 0 ? (
          <div className="empty">Nenhuma contagem encontrada para este período.</div>
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
                  {visibleRows.map((r) => (
                    <tr key={r.name}>
                      <td>
                        {r.name}
                        {r.suspicious ? <span className="badge-suspeito">⚠️ Suspeito</span> : null}
                      </td>
                      <td>{r.fornecedor || '—'}</td>
                      {r.values.map((v, i) => (
                        <td key={i} className="num">{v === null ? '-' : v}</td>
                      ))}
                      <td className="num">
                        {r.variationPct === null ? (
                          <span className="variation flat">-</span>
                        ) : (
                          <span className={`variation ${r.direction}`}>
                            {r.direction === 'up' ? '▲' : r.direction === 'down' ? '▼' : '→'} {Math.abs(Math.round(r.variationPct))}%
                          </span>
                        )}
                      </td>
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
