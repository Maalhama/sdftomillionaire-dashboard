'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Terminal, LogOut, User, Database } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';

const navLinks = [
  { href: '/gallery', label: 'galerie', desc: 'parcourir et voter' },
  { href: '/downloads', label: 'outils', desc: 'télécharger les produits' },
  { href: '/pricing', label: 'boutique', desc: 'acheter des crédits' },
  { href: '/leaderboard', label: 'top', desc: 'meilleurs contributeurs' },
  { href: '/radar', label: 'suivi', desc: 'pipeline des idées' },
  { href: '/agents', label: 'agents', desc: 'les 6 IA autonomes' },
  { href: '/stage', label: 'QG', desc: 'salle 3D en direct' },
  { href: '/conversations', label: 'discussions', desc: 'conversations des agents' },
  { href: '/insights', label: 'blog', desc: 'articles et analyses' },
  { href: '/accueil', label: 'FAQ', desc: 'questions fréquentes' },
];

export default function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { user, profile, session, loading, signOut } = useAuth();
  const [creditBalance, setCreditBalance] = useState<number | null>(null);

  // Fetch credit balance
  useEffect(() => {
    if (!session?.access_token) { setCreditBalance(null); return; }

    async function fetchCredits() {
      try {
        const res = await fetch('/api/credits', {
          headers: { Authorization: `Bearer ${session!.access_token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setCreditBalance(data.balance);
        }
      } catch { /* silent */ }
    }
    fetchCredits();
  }, [session?.access_token]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Lock body scroll when menu is open
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [menuOpen]);

  const displayName = profile?.display_name || profile?.username || user?.email?.split('@')[0] || 'User';
  const avatarUrl = profile?.avatar_url;

  return (
    <>
      <header className="sticky top-0 z-50 bg-hacker-bg/95 backdrop-blur-sm border-b border-hacker-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 sm:gap-3 group shrink-0">
              <div className="w-8 h-8 rounded border border-hacker-green/30 flex items-center justify-center group-hover:border-hacker-green group-hover:shadow-[0_0_10px_rgba(0,255,65,0.3)] transition-all shrink-0">
                <Terminal className="w-4 h-4 text-hacker-green" />
              </div>
              <span className="text-xs sm:text-sm font-medium text-hacker-green tracking-wider uppercase">
                sdf<span className="text-hacker-text">to</span>millionaire
              </span>
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-mono uppercase tracking-widest border border-hacker-green/25 text-hacker-green/80 bg-hacker-green/5 leading-none">
                <span className="w-1 h-1 rounded-full bg-hacker-green animate-pulse" />
                live
              </div>
            </Link>

            {/* Right side */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <div className="hidden sm:flex items-center gap-2 text-[11px] text-hacker-muted">
                <span className="status-dot status-active" />
                <span>6 agents en ligne</span>
              </div>

              {/* Auth section */}
              {!loading && (
                user ? (
                  <div className="relative" ref={dropdownRef}>
                    <button
                      onClick={() => setDropdownOpen(!dropdownOpen)}
                      className="flex items-center gap-2 px-2 py-1 rounded border border-transparent hover:border-hacker-border transition-all"
                    >
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="" className="w-6 h-6 rounded-full border border-hacker-border" />
                      ) : (
                        <div className="w-6 h-6 rounded-full border border-hacker-green/30 bg-hacker-green/10 flex items-center justify-center">
                          <span className="text-[10px] text-hacker-green font-bold">
                            {displayName[0].toUpperCase()}
                          </span>
                        </div>
                      )}
                      <span className="text-xs text-hacker-muted-light font-mono hidden sm:inline">
                        {displayName}
                      </span>
                      {creditBalance !== null && (
                        <span className="hidden sm:flex items-center gap-1 text-[10px] text-hacker-amber font-mono">
                          <Database className="w-3 h-3" />
                          {creditBalance}
                        </span>
                      )}
                    </button>

                    {/* User Dropdown */}
                    {dropdownOpen && (
                      <div className="absolute right-0 mt-2 w-48 card border border-hacker-border shadow-lg py-1 z-50">
                        <div className="px-3 py-2 border-b border-hacker-border">
                          <p className="text-xs text-white font-medium truncate">{displayName}</p>
                          <p className="text-[10px] text-hacker-muted font-mono truncate">{user.email}</p>
                          {creditBalance !== null && (
                            <p className="flex items-center gap-1 mt-1 text-[10px] text-hacker-amber font-mono">
                              <Database className="w-3 h-3" />
                              {creditBalance} crédits
                            </p>
                          )}
                        </div>
                        <Link
                          href="/profile"
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2 px-3 py-2 text-xs text-hacker-muted-light hover:text-hacker-green hover:bg-hacker-green/5 transition-all"
                        >
                          <User className="w-3.5 h-3.5" />
                          Mon profil
                        </Link>
                        <button
                          onClick={() => { signOut(); setDropdownOpen(false); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-hacker-muted-light hover:text-hacker-red hover:bg-hacker-red/5 transition-all"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          Déconnexion
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <Link
                    href="/login"
                    className="px-3 py-1.5 text-xs uppercase tracking-widest text-hacker-green border border-hacker-green/30 rounded hover:bg-hacker-green/10 hover:border-hacker-green/50 transition-all font-mono"
                  >
                    login
                  </Link>
                )
              )}

              {/* Matrix Hamburger Button */}
              <button
                className="relative w-8 h-8 flex flex-col items-center justify-center gap-[5px] group"
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label="Menu"
              >
                <span className={`block h-[2px] w-5 bg-hacker-green transition-all duration-300 ${
                  menuOpen ? 'rotate-45 translate-y-[7px] shadow-[0_0_8px_rgba(0,255,65,0.6)]' : 'group-hover:shadow-[0_0_6px_rgba(0,255,65,0.4)]'
                }`} />
                <span className={`block h-[2px] w-5 bg-hacker-green transition-all duration-200 ${
                  menuOpen ? 'opacity-0 scale-0' : 'group-hover:w-3 group-hover:shadow-[0_0_6px_rgba(0,255,65,0.4)]'
                }`} />
                <span className={`block h-[2px] w-5 bg-hacker-green transition-all duration-300 ${
                  menuOpen ? '-rotate-45 -translate-y-[7px] shadow-[0_0_8px_rgba(0,255,65,0.6)]' : 'group-hover:shadow-[0_0_6px_rgba(0,255,65,0.4)]'
                }`} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ═══ MATRIX FULLSCREEN MENU ═══ */}
      {menuOpen && (
        <div className="fixed inset-0 z-40" style={{ top: '57px' }}>
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-fade-in"
            onClick={() => setMenuOpen(false)}
          />

          {/* Terminal Window */}
          <div className="relative max-w-2xl mx-auto mt-4 mx-4 sm:mx-auto animate-fade-in" style={{ animationDuration: '150ms' }}>
            <div className="mx-4 sm:mx-0 border border-hacker-green/30 rounded-lg overflow-hidden bg-hacker-bg/98 shadow-[0_0_40px_rgba(0,255,65,0.08)]">
              {/* Terminal Header */}
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-hacker-green/20 bg-hacker-terminal">
                <div className="w-2.5 h-2.5 rounded-full bg-hacker-red/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-hacker-amber/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-hacker-green/80" />
                <span className="ml-2 text-[11px] text-hacker-green/60 font-mono">
                  nav@sdf:~$ ls -la /pages/
                </span>
              </div>

              {/* Scanline effect */}
              <div className="relative overflow-hidden">
                <div
                  className="absolute inset-x-0 h-[1px] bg-hacker-green/10 pointer-events-none z-10"
                  style={{ animation: 'scan-line 3s linear infinite' }}
                />

                {/* Nav Links */}
                <div className="p-2">
                  {navLinks.map((link, i) => {
                    const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setMenuOpen(false)}
                        className={`group flex items-center gap-3 px-3 py-2.5 rounded transition-all ${
                          isActive
                            ? 'bg-hacker-green/10 shadow-[inset_0_0_20px_rgba(0,255,65,0.05)]'
                            : 'hover:bg-hacker-green/5'
                        }`}
                        style={{ animationDelay: `${i * 40}ms` }}
                      >
                        <span className={`font-mono text-xs w-4 text-right ${isActive ? 'text-hacker-green' : 'text-hacker-muted'}`}>
                          {isActive ? '>' : String(i).padStart(2, '0')}
                        </span>
                        <span className={`font-mono text-sm uppercase tracking-widest ${
                          isActive ? 'text-hacker-green text-glow' : 'text-hacker-muted-light group-hover:text-hacker-green'
                        }`}>
                          /{link.label}
                        </span>
                        <span className="text-[10px] text-hacker-muted font-mono hidden sm:inline">
                          // {link.desc}
                        </span>
                        {isActive && (
                          <span className="ml-auto w-1.5 h-3 bg-hacker-green animate-blink" />
                        )}
                      </Link>
                    );
                  })}
                </div>

                {/* Separator */}
                <div className="mx-4 border-t border-dashed border-hacker-green/15" />

                {/* Auth Links */}
                <div className="p-2">
                  {!loading && !user && (
                    <Link
                      href="/login"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded hover:bg-hacker-green/5 transition-all group"
                    >
                      <span className="font-mono text-xs w-4 text-right text-hacker-green">$</span>
                      <span className="font-mono text-sm text-hacker-green group-hover:text-glow tracking-widest uppercase">
                        auth --login
                      </span>
                    </Link>
                  )}
                  {!loading && user && (
                    <>
                      <Link
                        href="/profile"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded hover:bg-hacker-green/5 transition-all group"
                      >
                        <span className="font-mono text-xs w-4 text-right text-hacker-muted">$</span>
                        <span className="font-mono text-sm text-hacker-muted-light group-hover:text-hacker-green tracking-widest uppercase">
                          /profil
                        </span>
                        <span className="text-[10px] text-hacker-muted font-mono hidden sm:inline">
                          // {displayName}
                        </span>
                      </Link>
                      <button
                        onClick={() => { signOut(); setMenuOpen(false); }}
                        className="flex items-center gap-3 px-3 py-2.5 rounded hover:bg-hacker-red/5 transition-all group w-full text-left"
                      >
                        <span className="font-mono text-xs w-4 text-right text-hacker-red/60">$</span>
                        <span className="font-mono text-sm text-hacker-red/80 group-hover:text-hacker-red tracking-widest uppercase">
                          auth --logout
                        </span>
                      </button>
                    </>
                  )}
                </div>

                {/* Footer */}
                <div className="px-4 py-2.5 border-t border-hacker-green/10 bg-hacker-terminal/50 flex items-center justify-between">
                  <span className="text-[10px] text-hacker-muted font-mono">
                    {navLinks.length} routes disponibles
                  </span>
                  <span className="text-[10px] text-hacker-muted font-mono flex items-center gap-1.5">
                    <span className="status-dot status-active" />
                    session {user ? 'active' : 'inactive'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
