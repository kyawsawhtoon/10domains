import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import Svg, { Polyline, Line, Circle, Text as SvgText } from 'react-native-svg';
import { useRoute, RouteProp } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { MemberStackParamList } from '../../navigation/types';
import { DomainKey, DOMAIN_LABELS, WorkoutContribution } from '../../types/database.types';
import { DECAY_LAMBDA } from '../../services/scoring';

type RouteProps = RouteProp<MemberStackParamList, 'DomainDetail'>;

interface ContributionWithDate extends WorkoutContribution {
  displayDate: string;
  decayedScore: number;
}

function TrendLine({
  points,
  width = 320,
  height = 120,
}: {
  points: number[];
  width?: number;
  height?: number;
}) {
  if (points.length < 2) return null;

  const max = Math.max(...points, 0.1);
  const padX = 24;
  const padY = 12;
  const chartW = width - padX * 2;
  const chartH = height - padY * 2;

  const coords = points.map((v, i) => {
    const x = padX + (i / (points.length - 1)) * chartW;
    const y = padY + chartH - (v / max) * chartH;
    return `${x},${y}`;
  });

  const lastX = padX + chartW;
  const lastY = padY + chartH - (points[points.length - 1] / max) * chartH;

  return (
    <Svg width={width} height={height}>
      {/* Baseline */}
      <Line
        x1={padX}
        y1={padY + chartH}
        x2={lastX}
        y2={padY + chartH}
        stroke="#1e1e1e"
        strokeWidth={1}
      />
      {/* Trend line */}
      <Polyline points={coords.join(' ')} fill="none" stroke="#22c55e" strokeWidth={2} />
      {/* Last point dot */}
      <Circle cx={lastX} cy={lastY} r={4} fill="#22c55e" />
      {/* Y labels */}
      <SvgText x={padX - 4} y={padY + 4} fontSize={9} fill="#555" textAnchor="end">
        {max.toFixed(1)}
      </SvgText>
      <SvgText x={padX - 4} y={padY + chartH + 4} fontSize={9} fill="#555" textAnchor="end">
        0
      </SvgText>
    </Svg>
  );
}

export default function DomainDetailScreen() {
  const { profile } = useAuth();
  const route = useRoute<RouteProps>();
  const domain = route.params.domain as DomainKey;

  const [contributions, setContributions] = useState<ContributionWithDate[]>([]);
  const [currentScore, setCurrentScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;

    const { data } = await supabase
      .from('workout_contributions')
      .select('*')
      .eq('user_id', profile.id)
      .eq('domain', domain)
      .order('logged_at', { ascending: true });

    if (!data?.length) {
      setContributions([]);
      setCurrentScore(0);
      setLoading(false);
      return;
    }

    const now = Date.now();
    let weightedSum = 0;
    let weightTotal = 0;

    const enriched: ContributionWithDate[] = data.map((c: WorkoutContribution) => {
      const daysAgo = (now - new Date(c.logged_at).getTime()) / 86400000;
      const decayWeight = Math.exp(-DECAY_LAMBDA * daysAgo);
      weightedSum += c.contribution_score * decayWeight;
      weightTotal += decayWeight;
      return {
        ...c,
        displayDate: new Date(c.logged_at).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
        }),
        decayedScore: c.contribution_score * decayWeight,
      };
    });

    setContributions(enriched);
    setCurrentScore(weightTotal > 0 ? weightedSum / weightTotal : 0);
    setLoading(false);
  }, [profile, domain]);

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

  const trendPoints = contributions.map((c) => c.contribution_score);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22c55e" />
      }
    >
      <Text style={styles.heading}>{DOMAIN_LABELS[domain]}</Text>

      <View style={styles.scoreCard}>
        <Text style={styles.scoreLabel}>Current Score</Text>
        <Text style={styles.score}>
          {currentScore.toFixed(1)}
          <Text style={styles.scoreMax}>/10</Text>
        </Text>
      </View>

      {trendPoints.length >= 2 && (
        <View style={styles.chartCard}>
          <Text style={styles.sectionLabel}>Trend</Text>
          <TrendLine points={trendPoints} />
        </View>
      )}

      <Text style={styles.sectionLabel}>Contributing Workouts ({contributions.length})</Text>

      {contributions.length === 0 && (
        <Text style={styles.empty}>No workouts logged for this domain yet.</Text>
      )}

      {[...contributions].reverse().map((c) => (
        <View key={c.id} style={styles.row}>
          <View style={styles.rowLeft}>
            <Text style={styles.rowDate}>{c.displayDate}</Text>
            <Text style={styles.rowType}>{c.workout_id ? 'Personal workout' : 'Challenge'}</Text>
          </View>
          <View style={styles.rowRight}>
            <Text style={styles.rowWeight}>{Math.round(c.domain_weight * 100)}% weight</Text>
            <Text style={styles.rowScore}>+{c.contribution_score.toFixed(2)}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#0a0a0a' },
  container: { padding: 24, paddingBottom: 48, gap: 16 },
  center: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' },
  heading: { fontSize: 26, fontWeight: '800', color: '#fff' },
  scoreCard: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1e1e1e',
  },
  scoreLabel: { color: '#555', fontSize: 13, marginBottom: 4 },
  score: { fontSize: 48, fontWeight: '800', color: '#22c55e' },
  scoreMax: { fontSize: 20, color: '#555' },
  chartCard: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e1e1e',
    gap: 12,
  },
  sectionLabel: {
    color: '#555',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  empty: { color: '#333', fontSize: 14, textAlign: 'center', paddingVertical: 24 },
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
  rowLeft: { gap: 2 },
  rowDate: { color: '#fff', fontSize: 15, fontWeight: '600' },
  rowType: { color: '#555', fontSize: 12 },
  rowRight: { alignItems: 'flex-end', gap: 2 },
  rowWeight: { color: '#555', fontSize: 12 },
  rowScore: { color: '#22c55e', fontSize: 16, fontWeight: '700' },
});
