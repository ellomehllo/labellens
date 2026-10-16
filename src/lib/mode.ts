/**
 * True in the GitHub Pages build: there is no LabelLens server, so the label pipeline runs in the
 * browser and calls the AI provider directly with a key unlocked by the site password.
 */
export const STATIC_SITE = import.meta.env.VITE_STATIC === 'true';

export const FEEDBACK_URL = import.meta.env.VITE_FEEDBACK_URL || null;
