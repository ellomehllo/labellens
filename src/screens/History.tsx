import { useState } from 'react';
import { CATEGORY_LABELS } from '../../shared/types.ts';
import { Icon } from '../components/Icon.tsx';
import { formatDate, Notice, PageTitle } from '../components/ui.tsx';
import { deleteAllScans, deleteScan, getSettings, listScans, saveSettings } from '../lib/history.ts';

export function HistoryScreen() {
  const [scans, setScans] = useState(listScans);
  const [settings, setSettings] = useState(getSettings);

  return (
    <div className="stack">
      <PageTitle>History</PageTitle>
      <p className="muted">
        Saved results stay in this browser on this device. They aren’t uploaded anywhere, and photos are never saved.
      </p>

      <div className="panel">
        <label className="switch">
          <input
            type="checkbox"
            checked={settings.autoSave}
            onChange={(e) => {
              const next = { ...settings, autoSave: e.target.checked };
              setSettings(next);
              saveSettings(next);
            }}
          />
          Save new results automatically
        </label>
        <p className="muted small">
          Off by default. When off, you can still save a single result from its results page.
        </p>
      </div>

      {scans.length === 0 ? (
        <Notice tone="plain" icon="history" title="Nothing saved">
          Results you save will appear here. <a href="#/">Scan a label</a>
        </Notice>
      ) : (
        <>
          <ul className="history-list">
            {scans.map((scan) => {
              const p = scan.analysis.product;
              return (
                <li key={scan.id}>
                  <div className="history-item">
                    <a href={`#/history/${scan.id}`}>
                      <strong>{p.name ?? `${CATEGORY_LABELS[p.category]} label`}</strong>
                      <span className="muted small">
                        {CATEGORY_LABELS[p.category]} · {formatDate(scan.savedAt, true)}
                        {scan.analysis.meta.input === 'example' ? ' · example' : ''}
                      </span>
                    </a>
                    <button
                      className="btn btn-ghost btn-small"
                      aria-label={`Delete ${p.name ?? 'this result'}`}
                      onClick={() => {
                        deleteScan(scan.id);
                        setScans(listScans());
                      }}
                    >
                      <Icon name="trash" size={18} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <div>
            <button
              className="btn btn-danger"
              onClick={() => {
                if (confirm(`Delete all ${scans.length} saved results from this device? This can’t be undone.`)) {
                  deleteAllScans();
                  setScans([]);
                }
              }}
            >
              <Icon name="trash" />
              Delete all saved results
            </button>
          </div>
        </>
      )}
    </div>
  );
}
