// Lato CLIENTE della relazione coach↔cliente (tab Coach nel Profilo): inviti
// pending da accettare/rifiutare, coach attivi, chiusura del rapporto.
import { signal } from '@preact/signals';
import { api } from '@/lib/api';
import { startLiveFromPlan, setRequestedTab } from '@/store/train.js';
import { applyProgression, progressionFor } from '@/lib/progression';

export interface MyCoachRow {
  relationship: {
    id: string;
    status: 'pending' | 'active';
    invitedAt: string;
    acceptedAt: string | null;
    sharing: { body?: boolean; nutrition?: boolean; sleep?: boolean };
  };
  coach: { uid: string; displayName: string | null; photoURL: string | null };
}

export const coachRelationships = signal<MyCoachRow[]>([]);
let loaded = false;

export async function loadMyCoach(force = false): Promise<MyCoachRow[]> {
  if (loaded && !force) return coachRelationships.value;
  try {
    const rows = await api.get<MyCoachRow[]>('/api/me/coach');
    coachRelationships.value = Array.isArray(rows) ? rows : [];
    loaded = true;
  } catch (e) {
    coachRelationships.value = [];
  }
  return coachRelationships.value;
}

async function transition(relationshipId: string, action: 'accept' | 'decline' | 'end') {
  await api.post(`/api/me/coach/${encodeURIComponent(relationshipId)}/${action}`);
  await loadMyCoach(true);
  await loadMyPrograms();
}

export const acceptCoach = (id: string) => transition(id, 'accept');
export const declineCoach = (id: string) => transition(id, 'decline');
export const endCoach = (id: string) => transition(id, 'end');

// Opt-in condivisione dati sensibili (F3): solo il cliente la controlla.
export async function updateSharing(relationshipId: string, patch: { body?: boolean; nutrition?: boolean; sleep?: boolean }) {
  await api.put(`/api/me/coach/${encodeURIComponent(relationshipId)}/sharing`, patch);
  await loadMyCoach(true);
}

// ---- F2: scheda attiva assegnata dal coach ----

export interface MyProgramRow {
  assignment: { id: string; startDate: string; weekdayMap: Record<string, number> | null; note: string | null; coachId: string };
  program: {
    id: string;
    title: string;
    goal: string | null;
    weeks: number;
    days: Array<{ key: string; label?: string; type?: string; muscleGroups?: string[]; note?: string | null; exercises?: unknown[] }>;
    progressions: Array<{ week: number; loadPct?: number; deload?: boolean; note?: string | null }>;
  };
  currentWeek: number;
}

export const myPrograms = signal<MyProgramRow[]>([]);

export async function loadMyPrograms(): Promise<MyProgramRow[]> {
  try {
    const rows = await api.get<MyProgramRow[]>('/api/me/program');
    myPrograms.value = Array.isArray(rows) ? rows : [];
  } catch (e) {
    myPrograms.value = [];
  }
  return myPrograms.value;
}

// "Avvia giorno": carichi aggiustati alla settimana corrente → live precompilata
// (stesso flusso di Dashboard "INIZIA ORA": pendingLivePlan + tab live).
export function launchDay(row: MyProgramRow, dayKey: string): boolean {
  const day = (row.program.days || []).find((d) => d.key === dayKey);
  if (!day) return false;
  const prog = progressionFor(row.program.progressions, row.currentWeek);
  const plan = {
    type: day.type || 'gym',
    muscleGroups: day.muscleGroups || [],
    note: day.note || null,
    exercises: applyProgression((day.exercises || []) as never[], prog.loadPct),
    _assignment: { assignmentId: row.assignment.id, dayKey, week: row.currentWeek },
  };
  startLiveFromPlan(plan);
  setRequestedTab('live');
  (window as unknown as { showPage: (p: string) => void }).showPage('train');
  return true;
}
