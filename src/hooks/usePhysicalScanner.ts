import { useEffect, useRef, useCallback } from 'react';

interface UsePhysicalScannerOptions {
  onScan: (scannedValue: string) => void;
  scanTimeout?: number; // Time in ms to consider input complete after last character
  minLength?: number; // Minimum length of scanned string to be considered valid
  maxInterKeyDelay?: number; // Max ms between characters to be treated as scanner input
  ignoreWhenInputFocused?: boolean;
  onDebug?: (message: string, details?: unknown) => void;
}

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    target.isContentEditable
  );
};

const normalizeScanValue = (value: string) => value.trim();

export const usePhysicalScanner = ({
  onScan,
  scanTimeout = 80,
  minLength = 3,
  maxInterKeyDelay = 45,
  ignoreWhenInputFocused = true,
  onDebug,
}: UsePhysicalScannerOptions) => {
  const bufferRef = useRef<string>('');
  const firstKeyTimeRef = useRef<number>(0);
  const timeoutRef = useRef<number | null>(null);
  const lastKeyPressTimeRef = useRef<number>(0);
  const onScanRef = useRef(onScan);
  const onDebugRef = useRef(onDebug);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    onDebugRef.current = onDebug;
  }, [onDebug]);

  const debug = useCallback((message: string, details?: unknown) => {
    onDebugRef.current?.(message, details);
  }, []);

  const resetBuffer = useCallback(() => {
    bufferRef.current = '';
    firstKeyTimeRef.current = 0;
    lastKeyPressTimeRef.current = 0;
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const flushScan = useCallback(() => {
    const value = normalizeScanValue(bufferRef.current);
    const firstKeyTime = firstKeyTimeRef.current;
    const lastKeyTime = lastKeyPressTimeRef.current;
    resetBuffer();

    if (value.length < minLength || !firstKeyTime || !lastKeyTime) return;

    const duration = Math.max(1, lastKeyTime - firstKeyTime);
    const averageDelay = duration / Math.max(1, value.length - 1);
    if (averageDelay > maxInterKeyDelay) {
      debug('USB scanner input rejected as human typing', { valueLength: value.length, duration, averageDelay, maxInterKeyDelay });
      return;
    }

    debug('USB scanner input accepted', { valueLength: value.length, averageDelay });
    onScanRef.current(value);
  }, [debug, maxInterKeyDelay, minLength, resetBuffer]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (ignoreWhenInputFocused && isEditableTarget(event.target)) {
      debug('USB scanner key ignored because an editable field is focused', {
        key: event.key,
        target: event.target instanceof HTMLElement ? event.target.tagName.toLowerCase() : 'unknown',
      });
      return;
    }

    // Ignore modifier keys and function keys
    if (
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      (event.key.length > 1 && event.key !== 'Enter' && event.key !== 'Tab')
    ) {
      return;
    }

    const currentTime = Date.now();
    const timeSinceLastKey = currentTime - lastKeyPressTimeRef.current;
    lastKeyPressTimeRef.current = currentTime;

    if (!firstKeyTimeRef.current) {
      firstKeyTimeRef.current = currentTime;
    }

    if (timeSinceLastKey > scanTimeout * 2) {
      bufferRef.current = '';
      firstKeyTimeRef.current = currentTime;
    }

    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      flushScan();
      return;
    }

    bufferRef.current += event.key;
    if (bufferRef.current.length === 1) {
      debug('USB scanner buffer started');
    }

    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      flushScan();
    }, scanTimeout);
  }, [debug, flushScan, ignoreWhenInputFocused, resetBuffer, scanTimeout]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      resetBuffer();
    };
  }, [handleKeyDown, resetBuffer]);

  return { scannedCode: bufferRef.current };
};
