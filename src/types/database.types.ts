export type UserRole = 'coach' | 'member';

export type DomainKey =
  | 'cardiovascular_endurance'
  | 'stamina'
  | 'strength'
  | 'flexibility'
  | 'power'
  | 'speed'
  | 'coordination'
  | 'agility'
  | 'balance'
  | 'accuracy';

export const ALL_DOMAINS: DomainKey[] = [
  'cardiovascular_endurance',
  'stamina',
  'strength',
  'flexibility',
  'power',
  'speed',
  'coordination',
  'agility',
  'balance',
  'accuracy',
];

export const DOMAIN_LABELS: Record<DomainKey, string> = {
  cardiovascular_endurance: 'Cardiovascular Endurance',
  stamina: 'Stamina',
  strength: 'Strength',
  flexibility: 'Flexibility',
  power: 'Power',
  speed: 'Speed',
  coordination: 'Coordination',
  agility: 'Agility',
  balance: 'Balance',
  accuracy: 'Accuracy',
};

export type DomainWeights = Partial<Record<DomainKey, number>>;
export type DomainScores = Record<DomainKey, number>;

export interface Profile {
  id: string;
  role: UserRole;
  display_name: string;
  avatar_url: string | null;
  leaderboard_visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface Group {
  id: string;
  coach_id: string;
  name: string;
  invite_code: string;
  created_at: string;
}

export interface GroupMembership {
  id: string;
  group_id: string;
  member_id: string;
  joined_at: string;
}

export interface Challenge {
  id: string;
  group_id: string;
  coach_id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  domain_weights: DomainWeights;
  is_published: boolean;
  created_at: string;
}

export interface ChallengeExercise {
  id: string;
  challenge_id: string;
  name: string;
  sets: number | null;
  reps: number | null;
  weight_kg: number | null;
  distance_m: number | null;
  duration_s: number | null;
  sort_order: number;
}

export interface ChallengeSubmission {
  id: string;
  challenge_id: string;
  user_id: string;
  notes: string | null;
  raw_score: number;
  submitted_at: string;
}

export interface ChallengeSubmissionExercise {
  id: string;
  submission_id: string;
  exercise_id: string;
  time_s: number | null;
  weight_kg: number | null;
  reps: number | null;
  distance_m: number | null;
}

export interface PersonalWorkout {
  id: string;
  user_id: string;
  name: string | null;
  domain_weights: DomainWeights;
  raw_score: number;
  logged_at: string;
}

export interface PersonalWorkoutExercise {
  id: string;
  workout_id: string;
  name: string;
  sets: number | null;
  reps: number | null;
  weight_kg: number | null;
  distance_m: number | null;
  duration_s: number | null;
  sort_order: number;
}

export interface WorkoutContribution {
  id: string;
  workout_id: string | null;
  submission_id: string | null;
  user_id: string;
  domain: DomainKey;
  contribution_score: number;
  domain_weight: number;
  logged_at: string;
}

// Exercise input — shared shape for both personal workouts and challenge exercises
export interface ExerciseInput {
  name: string;
  sets?: number;
  reps?: number;
  weight_kg?: number;
  distance_m?: number;
  duration_s?: number;
}
