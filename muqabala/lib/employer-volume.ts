/**
 * Feature flags for the employer volume build.
 *
 * Both default to off. Every surface from the volume brief renders only when
 * `EMPLOYER_VOLUME` is true. WhatsApp sending and its UI render only when
 * `WHATSAPP_ENABLED` is also true, which requires a messaging provider that
 * does not exist yet. Read on the server and passed to client components as
 * props so a flag change needs no rebuild.
 */

function flag(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === 'true';
}

export function employerVolumeEnabled(): boolean {
  return flag(process.env.EMPLOYER_VOLUME);
}

export function whatsAppEnabled(): boolean {
  return employerVolumeEnabled() && flag(process.env.WHATSAPP_ENABLED);
}

export type EmployerVolumeFlags = {
  volume: boolean;
  whatsApp: boolean;
};

export function employerVolumeFlags(): EmployerVolumeFlags {
  return { volume: employerVolumeEnabled(), whatsApp: whatsAppEnabled() };
}
