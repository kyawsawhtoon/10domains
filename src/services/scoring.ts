import { supabase } from '../lib/supabase';
import {
  DomainKey,
  DomainScores,
  DomainWeights,
  ExerciseInput,
  ALL_DOMAINS,
} from '../types/database.types';

// λ for exponential decay — must match the SQL function constant.
export const DECAY_LAMBDA = 0.02;

/**
 * Converts exercise inputs into a raw performance score (0–10).
 * Uses a simple heuristic based on available metrics.
 */
export function computeRawScore(exercises: ExerciseInput[]): number {
  let score = 0;
  let count = 0;

  for (const ex of exercises) {
    let exerciseScore = 5; // baseline for just doing it

    if (ex.weight_kg) exerciseScore = Math.min(10, exerciseScore + ex.weight_kg / 20);
    if (ex.reps) exerciseScore = Math.min(10, exerciseScore + ex.reps / 10);
    if (ex.distance_m) exerciseScore = Math.min(10, exerciseScore + ex.distance_m / 1000);
    if (ex.duration_s) exerciseScore = Math.min(10, exerciseScore + ex.duration_s / 300);

    score += Math.min(10, exerciseScore);
    count++;
  }

  return count > 0 ? Math.min(10, score / count) : 0;
}

/**
 * Computes per-domain contribution scores for a single workout.
 * Returns one entry per domain that has a non-zero weight.
 */
export function computeContributions(
  rawScore: number,
  domainWeights: DomainWeights,
): Array<{ domain: DomainKey; contribution_score: number; domain_weight: number }> {
  return (Object.entries(domainWeights) as Array<[DomainKey, number]>)
    .filter(([, weight]) => weight > 0)
    .map(([domain, weight]) => ({
      domain,
      contribution_score: parseFloat((rawScore * weight).toFixed(3)),
      domain_weight: weight,
    }));
}

/**
 * Fetches recency-weighted domain scores for a user via the server-side
 * Postgres function. Always server-side to ensure consistency.
 */
export async function fetchDomainScores(userId: string): Promise<DomainScores> {
  const { data, error } = await supabase.rpc('compute_domain_scores', {
    p_user_id: userId,
  });

  if (error) throw error;

  // Fill any missing domains with 0
  const scores: DomainScores = {} as DomainScores;
  for (const domain of ALL_DOMAINS) {
    scores[domain] = data?.[domain] ?? 0;
  }
  return scores;
}

/**
 * Persists contributions for a personal workout and returns updated domain scores.
 */
export async function savePersonalWorkoutContributions(
  workoutId: string,
  userId: string,
  contributions: Array<{ domain: DomainKey; contribution_score: number; domain_weight: number }>,
): Promise<DomainScores> {
  const rows = contributions.map((c) => ({
    workout_id: workoutId,
    user_id: userId,
    domain: c.domain,
    contribution_score: c.contribution_score,
    domain_weight: c.domain_weight,
  }));

  const { error } = await supabase.from('workout_contributions').insert(rows);
  if (error) throw error;

  return fetchDomainScores(userId);
}

/**
 * Persists contributions for a challenge submission and returns updated domain scores.
 */
export async function saveChallengeSubmissionContributions(
  submissionId: string,
  userId: string,
  contributions: Array<{ domain: DomainKey; contribution_score: number; domain_weight: number }>,
): Promise<DomainScores> {
  const rows = contributions.map((c) => ({
    submission_id: submissionId,
    user_id: userId,
    domain: c.domain,
    contribution_score: c.contribution_score,
    domain_weight: c.domain_weight,
  }));

  const { error } = await supabase.from('workout_contributions').insert(rows);
  if (error) throw error;

  return fetchDomainScores(userId);
}
