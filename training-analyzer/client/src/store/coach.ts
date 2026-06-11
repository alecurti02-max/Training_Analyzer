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
