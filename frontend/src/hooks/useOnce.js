import { useEffect, useRef } from 'react';

/**
 * Custom hook to ensure an effect runs only once, even in React StrictMode
 * @param {Function} effect - The effect function to run
 * @param {Array} deps - Dependencies array (optional)
 */
export const useOnce = (effect, deps = []) => {
  const hasRun = useRef(false);

  useEffect(() => {
    if (!hasRun.current) {
      hasRun.current = true;
      return effect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
};

export default useOnce;
