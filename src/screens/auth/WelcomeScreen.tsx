import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Welcome'>;
};

export default function WelcomeScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.title}>FitDomains</Text>
        <Text style={styles.subtitle}>Track your fitness across all 10 GPP domains</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate('RoleSelect')}
        >
          <Text style={styles.primaryButtonText}>Get Started</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.navigate('SignIn')}
        >
          <Text style={styles.secondaryButtonText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'space-between', padding: 32 },
  hero: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 42, fontWeight: '800', color: '#ffffff', letterSpacing: -1 },
  subtitle: { fontSize: 16, color: '#888', textAlign: 'center', marginTop: 12, lineHeight: 24 },
  actions: { gap: 12 },
  primaryButton: {
    backgroundColor: '#22c55e',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  secondaryButton: { borderRadius: 14, padding: 18, alignItems: 'center' },
  secondaryButtonText: { color: '#888', fontSize: 17 },
});
