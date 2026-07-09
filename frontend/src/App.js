import React, { useState, useEffect } from "react";
import Dashboard from "./pages/Dashboard";
import FSEOverview from "./pages/FSEOverview";
import TLOverview from "./pages/TLOverview";
import BTForms from "./pages/BTForms";
import MobikwikForms from "./pages/MobikwikForms";
import FundTransfer from "./pages/FundTransfer";
import Reports from "./pages/Reports"; // eslint-disable-line no-unused-vars
import TLPerformance from "./pages/TLPerformance"; // eslint-disable-line no-unused-vars
import FSEPerformance from "./pages/FSEPerformance"; // eslint-disable-line no-unused-vars
import FinanceReport from "./pages/FinanceReport"; // eslint-disable-line no-unused-vars
import SetTargets from "./pages/SetTargets";
import Attendance from "./pages/Attendance";
import Login from "./pages/Login";

import { ThemeProvider, createTheme, useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import CssBaseline from "@mui/material/CssBaseline";
import IconButton from "@mui/material/IconButton";
import Box from "@mui/material/Box";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import Button from "@mui/material/Button";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";

import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuIcon from "@mui/icons-material/Menu";

import { BRAND } from "./theme";
import "./App.css";

const NAV_ITEMS = [
  { value: "dashboard",       label: "Dashboard" },
  { value: "fse",             label: "FSE Overview" },
  { value: "tl",              label: "TL Overview" },
  { value: "set-targets",     label: "Set Targets" },
  { value: "fund-transfer",   label: "Fund Transfer" },
  { value: "mobikwik-forms",  label: "Mobikwik Forms" },
  { value: "attendance",      label: "Attendance" },
];

// ── Responsive Navbar inner component (needs theme/breakpoints) ──
function NavbarContent({ page, setPage, mode, setMode, user, handleLogout }) {
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleNav = (val) => {
    setPage(val);
    localStorage.setItem("vv_tidebt_page", val);
    setDrawerOpen(false);
  };

  return (
    <>
      {/* ── NAVBAR BAR ─────────────────────────────────────────── */}
      <Box
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 1100,
          background: "linear-gradient(90deg, #071a0f 0%, #0f3320 40%, #1a5c38 100%)",
          borderBottom: `2.5px solid ${BRAND.accent}`,
          px: { xs: 2, md: 4 },
          py: 0,
          height: 62,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 2px 20px rgba(0,0,0,0.55)",
        }}
      >
        {/* LEFT — Logo + Brand */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexShrink: 0 }}>
          <Box
            component="img"
            src="/logo-full.png"
            alt="Vegavruddhi"
            sx={{
              height: 44,
              width: 44,
              objectFit: "contain",
              filter: "brightness(0) invert(1)",
              animation: "pulse 3.5s ease-in-out infinite",
            }}
          />
          <Box sx={{ lineHeight: 1 }}>
            <Typography
              sx={{
                fontFamily: "'Georgia', serif",
                fontWeight: 700,
                fontSize: { xs: "0.85rem", md: "1.1rem" },
                color: "#ffffff",
                letterSpacing: 1.8,
                textTransform: "uppercase",
                lineHeight: 1.15,
              }}
            >
              Vegavruddhi
            </Typography>
            <Typography
              sx={{
                fontSize: "0.58rem",
                color: BRAND.accent,
                letterSpacing: 2.5,
                textTransform: "uppercase",
                fontWeight: 600,
              }}
            >
              Tide BT Admin
            </Typography>
          </Box>
        </Box>

        {/* RIGHT */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>

          {/* Desktop Tabs */}
          {!isMobile && (
            <>
              <Tabs
                value={page}
                onChange={(_, v) => handleNav(v)}
                textColor="inherit"
                variant="scrollable"
                scrollButtons="auto"
              >
                {NAV_ITEMS.map(item => (
                  <Tab key={item.value} value={item.value} label={item.label} />
                ))}
              </Tabs>
              <Box sx={{ width: "1px", height: 28, bgcolor: "rgba(255,255,255,0.15)", mx: 1 }} />
            </>
          )}

          {/* Theme toggle */}
          <Tooltip title={mode === "dark" ? "Light Mode" : "Dark Mode"}>
            <IconButton
              onClick={() => setMode((p) => (p === "light" ? "dark" : "light"))}
              sx={{
                color: "#fff",
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.18)",
                width: 36, height: 36,
                "&:hover": { background: "rgba(255,255,255,0.18)", transform: "rotate(22deg) scale(1.1)" },
                transition: "all 0.25s ease",
              }}
              size="small"
            >
              {mode === "light" ? <DarkModeIcon fontSize="small" /> : <LightModeIcon fontSize="small" />}
            </IconButton>
          </Tooltip>

          {/* Desktop: username + logout */}
          {!isMobile && (
            <>
              <Box sx={{ width: "1px", height: 28, bgcolor: "rgba(255,255,255,0.15)", mx: 1 }} />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {user?.picture && (
                  <Box component="img" src={user.picture} alt="avatar"
                    referrerPolicy="no-referrer"
                    onError={e => { e.target.style.display = 'none'; }}
                    sx={{ width: 30, height: 30, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)' }} />
                )}
                <Typography sx={{ color: "rgba(255,255,255,0.6)", fontSize: "0.75rem", mr: 1 }}>
                  {user?.username || user?.email}
                </Typography>
              </Box>
              <Tooltip title="Logout">
                <IconButton onClick={handleLogout}
                  sx={{
                    color: "#fff", background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.18)", width: 36, height: 36,
                    "&:hover": { background: "rgba(239,68,68,0.3)", borderColor: "#ef4444" },
                    transition: "all 0.25s ease",
                  }}
                  size="small"
                >
                  <LogoutIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}

          {/* Mobile: hamburger */}
          {isMobile && (
            <IconButton
              onClick={() => setDrawerOpen(true)}
              sx={{
                color: "#fff", background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.18)", width: 36, height: 36,
              }}
              size="small"
            >
              <MenuIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
      </Box>

      {/* ── MOBILE DRAWER ──────────────────────────────────────── */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: 260,
            background: "linear-gradient(180deg, #071a0f 0%, #0f3320 100%)",
            color: "#fff",
          }
        }}
      >
        {/* Drawer header */}
        <Box sx={{ px: 2.5, py: 2, display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box component="img" src="/logo-full.png" alt="logo"
            sx={{ height: 36, width: 36, objectFit: "contain", filter: "brightness(0) invert(1)" }} />
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: "0.9rem", color: "#fff", letterSpacing: 1.5, textTransform: "uppercase" }}>
              Vegavruddhi
            </Typography>
            <Typography sx={{ fontSize: "0.55rem", color: BRAND.accent, letterSpacing: 2, textTransform: "uppercase", fontWeight: 600 }}>
              Tide BT Admin
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ borderColor: "rgba(255,255,255,0.12)" }} />

        {/* User info */}
        <Box sx={{ px: 2.5, py: 1.5, display: "flex", alignItems: "center", gap: 1.5 }}>
          {user?.picture && (
            <Box component="img" src={user.picture} alt="avatar"
              referrerPolicy="no-referrer"
              onError={e => { e.target.style.display = 'none'; }}
              sx={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)" }} />
          )}
          <Typography sx={{ color: "rgba(255,255,255,0.7)", fontSize: "0.78rem", wordBreak: "break-all" }}>
            {user?.username || user?.email}
          </Typography>
        </Box>

        <Divider sx={{ borderColor: "rgba(255,255,255,0.12)" }} />

        {/* Nav items */}
        <List sx={{ pt: 1 }}>
          {NAV_ITEMS.map(item => (
            <ListItem key={item.value} disablePadding>
              <ListItemButton
                selected={page === item.value}
                onClick={() => handleNav(item.value)}
                sx={{
                  px: 2.5, py: 1.2,
                  borderRadius: 2, mx: 1, mb: 0.5,
                  "&.Mui-selected": {
                    bgcolor: `${BRAND.accent}22`,
                    borderLeft: `3px solid ${BRAND.accent}`,
                  },
                  "&:hover": { bgcolor: "rgba(255,255,255,0.08)" },
                }}
              >
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    fontSize: "0.88rem",
                    fontWeight: page === item.value ? 700 : 500,
                    color: page === item.value ? "#fff" : "rgba(255,255,255,0.7)",
                    letterSpacing: 0.5,
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>

        <Divider sx={{ borderColor: "rgba(255,255,255,0.12)", mt: "auto" }} />

        {/* Drawer footer actions */}
        <Box sx={{ px: 2, py: 2, display: "flex", gap: 1 }}>
          <Button
            fullWidth
            startIcon={mode === "light" ? <DarkModeIcon /> : <LightModeIcon />}
            onClick={() => setMode(p => p === "light" ? "dark" : "light")}
            sx={{ color: "rgba(255,255,255,0.7)", borderColor: "rgba(255,255,255,0.2)", fontSize: "0.78rem", fontWeight: 600 }}
            variant="outlined"
            size="small"
          >
            {mode === "light" ? "Dark" : "Light"}
          </Button>
          <Button
            fullWidth
            startIcon={<LogoutIcon />}
            onClick={() => { handleLogout(); setDrawerOpen(false); }}
            sx={{ color: "#ef4444", borderColor: "rgba(239,68,68,0.4)", fontSize: "0.78rem", fontWeight: 600 }}
            variant="outlined"
            size="small"
          >
            Logout
          </Button>
        </Box>
      </Drawer>
    </>
  );
}

function App() {
  const [mode, setMode] = useState("light");
  const [page, setPage] = useState(() => localStorage.getItem("vv_tidebt_page") || "dashboard");
  const [splash, setSplash] = useState(true);

  // Check for auth from both Tide BT and main Tide admin
  const [user, setUser] = useState(() => {
    // First check if auth is passed in URL (from Tide admin redirect)
    const params = new URLSearchParams(window.location.search);
    const authFromURL = params.get('auth');
    
    if (authFromURL) {
      try {
        const decoded = JSON.parse(decodeURIComponent(authFromURL));
        localStorage.setItem("vv_tidebt_auth", JSON.stringify(decoded));
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
        return decoded;
      } catch (e) {
        console.error('Failed to parse auth from URL:', e);
      }
    }
    
    // Check localStorage
    const tideBTAuth = localStorage.getItem("vv_tidebt_auth");
    const tideAuth = localStorage.getItem("vv_auth");
    const savedAuth = tideBTAuth || tideAuth;
    
    // If we got auth from main Tide, also save it to Tide BT
    if (tideAuth && !tideBTAuth) {
      localStorage.setItem("vv_tidebt_auth", tideAuth);
    }
    
    return savedAuth ? JSON.parse(savedAuth) : null;
  });

  // Hide splash after 1.5s
  useEffect(() => {
    const timer = setTimeout(() => setSplash(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleLogin  = (authObj) => {
    setUser(authObj);
    setSplash(true);
  };
  const handleLogout = () => {
    localStorage.removeItem("vv_tidebt_auth");
    setUser(null);
  };

  const theme = createTheme({
    palette: {
      mode,
      primary: { main: BRAND.primary, light: BRAND.primaryMid, dark: "#0d3d24" },
      secondary: { main: BRAND.accent },
      background: {
        default: mode === "dark" ? "#111827" : "#f0f7f3",
        paper:   mode === "dark" ? "#1c2a3a" : "#ffffff",
      },
      text: {
        primary:   mode === "dark" ? "#f1f5f9" : "#1a2e22",
        secondary: mode === "dark" ? "#94a3b8" : "#4a7060",
      },
    },
    typography: {
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
      h6: { fontWeight: 700, letterSpacing: 0.4 },
    },
    shape: { borderRadius: 12 },
    components: {
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 14,
            transition: "box-shadow 0.25s, transform 0.2s",
            ...(mode === "dark" && {
              background: "#1e2d3d",
              border: "1px solid rgba(255,255,255,0.07)",
            }),
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            ...(mode === "dark" && { background: "#1e2d3d" }),
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            fontWeight: 600,
            fontSize: "0.82rem",
            letterSpacing: 1,
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.65)",
            minWidth: 80,
            "&.Mui-selected": { color: "#ffffff" },
            transition: "color 0.2s",
          },
        },
      },
      MuiTabs: {
        styleOverrides: {
          indicator: { backgroundColor: BRAND.accent, height: 3, borderRadius: 2 },
        },
      },
    },
  });

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />

      {/* ── SPLASH SCREEN ─────────────────────────────────────── */}
      <style>{`
        @keyframes splashLogoIn {
          0%   { opacity: 0; transform: scale(0.7); }
          60%  { opacity: 1; transform: scale(1.08); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes splashBar {
          0%   { width: 0%; margin-left: 0%; }
          50%  { width: 60%; margin-left: 20%; }
          100% { width: 0%; margin-left: 100%; }
        }
      `}</style>
      {splash && (
        <Box sx={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999,
          bgcolor: '#071a0f',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 3,
          overflow: 'hidden',
        }}>
          <Box sx={{ animation: 'splashLogoIn 0.8s ease forwards', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
            <Box component="img" src="/logo-full.png" alt="Vegavruddhi"
              sx={{ width: 80, height: 80, objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
            <Typography sx={{ color: '#fff', fontFamily: "'Georgia', serif", fontWeight: 700, fontSize: '1.4rem', letterSpacing: 3, textTransform: 'uppercase' }}>
              Vegavruddhi
            </Typography>
            <Typography sx={{ color: BRAND.accent, fontSize: '0.65rem', letterSpacing: 4, textTransform: 'uppercase', fontWeight: 600 }}>
              Tide BT Admin
            </Typography>
          </Box>
          {/* Progress bar */}
          <Box sx={{ width: 180, height: 3, bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 10, overflow: 'hidden', mt: 1 }}>
            <Box sx={{ height: '100%', bgcolor: BRAND.accent, borderRadius: 10, animation: 'splashBar 1.4s ease-in-out infinite' }} />
          </Box>
        </Box>
      )}

      {!user && <Login onLogin={handleLogin} />}

      {user && (
        <>
          <NavbarContent
            page={page}
            setPage={setPage}
            mode={mode}
            setMode={setMode}
            user={user}
            handleLogout={handleLogout}
          />

          {/* ── PAGE CONTENT ─────────────────────────────────────── */}
          <Box
            key={page}
            className="page-enter"
            sx={{
              minHeight: "calc(100vh - 62px)",
              bgcolor: "background.default",
              transition: "background-color 0.3s",
            }}
          >
            {page === "dashboard"     ? <Dashboard /> :
             page === "fse"           ? <FSEOverview /> :
             page === "tl"            ? <TLOverview /> :
             page === "set-targets"   ? <SetTargets /> :
             page === "fund-transfer" ? <FundTransfer /> :
             page === "bt-forms"      ? <BTForms /> :
             page === "mobikwik-forms" ? <MobikwikForms /> :
             page === "attendance"    ? <Attendance /> : null}
          </Box>
        </>
      )}
    </ThemeProvider>
  );
}

export default App;
