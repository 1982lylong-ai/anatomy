import type { OrganId } from "../lib/anatomy-data";

/** Prose for one organ. Structure (positions, colours, model) lives in
 *  `anatomy-data.ts`; only translatable text belongs here. */
/** One patient-facing disease primer. Optional per locale — locales without
 *  authored pathology copy simply show the plain conditions list. */
export type PathologySection = {
  id: string;
  title: string;
  summary: string;
  keyPoints: string[];
  patientNote: string;
};

export type OrganContent = {
  name: string;
  system: string;
  description: string;
  poetic: string;
  size: string;
  weight: string;
  location: string;
  function: string;
  dailyFact: string;
  medical: string;
  bloodSupply: string;
  funFact: string;
  tissue: string;
  comparison: string;
  conditions: string[];
  /** Organ-specific lesson copy shown in the lesson modal. Falls back to the
   *  shared `ui.modal.lessonBody` when a locale has not authored one yet. */
  lessonBody?: string;
  /** Organ-specific knowledge questions for the quiz modal. Falls back to the
   *  generic `ui.modal.quiz*` copy when absent. */
  quiz?: QuizQuestion[];
  /** Keyed by hotspot id — the Terminologia Anatomica term is the anchor. */
  hotspots: Record<string, { label: string; detail: string }>;
  /** Optional labels for disease dots (pathology mode); falls back to TA term. */
  pathologyHotspots?: Record<string, { label: string; detail: string }>;
  /** Disease primers shown from the clinical-notes card (optional per locale). */
  pathology?: PathologySection[];
  /** Disclaimer line under the pathology list (optional per locale). */
  pathologyNote?: string;
};

export type QuizQuestion = {
  prompt: string;
  options: [string, string, string];
  /** Index of the correct option (0–2). */
  answer: number;
};

export type OrganContentDictionary = Record<OrganId, OrganContent>;

export type UiDictionary = {
  meta: { title: string; description: string; ogTitle: string; ogDescription: string; imageAlt: string };
  brand: { tagline: string; home: string };
  nav: { explore: string; systems: string; lessons: string; library: string; notes: string };
  search: { placeholder: string };
  profile: { open: string };
  language: { label: string; choose: string };
  library: {
    title: string; open: string; close: string; saved: string; viewAll: string;
    quoteLine1: string; quoteLine2: string; quoteSign: string;
  };
  tools: { label: string; rotate: string; zoom: string; isolate: string; section: string; layers: string; compare: string; reset: string };
  viewer: {
    title: string; canvas: string; tip: string; tipDrag: string; tipScroll: string; tipClick: string;
    loading: string; autoRotate: string; caption: string; structures: string;
  };
  info: {
    kicker: string; keyFacts: string; size: string; weight: string; daily: string;
    location: string; bloodSupply: string; function: string; medical: string;
    didYouKnow: string; viewLesson: string; animate: string; quiz: string; compare: string;
  };
  compare: { title: string; comparing: string; reference: string; primaryRole: string; scale: string; vs: string; close: string };
  cards: {
    resources: string; microscopic: string; compareOrgans: string; functionAnimation: string;
    clinicalNotes: string; whereItWorks: string; commonConditions: string;
    exploreTissue: string; openComparison: string; playAnimation: string; seeAll: string; seeSystem: string;
    playAria: string; systemAria: string;
  };
  quiz: {
    start: string; find: string; progress: string; correct: string; wrong: string;
    reveal: string; answer: string; done: string; score: string; retry: string; exit: string; hint: string;
  };
  modal: {
    guided: string; close: string; continueExploring: string;
    quizTitle: string; motionTitle: string; bodyTitle: string; insideTitle: string;
    quizPrompt: string; quizA: string; quizB: string; quizC: string;
    lessonBody: string; systemIntro: string; system: string; primaryRole: string; bloodSupply: string;
  };
};

export type Dictionary = { ui: UiDictionary; organs: OrganContentDictionary };

/** Minimal `{name}` interpolation — the copy has no plurals or dates. */
export function format(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (match, key) => values[key] ?? match);
}
