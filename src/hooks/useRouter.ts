import { useState, useEffect, useCallback } from 'react';
import { parseRoute, setRoute, type Route } from '../lib/router';

export function useRouter() {
  const [currentRoute, setCurrentRoute] = useState<Route>(() =>
    parseRoute(window.location.hash)
  );

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentRoute(parseRoute(window.location.hash));
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = useCallback((route: Route) => {
    setRoute(route);
    setCurrentRoute(route);
  }, []);

  return {
    currentRoute,
    navigate,
  };
}
