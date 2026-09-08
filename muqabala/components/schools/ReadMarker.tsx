'use client';
import { useEffect } from 'react';
export function SchoolsReadMarker({attemptId,feedback,reviewRevision}:{attemptId:string;feedback:boolean;reviewRevision:number|null}) {
  useEffect(()=>{if(!feedback&&!reviewRevision)return;
    void fetch('/api/schools',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:'read',payload:{attemptId,feedback,reviewRevision}})}).catch(()=>{});
  },[attemptId,feedback,reviewRevision]);
  return null;
}
