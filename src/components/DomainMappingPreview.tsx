import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { DomainWeights, DOMAIN_LABELS, DomainKey } from '../types/database.types';

interface Props {
  weights: DomainWeights | null;
  loading: boolean;
  rawScore?: number;
}

export default function DomainMappingPreview({ weights, loading, rawScore }: Props) {
  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color="#22c55e" />
        <Text style={styles.loadingText}>Mapping domains with AI…</Text>
      </View>
    );
  }

  if (!weights || Object.keys(weights).length === 0) return null;

  const sorted = (Object.entries(weights) as Array<[DomainKey, number]>)
    .filter(([, w]) => w > 0)
    .sort(([, a], [, b]) => b - a);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Domain Impact Preview</Text>
      <Text style={styles.subheading}>AI-mapped from your workout</Text>

      {sorted.map(([domain, weight]) => (
        <View key={domain} style={styles.row}>
          <Text style={styles.domainName}>{DOMAIN_LABELS[domain]}</Text>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${weight * 100}%` }]} />
          </View>
          <Text style={styles.weight}>{Math.round(weight * 100)}%</Text>
          {rawScore != null && (
            <Text style={styles.contribution}>+{(rawScore * weight).toFixed(1)}</Text>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#111', borderRadius: 16, padding: 20, gap: 12 },
  loadingText: { color: '#888', marginTop: 8, textAlign: 'center' },
  heading: { color: '#fff', fontSize: 16, fontWeight: '700' },
  subheading: { color: '#555', fontSize: 13, marginTop: -6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  domainName: { color: '#aaa', fontSize: 13, width: 110 },
  barTrack: { flex: 1, height: 6, backgroundColor: '#2a2a2a', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#22c55e', borderRadius: 3 },
  weight: { color: '#666', fontSize: 12, width: 32, textAlign: 'right' },
  contribution: { color: '#22c55e', fontSize: 12, width: 32, textAlign: 'right' },
});
