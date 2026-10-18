import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MARKETS,
  type Analysis,
  type Category,
  type Extraction,
  type InputKind,
  type LabelSection,
  type ServiceStatus,
} from '../shared/types.ts';
import { analyzeLabel, ApiError, extractLabel, getStatus } from './lib/api.ts';
import { getScan, saveScan } from './lib/history.ts';
import type { PreparedImage } from './lib/image.ts';
import { STATIC_SITE } from './lib/mode.ts';
import { go, useRoute, type Route } from './lib/router.ts';
import { getSettings, updateSettings } from './lib/settings.ts';
import { fetchVault, getUnlocked, lock, setCurrent } from './lib/unlock.ts';
import { blankSections, exampleSections } from './lib/sample.ts';
import { Capture } from './screens/Capture.tsx';
import { HistoryScreen } from './screens/History.tsx';
import { Intro } from './screens/Intro.tsx';
import { Privacy } from './screens/Privacy.tsx';
import { Results } from './screens/Results.tsx';
import { Review } from './screens/Review.tsx';
import { Settings } from './screens/Settings.tsx';
import { Sources } from './screens/Sources.tsx';
import { Unlock, type Gate } from './screens/Unlock.tsx';
import { Working } from './screens/Working.tsx';

export interface Flow {
  input: InputKind;
  images: PreparedImage[];
  extraction: Extraction | null;
  sections: LabelSection[];
  category: Category;
  market: string | null;
  analysis: Analysis | null;
  savedId: string | null;
}

const emptyFlow = (): Flow => ({
  input: 'photo',
  images: [],
  extraction: null,
  sections: [],
  category: 'other',
  market: null,
  analysis: null,
  savedId: null,
});

export interface Job {
  kind: 'extract' | 'analyze';
  stage: string | null;
  error: ApiError | null;
}

export function App() {
  const route = useRoute();
  const [status, setStatus] = useState<ServiceStatus | 'offline' | null>(null);
  const [flow, setFlow] = useState<Flow>(emptyFlow);
  const [job, setJob] = useState<Job | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // The GitHub Pages build is password protected: nothing but the privacy page shows until unlocked.
  const [gate, setGate] = useState<Gate>(STATIC_SITE ? { state: 'loading' } : { state: 'open' });

  useEffect(() => {
    if (!STATIC_SITE) return;
    fetchVault()
      .then((vault) => {
        if (!vault) return setGate({ state: 'missing' });
        const contents = getUnlocked(vault);
        setCurrent(contents);
        setGate(contents ? { state: 'open', vault } : { state: 'locked', vault });
      })
      .catch(() => setGate({ state: 'missing' }));
  }, []);

  useEffect(() => {
    if (gate.state !== 'open') return;
    getStatus()
      .then(setStatus)
      .catch(() => setStatus('offline'));
  }, [gate.state]);

  // Leaving a progress screen (e.g. with the back button) cancels the request in flight.
  useEffect(() => {
    if (route.name !== 'reading' && route.name !== 'analyzing' && abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      setJob(null);
    }
  }, [route.name]);

  const updateFlow = useCallback((patch: Partial<Flow>) => setFlow((f) => ({ ...f, ...patch })), []);

  const startNew = useCallback(() => {
    flow.images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    setFlow(emptyFlow());
    setJob(null);
  }, [flow.images]);

  const readLabel = useCallback(async () => {
    const controller = new AbortController();
    abortRef.current = controller;
    setJob({ kind: 'extract', stage: 'uploading', error: null });
    go('/reading');
    try {
      const extraction = await extractLabel(
        flow.images,
        (stage) => setJob((j) => (j ? { ...j, stage } : j)),
        controller.signal,
      );
      setFlow((f) => ({
        ...f,
        input: 'photo',
        extraction,
        sections: extraction.sections,
        category: extraction.category,
        market: matchMarket(extraction.market),
        analysis: null,
        savedId: null,
      }));
      abortRef.current = null;
      setJob(null);
      go('/review', { replace: true });
    } catch (error) {
      if (controller.signal.aborted) return;
      setJob({ kind: 'extract', stage: null, error: asApiError(error) });
    }
  }, [flow.images]);

  const analyze = useCallback(async () => {
    const controller = new AbortController();
    abortRef.current = controller;
    setJob({ kind: 'analyze', stage: 'sending', error: null });
    go('/analyzing');
    try {
      const analysis = await analyzeLabel(
        {
          sections: flow.sections.map(({ kind, text, confidence, edited }) => ({ kind, text, confidence, edited })),
          category: flow.category,
          market: flow.market,
          input: flow.input,
          readability: flow.extraction?.readability ?? null,
        },
        (stage) => setJob((j) => (j ? { ...j, stage } : j)),
        controller.signal,
      );
      const saved = getSettings().saveHistory ? saveScan(analysis, flow.sections) : null;
      setFlow((f) => ({ ...f, analysis, savedId: saved?.id ?? null }));
      abortRef.current = null;
      setJob(null);
      go('/results', { replace: true });
    } catch (error) {
      if (controller.signal.aborted) return;
      setJob({ kind: 'analyze', stage: null, error: asApiError(error) });
    }
  }, [flow.sections, flow.category, flow.market, flow.input, flow.extraction]);

  const startTyped = () => {
    startNew();
    setFlow({ ...emptyFlow(), input: 'typed', sections: blankSections() });
    go('/review');
  };

  const startExample = () => {
    startNew();
    setFlow({ ...emptyFlow(), input: 'example', sections: exampleSections(), category: 'food', market: null });
    go('/review');
  };

  const scanAnother = () => {
    startNew();
    go('/');
  };

  const finishIntro = () => {
    updateSettings({ introSeen: true });
    go('/', { replace: true });
  };

  function lockApp() {
    lock();
    startNew();
    setStatus(null);
    if (gate.state === 'open' && gate.vault) setGate({ state: 'locked', vault: gate.vault });
    go('/');
  }

  /** Back from an inner screen: browser history when there is some, else the scanner. */
  const back = () => (history.length > 1 ? history.back() : go('/'));

  function renderRoute(r: Route) {
    switch (r.name) {
      case 'home':
        if (!getSettings().introSeen) return <Redirect to="/intro" />;
        return (
          <Capture
            images={flow.images}
            status={status}
            onChange={(images) => updateFlow({ images })}
            onContinue={readLabel}
            onTyped={startTyped}
            onExample={startExample}
            onSettings={() => go('/settings')}
            onHistory={() => go('/history')}
          />
        );
      case 'intro':
        return <Intro onDone={finishIntro} />;
      case 'reading':
      case 'analyzing':
        if (!job) return <Redirect to={r.name === 'reading' ? '/' : '/review'} />;
        return (
          <Working
            job={job}
            onRetry={job.kind === 'extract' ? readLabel : analyze}
            onBack={() => history.back()}
            onTyped={startTyped}
          />
        );
      case 'review':
        if (flow.sections.length === 0 && !flow.extraction) return <Redirect to="/" />;
        return <Review flow={flow} onChange={updateFlow} onAnalyze={analyze} onRetake={() => go('/')} onBack={back} />;
      case 'results':
        if (!flow.analysis) return <Redirect to="/" />;
        return (
          <Results
            analysis={flow.analysis}
            sections={flow.sections}
            onBack={() => go('/review')}
            onNew={scanAnother}
            onHistory={() => go('/history')}
            onSettings={() => go('/settings')}
          />
        );
      case 'saved': {
        const scan = getScan(r.id);
        if (!scan) return <Redirect to="/history" />;
        return (
          <Results
            analysis={scan.analysis}
            sections={scan.sections}
            onBack={back}
            onNew={scanAnother}
            onHistory={() => go('/history')}
            onSettings={() => go('/settings')}
          />
        );
      }
      case 'history':
        return <HistoryScreen onBack={back} onScan={scanAnother} />;
      case 'settings':
        return (
          <Settings
            status={status}
            onBack={back}
            onReplayIntro={() => go('/intro')}
            onLock={STATIC_SITE && gate.state === 'open' ? lockApp : null}
          />
        );
      case 'privacy':
        return <Privacy status={status} onBack={back} />;
      case 'sources':
        return <Sources onBack={back} />;
    }
  }

  const locked = gate.state !== 'open';
  return (
    <div className="app">
      {locked && route.name !== 'privacy' ? (
        <Unlock
          gate={gate}
          onUnlocked={() => {
            if (gate.state === 'locked') setGate({ state: 'open', vault: gate.vault });
          }}
        />
      ) : (
        renderRoute(route)
      )}
    </div>
  );
}

function Redirect({ to }: { to: string }) {
  useEffect(() => go(to, { replace: true }), [to]);
  return null;
}

function asApiError(error: unknown): ApiError {
  return error instanceof ApiError ? error : new ApiError('unknown', 'Something unexpected went wrong. Please try again.');
}

const MARKET_HINTS: Record<string, RegExp> = {
  US: /\b(us|usa|u\.s\.|united states|america)\b/i,
  CA: /\b(canada|ca)\b/i,
  EU: /\b(eu|european union|europe|germany|france|italy|spain|netherlands|ireland|belgium|austria|poland|sweden)\b/i,
  UK: /\b(uk|united kingdom|great britain|england|scotland|wales)\b/i,
  IN: /\b(india|in)\b/i,
  AU: /\b(australia|new zealand|au|nz)\b/i,
};

function matchMarket(market: string | null): string | null {
  if (!market) return null;
  const hit = MARKETS.find((m) => m.id !== 'other' && MARKET_HINTS[m.id]?.test(market));
  return hit ? hit.id : null;
}
