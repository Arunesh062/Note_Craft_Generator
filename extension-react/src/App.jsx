/**
 * NoteCraft AI — Floating Widget
 *
 * Architecture decisions:
 * ─────────────────────────────────────────────────────────────────
 * 1. SINGLE JSX TREE — both FAB and expanded card are always in the
 *    DOM; visibility is toggled by CSS class only.  This prevents
 *    React from unmounting/remounting and losing all internal state.
 *
 * 2. FULLY REF-BASED DRAG — position is stored in a ref AND in state.
 *    Drag handlers close over refs, never over state, so they are
 *    immune to stale closures regardless of how often the component
 *    re-renders or dependencies change.
 *
 * 3. SAFE POSITION — every path that produces a position value
 *    normalises it through safePos() so top/left can never be
 *    undefined, NaN, or negative.
 *
 * 4. DRAG / CLICK DISAMBIGUATION — a drag is only registered when
 *    the pointer moves > 4 px. If it doesn't, the mouseup is
 *    treated as a plain click (toggle minimise on FAB).
 * ─────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, Download, RefreshCw, Minus, Loader2 } from 'lucide-react';

/* ── helpers ──────────────────────────────────────────────────── */

const DEFAULT_POS = { top: 120, left: 120 };

/** Return a position object guaranteed to have numeric top & left. */
function safePos(pos) {
  if (!pos || typeof pos !== 'object') return { ...DEFAULT_POS };
  const top  = typeof pos.top  === 'number' && isFinite(pos.top)  ? Math.max(0, pos.top)  : DEFAULT_POS.top;
  const left = typeof pos.left === 'number' && isFinite(pos.left) ? Math.max(0, pos.left) : DEFAULT_POS.left;
  return { top, left };
}

const mapStateToScreen = (state) => {
  if (!state) return 'start';
  if (state === 'idle') return 'start';
  if (state === 'ready') return 'complete';
  return state;
};

/* ── component ────────────────────────────────────────────────── */

const App = ({ mode = 'popup' }) => {
  /* ── state ── */
  const [screen,         setScreen]         = useState('start');   // start | recording | processing | complete
  const [timer,          setTimer]          = useState('00:00');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isMinimized,    setIsMinimized]    = useState(false);
  const [position,       setPosition]       = useState(DEFAULT_POS);
  const [sessionId,      setSessionId]      = useState(null);
  const [transcript,     setTranscript]     = useState('');
  const [downloadUrl,    setDownloadUrl]    = useState('');

  /* ── refs (immune to render cycles) ── */
  const posRef       = useRef(DEFAULT_POS); // always reflects latest position
  const timerRef     = useRef(null);
  const didDragRef   = useRef(false);        // true if pointer moved > threshold during a mousedown
  const isMinRef     = useRef(false);        // mirrors isMinimized so drag handlers see current value

  /* keep refs in sync with state */
  useEffect(() => { posRef.current    = position;    }, [position]);
  useEffect(() => { isMinRef.current  = isMinimized; }, [isMinimized]);

  // Console logs for debugging as requested
  console.log("Current screen:", screen);
  console.log("Rendering screen:", screen);

  /* ── format ── */
  const formatTime = (s) => {
    const h = String(Math.floor(s / 3600)).padStart(2, '0');
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const sec = String(s % 60).padStart(2, '0');
    return mode === 'popup' ? `${h}:${m}:${sec}` : `${m}:${sec}`;
  };

  /* ── Chrome Storage sync ── */
  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome?.storage?.local) return;

    chrome.storage.local.get(
      ['currentState', 'elapsedSeconds', 'nc_minimized', 'nc_pos', 'currentSession', 'transcript', 'downloadUrl'],
      (data) => {
        setScreen(mapStateToScreen(data.currentState));
        const sec = data.elapsedSeconds || 0;
        setElapsedSeconds(sec);
        setTimer(formatTime(sec));
        setIsMinimized(data.nc_minimized || false);
        setSessionId(data.currentSession || null);
        setTranscript(data.transcript || '');
        setDownloadUrl(data.downloadUrl || '');
        // Always validate the stored position
        if (data.nc_pos) {
          const p = safePos(data.nc_pos);
          posRef.current = p;
          setPosition(p);
        }
      }
    );

    const onStorageChange = (changes) => {
      if (changes.currentState) {
        setScreen(mapStateToScreen(changes.currentState.newValue));
      }
      if (changes.elapsedSeconds) {
        const sec = changes.elapsedSeconds.newValue || 0;
        setElapsedSeconds(sec);
        setTimer(formatTime(sec));
      }
      if (changes.nc_minimized) {
        setIsMinimized(changes.nc_minimized.newValue !== undefined ? Boolean(changes.nc_minimized.newValue) : false);
      }
      if (changes.currentSession) {
        setSessionId(changes.currentSession.newValue || null);
      }
      if (changes.transcript) {
        setTranscript(changes.transcript.newValue || '');
      }
      if (changes.downloadUrl) {
        setDownloadUrl(changes.downloadUrl.newValue || '');
      }
      if (changes.nc_pos) {
        const p = safePos(changes.nc_pos.newValue);
        posRef.current = p;
        setPosition(p);
      }
    };

    chrome.storage.onChanged.addListener(onStorageChange);
    return () => chrome.storage.onChanged.removeListener(onStorageChange);
  }, []);

  /* ── timer ── */
  useEffect(() => {
    if (screen === 'recording') {
      timerRef.current = setInterval(
        () => {
          setElapsedSeconds(prev => {
            const next = prev + 1;
            setTimer(formatTime(next));
            return next;
          });
        },
        1000
      );
    } else {
      clearInterval(timerRef.current);
      if (screen === 'start' || screen === 'idle') {
        setElapsedSeconds(0);
        setTimer("00:00");
      }
    }
    return () => clearInterval(timerRef.current);
  }, [screen]);

  /* ── recording actions ── */
  const handleStart = () => {
    if (mode === 'popup') {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { action: 'START_RECORDING' });
      });
    } else {
      window.dispatchEvent(new CustomEvent('nc-start-recording'));
    }
    setScreen('recording');
  };

  const handleStop = () => {
    if (mode === 'popup') {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { action: 'STOP_RECORDING' });
      });
    } else {
      window.dispatchEvent(new CustomEvent('nc-stop-recording'));
    }
    setScreen('processing');
  };

  const handleDownload = () => {
    chrome.storage.local.get(['currentSession'], (data) => {
      window.open(`http://localhost:8000/download/${data.currentSession}`, '_blank');
    });
  };

  /**
   * Reusable function to completely reset the NoteCraft session
   * and all associated React / extension state.
   */
  const resetSession = () => {
    // 1. Reset all React states instantly
    setScreen("start");
    setTimer("00:00");
    setTranscript("");
    setDownloadUrl("");
    setSessionId(null);
    setIsMinimized(false);

    // 2. Clear session-specific storage entries (preserving layout/position, nc_pos)
    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
      chrome.storage.local.remove([
        'currentState',
        'currentSession',
        'elapsedSeconds',
        'transcript',
        'downloadUrl',
        'nc_minimized'
      ], () => {
        // Force state update to notify any other active contexts/listeners
        chrome.storage.local.set({
          currentState: 'idle',
          nc_minimized: false
        });
      });
    }

    // 3. Notify the content script or other local scripts to completely tear down active session
    window.dispatchEvent(new CustomEvent('nc-session-reset'));
  };

  /* ── toggle minimise ──
     Called by the FAB (onClick) and by the minus button.
     Suppressed if the pointer just finished a drag.              */
  const toggleMinimize = (e) => {
    e.stopPropagation();
    if (didDragRef.current) return;          // suppress — was a drag, not a click
    const next = !isMinRef.current;
    setIsMinimized(next);
    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
      chrome.storage.local.set({ nc_minimized: next });
    }
  };

  /* ── DRAG — single implementation, used by both FAB and header ──
     All values come from refs, so this function never needs to be
     recreated via useCallback; it is defined once at mount time.   */
  const makeDragHandler = () => (e) => {
    if (mode !== 'widget') return;
    e.preventDefault();
    e.stopPropagation();

    const startX    = e.clientX;
    const startY    = e.clientY;
    const startTop  = posRef.current.top;
    const startLeft = posRef.current.left;
    didDragRef.current = false;

    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        didDragRef.current = true;
      }

      const newPos = safePos({ top: startTop + dy, left: startLeft + dx });
      posRef.current = newPos;              // instant — no re-render lag
      setPosition(newPos);                  // schedule re-render for the visual update
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);

      // Save final position to storage
      if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
        chrome.storage.local.set({ nc_pos: posRef.current });
      }

      // Reset didDragRef AFTER the click event has been dispatched
      // (click fires synchronously before the next task)
      setTimeout(() => { didDragRef.current = false; }, 0);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  };

  // Create stable handler references that live for the component lifetime.
  // We use useRef here so they are never re-created (no stale closures).
  const fabDragHandler    = useRef(makeDragHandler()).current;
  const headerDragHandler = useRef(makeDragHandler()).current;

  /* ── derived safe style position ── */
  const pos = safePos(position);
  const widgetStyle = mode === 'widget'
    ? { position: 'fixed', top: pos.top, left: pos.left, zIndex: 2147483647 }
    : {};

  const isRecordingScreen = screen === 'recording';

  /* ════════════════════════════════════════════════════════════
     RENDER — single tree, both FAB and card always in the DOM.
     CSS class drives which one is visible.
  ════════════════════════════════════════════════════════════ */
  return (
    <>
      {/* ── MINIMISED FAB BUBBLE ─────────────────────────────── */}
      {mode === 'widget' && (
        <div
          className={[
            'nc-fab',
            isMinimized        ? 'nc-fab--visible'    : 'nc-fab--hidden',
            isRecordingScreen  ? 'nc-fab--recording' : '',
          ].join(' ')}
          style={{ top: pos.top, left: pos.left }}
          onMouseDown={fabDragHandler}
          onClick={toggleMinimize}
          title="Expand NoteCraft"
          aria-label="NoteCraft AI — click to expand"
        >
          {isRecordingScreen && <div className="nc-fab-ring" />}
          <div className="nc-fab-dot" />
          <span className="nc-fab-timer">{timer}</span>
        </div>
      )}

      {/* ── EXPANDED WIDGET CARD ─────────────────────────────── */}
      <div
        key={screen}
        className={[
          'nc-widget',
          isRecordingScreen                           ? 'recording'    : '',
          mode === 'widget' && isMinimized            ? 'nc-widget--hidden' : '',
        ].join(' ')}
        style={widgetStyle}
      >
        {/* Header — drag handle */}
        <div
          className="nc-header"
          onMouseDown={mode === 'widget' ? headerDragHandler : undefined}
        >
          <div className="nc-logo-group">
            <div className="nc-dot" />
            <span className="nc-title">NoteCraft AI</span>
          </div>
          <div className="nc-actions">
            {mode === 'widget' && (
              <button
                className="nc-action-btn"
                onClick={toggleMinimize}
                title="Minimise"
              >
                <Minus size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Body with guaranteed fallbacks to prevent empty/blank states */}
        <div className="nc-body">
          {(screen === 'start' || screen === 'idle' || !['recording', 'processing', 'complete', 'ready'].includes(screen)) && (
            <div className="nc-content">
              <p className="nc-status">Ready to capture your meeting insights.</p>
              <button onClick={handleStart} className="nc-btn nc-btn-primary">
                <Play size={16} /> Start Recording
              </button>
            </div>
          )}

          {screen === 'recording' && (
            <div className="nc-content">
              <div className="nc-recording-badge">● Live Recording</div>
              <div className="nc-timer">{timer}</div>
              <button onClick={handleStop} className="nc-btn nc-btn-danger">
                <Square size={16} /> Stop Meeting
              </button>
            </div>
          )}

          {screen === 'processing' && (
            <div className="nc-content">
              <p className="nc-title-text">Orchestrating Notes</p>
              <div className="nc-progress-container">
                <div className="nc-progress-bar">
                  <div className="nc-progress-inner" />
                </div>
              </div>
              <p className="nc-status">Synthesising AI insights…</p>
              <Loader2 className="nc-spin" style={{ margin: '8px auto', display: 'block' }} />
            </div>
          )}

          {(screen === 'complete' || screen === 'ready') && (
            <div className="nc-content">
              <p className="nc-title-text" style={{ color: '#10b981' }}>✓ Notes Ready!</p>
              <button onClick={handleDownload} className="nc-btn nc-btn-success">
                <Download size={16} /> Download DOCX
              </button>
              <button onClick={resetSession} className="nc-btn nc-btn-ghost">
                <RefreshCw size={14} /> New Session
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default App;
