import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Profile, UserRole } from '../types/database.types';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (
    email: string,
    password: string,
    displayName: string,
    role: UserRole,
  ) => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(userId: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    setProfile(data ?? null);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) loadProfile(session.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) loadProfile(session.user.id);
      else setProfile(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signUpWithEmail(
    email: string,
    password: string,
    displayName: string,
    role: UserRole,
  ) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    if (!data.user) throw new Error('Sign up failed');

    const { error: profileError } = await supabase.from('profiles').insert({
      id: data.user.id,
      role,
      display_name: displayName,
    });
    if (profileError) throw profileError;

    await loadProfile(data.user.id);
  }

  async function signInWithEmail(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signInWithApple() {
    // Lazy import — expo-apple-authentication only works on iOS physical devices / simulators
    const AppleAuthentication = await import('expo-apple-authentication');
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken!,
    });
    if (error) throw error;
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function refreshProfile() {
    if (session) await loadProfile(session.user.id);
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        loading,
        signInWithEmail,
        signUpWithEmail,
        signInWithApple,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
