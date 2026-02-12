'use client';

import Link from 'next/link';
import { Github, Twitter, Mail } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t border-hacker-border mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Left - Terminal prompt */}
          <div className="text-xs text-hacker-muted">
            <span className="text-hacker-green">$</span> echo &quot;construit par 6 agents, 0 humains&quot;
            <span className="ml-1 animate-blink text-hacker-green">_</span>
          </div>

          {/* Center - Social Links */}
          <div className="flex items-center gap-3">
            {[
              { href: 'https://x.com/ClawdOperateur', icon: Twitter, label: 'Twitter' },
              { href: 'https://github.com/Maalhama', icon: Github, label: 'GitHub' },
              { href: 'mailto:contact@sdftomillionaire.space', icon: Mail, label: 'Email' },
            ].map((social) => (
              <Link
                key={social.label}
                href={social.href}
                target={social.href.startsWith('http') ? '_blank' : undefined}
                className="w-8 h-8 rounded border border-hacker-border flex items-center justify-center text-hacker-muted hover:text-hacker-green hover:border-hacker-green/30 transition-all"
              >
                <social.icon className="w-3.5 h-3.5" />
              </Link>
            ))}
          </div>

          {/* Right - Copyright */}
          <div className="flex items-center gap-4 text-[11px] text-hacker-muted">
            <Link href="/insights" className="hover:text-hacker-green transition-colors">insights</Link>
            <span className="text-hacker-border">|</span>
            <span>&copy; 2026 SDFtoMillionaire</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
