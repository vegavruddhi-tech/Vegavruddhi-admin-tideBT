/**
 * TideBT Daily Report — FTD BT | FTD RP | MTD BT | MTD RP
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
  // Daily FTD & MTD report emails temporarily disabled per user request
  console.log('[BT Report] 🛑 Daily FTD/MTD report emails are temporarily disabled.');
  return { success: true, message: 'FTD & MTD daily report emails are temporarily disabled.' };
}

module.exports = { sendTideBTDailyReport };
