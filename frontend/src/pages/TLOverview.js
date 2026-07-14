import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, CircularProgress, Chip, Card, CardContent, Avatar,
  Collapse, TextField, InputAdornment, Button, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, Tooltip, MenuItem, Grid
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DateFilter from '../components/DateFilter';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

function initials(name) {
  return (name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function fmtDate(d) {
  if (!d) return '–';
  const dt = new Date(d);
  return isNaN(dt) ? '–' : dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getEmpCode(fseName) {
  if (!fseName) return 'VVT-FSE-000';
  const parts = fseName.trim().split(/\s+/);
  const initials = parts.map(p => p[0]).join('').toUpperCase().slice(0, 3);
  let hash = 0;
  for (let i = 0; i < fseName.length; i++) {
    hash = fseName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const id = Math.abs(hash % 1000).toString().padStart(3, '0');
  return `VVT-${initials || 'EMP'}-${id}`;
}


function StatusChip({ status }) {
  const map = {
    'Ready For Onboarding': { bg: '#e6f4ea', color: '#2e7d32' },
    'Not interested':       { bg: '#fdecea', color: '#c62828' },
    'Completed':            { bg: '#e6f4ea', color: '#2e7d32' },
    'Pending/Hold':         { bg: '#fff3e0', color: '#e65100' },
  };
  const s = map[status] || { bg: '#f5f5f5', color: '#555' };
  return <Chip label={status || '–'} size="small" sx={{ bgcolor: s.bg, color: s.color, fontWeight: 600, fontSize: 11 }} />;
}

function CategoryChip({ category }) {
  const colors = {
    'Bike Rider':      { bg: '#e3f2fd', color: '#1565c0' },
    'Small Merchant':  { bg: '#f3e5f5', color: '#6a1b9a' },
    'Hawker':          { bg: '#fff3e0', color: '#e65100' },
    'Free Lancer':     { bg: '#e8f5e9', color: '#2e7d32' },
    'Teacher':         { bg: '#fce4ec', color: '#880e4f' },
    'Skill Employer':  { bg: '#e0f7fa', color: '#006064' },
  };
  const c = colors[category] || { bg: '#f5f5f5', color: '#555' };
  return <Chip label={category || '–'} size="small" sx={{ bgcolor: c.bg, color: c.color, fontWeight: 700, fontSize: 11 }} />;
}

// ── FSE Group (nested inside TL card) ─────────────────────────
function FSEGroup({ fse, forms, onViewForm }) {
  const [expanded, setExpanded] = useState(false);
  const fseForms = forms.filter(f => (f.employeeName || f.fse) === fse.name);

  return (
    <Box sx={{ mb: 1, border: '1px solid #e0e0e0', borderRadius: 2, overflow: 'hidden' }}>
      <Box onClick={() => setExpanded(p => !p)}
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          px: 2, py: 1, cursor: 'pointer', bgcolor: '#f9fafb',
          '&:hover': { bgcolor: '#f0f7f3' } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Avatar sx={{ bgcolor: '#1a5c38', width: 28, height: 28, fontSize: 11, fontWeight: 700 }}>
            {initials(fse.name)}
          </Avatar>
          <Typography fontWeight={600} fontSize={13}>{fse.name}</Typography>
          {fse.phone && <Typography variant="caption" color="text.secondary">· {fse.phone}</Typography>}
          {fse.email && <Typography variant="caption" color="text.secondary">· {fse.email}</Typography>}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip label={`${fseForms.length} forms`} size="small"
            sx={{ bgcolor: '#e6f4ea', color: '#2e7d32', fontWeight: 700, fontSize: 11 }} />
          {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </Box>
      </Box>
      <Collapse in={expanded}>
        {fseForms.length === 0 ? (
          <Typography variant="caption" color="text.secondary" sx={{ p: 2, display: 'block' }}>
            No forms submitted.
          </Typography>
        ) : (
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ '& th': { fontWeight: 700, fontSize: 11, textTransform: 'uppercase', color: 'text.secondary' } }}>
                  <TableCell>Merchant/Customer</TableCell>
                  <TableCell>Mobile</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Category/Details</TableCell>
                  <TableCell>Opinion/Status</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell align="center">View</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {fseForms.map((f, i) => {
                  const isMK = f.formType === 'mobikwik-withdraw';
                  return (
                    <TableRow key={i} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{f.merchantName || f.customerName || '-'}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{f.merchantNumber || f.customerNumber || '-'}</TableCell>
                      <TableCell>
                        <Chip 
                          label={isMK ? 'Mobikwik' : 'Daily Visit'} 
                          size="small"
                          color={isMK ? 'secondary' : 'primary'}
                          variant="outlined"
                          sx={{ fontWeight: 600, fontSize: 10, height: 20 }}
                        />
                      </TableCell>
                      <TableCell>
                        {isMK ? (
                          <Typography variant="body2" sx={{ fontWeight: 600, color: '#2e7d32', fontSize: 13 }}>
                            ₹{f.withdrawAmount} (Fee: ₹{Math.round((f.withdrawAmount || 0) * 0.03 * 100) / 100})
                          </Typography>
                        ) : (
                          <CategoryChip category={f.merchantCategory} />
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusChip status={isMK ? (f.status || f.onboardingStatus || 'Pending') : f.merchantOpinion} />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {f.createdAt ? new Date(f.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '–'}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <IconButton size="small" onClick={() => onViewForm(f)} sx={{ color: '#1a5c38' }}>
                          <VisibilityIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Collapse>
    </Box>
  );
}

// ── TL Card (collapsible, shows FSEs inside) ──────────────────
function TLCard({ tl, onViewForm, dateFilter, fromDate, toDate, selectedYear, selectedMonth }) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fses, setFses] = useState([]);
  const [forms, setForms] = useState([]);
  const [tlTab, setTlTab] = useState('forms'); // 'forms' | 'merchants'
  const [merchantsLoading, setMerchantsLoading] = useState(false);
  const [ownMerchants, setOwnMerchants] = useState(null);
  const [teamMerchants, setTeamMerchants] = useState(null);
  const [merchantSubTab, setMerchantSubTab] = useState('team'); // 'own' | 'team'
  const [selectedMerchant, setSelectedMerchant] = useState(null);

  const handleExpand = async () => {
    const next = !expanded;
    setExpanded(next);
    if (next && fses.length === 0) {
      setLoading(true);
      try {
        const res = await axios.get(`${API_URL}/tl/${encodeURIComponent(tl.name)}`);
        setFses(res.data.fses || []);
        setForms(res.data.forms || []);
      } catch (err) {
        console.error('Error loading TL details:', err);
      } finally {
        setLoading(false);
      }
    }
  };

  const loadMerchants = async () => {
    if (ownMerchants !== null && teamMerchants !== null) return; // already loaded
    setMerchantsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedMonth) params.set('selectedMonth', selectedMonth);
      if (selectedYear) params.set('selectedYear', selectedYear);
      const [ownRes, teamRes] = await Promise.all([
        axios.get(`${API_URL}/tl/${encodeURIComponent(tl.name)}/own-merchants?${params}`),
        axios.get(`${API_URL}/tl/${encodeURIComponent(tl.name)}/team-merchants?${params}`)
      ]);
      setOwnMerchants(ownRes.data.merchants || []);
      setTeamMerchants(teamRes.data.merchants || []);
    } catch (err) {
      console.error('Error loading TL merchants:', err);
      setOwnMerchants([]);
      setTeamMerchants([]);
    } finally {
      setMerchantsLoading(false);
    }
  };



  // Apply date filter to forms
  const filteredForms = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    return forms.filter(f => {
      const d = new Date(f.createdAt);
      if (dateFilter === 'today' && d < today) return false;
      if (dateFilter === 'month' && d < monthStart) return false;
      if (dateFilter === 'custom') {
        if (fromDate && d < new Date(fromDate)) return false;
        if (toDate && d > new Date(toDate + 'T23:59:59')) return false;
      }
      if (selectedYear && d.getFullYear() !== parseInt(selectedYear)) return false;
      if (selectedMonth && d.toLocaleString('en-US', { month: 'long' }) !== selectedMonth) return false;
      return true;
    });
  }, [forms, dateFilter, fromDate, toDate, selectedYear, selectedMonth]);

  const totalOnboarded = filteredForms.filter(f => f.onboardingStatus === 'Completed').length;
  const totalNotInterested = filteredForms.filter(f => f.merchantOpinion === 'Not interested').length;

  return (
    <Card sx={{ mb: 2, border: '1.5px solid #c8e6c9', borderRadius: 2 }}>
      <Box onClick={handleExpand}
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          px: 2.5, py: 1.5, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' }, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ bgcolor: '#1a5c38', width: 36, height: 36, fontSize: 13, fontWeight: 700 }}>
            {initials(tl.name)}
          </Avatar>
          <Box>
            <Typography fontWeight={700}>{tl.name}</Typography>
            <Typography variant="caption" color="text.secondary">
              {tl.phone || ''}{tl.email ? ` · ${tl.email}` : ''}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Team:</Typography>
          <Chip label={`${tl.fseCount} FSEs`} size="small"
            sx={{ bgcolor: '#e3f2fd', color: '#1565c0', fontWeight: 700, fontSize: 11, border: '1px solid #1565c030' }} />
          {forms.length > 0 && (
            <>
              <Chip label={`${totalOnboarded} Merchants Onboarded`} size="small"
                sx={{ bgcolor: '#e6f4ea', color: '#2e7d32', fontWeight: 700, fontSize: 11, border: '1px solid #2e7d3230' }} />
              <Chip label={`${totalNotInterested} Not Interested`} size="small"
                sx={{ bgcolor: '#fdecea', color: '#c62828', fontWeight: 700, fontSize: 11, border: '1px solid #c6282830' }} />
            </>
          )}
          <Chip label={`${filteredForms.length || '–'} Visit Forms`} size="small"
            sx={{ bgcolor: '#e6f4ea', color: '#2e7d32', fontWeight: 700, fontSize: 11, border: '1px solid #2e7d3230' }} />
          {expanded ? <ExpandLessIcon sx={{ color: 'text.secondary' }} /> : <ExpandMoreIcon sx={{ color: 'text.secondary' }} />}
        </Box>
      </Box>

      <Collapse in={expanded}>
        <Box sx={{ px: 2.5, pb: 2 }}>
          {/* Tab buttons */}
          <Box sx={{ display: 'flex', gap: 1, mb: 2, borderBottom: '2px solid #e8f3ed', pt: 1 }}>
            {[
              { key: 'forms',       label: `📋 Forms (${filteredForms.length})` },
              { key: 'merchants',   label: `🏪 Merchants` },
              { key: 'performance', label: `📊 Team Performance` },
            ].map(tab => (
              <button key={tab.key}
                onClick={() => { setTlTab(tab.key); if (tab.key === 'merchants' || tab.key === 'performance') loadMerchants(); }}
                style={{ padding: '6px 14px', border: 'none', background: tlTab === tab.key ? '#1a4731' : 'transparent',
                  color: tlTab === tab.key ? '#fff' : '#1a4731', fontWeight: 700, fontSize: 11,
                  cursor: 'pointer', borderRadius: '8px 8px 0 0' }}>
                {tab.label}
              </button>
            ))}
          </Box>

          {/* Forms Tab */}
          {tlTab === 'forms' && (
            loading ? (
              <Box display="flex" justifyContent="center" py={3}><CircularProgress size={24} /></Box>
            ) : fses.length === 0 ? (
              <Typography color="text.secondary" variant="body2" sx={{ py: 2 }}>No FSEs found under this TL.</Typography>
            ) : (
              fses.map(fse => (
                <FSEGroup key={fse.name} fse={fse} forms={filteredForms} onViewForm={onViewForm} />
              ))
            )
          )}

          {/* Merchants Tab */}
          {tlTab === 'merchants' && (
            <Box>
              {/* BT Performance KPI Cards */}
              {(ownMerchants !== null || teamMerchants !== null) && !merchantsLoading && (() => {
                const list = merchantSubTab === 'own' ? (ownMerchants||[]) : (teamMerchants||[]);
                const totalBT    = list.reduce((s,m) => s+(m.stage3||0), 0);
                const rpActive   = list.filter(m => (m.rewardPassPro||'').toLowerCase()==='active').length;
                const rpPending  = list.filter(m => (m.stage3||0)>=10000 && (m.rewardPassPro||'').toLowerCase()!=='active').length;
                const btMerchants = list.filter(m => (m.stage3||0)>0).length;
                return (
                  <Grid container spacing={1.5} mb={2}>
                    {[
                      { label: 'Total BT Completed', value: `₹${totalBT.toLocaleString()}`, sub: `${btMerchants} merchants`, icon: '💰', color: '#e65100', bg: '#fff3e0', border: '#e6510030' },
                      { label: 'Total RP Active',    value: rpActive, sub: 'Reward Pass activated', icon: '🏅', color: '#7c3aed', bg: '#ede9fe', border: '#7c3aed30' },
                      { label: 'RP Pending',         value: rpPending, sub: 'BT ≥ ₹10k, RP not activated', icon: '🎁', color: '#92400e', bg: '#fef3c7', border: '#92400e30' },
                    ].map(kpi => (
                      <Grid item xs={4} key={kpi.label}>
                        <Card sx={{ border: `1.5px solid ${kpi.border}`, borderRadius: 2 }}>
                          <CardContent sx={{ py: 1.5, px: 1.5, '&:last-child': { pb: 1.5 } }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                              <span style={{ fontSize: 14 }}>{kpi.icon}</span>
                              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: 9, letterSpacing: 0.5 }}>{kpi.label}</Typography>
                            </Box>
                            <Typography variant="h6" fontWeight={800} color={kpi.color} sx={{ fontSize: 14 }}>{kpi.value}</Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9 }}>{kpi.sub}</Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                );
              })()}

              {/* Sub-tabs: Own Merchants vs Team Merchants */}
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                {[
                  { key: 'team', label: `👥 Team Merchants (${teamMerchants ? teamMerchants.length : '…'})` },
                  { key: 'own',  label: `👤 My Merchants (${ownMerchants ? ownMerchants.length : '…'})` },
                ].map(sub => (
                  <button key={sub.key} onClick={() => setMerchantSubTab(sub.key)}
                    style={{ padding: '5px 12px', border: `1.5px solid ${merchantSubTab===sub.key?'#1a4731':'#e0e0e0'}`,
                      background: merchantSubTab===sub.key?'#f0fdf4':'#fff', color: merchantSubTab===sub.key?'#1a4731':'#666',
                      fontWeight: merchantSubTab===sub.key?700:400, fontSize: 11, cursor: 'pointer', borderRadius: 8 }}>
                    {sub.label}
                  </button>
                ))}
              </Box>

              {merchantsLoading ? (
                <Box display="flex" justifyContent="center" py={4}><CircularProgress size={24} sx={{ color: '#1a5c38' }} /></Box>
              ) : (
                (() => {
                  const list = merchantSubTab === 'own' ? (ownMerchants||[]) : (teamMerchants||[]);
                  if (!list || list.length === 0) return (
                    <Typography color="text.secondary" variant="body2" sx={{ py: 2, textAlign: 'center' }}>
                      No merchants found.
                    </Typography>
                  );
                  return (
                    <Box sx={{ overflowX: 'auto' }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ '& th': { fontWeight: 700, fontSize: 10, textTransform: 'uppercase', color: 'text.secondary', bgcolor: '#f5faf7' } }}>
                            {merchantSubTab === 'team' && <TableCell>FSE</TableCell>}
                            <TableCell>Merchant</TableCell>
                            <TableCell>Mobile</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell align="right">BT Done</TableCell>
                            <TableCell align="right">BT Left</TableCell>
                            <TableCell>RP</TableCell>
                            <TableCell>Pass Live</TableCell>
                            <TableCell align="right">UPI</TableCell>
                            <TableCell>Last Activity</TableCell>
                            <TableCell align="center">View</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {list.map((m, i) => (
                            <TableRow key={i} hover>
                              {merchantSubTab === 'team' && (
                                <TableCell><Typography variant="caption" fontWeight={700} color="#1a5c38">{m.fseName}</Typography></TableCell>
                              )}
                              <TableCell>
                                <Typography variant="body2" fontWeight={600}>{m.merchantName}</Typography>
                                {m.merchantCategory && m.merchantCategory !== '–' && (
                                  <Typography variant="caption" color="text.secondary">{m.merchantCategory}</Typography>
                                )}
                              </TableCell>
                              <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{m.merchantNumber}</TableCell>
                              <TableCell>
                                <Chip label={m.onboardingStatus||'Pending'} size="small"
                                  sx={{ fontSize: 10, fontWeight: 700,
                                    bgcolor: m.onboardingStatus==='Onboarded'?'#d8f3dc':m.onboardingStatus==='BT Active'?'#e0f2fe':'#fef3c7',
                                    color: m.onboardingStatus==='Onboarded'?'#1a4731':m.onboardingStatus==='BT Active'?'#0369a1':'#92400e' }} />
                              </TableCell>
                              <TableCell align="right">
                                <Typography variant="body2" fontWeight={700} color={m.stage3>0?'#e65100':'#999'}>
                                  {m.stage3>0?`₹${m.stage3.toLocaleString()}`:'–'}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">
                                <Typography variant="body2" color={m.stage3Gap>0?'#c62828':'#999'}>
                                  {m.stage3Gap>0?`₹${m.stage3Gap.toLocaleString()}`:'–'}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                {(m.rewardPassPro||'').toLowerCase()==='active'
                                  ? <Chip label="Active ✓" size="small" sx={{ bgcolor:'#ede9fe', color:'#7c3aed', fontWeight:700, fontSize:10 }} />
                                  : <Chip label="Pending" size="small" sx={{ bgcolor:'#fef3c7', color:'#92400e', fontWeight:700, fontSize:10 }} />}
                              </TableCell>
                              <TableCell>
                                {(m.passLive||'').toLowerCase()==='live'
                                  ? <Chip label="Live ✓" size="small" sx={{ bgcolor:'#d8f3dc', color:'#1a4731', fontWeight:700, fontSize:10 }} />
                                  : <Chip label="–" size="small" sx={{ bgcolor:'#f5f5f5', color:'#999', fontSize:10 }} />}
                              </TableCell>
                              <TableCell align="right">
                                <Typography variant="caption" color={m.upiTxnCount>0?'#0369a1':'#999'}>
                                  {m.upiTxnCount>0?`${m.upiTxnCount} txn`:'–'}
                                </Typography>
                              </TableCell>
                              <TableCell><Typography variant="caption" color="text.secondary">{fmtDate(m.lastActivity)}</Typography></TableCell>
                              <TableCell align="center">
                                <IconButton size="small" onClick={() => setSelectedMerchant(m)} sx={{ color:'#1a5c38','&:hover':{bgcolor:'#e6f4ea'} }}>
                                  <VisibilityIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <Box sx={{ p: 1.5, textAlign: 'center' }}>
                        <Typography variant="caption" color="text.secondary">Total: {list.length} merchants</Typography>
                      </Box>
                    </Box>
                  );
                })()
              )}
            </Box>
          )}

          {/* Team Performance Tab */}
          {tlTab === 'performance' && (
            <Box>
              {merchantsLoading ? (
                <Box display="flex" justifyContent="center" py={4}><CircularProgress size={24} sx={{ color: '#1a5c38' }} /></Box>
              ) : !teamMerchants || teamMerchants.length === 0 ? (
                <Typography color="text.secondary" variant="body2" sx={{ py: 2, textAlign: 'center' }}>No data. Click Merchants tab first to load.</Typography>
              ) : (() => {
                // Aggregate per FSE from teamMerchants
                const fseMap = {};
                (teamMerchants || []).forEach(m => {
                  const fse = m.fseName || '–';
                  if (!fseMap[fse]) fseMap[fse] = { name: fse, total: 0, btDone: 0, btAmt: 0, rpActive: 0, passLive: 0, pending: 0 };
                  fseMap[fse].total++;
                  if ((m.stage3 || 0) > 0) { fseMap[fse].btDone++; fseMap[fse].btAmt += (m.stage3 || 0); }
                  if ((m.rewardPassPro || '').toLowerCase() === 'active') fseMap[fse].rpActive++;
                  if ((m.passLive || '').toLowerCase() === 'live') fseMap[fse].passLive++;
                  if ((m.stage3 || 0) === 0) fseMap[fse].pending++;
                });
                const fseRows = Object.values(fseMap).sort((a, b) => b.btAmt - a.btAmt);
                // Team totals
                const teamTotal   = fseRows.reduce((s, f) => s + f.total, 0);
                const teamBTAmt   = fseRows.reduce((s, f) => s + f.btAmt, 0);
                const teamBTDone  = fseRows.reduce((s, f) => s + f.btDone, 0);
                const teamRP      = fseRows.reduce((s, f) => s + f.rpActive, 0);
                const teamLive    = fseRows.reduce((s, f) => s + f.passLive, 0);
                const teamPending = fseRows.reduce((s, f) => s + f.pending, 0);
                return (
                  <Box>
                    {/* Summary bar */}
                    <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
                      {[
                        { label: 'Total BT', value: `₹${teamBTAmt.toLocaleString()}`, color: '#e65100', bg: '#fff3e0' },
                        { label: 'BT Done', value: teamBTDone, color: '#0369a1', bg: '#e0f2fe' },
                        { label: 'RP Active', value: teamRP, color: '#7c3aed', bg: '#ede9fe' },
                        { label: 'Pass Live', value: teamLive, color: '#15803d', bg: '#d8f3dc' },
                        { label: 'Pending', value: teamPending, color: '#be123c', bg: '#ffe4e6' },
                      ].map(s => (
                        <Box key={s.label} sx={{ bgcolor: s.bg, px: 1.5, py: 0.75, borderRadius: 2, textAlign: 'center', minWidth: 80 }}>
                          <Typography sx={{ fontSize: 9, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</Typography>
                          <Typography sx={{ fontSize: 13, fontWeight: 800, color: s.color }}>{s.value}</Typography>
                        </Box>
                      ))}
                    </Box>

                    {/* Per-FSE table */}
                    <Box sx={{ overflowX: 'auto' }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ '& th': { fontWeight: 700, fontSize: 10, textTransform: 'uppercase', color: 'text.secondary', bgcolor: '#f5faf7' } }}>
                            <TableCell>FSE Name</TableCell>
                            <TableCell align="center">Total</TableCell>
                            <TableCell align="center">BT Done</TableCell>
                            <TableCell align="right">BT Amount</TableCell>
                            <TableCell align="center">RP Active</TableCell>
                            <TableCell align="center">Pass Live</TableCell>
                            <TableCell align="center">Pending</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {fseRows.map((f, i) => (
                            <TableRow key={i} hover sx={{ '&:hover': { bgcolor: '#f1fdf5' } }}>
                              <TableCell sx={{ fontWeight: 700, color: '#1a5c38', fontSize: 12 }}>{f.name}</TableCell>
                              <TableCell align="center" sx={{ fontSize: 12 }}>{f.total}</TableCell>
                              <TableCell align="center">
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: f.btDone > 0 ? '#0369a1' : '#999' }}>{f.btDone}</Typography>
                                  {f.total > 0 && <Typography sx={{ fontSize: 9, color: 'text.secondary' }}>({Math.round(f.btDone/f.total*100)}%)</Typography>}
                                </Box>
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 800, color: f.btAmt > 0 ? '#e65100' : '#999', fontSize: 12 }}>
                                {f.btAmt > 0 ? `₹${f.btAmt.toLocaleString()}` : '–'}
                              </TableCell>
                              <TableCell align="center">
                                <Typography sx={{ fontSize: 12, fontWeight: 700, color: f.rpActive > 0 ? '#7c3aed' : '#999' }}>{f.rpActive || '–'}</Typography>
                              </TableCell>
                              <TableCell align="center">
                                <Typography sx={{ fontSize: 12, fontWeight: 700, color: f.passLive > 0 ? '#15803d' : '#999' }}>{f.passLive || '–'}</Typography>
                              </TableCell>
                              <TableCell align="center">
                                <Typography sx={{ fontSize: 12, fontWeight: 700, color: f.pending > 0 ? '#be123c' : '#999' }}>{f.pending || '–'}</Typography>
                              </TableCell>
                            </TableRow>
                          ))}
                          {/* Totals row */}
                          <TableRow sx={{ bgcolor: '#f0fdf4', '& td': { fontWeight: 800, fontSize: 12, borderTop: '2px solid #c8e6c9' } }}>
                            <TableCell sx={{ color: '#1a5c38' }}>TOTAL ({fseRows.length} FSEs)</TableCell>
                            <TableCell align="center">{teamTotal}</TableCell>
                            <TableCell align="center" sx={{ color: '#0369a1' }}>{teamBTDone}</TableCell>
                            <TableCell align="right" sx={{ color: '#e65100' }}>₹{teamBTAmt.toLocaleString()}</TableCell>
                            <TableCell align="center" sx={{ color: '#7c3aed' }}>{teamRP}</TableCell>
                            <TableCell align="center" sx={{ color: '#15803d' }}>{teamLive}</TableCell>
                            <TableCell align="center" sx={{ color: '#be123c' }}>{teamPending}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </Box>
                  </Box>
                );
              })()}
            </Box>
          )}
        </Box>
      </Collapse>

      {/* Merchant detail dialog */}
      <Dialog open={!!selectedMerchant} onClose={() => setSelectedMerchant(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ background: 'linear-gradient(135deg,#1a5c38,#2d6a4f)', color:'#fff', fontWeight:800, fontSize:14 }}>
          🏪 {selectedMerchant?.merchantName}
          <IconButton onClick={() => setSelectedMerchant(null)} sx={{ color:'#fff', position:'absolute', right:8, top:8 }}><CloseIcon fontSize="small" /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {selectedMerchant && [
            ['Mobile', selectedMerchant.merchantNumber],
            ['FSE', selectedMerchant.fseName],
            ['Status', selectedMerchant.onboardingStatus],
            ['BT Amount', selectedMerchant.stage3>0?`₹${selectedMerchant.stage3.toLocaleString()}`:null],
            ['RP', (selectedMerchant.rewardPassPro||'').toLowerCase()==='active'?'Active':null],
            ['Pass Live', (selectedMerchant.passLive||'').toLowerCase()==='live'?'Live ✓':null],
            ['Last Activity', fmtDate(selectedMerchant.lastActivity)],
          ].filter(([,v])=>v).map(([label,value])=>(
            <Box key={label} sx={{ display:'flex', justifyContent:'space-between', py:1, borderBottom:'1px solid #f1f5f9' }}>
              <Typography variant="caption" color="text.secondary">{label}</Typography>
              <Typography variant="body2" fontWeight={600}>{value}</Typography>
            </Box>
          ))}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function KpiDrillContent({ kpiDrillData, kpiDialog }) {
  const [expandedTl, setExpandedTl] = useState(null);
  const [expandedFse, setExpandedFse] = useState(null);
  const [drillSearch, setDrillSearch] = useState('');

  // Reset FSE expansion if TL collapses/changes
  const handleTlClick = (tlName) => {
    if (expandedTl === tlName) {
      setExpandedTl(null);
      setExpandedFse(null);
    } else {
      setExpandedTl(tlName);
      setExpandedFse(null);
    }
  };

  const filteredMerchants = useMemo(() => {
    if (!drillSearch) return kpiDrillData;
    const q = drillSearch.toLowerCase();
    return kpiDrillData.filter(m =>
      (m.merchantName || '').toLowerCase().includes(q) ||
      (m.merchantNumber || '').includes(q) ||
      (m.fseName || '').toLowerCase().includes(q) ||
      (m.tlName || m.tl || '').toLowerCase().includes(q)
    );
  }, [kpiDrillData, drillSearch]);

  const hierarchy = useMemo(() => {
    const tls = {};
    filteredMerchants.forEach(m => {
      const tlName = m.tlName || m.tl || 'Unassigned TL';
      const fseName = m.fseName || 'Unassigned FSE';

      if (!tls[tlName]) {
        tls[tlName] = {
          name: tlName,
          merchants: [],
          fses: {}
        };
      }

      tls[tlName].merchants.push(m);

      if (!tls[tlName].fses[fseName]) {
        tls[tlName].fses[fseName] = {
          name: fseName,
          merchants: []
        };
      }
      tls[tlName].fses[fseName].merchants.push(m);
    });

    return Object.values(tls).map(tl => {
      const fseList = Object.values(tl.fses).map(fse => {
        const getBT = (m) => kpiDialog === 'yesterday-bt' ? (m.yesterdaysStage3||0) : (m.stage3||0);
        const fseBT = fse.merchants.reduce((sum, m) => sum + getBT(m), 0);
        const fseRPActive = fse.merchants.filter(m => (m.rewardPassPro || '').toLowerCase() === 'active').length;
        const fseRPPending = fse.merchants.filter(m => (m.stage3 || 0) >= 10000 && (m.rewardPassPro || '').toLowerCase() !== 'active').length;

        return {
          name: fse.name,
          employeeCode: getEmpCode(fse.name),
          merchants: fse.merchants,
          merchantCount: fse.merchants.length,
          btAmount: fseBT,
          rpActiveCount: fseRPActive,
          rpPendingCount: fseRPPending
        };
      });

      const getBTtl = (m) => kpiDialog === 'yesterday-bt' ? (m.yesterdaysStage3||0) : (m.stage3||0);
      const tlBT = tl.merchants.reduce((sum, m) => sum + getBTtl(m), 0);
      const tlRPActive = tl.merchants.filter(m => (m.rewardPassPro || '').toLowerCase() === 'active').length;
      const tlRPPending = tl.merchants.filter(m => (m.stage3 || 0) >= 10000 && (m.rewardPassPro || '').toLowerCase() !== 'active').length;

      return {
        name: tl.name,
        fses: fseList,
        merchants: tl.merchants,
        fseCount: fseList.length,
        merchantCount: tl.merchants.length,
        btAmount: tlBT,
        rpActiveCount: tlRPActive,
        rpPendingCount: tlRPPending
      };
    }).sort((a, b) => b.btAmount - a.btAmount);
  }, [filteredMerchants]);

  const tlCount = hierarchy.length;
  const totalMerchantsCount = filteredMerchants.length;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', maxHeight: '75vh', overflow: 'hidden' }}>
      {/* Search Input inside Dialog */}
      <Box sx={{ p: 2, borderBottom: '1px solid #e8f3ed', bgcolor: '#fcfdfd' }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search by Merchant Name, Mobile, FSE, or TL..."
          value={drillSearch}
          onChange={(e) => setDrillSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: 'text.secondary', fontSize: 18 }} />
              </InputAdornment>
            ),
            endAdornment: drillSearch && (
              <IconButton size="small" onClick={() => setDrillSearch('')}>
                <CloseIcon sx={{ fontSize: 14 }} />
              </IconButton>
            )
          }}
        />
      </Box>

      {/* Dynamic Breadcrumbs */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 3, py: 1.5, bgcolor: '#f4fbf7', borderBottom: '1px solid #e2ece7', flexWrap: 'wrap' }}>
        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, mr: 0.5 }}>
          Path:
        </Typography>
        <Button
          size="small"
          onClick={() => { setExpandedTl(null); setExpandedFse(null); }}
          sx={{
            textTransform: 'none',
            fontWeight: !expandedTl ? 700 : 500,
            color: !expandedTl ? '#1a5c38' : 'text.secondary',
            minWidth: 0,
            p: 0,
            fontSize: '0.8rem',
            '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' }
          }}
        >
          All TLs
        </Button>
        {expandedTl && (
          <>
            <Typography variant="caption" color="text.secondary">➔</Typography>
            <Button
              size="small"
              onClick={() => setExpandedFse(null)}
              sx={{
                textTransform: 'none',
                fontWeight: !expandedFse ? 700 : 500,
                color: !expandedFse ? '#1a5c38' : 'text.secondary',
                minWidth: 0,
                p: 0,
                fontSize: '0.8rem',
                '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' }
              }}
            >
              TL: {expandedTl}
            </Button>
          </>
        )}
        {expandedFse && (
          <>
            <Typography variant="caption" color="text.secondary">➔</Typography>
            <Typography variant="caption" fontWeight={700} color="#1a5c38" sx={{ fontSize: '0.8rem' }}>
              FSE: {expandedFse}
            </Typography>
          </>
        )}
      </Box>

      {/* Info Badge */}
      <Box sx={{ px: 3, py: 1, bgcolor: '#fffbeb', borderBottom: '1px solid #fef3c7' }}>
        <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontWeight: 500, color: '#b45309' }}>
          💡 Totals are derived from active merchant records. Click any row to expand its details.
        </Typography>
      </Box>

      {/* Scrollable Hierarchy Content */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 0 }}>
        {hierarchy.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">No matching records found.</Typography>
          </Box>
        ) : (
          hierarchy.map(tl => {
            const isTlExpanded = expandedTl === tl.name;
            return (
              <Box key={tl.name} sx={{ borderBottom: '1px solid #e2ece7', bgcolor: '#fff' }}>
                {/* Level 1: TL Header Card */}
                <Box
                  onClick={() => handleTlClick(tl.name)}
                  sx={{
                    px: 3,
                    py: 2,
                    bgcolor: isTlExpanded ? '#e8f5e9' : '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.2s',
                    borderLeft: isTlExpanded ? '4px solid #1a5c38' : '4px solid transparent',
                    '&:hover': { bgcolor: '#f1f8f3' }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar sx={{ bgcolor: '#1a5c38', width: 36, height: 36, fontSize: 13, fontWeight: 700 }}>
                      {initials(tl.name)}
                    </Avatar>
                    <Box>
                      <Typography variant="subtitle2" fontWeight={800} color="#1a5c38" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        TL: {tl.name}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1.5, mt: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">
                          FSEs: <strong>{tl.fseCount}</strong>
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Merchants: <strong>{tl.merchantCount}</strong>
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      <Chip label={`BT: ₹${tl.btAmount.toLocaleString()}`} size="small" sx={{ bgcolor: '#fff3e0', color: '#e65100', fontWeight: 700, fontSize: 10 }} />
                      <Chip label={`RP Active: ${tl.rpActiveCount}`} size="small" sx={{ bgcolor: '#ede9fe', color: '#7c3aed', fontWeight: 700, fontSize: 10 }} />
                      <Chip label={`RP Pend: ${tl.rpPendingCount}`} size="small" sx={{ bgcolor: '#fef3c7', color: '#92400e', fontWeight: 700, fontSize: 10 }} />
                    </Box>
                    {isTlExpanded ? <ExpandLessIcon sx={{ color: '#1a5c38' }} /> : <ExpandMoreIcon sx={{ color: '#1a5c38' }} />}
                  </Box>
                </Box>

                {/* Level 2: FSE Cards inside TL */}
                <Collapse in={isTlExpanded}>
                  <Box sx={{ bgcolor: '#f9fafb', p: 2, pl: 4, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.2 }}>
                      FSE Teams under {tl.name}
                    </Typography>
                    {tl.fses.length === 0 ? (
                      <Typography variant="caption" color="text.secondary">No FSEs under this TL.</Typography>
                    ) : (
                      tl.fses.map(fse => {
                        const isFseExpanded = expandedFse === fse.name;
                        return (
                          <Box key={fse.name} sx={{ border: '1.5px solid #e2ece7', borderRadius: 2, bgcolor: '#fff', overflow: 'hidden' }}>
                            <Box
                              onClick={() => setExpandedFse(isFseExpanded ? null : fse.name)}
                              sx={{
                                px: 2,
                                py: 1.5,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                bgcolor: isFseExpanded ? '#f0fdf4' : '#fff',
                                '&:hover': { bgcolor: '#f9fafb' }
                              }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                <Avatar sx={{ bgcolor: '#2e7d32', width: 28, height: 28, fontSize: 11, fontWeight: 700 }}>
                                  {initials(fse.name)}
                                </Avatar>
                                <Box>
                                  <Typography variant="body2" fontWeight={700} color="#2e7d32">
                                    FSE: {fse.name}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    Emp Code: <strong>{fse.employeeCode}</strong> · {fse.merchantCount} merchants
                                  </Typography>
                                </Box>
                              </Box>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Box sx={{ display: 'flex', gap: 0.5 }}>
                                  <Chip label={`${kpiDialog === 'yesterday-bt' ? "Yest BT" : "BT"}: ₹${fse.btAmount.toLocaleString()}`} size="small" sx={{ bgcolor: '#fff3e0', color: '#e65100', fontWeight: 700, fontSize: 9, height: 20 }} />
                                  <Chip label={`RP Act: ${fse.rpActiveCount}`} size="small" sx={{ bgcolor: '#ede9fe', color: '#7c3aed', fontWeight: 700, fontSize: 9, height: 20 }} />
                                  <Chip label={`RP Pend: ${fse.rpPendingCount}`} size="small" sx={{ bgcolor: '#fef3c7', color: '#92400e', fontWeight: 700, fontSize: 9, height: 20 }} />
                                </Box>
                                {isFseExpanded ? <ExpandLessIcon fontSize="small" sx={{ color: '#2e7d32' }} /> : <ExpandMoreIcon fontSize="small" sx={{ color: '#2e7d32' }} />}
                              </Box>
                            </Box>

                            {/* Level 3: Merchants under active FSE */}
                            <Collapse in={isFseExpanded}>
                              <Box sx={{ borderTop: '1px solid #e8f3ed', overflowX: 'auto' }}>
                                <Table size="small">
                                  <TableHead>
                                    <TableRow sx={{ bgcolor: '#f5faf7', '& th': { fontWeight: 700, fontSize: 10, color: 'text.secondary', textTransform: 'uppercase' } }}>
                                      <TableCell>Merchant Name</TableCell>
                                      <TableCell>Mobile Number</TableCell>
                                      <TableCell align="right">{kpiDialog === 'yesterday-bt' ? "Yesterday's BT" : 'BT Amount'}</TableCell>
                                      <TableCell>RP Status</TableCell>
                                      <TableCell>Pass Live</TableCell>
                                      <TableCell>Onboarding Status</TableCell>
                                      <TableCell align="right">UPI Txns</TableCell>
                                      <TableCell>Last Activity</TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {fse.merchants.map((m, i) => {
                                      const isRpActive = (m.rewardPassPro || '').toLowerCase() === 'active';
                                      const isPassLive = (m.passLive || '').toLowerCase() === 'live';
                                      return (
                                        <TableRow key={i} hover sx={{ '&:hover': { bgcolor: '#f1fdf5' } }}>
                                          <TableCell sx={{ fontWeight: 700, color: '#333', fontSize: 12 }}>
                                            {m.merchantName || '–'}
                                          </TableCell>
                                          <TableCell sx={{ fontFamily: 'monospace', fontSize: 11, color: '#555' }}>
                                            {m.merchantNumber || '–'}
                                          </TableCell>
                                          <TableCell align="right" sx={{ fontWeight: 800, fontSize: 12,
                                            color: (kpiDialog === 'yesterday-bt' ? (m.yesterdaysStage3||0) : (m.stage3||0)) > 0 ? '#e65100' : '#999' }}>
                                            {(() => {
                                              const val = kpiDialog === 'yesterday-bt' ? (m.yesterdaysStage3||0) : (m.stage3||0);
                                              return val > 0 ? `₹${val.toLocaleString()}` : '–';
                                            })()}
                                          </TableCell>
                                          <TableCell>
                                            {isRpActive ? (
                                              <Chip label="Active" size="small" sx={{ bgcolor: '#ede9fe', color: '#7c3aed', fontWeight: 700, fontSize: 9, height: 18 }} />
                                            ) : (
                                              <Chip label="Pending" size="small" sx={{ bgcolor: '#fef3c7', color: '#92400e', fontWeight: 700, fontSize: 9, height: 18 }} />
                                            )}
                                          </TableCell>
                                          <TableCell>
                                            {isPassLive ? (
                                              <Chip label="Live ✓" size="small" sx={{ bgcolor: '#d8f3dc', color: '#1a4731', fontWeight: 700, fontSize: 9, height: 18 }} />
                                            ) : (
                                              <Chip label="–" size="small" sx={{ bgcolor: '#f5f5f5', color: '#999', fontSize: 9, height: 18 }} />
                                            )}
                                          </TableCell>
                                          <TableCell>
                                            <Chip
                                              label={m.onboardingStatus || 'Pending'}
                                              size="small"
                                              sx={{
                                                fontSize: 9,
                                                fontWeight: 700,
                                                height: 18,
                                                bgcolor: m.onboardingStatus === 'Onboarded' ? '#d8f3dc' : m.onboardingStatus === 'BT Active' ? '#e0f2fe' : '#fef3c7',
                                                color: m.onboardingStatus === 'Onboarded' ? '#1a4731' : m.onboardingStatus === 'BT Active' ? '#0369a1' : '#92400e'
                                              }}
                                            />
                                          </TableCell>
                                          <TableCell align="right" sx={{ fontSize: 11, fontWeight: 600, color: m.upiTxnCount > 0 ? '#0369a1' : '#999' }}>
                                            {m.upiTxnCount > 0 ? m.upiTxnCount : '–'}
                                          </TableCell>
                                          <TableCell sx={{ fontSize: 10, color: 'text.secondary' }}>
                                            {fmtDate(m.lastActivity)}
                                          </TableCell>
                                        </TableRow>
                                      );
                                    })}
                                  </TableBody>
                                </Table>
                              </Box>
                            </Collapse>
                          </Box>
                        );
                      })
                    )}
                  </Box>
                </Collapse>
              </Box>
            );
          })
        )}
      </Box>

      {/* Summary Footer */}
      <Box sx={{ p: 2, textAlign: 'center', borderTop: '1px solid #e8f3ed', bgcolor: '#fbfcfb' }}>
        <Typography variant="caption" color="text.secondary" fontWeight={600}>
          Showing {totalMerchantsCount} merchants across {tlCount} active Team Leaders
        </Typography>
      </Box>
    </Box>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function TLOverview() {
  const [tls, setTls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [allMerchantsData, setAllMerchantsData] = useState([]);
  const [merchantsLoading, setMerchantsLoading] = useState(false);
  const [kpiDialog, setKpiDialog] = useState(null);
  const [kpiDrillData, setKpiDrillData] = useState([]);

  // Date filters
  const [dateFilter, setDateFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().toLocaleString('en-US', { month: 'long' }));

  // Form detail dialog
  const [formDetailOpen, setFormDetailOpen] = useState(false);
  const [selectedForm, setSelectedForm] = useState(null);

  useEffect(() => {
    fetchTLs();
  }, []);

  const fetchTLs = async () => {
    // Show cached instantly
    const cached = localStorage.getItem('admin_tls');
    if (cached) { try { setTls(JSON.parse(cached)); setLoading(false); } catch {} }
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/tl`);
      const tls = res.data.tls || [];
      setTls(tls);
      localStorage.setItem('admin_tls', JSON.stringify(tls));
    } catch (error) {
      console.error('Error fetching TLs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllMerchants = async () => {
    // all-details is too large for localStorage — fetch fresh each time
    setMerchantsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedMonth) params.set('selectedMonth', selectedMonth);
      if (selectedYear) params.set('selectedYear', selectedYear);
      const res = await axios.get(`${API_URL}/fse/merchants/all-details?${params}`);
      setAllMerchantsData(res.data.merchants || []);
    } catch (err) {
      console.error('Error fetching all merchants:', err);
    } finally {
      setMerchantsLoading(false);
    }
  };

  useEffect(() => { fetchAllMerchants(); }, [selectedMonth, selectedYear]);

  // Update drill data reactively when allMerchantsData loads
  useEffect(() => {
    if (!kpiDialog || allMerchantsData.length === 0) return;
    let drill = [];
    if (kpiDialog === 'bt-done')      drill = allMerchantsData.filter(m => (m.stage3||0)>0).sort((a,b)=>(b.stage3||0)-(a.stage3||0));
    if (kpiDialog === 'yesterday-bt') drill = allMerchantsData.filter(m => (m.yesterdaysStage3||0)>0).sort((a,b)=>(b.yesterdaysStage3||0)-(a.yesterdaysStage3||0));
    if (kpiDialog === 'rp-active')    drill = allMerchantsData.filter(m => (m.rewardPassPro||'').toLowerCase()==='active');
    if (kpiDialog === 'rp-pending')   drill = allMerchantsData.filter(m => (m.stage3||0)>=10000 && (m.rewardPassPro||'').toLowerCase()!=='active').sort((a,b)=>(b.stage3||0)-(a.stage3||0));
    setKpiDrillData(drill);
  }, [allMerchantsData, kpiDialog]);

  const handleViewForm = (form) => {
    setSelectedForm(form);
    setFormDetailOpen(true);
  };

  const filteredTLs = useMemo(() => {
    if (!search) return tls;
    const q = search.toLowerCase();
    return tls.filter(tl =>
      tl.name?.toLowerCase().includes(q) ||
      tl.phone?.includes(q) ||
      tl.email?.toLowerCase().includes(q)
    );
  }, [tls, search]);

  const totalFSEs = tls.reduce((sum, tl) => sum + (tl.fseCount || 0), 0);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress sx={{ color: '#1a5c38' }} />
      </Box>
    );
  }

  return (
    <Box p={3}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={800} sx={{ color: '#1a5c38' }}>
            TL Overview
          </Typography>
          <Typography variant="body2" color="text.secondary" component="div">
            {tls.length} Team Leaders · {totalFSEs} total FSEs
          </Typography>
        </Box>
        <Button startIcon={<RefreshIcon />} onClick={fetchTLs} variant="outlined"
          sx={{ color: '#1a5c38', borderColor: '#1a5c38', fontWeight: 700, '&:hover': { bgcolor: '#e6f4ea' } }}>
          Refresh
        </Button>
      </Box>

      {/* Overall Summary chips */}
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
        {[
          { label: 'Team Leaders', value: tls.length, bg: '#1a5c38', color: '#fff' },
          { label: 'Total FSEs', value: totalFSEs, bg: '#e6f4ea', color: '#1a5c38' },
        ].map(c => (
          <Chip key={c.label}
            label={`${c.value} ${c.label}`}
            sx={{ bgcolor: c.bg, color: c.color, fontWeight: 700, fontSize: 12 }} />
        ))}
      </Box>

      {/* BT Performance KPI Cards — all TLs combined */}
      {(() => {
        const totalBT      = allMerchantsData.reduce((s,m) => s+(m.stage3||0), 0);
        const yesterdaysBT = allMerchantsData.reduce((s,m) => s+(m.yesterdaysStage3||0), 0);
        const rpActive     = allMerchantsData.filter(m => (m.rewardPassPro||'').toLowerCase()==='active').length;
        const rpPending    = allMerchantsData.filter(m => (m.stage3||0)>=10000 && (m.rewardPassPro||'').toLowerCase()!=='active').length;
        const btMerchants  = allMerchantsData.filter(m => (m.stage3||0)>0).length;
        const kpis = [
          { key:'bt-done',      label:'Total BT Completed', value: merchantsLoading?'…':`₹${totalBT.toLocaleString()}`,      sub:`${btMerchants} merchants`,   icon:'💰', color:'#e65100', bg:'#fff3e0', border:'#e6510030' },
          { key:'yesterday-bt', label:"Yesterday's BT",     value: merchantsLoading?'…':`₹${yesterdaysBT.toLocaleString()}`, sub:'BT done yesterday',          icon:'📈', color:'#0369a1', bg:'#e0f2fe', border:'#0369a130' },
          { key:'rp-active',    label:'Total RP Active',    value: merchantsLoading?'…':rpActive,                             sub:'Reward Pass activated',       icon:'🏅', color:'#7c3aed', bg:'#ede9fe', border:'#7c3aed30' },
          { key:'rp-pending',   label:'RP Pending',         value: merchantsLoading?'…':rpPending,                            sub:'BT ≥ ₹10k, RP not activated', icon:'🎁', color:'#92400e', bg:'#fef3c7', border:'#92400e30' },
        ];
        return (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 2, mb: 3 }}>
            {kpis.map(kpi => (
              <Card key={kpi.key} onClick={() => {
                let drill = [];
                if (kpi.key === 'bt-done')      drill = allMerchantsData.filter(m => (m.stage3||0)>0).sort((a,b)=>(b.stage3||0)-(a.stage3||0));
                if (kpi.key === 'yesterday-bt') drill = allMerchantsData.filter(m => (m.yesterdaysStage3||0)>0).sort((a,b)=>(b.yesterdaysStage3||0)-(a.yesterdaysStage3||0));
                if (kpi.key === 'rp-active')    drill = allMerchantsData.filter(m => (m.rewardPassPro||'').toLowerCase()==='active');
                if (kpi.key === 'rp-pending')   drill = allMerchantsData.filter(m => (m.stage3||0)>=10000 && (m.rewardPassPro||'').toLowerCase()!=='active').sort((a,b)=>(b.stage3||0)-(a.stage3||0));
                setKpiDrillData(drill);
                setKpiDialog(kpi.key);
                // If data not loaded yet, trigger load
                if (allMerchantsData.length === 0 && !merchantsLoading) fetchAllMerchants();
              }}
                sx={{ border:`1.5px solid ${kpi.border}`, borderRadius:2, cursor:'pointer', transition:'all 0.2s', '&:hover':{boxShadow:4,transform:'translateY(-2px)'} }}>
                <CardContent sx={{ py:2, px:2.5, '&:last-child':{pb:2} }}>
                  <Box sx={{ display:'flex', alignItems:'center', gap:1, mb:1 }}>
                    <Box sx={{ width:36,height:36,borderRadius:2,background:kpi.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18 }}>{kpi.icon}</Box>
                    <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform:'uppercase', letterSpacing:0.5 }}>{kpi.label}</Typography>
                  </Box>
                  <Typography variant="h5" fontWeight={800} color={kpi.color}>{kpi.value}</Typography>
                  <Typography variant="caption" color="text.secondary">{kpi.sub} · Click to drill down →</Typography>
                </CardContent>
              </Card>
            ))}
          </Box>
        );
      })()}

      {/* Date Filter */}
      <DateFilter
        dateFilter={dateFilter} setDateFilter={setDateFilter}
        fromDate={fromDate} setFromDate={setFromDate}
        toDate={toDate} setToDate={setToDate}
        selectedYear={selectedYear} setSelectedYear={setSelectedYear}
        selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth}
      />

      {/* Search */}
      <TextField
        fullWidth size="small"
        placeholder="Search TL by name, phone or email..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        sx={{ mb: 3, maxWidth: 400 }}
        InputProps={{
          startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: 'text.secondary' }} /></InputAdornment>
        }}
      />

      {/* TL Cards */}
      {filteredTLs.length === 0 ? (
        <Card sx={{ textAlign: 'center', py: 6, border: '1.5px dashed #c8e6c9' }}>
          <Typography color="text.secondary">No TLs found.</Typography>
        </Card>
      ) : (
        filteredTLs
          .sort((a, b) => (b.fseCount || 0) - (a.fseCount || 0))
          .map(tl => (
            <TLCard key={tl.name} tl={tl} onViewForm={handleViewForm}
              dateFilter={dateFilter} fromDate={fromDate} toDate={toDate}
              selectedYear={selectedYear} selectedMonth={selectedMonth} />
          ))
      )}

      {/* KPI Drill-down Dialog — TL → FSE → Merchant hierarchy */}
      <Dialog open={!!kpiDialog} onClose={() => { setKpiDialog(null); setKpiDrillData([]); }} maxWidth="md" fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}>
        <Box sx={{ background: 'linear-gradient(135deg, #1a5c38, #2d6a4f)', px: 3, py: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h6" fontWeight={800} color="#fff">
              {kpiDialog === 'bt-done' ? '💰 BT Completed' : kpiDialog === 'rp-active' ? '🏅 RP Active' : '🎁 RP Pending'}
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.75)' }}>{kpiDrillData.length} merchants · {selectedMonth} {selectedYear}</Typography>
          </Box>
          <IconButton onClick={() => { setKpiDialog(null); setKpiDrillData([]); }} sx={{ color: '#fff', bgcolor: 'rgba(255,255,255,0.15)' }}><CloseIcon fontSize="small" /></IconButton>
        </Box>
        <DialogContent sx={{ p: 0 }}>
          {merchantsLoading && kpiDrillData.length === 0 ? (
            <Box display="flex" flexDirection="column" alignItems="center" py={6} gap={2}>
              <CircularProgress sx={{ color: '#1a5c38' }} />
              <Typography variant="body2" color="text.secondary">Loading merchant data...</Typography>
            </Box>
          ) : kpiDrillData.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">No merchants found for this filter.</Typography>
            </Box>
          ) : (
            <KpiDrillContent kpiDrillData={kpiDrillData} kpiDialog={kpiDialog} />
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => { setKpiDialog(null); setKpiDrillData([]); }} sx={{ color: '#1a5c38', fontWeight: 700 }}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Form Detail Dialog */}
      <Dialog open={formDetailOpen} onClose={() => setFormDetailOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}>
        <Box sx={{ 
          background: selectedForm?.formType === 'mobikwik-withdraw'
            ? 'linear-gradient(135deg, #7e22cedd, #7e22ce88)'
            : 'linear-gradient(135deg, #1a5c38dd, #1a5c3888)', 
          px: 3, py: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' 
        }}>
          <Box>
            <Typography variant="overline" sx={{ color: 'rgba(255,255,255,0.8)', fontSize: 10, letterSpacing: 1.5 }}>
              {selectedForm?.formType === 'mobikwik-withdraw' ? 'MOBIKWIK TRANSACTION' : 'MERCHANT DETAILS'}
            </Typography>
            <Typography variant="h6" sx={{ color: '#fff', fontWeight: 800 }}>
              {selectedForm?.merchantName || selectedForm?.customerName || '-'}
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.75)' }}>
              FSE: {selectedForm?.employeeName || selectedForm?.fse || '-'}
            </Typography>
          </Box>
          <IconButton onClick={() => setFormDetailOpen(false)} sx={{ color: '#fff', bgcolor: 'rgba(255,255,255,0.15)' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
        <DialogContent sx={{ p: 3 }}>
          {selectedForm && (
            selectedForm.formType === 'mobikwik-withdraw' ? (
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2.5 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>Customer/Merchant Name</Typography>
                  <Typography variant="body1" fontWeight={700}>{selectedForm.merchantName || selectedForm.customerName || '-'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>Customer/Merchant Mobile</Typography>
                  <Typography variant="body1" fontWeight={700} sx={{ fontFamily: 'monospace' }}>{selectedForm.merchantNumber || selectedForm.customerNumber || '-'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>Withdraw Amount</Typography>
                  <Typography variant="body1" fontWeight={700} color="#2e7d32">₹{selectedForm.withdrawAmount || 0}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>Withdraw Fees</Typography>
                  <Typography variant="body1" fontWeight={700} color="#c62828">₹{Math.round((selectedForm.withdrawAmount || 0) * 0.03 * 100) / 100}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>Reason of Withdraw</Typography>
                  <Typography variant="body2">{selectedForm.reasonOfWithdraw || '-'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>Transaction Date</Typography>
                  <Typography variant="body2">{selectedForm.transactionDate || '-'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>TL</Typography>
                  <Typography variant="body2">{selectedForm.tl || '-'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>Submitted By (FSE)</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                    <Avatar sx={{ width: 24, height: 24, fontSize: 10, bgcolor: '#7e22ce' }}>
                      {initials(selectedForm.employeeName || selectedForm.fse)}
                    </Avatar>
                    <Typography variant="body2" fontWeight={600}>{selectedForm.employeeName || selectedForm.fse || '-'}</Typography>
                  </Box>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>Date Synced</Typography>
                  <Typography variant="body2">
                    {selectedForm.createdAt ? new Date(selectedForm.createdAt).toLocaleString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                    }) : '-'}
                  </Typography>
                </Box>
              </Box>
            ) : (
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2.5 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>Merchant Name</Typography>
                  <Typography variant="body1" fontWeight={700}>{selectedForm.merchantName || '-'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>Mobile Number</Typography>
                  <Typography variant="body1" fontWeight={700} sx={{ fontFamily: 'monospace' }}>{selectedForm.merchantNumber || '-'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>Email</Typography>
                  <Typography variant="body2">{selectedForm.merchantEmailId || '-'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>Category</Typography>
                  <Box mt={0.5}><CategoryChip category={selectedForm.merchantCategory} /></Box>
                </Box>
                <Box sx={{ gridColumn: '1 / -1', borderBottom: '1px solid #eee', my: 0.5 }} />
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>Merchant Opinion</Typography>
                  <Box mt={0.5}><StatusChip status={selectedForm.merchantOpinion} /></Box>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>Onboarding Status</Typography>
                  <Box mt={0.5}><StatusChip status={selectedForm.onboardingStatus} /></Box>
                </Box>
                <Box sx={{ gridColumn: '1 / -1', borderBottom: '1px solid #eee', my: 0.5 }} />
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>Submitted By</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                    <Avatar sx={{ width: 24, height: 24, fontSize: 10, bgcolor: '#1a5c38' }}>
                      {initials(selectedForm.employeeName)}
                    </Avatar>
                    <Typography variant="body2" fontWeight={600}>{selectedForm.employeeName || '-'}</Typography>
                  </Box>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>Date & Time</Typography>
                  <Typography variant="body2">
                    {selectedForm.createdAt ? new Date(selectedForm.createdAt).toLocaleString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                    }) : '-'}
                  </Typography>
                </Box>
              </Box>
            )
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setFormDetailOpen(false)} sx={{ color: '#1a5c38', fontWeight: 700 }}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
