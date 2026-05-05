import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, ActivityIndicator } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  PersonalWorkout,
  ChallengeSubmission,
  Challenge,
  DomainKey,
  DOMAIN_LABELS,
} from '../../types/database.types';

interface HistoryEntry {
  id: string;
  type: 'workout' | 'challenge';
  title: string;
  date: string;
  rawScore: number;
  topDomains: Array<{ domain: DomainKey; weight: number }>;
}

export default function WorkoutHistoryScreen() {
  const { profile } = useAuth();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;

    const [{ data: workouts }, { data: submissions }] = await Promise.all([
      supabase
        .from('personal_workouts')
        .select('*')
        .eq('user_id', profile.id)
        .order('logged_at', { ascending: false })
        .limit(50),
      supabase
        .from('challenge_submissions')
        .select('*, challenges(name)')
        .eq('user_id', profile.id)
        .order('submitted_at', { ascending: false })
        .limit(50),
    ]);

    const workoutEntries: HistoryEntry[] = (workouts ?? []).map((w: PersonalWorkout) => ({
      id: w.id,
      type: 'workout',
      title: w.name ?? 'Personal Workout',
      date: w.logged_at,
      rawScore: w.raw_score,
      topDomains: Object.entries(w.domain_weights ?? {})
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 3)
        .map(([domain, weight]) => ({ domain: domain as DomainKey, weight: weight as number })),
    }));

    type SubmissionWithChallenge = ChallengeSubmission & { challenges: Pick<Challenge, 'name'> };
    const submissionEntries: HistoryEntry[] = (submissions ?? []).map(
      (s: SubmissionWithChallenge) => ({
        id: s.id,
        type: 'challenge',
        title: s.challenges?.name ?? 'Challenge',
        date: s.submitted_at,
        rawScore: s.raw_score,
        topDomains: [],
      }),
    );

    const all = [...workoutEntries, ...submissionEntries].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    setEntries(all);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#22c55e" size="large" />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.container}
      data={entries}
      keyExtractor={(e) => e.id}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22c55e" />
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No history yet</Text>
          <Text style={styles.emptySubtitle}>Log a workout to see it here.</Text>
        </View>
      }
      renderItem={({ item: e }) => (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.typeBadge, e.type === 'challenge' && styles.typeBadgeChallenge]}>
              <Text style={styles.typeBadgeText}>
                {e.type === 'workout' ? 'Workout' : 'Challenge'}
              </Text>
            </View>
            <Text style={styles.date}>
              {new Date(e.date).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </Text>
          </View>

          <Text style={styles.title}>{e.title}</Text>

          <View style={styles.footer}>
            <View style={styles.domains}>
              {e.topDomains.map((d) => (
                <View key={d.domain} style={styles.domainTag}>
                  <Text style={styles.domainTagText}>{DOMAIN_LABELS[d.domain].split(' ')[0]}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.score}>{e.rawScore.toFixed(1)}</Text>
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: '#0a0a0a' },
  container: { padding: 20, gap: 10, paddingBottom: 48 },
  center: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 8 },
  emptySubtitle: { color: '#555', fontSize: 15 },
  card: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 18,
    gap: 10,
    borderWidth: 1,
    borderColor: '#1e1e1e',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  typeBadge: {
    backgroundColor: '#1a2e1a',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  typeBadgeChallenge: { backgroundColor: '#1a1a2e' },
  typeBadgeText: { color: '#22c55e', fontSize: 11, fontWeight: '700' },
  date: { color: '#555', fontSize: 13 },
  title: { color: '#fff', fontSize: 16, fontWeight: '600' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  domains: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', flex: 1 },
  domainTag: {
    backgroundColor: '#1e1e1e',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  domainTagText: { color: '#888', fontSize: 11 },
  score: { color: '#22c55e', fontSize: 18, fontWeight: '800' },
});
