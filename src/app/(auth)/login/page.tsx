'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          router.push('/');
        }
      } catch {
        // Not logged in
      } finally {
        setIsCheckingAuth(false);
      }
    };
    checkAuth();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Login failed. Please try again.');
        setLoading(false);
        return;
      }

      router.push('/');
    } catch {
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: '#0C2833' }}>
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      {/* Left — Delta360 Navy brand panel */}
      <div
        className="hidden lg:flex w-[55%] flex-col justify-between px-16 py-12 relative overflow-hidden"
        style={{ background: '#0C2833' }}
      >
        {/* Decorative orange chevron — brand partial mark */}
        <div className="absolute -right-20 top-1/2 -translate-y-1/2 opacity-[0.06]">
          <svg width="500" height="400" viewBox="0 0 500 400" fill="none">
            <path d="M250 0L500 200L250 400L350 200L250 0Z" fill="#FF5C00" />
          </svg>
        </div>
        <div className="absolute right-12 top-12 opacity-20">
          <svg width="80" height="60" viewBox="0 0 80 60" fill="none">
            <path d="M40 0L80 35L65 35L40 14L15 35L0 35L40 0Z" fill="#FF5C00" />
          </svg>
        </div>

        {/* Logo area */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            {/* Delta chevron mark */}
            <svg width="44" height="32" viewBox="0 0 44 32" fill="none">
              <path d="M22 0L44 20L36 20L22 8.5L8 20L0 20L22 0Z" fill="#FF5C00" />
            </svg>
            <div>
              <span className="text-white text-xl font-bold tracking-tight-brand">delta</span>
              <span className="text-white/50 text-sm font-medium ml-0.5">360</span>
            </div>
          </div>
        </div>

        {/* Main messaging */}
        <div className="relative z-10 max-w-lg">
          <h1 className="text-[3.2rem] font-extrabold text-white leading-[1.08] tracking-tighter-brand">
            Intelligence
            <br />
            System
          </h1>
          <div className="mt-6 w-16 h-1 rounded-full" style={{ background: '#FF5C00' }} />
          <p className="mt-6 text-lg font-medium" style={{ color: '#8CAEC1' }}>
            Corporate Controller Platform
          </p>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: 'rgba(140, 174, 193, 0.7)' }}>
            Institutional-grade financial close, reconciliation, reporting,
            and operational intelligence for Delta360 Energy.
          </p>
        </div>

        {/* Footer */}
        <div className="relative z-10 flex items-center gap-6">
          <span className="text-xs" style={{ color: 'rgba(140, 174, 193, 0.5)' }}>
            Partners in Progress
          </span>
          <div className="w-px h-4" style={{ background: 'rgba(140, 174, 193, 0.2)' }} />
          <span className="text-xs" style={{ color: 'rgba(140, 174, 193, 0.5)' }}>
            Delta360 Energy &copy; {new Date().getFullYear()}
          </span>
        </div>
      </div>

      {/* Right — Login form */}
      <div className="w-full lg:w-[45%] flex flex-col justify-center px-8 sm:px-16 lg:px-20 bg-white">
        <div className="w-full max-w-sm mx-auto">
          {/* Mobile logo */}
          <div className="lg:hidden mb-10">
            <div className="flex items-center gap-2">
              <svg width="36" height="26" viewBox="0 0 44 32" fill="none">
                <path d="M22 0L44 20L36 20L22 8.5L8 20L0 20L22 0Z" fill="#FF5C00" />
              </svg>
              <span className="text-lg font-bold" style={{ color: '#0C2833' }}>delta<span className="text-sm font-medium opacity-40">360</span></span>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold tracking-tight-brand" style={{ color: '#0C2833' }}>
              Sign in
            </h2>
            <p className="mt-2 text-sm" style={{ color: '#8CAEC1' }}>
              Access the Delta360 Intelligence System
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 rounded-lg px-4 py-3" style={{ background: 'rgba(220, 38, 38, 0.06)', border: '1px solid rgba(220, 38, 38, 0.15)' }}>
              <p className="text-sm font-medium" style={{ color: '#DC2626' }}>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#8CAEC1' }}>
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#8CAEC1' }} />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@delta360.energy"
                  disabled={loading}
                  className="w-full rounded-lg pl-11 pr-4 py-3 text-sm font-medium transition-all duration-200"
                  style={{
                    background: '#F7F9FA',
                    border: '1.5px solid #DDE9EE',
                    color: '#0C2833',
                  }}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#8CAEC1' }}>
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#8CAEC1' }} />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  disabled={loading}
                  className="w-full rounded-lg pl-11 pr-11 py-3 text-sm font-medium transition-all duration-200"
                  style={{
                    background: '#F7F9FA',
                    border: '1.5px solid #DDE9EE',
                    color: '#0C2833',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 focus:outline-none"
                  style={{ color: '#8CAEC1' }}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg px-4 py-3 font-semibold text-sm text-white transition-all duration-200 flex items-center justify-center gap-2 mt-2"
              style={{
                background: loading ? '#FF8A40' : '#FF5C00',
                boxShadow: '0 2px 8px -2px rgba(255, 92, 0, 0.4)',
              }}
              onMouseEnter={(e) => !loading && (e.currentTarget.style.background = '#E04D00')}
              onMouseLeave={(e) => !loading && (e.currentTarget.style.background = '#FF5C00')}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="mt-8 pt-6" style={{ borderTop: '1px solid #DDE9EE' }}>
            <p className="text-xs text-center" style={{ color: 'rgba(140, 174, 193, 0.6)' }}>
              Protected system. Authorized personnel only.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
