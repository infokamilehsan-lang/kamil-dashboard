import { useEffect, useRef, useState, useCallback } from 'react';

// Use native BarcodeDetector on Chrome/Edge (fastest), polyfill only for Safari/Firefox
const getNativeDetector = () =>
  typeof window !== 'undefined' && window.BarcodeDetector ? window.BarcodeDetector : null;

let polyfillPromise = null;
const getPolyfillDetector = () => {
  if (!polyfillPromise) {
    polyfillPromise = import('barcode-detector').then((m) => m.BarcodeDetector);
  }
  return polyfillPromise;
};

export default function BarcodeScanner({ onScan, onError, active, style }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanRef = useRef(null);
  const lastCodeRef = useRef('');
  const lastTimeRef = useRef(0);
  const audioCtxRef = useRef(null);
  const [status, setStatus] = useState('starting');

  const playBeep = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.type = 'sine';
      o.frequency.setValueAtTime(1200, ctx.currentTime);
      g.gain.setValueAtTime(0.3, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      o.start(ctx.currentTime);
      o.stop(ctx.currentTime + 0.15);
    } catch { /* */ }
  }, []);

  const handleCode = useCallback(
    (code) => {
      const now = Date.now();
      if (code && (code !== lastCodeRef.current || now - lastTimeRef.current > 2000)) {
        lastCodeRef.current = code;
        lastTimeRef.current = now;
        playBeep();
        onScan?.(code);
      }
    },
    [onScan, playBeep],
  );

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    const start = async () => {
      try {
        // Get camera — prefer back camera
        let stream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }

        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        video.muted = true;
        await video.play();
        if (cancelled) return;

        setStatus('running');

        // Use native BarcodeDetector on Chrome/Edge, polyfill on Safari/Firefox
        const formats = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'codabar'];
        let detector;
        const NativeDet = getNativeDetector();
        if (NativeDet) {
          console.log('[BarcodeScanner] Using NATIVE BarcodeDetector');
          detector = new NativeDet({ formats });
        } else {
          console.log('[BarcodeScanner] Using WASM polyfill');
          const PolyfillDet = await getPolyfillDetector();
          if (cancelled) return;
          detector = new PolyfillDet({ formats });
        }

        // Continuous scan loop
        const scan = async () => {
          if (cancelled) return;
          try {
            if (video.readyState >= 2) {
              const results = await detector.detect(video);
              if (results.length > 0) {
                handleCode(results[0].rawValue);
              }
            }
          } catch { /* frame error, skip */ }
          if (!cancelled) {
            scanRef.current = requestAnimationFrame(scan);
          }
        };

        // Wait for video to be ready then start scanning
        const waitReady = () => {
          if (cancelled) return;
          if (video.readyState >= 2) {
            scanRef.current = requestAnimationFrame(scan);
          } else {
            setTimeout(waitReady, 100);
          }
        };
        waitReady();
      } catch {
        if (!cancelled) { setStatus('error'); onError?.('Camera access denied.'); }
      }
    };

    start();

    return () => {
      cancelled = true;
      if (scanRef.current) cancelAnimationFrame(scanRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      lastCodeRef.current = '';
      lastTimeRef.current = 0;
    };
  }, [active, handleCode, onError]);

  if (!active) return null;

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '10px',
        background: '#000',
        ...style,
      }}
    >
      <video
        ref={videoRef}
        playsInline
        autoPlay
        muted
        style={{
          width: '100%',
          height: '280px',
          objectFit: 'cover',
          display: 'block',
        }}
      />
      {/* Scan guide overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            width: '85%',
            maxWidth: '320px',
            height: '80px',
            border: '2px solid rgba(245, 158, 11, 0.8)',
            borderRadius: '8px',
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.25)',
          }}
        />
      </div>
      {/* Scanning line animation */}
      {status === 'running' && (
        <div
          style={{
            position: 'absolute',
            left: '8%',
            right: '8%',
            top: '50%',
            height: '2px',
            background:
              'linear-gradient(90deg, transparent 0%, #f59e0b 30%, #f59e0b 70%, transparent 100%)',
            animation: 'scanline 1.5s ease-in-out infinite alternate',
            transform: 'translateY(-50px)',
            pointerEvents: 'none',
          }}
        />
      )}
      {/* Status */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '6px',
          textAlign: 'center',
          background: 'rgba(0,0,0,0.6)',
          color: '#fbbf24',
          fontSize: '11px',
          fontWeight: 600,
          zIndex: 10,
        }}
      >
        {status === 'starting'
          ? '⏳ Starting camera...'
          : status === 'error'
            ? '⚠️ Camera error — check permissions'
            : '📷 Point barcode inside the box'}
      </div>
      <style>{`
        @keyframes scanline {
          0% { transform: translateY(-40px); opacity: 0.5; }
          50% { opacity: 1; }
          100% { transform: translateY(40px); opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
