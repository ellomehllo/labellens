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
import { Icon } from './components/Icon.tsx';
import { analyzeLabel, ApiError, extractLabel, getStatus } from './lib/api.ts';
import { deleteScan, getScan, getSettings, saveScan } from './lib/history.ts';
import type { PreparedImage } from './lib/image.ts';
import { STATIC_SITE } from './lib/mode.ts';
import { go, useRoute, type Route } from './lib/router.ts';
import { fetchVault, getUnlocked, lock, setCurrent } from './lib/unlock.ts';
import { blankSections, exampleSections } from './lib/sample.ts';
import { Capture } from './screens/Capture.tsx';
import { HistoryScreen } from './screens/History.tsx';
import { Home } from './screens/Home.tsx';
import { Privacy } from './screens/Privacy.tsx';
import { Results } from './screens/Results.tsx';
import { Review } from './screens/Review.tsx';
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
      const saved = getSettings().autoSave ? saveScan(analysis, flow.sections) : null;
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
    setFlow({ ...emptyFlow(), input: 'example', sections: exampleSections(), category: 'food', market: 'US' });
    go('/review');
  };

  const locked = gate.state !== 'open';
  const content =
    locked && route.name !== 'privacy' ? (
      <Unlock
        gate={gate}
        onUnlocked={() => {
          if (gate.state === 'locked') setGate({ state: 'open', vault: gate.vault });
        }}
      />
    ) : (
      renderRoute(route)
    );

  function lockApp() {
    lock();
    startNew();
    setStatus(null);
    if (gate.state === 'open' && gate.vault) setGate({ state: 'locked', vault: gate.vault });
    go('/');
  }

  function renderRoute(r: Route) {
    switch (r.name) {
      case 'home':
        return (
          <Home
            status={status}
            onPhotos={(images) => {
              startNew();
              setFlow({ ...emptyFlow(), images });
              go('/scan');
            }}
            onCamera={() => {
              startNew();
              go('/scan');
            }}
            onTyped={startTyped}
            onExample={startExample}
          />
        );
      case 'scan':
        return <Capture images={flow.images} onChange={(images) => updateFlow({ images })} onContinue={readLabel} />;
      case 'reading':
      case 'analyzing':
        if (!job) return <Redirect to={r.name === 'reading' ? '/scan' : '/review'} />;
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
        return (
          <Review
            flow={flow}
            onChange={updateFlow}
            onAnalyze={analyze}
            onRetake={() => go('/scan')}
          />
        );
      case 'results':
        if (!flow.analysis) return <Redirect to="/" />;
        return (
          <Results
            analysis={flow.analysis}
            savedId={flow.savedId}
            onSave={() => {
              const scan = flow.analysis ? saveScan(flow.analysis, flow.sections) : null;
              if (scan) updateFlow({ savedId: scan.id });
              return Boolean(scan);
            }}
            onUnsave={() => {
              if (flow.savedId) deleteScan(flow.savedId);
              updateFlow({ savedId: null });
            }}
            onCorrect={() => go('/review')}
            onNew={() => {
              startNew();
              go('/');
            }}
          />
        );
      case 'saved': {
        const scan = getScan(r.id);
        if (!scan) return <Redirect to="/history" />;
        return (
          <Results
            analysis={scan.analysis}
            savedId={scan.id}
            fromHistory
            onSave={() => true}
            onUnsave={() => {}}
            onCorrect={() => {
              startNew();
              setFlow({
                ...emptyFlow(),
                input: scan.analysis.meta.input,
                sections: scan.sections,
                category: scan.analysis.product.category,
                market: scan.analysis.product.market,
              });
              go('/review');
            }}
            onNew={() => {
              startNew();
              go('/');
            }}
          />
        );
      }
      case 'history':
        return <HistoryScreen />;
      case 'privacy':
        return <Privacy status={status} />;
      case 'sources':
        return <Sources />;
    }
  }

  return (
    <div className="app">
      <a className="skip-link" href="#main" onClick={(e) => {
        e.preventDefault();
        document.getElementById('main')?.focus();
      }}>
        Skip to content
      </a>
      <header className="site-header">
        <div className="inner">
          <a className="brand" href="#/">
            <span className="brand-mark">
              <Icon name="tag" size={18} />
            </span>
            LabelLens
          </a>
          <nav className="site-nav" aria-label="Main">
            {!locked && (
              <>
                <a href="#/history" aria-current={route.name === 'history' || route.name === 'saved' ? 'page' : undefined}>
                  History
                </a>
                <a href="#/sources" aria-current={route.name === 'sources' ? 'page' : undefined}>
                  Sources
                </a>
              </>
            )}
            <a href="#/privacy" aria-current={route.name === 'privacy' ? 'page' : undefined}>
              Privacy
            </a>
            {STATIC_SITE && !locked && (
              <button className="nav-btn" onClick={lockApp} title="Forget the unlocked key on this device">
                Lock
              </button>
            )}
          </nav>
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        {content}
      </main>
      <footer className="site-footer">
        <div className="inner">
          <span>LabelLens explains labels. It doesn’t replace the label, a professional or a regulator.</span>
          <span>
            <a href="#/privacy">Privacy</a> · <a href="#/sources">Sources</a>
          </span>
        </div>
      </footer>
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
