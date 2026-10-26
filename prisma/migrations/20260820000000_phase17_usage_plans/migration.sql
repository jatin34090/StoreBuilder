-- Phase 17: Usage-Based Pricing & Plan Architecture
-- Part 1: add the new Plan enum values. Must run in its own transaction, before part 2
-- (20260820000001_phase17_usage_plans_data) uses them.

-- PostgreSQL only allows ADD VALUE, not DROP/RENAME
ALTER TYPE "Plan" ADD VALUE IF NOT EXISTS 'GROWTH';
ALTER TYPE "Plan" ADD VALUE IF NOT EXISTS 'BUSINESS';
