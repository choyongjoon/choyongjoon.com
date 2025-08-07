import { useEffect } from 'react';

export function useScrollToTop(key: string) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: should be called by key change
  useEffect(() => {
    document.documentElement.scrollTo({
      top: 0,
      left: 0,
      behavior: 'instant', // Optional if you want to skip the scrolling animation
    });
  }, [key]);
}
