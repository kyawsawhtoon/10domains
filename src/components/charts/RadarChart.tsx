import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polygon, Line, Circle, Text as SvgText } from 'react-native-svg';
import { DomainKey, DomainScores, DOMAIN_LABELS, ALL_DOMAINS } from '../../types/database.types';

interface Props {
  scores: Partial<DomainScores>;
  size?: number;
  accentColor?: string;
}

const TICKS = 5; // concentric rings

export default function RadarChart({ scores, size = 280, accentColor = '#22c55e' }: Props) {
  const center = size / 2;
  const radius = size * 0.38;
  const labelRadius = size * 0.48;
  const domains = ALL_DOMAINS;
  const n = domains.length;

  function angleFor(i: number) {
    return (Math.PI * 2 * i) / n - Math.PI / 2;
  }

  function point(r: number, i: number) {
    const a = angleFor(i);
    return { x: center + r * Math.cos(a), y: center + r * Math.sin(a) };
  }

  // Concentric grid rings
  const rings = Array.from({ length: TICKS }, (_, i) => {
    const r = (radius * (i + 1)) / TICKS;
    const pts = domains.map((_, idx) => point(r, idx));
    return pts.map((p) => `${p.x},${p.y}`).join(' ');
  });

  // Spoke lines
  const spokes = domains.map((_, i) => {
    const p = point(radius, i);
    return { x2: p.x, y2: p.y };
  });

  // Data polygon
  const dataPoints = domains.map((d, i) => {
    const val = Math.min(10, Math.max(0, scores[d] ?? 0));
    const r = (val / 10) * radius;
    return point(r, i);
  });
  const dataPolygon = dataPoints.map((p) => `${p.x},${p.y}`).join(' ');

  // Labels
  const labels = domains.map((d, i) => {
    const p = point(labelRadius, i);
    const shortLabel = DOMAIN_LABELS[d as DomainKey].split(' ')[0];
    return { x: p.x, y: p.y, label: shortLabel };
  });

  return (
    <View>
      <Svg width={size} height={size}>
        {/* Grid rings */}
        {rings.map((pts, i) => (
          <Polygon key={i} points={pts} fill="none" stroke="#2a2a2a" strokeWidth={1} />
        ))}

        {/* Spoke lines */}
        {spokes.map((s, i) => (
          <Line
            key={i}
            x1={center}
            y1={center}
            x2={s.x2}
            y2={s.y2}
            stroke="#2a2a2a"
            strokeWidth={1}
          />
        ))}

        {/* Data fill */}
        <Polygon
          points={dataPolygon}
          fill={accentColor}
          fillOpacity={0.2}
          stroke={accentColor}
          strokeWidth={2}
        />

        {/* Data points */}
        {dataPoints.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={3} fill={accentColor} />
        ))}

        {/* Labels */}
        {labels.map((l, i) => (
          <SvgText
            key={i}
            x={l.x}
            y={l.y}
            fontSize={9}
            fill="#888"
            textAnchor="middle"
            alignmentBaseline="middle"
          >
            {l.label}
          </SvgText>
        ))}
      </Svg>

      {/* Score legend */}
      <View style={styles.legend}>
        {ALL_DOMAINS.map((d) => (
          <View key={d} style={styles.legendRow}>
            <Text style={styles.legendLabel}>{DOMAIN_LABELS[d as DomainKey]}</Text>
            <Text style={[styles.legendScore, { color: accentColor }]}>
              {(scores[d] ?? 0).toFixed(1)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { marginTop: 12, gap: 4 },
  legendRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  legendLabel: { color: '#888', fontSize: 13 },
  legendScore: { fontSize: 13, fontWeight: '600' },
});
