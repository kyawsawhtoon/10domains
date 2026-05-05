import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { MemberStackParamList } from '../../navigation/types';
import { ChallengeSubmission, Profile } from '../../types/database.types';

type RouteProps = RouteProp<MemberStackParamList, 'GroupLeaderboard'>;

interface LeaderboardEntry {
  rank: number;
  profile: Profile;
  raw_score: number;
  submitted_at: string;
  isCurrentUser: boolean;
  isHidden: boolean;
}

export default function GroupLeaderboardScreen() {
  const { profile } = useAuth();
  const route = useRoute<RouteProps>();
  const { challengeId } = route.params;

  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [challengeName, setChallengeName] = useState('');
  const [visible, setVisible] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;

    const [{ data: ch }, { data: submissions }, { data: myProfile }] = await Promise.all([
      supabase.from('challenges').select('name').eq('id', challengeId).single(),
      supabase
        .from('challenge_submissions')
        .select('*, profiles(*)')
        .eq('challenge_id', challengeId)
        .order('raw_score', { ascending: false }),
      supabase.from('profiles').select('leaderboard_visible').eq('id', profile.id).single(),
    ]);

    if (ch) setChallengeName(ch.name);
    if (myProfile) setVisible(myProfile.leaderboard_visible);

    type SubmissionWithProfile = ChallengeSubmission & { profiles: Profile };
    const ranked: LeaderboardEntry[] = ((submissions as SubmissionWithProfile[]) ?? []).map(
      (s, i) => ({
        rank: i + 1,
        profile: s.profiles,
        raw_score: s.raw_score,
        submitted_at: s.submitted_at,
        isCurrentUser: s.user_id === profile.id,
        isHidden: !s.profiles.leaderboard_visible,
      }),
    );

    setEntries(ranked);
    setLoading(false);
  }, [profile, challengeId]);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function toggleVisibility(value: boolean) {
    setVisible(value);
    const { error } = await supabase
      .from('profiles')
      .update({ leaderboard_visible: value })
      .eq('id', profile!.id);
    if (error) {
      setVisible(!value);
      Alert.alert('Error', 'Could not update visibility.');
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
          <Text style={styles.heading}>{challengeName}</Text>
          <Text style={styles.subheading}>Leaderboard · {entries.length} athletes</Text>

          <View style={styles.visibilityRow}>
            <View>
              <Text style={styles.visibilityLabel}>Show me on leaderboard</Text>
              <Text style={styles.visibilityHint}>Toggle off to appear as "Anonymous"</Text>
            </View>
            <Switch
              value={visible}
              onValueChange={toggleVisibility}
              trackColor={{ true: '#22c55e', false: '#2a2a2a' }}
              thumbColor="#fff"
            />
          </View>
        </View>
      }
      renderItem={({ item: e }) => (
        <View style={[styles.row, e.isCurrentUser && styles.rowHighlight]}>
          <Text
            style={[
              styles.rank,
              e.rank === 1 && styles.rankGold,
              e.rank === 2 && styles.rankSilver,
              e.rank === 3 && styles.rankBronze,
            ]}
          >
            {e.rank}
          </Text>
          <View style={styles.nameBlock}>
            <Text style={styles.name}>
              {e.isHidden && !e.isCurrentUser ? 'Anonymous' : e.profile.display_name}
              {e.isCurrentUser ? '  (you)' : ''}
            </Text>
          </View>
          <Text style={styles.score}>{e.raw_score.toFixed(1)}</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: '#0a0a0a' },
  container: { paddingBottom: 48 },
  center: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' },
  header: { padding: 24, gap: 12 },
  heading: { fontSize: 24, fontWeight: '800', color: '#fff' },
  subheading: { color: '#555', fontSize: 14 },
  visibilityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 14,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#1e1e1e',
  },
  visibilityLabel: { color: '#fff', fontSize: 15, fontWeight: '600' },
  visibilityHint: { color: '#555', fontSize: 12, marginTop: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#111',
    gap: 12,
  },
  rowHighlight: { backgroundColor: '#0d1f0d' },
  rank: { width: 28, fontSize: 15, fontWeight: '700', color: '#555', textAlign: 'center' },
  rankGold: { color: '#f59e0b' },
  rankSilver: { color: '#9ca3af' },
  rankBronze: { color: '#92400e' },
  nameBlock: { flex: 1 },
  name: { color: '#fff', fontSize: 15 },
  score: { color: '#22c55e', fontSize: 16, fontWeight: '700' },
});
