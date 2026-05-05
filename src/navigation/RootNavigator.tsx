import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { AuthStackParamList, CoachStackParamList, MemberStackParamList } from './types';

// Auth screens
import WelcomeScreen from '../screens/auth/WelcomeScreen';
import RoleSelectScreen from '../screens/auth/RoleSelectScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';
import SignInScreen from '../screens/auth/SignInScreen';

// Coach screens
import GroupDashboardScreen from '../screens/coach/GroupDashboardScreen';
import CreateChallengeScreen from '../screens/coach/CreateChallengeScreen';
import ChallengeResultsScreen from '../screens/coach/ChallengeResultsScreen';
import MemberProfileScreen from '../screens/coach/MemberProfileScreen';

// Member screens
import HomeScreen from '../screens/member/HomeScreen';
import LogWorkoutScreen from '../screens/member/LogWorkoutScreen';
import ActiveChallengesScreen from '../screens/member/ActiveChallengesScreen';
import SubmitChallengeScreen from '../screens/member/SubmitChallengeScreen';
import GroupLeaderboardScreen from '../screens/member/GroupLeaderboardScreen';
import DomainDetailScreen from '../screens/member/DomainDetailScreen';
import WorkoutHistoryScreen from '../screens/member/WorkoutHistoryScreen';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const CoachStack = createNativeStackNavigator<CoachStackParamList>();
const MemberStack = createNativeStackNavigator<MemberStackParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Welcome" component={WelcomeScreen} />
      <AuthStack.Screen name="RoleSelect" component={RoleSelectScreen} />
      <AuthStack.Screen name="SignUp" component={SignUpScreen} />
      <AuthStack.Screen name="SignIn" component={SignInScreen} />
    </AuthStack.Navigator>
  );
}

function CoachNavigator() {
  return (
    <CoachStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#0a0a0a' },
        headerTintColor: '#fff',
        headerShadowVisible: false,
      }}
    >
      <CoachStack.Screen
        name="GroupDashboard"
        component={GroupDashboardScreen}
        options={{ headerShown: false }}
      />
      <CoachStack.Screen
        name="CreateChallenge"
        component={CreateChallengeScreen}
        options={{ title: 'New Challenge' }}
      />
      <CoachStack.Screen
        name="MemberProfile"
        component={MemberProfileScreen}
        options={{ title: 'Athlete' }}
      />
      <CoachStack.Screen
        name="ChallengeResults"
        component={ChallengeResultsScreen}
        options={{ title: 'Results' }}
      />
    </CoachStack.Navigator>
  );
}

function MemberNavigator() {
  return (
    <MemberStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#0a0a0a' },
        headerTintColor: '#fff',
        headerShadowVisible: false,
      }}
    >
      <MemberStack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
      <MemberStack.Screen
        name="LogWorkout"
        component={LogWorkoutScreen}
        options={{ title: 'Log Workout' }}
      />
      <MemberStack.Screen
        name="ActiveChallenges"
        component={ActiveChallengesScreen}
        options={{ title: 'Challenges' }}
      />
      <MemberStack.Screen
        name="SubmitChallenge"
        component={SubmitChallengeScreen}
        options={{ title: 'Submit Results' }}
      />
      <MemberStack.Screen
        name="DomainDetail"
        component={DomainDetailScreen}
        options={{ title: 'Domain' }}
      />
      <MemberStack.Screen
        name="WorkoutHistory"
        component={WorkoutHistoryScreen}
        options={{ title: 'Workout History' }}
      />
      <MemberStack.Screen
        name="GroupLeaderboard"
        component={GroupLeaderboardScreen}
        options={{ title: 'Leaderboard' }}
      />
    </MemberStack.Navigator>
  );
}

export default function RootNavigator() {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#0a0a0a',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ActivityIndicator color="#22c55e" size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {!session || !profile ? (
        <AuthNavigator />
      ) : profile.role === 'coach' ? (
        <CoachNavigator />
      ) : (
        <MemberNavigator />
      )}
    </NavigationContainer>
  );
}
