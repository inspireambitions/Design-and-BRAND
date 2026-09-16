'use client';

import { useEffect, useRef, useState } from 'react';
import {
  clearPilotStorage, maskPilotEmail, parsePilotResponse, readPilotPending, readPilotReceipt,
  savePilotPending, savePilotReceipt, type PilotAcknowledgement, type PilotReceipt,
} from '@/lib/schools/pilot-receipt';

const fields = [
  { name: 'institution', label: 'Institution', max: 160, autoComplete: 'organization' },
  { name: 'name', label: 'Your name', max: 100, autoComplete: 'name' },
  { name: 'email', label: 'Email for our reply', max: 254, autoComplete: 'email' },
  { name: 'message', label: 'Message', max: 2000, autoComplete: undefined },
] as const;
type FieldName = typeof fields[number]['name'];

export function SchoolsPilotContact() {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [conflict, setConflict] = useState(false);
  const [receipt, setReceipt] = useState<PilotReceipt | null>(null);
  const [acknowledgement, setAcknowledgement] = useState<PilotAcknowledgement | null>(null);
  const [storageNotice, setStorageNotice] = useState('');
  const [resuming, setResuming] = useState(false);
  const pending = useRef<string | null>(null);
  const sending = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      pending.current = readPilotPending();
      setResuming(!!pending.current);
      setReceipt(readPilotReceipt());
      setReady(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => { if (receipt) statusRef.current?.focus(); }, [receipt]);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);

  function newEnquiry() {
    const cleared = clearPilotStorage();
    pending.current = null;
    setReceipt(null);
    setAcknowledgement(null);
    setConflict(false);
    setError('');
    setErrors({});
    setResuming(false);
    setStorageNotice(cleared ? '' : 'This browser cannot clear the previous receipt. Keep this page open while sending your new enquiry.');
    // A conflicting form keeps its edited fields; a completed enquiry starts blank.
    requestAnimationFrame(() => formRef.current?.querySelector('input')?.focus());
  }

  return <section id="start-pilot" className="schools-section">
    <h2>Enquire about a school pilot</h2>
    <p>Tell us about your institution, adult students and teaching language. We will reply personally to discuss whether a pilot fits your needs.</p>
    <p>An enquiry does not create an account, enrol students, grant access or subscribe you to a newsletter.</p>
    {!receipt && resuming && <p>A previous enquiry may have been saved. Re-enter the same details to recover its reference. For privacy, we do not store your form answers in this browser.</p>}
    {receipt ? <>
      <div ref={statusRef} role="status" tabIndex={-1} className="schools-card">
        <h3>Your pilot enquiry is saved.</h3>
        <p>Reference: <strong style={{ overflowWrap: 'anywhere' }}>{receipt.reference}</strong></p>
        <p>Reply email: <strong>{receipt.maskedEmail}</strong>. We will reply personally to the address you provided.</p>
        {acknowledgement === 'queued'
          ? <p>An email receipt is queued. Keep this reference if it does not arrive.</p>
          : <p>{acknowledgement === 'unavailable' ? 'Email confirmation is currently unavailable. ' : ''}Your enquiry is saved. Keep this reference for any follow-up if an email receipt is delayed or does not arrive.</p>}
        <p>You do not need to submit the same enquiry again.</p>
      </div>
      <button type="button" onClick={newEnquiry}>Start a new enquiry</button>
    </> : <form ref={formRef} method="post" noValidate aria-busy={busy} onSubmit={async event => {
      event.preventDefault();
      if (!ready || sending.current) return;
      const form = event.currentTarget;
      const data = new FormData(form);
      const values = Object.fromEntries(fields.map(field => [field.name, String(data.get(field.name) ?? '').trim()])) as Record<FieldName, string>;
      const nextErrors: Partial<Record<FieldName, string>> = {};
      for (const field of fields) {
        if (!values[field.name]) nextErrors[field.name] = `Enter ${field.label.toLowerCase()}.`;
        else if (values[field.name].length > field.max) nextErrors[field.name] = `Use ${field.max} characters or fewer.`;
      }
      if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) nextErrors.email = 'Enter a valid email address.';
      setErrors(nextErrors);
      setError('');
      const invalid = fields.find(field => nextErrors[field.name]);
      if (invalid) { (form.elements.namedItem(invalid.name) as HTMLElement)?.focus(); return; }
      sending.current = true;
      setBusy(true);
      try {
        // Preserve the key after ambiguous failures, edits and refreshes. Changed
        // content receives 409; only an explicit new enquiry rotates the key.
        pending.current ??= crypto.randomUUID();
        if (!savePilotPending(pending.current)) setStorageNotice('This browser cannot remember your enquiry after a refresh. Keep this page open while retrying.');
        const response = await fetch('/api/schools/pilot-contact', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...values, submissionId: pending.current }),
          signal: AbortSignal.timeout(45000),
        });
        const body: unknown = await response.json().catch(() => null);
        if (response.status === 409) {
          setConflict(true);
          setError('This submission was already saved with different details. Correct the details to match your original enquiry and retry to recover its reference. To send different details separately, choose Start a new enquiry.');
          return;
        }
        if (!response.ok) {
          const message = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string' ? body.error : 'We could not confirm that your enquiry was saved.';
          setError(`${message} Your details are still here. Retry with the same details to avoid a duplicate enquiry.`);
          return;
        }
        const saved = parsePilotResponse(body);
        if (!saved) throw new Error('Invalid receipt');
        const nextReceipt = { reference: saved.reference, maskedEmail: maskPilotEmail(values.email) };
        if (!savePilotReceipt(nextReceipt)) setStorageNotice('This browser cannot remember your receipt after a refresh. Please keep a copy of the reference.');
        else setStorageNotice('');
        setAcknowledgement(saved.acknowledgement);
        setReceipt(nextReceipt);
      } catch {
        setError('We could not confirm that your enquiry was saved. Your details are still here. Retry with the same details to avoid a duplicate enquiry.');
      } finally { sending.current = false; setBusy(false); }
    }}>
      {fields.map(field => <div key={field.name}>
        <label htmlFor={`pilot-${field.name}`}>{field.label}</label>
        {field.name === 'message'
          ? <textarea id={`pilot-${field.name}`} name={field.name} rows={5} maxLength={field.max} required disabled={busy} aria-invalid={!!errors[field.name]} aria-describedby={errors[field.name] ? `pilot-${field.name}-error` : undefined}/>
          : <input id={`pilot-${field.name}`} name={field.name} type={field.name === 'email' ? 'email' : 'text'} autoComplete={field.autoComplete} maxLength={field.max} required disabled={busy} aria-invalid={!!errors[field.name]} aria-describedby={errors[field.name] ? `pilot-${field.name}-error` : undefined}/>}
        {errors[field.name] && <p id={`pilot-${field.name}-error`}>{errors[field.name]}</p>}
      </div>)}
      <button type="submit" disabled={!ready || busy}>{busy ? 'Sending enquiry…' : 'Send pilot enquiry'}</button>
      {conflict && <p><button type="button" disabled={busy} onClick={newEnquiry}>Start a new enquiry with these details</button></p>}
    </form>}
    {error && <p ref={errorRef} role="alert" tabIndex={-1}>{error}</p>}
    {!receipt && <p role="status">{busy ? 'Sending enquiry…' : ''}</p>}
    {storageNotice && <p role="note">{storageNotice}</p>}
  </section>;
}
