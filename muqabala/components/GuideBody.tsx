'use client';

import { PortableText, type PortableTextBlock, type PortableTextComponents } from '@portabletext/react';

const components: PortableTextComponents = {
  block: {
    h2: ({ children }) => <h2>{children}</h2>,
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

export function GuideBody({ value }: { value: unknown[] }) {
  if (!value.length) return null;
  return (
    <div className="guide-body">
      <PortableText value={value as PortableTextBlock[]} components={components} />
    </div>
  );
}
