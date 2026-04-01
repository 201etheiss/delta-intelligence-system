'use client';

import { signIn } from 'next-auth/react';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#09090B]">
      <div className="flex flex-col items-center gap-8 w-full max-w-sm px-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/@2x/delta-dark-360@2x.png"
            alt="Delta360"
            className="h-12 w-auto"
          />
          <h1 className="text-white text-2xl font-semibold tracking-wide">
            Delta Intelligence
          </h1>
          <p className="text-[#71717A] text-sm text-center">
            Enterprise AI Platform
          </p>
        </div>

        {/* Sign-in card */}
        <div className="w-full rounded-lg border border-[#27272A] bg-[#18181B] p-6">
          <button
            onClick={() => signIn('azure-ad', { callbackUrl: '/' })}
            className="flex items-center justify-center gap-3 w-full rounded-md bg-[#FE5000] px-4 py-3 text-sm font-semibold text-white hover:bg-[#CC4000] transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 21 21"
              fill="currentColor"
            >
              <rect x="1" y="1" width="9" height="9" />
              <rect x="11" y="1" width="9" height="9" />
              <rect x="1" y="11" width="9" height="9" />
              <rect x="11" y="11" width="9" height="9" />
            </svg>
            Sign in with Microsoft 365
          </button>
        </div>

        <p className="text-[#52525B] text-xs text-center">
          Delta360 &mdash; Internal Use Only
        </p>
      </div>
    </div>
  );
}
