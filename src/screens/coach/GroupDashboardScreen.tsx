import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Group, Challenge, GroupMembership, Profile } from '../../types/database.types';
import { CoachStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<CoachStackParamList>;

export default function GroupDashboardScreen() {
  const { profile, signOut } = useAuth();
  const navigation = useNavigation<Nav>();

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;

    const { data: groupData } = await supabase
      .from('groups')
      .select('*')
      .eq('coach_id', profile.id)
      .limit(1)
      .single();

    if (!groupData) {
      setGroup(null);
      return;
    }
    setGroup(groupData);

    const [{ data: membershipData }, { data: challengeData }] = await Promise.all([
      supabase.from('group_memberships').select('*, profiles(*)').eq('group_id', groupData.id),
      supabase
        .from('challenges')
        .select('*')
        .eq('group_id', groupData.id)
        .order('created_at', { ascending: false }),
    ]);

    setMembers(
      (membershipData as unknown as Array<GroupMembership & { profiles: Profile }>)?.map(
        (m) => m.profiles,
      ) ?? [],
    );
    setChallenges(challengeData ?? []);
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function createGroup() {
    if (!groupName.trim() || !profile) return;
    setCreating(true);
    try {
      const { error } = await supabase.from('groups').insert({
        coach_id: profile.id,
        name: groupName.trim(),
      });
      if (error) throw error;
      setShowCreateGroup(false);
      setGroupName('');
      await load();
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setCreating(false);
    }
  }

  if (!group) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>Create your group</Text>
        <Text style={styles.emptySubtitle}>Athletes join using your invite code.</Text>
        <TouchableOpacity style={styles.createButton} onPress={() => setShowCreateGroup(true)}>
          <Text style={styles.createButtonText}>Create Group</Text>
        </TouchableOpacity>

        <Modal visible={showCreateGroup} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Group name</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. CrossFit Box Thursday"
                placeholderTextColor="#555"
                value={groupName}
                onChangeText={setGroupName}
                autoFocus
              />
              <TouchableOpacity
                style={styles.createButton}
                onPress={createGroup}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.createButtonText}>Create</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowCreateGroup(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <TouchableOpacity onPress={signOut} style={{ marginTop: 32 }}>
          <Text style={styles.signOut}>Sign out</Text>
        </TouchableOpacity>
      </View>
    );
  }

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
          <Text style={styles.groupName}>{group.name}</Text>
          <Text style={styles.inviteCode}>
            Invite code: <Text style={styles.code}>{group.invite_code}</Text>
          </Text>
        </View>
        <TouchableOpacity onPress={signOut}>
          <Text style={styles.signOut}>Sign out</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{members.length}</Text>
          <Text style={styles.statLabel}>Athletes</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{challenges.filter((c) => c.is_published).length}</Text>
          <Text style={styles.statLabel}>Active Challenges</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.newChallengeButton}
        onPress={() => navigation.navigate('CreateChallenge')}
      >
        <Text style={styles.newChallengeText}>+ New Challenge</Text>
      </TouchableOpacity>

      <Text style={styles.sectionLabel}>Recent Challenges</Text>
      {challenges.length === 0 && <Text style={styles.empty}>No challenges yet.</Text>}
      {challenges.map((c) => (
        <TouchableOpacity
          key={c.id}
          style={styles.challengeRow}
          onPress={() => navigation.navigate('ChallengeResults', { challengeId: c.id })}
        >
          <View>
            <Text style={styles.challengeName}>{c.name}</Text>
            <Text style={styles.challengeDates}>
              {c.start_date} → {c.end_date}
            </Text>
          </View>
          <Text style={c.is_published ? styles.published : styles.draft}>
            {c.is_published ? 'Live' : 'Draft'}
          </Text>
        </TouchableOpacity>
      ))}

      <Text style={styles.sectionLabel}>Athletes</Text>
      {members.length === 0 && (
        <Text style={styles.empty}>Share the invite code to add athletes.</Text>
      )}
      {members.map((m) => (
        <TouchableOpacity
          key={m.id}
          style={styles.memberRow}
          onPress={() => navigation.navigate('MemberProfile', { memberId: m.id })}
        >
          <Text style={styles.memberName}>{m.display_name}</Text>
          <Text style={styles.arrow}>→</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#0a0a0a' },
  container: { padding: 24, paddingBottom: 48, gap: 12 },
  emptyContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: { fontSize: 26, fontWeight: '800', color: '#fff', marginBottom: 8 },
  emptySubtitle: { color: '#555', fontSize: 15, marginBottom: 32, textAlign: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  groupName: { fontSize: 24, fontWeight: '800', color: '#fff' },
  inviteCode: { color: '#555', fontSize: 14, marginTop: 4 },
  code: { color: '#22c55e', fontWeight: '700', letterSpacing: 2 },
  signOut: { color: '#555', fontSize: 14 },
  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: {
    flex: 1,
    backgroundColor: '#111',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e1e1e',
  },
  statNumber: { fontSize: 32, fontWeight: '800', color: '#22c55e' },
  statLabel: { color: '#555', fontSize: 13, marginTop: 4 },
  newChallengeButton: {
    backgroundColor: '#22c55e',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
  },
  newChallengeText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  sectionLabel: {
    color: '#555',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 8,
  },
  empty: { color: '#333', fontSize: 14, textAlign: 'center', paddingVertical: 16 },
  challengeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e1e1e',
  },
  challengeName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  challengeDates: { color: '#555', fontSize: 12, marginTop: 2 },
  published: { color: '#22c55e', fontSize: 12, fontWeight: '700' },
  draft: { color: '#555', fontSize: 12 },
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e1e1e',
  },
  memberName: { color: '#fff', fontSize: 15 },
  arrow: { color: '#333', fontSize: 16 },
  createButton: {
    backgroundColor: '#22c55e',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    width: '100%',
  },
  createButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  cancelText: { color: '#555', textAlign: 'center', marginTop: 16, fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#111',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 32,
    gap: 16,
  },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  modalInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
});
