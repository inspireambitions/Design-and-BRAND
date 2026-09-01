/**
 * Query parameters a practice page accepts. Read in the browser so the page
 * itself can be prerendered at build time; the server never sees them.
 */

const MAX_FOCUS_LENGTH = 160;

export type PracticeSearchParams = {
  focusQuestionId?: string;
  initialLanguage?: 'en' | 'ar';
  /** From seven-day plan links: open straight into the candidate's chosen way of answering. */
  initialMode?: 'type' | 'speak' | 'video';
};

/** A parameter given more than once is ambiguous and is ignored, as the server used to do. */
function single(params: Pick<URLSearchParams, 'getAll'> | null, name: string): string | undefined {
  const values = params?.getAll(name) ?? [];
  return values.length === 1 ? values[0] : undefined;
}

export function readPracticeSearchParams(params: Pick<URLSearchParams, 'getAll'> | null): PracticeSearchParams {
  const focus = single(params, 'focus');
  const lang = single(params, 'lang');
  const mode = single(params, 'mode');
  return {
    focusQuestionId: focus !== undefined && focus.length > 0 && focus.length <= MAX_FOCUS_LENGTH ? focus : undefined,
    initialLanguage: lang === 'ar' || lang === 'en' ? lang : undefined,
    initialMode: mode === 'type' || mode === 'speak' || mode === 'video' ? mode : undefined,
  };
}
