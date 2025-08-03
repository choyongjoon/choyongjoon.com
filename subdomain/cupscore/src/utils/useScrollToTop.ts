import { useLocation } from '@tanstack/react-router';
import { useEffect } from 'react';

export function useScrollToTop() {
  const { pathname } = useLocation();

  // biome-ignore lint/correctness/useExhaustiveDependencies: need pathname to detect route change
  useEffect(() => {
    document.documentElement.scrollTo({
      top: 0,
      left: 0,
      behavior: 'instant', // Optional if you want to skip the scrolling animation
    });
  }, [pathname]);
}
