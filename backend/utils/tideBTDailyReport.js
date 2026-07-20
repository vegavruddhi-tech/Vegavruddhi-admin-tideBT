/**
 * TideBT Daily Report — FTD + MTD format (matches existing manager report style)
 *
 * FTD = yesterdaysStage3 per merchant (BT done yesterday)
 * MTD = stage3 per merchant (total BT done this month)
 *
 * Report structure:
 *  - Summary cards: FTD BT Total | MTD BT Total | RP Active | Pass Live
 *  - FTD Table: per-TL yesterday's BT, RP, Pass Live, FSEs
 *  - MTD Table: per-TL total month BT, RP, Pass Live, FSEs
 *
 * Trigger:
 *  GET  /api/report/test-bt-report          (manual test)
 *  POST /api/report/send-daily-bt-report    (after sync)
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
  ? `<strong style="color:#e65100;">₹${Math.round(n).toLocaleString('en-IN')}</strong>`
  : `<span style="color:#aaa;">₹0</span>`;
const fmtN  = n => n > 0
  ? `<strong>${n}</strong>`
  : `<span style="color:#aaa;">0</span>`;
const plain = n => n > 0 ? `₹${Math.round(n).toLocaleString('en-IN')}` : '₹0';

// Regex escape helper — module-level so available everywhere without TDZ issues
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

    // Yesterday in IST
    const yestIST   = new Date(nowIST);
    yestIST.setDate(yestIST.getDate() - 1);
    const yestLabel = yestIST.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    // ── Find BT collection ─────────────────────────────────────────────────
    const allCollections = (await db.listCollections().toArray()).map(c => c.name);
    const btCol = findBTCollection(allCollections, curMonth);
    if (!btCol) {
      return { success: false, reason: `No BT_TL_CONNECT collection for ${curMonth}` };
    }
    console.log(`[BT Report] Collection: ${btCol}`);

    // ── Load TideBT_Access ─────────────────────────────────────────────────
    const accessDocs = await db.collection('TideBT_Access').find({}).toArray();
    const tlFSEMap   = {}; // tlName → Set<fseName>
    const fseToTL    = {}; // fseName.lower → tlName
    accessDocs.forEach(a => {
      const tl  = (a.tlName  || '').trim();
      const fse = (a.fseName || '').trim();
      if (!tl) return;
      if (!tlFSEMap[tl]) tlFSEMap[tl] = new Set();
      if (fse) { tlFSEMap[tl].add(fse); fseToTL[fse.toLowerCase()] = tl; }
    });
    const allTLNames = Object.keys(tlFSEMap);

    // ── Load bt_master (num → fseName) — SAME as dashboard ───────────────
    // Dashboard uses bt_master to get merchant numbers per FSE,
    // then queries BT collection ONLY for those numbers.
    // We must do the same to get matching numbers.
    const masterDocs = await db.collection('bt_master').find(
      {}, { projection: { merchantNumber: 1, fseName: 1, _id: 0 } }
    ).toArray();

    // Build num→fse map (same as fse.js)
    const numToFse = {};
    masterDocs.forEach(m => {
      const num = (m.merchantNumber || '').trim();
      const fse = (m.fseName || '').trim();
      if (num && fse) numToFse[num] = fse;
    });

    // Build fseName → merchantNumbers[] map (same as fse.js)
    const fseMerchantNums = {};
    allTLNames.forEach(tl => {
      [...tlFSEMap[tl]].forEach(fse => { fseMerchantNums[fse] = []; });
    });
    masterDocs.forEach(m => {
      const num = (m.merchantNumber || '').trim();
      if (!num) return;
      // Match fseName with optional trailing digits/spaces (same regex as fse.js)
      const matchedFSE = Object.keys(fseMerchantNums).find(n =>
        new RegExp(`^\\s*${escape(n)}\\s*\\d*\\s*$`, 'i').test(m.fseName || '')
      );
      if (matchedFSE) fseMerchantNums[matchedFSE].push(num);
    });

    const allNums = [...new Set(masterDocs.map(m => (m.merchantNumber || '').trim()).filter(Boolean))];

    // ── Load FULL BT collection (all merchants, not just bt_master) ────────
    // Dashboard counts ALL merchants in BT_TL_CONNECT for Pass Live / RP Active
    // We use full collection for global totals, bt_master for TL grouping
    const btDocsAll = await db.collection(btCol).find(
      {},
      { projection: {
          merchantNumber: 1,
          stage3: 1, Stage_3: 1,
          yesterdaysStage3: 1, yesterday_s_stage_3: 1,
          rewardPassPro: 1, priorityPassPro: 1,
          passLive: 1, pass_live: 1, Pass_Live: 1,
          lead: 1, Lead: 1,
          _id: 0
      }}
    ).toArray();

    // For TL grouping — only use bt_master mapped merchants (same as dashboard per-TL)
    const btDocs = btDocsAll.filter(r => allNums.includes((r.merchantNumber || '').trim()));

    const parseNum = v => {
      const n = parseFloat(String(v || '0').replace(/,/g, ''));
      return isNaN(n) ? 0 : n;
    };

    // ── Aggregate per TL ───────────────────────────────────────────────────
    // ftdStats = yesterday's BT per TL
    // mtdStats = total month BT per TL
    const ftdStats = {};
    const mtdStats = {};
    allTLNames.forEach(tl => {
      ftdStats[tl] = { bt: 0, rp: 0, pl: 0, fseCount: tlFSEMap[tl].size };
      mtdStats[tl] = { bt: 0, rp: 0, pl: 0, fseCount: tlFSEMap[tl].size };
    });

    btDocs.forEach(r => {
      const num    = (r.merchantNumber || '').trim();
      // Resolve fseName from bt_master map (same as dashboard)
      const rawFse = numToFse[num];
      if (!rawFse) return;

      // Find which TL this FSE belongs to (same regex as fse.js)
      const tlName = fseToTL[rawFse.toLowerCase()]
        || allTLNames.find(tl =>
            [...tlFSEMap[tl]].some(f => new RegExp(`^\\s*${escape(f)}\\s*\\d*\\s*$`, 'i').test(rawFse))
          );
      if (!tlName) return;

      const mtdBT = parseNum(r.stage3 || r.Stage_3 || r['Stage-3']);
      const ftdBT = parseNum(
        r.yesterdaysStage3 || r.yesterday_s_stage_3 ||
        r["Yesterday's_Stage-3"] || r["Yesterday's_Stage_3"] || 0
      );
      const rp = (r.rewardPassPro || r.priorityPassPro || '').toLowerCase() === 'active';
      const pl = (r.passLive || r.pass_live || r.Pass_Live || '').toLowerCase() === 'live';

      if (mtdStats[tlName]) {
        mtdStats[tlName].bt += mtdBT;
        if (rp) mtdStats[tlName].rp++;
        if (pl) mtdStats[tlName].pl++;
      }
      if (ftdStats[tlName]) {
        ftdStats[tlName].bt += ftdBT;
        // RP/PL same for FTD (same merchants — status doesn't change per day)
        if (rp) ftdStats[tlName].rp++;
        if (pl) ftdStats[tlName].pl++;
      }
    });

    // ── Sort by MTD BT descending, filter out zero activity ───────────────
    const activeTLs = allTLNames
      .filter(tl => mtdStats[tl].bt > 0 || ftdStats[tl].bt > 0)
      .sort((a, b) => mtdStats[b].bt - mtdStats[a].bt);

    // Grand totals — BT from TL-mapped merchants, RP/PassLive from FULL collection
    // (matches dashboard which counts ALL merchants for RP/PL, not just bt_master)
    const grandFTD = { bt: 0, rp: 0, pl: 0, fseCount: 0 };
    const grandMTD = { bt: 0, rp: 0, pl: 0, fseCount: 0 };
    activeTLs.forEach(tl => {
      grandFTD.bt       += ftdStats[tl].bt;
      grandFTD.fseCount += ftdStats[tl].fseCount;
      grandMTD.bt       += mtdStats[tl].bt;
      grandMTD.fseCount += mtdStats[tl].fseCount;
    });

    // Use full BT collection for RP Active and Pass Live global totals
    btDocsAll.forEach(r => {
      const rp = (r.rewardPassPro || r.priorityPassPro || '').toLowerCase() === 'active';
      const pl = (r.passLive || r.pass_live || r.Pass_Live || '').toLowerCase() === 'live';
      if (rp) { grandMTD.rp++; grandFTD.rp++; }
      if (pl) { grandMTD.pl++; grandFTD.pl++; }
    });

    // Also use full collection for yesterday's BT grand total
    grandFTD.bt = btDocsAll.reduce((s, r) => {
      const yBT = parseNum(
        r.yesterdaysStage3 || r.yesterday_s_stage_3 ||
        r["Yesterday's_Stage-3"] || r["Yesterday's_Stage_3"] || 0
      );
      return s + yBT;
    }, 0);

    // MTD grand BT from full collection too
    grandMTD.bt = btDocsAll.reduce((s, r) => {
      return s + parseNum(r.stage3 || r.Stage_3 || r['Stage-3']);
    }, 0);

    // ── Build table rows helper ────────────────────────────────────────────
    const thStyle = `padding:11px 14px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;color:#fff;text-align:center;border-right:1px solid #388e3c;`;
    const thLeft  = thStyle + 'text-align:left;';

    const buildTableRows = (statsMap) => activeTLs.map((tl, i) => {
      const s  = statsMap[tl];
      const bg = i % 2 === 0 ? '#ffffff' : '#f8fdf9';
      return `
        <tr style="background:${bg};border-bottom:1px solid #e8f3ed;">
          <td style="padding:12px 14px;font-weight:700;font-size:13px;color:#1a4731;">${tl}</td>
          <td style="padding:12px 14px;text-align:center;font-size:13px;">${fmtBT(s.bt)}</td>
          <td style="padding:12px 14px;text-align:center;font-size:13px;">${fmtN(s.rp)}</td>
          <td style="padding:12px 14px;text-align:center;font-size:13px;">${fmtN(s.pl)}</td>
          <td style="padding:12px 14px;text-align:center;font-size:12px;color:#555;">${s.fseCount}</td>
        </tr>`;
    }).join('');

    const buildGrandRow = (grand) => `
      <tr style="background:#e6f4ea;font-weight:800;border-top:2px solid #2e7d32;">
        <td style="padding:13px 14px;font-size:14px;color:#1b5e20;">TOTAL (${activeTLs.length} TLs)</td>
        <td style="padding:13px 14px;text-align:center;font-size:14px;color:#e65100;">${plain(grand.bt)}</td>
        <td style="padding:13px 14px;text-align:center;font-size:14px;color:#7c3aed;">${grand.rp}</td>
        <td style="padding:13px 14px;text-align:center;font-size:14px;color:#15803d;">${grand.pl}</td>
        <td style="padding:13px 14px;text-align:center;font-size:12px;color:#555;">${grand.fseCount}</td>
      </tr>`;

    const buildTable = (title, badge, statsMap, grand) => `
      <div style="margin-bottom:12px;">
        <span style="display:inline-block;background:#1b5e20;color:#fff;font-size:12px;font-weight:800;padding:5px 14px;border-radius:6px;">${badge}</span>
        <span style="font-size:14px;font-weight:600;color:#444;margin-left:10px;">${title}</span>
      </div>
      <div style="overflow-x:auto;border:1px solid #c8e6c9;border-radius:8px;margin-bottom:36px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px;min-width:500px;">
          <thead>
            <tr style="background:#1b5e20;">
              <th style="${thLeft}">Team Leader</th>
              <th style="${thStyle}">BT Amount</th>
              <th style="${thStyle}">RP Active</th>
              <th style="${thStyle}">Pass Live</th>
              <th style="${thStyle.replace('border-right:1px solid #388e3c;','')}">FSEs</th>
            </tr>
          </thead>
          <tbody>
            ${activeTLs.length === 0
              ? `<tr><td colspan="5" style="padding:24px;text-align:center;color:#888;">No BT activity for this period</td></tr>`
              : buildTableRows(statsMap) + buildGrandRow(grand)
            }
          </tbody>
        </table>
      </div>`;

    // ── Full HTML ──────────────────────────────────────────────────────────
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>TideBT Daily Report</title>
</head>
<body style="font-family:'Segoe UI',Arial,sans-serif;background:#f0f4f0;margin:0;padding:16px;color:#212121;">
  <!-- Preheader -->
  <div style="display:none;font-size:1px;max-height:0;overflow:hidden;">
    TideBT Daily BT Report &bull; FTD: ${plain(grandFTD.bt)} | MTD: ${plain(grandMTD.bt)} &bull; ${now.toISOString()} &bull; ${Math.random().toString(36).slice(2,8).toUpperCase()}
    &zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
  </div>

  <div style="max-width:860px;margin:0 auto;background:#fff;border-radius:14px;box-shadow:0 6px 28px rgba(0,0,0,0.10);overflow:hidden;">

    <!-- HEADER -->
    <div style="background:linear-gradient(135deg,#1b5e20 0%,#2e7d32 100%);padding:28px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td>
          <div style="font-size:22px;font-weight:800;color:#fff;letter-spacing:0.5px;">VEGAVRUDDHI</div>
          <div style="font-size:15px;font-weight:600;color:#c8e6c9;margin-top:4px;">TideBT Daily BT Performance Report</div>
          <div style="font-size:12px;color:#a5d6a7;margin-top:6px;">
            Generated: ${now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} &bull; Collection: ${btCol}
          </div>
        </td>
        <td align="right" valign="top">
          <div style="background:rgba(255,255,255,0.18);border-radius:8px;padding:10px 16px;text-align:center;">
            <div style="font-size:11px;color:#c8e6c9;font-weight:600;text-transform:uppercase;">Month</div>
            <div style="font-size:16px;font-weight:800;color:#fff;margin-top:2px;">${curMonth} ${curYear}</div>
          </div>
        </td>
      </tr></table>
    </div>

    <!-- SUMMARY CARDS -->
    <div style="padding:24px 28px 0;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td width="23%" style="background:#fff3e0;border:1.5px solid #fb923c;border-radius:10px;padding:16px 12px;text-align:center;vertical-align:top;">
          <div style="font-size:10px;color:#e65100;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">FTD BT</div>
          <div style="font-size:10px;color:#aaa;margin-top:2px;">${yestLabel}</div>
          <div style="font-size:20px;font-weight:800;color:#e65100;margin-top:6px;">${plain(grandFTD.bt)}</div>
        </td>
        <td width="3%"></td>
        <td width="23%" style="background:#fef3c7;border:1.5px solid #f59e0b;border-radius:10px;padding:16px 12px;text-align:center;vertical-align:top;">
          <div style="font-size:10px;color:#b45309;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">MTD BT</div>
          <div style="font-size:10px;color:#aaa;margin-top:2px;">${curMonth} ${curYear}</div>
          <div style="font-size:20px;font-weight:800;color:#b45309;margin-top:6px;">${plain(grandMTD.bt)}</div>
        </td>
        <td width="3%"></td>
        <td width="23%" style="background:#ede9fe;border:1.5px solid #7c3aed;border-radius:10px;padding:16px 12px;text-align:center;vertical-align:top;">
          <div style="font-size:10px;color:#7c3aed;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">RP Active</div>
          <div style="font-size:10px;color:#aaa;margin-top:2px;">MTD</div>
          <div style="font-size:20px;font-weight:800;color:#7c3aed;margin-top:6px;">${grandMTD.rp}</div>
        </td>
        <td width="3%"></td>
        <td width="23%" style="background:#d8f3dc;border:1.5px solid #15803d;border-radius:10px;padding:16px 12px;text-align:center;vertical-align:top;">
          <div style="font-size:10px;color:#15803d;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Pass Live</div>
          <div style="font-size:10px;color:#aaa;margin-top:2px;">MTD</div>
          <div style="font-size:20px;font-weight:800;color:#15803d;margin-top:6px;">${grandMTD.pl}</div>
        </td>
      </tr></table>
    </div>

    <!-- TABLES -->
    <div style="padding:28px;">

      <!-- FTD TABLE -->
      ${buildTable(
        `For The Day — ${yestLabel}`,
        'FTD',
        ftdStats,
        grandFTD
      )}

      <!-- SEPARATOR -->
      <div style="border-top:2px solid #c8e6c9;margin:8px 0 36px;"></div>

      <!-- MTD TABLE -->
      ${buildTable(
        `Month To Date — ${curMonth} ${curYear}`,
        'MTD',
        mtdStats,
        grandMTD
      )}
    </div>

    <!-- FOOTER -->
    <div style="background:#f0f5f0;padding:16px 28px;text-align:center;font-size:12px;color:#666;border-top:1px solid #e0e8e0;">
      Vegavruddhi Pvt. Ltd. &mdash; TideBT Automated Daily Report &bull; FTD = Yesterday's BT &bull; MTD = Month Total BT
    </div>
  </div>
</body>
</html>`;

    // ── Send ───────────────────────────────────────────────────────────────
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
    const subject = `[TideBT ${curMonth} ${curYear}] FTD ${plain(grandFTD.bt)} | MTD ${plain(grandMTD.bt)} — Daily Report (${dateStr})`;

    const info = await transporter.sendMail({
      from : `"Vegavruddhi TideBT" <${smtpUser}>`,
      to   : recipients.join(', '),
      subject,
      html : htmlContent,
    });

    console.log(`[BT Report] Sent to ${recipients.length} recipients. MsgId: ${info.messageId}`);
    return {
      success: true,
      messageId: info.messageId,
      recipients,
      ftdBT: grandFTD.bt,
      mtdBT: grandMTD.bt,
      rpActive: grandMTD.rp,
      passLive: grandMTD.pl,
      activeTLs: activeTLs.length
    };

  } catch (err) {
    console.error('[BT Report] Error:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = { sendTideBTDailyReport };
