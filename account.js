'use strict';
const $ = id => document.getElementById(id);
const state = {
  token: '',
  page: 'dashboard',
  boot: null,
  report: null,
  reportKind: 'TrialBalance',
  busy: false
};
try {
  state.token = sessionStorage.getItem('mandirSession') || '';
} catch (_) {}
const NAV = [
  ['dashboard', '⌂', 'ड्यासबोर्ड', 'मुख्य'],
  ['vouchers', '▤', 'भौचर तथा कारोबार', 'लेखा'],
  ['accounts', '≡', 'खाता तथा कोष', ''],
  ['parties', '♧', 'दानदाता / अन्य पक्ष', ''],
  ['cashbank', '▣', 'नगद तथा बैंक', ''],
  ['bookings', '▦', 'पूजा बुकिङ', 'व्यवस्थापन'],
  ['stock', '◇', 'सामग्री तथा स्टक', ''],
  ['assets', '▥', 'स्थायी सम्पत्ति', ''],
  ['events', '◷', 'कार्यक्रम', ''],
  ['budgets', '◴', 'बजेट', ''],
  ['reports', '▧', 'प्रतिवेदन केन्द्र', 'प्रतिवेदन'],
  ['approvals', '✓', 'भौचर स्वीकृति', ''],
  ['audit', '◎', 'Audit Log', ''],
  ['public-admin', '◇', 'सार्वजनिक वेबसाइट', 'प्रशासन'],
  ['settings', '⚙', 'सेटिङ तथा प्रयोगकर्ता', '']
];
const REPORTS = {
  TrialBalance: 'Trial Balance',
  IncomeExpense: 'आय–व्यय विवरण',
  BalanceSheet: 'वासलात',
  Ledger: 'General Ledger',
  CashBook: 'Cash Book',
  BankBook: 'Bank Book',
  CashBank: 'नगद / बैंक मौज्दात',
  CashFlow: 'नगद प्रवाह',
  PartyBalances: 'लिनुपर्ने / तिर्नुपर्ने',
  Donations: 'दान तथा भेटी',
  Budget: 'बजेट तुलना',
  Bookings: 'पूजा बुकिङ',
  Stock: 'सामग्री मौज्दात',
  Assets: 'सम्पत्ति विवरण'
};
const MONEY_COLUMNS = new Set(['Debit', 'Credit', 'Balance', 'Amount', 'Advance', 'Cost', 'Residual',
  'Budget', 'Actual', 'Remaining', 'Value', 'Depreciation', 'BookValue', 'Receivable', 'Payable',
  'StatementBalance', 'LedgerBalance', 'Difference', 'CountedAmount', 'OutstandingDeposits',
  'OutstandingPayments'
]);
const LABELS = {
  Date: 'मिति',
  Number: 'भौचर नं.',
  Name: 'नाम',
  Description: 'विवरण',
  Debit: 'Debit',
  Credit: 'Credit',
  Balance: 'मौज्दात',
  Amount: 'रकम',
  Advance: 'अग्रिम',
  AccountID: 'खाता नं.',
  Type: 'प्रकार',
  Phone: 'फोन',
  Service: 'सेवा',
  EventDate: 'पूजा मिति',
  Status: 'अवस्था',
  Quantity: 'परिमाण',
  Unit: 'एकाइ',
  Value: 'मूल्य',
  Cost: 'लागत',
  Depreciation: 'ह्रासकट्टी',
  BookValue: 'खुद मूल्य',
  Category: 'वर्ग',
  Budget: 'बजेट',
  Actual: 'वास्तविक',
  Remaining: 'बाँकी',
  Receivable: 'लिनुपर्ने',
  Payable: 'तिर्नुपर्ने',
  Fund: 'कोष',
  Memo: 'कैफियत',
  StatementBalance: 'स्टेटमेन्ट मौज्दात',
  LedgerBalance: 'Ledger मौज्दात',
  Difference: 'फरक',
  CountedAmount: 'गनिएको नगद',
  Opening: 'सुरु मौज्दात',
  Closing: 'अन्तिम मौज्दात',
  Income: 'आम्दानी',
  Expense: 'खर्च',
  Surplus: 'बचत / घाटा',
  NetCashFlow: 'खुद नगद प्रवाह'
};

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  } [ch]));
}

function money(value) {
  return 'रु. ' + (Number(value || 0) / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function today() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kathmandu',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const get = t => parts.find(p => p.type === t).value;
  return get('year') + '-' + get('month') + '-' + get('day');
}

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(
    2) + Math.random().toString(36).slice(2);
}

function data(table) {
  return state.boot?.data[table] || [];
}

function can(roles) {
  return roles.includes(state.boot?.user.Role);
}

function toast(message, error = false) {
  $('toast').textContent = message;
  $('toast').className = 'toast' + (error ? ' error' : '');
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => $('toast').classList.add('hidden'), 6000);
}

function toggleMenu(force) {
  const open = force === undefined ? !$('sidebar').classList.contains('open') : force;
  $('sidebar').classList.toggle('open', open);
  $('backdrop').classList.toggle('open', open);
}

async function rpc(action, payload = {}, requestId) {
  const response = await MandirAPI.send('account', {
    action,
    token: state.token,
    data: payload,
    requestId: requestId || uid()
  });
  if (response.ok) return response.data;
  if (response.error === 'SESSION_EXPIRED') {
    state.token = '';
    sessionStorage.removeItem('mandirSession');
    showLogin();
  }
  throw new Error(response.error || 'अनुरोध असफल भयो ।');
}

async function run(action, payload) {
  if (state.busy) return;
  state.busy = true;
  $('loader').classList.remove('hidden');
  try {
    const result = await rpc(action, payload);
    toast('सुरक्षित भयो ।');
    closeModal();
    await refresh();
    return result;
  } catch (error) {
    toast(error.message, true);
  } finally {
    state.busy = false;
    $('loader').classList.add('hidden');
  }
}

function showLogin() {
  $('app').classList.add('hidden');
  $('loginPage').classList.remove('hidden');
  try {
    sessionStorage.removeItem('mandirSession');
  } catch (_) {}
}
$('loginForm').onsubmit = async event => {
  event.preventDefault();
  const button = event.target.querySelector('button');
  button.disabled = true;
  button.textContent = 'प्रवेश भइरहेको छ…';
  $('loginError').textContent = '';
  try {
    const result = await rpc('login', {
      username: $('username').value,
      password: $('password').value
    });
    state.token = result.token;
    try {
      sessionStorage.setItem('mandirSession', result.token);
    } catch (_) {}
    $('password').value = '';
    await refresh();
  } catch (error) {
    $('loginError').textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = 'प्रवेश गर्नुहोस् →';
  }
};
async function logout() {
  try {
    await rpc('logout');
  } catch (_) {}
  state.token = '';
  state.boot = null;
  showLogin();
}
async function refresh() {
  if (!state.token) return;
  try {
    state.boot = await rpc('bootstrap');
    $('app').classList.remove('hidden');
    $('loginPage').classList.add('hidden');
    renderShell();
    renderPage();
  } catch (error) {
    toast(error.message, true);
  }
}

function renderShell() {
  const b = state.boot;
  $('topTitle').innerHTML = esc(b.settings.Name) + '<small>' + esc(b.settings.Address) + '</small>';
  $('profile').innerHTML = esc(b.user.Name) + '<small>' + esc(b.user.Role) + '</small>';
  if (b.settings.LogoURL) $('brandLogo').innerHTML = '<img src="' + esc(b.settings.LogoURL) +
    '" alt="मन्दिर लोगो" style="width:100%;height:100%;object-fit:contain;border-radius:50%" onerror="this.hidden=true">';
  $('navigation').innerHTML = NAV.filter(n => n[0] !== 'public-admin' || can(['SuperAdmin'])).filter(n => !
    can(['Operator']) || ['bookings', 'parties', 'events',
      'reports'
    ].includes(n[0])).filter(n => n[0] !== 'audit' || can(['SuperAdmin', 'Chairperson', 'Treasurer',
    'Auditor'
  ])).map(n => (n[3] ? '<div class="nav-label">' + n[3] + '</div>' : '') +
    '<button class="nav-item ' + (state.page === n[0] ? 'active' : '') + '" onclick="navigate(\'' + n[0] +
    '\')"><span class="nav-icon">' + n[1] + '</span>' + n[2] + '</button>').join('');
  $('mobileBottom').innerHTML = NAV.filter(n => n[0] !== 'public-admin' || can(['SuperAdmin'])).filter(n => !
      can(['Operator']) || ['bookings', 'reports'].includes(n[0]))
    .filter(n => ['dashboard', 'vouchers', 'bookings', 'reports'].includes(n[0])).map(n => '<button class="' +
      (state.page === n[0] ? 'active' : '') + '" onclick="navigate(\'' + n[0] + '\')"><b>' + n[1] + '</b>' +
      n[2].split(' ')[0] + '</button>').join('') + '<button onclick="toggleMenu(true)"><b>☰</b>थप</button>';
}

function navigate(page) {
  state.page = page;
  toggleMenu(false);
  renderShell();
  renderPage();
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}

function heading(title, subtitle, button = '') {
  return '<div class="page-heading"><div><div class="eyebrow">TEMPLE MANAGEMENT</div><h1>' + title +
    '</h1><p class="muted small">' + subtitle + '</p></div>' + button + '</div>';
}

function addButton(label, call) {
  return can(['SuperAdmin', 'Treasurer', 'Accountant', 'Operator']) ? '<button class="btn" onclick="' + call +
    '">＋ ' + label + '</button>' : '';
}

function table(columns, rows, actions) {
  if (!rows.length) return '<div class="empty">अहिलेसम्म कुनै विवरण छैन ।</div>';
  return '<div class="table-wrap"><table><thead><tr>' + columns.map(c => '<th>' + esc(LABELS[c] || c) +
      '</th>').join('') + (actions ? '<th>कार्य</th>' : '') + '</tr></thead><tbody>' + rows.map(row =>
      '<tr>' + columns.map(c => '<td class="' + (MONEY_COLUMNS.has(c) ? 'amount' : (['Description', 'Name']
        .includes(c) ? 'wrap' : '')) + '">' + (c === 'Status' ? '<span class="badge ' + esc(row[c]) + '">' +
        esc(row[c]) + '</span>' : MONEY_COLUMNS.has(c) ? money(row[c]) : esc(row[c])) + '</td>').join('') + (
        actions ? '<td><div class="flex">' + actions(row) + '</div></td>' : '') + '</tr>').join('') +
    '</tbody></table></div>';
}

function searchable(columns, rows, actions) {
  window.currentTable = {
    columns,
    rows,
    actions
  };
  return '<div class="toolbar"><input class="search" placeholder="नाम, नम्बर वा विवरण खोज्नुहोस्…" aria-label="खोज्नुहोस्" oninput="filterTable(this.value)"><span class="muted small">' +
    rows.length + ' रेकर्ड</span></div><div id="tableHost">' + table(columns, rows, actions) + '</div>';
}

function filterTable(value) {
  const t = window.currentTable;
  $('tableHost').innerHTML = table(t.columns, t.rows.filter(r => Object.values(r).join(' ').toLowerCase()
    .includes(value.toLowerCase())), t.actions);
}

function renderPage() {
  if (can(['Operator']) && !['bookings', 'parties', 'events', 'reports'].includes(state.page)) {
    state.page = 'bookings';
    renderShell();
  }
  const page = state.page;
  if (page === 'public-admin') return renderPublicAdmin();
  if (page === 'dashboard') return renderDashboard();
  if (page === 'reports') return renderReports();
  if (page === 'settings') return renderSettings();
  if (page === 'cashbank') return renderCashBank();
  if (page === 'accounts') return renderAccounts();
  if (page === 'stock') return renderStock();
  if (page === 'assets') return renderAssets();
  if (page === 'approvals') return renderApprovals();
  if (page === 'audit') {
    $('main').innerHTML = heading('Audit Log', 'कसले, कहिले, के परिवर्तन गर्‍यो — पछिल्ला ३०० रेकर्ड') +
      '<div class="panel">' + searchable(['At', 'UserID', 'Action', 'Entity', 'RecordID'], data('Audit')
        .slice().reverse(), r => '<button class="btn compact secondary" onclick="auditDetail(\'' + r.ID +
        '\')">विवरण</button>') + '</div>';
    return;
  }
  const defs = {
    vouchers: ['भौचर तथा कारोबार', 'स्वीकृत भौचरबाट मात्र Ledger अपडेट हुन्छ ।', 'नयाँ भौचर',
      'voucherDialog()', 'Vouchers', ['Number', 'Date', 'Type', 'Description', 'Status']
    ],
    parties: ['दानदाता तथा अन्य पक्ष', 'दानदाता, सेवाग्राही र आपूर्तिकर्ताको विवरण', 'नयाँ विवरण',
      "entityDialog('Parties')", 'Parties', ['Name', 'Type', 'Phone', 'Address']
    ],
    bookings: ['पूजा तथा कार्यक्रम बुकिङ', 'अग्रिम, बाँकी रकम, सेवा सम्पन्न र रकम फिर्ता', 'नयाँ बुकिङ',
      'bookingDialog()', 'Bookings', ['Name', 'Service', 'EventDate', 'Amount', 'Advance', 'Status']
    ],
    events: ['धार्मिक कार्यक्रम', 'कार्यक्रम मिति, स्थान र अनुमानित बजेट', 'कार्यक्रम थप्ने',
      "entityDialog('Events')", 'Events', ['Name', 'Date', 'Venue', 'Budget', 'Status']
    ],
    budgets: ['वार्षिक बजेट', 'खाता र कोषअनुसार बजेट निर्धारण', 'बजेट थप्ने', "entityDialog('Budgets')",
      'Budgets', ['YearID', 'AccountID', 'FundID', 'Amount']
    ]
  };
  const def = defs[page];
  if (!def) return;
  let actions;
  if (page === 'vouchers') actions = voucherActions;
  if (page === 'bookings') actions = r => can(['SuperAdmin', 'Treasurer', 'Accountant']) && r.Status ===
    'Booked' ? '<button class="btn compact light" onclick="bookingAction(\'' + r.ID +
    '\',false)">सम्पन्न</button><button class="btn compact danger" onclick="bookingAction(\'' + r.ID +
    '\',true)">रद्द / Refund</button>' : '';
  $('main').innerHTML = heading(def[0], def[1], addButton(def[2], def[3])) + '<div class="panel">' +
    searchable(def[5], data(def[4]).slice().reverse(), actions) + '</div>';
}

function voucherActions(r) {
  return '<button class="btn compact secondary" onclick="viewVoucher(\'' + r.ID +
    '\')">हेर्ने / Print</button>' + (r.AttachmentID ?
      '<button class="btn compact secondary" onclick="viewBill(\'' + r.AttachmentID + '\')">बिल</button>' : ''
    ) + (r.Status === 'Rejected' && can(['SuperAdmin', 'Treasurer', 'Accountant']) ?
      '<button class="btn compact light" onclick="resubmitDialog(\'' + r.ID + '\')">पुनः पठाउने</button>' : ''
    ) + (r.Status === 'Posted' && can(['SuperAdmin', 'Treasurer']) ?
      '<button class="btn compact danger" onclick="reverseDialog(\'' + r.ID + '\')">Reversal</button>' : '');
}

function renderDashboard() {
  const s = state.boot.summary;
  const stat = [
    ['आम्दानी', s.Income, '↗', 'आर्थिक वर्ष ' + s.Year],
    ['खर्च', s.Expense, '↘', 'आर्थिक वर्ष ' + s.Year],
    ['नगद मौज्दात', s.Cash, '▣', 'पोस्ट भएका कारोबार'],
    ['बैंक मौज्दात', s.Bank, '▥', 'सबै बैंक खाताको कुल']
  ];
  const maximum = Math.max(Math.abs(s.Income), Math.abs(s.Expense), 1);
  $('main').innerHTML = heading('आर्थिक ड्यासबोर्ड', 'आज ' + today() + ' • ' + s.Year,
      '<button class="btn secondary" onclick="navigate(\'reports\')">प्रतिवेदन हेर्ने ↗</button>') +
    '<div class="stats">' + stat.map(a => '<div class="stat"><div class="stat-top">' + a[0] +
      '<span class="stat-icon">' + a[2] + '</span></div><div class="stat-value">' + money(a[1]) +
      '</div><div class="stat-sub">' + esc(a[3]) + '</div></div>').join('') +
    '</div><div class="hero"><h2>आजको सेवा, व्यवस्थित हिसाब ।</h2><p>दान, पूजा र दैनिक कारोबार सुरक्षित राख्नुहोस् । ' +
    s.Pending +
    ' भौचर स्वीकृतिको पर्खाइमा छन् ।</p><button class="btn" onclick="navigate(\'approvals\')">स्वीकृति केन्द्र →</button></div><div class="dashboard-grid"><div class="panel"><div class="panel-head"><h2>हालका कारोबार</h2><button class="btn compact secondary" onclick="navigate(\'vouchers\')">सबै हेर्ने</button></div>' +
    table(['Number', 'Date', 'Description', 'Status'], data('Vouchers').slice(-6).reverse()) +
    '</div><div class="panel"><div class="panel-head"><h2>छिटो काम गर्नुहोस्</h2></div><div class="quick-grid"><button class="quick" onclick="voucherDialog(\'Receipt\')">↗<b>आम्दानी / दान</b><span>Receipt Voucher</span></button><button class="quick" onclick="voucherDialog(\'Payment\')">↘<b>खर्च / भुक्तानी</b><span>Payment Voucher</span></button><button class="quick" onclick="bookingDialog()">▦<b>पूजा बुकिङ</b><span>अग्रिम र बाँकी हिसाब</span></button><button class="quick" onclick="voucherDialog(\'Transfer\')">⇄<b>नगद–बैंक</b><span>Transfer Voucher</span></button></div></div><div class="panel"><div class="panel-head"><h2>आय–व्यय तुलना</h2><span class="small muted">' +
    esc(s.Year) +
    '</span></div><div class="progress-bars"><div class="bar-group"><div class="bar" style="height:' + Math
    .max(4, 100 * Math.abs(s.Income) / maximum) + 'px"></div><span>आम्दानी ' + money(s.Income) +
    '</span></div><div class="bar-group"><div class="bar expense" style="height:' + Math.max(4, 100 * Math
      .abs(s.Expense) / maximum) + 'px"></div><span>खर्च ' + money(s.Expense) +
    '</span></div></div><p class="small muted">बचत / घाटा: <strong>' + money(s.Income - s.Expense) +
    '</strong></p></div><div class="panel"><div class="panel-head"><h2>आगामी बुकिङ</h2></div>' + table([
      'Name', 'Service', 'EventDate'
    ], data('Bookings').filter(b => b.Status === 'Booked' && b.EventDate >= today()).sort((a, b) => a
      .EventDate.localeCompare(b.EventDate)).slice(0, 5)) + '</div></div>';
}

function field(name, label, type = 'text', value = '', required = true, full = false) {
  return '<div class="field' + (full ? ' full' : '') + '"><label for="f_' + name + '">' + label +
    '</label><input id="f_' + name + '" name="' + name + '" type="' + type + '" value="' + esc(value) + '" ' +
    (required ? 'required' : '') + (type === 'number' ? ' min="0" step="0.01"' : '') + '></div>';
}

function selectField(name, label, options, value = '', required = true) {
  return '<div class="field"><label for="f_' + name + '">' + label + '</label><select id="f_' + name +
    '" name="' + name + '" ' + (required ? 'required' : '') + '>' + options.map(o => '<option value="' + esc(
      o[0]) + '" ' + (o[0] === value ? 'selected' : '') + '>' + esc(o[1]) + '</option>').join('') +
    '</select></div>';
}

function options(table, filter) {
  return data(table).filter(r => (r.Active !== false && r.Active !== 'false') && (!filter || filter(r))).map(
    r => [String(r.ID), r.Name]);
}

function funds() {
  return selectField('FundID', 'कोष', options('Funds'), 'GENERAL');
}

function cashField() {
  return selectField('CashAccountID', 'भुक्तानी / प्राप्ति खाता', options('Accounts', a => a.CashBank));
}

function formValues() {
  return Object.fromEntries(new FormData($('modalForm')).entries());
}

function modal(title, body, handler, saveLabel = 'सुरक्षित गर्नुहोस्') {
  $('modalTitle').textContent = title;
  $('modalBody').innerHTML = body;
  $('saveButton').textContent = saveLabel;
  $('saveButton').classList.remove('hidden');
  $('modalForm').onsubmit = async event => {
    event.preventDefault();
    if (state.busy) return;
    const b = $('saveButton');
    b.disabled = true;
    try {
      await handler(formValues());
    } catch (error) {
      toast(error.message, true);
    } finally {
      b.disabled = false;
    }
  };
  $('modal').showModal();
}

function closeModal() {
  if ($('modal').open) $('modal').close();
}

function voucherDialog(type = 'Journal') {
  if (!can(['SuperAdmin', 'Treasurer', 'Accountant'])) return toast('भौचर बनाउने अनुमति छैन ।', true);
  modal('नयाँ ' + type + ' भौचर', '<div class="form-grid">' + field('Date', 'कारोबार मिति (AD)', 'date',
      today()) + selectField('Type', 'भौचर प्रकार', ['Receipt', 'Payment', 'Journal', 'Transfer', 'Opening']
      .map(v => [v, v]), type) + funds() + selectField('PartyID', 'दानदाता / अन्य पक्ष', [
      ['', 'नाम नखुलेको / लागू हुँदैन'], ...options('Parties')
    ], '', false) + field('Description', 'कारोबार विवरण', 'text', '', true, true) +
    '</div><div class="form-note">Debit र Credit बराबर राख्नुहोस् । अग्रिम बुकिङका लागि Booking मोड्युल प्रयोग गर्नुहोस् ।</div><div class="small muted" style="margin-bottom:8px">खाता • Debit (रु.) • Credit (रु.)</div><div id="voucherLines"></div><button class="btn secondary compact" type="button" onclick="addLine()">＋ लाइन थप्ने</button><div id="balanceCheck" class="balance-check"></div><div class="field"><label>बिल / प्रमाण (JPG, PNG, PDF • अधिकतम 2 MB)</label><input id="billFile" type="file" accept="image/jpeg,image/png,application/pdf"></div>',
    async d => {
      d.Lines = [...document.querySelectorAll('.line-row')].map(row => ({
        AccountID: row.querySelector('select').value,
        Debit: row.querySelector('.debit').value,
        Credit: row.querySelector('.credit').value
      }));
      const debit = d.Lines.reduce((s, l) => s + Math.round(Number(l.Debit || 0) * 100), 0),
        credit = d.Lines.reduce((s, l) => s + Math.round(Number(l.Credit || 0) * 100), 0);
      if (!debit || debit !== credit) throw new Error('Debit र Credit बराबर हुनुपर्छ ।');
      const file = $('billFile').files[0];
      if (file) {
        $('saveButton').textContent = 'बिल अपलोड भइरहेको छ…';
        const uploaded = await uploadFile(file);
        d.AttachmentID = uploaded.ID;
      }
      await run('voucher.save', d);
    }, 'भौचर पठाउनुहोस्');
  const defaults = type === 'Receipt' ? ['1000', '4000'] : type === 'Payment' ? ['5090', '1000'] : type ===
    'Transfer' ? ['1010', '1000'] : ['', ''];
  addLine(defaults[0]);
  addLine(defaults[1]);
}

function addLine(selected = '') {
  const row = document.createElement('div');
  row.className = 'line-row';
  row.innerHTML = '<select aria-label="खाता" required><option value="">खाता छान्नुहोस्</option>' + options(
      'Accounts').map(a => '<option value="' + esc(a[0]) + '" ' + (a[0] === selected ? 'selected' : '') +
      '>' + esc(a[0] + ' • ' + a[1]) + '</option>').join('') +
    '</select><input aria-label="Debit" class="debit" type="number" min="0" step="0.01" placeholder="Debit" oninput="checkBalance()"><input aria-label="Credit" class="credit" type="number" min="0" step="0.01" placeholder="Credit" oninput="checkBalance()"><button type="button" class="icon-button" onclick="this.parentNode.remove();checkBalance()" aria-label="लाइन हटाउनुहोस्">×</button>';
  $('voucherLines').appendChild(row);
  checkBalance();
}

function checkBalance() {
  let d = 0,
    c = 0;
  document.querySelectorAll('.line-row').forEach(r => {
    d += Math.round(Number(r.querySelector('.debit').value || 0) * 100);
    c += Math.round(Number(r.querySelector('.credit').value || 0) * 100);
  });
  $('balanceCheck').innerHTML = 'Debit: <b>' + money(d) + '</b> &nbsp; Credit: <b>' + money(c) +
    '</b> &nbsp; <span style="color:' + (d === c && d ? 'var(--green)' : 'var(--red)') + '">फरक ' + money(d -
      c) + '</span>';
}
async function uploadFile(file) {
  if (file.size > 2 * 1024 * 1024) throw new Error('फाइल 2 MB भन्दा सानो हुनुपर्छ ।');
  const base64 = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result.split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
  return rpc('attachment.upload', {
    Name: file.name,
    MimeType: file.type,
    Base64: base64
  });
}
async function viewBill(id) {
  try {
    const a = await rpc('attachment.read', {
      ID: id
    });
    const bytes = Uint8Array.from(atob(a.Base64), c => c.charCodeAt(0));
    downloadBlob(new Blob([bytes], {
      type: a.MimeType
    }), a.Name);
  } catch (e) {
    toast(e.message, true);
  }
}

function resubmitDialog(id) {
  modal('अस्वीकृत भौचर पुनः पठाउने',
    '<div class="form-note">उही रकम र खाता भएको नयाँ भौचर बनाइन्छ । रकम/खाता गलत भए साधारण भौचर नयाँ प्रविष्ट गर्नुहोस् । Linked Booking/Stock/Asset भौचरको सम्बन्ध नयाँ भौचरमा सारिन्छ ।</div>' +
    field('Date', 'नयाँ मिति', 'date', today()) + field('Reason', 'पुनः पठाउनुको कारण'), d => run(
      'voucher.resubmit', {
        ...d,
        ID: id
      }));
}

function reverseDialog(id) {
  modal('Correction / Reversal',
    '<div class="form-note">मूल भौचर सुरक्षित रहन्छ । उल्टो Debit/Credit भएको नयाँ भौचर स्वीकृतिपछि हिसाब सच्याइन्छ । Linked Booking/Stock/Asset भौचर सिधै उल्टाउन मिल्दैन ।</div><div class="form-grid">' +
    field('Date', 'सच्याउने मिति', 'date', today()) + field('Reason', 'कारण') + '</div>', d => run(
      'voucher.reverse', {
        ...d,
        ID: id
      }), 'Reversal पठाउनुहोस्');
}

function renderApprovals() {
  const allowed = can(['SuperAdmin', 'Chairperson', 'Treasurer']);
  $('main').innerHTML = heading('भौचर स्वीकृति', 'लेखा पोस्ट गर्नुअघि विवरण र प्रमाण जाँच गर्नुहोस् ।') +
    '<div class="panel">' + searchable(['Number', 'Date', 'Description', 'CreatedBy', 'Status'], data(
      'Vouchers').filter(v => v.Status === 'Pending'), r => voucherActions(r) + (allowed ?
      '<button class="btn compact green" onclick="approvalDialog(\'' + r.ID +
      '\',false)">स्वीकृत</button><button class="btn compact danger" onclick="approvalDialog(\'' + r.ID +
      '\',true)">अस्वीकृत</button>' : '')) + '</div>';
}

function approvalDialog(id, reject) {
  modal(reject ? 'भौचर अस्वीकृत गर्ने' : 'भौचर स्वीकृत तथा पोस्ट गर्ने',
    '<p>भौचरको खाता, रकम र प्रमाण जाँच गरेको सुनिश्चित गर्नुहोस् ।</p>' + field('Reason',
      'निर्णयको कारण / टिप्पणी'), d => run('voucher.approve', {
      ID: id,
      Reject: reject,
      Reason: d.Reason
    }), reject ? 'अस्वीकृत गर्नुहोस्' : 'स्वीकृत तथा पोस्ट');
}

function bookingDialog() {
  if (!can(['SuperAdmin', 'Treasurer', 'Accountant', 'Operator'])) return toast('अनुमति छैन ।', true);
  modal('पूजा / कार्यक्रम बुकिङ', '<div class="form-grid">' + field('Name', 'बुकिङ गर्नेको नाम') + field(
      'Phone', 'मोबाइल', 'tel', '', false) + field('Service', 'पूजा / सेवा') + field('EventDate',
      'पूजा मिति (AD)', 'date', today()) + field('Amount', 'कुल शुल्क (रु.)', 'number') + field('Advance',
      'अग्रिम प्राप्त रकम (रु.)', 'number', '0') + field('Date', 'अग्रिम प्राप्त मिति', 'date', today()) +
    cashField() + funds() + selectField('PartyID', 'Party / सेवाग्राही', [
      ['', 'छान्नुहोस्'], ...options('Parties')
    ], '', false) +
    '</div><div class="form-note">अग्रिम रकम दायित्व खातामा जान्छ । सेवा सम्पन्न भएपछि मात्र आम्दानी हुन्छ ।</div>',
    d => run('booking.create', d));
}

function bookingAction(id, cancel) {
  const b = data('Bookings').find(b => b.ID === id);
  modal(cancel ? 'बुकिङ रद्द तथा पूरा अग्रिम फिर्ता' : 'बुकिङ सम्पन्न', '<p><b>' + esc(b.Name) + '</b> • ' +
    esc(b.Service) + '<br>कुल ' + money(b.Amount) + ' • अग्रिम ' + money(b.Advance) +
    '</p><div class="form-grid">' + field('Date', 'कारोबार मिति', 'date', today()) + cashField() + (cancel ?
      field('Reason', 'रद्द गर्ने कारण') : field('Paid', 'अहिले प्राप्त बाँकी रकम (रु.)', 'number', String((
        b.Amount - b.Advance) / 100))) +
    '</div><div class="form-note">यो कारोबारको भौचर पनि स्वीकृत भएपछि मात्र लेखामा पोस्ट हुन्छ ।</div>',
    d => run(cancel ? 'booking.cancel' : 'booking.complete', {
      ...d,
      ID: id
    }));
}

function entityDialog(tableName) {
  if (['Accounts', 'Funds', 'Years', 'Items', 'Budgets'].includes(tableName) && !can(['SuperAdmin',
      'Treasurer'
    ])) return toast('कोषाध्यक्ष वा Super Admin अनुमति चाहिन्छ ।', true);
  const definitions = {
    Accounts: field('ID', 'खाता कोड') + field('Name', 'खाता नाम') + selectField('Type', 'खाता वर्ग', [
      'Asset', 'Liability', 'Equity', 'Income', 'Expense'
    ].map(v => [v, v])) + selectField('CashBank', 'नगद / बैंक', [
      ['', 'सामान्य खाता'],
      ['Cash', 'Cash'],
      ['Bank', 'Bank']
    ]) + selectField('CashFlow', 'नगद प्रवाह वर्ग', ['Operating', 'Investing', 'Financing'].map(v => [v,
      v
    ])),
    Funds: field('Name', 'कोष नाम') + selectField('Restricted', 'उद्देश्य तोकिएको कोष?', [
      ['false', 'होइन'],
      ['true', 'हो']
    ]),
    Parties: field('Name', 'पूरा नाम') + selectField('Type', 'प्रकार', ['Donor', 'Customer', 'Supplier',
      'Other'
    ].map(v => [v, v])) + field('Phone', 'मोबाइल', 'tel', '', false) + field('Email', 'इमेल', 'email', '',
      false) + field('Address', 'ठेगाना', 'text', '', false, true),
    Years: field('Name', 'आर्थिक वर्ष नाम (जस्तै 2083/84)') + field('Start', 'सुरु मिति (AD)', 'date') +
      field('End', 'अन्तिम मिति (AD)', 'date'),
    Items: field('Name', 'सामग्री नाम') + field('Unit', 'एकाइ (जस्तै केजी / थान)'),
    Budgets: selectField('YearID', 'आर्थिक वर्ष', options('Years', y => y.Status === 'Open')) + selectField(
        'AccountID', 'खाता', options('Accounts', a => ['Income', 'Expense'].includes(a.Type))) + funds() +
      field('Amount', 'वार्षिक बजेट (रु.)', 'number'),
    Events: field('Name', 'कार्यक्रम नाम') + field('Date', 'मिति (AD)', 'date', today()) + field('Venue',
      'स्थान') + field('Budget', 'अनुमानित बजेट (रु.)', 'number', '0') + funds() + selectField('Status',
      'अवस्था', ['Planned', 'Ongoing', 'Completed', 'Cancelled'].map(v => [v, v])) + field('Description',
      'विवरण', 'text', '', false, true)
  };
  modal('नयाँ ' + tableName + ' विवरण', '<div class="form-grid">' + definitions[tableName] + '</div>', d => {
    if (tableName === 'Funds') d.Restricted = d.Restricted === 'true';
    return run('entity.save', {
      Table: tableName,
      Record: d
    });
  });
}

function renderAccounts() {
  $('main').innerHTML = heading('खाता तथा कोष', 'सम्पत्ति, दायित्व, कोष, आम्दानी र खर्चको खाता सूची',
      addButton('खाता थप्ने', "entityDialog('Accounts')")) +
    '<div class="panel" style="margin-bottom:20px">' + searchable(['ID', 'Name', 'Type', 'CashBank',
      'CashFlow'
    ], data('Accounts')) + '</div><div class="panel"><div class="panel-head"><h2>कोषहरू</h2>' + addButton(
      'कोष थप्ने', "entityDialog('Funds')") + '</div>' + table(['Name', 'Restricted', 'Active'], data(
      'Funds')) + '</div>';
}

function renderCashBank() {
  const accounts = data('Accounts').filter(a => a.CashBank);
  $('main').innerHTML = heading('नगद तथा बैंक', 'Cash Closing, बैंक मिलान र Transfer', addButton('Transfer',
      "voucherDialog('Transfer')")) + '<div class="panel" style="margin-bottom:20px">' + table(['ID', 'Name',
      'CashBank'
    ], accounts, a => '<button class="btn compact secondary" onclick="openLedger(\'' + a.ID + '\',\'' + (a
      .CashBank === 'Cash' ? 'CashBook' : 'BankBook') + '\')">Book हेर्ने</button>' + (can(['SuperAdmin',
        'Treasurer', 'Accountant'
      ]) ? '<button class="btn compact light" onclick="cashBankDialog(\'' + a.ID + '\',\'' + a.CashBank +
      '\')">' + (a.CashBank === 'Cash' ? 'नगद गणना' : 'बैंक मिलान') + '</button>' : '')) +
    '</div><div class="panel"><h2>बैंक मिलान इतिहास</h2>' + table(['Date', 'AccountID', 'StatementBalance',
      'LedgerBalance', 'Difference'
    ], data('Reconciliation').slice().reverse()) + '<h2 style="margin-top:25px">नगद गणना इतिहास</h2>' + table(
      ['Date', 'AccountID', 'CountedAmount', 'LedgerBalance', 'Difference'], data('CashClosings').slice()
      .reverse()) + '</div>';
}

function cashBankDialog(id, kind) {
  modal(kind === 'Cash' ? 'दैनिक नगद गणना' : 'Bank Reconciliation', '<div class="form-grid">' + field('Date',
      'मिति', 'date', today()) + (kind === 'Cash' ? field('CountedAmount', 'वास्तविक गनिएको रकम (रु.)',
      'number') : field('StatementBalance', 'बैंक स्टेटमेन्ट मौज्दात (रु.)', 'number') + field(
      'OutstandingDeposits', 'बैंकमा नदेखिएको जम्मा (रु.)', 'number', '0') + field('OutstandingPayments',
      'बैंकमा नदेखिएको भुक्तानी (रु.)', 'number', '0')) + field('Notes', 'टिप्पणी', 'text', '', true,
      true) +
    '</div><div class="form-note">फरक रकम देखाउँछ; यसले स्वतः Adjustment Voucher बनाउँदैन । नगद गणनाले अवधि बन्द गर्दैन ।</div>',
    d => run(kind === 'Cash' ? 'cash.close' : 'bank.reconcile', {
      ...d,
      AccountID: id
    }));
}

function renderStock() {
  $('main').innerHTML = heading('सामग्री तथा स्टक', 'खरिदमा मौज्दात बढ्छ; प्रयोगमा खर्च हुन्छ ।', addButton(
      'Stock कारोबार', 'stockDialog()')) +
    '<div class="panel" style="margin-bottom:20px"><div class="panel-head"><h2>सामग्री सूची</h2>' + addButton(
      'सामग्री थप्ने', "entityDialog('Items')") + '</div>' + table(['Name', 'Unit'], data('Items')) +
    '<button class="btn secondary" style="margin-top:15px" onclick="selectReport(\'Stock\')">मौज्दात रिपोर्ट</button></div><div class="panel"><h2>Stock कारोबार इतिहास</h2>' +
    table(['Date', 'ItemID', 'Direction', 'Quantity', 'Description'], data('StockMoves').slice().reverse()) +
    '</div>';
}

function stockDialog() {
  modal('Stock प्राप्ति / प्रयोग', '<div class="form-grid">' + selectField('ItemID', 'सामग्री', options(
      'Items')) + selectField('Direction', 'कारोबार', [
      ['In', 'खरिद / प्राप्ति'],
      ['Out', 'प्रयोग / निकासा']
    ]) + field('Date', 'मिति', 'date', today()) + field('Quantity', 'परिमाण', 'number') + field('UnitCost',
      'खरिद दर प्रति एकाइ (रु.)', 'number', '0') + cashField() + funds() + field('Description', 'विवरण',
      'text', '', true, true) +
    '</div><div class="form-note">प्रयोग हुँदा औसत लागत लागू हुन्छ । सम्बन्धित Pending भौचर पहिले समाधान गर्नुपर्छ ।</div>',
    d => run('stock.move', d));
}

function renderAssets() {
  $('main').innerHTML = heading('स्थायी सम्पत्ति', 'खरिद, लागत र मासिक सीधा रेखा ह्रासकट्टी', addButton(
      'सम्पत्ति खरिद', 'assetDialog()')) + '<div class="panel">' + table(['Name', 'Date', 'Cost', 'Residual',
        'LifeMonths', 'Status'
      ], data('Assets'), a => can(['SuperAdmin', 'Treasurer', 'Accountant']) ?
      '<button class="btn compact light" onclick="depreciationDialog(\'' + a.ID + '\')">ह्रासकट्टी</button>' +
      (a.Status === 'Active' ? '<button class="btn compact danger" onclick="disposalDialog(\'' + a.ID +
        '\')">बिक्री / हटाउने</button>' : '') :
      '') +
    '<button class="btn secondary" style="margin-top:15px" onclick="selectReport(\'Assets\')">सम्पत्ति रिपोर्ट</button></div>';
}

function disposalDialog(id) {
  modal('सम्पत्ति बिक्री / हटाउने', '<div class="form-grid">' + field('Date', 'मिति', 'date', today()) +
    field('Proceeds', 'बिक्रीबाट प्राप्त रकम (रु.)', 'number', '0') + cashField() + field('Reason',
      'कारण') +
    '</div><div class="form-note">खुद मूल्य र बिक्री रकमको फरक आम्दानी वा खर्चमा पोस्ट हुन्छ । भौचर स्वीकृति आवश्यक छ ।</div>',
    d => run('asset.dispose', {
      ...d,
      ID: id
    }));
}

function assetDialog() {
  modal('सम्पत्ति खरिद', '<div class="form-grid">' + field('Name', 'सम्पत्तिको नाम') + field('Date',
      'खरिद मिति', 'date', today()) + field('Cost', 'खरिद लागत (रु.)', 'number') + field('Residual',
      'अवशेष मूल्य (रु.)', 'number', '0') + field('LifeMonths', 'उपयोगी आयु (महिना)', 'number', '60') +
    cashField() + funds() + '</div>', d => run('asset.buy', d));
}

function depreciationDialog(id) {
  modal('मासिक ह्रासकट्टी', field('Date', 'ह्रासकट्टी मिति (एक महिनामा एकपटक)', 'date', today()), d => run(
    'asset.depreciate', {
      ...d,
      ID: id
    }));
}

function auditDetail(id) {
  const row = data('Audit').find(r => r.ID === id);
  modal('परिवर्तनको विवरण', '<pre style="white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px">' + esc(
    JSON.stringify(row, null, 2)) + '</pre>', () => {});
  $('saveButton').classList.add('hidden');
}

function renderSettings() {
  const s = state.boot.settings;
  $('main').innerHTML = heading('सेटिङ तथा प्रशासन',
      'संस्थाको विवरण, आर्थिक वर्ष, प्रयोगकर्ता र अवधि नियन्त्रण') +
    '<div class="panel" style="margin-bottom:20px"><div class="panel-head"><h2>संस्थाको आधिकारिक विवरण</h2>' +
    (can(['SuperAdmin']) ? '<button class="btn secondary" onclick="settingsDialog()">सम्पादन</button>' : '') +
    '</div>' + reportBrand(s) + '<p class="small muted">Print/PDF मा यही विवरण आउँछ । Logo URL: ' + esc(s
      .LogoURL || 'अहिलेसम्म सेट गरिएको छैन') +
    '</p></div><div class="panel" style="margin-bottom:20px"><div class="panel-head"><h2>आर्थिक वर्ष</h2>' +
    addButton('वर्ष थप्ने', "entityDialog('Years')") + '</div>' + table(['Name', 'Start', 'End', 'Status'],
      data('Years'), y => can(['SuperAdmin', 'Treasurer']) && y.Status === 'Open' ?
      '<button class="btn compact danger" onclick="yearCloseDialog(\'' + y.ID + '\')">वर्ष बन्द</button>' : ''
    ) +
    '<div class="form-note">वर्षका वास्तविक AD सीमाहरू प्रविष्ट गर्नुहोस् । BS वर्षको नाम छुट्टै राख्न मिल्छ । बन्द अवधिसम्म: ' +
    esc(s.ClosedThrough || 'खुला') + '</div>' + (can(['SuperAdmin', 'Treasurer']) ?
      '<button class="btn secondary" onclick="periodLockDialog()">अवधि Lock गर्ने</button>' : '') + '</div>' +
    (can(['SuperAdmin']) ?
      '<div class="panel"><div class="panel-head"><h2>प्रयोगकर्ता</h2><button class="btn" onclick="userDialog()">＋ प्रयोगकर्ता</button></div>' +
      table(['Name', 'Username', 'Role', 'Active'], data('Users'), u =>
        '<button class="btn compact secondary" onclick="userDialog(\'' + u.ID + '\')">सम्पादन</button>') +
      '<button class="btn secondary" style="margin-top:20px" onclick="backup()">Drive मा Backup बनाउने</button></div>' :
      '');
}

function settingsDialog() {
  const s = state.boot.settings;
  modal('संस्थाको विवरण', '<div class="form-grid">' + ['Name', 'Address', 'Phone', 'Email', 'Registration',
      'LogoURL', 'GithubURL'
    ].map(k => field(k, ({
      Name: 'आधिकारिक नाम',
      Address: 'ठेगाना',
      Phone: 'फोन',
      Email: 'Gmail / इमेल',
      Registration: 'दर्ता नं.',
      LogoURL: 'GitHub Pages लोगोको HTTPS URL',
      GithubURL: 'GitHub Pages वेबसाइट URL'
    })[k], k === 'Email' ? 'email' : 'text', s[k] || '', !['LogoURL', 'GithubURL'].includes(k), ['Name',
      'Address', 'LogoURL'
    ].includes(k))).join('') +
    '</div><div class="form-note">लोगो URL उदाहरण: https://USERNAME.github.io/REPOSITORY/Kageshwori%20Mandir%20Logo.jpg</div>',
    d => run('settings.save', d));
}

function userDialog(id) {
  const u = data('Users').find(u => u.ID === id) || {};
  modal('प्रयोगकर्ता व्यवस्थापन', '<div class="form-grid">' + field('Name', 'पूरा नाम', 'text', u.Name ||
      '') + field('Username', 'Username', 'text', u.Username || '') + selectField('Role', 'भूमिका', [
      'SuperAdmin', 'Chairperson', 'Treasurer', 'Accountant', 'Auditor', 'Operator'
    ].map(v => [v, v]), u.Role || 'Accountant') + field('Password', id ?
      'नयाँ Password (खाली राखे पुरानै)' : 'Password (कम्तीमा 12 अक्षर)', 'password', '', !id) +
    selectField('Active', 'अवस्था', [
      ['true', 'Active'],
      ['false', 'Inactive']
    ], u.Active === false ? 'false' : 'true') + '</div>', d => run('user.save', {
      ...d,
      ID: id || '',
      Active: d.Active === 'true'
    }));
}

function periodLockDialog() {
  modal('अवधि बन्द गर्ने',
    '<div class="form-note">यो मितिसम्म नयाँ पोस्टिङ बन्द हुन्छ । UI बाट पुनः खोल्न मिल्दैन । पहिले Pending भौचर समाधान गर्नुहोस् ।</div>' +
    field('Date', 'बन्द गर्ने अन्तिम मिति', 'date', today()), d => run('period.lock', d), 'अवधि बन्द');
}

function yearCloseDialog(id) {
  const y = data('Years').find(y => y.ID === id);
  modal('आर्थिक वर्ष बन्द', '<div class="form-note">' + esc(y.Name) +
    ' का आय/व्यय सञ्चित कोषमा सारिन्छन् । अर्को वर्ष पहिल्यै सिर्जना हुनुपर्छ । मौज्दात स्वतः जारी रहन्छ; फेरि Opening भौचर नबनाउनुहोस् ।</div><label><input type="checkbox" required style="width:auto;min-height:0"> मैले सबै हिसाब जाँच गरेको छु ।</label>',
    () => run('year.close', {
      ID: id
    }), 'वर्ष बन्द गर्नुहोस्');
}
async function backup() {
  const result = await run('backup', {});
  if (result) toast('Backup तयार: ' + result.Name);
}

// ---------------- Report center / Unicode PDF / printing ----------------
function selectReport(kind) {
  state.reportKind = kind;
  navigate('reports');
}

function openLedger(id, kind) {
  state.reportKind = kind;
  navigate('reports');
  $('r_AccountID').value = id;
  loadReport();
}

function renderReports() {
  if (can(['Operator'])) state.reportKind = 'Bookings';
  $('main').innerHTML = heading('प्रतिवेदन केन्द्र', 'पोस्ट भएका कारोबार • नेपाली Unicode • Print तथा PDF') +
    '<div class="report-layout"><div class="panel report-menu">' + Object.keys(REPORTS).filter(k => !can([
      'Operator'
    ]) || k === 'Bookings').map(k => '<button class="' + (state.reportKind === k ? 'active' : '') +
      '" onclick="selectReport(\'' + k + '\')">' + REPORTS[k] + '</button>').join('') +
    '</div><div class="panel"><h2>' + REPORTS[state.reportKind] +
    '</h2><div class="form-grid three" style="margin-top:18px"><div class="field"><label>देखि (AD)</label><input id="r_From" type="date"></div><div class="field"><label>सम्म (AD)</label><input id="r_To" type="date" value="' +
    today() +
    '"></div><div class="field"><label>कोष</label><select id="r_FundID"><option value="">सबै कोष</option>' +
    options('Funds').map(f => '<option value="' + esc(f[0]) + '">' + esc(f[1]) + '</option>').join('') +
    '</select></div>' + (['Ledger', 'CashBook', 'BankBook'].includes(state.reportKind) ?
      '<div class="field"><label>खाता</label><select id="r_AccountID">' + options('Accounts', a => state
        .reportKind === 'CashBook' ? a.CashBank === 'Cash' : state.reportKind === 'BankBook' ? a.CashBank ===
        'Bank' : true).map(a => '<option value="' + esc(a[0]) + '">' + esc(a[1]) + '</option>').join('') +
      '</select></div>' : '') +
    '<div class="field"><label>Party</label><select id="r_PartyID"><option value="">सबै</option>' + options(
      'Parties').map(p => '<option value="' + esc(p[0]) + '">' + esc(p[1]) + '</option>').join('') +
    '</select></div>' + (state.reportKind === 'Budget' ?
      '<div class="field"><label>आर्थिक वर्ष</label><select id="r_YearID"><option value="">सबै वर्ष</option>' +
      options('Years').map(y => '<option value="' + esc(y[0]) + '">' + esc(y[1]) + '</option>').join('') +
      '</select></div>' : '') +
    '</div><div class="flex" style="margin:17px 0"><button class="btn" onclick="loadReport()">रिपोर्ट हेर्ने</button><button class="btn secondary" onclick="printReport()">Print</button><button class="btn secondary" onclick="pdfReport(false)">PDF हेर्ने</button><button class="btn secondary" onclick="pdfReport(true)">PDF डाउनलोड</button><button class="btn secondary" onclick="exportCSV()">Excel (CSV)</button></div><div id="reportResult"><div class="empty">अवधि छानेर रिपोर्ट हेर्नुहोस् ।</div></div></div></div>';
  state.report = null;
}
async function loadReport() {
  const filter = {
    Kind: state.reportKind,
    From: $('r_From').value,
    To: $('r_To').value,
    FundID: $('r_FundID').value,
    PartyID: $('r_PartyID').value,
    AccountID: $('r_AccountID')?.value,
    YearID: $('r_YearID')?.value
  };
  if (['IncomeExpense', 'CashFlow'].includes(filter.Kind) && !filter.From) {
    const y = data('Years').find(y => y.Status === 'Open' && y.Start <= today() && y.End >= today());
    if (y) {
      filter.From = y.Start;
      $('r_From').value = y.Start;
    }
  }
  $('reportResult').innerHTML = '<div class="empty">रिपोर्ट तयार भइरहेको छ…</div>';
  try {
    state.report = await rpc('report', filter);
    $('reportResult').innerHTML = reportHTML(state.report);
  } catch (error) {
    $('reportResult').textContent = error.message;
    toast(error.message, true);
  }
}

function reportBrand(s) {
  return '<div class="report-brand">' + (s.LogoURL ? '<img src="' + esc(s.LogoURL) +
      '" crossorigin="anonymous" alt="मन्दिर लोगो" onerror="this.hidden=true">' :
      '<div class="brand-logo">ॐ</div>') + '<div><h2>' + esc(s.Name) + '</h2><p>' + esc(s.Address) +
    '</p><p>जि.प्र.का. दर्ता नं. ' + esc(s.Registration) + '</p><p>Phone: ' + esc(s.Phone) + ' • Email: ' +
    esc(s.Email) + '</p></div></div>';
}

function reportHTML(r) {
  return reportBrand(r.Settings) + '<h3 style="text-align:center">' + esc(r.Kind === 'Voucher' ? r.Voucher
      .Type + ' • ' + r.Voucher.Number : REPORTS[r.Kind]) +
    '</h3><p class="small" style="text-align:center">' + esc(r.AccountName || '') + ' ' + esc(r.From ||
      'सुरुदेखि') + ' — ' + esc(r.To) + '</p>' + (r.Voucher ? '<p class="small">मिति: ' + esc(r.Voucher
        .Date) + ' • अवस्था: <b>' + esc(r.Voucher.Status) + '</b><br>' + esc(r.Voucher.Description) + '</p>' :
      '') + table(r.Columns, r.Rows) + '<div class="totals">' + Object.keys(r.Totals).map(k => '<span>' + esc(
      LABELS[k] || k) + ': <b>' + money(r.Totals[k]) + '</b></span>').join('') +
    '</div><div class="signature"><span>तयार गर्ने</span><span>जाँच गर्ने</span><span>स्वीकृत गर्ने</span></div>' +
    (r.Kind === 'Voucher' && r.Voucher.Status !== 'Posted' ?
      '<p style="text-align:center;color:#b33242">DRAFT — स्वीकृत / पोस्ट भएको छैन</p>' : '');
}
async function viewVoucher(id) {
  try {
    state.report = await rpc('report', {
      Kind: 'Voucher',
      ID: id
    });
    modal('भौचर विवरण',
      '<div class="flex" style="margin-bottom:15px"><button type="button" class="btn secondary" onclick="printReport()">Print</button><button type="button" class="btn secondary" onclick="pdfReport(false)">PDF हेर्ने</button><button type="button" class="btn secondary" onclick="pdfReport(true)">PDF डाउनलोड</button></div>' +
      reportHTML(state.report), () => {});
    $('saveButton').classList.add('hidden');
  } catch (error) {
    toast(error.message, true);
  }
}
async function printReport() {
  if (!state.report) return toast('पहिले रिपोर्ट हेर्नुहोस् ।', true);
  if (!state.report.Settings.LogoURL) return toast('पहिले Settings मा आधिकारिक लोगोको URL राख्नुहोस् ।',
    true);
  $('printRoot').innerHTML = reportHTML(state.report);
  try {
    await document.fonts.ready;
  } catch (_) {}
  await Promise.all([...$('printRoot').querySelectorAll('img')].map(img => img.complete ? Promise
    .resolve() : new Promise(resolve => {
      img.onload = resolve;
      img.onerror = resolve;
      setTimeout(resolve, 3000);
    })));
  window.print();
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('PDF library लोड भएन । इन्टरनेट जाँच गर्नुहोस् ।'));
    document.head.appendChild(s);
  });
}
async function pdfReport(download) {
  if (!state.report) return toast('पहिले रिपोर्ट हेर्नुहोस् ।', true);
  // Reserve a tab while user gesture is active; popup blockers cannot lose it.
  const tab = download ? null : window.open('about:blank', '_blank');
  if (tab) {
    tab.document.body.textContent = 'PDF तयार भइरहेको छ…';
  }
  $('loader').classList.remove('hidden');
  try {
    const base = new URL('.', window.location.href).href.replace(/\/$/, '');
    if (!window.pdfMake) await loadScript(base ? base + '/assets/pdfmake.min.js' :
      'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.12/pdfmake.min.js');
    if (!window.mandirFont) {
      const response = await fetch(base ? base + '/assets/Mukta-Regular.ttf' :
        'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/mukta/Mukta-Regular.ttf');
      if (!response.ok) throw new Error('नेपाली PDF Font लोड भएन ।');
      const bytes = new Uint8Array(await response.arrayBuffer());
      let binary = '';
      for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i +
        8192));
      pdfMake.vfs = {
        'Mandir.ttf': btoa(binary)
      };
      pdfMake.fonts = {
        Mandir: {
          normal: 'Mandir.ttf',
          bold: 'Mandir.ttf',
          italics: 'Mandir.ttf',
          bolditalics: 'Mandir.ttf'
        }
      };
      window.mandirFont = true;
    }
    const r = state.report,
      s = r.Settings;
    let logo;
    if (!s.LogoURL) throw new Error('पहिले Settings मा आधिकारिक लोगोको URL राख्नुहोस् ।');
    // Reliable image conversion through a same-origin/CORS image canvas.
    if (s.LogoURL) {
      try {
        logo = await logoDataURL(s.LogoURL);
      } catch (_) {
        throw new Error('लोगो लोड भएन । Settings मा सही सार्वजनिक GitHub Pages Logo URL राख्नुहोस् ।');
      }
    }
    const title = r.Kind === 'Voucher' ? r.Voucher.Type + ' • ' + r.Voucher.Number : REPORTS[r.Kind];
    const header = {
      columns: [...(logo ? [{
        image: logo,
        width: 52
      }] : []), {
        stack: [{
          text: s.Name,
          fontSize: 15,
          bold: true,
          color: '#762b39',
          alignment: 'center'
        }, {
          text: s.Address,
          fontSize: 9,
          alignment: 'center'
        }, {
          text: 'दर्ता नं. ' + s.Registration + ' • Phone: ' + s.Phone,
          fontSize: 9,
          alignment: 'center'
        }, {
          text: 'Email: ' + s.Email,
          fontSize: 9,
          alignment: 'center'
        }]
      }],
      columnGap: 10,
      margin: [0, 0, 0, 15]
    };
    const body = [r.Columns.map(c => ({
      text: LABELS[c] || c,
      bold: true,
      fillColor: '#f3e9eb'
    })), ...r.Rows.map(row => r.Columns.map(c => ({
      text: MONEY_COLUMNS.has(c) ? money(row[c]) : String(row[c] ?? ''),
      alignment: MONEY_COLUMNS.has(c) ? 'right' : 'left'
    })))];
    const definition = {
      pageSize: 'A4',
      pageOrientation: r.Columns.length > 7 ? 'landscape' : 'portrait',
      pageMargins: [28, 30, 28, 40],
      defaultStyle: {
        font: 'Mandir',
        fontSize: 9
      },
      header: page => page === 1 ? null : {
        text: s.Name + ' • ' + title,
        alignment: 'center',
        fontSize: 8,
        margin: [25, 12, 25, 0]
      },
      footer: (page, pages) => ({
        columns: [{
          text: s.Phone + ' • ' + s.Email
        }, {
          text: page + ' / ' + pages,
          alignment: 'right'
        }],
        margin: [28, 10, 28, 0],
        fontSize: 8
      }),
      content: [header, {
        text: title,
        bold: true,
        fontSize: 13,
        alignment: 'center',
        margin: [0, 0, 0, 5]
      }, {
        text: (r.From || 'सुरुदेखि') + ' — ' + r.To,
        alignment: 'center',
        margin: [0, 0, 0, 10]
      }, ...(r.Voucher ? [{
        text: 'मिति: ' + r.Voucher.Date + ' • ' + r.Voucher.Status + '\n' + r.Voucher.Description,
        margin: [0, 0, 0, 10]
      }] : []), {
        table: {
          headerRows: 1,
          widths: r.Columns.map(() => '*'),
          body
        },
        layout: 'lightHorizontalLines'
      }, {
        text: Object.keys(r.Totals).map(k => (LABELS[k] || k) + ': ' + money(r.Totals[k])).join(
          '   '),
        bold: true,
        alignment: 'right',
        margin: [0, 15, 0, 0]
      }, {
        columns: ['तयार गर्ने: __________', 'जाँच गर्ने: __________', 'स्वीकृत गर्ने: __________'],
        margin: [0, 45, 0, 0]
      }, ...(r.Voucher && r.Voucher.Status !== 'Posted' ? [{
        text: 'DRAFT — स्वीकृत / पोस्ट भएको छैन',
        alignment: 'center',
        color: '#b33242',
        margin: [0, 15, 0, 0]
      }] : [])]
    };
    const blob = await new Promise(resolve => pdfMake.createPdf(definition).getBlob(resolve));
    const url = URL.createObjectURL(blob);
    if (download) downloadBlob(blob, 'Kageshwori_' + r.Kind + '_' + today() + '.pdf');
    else if (tab) tab.location.href = url;
    else toast('Popup रोकिएको छ । PDF डाउनलोड बटन प्रयोग गर्नुहोस् ।', true);
  } catch (error) {
    if (tab) tab.close();
    toast(error.message, true);
  } finally {
    $('loader').classList.add('hidden');
  }
}

function logoDataURL(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 200;
        const context = canvas.getContext('2d');
        context.fillStyle = '#fff';
        context.fillRect(0, 0, 200, 200);
        context.drawImage(img, 0, 0, 200, 200);
        resolve(canvas.toDataURL('image/png'));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = reject;
    img.src = url;
  });
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function exportCSV() {
  if (!state.report) return toast('पहिले रिपोर्ट हेर्नुहोस् ।', true);
  const r = state.report;
  const quote = v => '"' + String(v ?? '').replace(/^[=+@\-]/, "'$&").replace(/"/g, '""') + '"';
  const rows = [r.Columns.map(c => LABELS[c] || c), ...r.Rows.map(row => r.Columns.map(c => MONEY_COLUMNS.has(
    c) ? Number(row[c] || 0) / 100 : row[c]))];
  downloadBlob(new Blob(['\ufeff' + rows.map(row => row.map(quote).join(',')).join('\r\n')], {
    type: 'text/csv;charset=utf-8'
  }), 'Kageshwori_' + r.Kind + '_' + today() + '.csv');
}
// ---------------- Public content administration ----------------
let publicAdminData = null;
let editorSelection = null;

async function renderPublicAdmin() {
  if (!can(['SuperAdmin'])) return;
  $('main').innerHTML = heading('सार्वजनिक वेबसाइट', 'सबै विवरण Google Sheet मा सुरक्षित हुन्छन् ।') +
    '<div class="panel">लोड हुँदैछ…</div>';
  try {
    publicAdminData = await rpc('public.admin.bootstrap');
    const d = publicAdminData;
    const reviewButtons = (tableName, row) =>
      '<button class="btn compact secondary" onclick="publicReview(\'' + tableName + '\',\'' + row.ID +
      '\')">समीक्षा</button>' +
      (tableName === 'PublicBookings' && !row.AccountingBookingID ?
        '<button class="btn compact light" onclick="convertPublicBooking(\'' + row.ID +
        '\')">लेखामा बुकिङ</button>' : '');
    $('main').innerHTML = heading('सार्वजनिक वेबसाइट',
        'परिचय, सूचना, फोटो, समय, बुकिङ र सार्वजनिक तथ्याङ्क') +
      '<div class="panel" style="margin-bottom:20px"><div class="panel-head"><h2>मन्दिर तथा मुख्य पेज</h2><button class="btn" onclick="publicSettingsDialog()">सम्पादन</button></div><p>' +
      esc(d.Settings.Name) + '</p><p class="muted">' + esc(d.Settings.Address) +
      '</p><p class="small muted">परिचयको डिजाइन, फोटो, स्थान र सार्वजनिक संख्या यहीँबाट सेट गर्नुहोस् ।</p></div>' +
      publicAdminPanel('PublicServices', 'पूजा / बुकिङ सेवाहरू', ['Name', 'Description', 'Active']) +
      publicAdminPanel('PublicNotices', 'सूचना तथा महत्त्वपूर्ण Marquee', ['Title', 'Date', 'Important',
        'Active'
      ]) +
      publicAdminPanel('PublicPhotos', 'मन्दिर फोटो संग्रह', ['Title', 'ImageURL', 'Active']) +
      '<div class="panel" style="margin-bottom:20px"><h2>खुल्ने र बन्द हुने समय</h2>' + table(['Day',
          'OpenTime', 'CloseTime', 'Closed', 'Note'
        ], d.PublicHours, row =>
        '<button class="btn compact secondary" onclick="publicEntityDialog(\'PublicHours\',\'' + row.ID +
        '\')">सम्पादन</button>') +
      '<p class="small muted">Day: 0 आइतबार, 1 सोमबार, …, 6 शनिबार । राति पार हुने समय पनि समर्थित छ ।</p></div>' +
      '<div class="panel" style="margin-bottom:20px"><h2>सार्वजनिक बुकिङ अनुरोध</h2>' + table(['Name',
        'Phone', 'Service', 'EventDate', 'Message', 'Status'
      ], d.PublicBookings.slice().reverse(), row => reviewButtons('PublicBookings', row)) + '</div>' +
      '<div class="panel"><h2>सुझावहरू</h2>' + table(['Name', 'Phone', 'Message', 'At', 'Status'], d
        .PublicSuggestions.slice().reverse(), row => reviewButtons('PublicSuggestions', row)) + '</div>';
  } catch (e) {
    $('main').innerHTML = heading('सार्वजनिक वेबसाइट', '') + '<div class="panel">' + esc(e.message) +
      '<p>पहिले Apps Script Editor बाट setupPublicWebsite चलाउनुहोस् ।</p></div>';
  }
}

function publicAdminPanel(tableName, title, columns) {
  return '<div class="panel" style="margin-bottom:20px"><div class="panel-head"><h2>' + title +
    '</h2><button class="btn secondary" onclick="publicEntityDialog(\'' + tableName +
    '\')">＋ थप्ने</button></div>' + table(columns, publicAdminData[tableName], row =>
      '<button class="btn compact secondary" onclick="publicEntityDialog(\'' + tableName + '\',\'' + row.ID +
      '\')">सम्पादन</button>') + '</div>';
}

function publicToggle(key, label, value) {
  return selectField(key, label, [
    ['true', 'देखाउने / खुला'],
    ['false', 'लुकाउने / बन्द']
  ], String(value || 'false'));
}

function publicSettingsDialog() {
  editorSelection = null;
  const s = publicAdminData.Settings;
  const body = '<div class="form-grid">' + ['Name', 'Address', 'Phone', 'Email', 'Registration', 'Heading',
      'Tagline', 'LogoURL', 'HeroPhotoURL', 'LocationLabel', 'Latitude', 'Longitude', 'MapURL'
    ].map(k => field(k, ({
      Name: 'मन्दिरको आधिकारिक नाम',
      Address: 'ठेगाना',
      Phone: 'सम्पर्क नम्बर',
      Email: 'इमेल',
      Registration: 'दर्ता नं.',
      Heading: 'मुख्य Heading',
      Tagline: 'छोटो परिचय / स्लोगन',
      LogoURL: 'लोगोको HTTPS URL',
      HeroPhotoURL: 'मुख्य मन्दिर फोटो URL',
      LocationLabel: 'स्थानको विवरण',
      Latitude: 'Latitude',
      Longitude: 'Longitude',
      MapURL: 'नक्साको HTTPS लिंक'
    })[k], k === 'Email' ? 'email' : 'text', s[k] || '', false, ['Name', 'Heading', 'Tagline', 'LogoURL',
      'HeroPhotoURL', 'MapURL'
    ].includes(k))).join('') +
    selectField('TempleStatus', 'अहिले खुला / बन्द', ['Auto', 'Open', 'Closed'].map(v => [v, v]), s
      .TempleStatus || 'Auto') +
    field('StatusNote', 'समयसम्बन्धी थप सूचना', 'text', s.StatusNote || '', false) +
    publicToggle('BookingEnabled', 'सार्वजनिक बुकिङ', s.BookingEnabled) + publicToggle('SuggestionsEnabled',
      'सुझाव फारम', s.SuggestionsEnabled) + publicToggle('MarqueeEnabled', 'महत्त्वपूर्ण सूचना Marquee', s
      .MarqueeEnabled) +
    field('MetricsMonth', 'तथ्याङ्कको महिना / अवधि', 'text', s.MetricsMonth || '', false) + field(
      'MonthlyIncome', 'मासिक आम्दानी (रु.)', 'number', s.MonthlyIncome || '0') + field('MonthlyExpense',
      'मासिक खर्च (रु.)', 'number', s.MonthlyExpense || '0') + field('TotalBookings', 'कुल बुकिङ', 'number', s
      .TotalBookings || '0') +
    publicToggle('ShowIncome', 'आम्दानी सार्वजनिक?', s.ShowIncome) + publicToggle('ShowExpense',
      'खर्च सार्वजनिक?', s.ShowExpense) + publicToggle('ShowBookings', 'कुल बुकिङ सार्वजनिक?', s
      .ShowBookings) + publicToggle('ShowViews', 'Public Views देखाउने?', s.ShowViews) +
    '</div><div class="form-note">सार्वजनिक मासिक तथ्याङ्क Admin ले प्रविष्ट गरेको संख्या हो । यसले Accounting Ledger परिवर्तन गर्दैन । लुकाएको वित्तीय तथ्याङ्क public API मा पनि पठाइँदैन ।</div>' +
    richEditorMarkup(s.IntroductionHTML || '');
  modal('सार्वजनिक मुख्य पेज व्यवस्थापन', body, values => {
    normalizeEditorFonts();
    values.IntroductionHTML = $('richEditor').innerHTML;
    return run('public.admin.save', {
      Kind: 'Settings',
      Record: values
    });
  });
  $('richEditor').addEventListener('keyup', rememberEditorSelection);
  $('richEditor').addEventListener('mouseup', rememberEditorSelection);
  $('richEditor').addEventListener('paste', () => setTimeout(normalizeEditorFonts, 0));
}

function richEditorMarkup(html) {
  return '<h3 style="margin-top:25px">मन्दिर परिचय — Rich Text Editor</h3><div class="flex" style="padding:12px;border:1px solid #dedbd5;background:#f7f4ef;border-radius:10px 10px 0 0;margin-top:10px" id="editorToolbar">' +
    [
      ['bold', 'B'],
      ['italic', 'I'],
      ['underline', 'U'],
      ['justifyLeft', 'Left'],
      ['justifyCenter', 'Center'],
      ['justifyRight', 'Right'],
      ['justifyFull', 'Justify'],
      ['insertUnorderedList', '• सूची'],
      ['insertOrderedList', '1. सूची'],
      ['undo', '↶'],
      ['redo', '↷']
    ].map(([cmd, label]) =>
      '<button type="button" class="btn compact secondary" onmousedown="event.preventDefault()" onclick="editorCommand(\'' +
      cmd + '\')">' + label + '</button>').join('') +
    '<label style="margin:0">Font Size <select style="width:90px;min-height:34px;padding:4px" onchange="editorSize(this.value)">' +
    [12, 14, 16, 18, 20, 24, 28, 32, 40, 48].map(n => '<option ' + (n === 18 ? 'selected' : '') + '>' + n +
      '</option>').join('') +
    '</select></label><label style="margin:0">रङ <input type="color" value="#30272a" style="width:45px;padding:3px;min-height:34px" onchange="editorCommand(\'foreColor\',this.value)"></label></div><div id="richEditor" contenteditable="true" role="textbox" aria-label="मन्दिर परिचय" aria-multiline="true" style="min-height:230px;max-height:500px;overflow:auto;padding:20px;border:1px solid #dedbd5;border-top:0;border-radius:0 0 10px 10px;font-size:18px;line-height:1.8;outline:none">' +
    html +
    '</div><div class="small muted" style="margin-top:8px">यो formatting सार्वजनिक परिचयमा कायम रहन्छ । Word बाट paste गर्न मिल्छ; script/link/image जस्ता सामग्री हटाइन्छन् ।</div>';
}

function rememberEditorSelection() {
  const selection = window.getSelection();
  if (selection.rangeCount && $('richEditor').contains(selection.anchorNode)) editorSelection = selection
    .getRangeAt(0).cloneRange();
}

function restoreEditorSelection() {
  $('richEditor').focus();
  if (editorSelection) {
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(editorSelection);
  }
}

function editorCommand(command, value = null) {
  restoreEditorSelection();
  document.execCommand('styleWithCSS', false, true);
  document.execCommand(command, false, value);
  rememberEditorSelection();
}

function editorSize(size) {
  restoreEditorSelection();
  document.execCommand('styleWithCSS', false, false);
  document.execCommand('fontSize', false, '7');
  $('richEditor').querySelectorAll('font[size="7"]').forEach(font => {
    const span = document.createElement('span');
    span.style.fontSize = Number(size) + 'px';
    span.innerHTML = font.innerHTML;
    font.replaceWith(span);
  });
  rememberEditorSelection();
}

function normalizeEditorFonts() {
  $('richEditor').querySelectorAll('font').forEach(font => {
    const span = document.createElement('span');
    if (font.color) span.style.color = font.color;
    const sizes = {
      1: 10,
      2: 13,
      3: 16,
      4: 18,
      5: 24,
      6: 32,
      7: 48
    };
    if (font.size) span.style.fontSize = (sizes[font.size] || 18) + 'px';
    span.innerHTML = font.innerHTML;
    font.replaceWith(span);
  });
}

function publicEntityDialog(tableName, id) {
  const row = publicAdminData[tableName].find(r => r.ID === id) || {};
  let body = '';
  if (tableName === 'PublicHours') {
    body = field('OpenTime', 'खुल्ने समय', 'time', row.OpenTime || '', false) + field('CloseTime',
      'बन्द हुने समय', 'time', row.CloseTime || '', false) + selectField('Closed', 'पूरै दिन बन्द?', [
      ['false', 'होइन'],
      ['true', 'हो']
    ], String(row.Closed || false)) + field('Note', 'थप सूचना', 'text', row.Note || '', false);
  } else {
    const nameKey = tableName === 'PublicServices' ? 'Name' : 'Title';
    body = field(nameKey, 'नाम / शीर्षक', 'text', row[nameKey] || '') + (tableName !== 'PublicServices' ?
        field('ImageURL', 'फोटोको HTTPS URL', 'text', row.ImageURL || '', tableName === 'PublicPhotos') : ''
      ) +
      (tableName !== 'PublicPhotos' ?
        '<div class="field full"><label>विवरण</label><textarea name="Description">' + esc(row.Description ||
          '') + '</textarea></div>' : '') +
      (tableName === 'PublicNotices' ? field('Date', 'सूचना मिति (AD)', 'date', row.Date || today()) +
        selectField('Important', 'Marquee मा देखाउने?', [
          ['false', 'होइन'],
          ['true', 'हो']
        ], String(row.Important || false)) : '') +
      field('Sort', 'Display क्रम', 'number', row.Sort || '0') + selectField('Active', 'प्रकाशित / लुकाउने', [
        ['true', 'प्रकाशित'],
        ['false', 'लुकाउने']
      ], String(row.Active === undefined ? true : row.Active));
  }
  modal('सार्वजनिक विवरण', '<div class="form-grid">' + body + '</div>', values => {
    ['Active', 'Important', 'Closed'].forEach(k => {
      if (values[k] !== undefined) values[k] = values[k] === 'true';
    });
    return run('public.admin.save', {
      Kind: tableName,
      Record: {
        ...values,
        ID: id || ''
      }
    });
  });
}

function publicReview(tableName, id) {
  const row = publicAdminData[tableName].find(r => r.ID === id);
  modal('अनुरोध समीक्षा', '<p>' + esc(row.Name) + ' • ' + esc(row.Phone) + '</p><p>' + esc(row.Message ||
    '') + '</p>' + selectField('Status', 'अवस्था', ['New', 'Reviewed', 'Accepted', 'Rejected', 'Closed']
    .map(v => [v, v]), row.Status), values => run('public.admin.save', {
    Kind: tableName,
    Record: {
      ID: id,
      Status: values.Status
    }
  }));
}

function convertPublicBooking(id) {
  const b = publicAdminData.PublicBookings.find(r => r.ID === id);
  modal('अनुरोधलाई लेखा बुकिङमा जोड्ने', '<p>' + esc(b.Name) + ' • ' + esc(b.Service) + ' • ' + esc(b
      .EventDate) + '</p><div class="form-grid">' + field('Amount', 'कुल शुल्क (रु.)', 'number') + field(
      'Advance', 'वास्तविक प्राप्त अग्रिम (रु.)', 'number', '0') + field('Date', 'अग्रिम प्राप्त मिति',
      'date', today()) + cashField() + funds() + selectField('PartyID', 'सेवाग्राही', [
      ['', 'छान्नुहोस्'], ...options('Parties')
    ], '', false) +
    '</div><div class="form-note">वास्तवमा प्राप्त भएको अग्रिम मात्र राख्नुहोस् । अग्रिमको भौचर छुट्टै स्वीकृत गर्नुपर्छ ।</div>',
    values => run('public.booking.convert', {
      ...values,
      ID: id
    }));
}

if (state.token) refresh();
