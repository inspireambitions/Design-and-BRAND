/** Store a broad device category, never the request's identifying user-agent text. */
export function schoolsDevice(request:Request):'mobile'|'tablet'|'desktop' {
  const agent=request.headers.get('user-agent')??'';
  return /iPad|Tablet|Android(?!.*Mobile)/i.test(agent)?'tablet':/Mobi|iPhone|Android/i.test(agent)?'mobile':'desktop';
}
