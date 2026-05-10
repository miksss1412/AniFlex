'use client';

import { useLayoutEffect } from 'react';

export default function ScrollToTopOnMount() {
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, []);

  return null;
}
