import type { Profile, RoadmapReport } from "./types";

const HEALTH_PROFESSIONAL = /\b(doctor|physician|surgeon|nurse|midwife|dentist|pharmacist|physiotherapist|radiographer|radiologic|medical laboratory|clinical psychologist|paramedic)\b/i;
const HEALTH_QUALIFICATION = /\b(nurs|medic|clinical|pharmac|dent|physiotherap|radiograph|laboratory|midwi|paramedic)\b/i;

export function normaliseRole(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function rolesAreIdentical(currentRole: string, targetRole: string): boolean {
  return normaliseRole(currentRole) === normaliseRole(targetRole);
}

function isUae(profile: Profile): boolean {
  return /\b(uae|united arab emirates|dubai|abu dhabi|sharjah|ajman|fujairah|ras al khaimah|umm al quwain)\b/i.test(
    `${profile.location || ""} ${profile.targetCountry || ""}`
  );
}

function hasPlausibleClinicalPrerequisite(profile: Profile): boolean {
  if (HEALTH_PROFESSIONAL.test(profile.currentRole)) return true;
  if (!["diploma", "degree"].includes(profile.educationLevel || "")) return false;
  return (profile.certificationsHeld || []).some((item) => HEALTH_QUALIFICATION.test(item));
}

export function applyCareerSafetyGuards(report: RoadmapReport, profile: Profile): RoadmapReport {
  if (!HEALTH_PROFESSIONAL.test(profile.targetRole)) return report;

  const uae = isUae(profile);
  const missingPrerequisite = !hasPlausibleClinicalPrerequisite(profile);
  const regulatorNote = uae
    ? "For UAE healthcare work, check the Unified Healthcare Professional Qualification Requirements and the authority for the emirate where you will work: DHA for Dubai, DoH for Abu Dhabi, or MOHAP where its service applies. Do not enrol, practise or apply as a licensed professional until the relevant authority confirms the route."
    : "Healthcare titles are regulated. Check the official health regulator for the place where you want to work before choosing training, practising clinical tasks or applying for a licensed role.";

  const officialChecks = uae
    ? [
        {
          name: "DHA healthcare professional self-assessment",
          provider: "Dubai Health Authority, Sheryan",
          cost: "Automated self-assessment is listed as free",
          duration: "Check before making a training decision",
          rating: "Official Dubai route",
          why: "Use this to check whether your education and experience may meet the Dubai title requirements. Registration and licence activation are separate steps.",
          badge: "Official source",
          url: "https://dha.gov.ae/sheryan/wps/portal/home/services-professional/service-description?CATALOGUE_TYPE=PROFESSIONAL&scode=MPQR",
        },
        {
          name: "UAE Professional Qualification Requirements",
          provider: "Department of Health Abu Dhabi",
          cost: "Read the official requirements before paying a provider",
          duration: "Check the exact professional title",
          rating: "Official UAE requirements",
          why: "Use the current unified requirements to verify education, experience and licensing conditions for the exact title.",
          badge: "Official source",
          url: "https://www.doh.gov.ae/en/pqr",
        },
        {
          name: "MOHAP health professional licensing route",
          provider: "UAE Ministry of Health and Prevention",
          cost: "Official fees and conditions apply",
          duration: "Only after eligibility and document checks",
          rating: "Official federal service",
          why: "Check whether MOHAP is the relevant authority for the intended workplace and confirm evaluation, verification and facility requirements.",
          badge: "Official source",
          url: "https://mohap.gov.ae/en/services/licensing-of-a-doctor",
        },
      ]
    : report.courses;

  const guarded: RoadmapReport = {
    ...report,
    guidanceNote: `${regulatorNote} This roadmap cannot confirm eligibility or replace a regulator's decision.`,
    courses: officialChecks,
  };

  if (!missingPrerequisite) return guarded;

  return {
    ...guarded,
    verdict: `You cannot move straight from ${profile.currentRole} into licensed ${profile.targetRole} work on the information provided. Your chosen ${profile.timelineMonths}-month deadline does not override education, supervised clinical training, assessment, registration or licensing requirements. Start with an official eligibility check. If you are not eligible, the regulator's recognised education route becomes the real timeline.`,
    snapshot: {
      ...guarded.snapshot,
      to: `${profile.targetRole}, only after recognised education, supervised training and licensing`,
      estimatedCost: "Do not estimate until the regulator confirms the recognised route",
    },
    skillGap: [
      { skill: "Eligibility for the exact professional title", status: "need", priority: "high", howToAcquire: "Check the current official qualification requirements for the exact title and intended emirate or country." },
      { skill: "Recognised healthcare education", status: "need", priority: "high", howToAcquire: "Complete only a programme accepted by the relevant health regulator. Confirm recognition in writing before paying." },
      { skill: "Required supervised clinical training", status: "need", priority: "high", howToAcquire: "Complete the placement, internship or supervised practice required for the title through an authorised institution." },
      { skill: "Registration, assessment and licence", status: "need", priority: "high", howToAcquire: "Follow the official document verification, assessment, registration and licence process. Do not practise outside an authorised scope." },
      { skill: "Safe clinical communication and records", status: "need", priority: "medium", howToAcquire: "Learn and demonstrate this only during recognised education or authorised supervised practice. Never use patient information in a public sample." },
    ],
    steps: [
      { title: "Choose the exact licensed title and work location", duration: "Before choosing a course", detail: "The authority and requirements depend on the exact title and place of work. A broad course name is not enough." },
      { title: "Check official eligibility", duration: "First gate", detail: "Use the official qualification requirements and self-assessment route. Save the title, authority and requirements you checked." },
      { title: "Confirm recognised education in writing", duration: "Before paying", detail: "Ask the regulator or recognised institution whether the programme leads to eligibility for the exact title. Do not rely on advertising." },
      { title: "Complete the recognised qualification", duration: "The official programme length", detail: "This stage cannot be compressed to fit the selected deadline. Use the regulator's route as the timeline." },
      { title: "Complete required supervised clinical training", duration: "As required for the title", detail: "Work only through an authorised placement and within the learner or trainee scope." },
      { title: "Complete verification and any required assessment", duration: "After the prerequisites", detail: "Follow the authority's current process for documents, primary-source checks and assessments." },
      { title: "Secure registration and licence activation", duration: "Before practising", detail: "Registration, eligibility and an active professional licence may be separate stages. Confirm each one with the relevant authority and employing facility." },
      { title: "Apply only for authorised roles", duration: "After eligibility is confirmed", detail: "Apply through licensed employers and describe your status accurately. Never claim a protected title or perform clinical work before authorisation." },
    ],
    timeline: [
      { label: "Gate 1", title: "Eligibility", focus: "Identify the exact regulated title and authority.", actions: ["Read the current official requirements", "Run the official self-assessment where available", "Record missing prerequisites"], milestone: "You have an official route for the exact title" },
      { label: "Gate 2", title: "Recognised education", focus: "Complete the education the regulator accepts.", actions: ["Confirm recognition before paying", "Follow the full programme", "Keep official records"], milestone: "The recognised qualification is complete" },
      { label: "Gate 3", title: "Supervised training and assessment", focus: "Meet every clinical practice and assessment condition.", actions: ["Use an authorised placement", "Stay within your scope", "Complete verification and assessments"], milestone: "The authority confirms eligibility or registration" },
      { label: "Gate 4", title: "Licence and employment", focus: "Activate the correct licence before practising.", actions: ["Complete the authority process", "Use a licensed employing facility where required", "Apply only after your status permits it"], milestone: "You hold the authorisation required for the role" },
    ],
    projects: [
      { title: "Official requirements checklist", description: "Create a private checklist from the regulator's current requirements for the exact title. Do not include patient or employer data.", skills: ["Research", "Record keeping", "Professional responsibility"], effort: "One focused session" },
      { title: "Education recognition comparison", description: "Compare recognised routes using official information. Do not treat an online certificate as a clinical qualification.", skills: ["Decision making", "Cost checking", "Planning"], effort: "One to two weeks" },
      { title: "Authorised learning record", description: "Keep evidence only from recognised education or authorised supervised practice. Never publish patient information or clinical material.", skills: ["Safe practice", "Reflection", "Confidentiality"], effort: "Ongoing during authorised training" },
    ],
    risk: {
      ...guarded.risk,
      difficultyLabel: "Regulated route with mandatory gates",
      setbacks: [
        { risk: "A course is not accepted for the intended professional title", mitigation: "Confirm recognition with the relevant authority before paying or enrolling." },
        { risk: "The selected deadline is shorter than the mandatory route", mitigation: "Use the recognised programme and licensing stages as the timeline. Do not skip or compress a gate." },
        { risk: "A person practises or presents themselves beyond their authorised scope", mitigation: "Wait for the required registration and active licence, and follow the employing facility's authorised scope." },
      ],
      planB: "Choose a non-clinical healthcare support role that matches your current education while you verify whether the regulated route is realistic.",
    },
  };
}
