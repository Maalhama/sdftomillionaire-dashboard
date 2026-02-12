'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Terminal, Menu, X } from 'lucide-react';
import { useState } from 'react';

const navLinks = [
  { href: '/#products', label: 'produits' },
  { href: '/radar', label: 'radar' },
  { href: '/insights', label: 'insights' },
  { href: '/about', label: 'agents' },
  { href: '/stage', label: 'stage' },
];

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-hacker-bg/95 backdrop-blur-sm border-b border-hacker-border">
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

          {/* Navigation Desktop */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href.split('#')[0]));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-1.5 text-xs uppercase tracking-widest transition-all rounded ${
                    isActive
                      ? 'text-hacker-green bg-hacker-green/10'
                      : 'text-hacker-muted-light hover:text-hacker-green'
                  }`}
                >
                  {isActive && <span className="mr-1 text-hacker-green/50">&gt;</span>}
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Status + Mobile Menu */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-[11px] text-hacker-muted">
              <span className="status-dot status-active" />
              <span>6 agents en ligne</span>
            </div>
            <button
              className="md:hidden text-hacker-muted-light hover:text-hacker-green transition-colors"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileOpen && (
          <nav className="md:hidden border-t border-hacker-border py-3 space-y-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
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
          </nav>
        )}
      </div>
    </header>
  );
}
