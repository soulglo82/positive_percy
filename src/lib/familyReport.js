// Parent-friendly, printable Family Report (A4 PDF).
// Uses the family's existing authenticated JSON export, then renders in the
// browser using its own fonts (so children's international names are preserved).
// A PDF is generated locally; no data is sent to an additional service.

const A4 = { width: 595.28, height: 841.89 };
const PAGE = { width: 794, height: 1123 };
const REPORT_DAYS = 30;
const MAX_PAGES = 80;

function safe(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
function num(value) { return Number(value || 0); }
function localDay(at, timezone) {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const v = Object.fromEntries(parts.filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
  return v.year + '-' + v.month + '-' + v.day;
}
function prettyDate(at, timezone, long = false) {
  if (!at) return '';
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone, day: 'numeric', month: 'short',
    ...(long ? { year: 'numeric' } : {}),
  }).format(date);
}
function weekBeginning(localDate) {
  const d = new Date(localDate + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7);
  return d.toISOString().slice(0, 10);
}
function truncate(value, limit = 160) {
  const s = String(value ?? '');
  return s.length > limit ? s.slice(0, limit - 1) + '…' : s;
}
function chunk(values, count) {
  const out = [];
  for (let i = 0; i < values.length; i += count) out.push(values.slice(i, i + count));
  return out;
}

export function buildFamilyReportModel(data, at = new Date()) {
  const timezone = data?.family?.timezone || 'UTC';
  const localToday = localDay(at, timezone);
  const weekStart = weekBeginning(localToday);
  const since = new Date(at).getTime() - REPORT_DAYS * 86400000;
  const undone = new Set((data.pointEvents || []).filter(e => e.reverses_id).map(e => String(e.reverses_id)));

  const effective = (data.pointEvents || []).filter(e =>
    e.kind === 'award' &&
    !undone.has(String(e.id)) &&
    !['starting points', 'balance correction', 'undo'].includes(String(e.category || '').trim().toLowerCase())
  );
  const earned = effective.filter(e => Number(e.points) > 0);
  const completed = (data.redemptions || []).filter(r =>
    r.status === 'Completed' && !r.reversed_at
  );
  const eventsInRange = (data.pointEvents || []).filter(e =>
    new Date(e.created_date).getTime() >= since
  );
  const redemptionsInRange = (data.redemptions || []).filter(r =>
    new Date(r.created_date).getTime() >= since
  );

  const children = (data.children || []).map(child => {
    const childEarned = earned.filter(e => e.child_id === child.id);
    const allEffective = effective.filter(e => e.child_id === child.id);
    const weekly = allEffective
      .filter(e => localDay(e.created_date, timezone) >= weekStart)
      .reduce((n, e) => n + num(e.points), 0);
    const claimed = completed.filter(r => r.child_id === child.id);
    const cat = new Map();
    for (const event of childEarned) {
      cat.set(event.category, (cat.get(event.category) || 0) + num(event.points));
    }
    const topCategories = [...cat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    const activity = [
      ...eventsInRange.filter(e => e.child_id === child.id).map(e => {
        const isUndo = e.kind === 'undo';
        const isStarting = e.kind === 'starting';
        const reversed = undone.has(String(e.id));
        return {
          id: e.id, created: e.created_date,
          label: isUndo ? 'Award corrected' : isStarting ? 'Starting balance'
            : e.kind === 'correction' ? 'Balance correction'
            : num(e.points) < 0 ? 'Earlier adjustment' : 'Points awarded',
          detail: e.category + (e.note ? ' · ' + e.note : '') + (reversed ? ' (corrected)' : ''),
          points: (num(e.points) > 0 ? '+' : '') + num(e.points), reversed,
        };
      }),
      ...redemptionsInRange.filter(r => r.child_id === child.id).map(r => ({
        id: r.id, created: r.created_date,
        label: r.status === 'Completed' && !r.reversed_at ? 'Reward claimed'
          : r.reversed_at ? 'Reward reversed' : 'Reward ' + r.status.toLowerCase(),
        detail: r.reward_title,
        points: r.status === 'Completed' && !r.reversed_at ? '-' + r.reward_cost : '—',
        reversed: Boolean(r.reversed_at),
      })),
    ].sort((a, b) => new Date(b.created) - new Date(a.created));
    return {
      ...child,
      weekPoints: Math.max(0, weekly),
      lifetimeEarned: childEarned.reduce((n, e) => n + num(e.points), 0),
      claimedRewards: claimed,
      topCategories,
      activity,
    };
  });

  return {
    familyName: data?.family?.family_name || 'Our family',
    timezone, localToday, weekStart, reportDate: prettyDate(at, timezone, true),
    children,
    behaviours: data.behaviours || [],
    rewards: data.rewards || [],
    totalBalance: children.reduce((n, c) => n + num(c.total_points), 0),
    totalWeeklyEarned: children.reduce((n, c) => n + c.weekPoints, 0),
    totalClaimed: completed.length,
    activityDays: REPORT_DAYS,
  };
}

const metric = (label, value) =>
  '<div class="pp-metric"><div class="pp-metric-number">' + safe(value) +
  '</div><div class="pp-metric-label">' + safe(label) + '</div></div>';
const section = (title, html) =>
  '<section class="pp-section"><div class="pp-section-title">' + safe(title) +
  '</div>' + html + '</section>';
const empty = (message) => '<div class="pp-empty">' + safe(message) + '</div>';
const row = (left, right, smaller = '') =>
  '<div class="pp-row"><div class="pp-row-text"><b>' + safe(left) +
  '</b>' + (smaller ? '<small>' + safe(smaller) + '</small>' : '') +
  '</div><div class="pp-row-right">' + safe(right) + '</div></div>';

function pageDescriptions(model) {
  const pages = [];
  const kids = model.children;
  const overview = chunk(kids, 6);
  (overview.length ? overview : [[]]).forEach((portion, i) => {
    const familyRows = portion.length
      ? portion.map(c => row(c.name, num(c.total_points) + ' points',
          c.weekPoints + ' earned this week · ' + c.claimedRewards.length + ' rewards claimed')).join('')
      : empty('Add a child to start building your family story.');
    const intro = i === 0
      ? '<div class="pp-hero"><div class="pp-hero-kicker">YOUR FAMILY STORY</div>' +
        '<div class="pp-hero-title">' + safe(model.familyName) + '</div>' +
        '<div class="pp-hero-copy">Small acts of kindness, effort and progress deserve celebrating.</div></div>' +
        '<div class="pp-metrics">' +
          metric('Current family points', model.totalBalance) +
          metric('Earned this week', model.totalWeeklyEarned) +
          metric('Rewards claimed', model.totalClaimed) +
        '</div>'
      : '';
    pages.push({
      heading: i === 0 ? 'Our family’s achievements' : 'Our family · continued',
      subtitle: 'A snapshot of your family’s Positive Percy journey',
      html: intro + section('Our children', familyRows) +
        (i === 0 ? '<div class="pp-note">Weekly points are counted from Monday in your family’s timezone. ' +
          'The activity pages cover the past 30 days; the technical data export contains the full history.</div>' : ''),
    });
  });

  for (const child of kids) {
    const claimed = child.claimedRewards.slice(-3).reverse().map(r =>
      row(r.reward_title, prettyDate(r.created_date, model.timezone))).join('');
    const badges = (child.badges_earned || []).map(b => String(b));
    const badgeDisplay = badges.slice(0, 6).map(b =>
      '<span class="pp-pill">' + safe(b) + '</span>').join('');
    const categoryRows = child.topCategories.map(c => row(c[0], c[1] + ' points')).join('');
    const target = num(child.weekly_target);
    const pct = target > 0 ? Math.max(0, Math.min(100, child.weekPoints / target * 100)) : 0;
    const targetLabel = target > 0
      ? child.weekPoints + ' of ' + target + ' points towards this week’s target'
      : 'No weekly target set';
    pages.push({
      heading: child.name,
      subtitle: 'Individual achievement summary',
      html: '<div class="pp-metrics">' +
          metric('Current balance', num(child.total_points)) +
          metric('Earned this week', child.weekPoints) +
          metric('Rewards claimed', child.claimedRewards.length) +
        '</div>' +
        section('This week’s progress',
          '<div class="pp-progress"><div style="width:' + pct + '%"></div></div>' +
          '<div class="pp-helper">' + safe(targetLabel) + '</div>') +
        section('Where points came from', categoryRows ||
          empty('Earned points will appear here as they are awarded.')) +
        section('Achievements', badgeDisplay
          ? '<div class="pp-pills">' + badgeDisplay + '</div>' +
            (badges.length > 6 ? '<div class="pp-helper">+' + (badges.length - 6) + ' more badges</div>' : '')
          : empty('Milestones and badges will appear here.')) +
        section('Recently claimed rewards', claimed ||
          empty('No rewards claimed yet.')) +
        '<div class="pp-note">Lifetime points earned: <b>' + child.lifetimeEarned +
          '</b>. This excludes corrected awards and starting balances.</div>',
    });

    if (!child.activity.length) {
      pages.push({
        heading: child.name + ' · activity',
        subtitle: 'Past 30 days',
        html: section('Points and rewards activity', empty('No recorded activity in the past 30 days.')),
      });
    } else {
      chunk(child.activity, 9).forEach((events, idx, groups) => {
        pages.push({
          heading: child.name + ' · activity',
          subtitle: 'Past 30 days' + (groups.length > 1 ? ' · part ' + (idx + 1) + ' of ' + groups.length : ''),
          html: section('Points and rewards activity',
            events.map(e => row(prettyDate(e.created, model.timezone, true) +
              ' · ' + e.label, e.points, truncate(e.detail, 120))).join('')),
        });
      });
    }
  }

  const allRewards = chunk(model.rewards, 12);
  (allRewards.length ? allRewards : [[]]).forEach((items, i) => pages.push({
    heading: i ? 'Family rewards · continued' : 'Family rewards',
    subtitle: 'The rewards your family has set up',
    html: section('Available rewards', items.length ? items.map(r =>
      row(r.title, num(r.cost_points) + ' points', truncate(r.description, 105))).join('')
      : empty('No rewards have been set up yet.')),
  }));

  const allBehaviours = chunk(model.behaviours, 13);
  (allBehaviours.length ? allBehaviours : [[]]).forEach((items, i) => pages.push({
    heading: i ? 'Behaviour settings · continued' : 'Behaviour settings',
    subtitle: 'The positive behaviours your family rewards',
    html: section('Behaviour categories', items.length ? items.map(b =>
      row(b.name, num(b.points) + ' point' + (num(b.points) === 1 ? '' : 's'),
        b.is_quick_action ? 'Quick points action' : 'Customisable in Family settings')).join('')
      : empty('No behaviour categories are configured.')),
  }));

  if (pages.length > MAX_PAGES) {
    throw new Error('This report has too many activity pages. Download the full technical data (JSON) for the complete history.');
  }
  return pages;
}

export function buildFamilyReportPages(data, at = new Date()) {
  const model = buildFamilyReportModel(data, at);
  const descriptions = pageDescriptions(model);
  return descriptions.map((p, index) =>
    '<article class="pp-report-page" aria-label="Family report page ' + (index + 1) + '">' +
      '<div class="pp-topline"><span class="pp-brand">POSITIVE PERCY <span>★</span></span>' +
      '<span class="pp-report-label">FAMILY REPORT</span></div>' +
      '<div class="pp-content"><div class="pp-page-title">' + safe(p.heading) + '</div>' +
      '<div class="pp-subtitle">' + safe(p.subtitle) + '</div>' + p.html + '</div>' +
      '<div class="pp-footer"><span>Private family report · ' + safe(model.reportDate) +
      '</span><span>Page ' + (index + 1) + ' of ' + descriptions.length + '</span></div>' +
      '</article>'
  );
}

const CSS = /* tokens-allow: isolated A4 PDF template requires fixed printable brand colors, not app UI styles */ String.raw`
.pp-report-page{box-sizing:border-box;width:794px;height:1123px;padding:54px 56px 52px;position:relative;background:#fff;color:#271737;font-family:Arial,"Noto Sans",sans-serif;font-size:17px;line-height:1.4;overflow:hidden;border-top:13px solid #4B1D8C}
.pp-report-page *{box-sizing:border-box}
.pp-topline{display:flex;justify-content:space-between;align-items:center;padding-bottom:24px;border-bottom:2px solid #F3E7D9}
.pp-brand{font-size:17px;font-weight:800;letter-spacing:1px;color:#4B1D8C}
.pp-brand span{color:#FF6A00;font-size:26px;margin-left:7px}
.pp-report-label{font-size:12px;letter-spacing:1.4px;color:#705E80;font-weight:700}
.pp-content{padding-top:29px}
.pp-page-title{font-size:29px;line-height:1.35;font-weight:750;color:#4B1D8C;overflow-wrap:anywhere;padding-bottom:5px}
.pp-subtitle{margin-top:8px;color:#705E80;font-size:15px}
.pp-hero{background:#FFF6E8;padding:25px;border-radius:15px;border-left:7px solid #FF6A00;margin-top:26px}
.pp-hero-kicker{font-size:12px;letter-spacing:1px;color:#7A4E23;font-weight:bold}
.pp-hero-title{font-size:27px;line-height:1.35;font-weight:750;margin-top:6px;overflow-wrap:anywhere}
.pp-hero-copy{margin-top:9px;font-size:15px;color:#725F52}
.pp-metrics{display:flex;gap:12px;margin-top:24px}
.pp-metric{flex:1;background:#F7F3FB;border:1px solid #EDE6F6;border-radius:11px;padding:18px 14px;min-width:0}
.pp-metric-number{font-weight:750;color:#4B1D8C;font-size:30px;line-height:1.1;overflow-wrap:anywhere}
.pp-metric-label{color:#635876;font-size:13px;margin-top:9px}
.pp-section{margin-top:25px}
.pp-section-title{font-size:19px;font-weight:bold;color:#4B1D8C;border-bottom:2px solid #FFE4B6;padding-bottom:9px;margin-bottom:6px}
.pp-row{display:flex;align-items:center;justify-content:space-between;gap:18px;border-bottom:1px solid #EEE8F3;padding:12px 3px;min-height:53px}
.pp-row-text{min-width:0;max-width:79%;overflow-wrap:anywhere;font-size:15px}
.pp-row-text b{font-weight:700}
.pp-row-text small{display:block;color:#725F7A;font-size:13px;margin-top:3px;line-height:1.25}
.pp-row-right{flex-shrink:0;font-size:14px;color:#4B1D8C;font-weight:700;white-space:nowrap}
.pp-note{margin-top:24px;background:#FFF6E8;border-radius:8px;padding:15px 18px;color:#66514A;font-size:14px;line-height:1.5}
.pp-empty{font-size:15px;color:#786C7E;padding:17px 4px}
.pp-progress{height:13px;background:#F1E8F7;border-radius:8px;overflow:hidden;margin-top:15px}
.pp-progress>div{height:100%;background:#FF6A00;border-radius:8px}
.pp-helper{font-size:14px;color:#75667C;margin-top:9px}
.pp-pills{display:flex;flex-wrap:wrap;gap:8px;padding-top:10px}
.pp-pill{font-size:13px;color:#4B1D8C;background:#F1E9FA;padding:8px 12px;border-radius:15px;max-width:100%;overflow-wrap:anywhere}
.pp-footer{position:absolute;bottom:35px;left:56px;right:56px;border-top:1px solid #E7DDED;padding-top:14px;color:#80718B;font-size:12px;display:flex;justify-content:space-between}
`;

function bytes(str) { return new TextEncoder().encode(str); }
function jpegBytes(dataURL) {
  const base = dataURL.slice(dataURL.indexOf(',') + 1);
  const raw = atob(base);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

// Pure PDF 1.4 image-page assembly. Browser fonts, including non-Latin family
// names, are rasterised into high-resolution pages before encoding. A PDF
// viewer and printer see standard A4 dimensions without browser print prompts.
export function imagesToPdf(images) {
  if (!images.length) throw new Error('No report pages available.');
  const pageIds = images.map((_, i) => 6 + i * 3);
  const objects = new Array(3 + images.length * 3);
  objects[0] = bytes('<< /Type /Catalog /Pages 2 0 R >>');
  objects[1] = bytes('<< /Type /Pages /Kids [' + pageIds.map(id => id + ' 0 R').join(' ') +
    '] /Count ' + images.length + ' >>');
  objects[2] = bytes('<< /Title (Positive Percy Family Report) /Creator (Positive Percy) >>');

  for (let i = 0; i < images.length; i++) {
    const img = images[i], name = '/Img' + (i + 1);
    const imageId = 4 + i * 3, contentId = 5 + i * 3;
    const imageStart = bytes('<< /Type /XObject /Subtype /Image /Width ' + img.width +
      ' /Height ' + img.height +
      ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' +
      img.data.length + ' >>\nstream\n');
    const imageEnd = bytes('\nendstream');
    const imageBody = new Uint8Array(imageStart.length + img.data.length + imageEnd.length);
    imageBody.set(imageStart); imageBody.set(img.data, imageStart.length);
    imageBody.set(imageEnd, imageStart.length + img.data.length);
    objects[imageId - 1] = imageBody;
    const commands = bytes('q\n' + A4.width + ' 0 0 ' + A4.height +
      ' 0 0 cm\n' + name + ' Do\nQ\n');
    objects[contentId - 1] = bytes('<< /Length ' + commands.length + ' >>\nstream\n' +
      new TextDecoder().decode(commands) + 'endstream');
    objects[pageIds[i] - 1] = bytes('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' +
      A4.width + ' ' + A4.height + '] /Resources << /XObject << ' +
      name + ' ' + imageId + ' 0 R >> >> /Contents ' + contentId + ' 0 R >>');
  }

  const parts = [], offsets = [0];
  let length = 0;
  const add = (part) => { parts.push(part); length += part.length; };
  add(bytes('%PDF-1.4\n%PDF-Percy\n'));
  for (let i = 0; i < objects.length; i++) {
    offsets.push(length);
    add(bytes((i + 1) + ' 0 obj\n'));
    add(objects[i]);
    add(bytes('\nendobj\n'));
  }
  const xref = length;
  add(bytes('xref\n0 ' + (objects.length + 1) + '\n0000000000 65535 f \n'));
  for (let i = 1; i < offsets.length; i++) {
    add(bytes(String(offsets[i]).padStart(10, '0') + ' 00000 n \n'));
  }
  add(bytes('trailer\n<< /Size ' + (objects.length + 1) +
    ' /Root 1 0 R /Info 3 0 R >>\nstartxref\n' + xref + '\n%%EOF\n'));
  return new Blob(parts, { type: 'application/pdf' });
}

export async function downloadFamilyReport(data, at = new Date()) {
  const pages = buildFamilyReportPages(data, at);
  const mount = document.createElement('div');
  mount.setAttribute('aria-hidden', 'true');
  mount.style.cssText = 'position:fixed;top:0;left:0;z-index:-10000;pointer-events:none;';
  const style = document.createElement('style');
  style.textContent = CSS;
  mount.appendChild(style);
  document.body.appendChild(mount);

  const { default: html2canvas } = await import('html2canvas');
  const images = [];
  try {
    for (const markup of pages) {
      const holder = document.createElement('div');
      holder.innerHTML = markup; // all user-supplied values escaped by safe()
      const page = holder.firstElementChild;
      mount.appendChild(page);
      try {
        const canvas = await html2canvas(page, {
          scale: 1.6, backgroundColor: '#ffffff', useCORS: false, // tokens-allow: opaque white PDF page canvas
          logging: false, width: PAGE.width, height: PAGE.height,
        });
        images.push({
          width: canvas.width, height: canvas.height,
          data: jpegBytes(canvas.toDataURL('image/jpeg', 0.87)),
        });
        canvas.width = 0; canvas.height = 0;
      } finally {
        page.remove();
      }
    }
  } finally {
    mount.remove();
  }

  const blob = imagesToPdf(images);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const date = localDay(at, data?.family?.timezone || 'UTC');
  link.href = url;
  link.download = 'positive-percy-family-report-' + date + '.pdf';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return pages.length;
}
