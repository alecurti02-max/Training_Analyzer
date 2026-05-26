export interface DropSet {
  reps: number;
  weight: number;
}

export interface ExerciseSet {
  reps: number;
  weight?: number;
  weightLeft?: number;
  weightRight?: number;
  bodyweight?: boolean;
  rpe?: number;
  drops?: DropSet[];
}

export type WeightMode = 'total' | 'per_side';

export interface Exercise {
  name: string;
  muscle: string;
  secondaryMuscles?: string[];
  sets: ExerciseSet[];
  isUnilateral?: boolean;
  weightMode?: WeightMode;
  barbellWeight?: number;
}
