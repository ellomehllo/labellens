/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "true" for the GitHub Pages build, which runs the pipeline in the browser. */
  readonly VITE_STATIC?: string;
  /** Where "Report a problem" opens a draft issue in the static build. */
  readonly VITE_FEEDBACK_URL?: string;
}
