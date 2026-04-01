'use client';

import { useEffect, useState, useRef } from 'react';
import { usePathname } from 'next/navigation';

export default function LoadingBar() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const prevPathname = useRef(pathname);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (pathname !== prevPathname.current) {
      // Route changed — start loading
      setLoading(true);
      setProgress(0);

      // Animate quickly to 90%
      let p = 0;
      intervalRef.current = setInterval(() => {
        p += Math.random() * 20 + 10;
        if (p >= 90) {
          p = 90;
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
        setProgress(p);
      }, 100);

      // Complete after a short delay
      timerRef.current = setTimeout(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setProgress(100);
        setTimeout(() => {
          setLoading(false);
          setProgress(0);
        }, 200);
      }, 400);

      prevPathname.current = pathname;
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [pathname]);

  if (!loading && progress === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-0.5">
      <div
        className="h-full bg-[#FF5C00] transition-all ease-out"
        style={{
          width: `${progress}%`,
          transitionDuration: progress === 100 ? '200ms' : '300ms',
          opacity: progress === 100 ? 0 : 1,
        }}
      />
    </div>
  );
}
