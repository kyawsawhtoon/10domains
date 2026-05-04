import React, { useState } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { mapWorkoutToDomains } from '../../lib/claude';
import {
  computeRawScore,
  computeContributions,
  savePersonalWorkoutContributions,
} from '../../services/scoring';
import { supabase } from '../../lib/supabase';
import { ExerciseInput, DomainWeights } from '../../types/database.types';
import DomainMappingPreview from '../../components/DomainMappingPreview';

type Stage = 'build' | 'preview' | 'saving';

export default function LogWorkoutScreen() {
  const { profile } = useAuth();
  const navigation = useNavigation();

  const [workoutName, setWorkoutName] = useState('');
  const [exercises, setExercises] = useState<ExerciseInput[]>([{ name: '' }]);
  const [stage, setStage] = useState<Stage>('build');
  const [mappingLoading, setMappingLoading] = useState(false);
  const [domainWeights, setDomainWeights] = useState<DomainWeights | null>(null);
  const [rawScore, setRawScore] = useState(0);

  function addExercise() {
    setExercises((prev) => [...prev, { name: '' }]);
  }

  function updateExercise(index: number, field: keyof ExerciseInput, value: string) {
    setExercises((prev) => {
      const updated = [...prev];
      if (field === 'name') {
        updated[index] = { ...updated[index], name: value };
      } else {
        const num = parseFloat(value);
        updated[index] = { ...updated[index], [field]: isNaN(num) ? undefined : num };
      }
      return updated;
    });
  }

  function removeExercise(index: number) {
    setExercises((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleMapDomains() {
    const valid = exercises.filter((e) => e.name.trim());
    if (valid.length === 0) {
      Alert.alert('Add exercises', 'Enter at least one exercise before mapping.');
      return;
    }
    setMappingLoading(true);
    try {
      const weights = await mapWorkoutToDomains(valid);
      const score = computeRawScore(valid);
      setDomainWeights(weights);
      setRawScore(score);
      setStage('preview');
    } catch (e: unknown) {
      Alert.alert('AI mapping failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setMappingLoading(false);
    }
  }

  async function handleConfirm() {
    if (!profile || !domainWeights) return;
    setStage('saving');
    try {
      const valid = exercises.filter((e) => e.name.trim());

      // Save workout
      const { data: workout, error: wErr } = await supabase
        .from('personal_workouts')
        .insert({
          user_id: profile.id,
          name: workoutName.trim() || null,
          domain_weights: domainWeights,
          raw_score: rawScore,
        })
        .select()
        .single();
      if (wErr) throw wErr;

      // Save exercises
      const exerciseRows = valid.map((e, i) => ({
        workout_id: workout.id,
        ...e,
        sort_order: i,
      }));
      await supabase.from('personal_workout_exercises').insert(exerciseRows);

      // Save contributions and recompute scores
      const contributions = computeContributions(rawScore, domainWeights);
      await savePersonalWorkoutContributions(workout.id, profile.id, contributions);

      Alert.alert('Workout saved!', 'Your radar chart has been updated.', [
        { text: 'Done', onPress: () => navigation.goBack() },
      ]);
    } catch (e: unknown) {
      Alert.alert('Save failed', e instanceof Error ? e.message : 'Unknown error');
      setStage('preview');
    }
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.heading}>Log Workout</Text>

      <TextInput
        style={styles.nameInput}
        placeholder="Workout name (optional)"
        placeholderTextColor="#555"
        value={workoutName}
        onChangeText={setWorkoutName}
      />

      <Text style={styles.sectionLabel}>Exercises</Text>

      {exercises.map((ex, i) => (
        <View key={i} style={styles.exerciseCard}>
          <View style={styles.exerciseHeader}>
            <TextInput
              style={[styles.input, styles.exerciseNameInput]}
              placeholder="Exercise name"
              placeholderTextColor="#555"
              value={ex.name}
              onChangeText={(v) => updateExercise(i, 'name', v)}
            />
            {exercises.length > 1 && (
              <TouchableOpacity onPress={() => removeExercise(i)}>
                <Text style={styles.removeText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.metricsRow}>
            {(['sets', 'reps', 'weight_kg', 'distance_m', 'duration_s'] as const).map((field) => (
              <TextInput
                key={field}
                style={styles.metricInput}
                placeholder={
                  field === 'weight_kg'
                    ? 'kg'
                    : field === 'distance_m'
                      ? 'm'
                      : field === 'duration_s'
                        ? 'sec'
                        : field
                }
                placeholderTextColor="#444"
                keyboardType="numeric"
                value={ex[field]?.toString() ?? ''}
                onChangeText={(v) => updateExercise(i, field, v)}
              />
            ))}
          </View>
        </View>
      ))}

      <TouchableOpacity style={styles.addButton} onPress={addExercise}>
        <Text style={styles.addButtonText}>+ Add Exercise</Text>
      </TouchableOpacity>

      {stage === 'build' && (
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleMapDomains}
          disabled={mappingLoading}
        >
          {mappingLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>Map Domains with AI →</Text>
          )}
        </TouchableOpacity>
      )}

      {(stage === 'preview' || stage === 'saving') && domainWeights && (
        <>
          <DomainMappingPreview weights={domainWeights} loading={false} rawScore={rawScore} />

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleConfirm}
            disabled={stage === 'saving'}
          >
            {stage === 'saving' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Confirm & Save</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={() => setStage('build')}>
            <Text style={styles.secondaryButtonText}>← Edit workout</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#0a0a0a' },
  container: { padding: 24, paddingBottom: 60, gap: 12 },
  heading: { fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 8 },
  nameInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 14,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  sectionLabel: {
    color: '#555',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  exerciseCard: {
    backgroundColor: '#111',
    borderRadius: 14,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: '#1e1e1e',
  },
  exerciseHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  exerciseNameInput: { flex: 1 },
  removeText: { color: '#555', fontSize: 18, padding: 4 },
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 12,
    color: '#fff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  metricsRow: { flexDirection: 'row', gap: 6 },
  metricInput: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 8,
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#222',
  },
  addButton: {
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderStyle: 'dashed',
  },
  addButtonText: { color: '#555', fontSize: 15 },
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
