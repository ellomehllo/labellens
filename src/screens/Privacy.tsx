import { PageTitle } from '../components/ui.tsx';

export function Privacy() {
  return (
    <div className="prose">
      <PageTitle>Privacy and data</PageTitle>
      <p className="lead">The short version: photos are used once to read the text, then discarded. Results stay on your device only if you save them.</p>

      <h2>When you scan a label</h2>
      <ul>
        <li>Your browser shrinks the photos and sends them to the LabelLens server.</li>
        <li>
          The server forwards them to Anthropic’s AI service (Claude) to read the text. LabelLens holds the photos in memory
          for that one request and doesn’t write them to disk or a database.
        </li>
        <li>Anthropic processes the request under its own commercial data policies.</li>
        <li>Avoid photographing anything personal, such as prescription labels with your name or address.</li>
      </ul>

      <h2>When you ask for an explanation</h2>
      <ul>
        <li>Only the label text you checked on the review screen is sent, not the photos.</li>
        <li>The server matches statements against a fixed list of curated sources. It doesn’t browse the web.</li>
      </ul>

      <h2>What is stored</h2>
      <ul>
        <li>
          <strong>On your device:</strong> results you choose to save (text only) in this browser’s local storage. Delete
          them any time from <a href="#/history">History</a>, or by clearing this site’s data.
        </li>
        <li>
          <strong>On the server:</strong> if you use “Report a problem”, the reason, product type and finding title are
          saved for quality review. No photos, label text or identifiers are included.
        </li>
        <li>No accounts, no advertising, no tracking cookies.</li>
      </ul>

      <h2>Limits</h2>
      <p>
        LabelLens is an informational prototype. It is not a certified product-safety or regulatory compliance tool, and it
        doesn’t replace the product label, a doctor, pharmacist, poison service or regulator.
      </p>
    </div>
  );
}
