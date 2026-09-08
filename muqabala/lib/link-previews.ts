import type {Metadata} from 'next';
const origin='https://trymuqabala.com';
export const pagePreviews={
  home:{path:'/',title:'Muqabala: private interview practice',description:'Practise your Gulf job interview. Clear feedback in English or Arabic. Free, no account.',image:'home'},
  schools:{path:'/schools',title:'Muqabala for Schools and Colleges',description:'Interview practice for every student. Evidence for every adviser. Assign three role-relevant questions to a class; students practise in private; you review and comment.',image:'schools'},
  employers:{path:'/for-employers',title:'Muqabala for Hiring Teams',description:'See who can do the job before you open a CV. Paste the advert, invite candidates, review answers in their own words. You decide.',image:'employers'},
} as const;
export function pagePreviewMetadata(key:keyof typeof pagePreviews):Metadata {
  const page=pagePreviews[key];const image={url:origin+'/og/'+page.image+'.png',width:1200,height:630,alt:page.title};
  return {title:{absolute:page.title},description:page.description,alternates:{canonical:origin+page.path},
    openGraph:{type:'website',locale:'en_GB',siteName:'Muqabala',url:origin+page.path,title:page.title,description:page.description,images:[image]},
    twitter:{card:'summary_large_image',title:page.title,description:page.description,images:[image.url]}};
}
