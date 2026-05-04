-- FitDomains initial schema
-- Run order: extensions → types → tables → indexes → RLS → functions

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
CREATE TYPE user_role AS ENUM ('coach', 'member');

CREATE TYPE domain_key AS ENUM (
  'cardiovascular_endurance',
  'stamina',
  'strength',
  'flexibility',
  'power',
  'speed',
  'coordination',
  'agility',
  'balance',
  'accuracy'
);

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- Extends auth.users; one row per user.
CREATE TABLE profiles (
  id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role                user_role NOT NULL,
  display_name        TEXT NOT NULL,
  avatar_url          TEXT,
  leaderboard_visible BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One coach can have one group (free tier). Enforced at app layer; schema
-- allows multiple for future Pro tier.
CREATE TABLE groups (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coach_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE DEFAULT upper(substr(md5(random()::text), 1, 6)),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE group_memberships (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id  UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, member_id)
);

CREATE TABLE challenges (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id       UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  coach_id       UUID NOT NULL REFERENCES profiles(id),
  name           TEXT NOT NULL,
  description    TEXT,
  start_date     DATE NOT NULL,
  end_date       DATE NOT NULL,
  -- AI-assigned domain weights, e.g. {"strength": 0.5, "power": 0.3, ...}
  domain_weights JSONB NOT NULL DEFAULT '{}',
  is_published   BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE challenge_exercises (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  sets         INTEGER,
  reps         INTEGER,
  weight_kg    FLOAT,
  distance_m   FLOAT,
  duration_s   INTEGER,
  sort_order   INTEGER NOT NULL DEFAULT 0
);

-- One submission per member per challenge.
CREATE TABLE challenge_submissions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  notes        TEXT,
  raw_score    FLOAT NOT NULL DEFAULT 0 CHECK (raw_score >= 0 AND raw_score <= 10),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, user_id)
);

CREATE TABLE challenge_submission_exercises (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID NOT NULL REFERENCES challenge_submissions(id) ON DELETE CASCADE,
  exercise_id   UUID NOT NULL REFERENCES challenge_exercises(id),
  time_s        INTEGER,
  weight_kg     FLOAT,
  reps          INTEGER,
  distance_m    FLOAT
);

CREATE TABLE personal_workouts (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name           TEXT,
  -- AI-assigned domain weights
  domain_weights JSONB NOT NULL DEFAULT '{}',
  raw_score      FLOAT NOT NULL DEFAULT 0 CHECK (raw_score >= 0 AND raw_score <= 10),
  logged_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE personal_workout_exercises (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workout_id UUID NOT NULL REFERENCES personal_workouts(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  sets       INTEGER,
  reps       INTEGER,
  weight_kg  FLOAT,
  distance_m FLOAT,
  duration_s INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Core scoring table. Never overwrite — always append.
-- Exactly one of workout_id / submission_id is non-null per row.
CREATE TABLE workout_contributions (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workout_id         UUID REFERENCES personal_workouts(id) ON DELETE CASCADE,
  submission_id      UUID REFERENCES challenge_submissions(id) ON DELETE CASCADE,
  user_id            UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  domain             domain_key NOT NULL,
  contribution_score FLOAT NOT NULL CHECK (contribution_score >= 0 AND contribution_score <= 10),
  domain_weight      FLOAT NOT NULL CHECK (domain_weight >= 0 AND domain_weight <= 1),
  logged_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT exactly_one_source CHECK (
    (workout_id IS NOT NULL AND submission_id IS NULL) OR
    (workout_id IS NULL AND submission_id IS NOT NULL)
  )
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX ON group_memberships (member_id);
CREATE INDEX ON challenges (group_id, is_published);
CREATE INDEX ON challenge_submissions (user_id);
CREATE INDEX ON workout_contributions (user_id, domain, logged_at);
CREATE INDEX ON personal_workouts (user_id, logged_at);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE profiles                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_memberships           ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_exercises         ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_submissions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_submission_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_workouts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_workout_exercises  ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_contributions       ENABLE ROW LEVEL SECURITY;

-- profiles: own row always; coaches can read their members' profiles
CREATE POLICY "profiles: own row" ON profiles
  FOR ALL USING (auth.uid() = id);

CREATE POLICY "profiles: coach reads members" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM group_memberships gm
      JOIN groups g ON g.id = gm.group_id
      WHERE gm.member_id = profiles.id
        AND g.coach_id = auth.uid()
    )
  );

-- groups: coach owns; member reads groups they belong to
CREATE POLICY "groups: coach owns" ON groups
  FOR ALL USING (coach_id = auth.uid());

CREATE POLICY "groups: member reads" ON groups
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM group_memberships
      WHERE group_id = groups.id AND member_id = auth.uid()
    )
  );

-- group_memberships: coach manages their group; member reads own
CREATE POLICY "memberships: coach manages" ON group_memberships
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM groups WHERE id = group_memberships.group_id AND coach_id = auth.uid()
    )
  );

CREATE POLICY "memberships: member reads own" ON group_memberships
  FOR SELECT USING (member_id = auth.uid());

-- challenges: coach owns; member reads published challenges in their groups
CREATE POLICY "challenges: coach owns" ON challenges
  FOR ALL USING (coach_id = auth.uid());

CREATE POLICY "challenges: member reads published" ON challenges
  FOR SELECT USING (
    is_published = true AND
    EXISTS (
      SELECT 1 FROM group_memberships
      WHERE group_id = challenges.group_id AND member_id = auth.uid()
    )
  );

-- challenge_exercises: same visibility as parent challenge
CREATE POLICY "challenge_exercises: coach owns" ON challenge_exercises
  FOR ALL USING (
    EXISTS (SELECT 1 FROM challenges WHERE id = challenge_exercises.challenge_id AND coach_id = auth.uid())
  );

CREATE POLICY "challenge_exercises: member reads" ON challenge_exercises
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM challenges c
      JOIN group_memberships gm ON gm.group_id = c.group_id
      WHERE c.id = challenge_exercises.challenge_id
        AND c.is_published = true
        AND gm.member_id = auth.uid()
    )
  );

-- challenge_submissions: own row; coach reads all in group
CREATE POLICY "submissions: own row" ON challenge_submissions
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "submissions: coach reads group" ON challenge_submissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM challenges c
      WHERE c.id = challenge_submissions.challenge_id AND c.coach_id = auth.uid()
    )
  );

-- challenge_submission_exercises: follows submission visibility
CREATE POLICY "submission_exercises: own" ON challenge_submission_exercises
  FOR ALL USING (
    EXISTS (SELECT 1 FROM challenge_submissions WHERE id = challenge_submission_exercises.submission_id AND user_id = auth.uid())
  );

CREATE POLICY "submission_exercises: coach reads" ON challenge_submission_exercises
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM challenge_submissions s
      JOIN challenges c ON c.id = s.challenge_id
      WHERE s.id = challenge_submission_exercises.submission_id AND c.coach_id = auth.uid()
    )
  );

-- personal_workouts: own only
CREATE POLICY "personal_workouts: own" ON personal_workouts
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "personal_workout_exercises: own" ON personal_workout_exercises
  FOR ALL USING (
    EXISTS (SELECT 1 FROM personal_workouts WHERE id = personal_workout_exercises.workout_id AND user_id = auth.uid())
  );

-- workout_contributions: own; coach reads group members'
CREATE POLICY "contributions: own" ON workout_contributions
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "contributions: coach reads members" ON workout_contributions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM group_memberships gm
      JOIN groups g ON g.id = gm.group_id
      WHERE gm.member_id = workout_contributions.user_id
        AND g.coach_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Server-side domain score computation
-- Recomputes all 10 domain scores for a user from raw contribution history.
-- Call this after every workout submission.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION compute_domain_scores(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  -- λ = 0.02: workout ~35 days ago carries ~50% of today's weight
  lambda CONSTANT FLOAT := 0.02;
  result JSONB := '{}';
  rec RECORD;
  weighted_sum FLOAT;
  weight_total FLOAT;
  decay_weight FLOAT;
  days_ago FLOAT;
BEGIN
  FOR rec IN
    SELECT
      domain,
      contribution_score,
      EXTRACT(EPOCH FROM (now() - logged_at)) / 86400.0 AS days_ago
    FROM workout_contributions
    WHERE user_id = p_user_id
    ORDER BY domain, logged_at
  LOOP
    decay_weight := exp(-lambda * rec.days_ago);

    weighted_sum := COALESCE((result->>rec.domain::text)::float, 0) + rec.contribution_score * decay_weight;
    weight_total := COALESCE((result->>(rec.domain::text || '_w'))::float, 0) + decay_weight;

    result := result
      || jsonb_build_object(rec.domain::text, weighted_sum)
      || jsonb_build_object(rec.domain::text || '_w', weight_total);
  END LOOP;

  -- Final pass: divide weighted sums by total weights to get 0-10 scores
  FOR rec IN SELECT unnest(enum_range(NULL::domain_key)) AS d LOOP
    IF (result->(rec.d::text)) IS NOT NULL AND (result->>(rec.d::text || '_w'))::float > 0 THEN
      result := result || jsonb_build_object(
        rec.d::text,
        ROUND(((result->>rec.d::text)::float / (result->>(rec.d::text || '_w'))::float)::numeric, 2)
      );
      result := result - (rec.d::text || '_w');
    ELSE
      result := result || jsonb_build_object(rec.d::text, 0);
      result := result - (rec.d::text || '_w');
    END IF;
  END LOOP;

  RETURN result;
END;
$$;
