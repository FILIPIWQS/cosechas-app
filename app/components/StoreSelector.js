'use client';

import { STORES } from '../../lib/stores';

export default function StoreSelector({ onSelect }) {
  function handleSelect(id) {
    try {
      localStorage.setItem('siembras_store', id);
    } catch (e) {}
    onSelect(id);
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
      </header>

      <main className="wrap">
        <div className="section-title">Selecione a loja</div>
        <div className="store-list">
          {STORES.map((s) => (
            <button key={s.id} type="button" className="store-item" onClick={() => handleSelect(s.id)}>
              {s.name}
            </button>
          ))}
        </div>
      </main>
    </>
  );
}
