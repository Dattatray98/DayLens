import { lazy, Suspense, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Capacitor } from "@capacitor/core";
import { BrowserRouter, Link, Navigate, NavLink, Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { FiActivity, FiArrowUpRight, FiBookOpen, FiCalendar, FiChevronDown, FiCreditCard, FiFileText, FiHome, FiLogOut, FiMoon, FiPlus, FiSettings, FiSun } from "react-icons/fi";
import appIcon from "../assets/icon.png";
import LogoStartupScreen from "./Components/Startup/LogoStartupScreen";
import { AuthProvider } from "./features/auth/AuthProvider";
import { useAuth } from "./features/auth/useAuth";
import MoneyPage from "./features/money/MoneyPage";
import { formatRupees, getMoneySummary, type MoneySummary } from "./features/money/moneyRepository";
import DietPage from "./features/diet/DietPage";
import { getDietDayData, type DietDayData } from "./features/diet/dietRepository";
import NotesPage from "./features/notes/NotesPage";
import LandingPage from "./pages/LandingPage";
const ReportsPage = lazy(() => import("./features/reports/ReportsPage"));

type ModuleKey = "overview" | "money" | "diet" | "notes" | "reports" | "settings";
const themePreferenceKey = "personal-os-theme";

function readThemePreference(): "light" | "dark" {
  try {
    const savedTheme = window.localStorage.getItem(themePreferenceKey);
    return savedTheme === "dark" || savedTheme === "light" ? savedTheme : "light";
  } catch {
    return "light";
  }
}

const navItems: { path: string; label: string; icon: typeof FiHome; key: ModuleKey }[] = [
  { path: "/overview", label: "Overview", icon: FiHome, key: "overview" },
  { path: "/money", label: "Money", icon: FiCreditCard, key: "money" },
  { path: "/diet", label: "Diet", icon: FiActivity, key: "diet" },
  { path: "/notes", label: "Notes", icon: FiFileText, key: "notes" },
  { path: "/reports", label: "Reports", icon: FiBookOpen, key: "reports" },
  { path: "/settings", label: "Settings", icon: FiSettings, key: "settings" },
];

function App() {
  return <AuthProvider><BrowserRouter><AppRoutes /></BrowserRouter></AuthProvider>;
}

function AppRoutes() {
  const { account, loading } = useAuth();
  const [startupComplete, setStartupComplete] = useState(false);
  const [startupVisible, setStartupVisible] = useState(true);
  const startupTheme = readThemePreference();

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStartupComplete(true);
      return;
    }
    // CSS animationend is the normal completion signal; this only prevents a
    // broken or throttled animation from leaving the startup screen stuck.
    const timer = window.setTimeout(() => setStartupComplete(true), 2600);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (loading || !startupComplete || !startupVisible) return;
    const timer = window.setTimeout(() => setStartupVisible(false), 600);
    return () => window.clearTimeout(timer);
  }, [loading, startupComplete, startupVisible]);

  const completeStartupAnimation = () => setStartupComplete(true);
  const finishStartupExit = () => setStartupVisible(false);

  const application = <Routes>
    <Route path="/" element={account ? <Navigate to="/overview" replace /> : Capacitor.isNativePlatform() ? <Navigate to="/login" replace /> : <LandingPage />} />
    <Route path="/login" element={account ? <Navigate to="/overview" replace /> : <AuthPage mode="login" />} />
    <Route path="/register" element={account ? <Navigate to="/overview" replace /> : <AuthPage mode="register" />} />
    <Route element={account ? <AppShell /> : <Navigate to="/login" replace />}>
      <Route path="/overview" element={<OverviewPage />} />
      <Route path="/money" element={<MoneyPage />} />
      <Route path="/diet" element={<DietPage />} />
      <Route path="/notes" element={<NotesPage />} />
      <Route path="/reports" element={<Suspense fallback={<div className="content-panel reports-state" role="status">Loading Reports…</div>}><ReportsPage /></Suspense>} />
      <Route path="/settings" element={<ModulePage module="settings" />} />
      <Route path="/plan" element={<Navigate to="/overview" replace />} />
      <Route path="/activity" element={<Navigate to="/reports" replace />} />
      <Route path="/assitsant" element={<Navigate to="/overview" replace />} />
      <Route path="*" element={<Navigate to="/overview" replace />} />
    </Route>
  </Routes>;
  return <>{loading ? null : application}{startupVisible && <LogoStartupScreen theme={startupTheme} isExiting={!loading && startupComplete} onAnimationComplete={completeStartupAnimation} onExitComplete={finishStartupExit} />}</>;
}

function AuthPage({ mode }: { mode: "login" | "register" }) {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const isRegister = mode === "register";
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(""); setBusy(true);
    try { await (isRegister ? register(email, password) : login(email, password)); navigate("/overview", { replace: true }); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to access the local account."); }
    finally { setBusy(false); }
  };
  return <main className="auth-screen">
    <section className="auth-story" aria-label="Daylens">
      <Link className="brand" to="/login"><span className="brand-mark"><img src={appIcon} alt="" /></span><span>Daylens</span></Link>
      <div className="story-copy"><span className="section-kicker">YOUR PERSONAL WORKSPACE</span><h1>See your life<br />more clearly.</h1><p>Your personal space for money, nutrition, wellness, notes, and insights.</p></div>
      <div className="story-foot"><span className="status-dot" /> Private by default <span>·</span> Stored locally</div>
    </section>
    <section className="auth-panel"><div className="auth-form-wrap">
      <span className="section-kicker">{isRegister ? "START YOUR WORKSPACE" : "WELCOME BACK"}</span>
      <p className="auth-mobile-tagline">See your life more clearly.</p>
      <h2>{isRegister ? "Create your account" : "Sign in"}</h2>
      <p className="muted">{isRegister ? "One local account, just for this browser." : "Your workspace is waiting on this device."}</p>
      <form onSubmit={submit} className="form-stack">
        <label>Email address<input autoComplete="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></label>
        <label>Password<span className="password-row"><input autoComplete={isRegister ? "new-password" : "current-password"} type={showPassword ? "text" : "password"} required minLength={isRegister ? 10 : undefined} value={password} onChange={e => setPassword(e.target.value)} placeholder={isRegister ? "At least 10 characters" : "Your password"} /><button className="text-button" type="button" onClick={() => setShowPassword(v => !v)}>{showPassword ? "Hide" : "Show"}</button></span></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button full-button" disabled={busy} type="submit">{busy ? "Please wait…" : isRegister ? "Create account" : "Sign in"}</button>
      </form>
      <p className="auth-switch">{isRegister ? "Already have an account?" : "New to Daylens?"} <Link to={isRegister ? "/login" : "/register"}>{isRegister ? "Sign in" : "Create an account"}</Link></p>
      <p className="security-note">Local prototype authentication. This does not protect data from someone who can access this device or browser storage.</p>
    </div></section>
  </main>;
}

function AppShell() {
  const { account, logout } = useAuth();
  const location = useLocation();
  const [theme, setTheme] = useState<"light" | "dark">(readThemePreference);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    try { window.localStorage.setItem(themePreferenceKey, theme); }
    catch { /* Keep the selected theme for this session when storage is unavailable. */ }
  }, [theme]);
  useEffect(() => {
    const viewport = window.visualViewport;
    let baselineHeight = viewport?.height ?? window.innerHeight;
    let baselineWidth = window.innerWidth;
    let blurTimer = 0;

    const hasTextFocus = () => {
      const active = document.activeElement;
      return active instanceof HTMLElement && (active.isContentEditable || active.matches("input, textarea, select"));
    };
    const updateKeyboardState = () => {
      const currentHeight = viewport?.height ?? window.innerHeight;
      if (Math.abs(window.innerWidth - baselineWidth) > 100) {
        baselineWidth = window.innerWidth;
        baselineHeight = currentHeight;
        setKeyboardOpen(false);
        return;
      }
      if (window.innerWidth > 720) {
        baselineHeight = currentHeight;
        setKeyboardOpen(false);
        return;
      }
      setKeyboardOpen(hasTextFocus() && baselineHeight - currentHeight > 120);
    };
    const onFocusOut = () => {
      window.clearTimeout(blurTimer);
      blurTimer = window.setTimeout(updateKeyboardState, 180);
    };

    const frame = window.requestAnimationFrame(updateKeyboardState);
    window.addEventListener("resize", updateKeyboardState);
    document.addEventListener("focusin", updateKeyboardState);
    document.addEventListener("focusout", onFocusOut);
    viewport?.addEventListener("resize", updateKeyboardState);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(blurTimer);
      window.removeEventListener("resize", updateKeyboardState);
      document.removeEventListener("focusin", updateKeyboardState);
      document.removeEventListener("focusout", onFocusOut);
      viewport?.removeEventListener("resize", updateKeyboardState);
    };
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("hide-overview-scrollbar", location.pathname === "/overview");
    return () => root.classList.remove("hide-overview-scrollbar");
  }, [location.pathname]);
  const initials = account?.email.slice(0, 1).toUpperCase() ?? "P";
  return <div className={`app-frame theme-${theme} ${keyboardOpen ? "keyboard-open" : ""}`}>
    <aside className="sidebar">
      <Link className="brand" to="/overview"><span className="brand-mark"><img src={appIcon} alt="" /></span><span>Daylens</span></Link>
      <span className="nav-caption">WORKSPACE</span>
      <nav className="side-nav" aria-label="Main navigation">{navItems.map(item => { const Icon = item.icon; return <NavLink key={item.path} end to={item.path} className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}><Icon aria-hidden="true" /><span>{item.label}</span>{item.key === "overview" && <span className="nav-active-dot" />}</NavLink>; })}</nav>
      <div className="sidebar-spacer" />
      <div className="local-card"><span className="status-dot" /><div><strong>On this device</strong><span>Local workspace</span></div></div>
      <div className="account-row"><span className="avatar">{initials}</span><span className="account-info"><strong>{account?.email}</strong><span>Personal account</span></span><button className="icon-button" title="Sign out" aria-label="Sign out" onClick={logout}><FiLogOut /></button></div>
    </aside>
    <div className="main-column"><header className="topbar"><Link to="/overview" className="breadcrumb app-name" aria-label="Daylens overview"><img src={appIcon} alt="" /><strong>Daylens</strong></Link><div className="topbar-actions"><span className="today-label"><FiCalendar /> {new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(new Date())}</span><NavLink to="/settings" aria-label="Settings" title="Settings" className={({ isActive }) => `icon-button mobile-settings ${isActive ? "active" : ""}`}><FiSettings /></NavLink><button className="theme-toggle" aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`} onClick={() => setTheme(v => v === "light" ? "dark" : "light")}>{theme === "light" ? <FiMoon /> : <FiSun />}<span>{theme === "light" ? "Dark" : "Light"}</span></button></div></header>
      <main className="page-content"><Outlet /></main>
      <footer className="app-footer">Daylens <span>·</span> Your data stays on this device</footer>
    </div>
    <nav className="mobile-bottom-nav" aria-label="Main navigation">{navItems.filter(item => item.key !== "settings").map(item => { const Icon = item.icon; return <NavLink key={item.path} end to={item.path} className={({ isActive }) => `mobile-nav-link ${isActive ? "active" : ""}`}><Icon aria-hidden="true" /><span>{item.label}</span></NavLink>; })}</nav>
  </div>;
}

function PageHeading({ eyebrow, title, detail, action }: { eyebrow: string; title: string; detail: string; action?: ReactNode }) {
  return <div className="page-heading"><div><span className="section-kicker">{eyebrow}</span><h1>{title}</h1><p>{detail}</p></div>{action}</div>;
}

function OverviewPage() {
  const navigate = useNavigate();
  const today = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date());
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const dietDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const [moneySummary, setMoneySummary] = useState<MoneySummary | null>(null);
  const [moneyLoadError, setMoneyLoadError] = useState(false);
  const [dietSummary, setDietSummary] = useState<DietDayData | null>(null);
  const [dietLoadError, setDietLoadError] = useState(false);
  useEffect(() => {
    let active = true;
    getMoneySummary(month)
      .then(summary => { if (active) setMoneySummary(summary); })
      .catch(() => { if (active) setMoneyLoadError(true); });
    return () => { active = false; };
  }, [month]);
  useEffect(() => {
    let active = true;
    getDietDayData(dietDate)
      .then(summary => { if (active) setDietSummary(summary); })
      .catch(() => { if (active) setDietLoadError(true); });
    return () => { active = false; };
  }, [dietDate]);

  const calories = dietSummary?.totals.calories;
  const formatNutrition = (value: number) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value);
  const calorieTarget = dietSummary?.targets.calories;
  const caloriesDisplay = dietLoadError
    ? "Unavailable"
    : !dietSummary?.entryCount
      ? "—"
      : calories?.complete
        ? <>{formatNutrition(calories.value)}{calorieTarget == null ? null : <span className="diet-target-value">/{formatNutrition(calorieTarget)}</span>} kcal</>
        : <>≥ {formatNutrition(calories?.value ?? 0)} kcal</>;
  const nutrientOverview = (nutrient: "protein" | "carbohydrates" | "fat", label: string) => {
    const total = dietSummary?.totals[nutrient];
    const target = dietSummary?.targets[nutrient];
    const value = !dietSummary?.entryCount
      ? "—"
      : <>{total?.complete ? formatNutrition(total.value) : <>≥ {formatNutrition(total?.value ?? 0)}</>}{total?.complete && target != null ? <span className="diet-target-value">/{formatNutrition(target)}</span> : null} g</>;
    const progress = dietLoadError ? "Could not load nutrition" : !dietSummary?.entryCount ? "No entries" : target == null ? "Target not set" : !total?.complete ? "Target progress unavailable · incomplete data" : `${formatNutrition(Math.max(0, target - total.value))} g remaining`;
    return <span key={nutrient}><span>{label}</span><b>{dietLoadError ? "Unavailable" : value}</b><small>{progress}</small></span>;
  };
  return <>
    <PageHeading eyebrow={today.toUpperCase()} title="A clear view of your day." detail="Your personal space for the things you want to keep track of." />
    <section className="overview-grid" aria-label="Personal overview">
      <article className="summary-panel money-panel"><div className="panel-top"><span className="panel-icon"><FiCreditCard /></span><Link to="/money" className="subtle-link">Open Money <FiArrowUpRight /></Link></div><h2>Money</h2><p className="panel-description">Your income, expenses, and balance.</p><div className="empty-metric"><span>Balance</span><strong>{moneyLoadError ? "Unavailable" : moneySummary ? formatRupees(moneySummary.balancePaise) : "Loading…"}</strong><small>{moneySummary ? `Opening balance ${formatRupees(moneySummary.openingBalancePaise)}` : moneyLoadError ? "Could not load financial data" : "Loading local records"}</small></div><div className="panel-rule" /><div className="mini-split"><div><span>This month in</span><strong>{moneySummary ? formatRupees(moneySummary.monthIncomePaise) : "—"}</strong></div><div><span>This month out</span><strong>{moneySummary ? formatRupees(moneySummary.monthExpensesPaise) : "—"}</strong></div></div></article>
      <article className="summary-panel diet-panel"><div className="panel-top"><span className="panel-icon"><FiActivity /></span><Link to="/diet" className="subtle-link">Open Diet <FiArrowUpRight /></Link></div><h2>Diet</h2><p className="panel-description">Today's logged nutrition.</p><div className="empty-metric diet-calorie-metric"><div className="diet-calorie-primary"><span>Calories</span><strong>{dietSummary ? caloriesDisplay : dietLoadError ? "Unavailable" : "Loading…"}</strong>{dietLoadError ? <small>Could not load nutrition data</small> : dietSummary && !dietSummary.entryCount ? <small>No food entries yet</small> : dietSummary && !calories?.complete ? <small>Known subtotal · incomplete</small> : null}</div><div className="diet-calorie-meta">{dietSummary?.recentEntries.length ? <span>Recent: {dietSummary.recentEntries.map(entry => entry.foodName).join(", ")}</span> : null}{dietSummary?.entryCount ? <span>{dietSummary.entryCount} food {dietSummary.entryCount === 1 ? "entry" : "entries"}</span> : null}</div></div><div className="diet-overview-macros">{nutrientOverview("protein", "Protein")}{nutrientOverview("carbohydrates", "Carbs")}{nutrientOverview("fat", "Fat")}</div></article>
    </section>
    <section className="lower-grid"><article className="content-panel"><div className="content-heading"><div><h2>Recent activity</h2><p>Your latest entries will appear here.</p></div><button className="icon-button" aria-label="More about recent activity"><FiChevronDown /></button></div><div className="activity-empty"><span className="empty-symbol"><FiActivity /></span><strong>Your workspace is ready</strong><p>Once you add something to Money, Diet, or Notes, you’ll find it here.</p></div></article><article className="content-panel quick-panel"><div className="content-heading"><div><h2>Quick access</h2><p>Go straight to a module.</p></div></div><div className="quick-list"><button onClick={() => navigate("/money")}><span className="quick-icon"><FiCreditCard /></span><span><strong>Add a transaction</strong><small>Income or expense</small></span><FiArrowUpRight /></button><button onClick={() => navigate("/diet")}><span className="quick-icon"><FiActivity /></span><span><strong>Log food</strong><small>Record a meal or snack</small></span><FiArrowUpRight /></button><button onClick={() => navigate("/notes")}><span className="quick-icon"><FiPlus /></span><span><strong>Write a note</strong><small>Capture a thought</small></span><FiArrowUpRight /></button></div></article></section>
    <p className="storage-boundary">Money, Diet, and Notes records are saved locally on this device. Preference storage is not enabled yet.</p>
  </>;
}

const moduleDetails: Record<Exclude<ModuleKey, "money">, { eyebrow: string; title: string; detail: string; icon: typeof FiHome; status: string }> = {
  overview: { eyebrow: "OVERVIEW", title: "Overview", detail: "Your personal dashboard.", icon: FiHome, status: "" },
  diet: { eyebrow: "FOOD & NUTRITION", title: "Diet", detail: "Keep track of meals and daily nutrition.", icon: FiActivity, status: "Food and nutrition storage is not enabled yet. No entries or targets have been saved." },
  notes: { eyebrow: "YOUR THOUGHTS", title: "Notes", detail: "A quiet place to keep useful thoughts.", icon: FiFileText, status: "Notes storage is not enabled yet. Nothing written here will be saved." },
  reports: { eyebrow: "YOUR HISTORY", title: "Reports", detail: "Patterns become useful when there is something to look back on.", icon: FiBookOpen, status: "Reports will appear when the related module storage is approved and contains data." },
  settings: { eyebrow: "PREFERENCES", title: "Settings", detail: "Manage this local workspace.", icon: FiSettings, status: "Theme applies for this session only. Appearance preferences are not persisted." },
};

function ModulePage({ module }: { module: Exclude<ModuleKey, "overview" | "money"> }) {
  const detail = moduleDetails[module];
  const Icon = detail.icon;
  const { account, logout } = useAuth();
  const [notice, setNotice] = useState("");
  return <>
    <PageHeading eyebrow={detail.eyebrow} title={detail.title} detail={detail.detail} />
    {module === "settings" && <section className="settings-card"><div className="settings-section"><div><h2>Account</h2><p>Local account on this browser</p></div><div className="settings-value">{account?.email}</div></div><div className="settings-section"><div><h2>Data storage</h2><p>Account details are stored in the local SQLite database.</p></div><span className="local-badge"><span className="status-dot" />This device</span></div><div className="settings-section"><div><h2>Privacy</h2><p>Local prototype sign-in is not server-side authentication. A person with access to this browser may inspect or change its stored data.</p></div></div><div className="settings-section"><div><h2>Session</h2><p>Sign out of this local account.</p></div><button className="secondary-button" onClick={logout}><FiLogOut /> Sign out</button></div></section>}
    {module !== "settings" && <section className="module-empty"><span className="module-icon"><Icon /></span><h2>{module === "reports" ? "Nothing to report yet" : `Your ${detail.title.toLowerCase()} space is ready`}</h2><p>{detail.status}</p>{module !== "reports" && <button className="secondary-button" onClick={() => setNotice("Storage for this module needs your approval before entries can be saved.")}><FiPlus /> {module === "diet" ? "Log food" : "New note"}</button>}{notice && <p className="notice" role="status">{notice}</p>}</section>}
  </>;
}

export default App;
