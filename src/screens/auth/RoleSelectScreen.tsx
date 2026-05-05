import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { UserRole } from '../../types/database.types';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'RoleSelect'>;
};

interface RoleOption {
  role: UserRole;
  title: string;
  description: string;
}

const ROLES: RoleOption[] = [
  {
    role: 'coach',
    title: 'Coach / Instructor',
    description:
      "Create groups, design challenges, and monitor your athletes' progress across all 10 domains.",
  },
  {
    role: 'member',
    title: 'Athlete / Member',
    description:
      "Join a coach's group or train solo. Log workouts and watch your radar chart evolve.",
  },
];

export default function RoleSelectScreen({ navigation }: Props) {
  function handleSelect(role: UserRole) {
    navigation.navigate('SignUp', { role });
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Who are you?</Text>
      <Text style={styles.subheading}>Choose your role — you can't change this later.</Text>

      <View style={styles.cards}>
        {ROLES.map(({ role, title, description }) => (
          <TouchableOpacity key={role} style={styles.card} onPress={() => handleSelect(role)}>
            <Text style={styles.cardTitle}>{title}</Text>
            <Text style={styles.cardDescription}>{description}</Text>
            <Text style={styles.cardArrow}>→</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', padding: 32, paddingTop: 64 },
  heading: { fontSize: 32, fontWeight: '800', color: '#fff', marginBottom: 8 },
  subheading: { fontSize: 15, color: '#666', marginBottom: 40 },
  cards: { gap: 16 },
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  cardTitle: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 8 },
  cardDescription: { fontSize: 14, color: '#888', lineHeight: 22 },
  cardArrow: { fontSize: 20, color: '#22c55e', marginTop: 16, textAlign: 'right' },
});
