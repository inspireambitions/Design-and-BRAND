import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';
import { verifyFeedbackShareToken } from '@/lib/feedback-share';

export const runtime = 'nodejs';

function readiness(value: 'more' | 'same' | 'less') {
  if (value === 'more') return 'more ready';
  if (value === 'less') return 'less ready';
  return 'about the same';
}
function RatingStars({ rating, size }: { rating: number; size: number }) {
  return (
    <div style={{ display: 'flex', gap: Math.round(size * 0.2) }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <svg key={star} width={size} height={size} viewBox="0 0 24 24">
          <path
            d="M12 2.7 14.85 8.5l6.4.93-4.63 4.51 1.09 6.37L12 17.3l-5.71 3.01 1.09-6.37-4.63-4.51 6.4-.93L12 2.7Z"
            fill={star <= rating ? '#f2b84b' : '#315247'}
          />
        </svg>
      ))}
    </div>
  );
}

export async function GET(request: NextRequest) {
  const data = request.nextUrl.searchParams.get('data') || '';
  const signature = request.nextUrl.searchParams.get('sig') || '';
  const format = request.nextUrl.searchParams.get('format') === 'wide' ? 'wide' : 'square';
  const payload = verifyFeedbackShareToken(data, signature);
  if (!payload) return new Response('Not found', { status: 404 });

  const wide = format === 'wide';
  const width = wide ? 1200 : 1080;
  const height = wide ? 675 : 1080;
  const statement = `A Muqabala candidate completed ${payload.questions} interview questions and felt ${readiness(payload.confidence)} for the real interview.`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: wide ? '58px 66px' : '74px 76px',
          background: '#0b1f17',
          color: '#f7f7f0',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 15, fontSize: wide ? 26 : 30, fontWeight: 800 }}>
            <div
              style={{
                width: wide ? 44 : 50,
                height: wide ? 44 : 50,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 13,
                background: '#46c7ae',
                color: '#07150f',
                fontSize: wide ? 23 : 26,
              }}
            >
              M
            </div>
            Muqabala
          </div>
          <div
            style={{
              display: 'flex',
              padding: '9px 13px',
              border: '1px solid #46c7ae',
              borderRadius: 999,
              color: '#46c7ae',
              fontSize: wide ? 13 : 15,
              fontWeight: 800,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
            }}
          >
            Shared with permission
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: wide ? 'row' : 'column',
            alignItems: wide ? 'center' : 'flex-start',
            gap: wide ? 72 : 34,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', width: wide ? 300 : 890 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', fontFamily: 'Georgia, serif' }}>
              <span style={{ fontSize: wide ? 118 : 164, fontWeight: 700, letterSpacing: -7 }}>{payload.stars}</span>
              <span style={{ fontSize: wide ? 46 : 58, color: '#93ada2' }}>/5</span>
            </div>
            <div style={{ display: 'flex', marginTop: 8 }}>
              <RatingStars rating={payload.stars} size={wide ? 34 : 44} />
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              maxWidth: wide ? 675 : 890,
              fontFamily: 'Georgia, serif',
              fontSize: wide ? 45 : 58,
              lineHeight: 1.2,
              letterSpacing: wide ? -1.2 : -1.5,
              fontWeight: 700,
            }}
          >
            {statement}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: wide ? 22 : 28,
            borderTop: '1px solid #315247',
            color: '#9bb2a9',
            fontSize: wide ? 17 : 20,
          }}
        >
          <div style={{ display: 'flex', gap: 20 }}>
            <span>{payload.role}</span>
            <span style={{ width: 1, height: 18, background: '#315247' }} />
            <span>{payload.questions} questions</span>
            {payload.score === null ? null : <><span style={{ width: 1, height: 18, background: '#315247' }} /><span>{payload.score}/100</span></>}
          </div>
          <div style={{ display: 'flex', color: '#46c7ae', fontWeight: 800 }}>trymuqabala.com</div>
        </div>
      </div>
    ),
    {
      width,
      height,
      headers: {
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Disposition': `inline; filename="muqabala-rating-${format}.png"`,
        'X-Robots-Tag': 'noindex, nofollow',
      },
    },
  );
}
