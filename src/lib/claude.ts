import Anthropic from '@anthropic-ai/sdk';
import { DomainWeights, ExerciseInput } from '../types/database.types';

const client = new Anthropic({
  apiKey: process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY!,
});

const MODEL = 'claude-sonnet-4-20250514';

const DOMAIN_MAPPING_SYSTEM_PROMPT = `You are a General Physical Preparedness (GPP) expert. Analyze the workout provided and return a JSON object mapping fitness domains to their weights. Weights must sum to 1.0. Omit domains not meaningfully trained by the workout.

The 10 GPP fitness domains and their definitions:
- cardiovascular_endurance: Ability of the body's systems to gather, process, and deliver oxygen
- stamina: Ability of body systems to process, deliver, store, and utilize energy
- strength: Ability of a muscular unit, or combination of muscular units, to apply force
- flexibility: Ability to maximize the range of motion at a given joint
- power: Ability of a muscular unit to apply maximum force in minimum time
- speed: Ability to minimize the cycle time of a repeated movement
- coordination: Ability to combine several distinct movement patterns into a singular movement
- agility: Ability to minimize transition time from one movement pattern to another
- balance: Ability to control the placement of the body's center of gravity
- accuracy: Ability to control movement in a given direction or at a given intensity

Return ONLY a valid JSON object. No preamble, no explanation, no markdown. Example:
{"strength": 0.5, "power": 0.3, "stamina": 0.2}`;

function formatWorkoutForPrompt(exercises: ExerciseInput[]): string {
  return exercises
    .map((e) => {
      const parts = [e.name];
      if (e.sets && e.reps) parts.push(`${e.sets}x${e.reps}`);
      else if (e.reps) parts.push(`${e.reps} reps`);
      if (e.weight_kg) parts.push(`${e.weight_kg}kg`);
      if (e.distance_m) parts.push(`${e.distance_m}m`);
      if (e.duration_s) parts.push(`${Math.round(e.duration_s / 60)}min`);
      return parts.join(' ');
    })
    .join('\n');
}

export async function mapWorkoutToDomains(exercises: ExerciseInput[]): Promise<DomainWeights> {
  const workoutDescription = formatWorkoutForPrompt(exercises);

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 256,
    system: DOMAIN_MAPPING_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Workout:\n${workoutDescription}`,
      },
    ],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text.trim() : '';
  const weights: DomainWeights = JSON.parse(text);

  // Normalize weights to ensure they sum to 1.0
  const total = Object.values(weights).reduce((sum, w) => sum + (w ?? 0), 0);
  if (total > 0 && Math.abs(total - 1.0) > 0.01) {
    for (const key in weights) {
      (weights as Record<string, number>)[key] = Number(
        ((weights as Record<string, number>)[key] / total).toFixed(3),
      );
    }
  }

  return weights;
}
