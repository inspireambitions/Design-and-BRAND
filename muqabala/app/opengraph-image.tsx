import { ImageResponse } from 'next/og';

export const alt = 'Muqabala interview practice for Gulf jobs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 78px',
          background: '#F2F5F2',
          color: '#16241F',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, fontSize: 34, fontWeight: 800 }}>
          <div
            style={{
              width: 54,
              height: 54,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 14,
              background: '#0B7A6B',
              color: '#FFFFFF',
              fontSize: 28,
            }}
          >
            م
          </div>
          Muqabala
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div style={{ maxWidth: 920, fontSize: 78, lineHeight: 1.02, letterSpacing: '-3px', fontWeight: 800 }}>
            Practise stronger interview answers.
          </div>
          <div style={{ maxWidth: 900, fontSize: 30, lineHeight: 1.35, color: '#536860' }}>
            Private Gulf interview practice with clear feedback in English or Arabic.
          </div>
        </div>
        <div style={{ display: 'flex', color: '#07564B', fontSize: 24, fontWeight: 700 }}>
          Proof, not performance.
        </div>
      </div>
    ),
    size,
  );
}
