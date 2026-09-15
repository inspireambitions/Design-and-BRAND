'use client';

import { PortableText, type PortableTextBlock, type PortableTextComponents } from '@portabletext/react';
import { useLang } from './LanguageProvider';

function headingId(value: PortableTextBlock) {
  return `guide-${String(value._key || 'section').replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

function headingText(value: PortableTextBlock) {
  return (value.children ?? []).map((child) => 'text' in child ? child.text : '').join('').trim();
}

export function GuideBody({ value }: { value: unknown[] }) {
  const { t } = useLang();
  if (!value.length) return null;
  const blocks = value as PortableTextBlock[];
  const headings = blocks.filter((block) => block.style === 'h2' && headingText(block));
  const components: PortableTextComponents = {
    block: {
      h2: ({ children, value: block }) => <h2 id={headingId(block)}>{children}</h2>,
      h3: ({ children }) => <h3>{children}</h3>,
      normal: ({ children }) => <p>{children}</p>,
    },
    list: {
      bullet: ({ children }) => <ul>{children}</ul>,
      number: ({ children }) => <ol>{children}</ol>,
    },
    listItem: {
      bullet: ({ children }) => <li>{children}</li>,
      number: ({ children }) => <li>{children}</li>,
    },
  };
  return (
    <div className="guide-body">
      {headings.length > 1 && (
        <details className="guide-outline">
          <summary>{t('guideContents')}</summary>
          <ul>
            {headings.map((heading) => <li key={heading._key}><a href={`#${headingId(heading)}`}>{headingText(heading)}</a></li>)}
          </ul>
        </details>
      )}
      <PortableText value={blocks} components={components} />
    </div>
  );
}
