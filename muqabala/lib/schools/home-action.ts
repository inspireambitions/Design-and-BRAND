type Attempt={id:string;status:string;feedback_status:string;feedback_opened_at:string|null;comment_read_revision:number|null;evidence_detail:unknown};
export function schoolsHomeAction(assignmentId:string,dueAt:string,attempt:Attempt|undefined,review:{revision:number;comment:string}|undefined,now=Date.now()) {
  const practice='/schools/me/'+assignmentId;
  if(!attempt)return {label:'Start your answers',href:practice};
  if(attempt.status==='draft')return {label:'Continue your answer',href:practice};
  const report='/schools/me/reports/'+attempt.id;
  if(attempt.feedback_status==='ready'&&!attempt.feedback_opened_at)return {label:'Read your feedback',href:report};
  // Unread adviser comments take priority over a retry so they cannot be hidden until the due date.
  if(review?.comment&&review.revision!==(attempt.comment_read_revision??0))return {label:"Read your adviser's comment",href:report+'#adviser-comment'};
  if(attempt.feedback_status==='ready'&&now<new Date(dueAt).getTime()) {
    const detail=Array.isArray(attempt.evidence_detail)?attempt.evidence_detail:[];
    const first=detail.slice().sort((a,b)=>a.elements.filter((e:{present:boolean})=>e.present).length-b.elements.filter((e:{present:boolean})=>e.present).length||a.questionIndex-b.questionIndex)[0];
    return {label:'Retry question '+((first?.questionIndex??0)+1),href:practice+'?retry='+((first?.questionIndex??0)+1)};
  }
  return {label:attempt.feedback_status==='ready'?'Read your report':'Check your feedback',href:report};
}
