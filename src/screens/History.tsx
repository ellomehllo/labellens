import { useState } from 'react';
import { CATEGORY_LABELS } from '../../shared/types.ts';
import { Icon } from '../components/Icon.tsx';
import { Mochi } from '../components/Mochi.tsx';
import { CATEGORY_ICONS, TopBar, timeAgo } from '../components/ui.tsx';
import { deleteScan, listScans } from '../lib/history.ts';
import { useSettings } from '../lib/settings.ts';

export function HistoryScreen({ onBack, onScan }: { onBack: () => void; onScan: () => void }) {
  const [scans, setScans] = useState(listScans);
  const { saveHistory } = useSettings();

  return (
    <>
      <TopBar title="History" onBack={onBack} />
      {scans.length === 0 ? (
        <div className="empty">
          <Mochi size={150} mood="sleep" />
          <h2>Nothing here yet</h2>
          <p className="muted">
            {saveHistory ? 'Mochi is napping until your first scan.' : 'Scan history is off in Settings.'}
          </p>
          <button className="btn-primary compact" onClick={onScan}>
            <Icon name="camera" size={18} />
            Scan a label
          </button>
        </div>
      ) : (
        <div className="screen">
          <div>
            <h2 className="big-title">Your scans</h2>
            <p className="muted small">Saved on this device for this session.</p>
          </div>
          <ul className="scan-list">
            {scans.map((scan) => {
              const p = scan.analysis.product;
              const tag = scan.analysis.meta.input === 'example' ? ' · Sample' : scan.analysis.meta.input === 'typed' ? ' · Typed' : '';
              return (
                <li key={scan.id} className="card scan-item">
                  <a href={`#/history/${scan.id}`}>
                    <span className="icon-tile">
                      <Icon name={CATEGORY_ICONS[p.category]} size={20} />
                    </span>
                    <span className="scan-text">
                      <strong>{p.name ?? `${CATEGORY_LABELS[p.category]} label`}</strong>
                      <span className="scan-meta">
                        {CATEGORY_LABELS[p.category]} · {timeAgo(scan.savedAt)}
                        {tag}
                      </span>
                    </span>
                  </a>
                  <button
                    className="icon-btn"
                    aria-label={`Delete ${p.name ?? 'this scan'}`}
                    onClick={() => {
                      deleteScan(scan.id);
                      setScans(listScans());
                    }}
                  >
                    <Icon name="trash" size={18} />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
}
