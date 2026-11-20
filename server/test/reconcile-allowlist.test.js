// @vitest-environment node
// The schema allowlists the restored-backup run uses (code review of 8fa4d35):
// each matches only the objects its migration creates, by name, so a stray
// object that merely mentions the same words is still reported.
import { describe, it, expect } from 'vitest';
import { PREREQ_SCHEMA, SAVINGS_SCHEMA } from '../reconcile.js';

describe('PREREQ_SCHEMA (014 and 015)', () => {
  it.each([
    'column public.today_goals.title text null=NO default=-',
    'column public.today_goal_completions.goal_id uuid null=NO default=-',
    'constraint public.today_goals_schedule_shape CHECK (...)',
    'constraint public.today_goal_completions_pkey PRIMARY KEY (id)',
    'index public.today_goal_once_per_day CREATE UNIQUE INDEX ...',
    'index public.today_goals_child_idx CREATE INDEX ...',
    'column public.rewards.icon_key text null=YES default=-',
    'constraint public.rewards_icon_key_approved CHECK (...)',
  ])('allows %s', (o) => expect(PREREQ_SCHEMA.test(o)).toBe(true));
  it.each([
    'column public.children.today_goal_flag boolean null=YES default=-',
    'column public.today_goals_shadow.x text null=YES default=-',
    'column public.rewards.icon_key_extra text null=YES default=-',
    'constraint public.rewards_icon_key_approved_2 CHECK (...)',
    'index public.children_today_goal_idx CREATE INDEX ...',
    'trigger public.children.today_goal_sync CREATE TRIGGER ...',
    'column public.savings_events.id uuid null=NO default=-',
  ])('reports %s', (o) => expect(PREREQ_SCHEMA.test(o)).toBe(false));
});

describe('SAVINGS_SCHEMA (016)', () => {
  it.each([
    'column public.savings_events.delta integer null=NO default=-',
    'constraint public.savings_events_undoes_once UNIQUE (undoes)',
    'index public.savings_events_request CREATE UNIQUE INDEX ...',
    'column public.rewards.is_bigger_goal boolean null=NO default=false',
    'column public.rewards.goal_epoch integer null=NO default=0',
    'column public.rewards.goal_child_epochs jsonb null=NO default=...',
    'trigger public.rewards.rewards_goal_generation CREATE TRIGGER ...',
    'trigger public.rewards.rewards_goal_generation_insert CREATE TRIGGER ...',
  ])('allows %s', (o) => expect(SAVINGS_SCHEMA.test(o)).toBe(true));
  it.each([
    'column public.children.savings_events_count integer null=YES default=-',
    'column public.savings_events_archive.x text null=YES default=-',
    'column public.rewards.goal_epoch_old integer null=YES default=-',
    'trigger public.children.rewards_goal_generation CREATE TRIGGER ...',
    'constraint public.rewards_goal_generation_check CHECK (...)',
    'column public.rewards.icon_key text null=YES default=-',
  ])('reports %s', (o) => expect(SAVINGS_SCHEMA.test(o)).toBe(false));
});
