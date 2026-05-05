import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { AuthStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'SignUp'>;
  route: RouteProp<AuthStackParamList, 'SignUp'>;
};

export default function SignUpScreen({ route }: Props) {
  const { role } = route.params;
  const { signUpWithEmail, signInWithApple } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleEmailSignUp() {
    if (!displayName.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please fill in all fields.');
      return;
    }
    setLoading(true);
    try {
      await signUpWithEmail(email.trim(), password, displayName.trim(), role);
    } catch (e: unknown) {
      Alert.alert('Sign up failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function handleAppleSignIn() {
    setLoading(true);
    try {
      await signInWithApple();
    } catch (e: unknown) {
      Alert.alert('Apple sign in failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.heading}>Create account</Text>
      <Text style={styles.subheading}>
        Signing up as {role === 'coach' ? 'a Coach' : 'an Athlete'}
      </Text>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Display name"
          placeholderTextColor="#555"
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
        />
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#555"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#555"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleEmailSignUp}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>Create Account</Text>
          )}
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity style={styles.appleButton} onPress={handleAppleSignIn} disabled={loading}>
          <Text style={styles.appleButtonText}> Sign in with Apple</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', padding: 32, paddingTop: 64 },
  heading: { fontSize: 32, fontWeight: '800', color: '#fff', marginBottom: 8 },
  subheading: { fontSize: 15, color: '#666', marginBottom: 40 },
  form: { gap: 12 },
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  primaryButton: {
    backgroundColor: '#22c55e',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#2a2a2a' },
  dividerText: { color: '#555', fontSize: 14 },
  appleButton: { backgroundColor: '#fff', borderRadius: 12, padding: 18, alignItems: 'center' },
  appleButtonText: { color: '#000', fontSize: 17, fontWeight: '600' },
});
