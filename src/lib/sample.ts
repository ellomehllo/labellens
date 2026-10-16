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
    section('product_name', 'Honey Almond Oat Clusters (example product)'),
    section(
      'ingredients',
      'Whole grain oats, sugar, almonds, honey, sunflower oil, wheat flour, skim milk powder, salt, natural flavor, mixed tocopherols (to preserve freshness).',
    ),
    section('allergens', 'Contains: wheat, milk, almonds. May contain peanuts and other tree nuts.'),
    section(
      'nutrition',
      'Serving size 1/2 cup (40 g). Calories 180. Total fat 6 g (8% DV). Sodium 95 mg (4% DV). Total carbohydrate 28 g (10% DV). Total sugars 11 g, includes 9 g added sugars (18% DV). Protein 4 g.',
    ),
    section('storage', 'Store in a cool, dry place. Reseal after opening.'),
    section('dates', 'Best if used by 12 MAR 2027'),
    section('claims', 'Made with whole grains. Good source of fiber. All natural.'),
  ];
}

export function blankSections(): LabelSection[] {
  return [section('ingredients', ''), section('allergens', ''), section('directions', ''), section('warnings', '')];
}
