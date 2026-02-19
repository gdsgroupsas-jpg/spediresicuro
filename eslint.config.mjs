import { FlatCompat } from '@eslint/eslintrc';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends('next/core-web-vitals'),
  {
    files: ['app/api/shipments/**/*.ts', 'app/api/shipments/**/*.tsx', 'actions/wallet.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@/lib/auth-config',
              message:
                '❌ SECURITY P0: Direct auth() import is FORBIDDEN in migrated files. Use requireSafeAuth() from @/lib/safe-auth to support impersonation (Acting Context).',
            },
            {
              name: 'next-auth',
              message:
                '❌ SECURITY P0: Direct next-auth import is FORBIDDEN in migrated files. Use requireSafeAuth() from @/lib/safe-auth to support impersonation (Acting Context).',
            },
            {
              name: 'next-auth/react',
              message:
                '❌ SECURITY P0: next-auth/react is client-side only. Use requireSafeAuth() from @/lib/safe-auth for server-side authentication.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['app/api/**/*.ts', 'app/api/**/*.tsx', 'actions/**/*.ts', 'actions/**/*.tsx'],
    ignores: ['app/api/shipments/**/*.ts', 'app/api/shipments/**/*.tsx', 'actions/wallet.ts'],
    rules: {
      'no-restricted-imports': [
        'warn',
        {
          paths: [
            {
              name: '@/lib/auth-config',
              message:
                '⚠️ LEGACY: auth() usage allowed temporarily. Migration to requireSafeAuth() required for Acting Context support. See docs/SECURITY_GATE_ACTING_CONTEXT.md',
            },
            {
              name: 'next-auth',
              message:
                '⚠️ LEGACY: next-auth usage allowed temporarily. Migration to requireSafeAuth() required for Acting Context support.',
            },
            {
              name: 'next-auth/react',
              message:
                '⚠️ LEGACY: next-auth/react is client-side only. Migration to requireSafeAuth() required for server-side.',
            },
          ],
        },
      ],
    },
  },
  // NOTE: no-console rule non attivato qui perche Next.js esegue ESLint
  // durante il build e 816 warning preesistenti renderebbero il build rumoroso.
  // Da attivare quando il debito console.log sara ridotto sotto 100.
  // Vedi .github/SECURITY_DEBT_POLICY.md per piano riduzione.
];

export default eslintConfig;
