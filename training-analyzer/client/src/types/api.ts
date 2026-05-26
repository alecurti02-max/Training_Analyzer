import type { Workout } from './workout';
import type { WorkoutAnalysis } from './ai';
import type { User, UserSettings } from './user';

export interface ApiErrorShape {
  message?: string;
  code?: string;
  error?: string | { code?: string; message?: string };
}

export interface ApiError extends Error {
  status: number;
  code: string | null;
  data: ApiErrorShape;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
}

export interface LoginResponse extends AuthTokens {
  user: User;
}

export interface RefreshResponse extends AuthTokens {
  token?: string;
}

export interface WorkoutsListResponse {
  workouts: Workout[];
}

export interface WorkoutResponse {
  workout: Workout;
}

export interface AnalyzeWorkoutResponse {
  analysis: WorkoutAnalysis;
  workout?: Workout;
  cached?: boolean;
  generatedAt?: string;
  model?: string;
}

export interface SettingsResponse {
  settings: UserSettings;
}
