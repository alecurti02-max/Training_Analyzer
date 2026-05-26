import type { SportType } from './workout';

export type UserPlan = 'free' | 'premium';
export type Gender = 'M' | 'F';

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  plan?: UserPlan;
  role?: 'user' | 'admin';
  createdAt?: string;
}

export interface UserSettings {
  bodyweight?: number;
  height?: number;
  age?: number;
  gender?: Gender;

  maxhr?: number;
  resthr?: number;
  vo2max?: number;

  bodyFat?: number;
  visceralFat?: number;
  skeletalMuscle?: number;
  circWaist?: number;
  circHips?: number;

  flexibility?: number;
  activeSports?: SportType[];
}
