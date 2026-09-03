export function FocusedInterviewFooterGuard({ active }: { active: boolean }) {
  if (!active) return null;
  return <span hidden data-footer-visibility="focused" />;
}
