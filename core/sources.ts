import type { Source } from '../shared/types.ts';

// Curated source registry. Every URL below was opened and read on `checked`, and each point
// paraphrases a statement that appears on that page. The model may only cite these points by id;
// it can never supply its own URL. Re-check pages and bump `checked` when reviewing this list.

const CHECKED = '2026-10-17';

export const SOURCES: Source[] = [
  {
    id: 'fda-food-allergies',
    title: 'Food Allergies',
    publisher: 'U.S. Food and Drug Administration',
    url: 'https://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/food-allergies',
    jurisdiction: 'United States',
    categories: ['food'],
    updated: '2026-03-11',
    checked: CHECKED,
    points: [
      {
        id: 'nine-major',
        text: 'US law (FALCPA, amended by the FASTER Act) names nine major food allergens: milk, eggs, fish, crustacean shellfish, tree nuts, peanuts, wheat, soybeans and sesame.',
      },
      {
        id: 'how-declared',
        text: 'Each major allergen must be declared on the label, either in parentheses after the ingredient name (for example "whey (milk)") or in a "Contains" statement.',
      },
      {
        id: 'species',
        text: 'The specific type of tree nut, fish species and crustacean shellfish species must be declared.',
      },
      {
        id: 'may-contain',
        text: 'Advisory statements such as "may contain" or "produced in a facility that also uses" are voluntary and not required by law; they must be truthful and not misleading.',
      },
      {
        id: 'sesame-2023',
        text: 'Sesame labeling requirements took effect on January 1, 2023; products already in interstate commerce before then did not have to be relabeled.',
      },
    ],
  },
  {
    id: 'fda-nutrition-facts',
    title: 'How to Understand and Use the Nutrition Facts Label',
    publisher: 'U.S. Food and Drug Administration',
    url: 'https://www.fda.gov/food/nutrition-facts-label/how-understand-and-use-nutrition-facts-label',
    jurisdiction: 'United States',
    categories: ['food'],
    updated: '2024-03-05',
    checked: CHECKED,
    points: [
      {
        id: 'serving-size',
        text: 'Serving size reflects the amount people typically eat or drink and is not a recommendation; all amounts on the label are per serving.',
      },
      {
        id: 'percent-dv',
        text: 'As a general guide, 5% Daily Value or less of a nutrient per serving is considered low and 20% or more is considered high.',
      },
      {
        id: 'added-sugars',
        text: 'Added sugars are sugars added during processing (or packaged as sweeteners, syrups, honey or concentrated juices); Total Sugars includes both added and naturally occurring sugars.',
      },
    ],
  },
  {
    id: 'eu-food-information',
    title: 'Food information to consumers – legislation',
    publisher: 'European Commission (Food Safety)',
    url: 'https://food.ec.europa.eu/food-safety/labelling-and-nutrition/food-information-consumers-legislation_en',
    jurisdiction: 'European Union',
    categories: ['food'],
    updated: null,
    checked: CHECKED,
    points: [
      {
        id: 'allergen-emphasis',
        text: 'Regulation (EU) No 1169/2011 requires allergens to be emphasised in the ingredient list, for example by font, style or background colour.',
      },
      {
        id: 'nutrition-mandatory',
        text: 'Nutrition information has been mandatory for the majority of prepacked processed foods since 13 December 2016.',
      },
      {
        id: 'non-prepacked',
        text: 'Allergen information is also mandatory for non-prepacked foods.',
      },
    ],
  },
  {
    id: 'fda-cosmetics-labeling-guide',
    title: 'Cosmetics Labeling Guide',
    publisher: 'U.S. Food and Drug Administration',
    url: 'https://www.fda.gov/cosmetics/cosmetics-labeling-regulations/cosmetics-labeling-guide',
    jurisdiction: 'United States',
    categories: ['cosmetics', 'oral_care'],
    updated: '2022-02-25',
    checked: CHECKED,
    points: [
      { id: 'descending-order', text: 'Cosmetic ingredients must be listed in descending order of predominance.' },
      {
        id: 'one-percent',
        text: 'Ingredients present at 1% or less may be listed in any order after the ingredients above 1%.',
      },
      {
        id: 'fragrance-flavor',
        text: 'Fragrance and flavor may be declared simply as "fragrance" and "flavor".',
      },
      { id: 'colors', text: 'Color additives of any concentration may be listed in any order.' },
      {
        id: 'drug-actives-first',
        text: 'When a cosmetic is also a drug, its active drug ingredient(s) must be declared before the cosmetic ingredients.',
      },
    ],
  },
  {
    id: 'fda-allergens-cosmetics',
    title: 'Allergens in Cosmetics',
    publisher: 'U.S. Food and Drug Administration',
    url: 'https://www.fda.gov/cosmetics/cosmetic-ingredients/allergens-cosmetics',
    jurisdiction: 'United States',
    categories: ['cosmetics', 'oral_care'],
    updated: '2026-10-09',
    checked: CHECKED,
    points: [
      {
        id: 'five-classes',
        text: 'Common cosmetic allergens fall into five classes: natural rubber, fragrances, preservatives, dyes and metals.',
      },
      {
        id: 'fragrance-unnamed',
        text: 'Individual fragrance allergens may not be identified on the cosmetic product label.',
      },
      {
        id: 'see-professional',
        text: 'People who suspect an allergic reaction should consult a healthcare professional; adverse events can be reported to the FDA.',
      },
      {
        id: 'anaphylaxis',
        text: 'Anaphylaxis from cosmetics is rare; if its symptoms appear, call emergency services (911 in the US) and seek medical attention immediately.',
      },
    ],
  },
  {
    id: 'fda-fragrances-cosmetics',
    title: 'Fragrances in Cosmetics',
    publisher: 'U.S. Food and Drug Administration',
    url: 'https://www.fda.gov/cosmetics/cosmetic-ingredients/fragrances-cosmetics',
    jurisdiction: 'United States',
    categories: ['cosmetics', 'oral_care', 'cleaner'],
    updated: '2022-02-28',
    checked: CHECKED,
    points: [
      {
        id: 'listed-as-fragrance',
        text: 'Under US regulations, fragrance and flavor ingredients can be listed simply as "Fragrance" or "Flavor", because fragrance formulas may be trade secrets.',
      },
      {
        id: 'unscented',
        text: 'Even some products labeled "unscented" may contain fragrance ingredients, for example to mask the odor of other ingredients.',
      },
    ],
  },
  {
    id: 'fda-hypoallergenic',
    title: '"Hypoallergenic" Cosmetics',
    publisher: 'U.S. Food and Drug Administration',
    url: 'https://www.fda.gov/cosmetics/cosmetics-labeling-claims/hypoallergenic-cosmetics',
    jurisdiction: 'United States',
    categories: ['cosmetics'],
    updated: '2022-02-25',
    checked: CHECKED,
    points: [
      {
        id: 'no-definition',
        text: 'There are no US federal standards or definitions that govern use of the term "hypoallergenic".',
      },
      {
        id: 'no-proof-required',
        text: 'Manufacturers do not have to submit proof of "hypoallergenic" claims to the FDA.',
      },
      {
        id: 'no-guarantee',
        text: 'FDA material on the page notes that no cosmetic can be guaranteed never to produce an allergic reaction.',
      },
    ],
  },
  {
    id: 'eu-cosing',
    title: 'Cosmetic ingredient database (CosIng)',
    publisher: 'European Commission',
    url: 'https://single-market-economy.ec.europa.eu/sectors/cosmetics/cosmetic-ingredient-database_en',
    jurisdiction: 'European Union',
    categories: ['cosmetics', 'oral_care'],
    updated: null,
    checked: CHECKED,
    points: [
      {
        id: 'inci-names',
        text: 'CosIng contains the common cosmetic ingredient names used for labelling, compiled by the European Commission.',
      },
      {
        id: 'no-legal-value',
        text: 'CosIng is informative only and has no legal value; only Regulation (EC) No 1223/2009 and its Annexes determine whether and how a substance may be used in cosmetics.',
      },
    ],
  },
  {
    id: 'cdc-toothpaste-children',
    title: 'Use of Toothpaste and Toothbrushing Patterns Among Children and Adolescents — United States, 2013–2016 (MMWR)',
    publisher: 'U.S. Centers for Disease Control and Prevention',
    url: 'https://www.cdc.gov/mmwr/volumes/68/wr/mm6804a3.htm',
    jurisdiction: 'United States',
    categories: ['oral_care'],
    updated: '2019-02-01',
    checked: CHECKED,
    points: [
      { id: 'under-3', text: 'Children under 3 should use a smear of toothpaste the size of a grain of rice.' },
      {
        id: 'three-to-six',
        text: 'Children aged 3 to 6 should use no more than a pea-sized amount (0.25 g) of toothpaste.',
      },
      {
        id: 'fluorosis',
        text: 'Swallowing too much fluoride while teeth are developing can cause visible changes in tooth enamel.',
      },
    ],
  },
  {
    id: 'ada-fluoride',
    title: 'Fluoride',
    publisher: 'American Dental Association (MouthHealthy)',
    url: 'https://www.mouthhealthy.org/all-topics-a-z/fluoride',
    jurisdiction: 'United States',
    categories: ['oral_care'],
    updated: null,
    checked: CHECKED,
    points: [
      { id: 'prevents-decay', text: 'Fluoride helps prevent tooth decay by making the surface of teeth stronger.' },
      {
        id: 'child-amounts',
        text: 'For children under 3, use toothpaste about the size of a grain of rice; for ages 3 to 6, a pea-sized amount.',
      },
      { id: 'ada-seal', text: 'The ADA lists products that have earned its Seal of Acceptance.' },
    ],
  },
  {
    id: 'hc-bleach-mixing',
    title: 'Reduce your risk from toxic gases: Never mix bleach with other cleaning products',
    publisher: 'Health Canada',
    url: 'https://recalls-rappels.canada.ca/en/alert-recall/reduce-your-risk-toxic-gases-never-mix-bleach-other-cleaning-products',
    jurisdiction: 'Canada',
    categories: ['cleaner'],
    updated: '2021-02-08',
    checked: CHECKED,
    points: [
      { id: 'never-mix', text: 'Never mix any cleaning product with household bleach.' },
      {
        id: 'ammonia-acids',
        text: 'Bleach reacts with cleaning products containing ammonia or an acid, including vinegar, and can release toxic gases such as chloramine.',
      },
      { id: 'ventilate', text: 'Ventilate your home properly during and after using cleaning products.' },
      { id: 'follow-label', text: 'Always read and follow the directions on product labels.' },
      {
        id: 'after-exposure',
        text: 'If someone may have been harmed, contact a poison centre or a health care provider right away and bring the original product container.',
      },
    ],
  },
  {
    id: 'fda-supplements-consumers',
    title: 'Information for Consumers on Using Dietary Supplements',
    publisher: 'U.S. Food and Drug Administration',
    url: 'https://www.fda.gov/food/dietary-supplements/information-consumers-using-dietary-supplements',
    jurisdiction: 'United States',
    categories: ['supplement'],
    updated: '2022-10-21',
    checked: CHECKED,
    points: [
      {
        id: 'not-preapproved',
        text: 'Under DSHEA, the FDA is not authorized to approve dietary supplements for safety and effectiveness before they are marketed.',
      },
      {
        id: 'ask-professional',
        text: 'Consumers are advised to talk to a doctor, pharmacist or other healthcare professional before buying or using a supplement.',
      },
    ],
  },
  {
    id: 'fda-supplements-medications',
    title: 'Mixing Medications and Dietary Supplements Can Endanger Your Health',
    publisher: 'U.S. Food and Drug Administration',
    url: 'https://www.fda.gov/consumers/consumer-updates/mixing-medications-and-dietary-supplements-can-endanger-your-health',
    jurisdiction: 'United States',
    categories: ['supplement'],
    updated: '2022-06-02',
    checked: CHECKED,
    points: [
      {
        id: 'changes-absorption',
        text: 'Certain dietary supplements can change the absorption, metabolism or excretion of a medication.',
      },
      {
        id: 'blood-thinning',
        text: 'Warfarin, ginkgo biloba, aspirin and vitamin E can each thin the blood; combining them may increase the risk of internal bleeding or stroke.',
      },
      {
        id: 'tell-professional',
        text: 'Talk with a health care professional before taking supplements, and keep a list of all supplements and medicines you take.',
      },
    ],
  },
  {
    id: 'who-poison-centres',
    title: 'Poison control and unintentional poisoning',
    publisher: 'World Health Organization',
    url: 'https://www.who.int/data/gho/data/themes/topics/indicator-groups/poison-control-and-unintentional-poisoning',
    jurisdiction: 'International',
    categories: ['food', 'cosmetics', 'oral_care', 'cleaner', 'supplement', 'other'],
    updated: null,
    checked: CHECKED,
    points: [
      {
        id: 'emergency-advice',
        text: 'Most poison centres provide emergency advice to the general public as well as to health professionals.',
      },
      { id: 'directory', text: 'WHO publishes a world directory of poison centres.' },
    ],
  },
];

const byId = new Map(SOURCES.map((s) => [s.id, s]));

export function findPoint(sourceId: string, pointId: string) {
  const source = byId.get(sourceId);
  const point = source?.points.find((p) => p.id === pointId);
  return source && point ? { source, point } : null;
}

/** Registry rendered for the model: ids, jurisdiction, dates and the exact points it may cite. */
export function sourcesForPrompt(): string {
  return SOURCES.map((s) => {
    const head = `[${s.id}] ${s.publisher} — "${s.title}" (jurisdiction: ${s.jurisdiction}; categories: ${s.categories.join(', ')}; page date: ${s.updated ?? 'not shown'})`;
    const points = s.points.map((p) => `  - ${p.id}: ${p.text}`).join('\n');
    return `${head}\n${points}`;
  }).join('\n\n');
}
