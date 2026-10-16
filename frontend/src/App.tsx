import { useState, useRef, useEffect } from 'react';
import { 
  Database, 
  Upload, 
  MapPin, 
  Layers, 
  History, 
  ShieldCheck, 
  Lock,
  Sun,
  Moon,
  Menu,
  X,
  LogOut,
  Check,
  ChevronRight,
  Shield,
  Zap,
  Activity
} from 'lucide-react';
import { AuthProvider, useAuth, UserRole } from './features/auth/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AuditLogViewer } from './features/audit/AuditLogViewer';
import { UploadManager } from './features/upload/UploadManager';
import { CandidateListView } from './features/candidates/CandidateListView';
import { ManualEntryView } from './features/manual/ManualEntryView';
import { ProcessHistoryView } from './features/history/ProcessHistoryView';

type TabId = 'upload' | 'candidates' | 'manual' | 'history' | 'audit';

interface NavItem {
  id: TabId;
  label: string;
  sublabel: string;
  icon: typeof Upload;
  requiredPermission?: 'upload' | 'match' | 'validate' | 'audit' | 'config';
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'upload',
    label: 'Unggah Data',
    sublabel: 'Master, PDPJ & Kosong',
    icon: Upload,
    requiredPermission: 'upload',
    badge: '3 Berkas',
  },
  {
    id: 'candidates',
    label: 'Daftar Kandidat & Peta',
    sublabel: 'Pencocokan Geospasial',
    icon: MapPin,
    badge: 'Spasial',
  },
  {
    id: 'manual',
    label: 'Input Manual',
    sublabel: 'Entri Koordinat Survei',
    icon: Layers,
    requiredPermission: 'validate',
  },
  {
    id: 'history',
    label: 'Riwayat Proses',
    sublabel: 'Log Eksekusi & Ekspor',
    icon: History,
  },
  {
    id: 'audit',
    label: 'Log Audit',
    sublabel: 'Jejak Audit RBAC',
    icon: ShieldCheck,
    requiredPermission: 'audit',
  },
];

function AppContent() {
  const { user, setRole, canAccess, logout, isAuthenticated, login } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [activeTab, setActiveTab] = useState<TabId>('upload');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeNavItem = NAV_ITEMS.find((item) => item.id === activeTab);

  // If user logged out, display an elegant authentication screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-white dark:bg-black text-slate-900 dark:text-slate-100 flex items-center justify-center p-4 font-sans transition-colors duration-200">
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 mx-auto flex items-center justify-center shadow-lg shadow-cyan-500/25">
            <Zap className="w-8 h-8 text-white" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Sistem Rekonsiliasi PLN
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Anda telah keluar dari sesi kerja. Silakan pilih peran dan masuk kembali.
            </p>
          </div>

          <div className="space-y-2 text-left">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-2">
              Pilih Akun Peran Demo (RBAC):
            </span>
            {(['analis', 'admin', 'auditor'] as UserRole[]).map((r) => (
              <button
                key={r}
                onClick={() => login(r)}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-cyan-500 hover:bg-cyan-50 dark:hover:bg-slate-800 transition-all text-xs font-medium"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-700 dark:text-slate-300 capitalize">
                    {r.charAt(0)}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white capitalize">{r}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{r}@pln.co.id</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black text-slate-900 dark:text-slate-100 flex font-sans transition-colors duration-200">
      {/* Mobile Sidebar Backdrop Overlay */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between transition-transform duration-300 ease-in-out shadow-sm lg:shadow-none ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Sidebar Header Brand */}
        <div>
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-white shrink-0">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                  Rekonsiliasi Data Pelanggan
                </h1>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">PLN Spasial & JTR</p>
              </div>
            </div>

            {/* Mobile close button */}
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Nav Items List */}
          <nav className="p-3 space-y-1">
            <div className="px-3 py-2 text-[10px] font-bold tracking-wider uppercase text-slate-400 dark:text-slate-500 font-mono">
              Menu Utama
            </div>

            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const isLocked = item.requiredPermission && !canAccess(item.requiredPermission);

              return (
                <button
                  key={item.id}
                  disabled={isLocked}
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all group ${
                    isActive
                      ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-bold border border-cyan-500/30 dark:border-cyan-500/20 shadow-sm'
                      : isLocked
                      ? 'opacity-40 text-slate-400 cursor-not-allowed'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center space-x-3 truncate">
                    <div
                      className={`p-1.5 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-cyan-500 text-white shadow-sm shadow-cyan-500/30'
                          : 'bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 group-hover:text-cyan-500'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="text-left truncate">
                      <div className="truncate">{item.label}</div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 font-normal truncate">
                        {item.sublabel}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    {item.badge && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-mono">
                        {item.badge}
                      </span>
                    )}
                    {isLocked && <Lock className="w-3.5 h-3.5 text-amber-500" />}
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer System Health */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
          <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] space-y-1.5 font-mono">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5 font-sans">
                <Activity className="w-3.5 h-3.5 text-emerald-500" />
                PostGIS ST_DWithin
              </span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">ONLINE</span>
            </div>
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5 font-sans">
                <Shield className="w-3.5 h-3.5 text-cyan-500" />
                Blind Index Hash
              </span>
              <span className="text-cyan-600 dark:text-cyan-400 font-bold">AKTIF</span>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center font-sans">
            v1.0.0 — Enjiniring Data & GIS PLN
          </p>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Minimal Navbar */}
        <header className="sticky top-0 z-30 h-16 bg-white/90 dark:bg-black/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between transition-colors">
          {/* Left: Mobile Toggle & Page Title */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800"
              title="Buka Menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  Modul {activeNavItem?.label}
                </h2>
                <span className="hidden sm:inline-block text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800 font-mono">
                  {activeNavItem?.sublabel}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Theme Toggle & Profile Dropdown */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Dark / Light Mode Button */}
            <button
              onClick={toggleTheme}
              className="p-2 sm:px-3 sm:py-2 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-800 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors flex items-center space-x-2 shadow-sm"
              title={theme === 'dark' ? 'Beralih ke Mode Terang (Putih)' : 'Beralih ke Mode Gelap (Hitam)'}
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400 animate-spin-slow" />
                  <span className="hidden md:inline font-mono text-[11px]">Terang</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-cyan-600" />
                  <span className="hidden md:inline font-mono text-[11px]">Gelap</span>
                </>
              )}
            </button>

            {/* Profile Avatar Icon & Dropdown */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                className="flex items-center space-x-2 p-1.5 sm:px-3 sm:py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 transition-colors shadow-sm"
                title="Profil & Pengaturan"
              >
                <div className="relative">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                    {user.name.charAt(0)}
                  </div>
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-black" />
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">
                    {user.name}
                  </div>
                  <div className="text-[10px] text-slate-500 uppercase font-mono font-semibold">
                    {user.role}
                  </div>
                </div>
              </button>

              {/* Profile & Logout Dropdown Menu */}
              {isProfileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl py-2 z-50 text-slate-900 dark:text-slate-100 animate-scale-up">
                  {/* User Profile Header */}
                  <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-600 text-white flex items-center justify-center font-bold text-sm shadow">
                        {user.name.charAt(0)}
                      </div>
                      <div className="truncate">
                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {user.name}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
                          {user.email}
                        </div>
                        <span className="inline-block mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 uppercase font-mono">
                          PERAN: {user.role}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Role Switcher Section (RBAC) */}
                  <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-2 mb-1 font-mono">
                      Simulasi Peran (RBAC)
                    </div>
                    {(['analis', 'admin', 'auditor'] as UserRole[]).map((r) => (
                      <button
                        key={r}
                        onClick={() => {
                          setRole(r);
                          setIsProfileDropdownOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                          user.role === r
                            ? 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 font-bold'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900'
                        }`}
                      >
                        <span className="capitalize">{r}</span>
                        {user.role === r && <Check className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />}
                      </button>
                    ))}
                  </div>

                  {/* Hak Akses Summary */}
                  <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                    <div className="flex justify-between">
                      <span>Unggah Data:</span>
                      <strong className={canAccess('upload') ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}>
                        {canAccess('upload') ? 'Diberikan' : 'Ditolak'}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Validasi Kandidat:</span>
                      <strong className={canAccess('validate') ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}>
                        {canAccess('validate') ? 'Diberikan' : 'Ditolak'}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Log Audit:</span>
                      <strong className={canAccess('audit') ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}>
                        {canAccess('audit') ? 'Diberikan' : 'Ditolak'}
                      </strong>
                    </div>
                  </div>

                  {/* Logout Button */}
                  <div className="px-2 pt-2 pb-1">
                    <button
                      onClick={() => {
                        setIsProfileDropdownOpen(false);
                        logout();
                      }}
                      className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Keluar (Logout)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Workspace Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {activeTab === 'upload' && (
            <UploadManager
              onNavigateToMatching={() => setActiveTab('candidates')}
            />
          )}

          {activeTab === 'candidates' && <CandidateListView />}

          {activeTab === 'manual' && <ManualEntryView />}

          {activeTab === 'history' && (
            <ProcessHistoryView
              onNavigateToCandidates={() => setActiveTab('candidates')}
            />
          )}

          {activeTab === 'audit' && <AuditLogViewer />}
        </main>

        {/* Minimal Footer */}
        <footer className="border-t border-slate-200 dark:border-slate-800 px-6 py-4 text-center text-xs text-slate-400 dark:text-slate-600">
          Sistem Rekonsiliasi Data Pelanggan & Jaringan Spasial © 2026 PT PLN (Persero)
        </footer>
      </div>
    </div>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
export default App;
