---
title: Environment Requirements
scope: testing
audience: engineering
owner: engineering
status: active
source_of_truth: true
updated: 2026-01-19
---

# Environment Requirements

This file lists the minimum environment variables used by tests and scripts.

## Core

- NEXT_PUBLIC_SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY

## Auth

- NEXTAUTH_URL
- NEXTAUTH_SECRET

## Payments

- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET

## AI / OCR

- GOOGLE_API_KEY
- GEMINI_API_KEY

## Redis

- UPSTASH_REDIS_REST_URL
- UPSTASH_REDIS_REST_TOKEN

## Email

- RESEND_API_KEY

## Courier Providers (examples)

- SPEDISCI_ONLINE_TEST_API_KEY
- POSTE_API_KEY

## Notes

- Use .env.local at project root.
- For test-only scripts in tests/scripts, load .env.local before imports.
