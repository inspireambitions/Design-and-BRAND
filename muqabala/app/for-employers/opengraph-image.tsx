import { ImageResponse } from 'next/og';

export const alt = 'Muqabala work samples for hiring teams';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function EmployerOpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          padding: '54px 64px 46px',
          background: '#F2F5F2',
          color: '#16241F',
          fontFamily: 'Arial, sans-serif',
          borderTop: '14px solid #0B7A6B',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 27, fontWeight: 700 }}>
            <div
              style={{
                width: 43,
                height: 43,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 10,
                color: '#FFFFFF',
                background: '#0B7A6B',
                fontSize: 23,
              }}
            >
              م
            </div>
            Muqabala
          </div>
          <div style={{ color: '#0B7A6B', fontSize: 15, fontWeight: 700, letterSpacing: '2.5px' }}>
            FOR HIRING TEAMS
          </div>
        </div>

        <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 60 }}>
          <div style={{ width: '62%', display: 'flex', flexDirection: 'column', gap: 22 }}>
            <div style={{ fontSize: 72, lineHeight: 0.98, letterSpacing: '-3px', fontWeight: 700 }}>
              See who can do the job.
            </div>
            <div style={{ maxWidth: 650, color: '#52645E', fontSize: 28, lineHeight: 1.28 }}>
              Create an adaptive video interview from any job description.
            </div>
          </div>

          <div
            style={{
              width: '38%',
              display: 'flex',
              flexDirection: 'column',
              padding: '30px 32px',
              borderRadius: 20,
              background: '#FFFFFF',
              boxShadow: '0 18px 50px rgba(33, 68, 58, 0.11)',
            }}
          >
            {['Add the vacancy', 'Share the link', 'Review the answers'].map((label, index) => (
              <div
                key={label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 17,
                  padding: index === 1 ? '22px 0' : index === 0 ? '0 0 22px' : '22px 0 0',
                  borderTop: index === 0 ? 'none' : '1px solid #D4DFDA',
                  color: '#203B33',
                  fontSize: 23,
                  fontWeight: 700,
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 17,
                    color: '#FFFFFF',
                    background: '#0B7A6B',
                    fontSize: 17,
                  }}
                >
                  {index + 1}
                </div>
                {label}
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 22,
            borderTop: '1px solid #CBD8D3',
            color: '#52645E',
            fontSize: 17,
            fontWeight: 700,
          }}
        >
          <div>Human review. Nothing is automatically rejected.</div>
          <div style={{ color: '#16241F' }}>trymuqabala.com</div>
        </div>
      </div>
    ),
    size,
  );
}
