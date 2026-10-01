/**
 * Things that weigh about as much as a workout's volume, for a light moment after
 * finishing. Weights in kg are rough real-world figures.
 */
export interface FunThing {
  kg: number;
  emoji: string;
  en: [one: string, many: string];
  he: [one: string, many: string];
}

export const FUN_THINGS: FunThing[] = [
  { kg: 7, emoji: "🎳", en: ["a bowling ball", "bowling balls"], he: ["כדור באולינג", "כדורי באולינג"] },
  { kg: 8, emoji: "🍉", en: ["a big watermelon", "big watermelons"], he: ["אבטיח גדול", "אבטיחים גדולים"] },
  { kg: 30, emoji: "🐕", en: ["a golden retriever", "golden retrievers"], he: ["גולדן רטריבר", "גולדן רטריברים"] },
  { kg: 85, emoji: "🦘", en: ["a red kangaroo", "red kangaroos"], he: ["קנגורו אדום", "קנגורו אדומים"] },
  { kg: 100, emoji: "🐼", en: ["a giant panda", "giant pandas"], he: ["פנדה ענקית", "פנדות ענקיות"] },
  { kg: 110, emoji: "🛵", en: ["a Vespa", "Vespas"], he: ["וספה", "וספות"] },
  { kg: 160, emoji: "🦍", en: ["a silverback gorilla", "silverback gorillas"], he: ["גורילה בוגרת", "גורילות בוגרות"] },
  { kg: 180, emoji: "🤼", en: ["a sumo wrestler", "sumo wrestlers"], he: ["מתאבק סומו", "מתאבקי סומו"] },
  { kg: 250, emoji: "🎹", en: ["an upright piano", "upright pianos"], he: ["פסנתר", "פסנתרים"] },
  { kg: 300, emoji: "🐻", en: ["a grizzly bear", "grizzly bears"], he: ["דוב גריזלי", "דובי גריזלי"] },
  { kg: 340, emoji: "🏍️", en: ["a Harley-Davidson", "Harley-Davidsons"], he: ["אופנוע הארלי", "אופנועי הארלי"] },
  { kg: 450, emoji: "🐻‍❄️", en: ["a polar bear", "polar bears"], he: ["דוב קוטב", "דובי קוטב"] },
  { kg: 480, emoji: "🎹", en: ["a concert grand piano", "concert grand pianos"], he: ["פסנתר כנף", "פסנתרי כנף"] },
  { kg: 500, emoji: "🐪", en: ["a camel", "camels"], he: ["גמל", "גמלים"] },
  { kg: 650, emoji: "🐄", en: ["a dairy cow", "dairy cows"], he: ["פרה", "פרות"] },
  { kg: 930, emoji: "🚗", en: ["a Fiat 500", "Fiat 500s"], he: ["פיאט 500", "מכוניות פיאט 500"] },
  { kg: 1100, emoji: "🦈", en: ["a great white shark", "great white sharks"], he: ["כריש לבן גדול", "כרישים לבנים גדולים"] },
  { kg: 1200, emoji: "🦒", en: ["a giraffe", "giraffes"], he: ["ג׳ירפה", "ג׳ירפות"] },
  { kg: 1300, emoji: "🚙", en: ["a Toyota Corolla", "Toyota Corollas"], he: ["טויוטה קורולה", "טויוטות קורולה"] },
  { kg: 1500, emoji: "🦛", en: ["a hippo", "hippos"], he: ["היפופוטם", "היפופוטמים"] },
  { kg: 2300, emoji: "🦏", en: ["a white rhino", "white rhinos"], he: ["קרנף לבן", "קרנפים לבנים"] },
  { kg: 2500, emoji: "🧱", en: ["a stone block of the Great Pyramid", "stone blocks of the Great Pyramid"], he: ["אבן מהפירמידה הגדולה", "אבנים מהפירמידה הגדולה"] },
  { kg: 4500, emoji: "🐋", en: ["an orca", "orcas"], he: ["לוויתן קטלן", "לוויתנים קטלנים"] },
  { kg: 6000, emoji: "🐘", en: ["an African elephant", "African elephants"], he: ["פיל אפריקאי", "פילים אפריקאים"] },
  { kg: 8000, emoji: "🦖", en: ["a T. rex", "T. rexes"], he: ["טירנוזאורוס רקס", "טירנוזאורוסים"] },
  { kg: 12000, emoji: "🚌", en: ["a city bus", "city buses"], he: ["אוטובוס עירוני", "אוטובוסים עירוניים"] },
  { kg: 12500, emoji: "🗿", en: ["an Easter Island statue", "Easter Island statues"], he: ["פסל מואי מאי הפסחא", "פסלי מואי מאי הפסחא"] },
  { kg: 41000, emoji: "✈️", en: ["an empty Boeing 737", "empty Boeing 737s"], he: ["בואינג 737 ריק", "מטוסי בואינג 737 ריקים"] },
];

/** Picks a thing the volume is close to a whole number of (1 to 3 when possible), varied by `seed`. */
export function funMatch(volumeKg: number, seed: string): { thing: FunThing; count: number } | null {
  if (volumeKg < 6) return null;
  const fits = FUN_THINGS.map((thing) => {
    const ratio = volumeKg / thing.kg;
    const count = Math.max(1, Math.round(ratio));
    return { thing, count, off: Math.abs(ratio - count) / ratio };
  }).filter((x) => x.off < 0.15);
  const few = fits.filter((x) => x.count <= 3);
  const pool = few.length ? few : fits.filter((x) => x.count <= 6);
  if (!pool.length) return null;
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0;
  return pool[Math.abs(h) % pool.length];
}
