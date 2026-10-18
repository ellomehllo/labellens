import type { LabelSection, SectionKind } from '../../shared/types.ts';

// A made-up label for trying the app. It is always labelled as an example in the UI, and the
// analysis it produces is a real run of the analysis step on this text, not a stored response.

const section = (kind: SectionKind, text: string): LabelSection => ({
  id: crypto.randomUUID(),
  kind,
  text,
  confidence: null,
  uncertain: [],
  edited: false,
});

export function exampleSections(): LabelSection[] {
  return [
    section('product_name', 'Oat drink'),
    section('ingredients', 'Ingredients: water, oats 10%, sunflower oil, sea salt.'),
    section('directions', 'Shake well before use.'),
    section('storage', 'Keep refrigerated after opening and use within 5 days.'),
  ];
}

export function blankSections(): LabelSection[] {
  return [section('ingredients', ''), section('allergens', ''), section('directions', ''), section('warnings', '')];
}
