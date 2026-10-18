import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon.tsx';
import { Mochi, SpeechBubble } from '../components/Mochi.tsx';
import { Chip } from '../components/ui.tsx';

const LINES = ['Hi! I’m Mochi.', 'I read the tiny print so you don’t have to squint.', 'Boop me anytime for tips!'];

/** First-visit introduction. "Say hi again" in Settings replays it. */
export function Intro({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const last = step === LINES.length - 1;

  // Advance on its own, unless the visitor prefers less motion; tapping Mochi always advances.
  useEffect(() => {
    if (last || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = setTimeout(() => setStep((s) => s + 1), 3200);
    return () => clearTimeout(timer);
  }, [step, last]);

  return (
    <div className="intro">
      <div className="intro-head">
        <span className="wordmark">LabelLens</span>
        <button className="text-btn" onClick={onDone}>
          Skip
        </button>
      </div>

      <div className="intro-stage">
        <div className="intro-bubble-slot">
          <SpeechBubble key={step}>{LINES[step]}</SpeechBubble>
        </div>
        <div className="intro-art">
          <div className="intro-art-bg" />
          <Chip kind="diet">Plant-based</Chip>
          <Chip kind="count">4 ingredients</Chip>
          <Chip kind="storage">Keep cold</Chip>
          <button
            className="intro-mochi"
            onClick={() => setStep((s) => (s + 1) % LINES.length)}
            aria-label="Boop Mochi for the next message"
          >
            <Mochi size={188} mood={last ? 'happy' : 'neutral'} decor={last} />
          </button>
        </div>
      </div>

      <div className="intro-copy">
        <h2>
          Labels,
          <br />
          <span>made simple.</span>
        </h2>
        <p>Snap any label. Mochi reads the tiny print and tells you what matters.</p>
      </div>

      <div className="intro-actions">
        <button className="btn-primary" onClick={onDone}>
          Let’s scan a label
          <Icon name="camera" />
        </button>
        <p className="fineprint">
          <Icon name="lock" size={13} />
          Private by default · For information only
        </p>
      </div>
    </div>
  );
}
