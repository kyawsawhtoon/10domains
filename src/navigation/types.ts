import { UserRole } from '../types/database.types';

export type AuthStackParamList = {
  Welcome: undefined;
  RoleSelect: undefined;
  SignUp: { role: UserRole };
  SignIn: undefined;
};

export type CoachStackParamList = {
  GroupDashboard: undefined;
  CreateChallenge: undefined;
  MemberProfile: { memberId: string };
  ChallengeResults: { challengeId: string };
};

export type MemberStackParamList = {
  Home: undefined;
  ActiveChallenges: undefined;
  SubmitChallenge: { challengeId: string };
  LogWorkout: undefined;
  DomainDetail: { domain: string };
  WorkoutHistory: undefined;
  GroupLeaderboard: { challengeId: string };
};

export type SharedStackParamList = {
  Profile: undefined;
};
