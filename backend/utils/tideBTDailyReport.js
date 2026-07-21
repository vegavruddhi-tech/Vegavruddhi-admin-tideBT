/**
 * TideBT Daily Report — FTD BT | FTD RP | MTD BT | MTD RP
 *
 * FTD BT  = todaysStage3  (today's BT amount from sheet)
 * MTD BT  = stage3        (month total BT amount)
 * RP      = rewardPassPro === 'Active' count (current status)
 *
 * Trigger:
 *  GET  /api/report/test-bt-report
 *  POST /api/report/send-daily-bt-report
 */

const nodemailer = require('nodemailer');

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

const findBTCollection = (allCollections, monthName) => {
  if (!monthName) return null;
  const ABBR = {
    'JANUARY':'JAN','FEBRUARY':'FEB','MARCH':'MAR','APRIL':'APR','MAY':'MAY','JUNE':'JUN',
    'JULY':'JUL','AUGUST':'AUG','SEPTEMBER':'SEP','OCTOBER':'OCT','NOVEMBER':'NOV','DECEMBER':'DEC'
  };
  const mu   = monthName.toUpperCase();
  const abbr = ABBR[mu] || mu;
  if (allCollections.includes(`BT_TL_CONNECT ${mu}`))   return `BT_TL_CONNECT ${mu}`;
  if (allCollections.includes(`BT_TL_CONNECT ${abbr}`)) return `BT_TL_CONNECT ${abbr}`;
  return allCollections
    .filter(c => c.toUpperCase().startsWith('BT_TL_CONNECT'))
    .find(c => { const cu = c.toUpperCase(); return cu.includes(mu) || cu.includes(abbr); }) || null;
};

const fmtBT = n => n > 0
  ? `<strong style="color:#e65100;">&#8377;${Math.round(n).toLocaleString('en-IN')}</strong>`
  : `<span style="color:#aaa;">&#8377;0</span>`;
const fmtN = n => n > 0
  ? `<strong style="color:#7c3aed;">${n}</strong>`
  : `<span style="color:#aaa;">0</span>`;
const plain = n => n > 0 ? `&#8377;${Math.round(n).toLocaleString('en-IN')}` : '&#8377;0';
const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function sendTideBTDailyReport(db) {
  try {
    console.log('[BT Report] Generating TideBT FTD + MTD Report...');

    const now         = new Date();
    const istOffset   = 5.5 * 60 * 60 * 1000;
    const nowIST      = new Date(now.getTime() + istOffset);
    const curMonthIdx = nowIST.getMonth();
    const curYear     = nowIST.getFullYear();
    const curMonth    = MONTHS[curMonthIdx];
    // FTD = yesterdaysStage3 (the sheet stores previous day's BT as "yesterday")
    const yestIST  = new Date(nowIST);
    yestIST.setDate(yestIST.getDate() - 1);
    const ftdLabel = yestIST.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    // ── Find BT collection ─────────────────────────────────────────────────
    const allCollections = (await db.listCollections().toArray()).map(c => c.name);
    const btCol = findBTCollection(allCollections, curMonth);
    if (!btCol) {
      return { success: false, reason: `No BT_TL_CONNECT collection for ${curMonth}` };
    }
    console.log(`[BT Report] Collection: ${btCol}`);

    // ── TL → FSE mapping from TideBT_Access ───────────────────────────────
    const accessDocs = await db.collection('TideBT_Access').find({}).toArray();
    const tlFSEMap = {};
    const fseToTL  = {};
    accessDocs.forEach(a => {
      const tl  = (a.tlName  || '').trim();
      const fse = (a.fseName || '').trim();
      if (!tl) return;
      if (!tlFSEMap[tl]) tlFSEMap[tl] = new Set();
      if (fse) { tlFSEMap[tl].add(fse); fseToTL[fse.toLowerCase()] = tl; }
    });
    const allTLNames = Object.keys(tlFSEMap);

    // ── merchantNumber → fseName from bt_master ────────────────────────────
    const masterDocs = await db.collection('bt_master').find(
      {}, { projection: { merchantNumber: 1, fseName: 1, _id: 0 } }
    ).toArray();
    const numToFse = {};
    masterDocs.forEach(m => {
      const num = (m.merchantNumber || '').trim();
      const fse = (m.fseName || '').trim();
      if (num && fse) numToFse[num] = fse;
    });
    const allNums = [...new Set(masterDocs.map(m => (m.merchantNumber || '').trim()).filter(Boolean))];

    // ── Full BT collection ─────────────────────────────────────────────────
    const btDocsAll = await db.collection(btCol).find(
      {},
      { projection: {
          merchantNumber: 1,
          stage3: 1, Stage_3: 1,
          yesterdaysStage3: 1, yesterday_s_stage_3: 1,
          rewardPassPro: 1, priorityPassPro: 1,
          _id: 0
      }}
    ).toArray();

    const parseNum = v => {
      const n = parseFloat(String(v || '0').replace(/,/g, ''));
      return isNaN(n) ? 0 : n;
    };

    // ── Aggregate in one pass ──────────────────────────────────────────────
    const tlStats = {};
    allTLNames.forEach(tl => { tlStats[tl] = { ftdBT: 0, mtdBT: 0, rp: 0 }; });
    const grand = { ftdBT: 0, mtdBT: 0, rp: 0 };

    btDocsAll.forEach(r => {
      const num   = (r.merchantNumber || '').trim();
      const mtdBT = parseNum(r.stage3 || r.Stage_3 || r['Stage-3']);
      const ftdBT = parseNum(r.todaysStage3 || r.todays_stage_3 || r["Today's_Stage-3"] || 0);
      const rp    = (r.rewardPassPro || r.priorityPassPro || '').toLowerCase() === 'active';

      grand.mtdBT += mtdBT;
      grand.ftdBT += ftdBT;
      if (rp) grand.rp++;

      if (!allNums.includes(num)) return;
      const rawFse = numToFse[num];
      if (!rawFse) return;
      const tlName = fseToTL[rawFse.toLowerCase()]
        || allTLNames.find(t =>
            [...tlFSEMap[t]].some(f => new RegExp(`^\\s*${escape(f)}\\s*\\d*\\s*$`, 'i').test(rawFse))
          );
      if (!tlName || !tlStats[tlName]) return;

      tlStats[tlName].mtdBT += mtdBT;
      tlStats[tlName].ftdBT += ftdBT;
      if (rp) tlStats[tlName].rp++;
    });

    const activeTLs = allTLNames
      .filter(tl => tlStats[tl].mtdBT > 0 || tlStats[tl].ftdBT > 0)
      .sort((a, b) => tlStats[b].mtdBT - tlStats[a].mtdBT);

    // ── Table styles ───────────────────────────────────────────────────────
    const thC    = `padding:11px 14px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;color:#fff;text-align:center;border-right:1px solid #388e3c;`;
    const thL    = thC + 'text-align:left;';
    const thCSep = `padding:11px 14px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;color:#fff;text-align:center;border-right:2px solid #1b5e20;`;
    const thCEnd = thC.replace('border-right:1px solid #388e3c;', '');

    // ── Table rows ─────────────────────────────────────────────────────────
    const tableRows = activeTLs.map((tl, i) => {
      const s  = tlStats[tl];
      const bg = i % 2 === 0 ? '#ffffff' : '#f8fdf9';
      return `
        <tr style="background:${bg};border-bottom:1px solid #e8f3ed;">
          <td style="padding:12px 14px;font-weight:700;font-size:13px;color:#1a4731;border-right:1px solid #e0ece0;">${tl}</td>
          <td style="padding:12px 14px;text-align:center;font-size:13px;border-right:1px solid #e0ece0;">${fmtBT(s.ftdBT)}</td>
          <td style="padding:12px 14px;text-align:center;font-size:13px;border-right:2px solid #c8e6c9;">${fmtN(s.rp)}</td>
          <td style="padding:12px 14px;text-align:center;font-size:13px;border-right:1px solid #e0ece0;">${fmtBT(s.mtdBT)}</td>
          <td style="padding:12px 14px;text-align:center;font-size:13px;">${fmtN(s.rp)}</td>
        </tr>`;
    }).join('');

    const grandRow = activeTLs.length === 0 ? '' : `
      <tr style="background:#e6f4ea;font-weight:800;border-top:2px solid #2e7d32;">
        <td style="padding:13px 14px;font-size:14px;color:#1b5e20;border-right:1px solid #c8e6c9;">TOTAL (${activeTLs.length} TLs)</td>
        <td style="padding:13px 14px;text-align:center;font-size:14px;color:#e65100;border-right:1px solid #c8e6c9;">${plain(grand.ftdBT)}</td>
        <td style="padding:13px 14px;text-align:center;font-size:14px;color:#7c3aed;border-right:2px solid #a5d6a7;">${grand.rp}</td>
        <td style="padding:13px 14px;text-align:center;font-size:14px;color:#b45309;border-right:1px solid #c8e6c9;">${plain(grand.mtdBT)}</td>
        <td style="padding:13px 14px;text-align:center;font-size:14px;color:#7c3aed;">${grand.rp}</td>
      </tr>`;

    // ── HTML ───────────────────────────────────────────────────────────────
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>TideBT Daily Report</title>
</head>
<body style="font-family:'Segoe UI',Arial,sans-serif;background:#f0f4f0;margin:0;padding:16px;color:#212121;">
  <div style="display:none;font-size:1px;max-height:0;overflow:hidden;">
    TideBT Report &bull; FTD: ${plain(grand.ftdBT)} | MTD: ${plain(grand.mtdBT)} | RP: ${grand.rp} &bull; ${now.toISOString()} &bull; ${Math.random().toString(36).slice(2,8).toUpperCase()}
    &zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
  </div>

  <div style="max-width:820px;margin:0 auto;background:#fff;border-radius:14px;box-shadow:0 6px 28px rgba(0,0,0,0.10);overflow:hidden;">

    <!-- HEADER -->
    <div style="background:linear-gradient(135deg,#1b5e20 0%,#2e7d32 100%);padding:28px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td>
          <div style="font-size:22px;font-weight:800;color:#fff;letter-spacing:0.5px;">VEGAVRUDDHI</div>
          <div style="font-size:15px;font-weight:600;color:#c8e6c9;margin-top:4px;">TideBT Daily Performance Report</div>
          <div style="font-size:12px;color:#a5d6a7;margin-top:6px;">Generated: ${now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} &bull; ${btCol}</div>
        </td>
        <td align="right" valign="top">
          <div style="background:rgba(255,255,255,0.18);border-radius:8px;padding:10px 16px;text-align:center;">
            <div style="font-size:11px;color:#c8e6c9;font-weight:600;text-transform:uppercase;">Month</div>
            <div style="font-size:16px;font-weight:800;color:#fff;margin-top:2px;">${curMonth} ${curYear}</div>
          </div>
        </td>
      </tr></table>
    </div>

    <!-- SUMMARY CARDS: FTD BT | FTD RP | MTD BT | MTD RP -->
    <div style="padding:24px 28px 0;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td width="23%" style="background:#fff3e0;border:1.5px solid #fb923c;border-radius:10px;padding:16px 12px;text-align:center;vertical-align:top;">
          <div style="font-size:10px;color:#e65100;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">FTD BT</div>
          <div style="font-size:10px;color:#aaa;margin-top:2px;">${ftdLabel}</div>
          <div style="font-size:20px;font-weight:800;color:#e65100;margin-top:6px;">${plain(grand.ftdBT)}</div>
        </td>
        <td width="3%"></td>
        <td width="23%" style="background:#ede9fe;border:1.5px solid #7c3aed;border-radius:10px;padding:16px 12px;text-align:center;vertical-align:top;">
          <div style="font-size:10px;color:#7c3aed;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">FTD RP</div>
          <div style="font-size:10px;color:#aaa;margin-top:2px;">RP Active</div>
          <div style="font-size:20px;font-weight:800;color:#7c3aed;margin-top:6px;">${grand.rp}</div>
        </td>
        <td width="3%"></td>
        <td width="23%" style="background:#fef3c7;border:1.5px solid #f59e0b;border-radius:10px;padding:16px 12px;text-align:center;vertical-align:top;">
          <div style="font-size:10px;color:#b45309;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">MTD BT</div>
          <div style="font-size:10px;color:#aaa;margin-top:2px;">${curMonth} ${curYear}</div>
          <div style="font-size:20px;font-weight:800;color:#b45309;margin-top:6px;">${plain(grand.mtdBT)}</div>
        </td>
        <td width="3%"></td>
        <td width="23%" style="background:#ede9fe;border:1.5px solid #7c3aed;border-radius:10px;padding:16px 12px;text-align:center;vertical-align:top;">
          <div style="font-size:10px;color:#7c3aed;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">MTD RP</div>
          <div style="font-size:10px;color:#aaa;margin-top:2px;">RP Active</div>
          <div style="font-size:20px;font-weight:800;color:#7c3aed;margin-top:6px;">${grand.rp}</div>
        </td>
      </tr></table>
    </div>

    <!-- TL TABLE -->
    <div style="padding:28px;">
      <div style="margin-bottom:12px;">
        <span style="display:inline-block;background:#1b5e20;color:#fff;font-size:13px;font-weight:800;padding:6px 16px;border-radius:6px;letter-spacing:0.5px;">TL-wise Performance &mdash; ${curMonth} ${curYear}</span>
        <span style="margin-left:10px;font-size:12px;color:#888;">FTD = Today (${ftdLabel}) &bull; MTD = Month Total</span>
      </div>
      <div style="overflow-x:auto;border:1px solid #c8e6c9;border-radius:8px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px;min-width:540px;">
          <thead>
            <tr style="background:#1b5e20;">
              <th style="${thL}" rowspan="2">Team Leader</th>
              <th colspan="2" style="padding:8px 14px;font-size:11px;font-weight:700;text-transform:uppercase;color:#fff;text-align:center;border-right:2px solid #1b5e20;border-bottom:1px solid #388e3c;">FTD &mdash; ${ftdLabel}</th>
              <th colspan="2" style="padding:8px 14px;font-size:11px;font-weight:700;text-transform:uppercase;color:#fff;text-align:center;border-bottom:1px solid #388e3c;">MTD &mdash; ${curMonth}</th>
            </tr>
            <tr style="background:#2e7d32;">
              <th style="${thC}">BT Amount</th>
              <th style="${thCSep}">RP Count</th>
              <th style="${thC}">BT Amount</th>
              <th style="${thCEnd}">RP Count</th>
            </tr>
          </thead>
          <tbody>
            ${activeTLs.length === 0
              ? `<tr><td colspan="5" style="padding:24px;text-align:center;color:#888;">No BT activity for ${curMonth}</td></tr>`
              : tableRows + grandRow
            }
          </tbody>
        </table>
      </div>
    </div>

    <!-- FOOTER -->
    <div style="background:#f0f5f0;padding:16px 28px;text-align:center;font-size:12px;color:#666;border-top:1px solid #e0e8e0;">
      Vegavruddhi Pvt. Ltd. &mdash; TideBT Automated Daily Report &bull; FTD BT = Today's Stage-3 &bull; MTD BT = Month Total Stage-3 &bull; RP = Reward Pass Pro Active
    </div>
  </div>
</body>
</html>`;

    // ── Send email ─────────────────────────────────────────────────────────
    const smtpUser = (process.env.SMTP_USER || process.env.ADMIN_EMAIL || '').split(',')[0].trim();
    const smtpPass = (process.env.SMTP_PASS || process.env.ADMIN_EMAIL_PASSWORD || '').replace(/\s+/g, '');

    if (!smtpUser || !smtpPass) {
      return { success: false, reason: 'No SMTP credentials in .env' };
    }

    const recipients = (process.env.BT_REPORT_EMAILS || process.env.MANAGER_REPORT_EMAILS || process.env.ADMIN_EMAIL || '')
      .split(',').map(e => e.trim()).filter(e => e && e.includes('@'));

    if (recipients.length === 0) {
      return { success: false, reason: 'No recipient emails configured' };
    }

    const transporter = nodemailer.createTransport({
      service: process.env.SMTP_SERVICE || 'gmail',
      auth: { user: smtpUser, pass: smtpPass }
    });

    const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const subject = `[TideBT ${curMonth} ${curYear}] FTD ${plain(grand.ftdBT)} | MTD ${plain(grand.mtdBT)} | RP ${grand.rp} — Daily Report (${dateStr})`;

    const info = await transporter.sendMail({
      from : `"Vegavruddhi TideBT" <${smtpUser}>`,
      to   : recipients.join(', '),
      subject,
      html : htmlContent,
    });

    console.log(`[BT Report] Sent to ${recipients.length} recipients. MsgId: ${info.messageId}`);
    return {
      success   : true,
      messageId : info.messageId,
      recipients,
      ftdBT     : grand.ftdBT,
      mtdBT     : grand.mtdBT,
      rp        : grand.rp,
      activeTLs : activeTLs.length
    };

  } catch (err) {
    console.error('[BT Report] Error:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = { sendTideBTDailyReport };

