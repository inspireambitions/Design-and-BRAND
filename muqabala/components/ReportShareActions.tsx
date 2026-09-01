'use client';

import { useState } from 'react';
import { buildReportText, type ReportAnswer } from '@/lib/report-text';
import { useLang } from './LanguageProvider';

/**
 * Share, print and copy controls for the finished report. Loaded on demand
 * because they are only needed once an interview is complete.
 */
export function ReportShareActions({
  roleTitle,
  overall,
  answers,
  proof,
}: {
  roleTitle: string;
  overall: number | null;
  answers: ReportAnswer[];
  /** Live work sample for a hiring team: offers the WhatsApp send button. */
  proof: boolean;
}) {
  const { t } = useLang();
  const [reportCopied, setReportCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const reportText = () =>
    buildReportText(roleTitle, overall, answers, {
      report: t('reportTitle'),
      score: t('overallScore'),
      question: t('question'),
      yourAnswer: t('yourAnswer'),
      worked: t('whatWorked'),
      improve: t('whatToImprove'),
    });

  return (
    <>
      <div className="row no-print">
        {proof && (
          <a
            className="btn btn-primary"
            href={`https://wa.me/?text=${encodeURIComponent(reportText())}`}
            target="_blank"
            rel="noreferrer"
          >
            {t('proofSendWhatsApp')}
          </a>
        )}
        {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
          <button
            type="button"
            className="btn btn-quiet"
            onClick={() => {
              navigator.share({ text: reportText() }).catch(() => {});
            }}
          >
            {t('shareReport')}
          </button>
        )}
        <button
          type="button"
          className="btn btn-quiet"
          onClick={() => {
            // window.print is missing inside some in-app browsers; a
            // button that throws silently is worse than none.
            try {
              if (typeof window.print === 'function') window.print();
              else setCopyFailed(true);
            } catch {
              setCopyFailed(true);
            }
          }}
        >
          {t('saveReport')}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(reportText());
              setReportCopied(true);
            } catch {
              // Blocked clipboard (common in in-app browsers): show the
              // text to hold-and-copy instead of failing silently.
              setCopyFailed(true);
            }
          }}
        >
          {reportCopied ? t('rateCopied') : t('copyReport')}
        </button>
      </div>
      {copyFailed && (
        <div className="stack-sm no-print">
          <p className="notice notice-warn tiny" style={{ margin: 0 }}>
            {t('copyFallbackHint')}
          </p>
          <textarea
            className="answer-box"
            readOnly
            value={reportText()}
            onFocus={(event) => event.currentTarget.select()}
          />
        </div>
      )}
    </>
  );
}
