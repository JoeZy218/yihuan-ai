import { useState, useEffect } from 'react';

/**
 * 监听 CSS 媒体查询是否匹配。
 * 初值同步取自 window.matchMedia，避免 SSR/CSR 不一致；本项目 CSR 单页可放心使用。
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(query);
    const handler = () => setMatches(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [query]);

  return matches;
}
