@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800;900&display=swap');

:root {
  --bg: #fbfaf6;
  --surface: #ffffff;
  --ink: #18241d;
  --muted: #6b7a70;
  --line: #e7e5dc;
  --green: #1e7a46;
  --green-600: #176237;
  --green-100: #e4f2e8;
  --citrus: #ef7d22;
  --citrus-600: #d96b13;
  --citrus-100: #fcead8;
  --danger: #c8462e;
  --danger-100: #f7e2dd;
  --radius: 16px;
  --shadow: 0 1px 2px rgba(24, 36, 29, 0.05), 0 8px 24px rgba(24, 36, 29, 0.05);
  --font-display: 'Nunito', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --font-body: system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
}

body {
  background: var(--bg);
  color: var(--ink);
  font-family: var(--font-body);
  -webkit-font-smoothing: antialiased;
  line-height: 1.45;
}

h1,
h2,
h3 {
  font-family: var(--font-display);
  margin: 0;
  letter-spacing: -0.01em;
}

button {
  font-family: var(--font-body);
  cursor: pointer;
}

input {
  font-family: var(--font-body);
}

/* ---------- Header ---------- */
.app-header {
  position: sticky;
  top: 0;
  z-index: 20;
  background: var(--green);
  color: #fff;
  padding: 14px 18px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 2px 14px rgba(24, 36, 29, 0.12);
}

.app-header .mark {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--citrus);
  display: grid;
  place-items: center;
  font-size: 18px;
  flex-shrink: 0;
}

.app-header .titles {
  display: flex;
  flex-direction: column;
  line-height: 1.15;
}

.app-header .brand {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 18px;
}

.app-header .sub {
  font-size: 12.5px;
  opacity: 0.85;
}

.app-header .spacer {
  flex: 1;
}

.header-link {
  color: #fff;
  text-decoration: none;
  font-size: 13px;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.14);
  padding: 7px 12px;
  border-radius: 999px;
  white-space: nowrap;
}

.header-link:hover {
  background: rgba(255, 255, 255, 0.24);
}

/* ---------- Layout ---------- */
.wrap {
  max-width: 720px;
  margin: 0 auto;
  padding: 18px 16px 96px;
}

.intro {
  color: var(--muted);
  font-size: 14px;
  margin: 4px 2px 18px;
}

.section-title {
  font-size: 13px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--green-600);
  margin: 26px 2px 12px;
}

/* ---------- Product card (store) ---------- */
.product {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 14px 16px;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 14px;
}

.product .info {
  flex: 1;
  min-width: 0;
}

.product .pname {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 16px;
}

.product .punit {
  color: var(--muted);
  font-size: 13px;
  margin-top: 1px;
}

.saved {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--green);
  font-size: 12px;
  font-weight: 700;
  margin-top: 3px;
  opacity: 0;
  transition: opacity 0.2s;
}

.saved.show {
  opacity: 1;
}

/* ---------- Stepper ---------- */
.stepper {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.step-btn {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  border: 1px solid var(--line);
  background: var(--green-100);
  color: var(--green-600);
  font-size: 22px;
  font-weight: 800;
  line-height: 1;
  display: grid;
  place-items: center;
  transition: transform 0.05s, background 0.15s;
}

.step-btn:active {
  transform: scale(0.94);
}

.step-btn:hover {
  background: #d3ead9;
}

.count-input {
  width: 64px;
  height: 42px;
  text-align: center;
  border: 1px solid var(--line);
  border-radius: 12px;
  font-size: 18px;
  font-weight: 800;
  font-family: var(--font-display);
  color: var(--ink);
  background: #fff;
  -moz-appearance: textfield;
}

.count-input::-webkit-outer-spin-button,
.count-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.count-input:focus {
  outline: 2px solid var(--green);
  outline-offset: 1px;
}

/* ---------- Buttons ---------- */
.btn {
  border: none;
  border-radius: 12px;
  padding: 11px 16px;
  font-weight: 800;
  font-size: 14px;
  font-family: var(--font-display);
  transition: transform 0.05s, filter 0.15s;
}

.btn:active {
  transform: scale(0.98);
}

.btn-primary {
  background: var(--green);
  color: #fff;
}

.btn-primary:hover {
  background: var(--green-600);
}

.btn-citrus {
  background: var(--citrus);
  color: #fff;
}

.btn-citrus:hover {
  background: var(--citrus-600);
}

.btn-ghost {
  background: transparent;
  border: 1px solid var(--line);
  color: var(--ink);
}

.btn-ghost:hover {
  background: #f1efe8;
}

.btn-danger {
  background: transparent;
  border: 1px solid var(--danger-100);
  color: var(--danger);
}

.btn-danger:hover {
  background: var(--danger-100);
}

.btn-sm {
  padding: 7px 12px;
  font-size: 13px;
  border-radius: 10px;
}

/* ---------- States ---------- */
.card {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 22px;
}

.empty {
  text-align: center;
  padding: 40px 22px;
  color: var(--muted);
}

.empty h2 {
  color: var(--ink);
  margin-bottom: 8px;
}

.notice {
  border-radius: var(--radius);
  padding: 16px 18px;
  font-size: 14px;
  line-height: 1.5;
}

.notice-warn {
  background: var(--citrus-100);
  border: 1px solid #f3d3ad;
  color: #8a4b12;
}

.notice code {
  background: rgba(0, 0, 0, 0.06);
  padding: 1px 6px;
  border-radius: 6px;
  font-size: 13px;
}

.spinner {
  text-align: center;
  color: var(--muted);
  padding: 50px 0;
  font-weight: 700;
}

/* ---------- Login ---------- */
.login-box {
  max-width: 380px;
  margin: 60px auto 0;
}

.field {
  margin-bottom: 14px;
}

.field label {
  display: block;
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 6px;
  color: var(--ink);
}

.field input {
  width: 100%;
  height: 44px;
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 0 14px;
  font-size: 15px;
  background: #fff;
}

.field input:focus {
  outline: 2px solid var(--green);
  outline-offset: 1px;
}

.error-text {
  color: var(--danger);
  font-size: 13px;
  font-weight: 700;
  margin-top: 8px;
}

/* ---------- Buy report ---------- */
.report {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  overflow: hidden;
}

.report-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px;
  border-bottom: 1px solid var(--line);
  flex-wrap: wrap;
}

.report-head h2 {
  font-size: 17px;
}

.report-head .count-pill {
  background: var(--citrus-100);
  color: var(--citrus-600);
  font-weight: 800;
  font-size: 13px;
  padding: 4px 10px;
  border-radius: 999px;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

th {
  text-align: left;
  font-size: 11.5px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
  padding: 10px 14px;
  border-bottom: 1px solid var(--line);
}

th.num,
td.num {
  text-align: right;
}

td {
  padding: 11px 14px;
  border-bottom: 1px solid #f1efe8;
}

tr:last-child td {
  border-bottom: none;
}

.buy-qty {
  font-family: var(--font-display);
  font-weight: 800;
}

.buy-qty.go {
  color: var(--citrus-600);
}

.buy-qty.ok {
  color: var(--muted);
}

.row-go {
  background: #fff8f1;
}

/* ---------- Admin product rows ---------- */
.padmin {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 14px 16px;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.padmin .info {
  flex: 1;
  min-width: 140px;
}

.padmin .pname {
  font-family: var(--font-display);
  font-weight: 700;
}

.padmin .punit {
  color: var(--muted);
  font-size: 13px;
}

.par-edit {
  display: flex;
  align-items: center;
  gap: 6px;
}

.par-edit label {
  font-size: 12px;
  color: var(--muted);
  font-weight: 700;
}

.par-input {
  width: 64px;
  height: 38px;
  text-align: center;
  border: 1px solid var(--line);
  border-radius: 10px;
  font-size: 15px;
  font-weight: 800;
  font-family: var(--font-display);
}

.par-input:focus {
  outline: 2px solid var(--green);
  outline-offset: 1px;
}

/* ---------- Add form ---------- */
.add-form {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 16px;
  margin-bottom: 14px;
  display: grid;
  grid-template-columns: 2fr 1fr 1fr auto;
  gap: 10px;
  align-items: end;
}

.add-form .field {
  margin: 0;
}

.toolbar {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}

.foot-link {
  text-align: center;
  margin-top: 28px;
}

.foot-link a {
  color: var(--green-600);
  font-weight: 700;
  text-decoration: none;
  font-size: 14px;
}

.foot-link a:hover {
  text-decoration: underline;
}

@media (max-width: 560px) {
  .add-form {
    grid-template-columns: 1fr 1fr;
  }
  .add-form .field-name {
    grid-column: 1 / -1;
  }
  .add-form .btn {
    grid-column: 1 / -1;
  }
  .product {
    padding: 12px;
    gap: 10px;
  }
  .step-btn {
    width: 40px;
    height: 40px;
  }
}
