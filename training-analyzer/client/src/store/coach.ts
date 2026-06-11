// Store dell'area Personal Trainer (pagina Clienti). Tutte le chiamate passano
// dalle route /api/coach/* (gate server-side requireTrainer + relazione attiva);
// lo stato 'forbidden' pilota l'empty-state per chi apre /clienti senza ruolo.
import { signal } from '@preact/signals';
import { api } from '@/lib/api';

export interface CoachRelationship {
  id: string;
  status: 'pending' | 'active';
  invitedAt: string;
  acceptedAt: string | null;
  sharing: { body?: boolean; nutrition?: boolean; sleep?: boolean };
}

export interface CoachClientRow {
  relationship: CoachRelationship;
  user: { uid: string; displayName: string | null; photoURL: string | null; email: string };
  lastWorkoutDate?: string | null;
  workouts7d?: number;
  workouts30d?: number;
  activeAssignment?: {
    id: string;
    title: string;
    currentWeek: number;
    weeks: number;
    adherencePct: number | null;
  } | null;
}

export const coachClients = signal<CoachClientRow[]>([]);
export const coachClientsState = signal<'idle' | 'loading' | 'ok' | 'forbidden' | 'error'>('idle');

export async function loadCoachClients(): Promise<CoachClientRow[]> {
  if (coachClientsState.value === 'idle') coachClientsState.value = 'loading';
  try {
    const rows = await api.get<CoachClientRow[]>('/api/coach/clients?includeStats=1');
    coachClients.value = Array.isArray(rows) ? rows : [];
    coachClientsState.value = 'ok';
  } catch (e: any) {
    coachClients.value = [];
    coachClientsState.value = e?.status === 403 ? 'forbidden' : 'error';
  }
  return coachClients.value;
}

export async function inviteClient(email: string) {
  const res = await api.post('/api/coach/clients/invites', { email });
  await loadCoachClients();
  return res;
}

export async function removeRelationship(relationshipId: string): Promise<void> {
  await api.del(`/api/coach/clients/${encodeURIComponent(relationshipId)}`);
  await loadCoachClients();
}

// Letture per il dettaglio cliente (niente cache: il dettaglio si apre poco
// spesso e i dati devono essere freschi).
export const loadClientStats = (clientId: string) =>
  api.get(`/api/coach/clients/${encodeURIComponent(clientId)}/stats`);

export const loadClientWorkouts = (clientId: string, limit = 100) =>
  api.get(`/api/coach/clients/${encodeURIComponent(clientId)}/workouts?limit=${limit}`);

export const loadClientPlans = (clientId: string) =>
  api.get(`/api/coach/clients/${encodeURIComponent(clientId)}/planned-workouts`);

export const saveClientPlan = (clientId: string, plan: unknown) =>
  api.post(`/api/coach/clients/${encodeURIComponent(clientId)}/planned-workouts`, plan);

export const deleteClientPlan = (clientId: string, planId: string) =>
  api.del(`/api/coach/clients/${encodeURIComponent(clientId)}/planned-workouts/${encodeURIComponent(planId)}`);

// ---- F2: schede (programs) e assegnazioni ----

export interface ProgramDay {
  key: string;
  label?: string;
  type?: string;
  muscleGroups?: string[];
  note?: string | null;
  exercises?: unknown[];
}

export interface Program {
  id: string;
  title: string;
  goal?: string | null;
  notes?: string | null;
  weeks: number;
  days: ProgramDay[];
  progressions: Array<{ week: number; loadPct?: number; deload?: boolean; note?: string | null }>;
  status: 'draft' | 'active' | 'archived';
  updatedAt?: string;
}

export const coachPrograms = signal<Program[]>([]);

export async function loadPrograms(): Promise<Program[]> {
  try {
    const rows = await api.get<Program[]>('/api/coach/programs');
    coachPrograms.value = Array.isArray(rows) ? rows : [];
  } catch (e) {
    coachPrograms.value = [];
  }
  return coachPrograms.value;
}

export async function saveProgram(program: Partial<Program> & { id?: string }): Promise<Program> {
  const saved = program.id
    ? await api.put<Program>(`/api/coach/programs/${encodeURIComponent(program.id)}`, program)
    : await api.post<Program>('/api/coach/programs', program);
  await loadPrograms();
  return saved;
}

export async function deleteProgram(id: string): Promise<void> {
  await api.del(`/api/coach/programs/${encodeURIComponent(id)}`);
  await loadPrograms();
}

export async function duplicateProgram(id: string): Promise<Program> {
  const copy = await api.post<Program>(`/api/coach/programs/${encodeURIComponent(id)}/duplicate`);
  await loadPrograms();
  return copy;
}

export const loadProgram = (id: string) =>
  api.get<Program>(`/api/coach/programs/${encodeURIComponent(id)}`);

export const assignProgram = (clientId: string, body: { programId: string; startDate: string; weekdayMap?: Record<string, number> | null; note?: string }) =>
  api.post(`/api/coach/clients/${encodeURIComponent(clientId)}/assignments`, body);

export const updateAssignment = (id: string, body: { status?: 'completed' | 'cancelled'; weekdayMap?: Record<string, number> | null; note?: string | null }) =>
  api.put(`/api/coach/assignments/${encodeURIComponent(id)}`, body);

export const loadAdherence = (clientId: string) =>
  api.get(`/api/coach/clients/${encodeURIComponent(clientId)}/adherence`);
