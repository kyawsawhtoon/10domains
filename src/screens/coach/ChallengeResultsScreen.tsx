import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, ActivityIndicator } from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { CoachStackParamList } from '../../navigation/types';
import { Challenge, ChallengeSubmission, Profile } from '../../types/database.types';

type RouteProps = RouteProp<CoachStackParamList, 'ChallengeResults'>;

interface ResultEntry {
  profile: Profile;
  submission: ChallengeSubmission | null;
}

export default function ChallengeResultsScreen() {
  const route = useRoute<RouteProps>();
  const { challengeId } = route.params;

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [entries, setEntries] = useState<ResultEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data: ch } = await supabase
      .from('challenges')
      .select('*')
      .eq('id', challengeId)
      .single();
    if (!ch) return;
    setChallenge(ch);

    // Get all members in the group
    const { data: memberships } = await supabase
      .from('group_memberships')
      .select('*, profiles(*)')
      .eq('group_id', ch.group_id);

    // Get all submissions for this challenge
    const { data: submissions } = await supabase
      .from('challenge_submissions')
      .select('*')
      .eq('challenge_id', challengeId);

    type MembershipWithProfile = { profiles: Profile };
    const submissionMap = new Map(
      (submissions ?? []).map((s: ChallengeSubmission) => [s.user_id, s]),
    );

    const ranked: ResultEntry[] = ((memberships as unknown as MembershipWithProfile[]) ?? [])
      .map((m) => ({
        profile: m.profiles,
        submission: submissionMap.get(m.profiles.id) ?? null,
      }))
      .sort((a, b) => (b.submission?.raw_score ?? -1) - (a.submission?.raw_score ?? -1));

    setEntries(ranked);
    setLoading(false);
  }, [challengeId]);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const submitted = entries.filter((e) => e.submission).length;

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
      keyExtractor={(e) => e.profile.id}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22c55e" />
      }
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.heading}>{challenge?.name}</Text>
          <Text style={styles.subheading}>
            {submitted}/{entries.length} athletes submitted
          </Text>

          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${entries.length ? (submitted / entries.length) * 100 : 0}%` },
              ]}
            />
          </View>
        </View>
      }
      renderItem={({ item: e, index }) => (
        <View style={styles.row}>
          <View style={styles.rankBadge}>
            {e.submission ? (
              <Text style={styles.rankText}>{index + 1}</Text>
            ) : (
              <Text style={styles.pendingDot}>–</Text>
            )}
          </View>
          <View style={styles.nameBlock}>
            <Text style={styles.name}>{e.profile.display_name}</Text>
            {e.submission && (
              <Text style={styles.submittedAt}>
                {new Date(e.submission.submitted_at).toLocaleDateString()}
              </Text>
            )}
          </View>
          {e.submission ? (
            <Text style={styles.score}>{e.submission.raw_score.toFixed(1)}</Text>
          ) : (
            <Text style={styles.pending}>Pending</Text>
          )}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: '#0a0a0a' },
  container: { paddingBottom: 48 },
  center: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' },
  header: { padding: 24, gap: 10 },
  heading: { fontSize: 24, fontWeight: '800', color: '#fff' },
  subheading: { color: '#555', fontSize: 14 },
  progressTrack: { height: 4, backgroundColor: '#1e1e1e', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#22c55e', borderRadius: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#111',
    gap: 12,
  },
  rankBadge: { width: 28, alignItems: 'center' },
  rankText: { color: '#22c55e', fontSize: 15, fontWeight: '700' },
  pendingDot: { color: '#333', fontSize: 18 },
  nameBlock: { flex: 1 },
  name: { color: '#fff', fontSize: 15 },
  submittedAt: { color: '#555', fontSize: 12, marginTop: 2 },
  score: { color: '#22c55e', fontSize: 16, fontWeight: '700' },
  pending: { color: '#444', fontSize: 14 },
});
