import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { fetchDomainScores } from '../../services/scoring';
import { DomainScores, ALL_DOMAINS } from '../../types/database.types';
import RadarChart from '../../components/charts/RadarChart';
import { MemberStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<MemberStackParamList>;

export default function HomeScreen() {
  const { profile, signOut } = useAuth();
  const navigation = useNavigation<Nav>();
  const [scores, setScores] = useState<DomainScores | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const s = await fetchDomainScores(profile.id);
    setScores(s);
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const overallScore = scores
    ? ALL_DOMAINS.reduce((sum, d) => sum + scores[d], 0) / ALL_DOMAINS.length
    : null;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22c55e" />
      }
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hey, {profile?.display_name}</Text>
          <Text style={styles.subGreeting}>Your fitness radar</Text>
        </View>
        <TouchableOpacity onPress={signOut}>
          <Text style={styles.signOut}>Sign out</Text>
        </TouchableOpacity>
      </View>

      {overallScore != null && (
        <View style={styles.scoreCard}>
          <Text style={styles.overallLabel}>Overall Score</Text>
          <Text style={styles.overallScore}>{overallScore.toFixed(1)}</Text>
          <Text style={styles.overallMax}>/10</Text>
        </View>
      )}

      <View style={styles.chartContainer}>
        <RadarChart
          scores={scores ?? {}}
          size={280}
          onDomainPress={(domain) => navigation.navigate('DomainDetail', { domain })}
        />
      </View>

      <TouchableOpacity style={styles.logButton} onPress={() => navigation.navigate('LogWorkout')}>
        <Text style={styles.logButtonText}>+ Log Personal Workout</Text>
      </TouchableOpacity>

      <View style={styles.secondaryRow}>
        <TouchableOpacity
          style={[styles.secondaryButton, { flex: 1 }]}
          onPress={() => navigation.navigate('ActiveChallenges')}
        >
          <Text style={styles.secondaryButtonText}>Challenges</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.secondaryButton, { flex: 1 }]}
          onPress={() => navigation.navigate('WorkoutHistory')}
        >
          <Text style={styles.secondaryButtonText}>History</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#0a0a0a' },
  container: { padding: 24, paddingBottom: 48 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  greeting: { fontSize: 26, fontWeight: '800', color: '#fff' },
  subGreeting: { fontSize: 14, color: '#555', marginTop: 2 },
  signOut: { color: '#555', fontSize: 14 },
  scoreCard: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 24, gap: 4 },
  overallLabel: { color: '#555', fontSize: 14, marginBottom: 4, marginRight: 8 },
  overallScore: { fontSize: 48, fontWeight: '800', color: '#22c55e' },
  overallMax: { fontSize: 20, color: '#555', marginBottom: 8 },
  chartContainer: { alignItems: 'center', marginBottom: 32 },
  logButton: {
    backgroundColor: '#22c55e',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    marginBottom: 12,
  },
  logButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  secondaryRow: { flexDirection: 'row', gap: 10 },
  secondaryButton: {
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  secondaryButtonText: { color: '#888', fontSize: 16 },
});
