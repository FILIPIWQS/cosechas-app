'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

const FREQS = ['diaria', 'semanal', 'quinzenal', 'mensal'];
const FREQ_LABEL = { diaria: 'Diária', semanal: 'Semanal', quinzenal: 'Quinzenal', mensal: 'Mensal' };

function freqOf(p) {
  return FREQS.includes(p.frequency) ? p.frequency : 'diaria';
}

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

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
    }
    await fetch('/api/push-subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub),
    });
  } catch (e) {}
}

function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export default function StorePage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState('ok'); // ok | db | error
  const [countDate, setCountDate] = useState('');
  const [savedId, setSavedId] = useState(null);
  const [search, setSearch] = useState('');
  const [freqFilter, setFreqFilter] = useState('todos');

  const [collaborator, setCollaborator] = useState('');
  const [nameSaved, setNameSaved] = useState(false);

  const [notifPerm, setNotifPerm] = useState('default'); // default | granted | denied | unsupported
  const [reminderOpen, setReminderOpen] = useState(false);

  const timers = useRef({});
  const productsRef = useRef([]);
  const didFirstReminder = useRef(false);

  useEffect(() => {
    productsRef.current = products;
  }, [products]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('cosechas_collaborator');
      if (saved) setCollaborator(saved);
    } catch (e) {}
    if (typeof Notification !== 'undefined') setNotifPerm(Notification.permission);
    else setNotifPerm('unsupported');
    // Registra Service Worker para notificações em segundo plano
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    load();
    const t = timers.current;
    return () => Object.values(t).forEach((id) => clearTimeout(id));
    // eslint-disable-next-line
  }, []);

  // Lembrete a cada 5 minutos se a contagem não terminou
  useEffect(() => {
    const iv = setInterval(() => {
      const pending = productsRef.current.filter((p) => !p.countedToday).length;
      if (pending > 0) {
        setReminderOpen(true);
        playAlert();
        if (navigator.vibrate) navigator.vibrate([400, 150, 400, 150, 400]);
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          try {
            new Notification('⚠️ Estoque pendente – Cosechas', {
              body: `Faltam ${pending} produto${pending > 1 ? 's' : ''} para contar hoje!`,
              icon: '/logo-cosechas.png',
              requireInteraction: true,
            });
          } catch (e) {}
        }
      }
    }, 10 * 1000); // TESTE — voltar para 5 * 60 * 1000
    return () => clearInterval(iv);
  }, []);

  // Título da aba muda quando há pendências
  useEffect(() => {
    if (loading || state !== 'ok') return;
    const pendingAll = products.filter((p) => !p.countedToday).length;
    if (pendingAll > 0) {
      let blink = false;
      const t = setInterval(() => {
        blink = !blink;
        document.title = blink
          ? `⚠️ ${pendingAll} pendente${pendingAll > 1 ? 's' : ''} – Cosechas`
          : 'Cosechas – contagem pendente';
      }, 1200);
      return () => { clearInterval(t); document.title = 'Cosechas'; };
    } else {
      document.title = '✓ Cosechas – tudo contado';
    }
  // eslint-disable-next-line
  }, [products, loading, state]);

  // Atualiza ao voltar pra aba (pega virada de dia / outras contagens)
  useEffect(() => {
    function onVis() {
      if (document.visibilityState === 'visible') load();
    }
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
    // eslint-disable-next-line
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
      const list = data.products || [];
      setProducts(list);
      setCountDate(data.countDate || '');
      setState('ok');
      if (!didFirstReminder.current) {
        didFirstReminder.current = true;
        if (list.filter((p) => !p.countedToday).length > 0) setReminderOpen(true);
      }
    } catch (e) {
      setState('error');
    } finally {
      setLoading(false);
    }
  }

  function onNameChange(value) {
    setCollaborator(value);
    try {
      localStorage.setItem('cosechas_collaborator', value);
    } catch (e) {}
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 1400);
  }

  function updateLocal(id, count) {
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, count, countedToday: true } : p))
    );
  }

  function queueSave(id, count) {
    clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(() => saveCount(id, count), 450);
  }

  async function saveCount(id, count, confirmed) {
    try {
      const body = { id, count, by: collaborator };
      if (confirmed === false) body.confirmed = false;
      await fetch('/api/count', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setSavedId(id);
      setTimeout(() => setSavedId((s) => (s === id ? null : s)), 1400);
    } catch (e) {}
  }

  function toggleConfirm(id) {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    if (p.countedToday) {
      setProducts((prev) => prev.map((x) => x.id === id ? { ...x, countedToday: false } : x));
      clearTimeout(timers.current[id]);
      saveCount(id, Number(p.count) || 0, false);
    } else {
      const count = Number(p.count) || 0;
      updateLocal(id, count);
      clearTimeout(timers.current[id]);
      saveCount(id, count);
    }
  }

  function onInput(id, value) {
    let count = parseInt(value, 10);
    if (Number.isNaN(count) || count < 0) count = 0;
    setProducts((prev) => prev.map((p) => p.id === id ? { ...p, count } : p));
  }

  function step(id, delta) {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    let count = (Number(p.count) || 0) + delta;
    if (count < 0) count = 0;
    setProducts((prev) => prev.map((x) => x.id === id ? { ...x, count } : x));
  }

  async function enableNotifications() {
    if (typeof Notification === 'undefined') return;
    try {
      const perm = await Notification.requestPermission();
      setNotifPerm(perm);
      if (perm === 'granted') await subscribeToPush();
    } catch (e) {}
  }

  // escopo do progresso = filtro de frequência (ignora a busca)
  const scope = products.filter((p) => freqFilter === 'todos' || freqOf(p) === freqFilter);
  const counted = scope.filter((p) => p.countedToday).length;
  const total = scope.length;
  const pct = total ? Math.round((counted / total) * 100) : 0;
  const complete = total > 0 && counted === total;
  const pendingAll = products.filter((p) => !p.countedToday).length;

  const visible = scope
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'pt'))
    .filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <>
      <header className="app-header">
        <img className="logo-img" src="/logo-cosechas.png" alt="Cosechas" />
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
            O banco de dados ainda não foi conectado no Vercel (Storage → Upstash Redis).
          </div>
        ) : state === 'error' ? (
          <div className="notice notice-warn">
            Não foi possível carregar.{' '}
            <button className="btn btn-ghost btn-sm" onClick={load}>
              Tentar de novo
            </button>
          </div>
        ) : (
          <>
            {reminderOpen && pendingAll > 0 ? (
              <div className="reminder reminder-pulse">
                <button className="reminder-x" onClick={() => setReminderOpen(false)} aria-label="Fechar">
                  ×
                </button>
                <div className="reminder-title">🚨 CONTAGEM PENDENTE!</div>
                <div className="reminder-body">
                  Faltam <strong>{pendingAll} produto{pendingAll > 1 ? 's' : ''}</strong> para contar hoje.
                  Este aviso repete a cada <strong>5 minutos</strong>.
                </div>
              </div>
            ) : null}

            {/* Colaborador */}
            <div className="panel">
              <div className="panel-label">Colaborador da contagem</div>
              <div className="name-row">
                <span className="name-icon">👤</span>
                <input
                  className="name-input"
                  type="text"
                  placeholder="Seu nome"
                  value={collaborator}
                  onChange={(e) => onNameChange(e.target.value)}
                />
                {nameSaved ? <span className="name-saved">✓ Salvo</span> : null}
              </div>
              {notifPerm === 'default' ? (
                <button className="btn btn-ghost-dark btn-sm notif-btn" onClick={enableNotifications}>
                  🔔 Ativar notificações do navegador (obrigatório para pop-up)
                </button>
              ) : notifPerm === 'denied' ? (
                <div className="notif-hint notif-blocked">
                  🔕 Notificações bloqueadas pelo navegador. Clique no cadeado na barra de endereço → Permissões → Notificações → Permitir.
                </div>
              ) : notifPerm === 'granted' ? (
                <div className="notif-hint ok">🔔 Notificações ativadas — você receberá alertas a cada 5 min.</div>
              ) : null}
            </div>

            {/* Progresso (indicador inteligente) */}
            <div className="panel">
              <div className="progress-head">
                <span className="panel-label">Progresso da contagem de hoje</span>
                <span className={'progress-count' + (complete ? ' done' : '')}>
                  {complete ? '✓ Concluída' : `${counted} de ${total} (${pct}%)`}
                </span>
              </div>
              <div className="progress-bar">
                <div
                  className={'progress-fill' + (complete ? ' done' : '')}
                  style={{ width: pct + '%' }}
                />
              </div>
              {!complete ? (
                <div className="progress-hint">
                  Toque ou digite o valor de cada produto para marcá-lo como contado.
                </div>
              ) : null}
            </div>

            {/* Data */}
            <div className="date-bar">
              <span>
                Contagem ativa da data: <strong>{formatDate(countDate)}</strong>
              </span>
            </div>

            {/* Busca */}
            <input
              className="search"
              type="search"
              placeholder="🔍 Pesquisar por nome…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            {/* Filtros de frequência */}
            <div className="pills">
              <button
                className={'pill' + (freqFilter === 'todos' ? ' active' : '')}
                onClick={() => setFreqFilter('todos')}
              >
                Todos
              </button>
              {FREQS.map((f) => (
                <button
                  key={f}
                  className={'pill' + (freqFilter === f ? ' active' : '')}
                  onClick={() => setFreqFilter(f)}
                >
                  {FREQ_LABEL[f]}
                </button>
              ))}
            </div>

            {visible.length === 0 ? (
              <div className="card empty">
                <p>Nenhum produto nesta seção.</p>
              </div>
            ) : (
              visible.map((p) => (
                <div className={'product' + (p.countedToday ? ' counted' : '')} key={p.id}>
                  {p.image ? <img className="thumb" src={p.image} alt="" /> : null}
                  <div className="info">
                    <div className="pname">{p.name}</div>
                    <div className="prow">
                      <span className={'freq-tag freq-' + freqOf(p)}>{FREQ_LABEL[freqOf(p)]}</span>
                      {p.countedToday ? (
                        <span className="counted-tag">✓ contado</span>
                      ) : (
                        <span className="tocount-tag">a contar</span>
                      )}
                      {savedId === p.id ? <span className="saved show">✓ salvo</span> : null}
                    </div>
                  </div>
                  <div className="stepper">
                    <button className="step-btn" aria-label={`Diminuir ${p.name}`} onClick={() => step(p.id, -1)} disabled={p.countedToday}>
                      −
                    </button>
                    <input
                      className="count-input"
                      type="number"
                      inputMode="numeric"
                      min="0"
                      value={p.count > 0 || p.countedToday ? String(Number(p.count) || 0) : ''}
                      placeholder="–"
                      onChange={(e) => onInput(p.id, e.target.value)}
                      onFocus={(e) => e.target.select()}
                      disabled={p.countedToday}
                    />
                    <button className="step-btn" aria-label={`Aumentar ${p.name}`} onClick={() => step(p.id, 1)} disabled={p.countedToday}>
                      +
                    </button>
                    <button
                      className={'step-btn confirm-btn' + (p.countedToday ? ' confirmed' : '')}
                      aria-label={p.countedToday ? `Desmarcar ${p.name}` : `Confirmar ${p.name}`}
                      onClick={() => toggleConfirm(p.id)}
                    >
                      ✓
                    </button>
                  </div>
                </div>
              ))
            )}

            <div className="foot-link">
              <Link href="/admin">Área do administrador →</Link>
            </div>

            <footer className="footer">
              <p className="footer-brand">© SIEMBRAS — TODOS OS DIREITOS RESERVADOS</p>
              <p className="footer-dev">Desenvolvido por <strong>Filipi Fernandes</strong></p>
            </footer>
          </>
        )}
      </main>
    </>
  );
}
