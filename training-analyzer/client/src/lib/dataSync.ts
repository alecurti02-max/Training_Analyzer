import { setWorkouts, type WorkoutRecord } from '@/store/workouts';
import { setSettings, setActiveSports, setMuscleGroups } from '@/store/settings';
import { setExercises } from '@/store/exercises';
import { setWeights } from '@/store/weights';
import { setFollowing } from '@/store/following';

export interface LegacySnapshot {
  workouts?: WorkoutRecord[];
  settings?: Record<string, any>;
  exercises?: any[] | null;
  weights?: any[];
  following?: Record<string, any>;
  activeSports?: string[];
  muscleGroups?: string[];
}

// Mirror UNIDIREZIONALE legacy → signal store durante la transizione.
// Chiamato da js/ui.js::onDataChanged dopo loadAllData e dopo ogni mutazione.
// Additivo in Fase 7a (i signal vengono popolati ma i lettori restano sul
// percorso legacy); i lettori passeranno ai signal in Fase 7b+. In Fase 9,
// quando ui.js sparisce, i load* viveranno direttamente negli store e questo
// file verrà rimosso.
export function syncFromLegacy(s: LegacySnapshot): void {
  if (s.workouts !== undefined) setWorkouts(s.workouts);
  if (s.settings !== undefined) setSettings(s.settings);
  if (s.exercises !== undefined && s.exercises !== null) setExercises(s.exercises);
  if (s.weights !== undefined) setWeights(s.weights);
  if (s.following !== undefined) setFollowing(s.following);
  if (s.activeSports !== undefined) setActiveSports(s.activeSports);
  if (s.muscleGroups !== undefined) setMuscleGroups(s.muscleGroups);
}
