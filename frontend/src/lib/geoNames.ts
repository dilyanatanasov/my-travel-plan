/*
  Geographic name matching, shared by the daily puzzle's guess box, the
  map search, and the country selector.

  Two vocabularies name the same places: the atlas abbreviates ("N. Mariana
  Is.", "St. Vin. and Gren.") while the countries table spells things out
  ("Northern Mariana Islands") - and people type either, plus their own
  spellings (Faroe/Faeroe, Macau/Macao). Every word, on both sides, expands
  through the same table before matching, so any spoken form finds any
  stored form. The expansion list is exactly the abbreviations that occur
  in the vendored 50m atlas - do not add speculative entries.
*/
const GEO_EXPANSIONS: Record<string, string> = {
  'is.': 'islands',
  'i.': 'island',
  'n.': 'northern north',
  's.': 'southern south',
  'w.': 'western west',
  'e.': 'eastern east',
  'dem.': 'democratic',
  'rep.': 'republic',
  'fr.': 'french',
  'eq.': 'equatorial',
  'st.': 'saint',
  'vin.': 'vincent',
  'gren.': 'the grenadines',
  'herz.': 'herzegovina',
  'geo.': 'georgia',
  'ter.': 'territory territories',
  'terr.': 'territory territories',
  'u.s.': 'united states us',
  'br.': 'british',
  'cent.': 'central',
  'afr.': 'african',
  // Spelling variants, not abbreviations - the atlas writes Faeroe and
  // Macao; most people type Faroe and Macau.
  faeroe: 'faroe',
  faroe: 'faeroe',
  macao: 'macau',
  macau: 'macao',
};

const stripDiacritics = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * A word plus everything it might stand for. "St-Martin" style hyphenated
 * saints expand too - the atlas writes those with a hyphen.
 */
function wordForms(word: string): string[] {
  const forms = [word];
  const expansion = GEO_EXPANSIONS[word];
  if (expansion) forms.push(...expansion.split(' '));
  if (word.startsWith('st-')) forms.push('saint', word.slice(3));
  return forms;
}

/** The searchable text for a place name: itself + expansions, plain. */
export function geoSearchText(name: string): string {
  const lower = name.toLowerCase();
  const expanded = lower
    .split(' ')
    .flatMap((word) => wordForms(word))
    .join(' ');
  return stripDiacritics(`${lower} ${expanded}`);
}

/**
 * Every query word must appear somewhere in the searchable text - under
 * any of its own expansions, so "n. mariana is." finds "Northern Mariana
 * Islands" just as "northern mariana" finds "N. Mariana Is.".
 */
export function matchesGeoName(name: string, query: string): boolean {
  const words = stripDiacritics(query.toLowerCase())
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return false;
  const text = geoSearchText(name);
  return words.every((word) =>
    wordForms(word).some((form) => text.includes(form)),
  );
}
