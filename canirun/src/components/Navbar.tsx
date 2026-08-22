'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { Gamepad2, Cpu, Search, BarChart3, History, User, Menu, X, GitCompare, Zap, ChevronDown, LogOut, LayoutDashboard, Heart } from 'lucide-react';

const navLinks = [
  { href: '/run', label: 'Can I Run It?', icon: Zap, highlight: true },
  { href: '/builder', label: 'PC Builder', icon: Cpu },
  { href: '/games', label: 'Games', icon: Search },
  { href: '/estimate', label: 'FPS Estimator', icon: BarChart3 },
  { href: '/compare', label: 'Compare', icon: GitCompare },
];

export default function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-bg-primary/90 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
              <Gamepad2 className="h-5 w-5 text-white" />
            </div>
            <span className="bg-gradient-to-r from-accent to-purple bg-clip-text text-transparent">
              CanIRun
            </span>
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const active = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
              if (link.highlight) {
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="btn-primary ml-2 flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold text-white"
                  >
                    <Icon className="h-4 w-4" />
                    {link.label}
                  </Link>
                );
              }
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                    active
                      ? 'bg-accent/15 text-accent'
                      : 'text-text-secondary hover:bg-bg-card hover:text-text-primary'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {link.label}
                </Link>
              );
            })}

            {session && (
              <Link
                href="/my-pc"
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                  pathname === '/my-pc'
                    ? 'bg-accent/15 text-accent'
                    : 'text-text-secondary hover:bg-bg-card hover:text-text-primary'
                }`}
              >
                <Cpu className="h-4 w-4" />
                My PC
              </Link>
            )}
          </div>

          <div className="hidden items-center gap-3 md:flex">
            {session ? (
              <div ref={userMenuRef} className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 rounded-lg border border-border bg-bg-card px-3 py-1.5 text-sm transition-all hover:border-border-active"
                >
                  {session.user?.image ? (
                    <Image
                      src={session.user.image}
                      alt=""
                      width={24}
                      height={24}
                      className="rounded-full"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white">
                      {session.user?.name?.[0] || 'U'}
                    </div>
                  )}
                  <span className="max-w-[100px] truncate text-text-primary">
                    {session.user?.name || 'User'}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-border bg-bg-card py-1 shadow-xl">
                    <Link
                      href="/dashboard"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-text-secondary hover:bg-bg-card-hover hover:text-text-primary"
                    >
                      <LayoutDashboard className="h-4 w-4" />
                      Dashboard
                    </Link>
                    <Link
                      href="/my-pc"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-text-secondary hover:bg-bg-card-hover hover:text-text-primary"
                    >
                      <Cpu className="h-4 w-4" />
                      My PC
                    </Link>
                    <Link
                      href="/history"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-text-secondary hover:bg-bg-card-hover hover:text-text-primary"
                    >
                      <History className="h-4 w-4" />
                      History
                    </Link>
                    <Link
                      href="/profiles"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-text-secondary hover:bg-bg-card-hover hover:text-text-primary"
                    >
                      <Heart className="h-4 w-4" />
                      Favorites
                    </Link>
                    <div className="my-1 border-t border-border" />
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        signOut();
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red hover:bg-bg-card-hover"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/auth/signin"
                className="flex items-center gap-1.5 rounded-lg border border-accent bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition-all hover:bg-accent/20"
              >
                <User className="h-4 w-4" />
                Sign In
              </Link>
            )}
          </div>

          <button
            className="rounded-lg p-2 text-text-secondary hover:bg-bg-card md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileOpen && (
          <div className="border-t border-border pb-4 md:hidden">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const active = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
              if (link.highlight) {
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="mx-3 mt-3 flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-3 text-sm font-bold text-white"
                  >
                    <Icon className="h-4 w-4" />
                    {link.label}
                  </Link>
                );
              }
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                    active
                      ? 'bg-accent/15 text-accent'
                      : 'text-text-secondary hover:bg-bg-card hover:text-text-primary'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {link.label}
                </Link>
              );
            })}

            {session && (
              <>
                <Link
                  href="/my-pc"
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                    pathname === '/my-pc'
                      ? 'bg-accent/15 text-accent'
                      : 'text-text-secondary hover:bg-bg-card hover:text-text-primary'
                  }`}
                >
                  <Cpu className="h-4 w-4" />
                  My PC
                </Link>
                <Link
                  href="/dashboard"
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                    pathname === '/dashboard'
                      ? 'bg-accent/15 text-accent'
                      : 'text-text-secondary hover:bg-bg-card hover:text-text-primary'
                  }`}
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </Link>
              </>
            )}

            <div className="mt-3 border-t border-border pt-3 px-3">
              {session ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {session.user?.image ? (
                      <Image src={session.user.image} alt="" width={32} height={32} className="rounded-full" unoptimized />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
                        {session.user?.name?.[0] || 'U'}
                      </div>
                    )}
                    <span className="text-sm text-text-primary">{session.user?.name}</span>
                  </div>
                  <button
                    onClick={() => { setMobileOpen(false); signOut(); }}
                    className="rounded-lg p-2 text-red hover:bg-red/10"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <Link
                  href="/auth/signin"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-center gap-2 rounded-lg border border-accent bg-accent/10 px-4 py-2.5 text-sm font-medium text-accent"
                >
                  <User className="h-4 w-4" />
                  Sign In
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
