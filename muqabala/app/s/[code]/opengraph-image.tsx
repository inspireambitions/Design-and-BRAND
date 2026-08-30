import { ImageResponse } from 'next/og';
import { getScreeningPack } from '@/lib/screening-pack';
import { screeningPreviewCopy } from '@/lib/screening-preview';

export const alt = 'A Muqabala work-sample invitation from a hiring team';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const dynamic = 'force-dynamic';

export default async function ScreeningOpenGraphImage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const pack = await getScreeningPack(code);
  const preview = screeningPreviewCopy({
    companyName: pack.status === 'active' || pack.status === 'full' ? pack.workplace : undefined,
    jobTitle: pack.status === 'active' || pack.status === 'full' ? pack.role.title : undefined,
    questionCount: pack.status === 'active' || pack.status === 'full' ? pack.role.questions.length : undefined,
  });
  const roleSize = preview.jobTitle.length > 55 ? 30 : preview.jobTitle.length > 35 ? 35 : 40;
  const companySize = preview.companyName.length > 55 ? 25 : preview.companyName.length > 35 ? 29 : 34;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          padding: '52px 62px 44px',
          background: '#F2F5F2',
          color: '#16241F',
          fontFamily: 'Arial, sans-serif',
          borderLeft: '16px solid #0B7A6B',
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
            WORK SAMPLE
          </div>
        </div>

        <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 52 }}>
          <div style={{ width: '62%', display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ fontSize: 67, lineHeight: 0.99, letterSpacing: '-2.8px', fontWeight: 700 }}>
              {preview.headline}
            </div>
            <div style={{ color: '#52645E', fontSize: 24, lineHeight: 1.35 }}>
              {`${preview.timingLine} ${preview.reviewLine}`}
            </div>
          </div>

          <div
            style={{
              width: '38%',
              minHeight: 235,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              padding: '34px 35px',
              borderRadius: 20,
              background: '#FFFFFF',
              boxShadow: '0 18px 50px rgba(33, 68, 58, 0.11)',
            }}
          >
            <div style={{ color: '#0B7A6B', fontSize: 14, fontWeight: 700, letterSpacing: '2px' }}>
              THE ROLE
            </div>
            <div style={{ marginTop: 15, fontSize: roleSize, lineHeight: 1.08, fontWeight: 700 }}>
              {preview.jobTitle}
            </div>
            <div style={{ marginTop: 20, color: '#52645E', fontSize: 17 }}>FROM</div>
            <div style={{ marginTop: 5, color: '#203B33', fontSize: companySize, lineHeight: 1.08, fontWeight: 700 }}>
              {preview.companyName}
            </div>
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
          <div>{preview.trustLine}</div>
          <div style={{ color: '#16241F' }}>trymuqabala.com</div>
        </div>
      </div>
    ),
    size,
  );
}
