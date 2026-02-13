'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Terminal, Menu, X, LogOut, User, Database } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';

const navLinks = [
  { href: '/gallery', label: 'idées' },
  { href: '/downloads', label: 'outils' },
  { href: '/pricing', label: 'crédits' },
  { href: '/leaderboard', label: 'classement' },
  { href: '/radar', label: 'radar' },
  { href: '/agents', label: 'agents' },
  { href: '/stage', label: 'stage' },
  { href: '/insights', label: 'insights' },
];

export default function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
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

  // Close menu on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [menuOpen]);

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const displayName = profile?.display_name || profile?.username || user?.email?.split('@')[0] || 'User';
  const avatarUrl = profile?.avatar_url;

  return (
    <header className="sticky top-0 z-50 bg-hacker-bg/95 backdrop-blur-sm border-b border-hacker-border" ref={menuRef}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded border border-hacker-green/30 flex items-center justify-center group-hover:border-hacker-green group-hover:shadow-[0_0_10px_rgba(0,255,65,0.3)] transition-all">
              <Terminal className="w-4 h-4 text-hacker-green" />
            </div>
            <span className="text-sm font-medium text-hacker-green tracking-wider uppercase">
              sdf<span className="text-hacker-text">to</span>millionaire
            </span>
            <span className="badge badge-live text-[10px] hidden sm:inline-flex">live</span>
          </Link>

          {/* Right side: status + auth + hamburger */}
          <div className="flex items-center gap-3">
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

                  {/* Dropdown */}
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

            {/* Hamburger — always visible */}
            <button
              className="text-hacker-muted-light hover:text-hacker-green transition-colors"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Navigation panel (all screen sizes) */}
        {menuOpen && (
          <nav className="border-t border-hacker-border py-3 space-y-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className={`block px-3 py-2 text-xs uppercase tracking-widest rounded ${
                    isActive
                      ? 'text-hacker-green bg-hacker-green/10'
                      : 'text-hacker-muted-light hover:text-hacker-green'
                  }`}
                >
                  <span className="mr-2 text-hacker-muted">$</span>
                  cd /{link.label}
                </Link>
              );
            })}
            {!loading && !user && (
              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                className="block px-3 py-2 text-xs uppercase tracking-widest text-hacker-green"
              >
                <span className="mr-2 text-hacker-muted">$</span>
                auth --login
              </Link>
            )}
            {!loading && user && (
              <>
                <Link
                  href="/profile"
                  onClick={() => setMenuOpen(false)}
                  className="block px-3 py-2 text-xs uppercase tracking-widest text-hacker-muted-light hover:text-hacker-green"
                >
                  <span className="mr-2 text-hacker-muted">$</span>
                  cd /profil
                </Link>
                <button
                  onClick={() => { signOut(); setMenuOpen(false); }}
                  className="block w-full text-left px-3 py-2 text-xs uppercase tracking-widest text-hacker-red hover:bg-hacker-red/5 rounded"
                >
                  <span className="mr-2 text-hacker-muted">$</span>
                  auth --logout
                </button>
              </>
            )}
          </nav>
        )}
      </div>
    </header>
  );
}
