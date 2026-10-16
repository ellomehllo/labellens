import type { Job } from '../App.tsx';
import { Icon } from '../components/Icon.tsx';
import { Notice, PageTitle, Progress, type Stage } from '../components/ui.tsx';

const EXTRACT_STAGES: Stage[] = [
  { id: 'uploading', label: 'Sending photos to the server' },
  { id: 'reading_text', label: 'Reading the text on the label' },
  { id: 'organising_text', label: 'Sorting it into ingredients, directions, warnings…' },
];

const ANALYZE_STAGES: Stage[] = [
  { id: 'sending', label: 'Sending the checked text' },
  { id: 'interpreting', label: 'Explaining the label in plain language' },
  { id: 'checking_sources', label: 'Matching statements to curated sources' },
  { id: 'checking_wording', label: 'Checking for unsupported safety claims' },
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

  if (job.error) {
    const notConfigured = job.error.code === 'ai_not_configured' || job.error.code === 'ai_auth';
    return (
      <div className="stack">
        <PageTitle eyebrow={extracting ? 'Step 1 of 3' : 'Step 3 of 3'}>
          {extracting ? 'The label couldn’t be read' : 'The label couldn’t be explained'}
        </PageTitle>
        <Notice tone="danger" title="What happened">
          {job.error.message}
        </Notice>
        {extracting && !notConfigured && (
          <p className="muted">
            Nothing was saved. Your photos are still here if you want to try again or retake them.
          </p>
        )}
        <div className="row">
          {!notConfigured && job.error.code !== 'rate_limited' && (
            <button className="btn btn-primary" onClick={onRetry}>
              Try again
            </button>
          )}
          <button className="btn" onClick={onBack}>
            <Icon name="back" />
            {extracting ? 'Back to photos' : 'Back to the text'}
          </button>
          {extracting && (
            <button className="btn btn-ghost" onClick={onTyped}>
              Type the text instead
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      <PageTitle eyebrow={extracting ? 'Step 1 of 3' : 'Step 3 of 3'}>
        {extracting ? 'Reading your label' : 'Explaining your label'}
      </PageTitle>
      <p className="muted">
        {extracting
          ? 'This usually takes 10–30 seconds. Only the visible text is transcribed; nothing is filled in.'
          : 'This usually takes 20–60 seconds.'}
      </p>
      <div className="panel">
        <Progress stages={stages} current={job.stage} />
      </div>
      <div>
        <button className="btn btn-ghost" onClick={onBack}>
          Cancel
        </button>
      </div>
    </div>
  );
}
