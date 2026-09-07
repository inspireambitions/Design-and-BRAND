const textFields = new Set(['title', 'titleAr', 'excerpt', 'excerptAr', 'metaDescription', 'text', 'name', 'headline', 'description']);

export function practiceSpelling(value: string): string {
  return value.replace(/\bpractis(?:e|es|ed|ing)\b/gi, (word) => {
    const corrected = word.toLowerCase().replace('practis', 'practic');
    return word === word.toUpperCase() ? corrected.toUpperCase()
      : word[0] === word[0].toUpperCase() ? corrected[0].toUpperCase() + corrected.slice(1) : corrected;
  });
}

/** Format public prose only. Keep CMS identifiers, URLs and portable-text marks intact. */
export function guideSpelling<T>(value: T): T {
  if (Array.isArray(value)) return value.map(guideSpelling) as T;
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => {
    if (textFields.has(key) && typeof item === 'string') return [key, practiceSpelling(item)];
    if (['jsonLdRaw', 'faqJsonLdRaw'].includes(key) && typeof item === 'string' && item) {
      try { return [key, JSON.stringify(guideSpelling(JSON.parse(item)))]; }
      catch { return [key, item]; }
    }
    return [key, guideSpelling(item)];
  })) as T;
}
