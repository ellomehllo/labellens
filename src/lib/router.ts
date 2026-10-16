import { useEffect, useState } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'scan' }
  | { name: 'reading' }
  | { name: 'review' }
  | { name: 'analyzing' }
  | { name: 'results' }
  | { name: 'history' }
  | { name: 'saved'; id: string }
  | { name: 'privacy' }
  | { name: 'sources' };

export function parseHash(hash: string): Route {
  const [first, second] = hash.replace(/^#\/?/, '').split('/');
  switch (first) {
    case 'scan':
    case 'reading':
    case 'review':
    case 'analyzing':
    case 'results':
    case 'privacy':
    case 'sources':
      return { name: first };
    case 'history':
      return second ? { name: 'saved', id: second } : { name: 'history' };
    default:
      return { name: 'home' };
  }
}

export function go(path: string, { replace = false } = {}) {
  const hash = `#${path}`;
  if (replace) {
    history.replaceState(null, '', hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    location.hash = hash;
  }
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(location.hash));
  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash(location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
