import { useState, useEffect, useRef, useCallback } from 'react';

interface UsePhysicalScannerOptions {
  onScan: (scannedValue: string) => void;
  scanTimeout?: number; // Time in ms to consider input complete after last character
  minLength?: number; // Minimum length of scanned string to be considered valid
}

export const usePhysicalScanner = ({ onScan, scanTimeout = 50, minLength = 3 }: UsePhysicalScannerOptions) => {
  const [scannedCode, setScannedCode] = useState<string>('');
  const timeoutRef = useRef<number | null>(null);
  const lastKeyPressTimeRef = useRef<number>(0);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Ignore modifier keys and function keys
    if (event.metaKey || event.ctrlKey || event.altKey || event.key.length > 1 && event.key !== 'Enter') {
      return;
    }

    const currentTime = Date.now();
    const timeSinceLastKey = currentTime - lastKeyPressTimeRef.current;
    lastKeyPressTimeRef.current = currentTime;

    // If a significant pause, reset the scanned code (likely new scan or manual typing)
    if (timeSinceLastKey > scanTimeout * 2) { // Allow a bit more leeway for initial key press
      setScannedCode('');
    }

    if (event.key === 'Enter') {
      event.preventDefault(); // Prevent form submission or new line
      if (scannedCode.length >= minLength) {
        onScan(scannedCode);
      }
      setScannedCode(''); // Reset after processing
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    } else {
      setScannedCode((prev) => prev + event.key);

      // Clear any existing timeout
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }

      // Set a new timeout to clear the code if no further input is received quickly
      timeoutRef.current = window.setTimeout(() => {
        if (scannedCode.length >= minLength) {
          onScan(scannedCode + event.key); // Include the last key if timeout triggers
        }
        setScannedCode('');
        timeoutRef.current = null;
      }, scanTimeout);
    }
  }, [onScan, scanTimeout, minLength, scannedCode]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, [handleKeyDown]);

  return { scannedCode };
};
