import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Challenge, GroupMembership } from '../../types/database.types';
import { MemberStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<MemberStackParamList>;

interface ChallengeWithSubmission extends Challenge {
  hasSubmitted: boolean;
}

export default function ActiveChallengesScreen() {
  const { profile } = useAuth();
  const navigation = useNavigation<Nav>();
  const [challenges, setChallenges] = useState<ChallengeWithSubmission[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;

    // Get groups the member belongs to
    const { data: memberships } = await supabase
      .from('group_memberships')
      .select('group_id')
      .eq('member_id', profile.id);

    if (!memberships?.length) {
      setChallenges([]);
      return;
    }

    const groupIds = (memberships as Pick<GroupMembership, 'group_id'>[]).map((m) => m.group_id);

    // Get published challenges for those groups
    const { data: challengeData } = await supabase
      .from('challenges')
      .select('*')
      .in('group_id', groupIds)
      .eq('is_published', true)
      .order('end_date', { ascending: true });

    if (!challengeData?.length) {
      setChallenges([]);
      return;
    }

    // Check which ones the member already submitted
    const { data: submissions } = await supabase
      .from('challenge_submissions')
      .select('challenge_id')
      .eq('user_id', profile.id)
      .in(
        'challenge_id',
        challengeData.map((c) => c.id),
      );

    const submittedIds = new Set(
      (submissions ?? []).map((s: { challenge_id: string }) => s.challenge_id),
    );

    setChallenges(challengeData.map((c) => ({ ...c, hasSubmitted: submittedIds.has(c.id) })));
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const today = new Date().toISOString().split('T')[0];

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.container}
      data={challenges}
      keyExtractor={(c) => c.id}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22c55e" />
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No active challenges</Text>
          <Text style={styles.emptySubtitle}>Your coach hasn't posted any yet.</Text>
        </View>
      }
      renderItem={({ item: c }) => {
        const isExpired = c.end_date < today;
        return (
          <TouchableOpacity
            style={[styles.card, c.hasSubmitted && styles.cardDone]}
            onPress={() =>
              !c.hasSubmitted &&
              !isExpired &&
              navigation.navigate('SubmitChallenge', { challengeId: c.id })
            }
            disabled={c.hasSubmitted || isExpired}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.challengeName}>{c.name}</Text>
              {c.hasSubmitted && <Text style={styles.badge}>✓ Done</Text>}
              {!c.hasSubmitted && isExpired && <Text style={styles.badgeExpired}>Expired</Text>}
            </View>
            {c.description ? <Text style={styles.description}>{c.description}</Text> : null}
            <View style={styles.dates}>
              <Text style={styles.dateText}>{c.start_date}</Text>
              <Text style={styles.dateSep}>→</Text>
              <Text style={styles.dateText}>{c.end_date}</Text>
            </View>
            {!c.hasSubmitted && !isExpired && <Text style={styles.cta}>Submit results →</Text>}
          </TouchableOpacity>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: '#0a0a0a' },
  container: { padding: 20, gap: 12, paddingBottom: 48 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 8 },
  emptySubtitle: { color: '#555', fontSize: 15 },
  card: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1e1e1e',
    gap: 8,
  },
  cardDone: { opacity: 0.55 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  challengeName: { color: '#fff', fontSize: 17, fontWeight: '700', flex: 1 },
  badge: { color: '#22c55e', fontSize: 13, fontWeight: '700' },
  badgeExpired: { color: '#555', fontSize: 13 },
  description: { color: '#777', fontSize: 14, lineHeight: 20 },
  dates: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dateText: { color: '#555', fontSize: 13 },
  dateSep: { color: '#333', fontSize: 13 },
  cta: { color: '#22c55e', fontSize: 14, fontWeight: '600', marginTop: 4 },
});
