import { useEffect, useState } from 'react';
import type { Job } from '../App.tsx';
import { Mochi, SpeechBubble } from '../components/Mochi.tsx';
import { Notice } from '../components/ui.tsx';

// Each line appears only once the server (or the in-browser engine) reports that step has started.
const EXTRACT_STAGES = [
  { id: 'uploading', line: 'Getting your photo…' },
  { id: 'reading_text', line: 'Spotting the ingredients…' },
  { id: 'organising_text', line: 'Sorting what I read…' },
];

const ANALYZE_STAGES = [
  { id: 'sending', line: 'Getting ready…' },
  { id: 'interpreting', line: 'Reading the tiny print…' },
  { id: 'checking_sources', line: 'Checking trusted sources…' },
  { id: 'checking_wording', line: 'Double-checking my wording…' },
];

interface Props {
  job: Job;
  onRetry: () => void;
  onBack: () => void;
  onTyped: () => void;
}

export function Working({ job, onRetry, onBack, onTyped }: Props) {
  const extracting = job.kind === 'extract';
  const stages = extracting ? EXTRACT_STAGES : ANALYZE_STAGES;
  const seconds = useSeconds(job.error ? null : job.kind);
  const slow = seconds >= 20;

  if (job.error) {
    const notConfigured = ['ai_not_configured', 'ai_auth', 'ai_quota', 'ai_model'].includes(job.error.code);
    return (
      <div className="working">
        <SpeechBubble>{extracting ? 'Hmm, I couldn’t read that one.' : 'Hmm, I got stuck explaining that.'}</SpeechBubble>
        <Mochi size={150} />
        <h1 className="visually-hidden">{extracting ? 'The label couldn’t be read' : 'The label couldn’t be explained'}</h1>
        <Notice tone="danger" title="What happened">
          {job.error.message}
        </Notice>
        <div className="working-actions">
          {!notConfigured && job.error.code !== 'rate_limited' && (
            <button className="btn-primary" onClick={onRetry}>
              Try again
            </button>
          )}
          <button className="btn-soft" onClick={onBack}>
            {extracting ? 'Back to the camera' : 'Back to the text'}
          </button>
          {extracting && (
            <button className="text-btn" onClick={onTyped}>
              Type the text instead
            </button>
          )}
        </div>
      </div>
    );
  }

  const index = Math.max(0, stages.findIndex((s) => s.id === job.stage));
  return (
    <div className="working">
      <div className="working-halo">
        <Mochi size={170} mood="search" />
      </div>
      <h1 className="visually-hidden">{extracting ? 'Reading your label' : 'Explaining your label'}</h1>
      <SpeechBubble>{stages[index].line}</SpeechBubble>
      <div className="segments" role="progressbar" aria-valuemin={1} aria-valuemax={stages.length} aria-valuenow={index + 1}>
        {stages.map((s, i) => (
          <span key={s.id} className={i < index ? 'done' : i === index ? 'active' : ''} />
        ))}
      </div>
      <p className="muted small" aria-live="polite">
        {slow
          ? 'Still working. Busy AI servers and big labels can take up to a minute, or you can cancel and try again.'
          : 'Mochi is on it. This only takes a moment.'}
      </p>
      <p className="meta-line">{seconds}s</p>
      <button className="text-btn" onClick={onBack}>
        Cancel
      </button>
    </div>
  );
}

/** Seconds since this job (extract or analyze) started; resets for a new job. */
function useSeconds(key: string | null): number {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    setSeconds(0);
    if (!key) return;
    const started = Date.now();
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [key]);
  return seconds;
}
