import { useEffect, RefObject } from 'react';

/**
 * Hook that calls handler when a click occurs outside of the passed ref element
 * Also supports closing on Escape key press
 */
export function useOnClickOutside<T extends HTMLElement = HTMLElement>(
  ref: RefObject<T>,
  handler: (event: Event) => void,
  enabled: boolean = true
) {
  useEffect(() => {
    if (!enabled) return;

    // Add a small delay to prevent immediate triggering
    let timeoutId: NodeJS.Timeout;

    const listener = (event: Event) => {
      const el = ref?.current;
      if (!el || el.contains((event?.target as Node) || null)) {
        return;
      }
      handler(event);
    };

    const escapeListener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handler(event);
      }
    };

    // Delay adding the event listeners to avoid immediate triggering
    timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', listener);
      document.addEventListener('touchstart', listener);
      document.addEventListener('keydown', escapeListener);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
      document.removeEventListener('keydown', escapeListener);
    };
  }, [ref, handler, enabled]);
}
