const $ = id => document.getElementById(id);
let payload, formKind, challengeToken, formRequestID;
let visitor;
try {
  visitor = localStorage.getItem('mandirVisitor');
} catch (_) {}
if (!visitor) {
  visitor = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36)
    .slice(2) + Math.random().toString(36).slice(2);
  try {
    localStorage.setItem('mandirVisitor', visitor);
  } catch (_) {}
}
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
} [c]));
const cleanText = v => String(v || '').replace(/\s*।/g, ' ।');
const shown = v => v === true || v === 'true';
const rupees = v => 'रु. ' + Number(v || 0).toLocaleString('en-IN', {
  maximumFractionDigits: 2
});

function request(action, data = {}) {
  return MandirAPI.send('public', {
      action,
      data: {
        ...data,
        VisitorID: visitor
      }
    })
    .then(response => {
      if (!response.ok) throw new Error(response.error || 'अनुरोध असफल भयो ।');
      return response.data;
    });
}

function txt(id, value) {
  $(id).textContent = cleanText(value);
  $(id).classList.remove('skeleton');
}

function safeURL(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' ? u.href : '';
  } catch (_) {
    return '';
  }
}

function image(id, url) {
  const value = safeURL(url);
  if (value) {
    $(id).src = value;
    $(id).classList.remove('hidden');
    $(id).onerror = () => $(id).classList.add('hidden');
  }
}

function applyContent(p) {
  payload = p;
  const s = p.Settings;
  ['name', 'footerName', 'accountTitle', 'introTitle'].forEach(id => txt(id, s.Name));
  ['address', 'stripAddress', 'footerAddress', 'introAddress'].forEach(id => txt(id, s.Address));
  txt('heroEyebrow', s.Heading || s.Name);
  txt('heading', s.Heading || s.Name);
  txt('tagline', s.Tagline);
  txt('stripContact', [s.Phone, s.Email].filter(Boolean).join(' • '));
  txt('footerContact', [s.Phone, s.Email].filter(Boolean).join(' • '));
  txt('footerRegistration', s.Registration ? 'दर्ता नं. ' + s.Registration : '');
  image('logo', s.LogoURL);
  image('heroPhoto', s.HeroPhotoURL || p.Photos[0]?.ImageURL);
  if (!$('heroPhoto').classList.contains('hidden')) $('photoPlaceholder').classList.add('hidden');
  $('introductionText').classList.remove('skeleton');
  $('introductionText').innerHTML = s.IntroductionHTML || '<p class="muted">परिचय विवरण थपिन बाँकी छ ।</p>';
  const status = p.Status === 'Open' ? 'मन्दिर अहिले खुला छ ।' : p.Status === 'Closed' ?
    'मन्दिर अहिले बन्द छ ।' : 'दर्शनको समयका लागि सम्पर्क गर्नुहोस् ।';
  txt('statusText', status);
  $('statusDot').className = 'dot ' + (p.Status === 'Open' ? 'open' : p.Status === 'Closed' ? 'closed' : '');
  txt('statusNote', s.StatusNote);
  const notices = p.Notices.slice().sort((a, b) => String(b.Date).localeCompare(String(a.Date)) || Number(a
    .Sort) - Number(b.Sort));
  const important = notices.filter(n => shown(n.Important));
  $('ribbon').classList.toggle('hidden', !shown(s.MarqueeEnabled) || !important.length);
  txt('marquee', important.map(n => n.Title).join('     ◆     '));
  txt('noticeCount', notices.length ? notices.length + ' सूचना' : '');
  $('noticeCards').innerHTML = notices.length ? notices.map(n => '<article class="notice-card">' + (safeURL(n
        .ImageURL) ? '<img src="' + esc(n.ImageURL) + '" loading="lazy" decoding="async" alt="' + esc(n
        .Title) + '" onerror="this.hidden=true">' : '') +
      '<div class="notice-card-body"><div class="notice-date">' + esc(n.Date) + (shown(n.Important) ?
        ' <span class="notice-tag">महत्त्वपूर्ण</span>' : '') + '</div><h3>' + esc(cleanText(n.Title)) +
      '</h3><p>' + esc(cleanText(n.Description)) + '</p></div></article>').join('') :
    '<p class="muted">हाल कुनै सूचना प्रकाशित गरिएको छैन ।</p>';
  $('bookHero').classList.toggle('hidden', !shown(s.BookingEnabled));
  $('serviceCards').innerHTML = p.Services.length ? p.Services.map((service, i) =>
      '<article class="service-card"><div class="service-number">' + String(i + 1).padStart(2, '0') +
      '</div><h3>' + esc(service.Name) + '</h3><p>' + esc(cleanText(service.Description)) + '</p>' + (shown(s
          .BookingEnabled) ? '<button onclick="openForm(\'booking\',\'' + esc(service.ID) +
        '\')">बुकिङ अनुरोध →</button>' : '') + '</article>').join('') :
    '<p class="muted">सेवाको जानकारीका लागि समितिमा सम्पर्क गर्नुहोस् ।</p>';
  $('gallery').classList.toggle('hidden', !p.Photos.length);
  $('galleryCards').innerHTML = p.Photos.filter(ph => safeURL(ph.ImageURL)).map(ph => '<figure><img src="' +
    esc(ph.ImageURL) + '" loading="lazy" decoding="async" alt="' + esc(ph.Title) + '"><figcaption>' + esc(ph
      .Title) + '</figcaption></figure>').join('');
  const days = ['आइतबार', 'सोमबार', 'मङ्गलबार', 'बुधबार', 'बिहीबार', 'शुक्रबार', 'शनिबार'];
  $('hours').innerHTML = p.Hours.sort((a, b) => Number(a.Day) - Number(b.Day)).map(h =>
    '<div class="hours-row"><span>' + days[Number(h.Day)] + '</span><span>' + esc(shown(h.Closed) ? 'बन्द' :
      h.OpenTime && h.CloseTime ? h.OpenTime + ' – ' + h.CloseTime : 'समय थपिन बाँकी') + (h.Note ? ' • ' +
      esc(h.Note) : '') + '</span></div>').join('');
  $('contactDetails').innerHTML = [
    ['ठेगाना', s.LocationLabel || s.Address],
    ['फोन', s.Phone],
    ['इमेल', s.Email]
  ].filter(v => v[1]).map(v => '<div class="contact-line"><small>' + v[0] + '</small><b>' + esc(v[1]) +
    '</b></div>').join('');
  let map = safeURL(s.MapURL);
  const lat = Number(s.Latitude),
    lon = Number(s.Longitude);
  if (s.Latitude && s.Longitude && Number.isFinite(lat) && Number.isFinite(lon)) {
    const query = encodeURIComponent(lat + ',' + lon);
    map = map || 'https://www.google.com/maps?q=' + query;
    $('mapFrame').src = 'https://maps.google.com/maps?q=' + query + '&z=16&output=embed';
    $('mapFrame').classList.remove('hidden');
  }
  if (map) {
    $('mapLink').href = map;
    $('mapLink').classList.remove('hidden');
  }
  $('suggestionBand').classList.toggle('hidden', !shown(s.SuggestionsEnabled));
  const metrics = [];
  if (shown(s.ShowIncome)) metrics.push(['मासिक आम्दानी' + (s.MetricsMonth ? ' • ' + s.MetricsMonth : ''),
    rupees(s.MonthlyIncome)
  ]);
  if (shown(s.ShowExpense)) metrics.push(['मासिक खर्च' + (s.MetricsMonth ? ' • ' + s.MetricsMonth : ''),
    rupees(s.MonthlyExpense)
  ]);
  if (shown(s.ShowBookings)) metrics.push(['कुल बुकिङ', Number(s.TotalBookings || 0).toLocaleString(
    'en-IN')]);
  if (shown(s.ShowViews)) metrics.push(['सार्वजनिक Views', Number(p.Views || 0).toLocaleString('en-IN')]);
  $('overview').classList.toggle('hidden', !metrics.length);
  $('metrics').style.gridTemplateColumns = 'repeat(' + Math.min(metrics.length, window.innerWidth < 820 ? 2 :
    4) + ',1fr)';
  $('metrics').innerHTML = metrics.map(m => '<div class="overview-cell"><small>' + esc(m[0]) + '</small><b>' +
    esc(m[1]) + '</b></div>').join('');
  $('viewCount').classList.toggle('hidden', !shown(s.ShowViews));
  txt('viewCount', 'Views: ' + Number(p.Views || 0).toLocaleString('en-IN'));
  document.title = s.Name || 'मन्दिर';
}

function pauseMarquee() {
  const paused = $('marquee').style.animationPlayState === 'paused';
  $('marquee').style.animationPlayState = paused ? 'running' : 'paused';
  $('pauseButton').textContent = paused ? 'Ⅱ' : '▶';
}

function openAccount() {
  const frame = $('accountFrame');
  if (!frame.getAttribute('src')) frame.src = './account.html';
  $('accountView').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeAccount() {
  $('accountView').classList.add('hidden');
  document.body.style.overflow = '';
}
async function openForm(kind, serviceID = '') {
  if (!payload) return;
  formKind = kind;
  formRequestID = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random()
    .toString(36).slice(2) + Math.random().toString(36).slice(2);
  $('formTitle').textContent = kind === 'booking' ? 'पूजा बुकिङ अनुरोध' : 'सुझाव पठाउनुहोस्';
  const input = (name, label, type = 'text', required = true) => '<div><label for="p_' + name + '">' +
    label + '</label><input name="' + name + '" id="p_' + name + '" type="' + type + '" ' + (required ?
      'required' : '') + ' maxlength="150"></div>';
  $('formFields').innerHTML = input('Name', 'पूरा नाम') + input('Phone', 'फोन नम्बर', 'tel', kind ===
      'booking') + (kind === 'booking' ? '<div><label>सेवा</label><select name="ServiceID" required>' +
      payload.Services.map(s => '<option value="' + esc(s.ID) + '" ' + (s.ID === serviceID ? 'selected' :
        '') + '>' + esc(s.Name) + '</option>').join('') + '</select></div>' + input('EventDate',
        'पूजा मिति (AD)', 'date') : '') +
    '<div class="full"><label>विवरण / सुझाव</label><textarea name="Message" maxlength="2000" ' + (kind ===
      'suggestion' ? 'required' : '') +
    '></textarea></div><div><label id="challengeQuestion">सुरक्षा प्रश्न लोड हुँदैछ…</label><input name="Answer" type="number" required></div>';
  $('formMessage').textContent = '';
  $('submitButton').disabled = true;
  $('submitButton').classList.remove('hidden');
  $('formDialog').showModal();
  try {
    const c = await request('challenge');
    challengeToken = c.Token;
    txt('challengeQuestion', c.Question);
    $('submitButton').disabled = false;
  } catch (e) {
    $('formMessage').textContent = e.message;
  }
}
$('publicForm').onsubmit = async e => {
  e.preventDefault();
  $('submitButton').disabled = true;
  $('formMessage').textContent = 'पठाइँदैछ…';
  try {
    const d = Object.fromEntries(new FormData(e.target));
    const r = await request(formKind, {
      ...d,
      ChallengeToken: challengeToken,
      RequestID: formRequestID
    });
    $('formMessage').textContent = r.Message + ' Reference: ' + r.Reference;
    e.target.reset();
    $('submitButton').classList.add('hidden');
  } catch (error) {
    $('formMessage').textContent = error.message;
    $('submitButton').disabled = false;
  }
};
async function load() {
  try {
    const p = await request('bootstrap');
    applyContent(p);
    request('visit').then(v => {
      p.Views = v.Views;
      applyContent(p);
    }).catch(() => {});
  } catch (e) {
    txt('heading', 'विवरण लोड हुन सकेन ।');
    txt('tagline', e.message);
  }
}
load();
