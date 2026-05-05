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
import { supabase } from '../../lib/supabase';
import { mapWorkoutToDomains } from '../../lib/claude';
import { ExerciseInput, DomainWeights } from '../../types/database.types';
import DomainMappingPreview from '../../components/DomainMappingPreview';

type Stage = 'build' | 'preview' | 'saving';

export default function CreateChallengeScreen() {
  const { profile } = useAuth();
  const navigation = useNavigation();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [exercises, setExercises] = useState<ExerciseInput[]>([{ name: '' }]);

  const [stage, setStage] = useState<Stage>('build');
  const [mappingLoading, setMappingLoading] = useState(false);
  const [domainWeights, setDomainWeights] = useState<DomainWeights | null>(null);

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
    if (!name.trim()) {
      Alert.alert('Missing name', 'Add a challenge name.');
      return;
    }
    if (valid.length === 0) {
      Alert.alert('Add exercises', 'Enter at least one exercise.');
      return;
    }

    setMappingLoading(true);
    try {
      const weights = await mapWorkoutToDomains(valid);
      setDomainWeights(weights);
      setStage('preview');
    } catch (e: unknown) {
      Alert.alert('AI mapping failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setMappingLoading(false);
    }
  }

  async function handlePublish(publish: boolean) {
    if (!profile || !domainWeights) return;
    setStage('saving');

    try {
      // Get coach's group
      const { data: group, error: gErr } = await supabase
        .from('groups')
        .select('id')
        .eq('coach_id', profile.id)
        .single();
      if (gErr) throw gErr;

      const { data: challenge, error: cErr } = await supabase
        .from('challenges')
        .insert({
          group_id: group.id,
          coach_id: profile.id,
          name: name.trim(),
          description: description.trim() || null,
          start_date: startDate || new Date().toISOString().split('T')[0],
          end_date: endDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
          domain_weights: domainWeights,
          is_published: publish,
        })
        .select()
        .single();
      if (cErr) throw cErr;

      const valid = exercises.filter((e) => e.name.trim());
      const exerciseRows = valid.map((e, i) => ({
        challenge_id: challenge.id,
        ...e,
        sort_order: i,
      }));
      await supabase.from('challenge_exercises').insert(exerciseRows);

      Alert.alert(
        publish ? 'Challenge live!' : 'Draft saved',
        publish ? 'Athletes can now see and submit this challenge.' : 'Saved as draft.',
        [{ text: 'Done', onPress: () => navigation.goBack() }],
      );
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Unknown error');
      setStage('preview');
    }
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.heading}>New Challenge</Text>

      <TextInput
        style={styles.input}
        placeholder="Challenge name"
        placeholderTextColor="#555"
        value={name}
        onChangeText={setName}
      />
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Description (optional)"
        placeholderTextColor="#555"
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={3}
      />

      <View style={styles.dateRow}>
        <TextInput
          style={[styles.input, styles.dateInput]}
          placeholder="Start (YYYY-MM-DD)"
          placeholderTextColor="#555"
          value={startDate}
          onChangeText={setStartDate}
        />
        <TextInput
          style={[styles.input, styles.dateInput]}
          placeholder="End (YYYY-MM-DD)"
          placeholderTextColor="#555"
          value={endDate}
          onChangeText={setEndDate}
        />
      </View>

      <Text style={styles.sectionLabel}>Workout</Text>

      {exercises.map((ex, i) => (
        <View key={i} style={styles.exerciseCard}>
          <View style={styles.exerciseHeader}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
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
          <DomainMappingPreview weights={domainWeights} loading={false} />

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => handlePublish(true)}
            disabled={stage === 'saving'}
          >
            {stage === 'saving' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Publish Challenge</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.draftButton}
            onPress={() => handlePublish(false)}
            disabled={stage === 'saving'}
          >
            <Text style={styles.draftButtonText}>Save as Draft</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={() => setStage('build')}>
            <Text style={styles.secondaryButtonText}>← Edit</Text>
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
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 14,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  textArea: { height: 80, textAlignVertical: 'top' },
  dateRow: { flexDirection: 'row', gap: 10 },
  dateInput: { flex: 1 },
  sectionLabel: {
    color: '#555',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 8,
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
  removeText: { color: '#555', fontSize: 18, padding: 4 },
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
  draftButton: {
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  draftButtonText: { color: '#aaa', fontSize: 17 },
  secondaryButton: { padding: 14, alignItems: 'center' },
  secondaryButtonText: { color: '#555', fontSize: 15 },
});
