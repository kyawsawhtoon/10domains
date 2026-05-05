import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  computeRawScore,
  computeContributions,
  saveChallengeSubmissionContributions,
} from '../../services/scoring';
import { Challenge, ChallengeExercise, DomainWeights } from '../../types/database.types';
import DomainMappingPreview from '../../components/DomainMappingPreview';
import { MemberStackParamList } from '../../navigation/types';

type RouteProps = RouteProp<MemberStackParamList, 'SubmitChallenge'>;
type Stage = 'input' | 'preview' | 'saving';

interface ExerciseResult {
  exerciseId: string;
  name: string;
  time_s: string;
  weight_kg: string;
  reps: string;
  distance_m: string;
}

export default function SubmitChallengeScreen() {
  const { profile } = useAuth();
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { challengeId } = route.params;

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [results, setResults] = useState<ExerciseResult[]>([]);
  const [notes, setNotes] = useState('');
  const [stage, setStage] = useState<Stage>('input');
  const [domainWeights, setDomainWeights] = useState<DomainWeights | null>(null);
  const [rawScore, setRawScore] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: ch }, { data: exs }] = await Promise.all([
        supabase.from('challenges').select('*').eq('id', challengeId).single(),
        supabase
          .from('challenge_exercises')
          .select('*')
          .eq('challenge_id', challengeId)
          .order('sort_order'),
      ]);
      if (ch) setChallenge(ch);
      if (exs) {
        setResults(
          exs.map((e: ChallengeExercise) => ({
            exerciseId: e.id,
            name: e.name,
            time_s: '',
            weight_kg: '',
            reps: '',
            distance_m: '',
          })),
        );
      }
      setLoading(false);
    }
    load();
  }, [challengeId]);

  function updateResult(
    index: number,
    field: keyof Omit<ExerciseResult, 'exerciseId' | 'name'>,
    value: string,
  ) {
    setResults((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  function handlePreview() {
    if (!challenge?.domain_weights) return;

    // Build exercise inputs from results for raw score computation
    const inputs = results.map((r) => ({
      name: r.name,
      reps: r.reps ? parseInt(r.reps) : undefined,
      weight_kg: r.weight_kg ? parseFloat(r.weight_kg) : undefined,
      distance_m: r.distance_m ? parseFloat(r.distance_m) : undefined,
      duration_s: r.time_s ? parseInt(r.time_s) : undefined,
    }));

    const score = computeRawScore(inputs);
    setRawScore(score);
    setDomainWeights(challenge.domain_weights);
    setStage('preview');
  }

  async function handleSubmit() {
    if (!profile || !domainWeights || !challenge) return;
    setStage('saving');

    try {
      const { data: submission, error: sErr } = await supabase
        .from('challenge_submissions')
        .insert({
          challenge_id: challengeId,
          user_id: profile.id,
          notes: notes.trim() || null,
          raw_score: rawScore,
        })
        .select()
        .single();
      if (sErr) throw sErr;

      // Save per-exercise results
      const exerciseRows = results.map((r) => ({
        submission_id: submission.id,
        exercise_id: r.exerciseId,
        time_s: r.time_s ? parseInt(r.time_s) : null,
        weight_kg: r.weight_kg ? parseFloat(r.weight_kg) : null,
        reps: r.reps ? parseInt(r.reps) : null,
        distance_m: r.distance_m ? parseFloat(r.distance_m) : null,
      }));
      await supabase.from('challenge_submission_exercises').insert(exerciseRows);

      // Persist contributions and recompute domain scores
      const contributions = computeContributions(rawScore, domainWeights);
      await saveChallengeSubmissionContributions(submission.id, profile.id, contributions);

      Alert.alert('Submitted!', 'Your results are in and your radar chart has been updated.', [
        { text: 'Done', onPress: () => navigation.goBack() },
      ]);
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Unknown error');
      setStage('preview');
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#22c55e" size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.heading}>{challenge?.name}</Text>
      {challenge?.description ? (
        <Text style={styles.description}>{challenge.description}</Text>
      ) : null}

      {stage === 'input' && (
        <>
          <Text style={styles.sectionLabel}>Your Results</Text>

          {results.map((r, i) => (
            <View key={r.exerciseId} style={styles.exerciseCard}>
              <Text style={styles.exerciseName}>{r.name}</Text>
              <View style={styles.metricsRow}>
                {[
                  { field: 'reps' as const, placeholder: 'reps' },
                  { field: 'weight_kg' as const, placeholder: 'kg' },
                  { field: 'time_s' as const, placeholder: 'sec' },
                  { field: 'distance_m' as const, placeholder: 'm' },
                ].map(({ field, placeholder }) => (
                  <TextInput
                    key={field}
                    style={styles.metricInput}
                    placeholder={placeholder}
                    placeholderTextColor="#444"
                    keyboardType="numeric"
                    value={r[field]}
                    onChangeText={(v) => updateResult(i, field, v)}
                  />
                ))}
              </View>
            </View>
          ))}

          <TextInput
            style={[styles.input, styles.notesInput]}
            placeholder="Notes (optional)"
            placeholderTextColor="#555"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />

          <TouchableOpacity style={styles.primaryButton} onPress={handlePreview}>
            <Text style={styles.primaryButtonText}>Preview Domain Impact →</Text>
          </TouchableOpacity>
        </>
      )}

      {(stage === 'preview' || stage === 'saving') && domainWeights && (
        <>
          <DomainMappingPreview weights={domainWeights} loading={false} rawScore={rawScore} />

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleSubmit}
            disabled={stage === 'saving'}
          >
            {stage === 'saving' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Confirm Submission</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={() => setStage('input')}>
            <Text style={styles.secondaryButtonText}>← Edit results</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#0a0a0a' },
  container: { padding: 24, paddingBottom: 60, gap: 14 },
  center: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' },
  heading: { fontSize: 26, fontWeight: '800', color: '#fff' },
  description: { color: '#666', fontSize: 14, lineHeight: 22 },
  sectionLabel: {
    color: '#555',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  exerciseCard: {
    backgroundColor: '#111',
    borderRadius: 14,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#1e1e1e',
  },
  exerciseName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  metricsRow: { flexDirection: 'row', gap: 8 },
  metricInput: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 10,
    color: '#fff',
    fontSize: 13,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#222',
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 14,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  notesInput: { height: 80, textAlignVertical: 'top' },
  primaryButton: {
    backgroundColor: '#22c55e',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  secondaryButton: { padding: 14, alignItems: 'center' },
  secondaryButtonText: { color: '#555', fontSize: 15 },
});
