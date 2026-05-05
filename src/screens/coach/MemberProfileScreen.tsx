import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { CoachStackParamList } from '../../navigation/types';
import { Profile, DomainScores, Challenge, ChallengeSubmission } from '../../types/database.types';
import RadarChart from '../../components/charts/RadarChart';
import { fetchDomainScores } from '../../services/scoring';

type RouteProps = RouteProp<CoachStackParamList, 'MemberProfile'>;

interface ParticipationRecord {
  challenge: Challenge;
  submission: ChallengeSubmission | null;
}

export default function MemberProfileScreen() {
  const route = useRoute<RouteProps>();
  const { memberId } = route.params;

  const [member, setMember] = useState<Profile | null>(null);
  const [scores, setScores] = useState<DomainScores | null>(null);
  const [participation, setParticipation] = useState<ParticipationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [{ data: memberData }, domainScores] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', memberId).single(),
      fetchDomainScores(memberId),
    ]);

    if (memberData) setMember(memberData);
    setScores(domainScores);

    // Get challenges the member's group has, and check submissions
    const { data: memberships } = await supabase
      .from('group_memberships')
      .select('group_id')
      .eq('member_id', memberId);

    if (memberships?.length) {
      const groupIds = memberships.map((m: { group_id: string }) => m.group_id);
      const { data: challenges } = await supabase
        .from('challenges')
        .select('*')
        .in('group_id', groupIds)
        .eq('is_published', true)
        .order('start_date', { ascending: false })
        .limit(20);

      if (challenges?.length) {
        const { data: submissions } = await supabase
          .from('challenge_submissions')
          .select('*')
          .eq('user_id', memberId)
          .in(
            'challenge_id',
            challenges.map((c: Challenge) => c.id),
          );

        const submissionMap = new Map(
          (submissions ?? []).map((s: ChallengeSubmission) => [s.challenge_id, s]),
        );

        setParticipation(
          challenges.map((c: Challenge) => ({
            challenge: c,
            submission: submissionMap.get(c.id) ?? null,
          })),
        );
      }
    }

    setLoading(false);
  }, [memberId]);

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

  const submitted = participation.filter((p) => p.submission).length;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22c55e" />
      }
    >
      <Text style={styles.heading}>{member?.display_name}</Text>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{submitted}</Text>
          <Text style={styles.statLabel}>Submissions</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{participation.length}</Text>
          <Text style={styles.statLabel}>Challenges</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>
            {scores ? (Object.values(scores).reduce((a, b) => a + b, 0) / 10).toFixed(1) : '—'}
          </Text>
          <Text style={styles.statLabel}>Avg Score</Text>
        </View>
      </View>

      <View style={styles.chartCard}>
        <Text style={styles.sectionLabel}>Fitness Radar</Text>
        <RadarChart scores={scores ?? {}} size={260} />
      </View>

      <Text style={styles.sectionLabel}>Challenge Participation</Text>

      {participation.length === 0 && <Text style={styles.empty}>No challenges yet.</Text>}

      {participation.map(({ challenge: c, submission: s }) => (
        <View key={c.id} style={styles.row}>
          <View style={styles.rowLeft}>
            <Text style={styles.rowTitle}>{c.name}</Text>
            <Text style={styles.rowDate}>
              {c.start_date} → {c.end_date}
            </Text>
          </View>
          {s ? (
            <View style={styles.rowRight}>
              <Text style={styles.rowScore}>{s.raw_score.toFixed(1)}</Text>
              <Text style={styles.rowScoreLabel}>score</Text>
            </View>
          ) : (
            <Text style={styles.pending}>Pending</Text>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#0a0a0a' },
  container: { padding: 24, paddingBottom: 48, gap: 16 },
  center: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' },
  heading: { fontSize: 28, fontWeight: '800', color: '#fff' },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    backgroundColor: '#111',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e1e1e',
  },
  statNum: { fontSize: 26, fontWeight: '800', color: '#22c55e' },
  statLabel: { color: '#555', fontSize: 11, marginTop: 2, textAlign: 'center' },
  chartCard: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1e1e1e',
    alignItems: 'center',
    gap: 12,
  },
  sectionLabel: {
    color: '#555',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  empty: { color: '#333', fontSize: 14, textAlign: 'center', paddingVertical: 16 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e1e1e',
  },
  rowLeft: { gap: 2, flex: 1 },
  rowTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },
  rowDate: { color: '#555', fontSize: 12 },
  rowRight: { alignItems: 'flex-end' },
  rowScore: { color: '#22c55e', fontSize: 20, fontWeight: '800' },
  rowScoreLabel: { color: '#555', fontSize: 11 },
  pending: { color: '#444', fontSize: 14 },
});
