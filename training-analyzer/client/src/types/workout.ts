import type { Exercise } from './exercise';
import type { WorkoutAnalysis } from './ai';

export type SportType =
  | 'gym'
  | 'running'
  | 'walking'
  | 'karting'
  | 'cycling'
  | 'swimming'
  | 'hiking'
  | 'boxing'
  | 'tennis'
  | 'padel'
  | 'football'
  | 'basketball'
  | 'crossfit'
  | 'yoga'
  | 'climbing'
  | 'skiing'
  | 'martial_arts'
  | 'volleyball'
  | 'skateboard'
  | 'surf'
  | 'dance';

export type RunType = 'easy' | 'tempo' | 'interval' | 'long' | 'recovery' | 'race';

export interface RunSplit {
  pace?: number;
  distance?: number;
  duration?: number;
  hr?: number;
}

export interface HrPoint {
  ts: number;
  hr: number;
}

interface WorkoutBase {
  rpe?: number;
  duration?: number;
  notes?: string;
}

export interface GymWorkoutData extends WorkoutBase {
  exercises: Exercise[];
}

export interface RunningWorkoutData extends WorkoutBase {
  distance?: number;
  avghr?: number;
  maxhr?: number;
  minhr?: number;
  pace?: number;
  elevation?: number;
  cadence?: number;
  runType?: RunType;
  splits?: RunSplit[];
  hrSeries?: HrPoint[];
}

export interface KartingWorkoutData extends WorkoutBase {
  track?: string;
  laps?: number;
  bestLap?: number;
  avgLap?: number;
}

export interface GenericWorkoutData extends WorkoutBase {
  distance?: number;
  avghr?: number;
  maxhr?: number;
  muscles?: string[];
  [extra: string]: unknown;
}

interface WorkoutCommon {
  id: string;
  userId?: string;
  date: string;
  score?: number;
  scores?: WorkoutScores;
  aiAnalysis?: WorkoutAnalysis;
  aiAnalysisGeneratedAt?: string;
  aiAnalysisModel?: string;
  aiAnalysisVersion?: number;
}

export interface WorkoutScores {
  overall?: number;
  volume?: number;
  intensity?: number;
  variety?: number;
  progression?: number;
  duration?: number;
  distance?: number;
  pace?: number;
  hrEfficiency?: number;
  effort?: number;
  consistency?: number;
  improvement?: number;
}

export type Workout =
  | (WorkoutCommon & { type: 'gym' } & GymWorkoutData)
  | (WorkoutCommon & { type: 'running' } & RunningWorkoutData)
  | (WorkoutCommon & { type: 'karting' } & KartingWorkoutData)
  | (WorkoutCommon & { type: Exclude<SportType, 'gym' | 'running' | 'karting'> } & GenericWorkoutData);

export type GymWorkout = Extract<Workout, { type: 'gym' }>;
export type RunningWorkout = Extract<Workout, { type: 'running' }>;
export type KartingWorkout = Extract<Workout, { type: 'karting' }>;
