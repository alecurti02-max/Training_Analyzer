// Lato CLIENTE della relazione coach↔cliente (tab Coach nel Profilo): inviti
// pending da accettare/rifiutare, coach attivi, chiusura del rapporto.
import { signal } from '@preact/signals';
import { api } from '@/lib/api';

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
}

export const acceptCoach = (id: string) => transition(id, 'accept');
export const declineCoach = (id: string) => transition(id, 'decline');
export const endCoach = (id: string) => transition(id, 'end');
