import { ImageResponse } from 'next/og';

export const alt = 'Muqabala free private Gulf interview practice with feedback after every answer';
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
          padding: '48px 64px 42px',
          background: '#073F37',
          color: '#F7F1E8',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 28, fontWeight: 800 }}>
          <div
            style={{
              width: 44,
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1.5px solid #C99A38',
              borderRadius: 11,
              color: '#F7F1E8',
              fontSize: 24,
            }}
          >
            م
          </div>
          Muqabala
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 13, marginTop: 22 }}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              fontFamily: 'Georgia, serif',
              fontSize: 68,
              lineHeight: 0.98,
              letterSpacing: '-2.2px',
              fontWeight: 700,
            }}
          >
            <div>Your interview answer.</div>
            <div>Made stronger.</div>
          </div>
          <div style={{ fontSize: 25, lineHeight: 1.25, color: '#D7E2DC' }}>
            Practise 8 Gulf job questions. Get feedback after every answer.
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            minHeight: 164,
            marginTop: 24,
            overflow: 'hidden',
            borderRadius: 18,
            background: '#F7F1E8',
            color: '#17352F',
          }}
        >
          <div
            style={{
              width: '50%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: 12,
              padding: '25px 34px',
              borderRight: '2px solid #C99A38',
            }}
          >
            <div style={{ fontSize: 14, letterSpacing: '2.6px', fontWeight: 800, color: '#6F766F' }}>
              YOUR ANSWER
            </div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 31, lineHeight: 1.15, fontWeight: 700 }}>
              “I spoke to my manager.”
            </div>
          </div>
          <div
            style={{
              width: '50%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: 12,
              padding: '25px 34px',
            }}
          >
            <div style={{ fontSize: 14, letterSpacing: '2.6px', fontWeight: 800, color: '#947026' }}>
              MUQABALA FEEDBACK
            </div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 31, lineHeight: 1.15, fontWeight: 700 }}>
              Say what you did first.
            </div>
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 24,
            color: '#D7E2DC',
            fontSize: 16,
            fontWeight: 800,
            letterSpacing: '1.8px',
          }}
        >
          <div>FREE · PRIVATE · SPEAK OR TYPE</div>
          <div style={{ color: '#F7F1E8', letterSpacing: '0.2px', fontSize: 18 }}>trymuqabala.com</div>
        </div>
      </div>
    ),
    size,
  );
}
