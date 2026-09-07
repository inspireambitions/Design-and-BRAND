'use client';

import { useEffect, useRef, type KeyboardEvent } from 'react';
import { Keyboard } from '@phosphor-icons/react/dist/icons/Keyboard';
import { Microphone } from '@phosphor-icons/react/dist/icons/Microphone';
import { VideoCamera } from '@phosphor-icons/react/dist/icons/VideoCamera';
import { ANSWER_MODES, type AnswerMode, type AnswerModeAvailability } from '@/lib/flow/answer-mode';
import { useLang } from '../LanguageProvider';

const CARDS = {
  type: { Icon: Keyboard, title: 'modeTypeTitle', body: 'modeTypeBody' },
  speak: { Icon: Microphone, title: 'modeSpeakTitle', body: 'modeSpeakBody' },
  video: { Icon: VideoCamera, title: 'modeVideoTitle', body: 'modeVideoBody' },
} as const;

/**
 * Three equal cards: Type, Speak, Video. The highlighted card is the selected
 * choice. On setup, a separate Start practice button confirms it. Arrow keys
 * move between the cards.
 */
export function AnswerModeSelector({
  highlighted,
  availability,
  onChoose,
  focusHighlighted = false,
  disabled = false,
  compact = false,
}: {
  highlighted: AnswerMode;
  availability: AnswerModeAvailability;
  onChoose: (mode: AnswerMode) => void;
  /** Focus the highlighted card when the selector appears (desktop only). */
  focusHighlighted?: boolean;
  disabled?: boolean;
  /** Smaller cards for the "Change mode" panel on later questions. */
  compact?: boolean;
}) {
  const { t } = useLang();
  const groupRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!focusHighlighted) return;
    const card = groupRef.current?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]');
    card?.focus({ preventScroll: true });
  }, [focusHighlighted, highlighted]);

  const available = (mode: AnswerMode) =>
    mode === 'type' || (mode === 'speak' ? availability.speak : availability.video);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft' && event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
      return;
    }
    const cards = Array.from(groupRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? []);
    const current = cards.indexOf(document.activeElement as HTMLButtonElement);
    if (current < 0) return;
    event.preventDefault();
    const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
    const next = cards[(current + (forward ? 1 : cards.length - 1)) % cards.length];
    next?.focus();
  };

  return (
    <div
      ref={groupRef}
      className={`mode-cards${compact ? ' mode-cards-compact' : ''}`}
      role="group"
      aria-label={t('chooseHowToAnswer')}
      onKeyDown={onKeyDown}
    >
      {ANSWER_MODES.map((mode) => {
        const { Icon, title, body } = CARDS[mode];
        const usable = available(mode);
        const idPrefix = `answer-mode-${compact ? 'change' : 'setup'}-${mode}`;
        return (
          <button
            key={mode}
            type="button"
            className={`mode-card answer-mode-card${highlighted === mode ? ' on' : ''}`}
            aria-pressed={highlighted === mode}
            aria-disabled={!usable || undefined}
            aria-labelledby={`${idPrefix}-title ${idPrefix}-body`}
            disabled={disabled}
            onClick={() => {
              if (usable) onChoose(mode);
            }}
          >
            <Icon className="mode-card-icon" size={compact ? 22 : 28} weight="duotone" aria-hidden="true" />
            <span id={`${idPrefix}-title`} className="mode-title">{t(title)}</span>
            <span id={`${idPrefix}-body`} className="tiny">
              {usable ? t(body) : mode === 'video' ? t('modeVideoUnavailable') : t('modeUnavailable')}
            </span>
          </button>
        );
      })}
    </div>
  );
}
