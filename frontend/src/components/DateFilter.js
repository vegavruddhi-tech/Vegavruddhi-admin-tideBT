import React from 'react';
import { Box, Button, TextField, MenuItem } from '@mui/material';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function DateFilter({ dateFilter, setDateFilter, fromDate, setFromDate, toDate, setToDate, selectedYear, setSelectedYear, selectedMonth, setSelectedMonth }) {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = currentYear; y >= currentYear - 5; y--) years.push(y);

  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', mb: 2 }}>
      {['all', 'today', 'month'].map(f => (
        <Button key={f} size="small"
          variant={dateFilter === f ? 'contained' : 'outlined'}
          onClick={() => { setDateFilter(f); setFromDate(''); setToDate(''); }}
          sx={{
            fontWeight: 700, textTransform: 'capitalize',
            bgcolor: dateFilter === f ? '#1a5c38' : 'transparent',
            borderColor: '#1a5c38', color: dateFilter === f ? '#fff' : '#1a5c38',
            '&:hover': { bgcolor: dateFilter === f ? '#0f3320' : '#e6f4ea' }
          }}>
          {f === 'all' ? 'All' : f === 'today' ? 'Today' : 'This Month'}
        </Button>
      ))}

      <TextField size="small" type="date" label="From" value={fromDate}
        onChange={e => { setFromDate(e.target.value); setDateFilter('custom'); }}
        InputLabelProps={{ shrink: true }} sx={{ minWidth: 150 }} />
      <TextField size="small" type="date" label="To" value={toDate}
        onChange={e => { setToDate(e.target.value); setDateFilter('custom'); }}
        InputLabelProps={{ shrink: true }} sx={{ minWidth: 150 }} />

      <TextField select size="small" label="Year" value={selectedYear}
        onChange={e => setSelectedYear(e.target.value)}
        sx={{ minWidth: 100 }}>
        {years.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
      </TextField>

      <TextField select size="small" label="Month" value={selectedMonth}
        onChange={e => setSelectedMonth(e.target.value)}
        sx={{ minWidth: 120 }}>
        <MenuItem value="">All</MenuItem>
        {MONTHS.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
      </TextField>

      {(dateFilter !== 'all' || fromDate || toDate || selectedMonth) && (
        <Button size="small" variant="outlined" color="error"
          onClick={() => { setDateFilter('all'); setFromDate(''); setToDate(''); setSelectedMonth(''); setSelectedYear(currentYear); }}
          sx={{ fontWeight: 700 }}>
          Reset
        </Button>
      )}
    </Box>
  );
}
