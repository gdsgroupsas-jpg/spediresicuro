/**
 * Test per Admin Reseller Actions
 * 
 * Verifica funzionamento getAllClientsForUser() e getSubUsers() aggiornato
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getAllClientsForUser, getSubUsers } from '@/actions/admin-reseller'
import { supabaseAdmin } from '@/lib/db/client'
import { auth } from '@/lib/auth-config'
import { hasCapability } from '@/lib/db/capability-helpers'

// Mock dependencies
vi.mock('@/lib/db/client', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}))

vi.mock('@/lib/auth-config', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/db/capability-helpers', () => ({
  hasCapability: vi.fn(),
}))

describe('Admin Reseller Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getAllClientsForUser', () => {
    it('should return error if not authenticated', async () => {
      ;(auth as any).mockResolvedValue(null)

      const result = await getAllClientsForUser()

      expect(result.success).toBe(false)
      expect(result.error).toContain('Non autenticato')
    })

    it('should return error if user cannot view all clients', async () => {
      ;(auth as any).mockResolvedValue({
        user: { email: 'user@test.com' },
      })

      // Mock user query
      ;(supabaseAdmin.from as any).mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: { id: 'user-id', account_type: 'user', role: 'user' },
              error: null,
            }),
          })),
        })),
      })

      ;(hasCapability as any).mockResolvedValue(false)

      const result = await getAllClientsForUser()

      expect(result.success).toBe(false)
      expect(result.error).toContain('Solo Superadmin/Admin')
    })

    it('should return hierarchical clients for superadmin', async () => {
      ;(auth as any).mockResolvedValue({
        user: { email: 'admin@test.com' },
      })

      // Mock user query (superadmin)
      const userQuery = {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: { id: 'admin-id', account_type: 'superadmin', role: 'admin' },
              error: null,
            }),
          })),
        })),
      }

      // Mock resellers query
      const resellersQuery = {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'reseller-1',
                  email: 'reseller1@test.com',
                  name: 'Reseller 1',
                  company_name: 'Company 1',
                  phone: '123',
                  wallet_balance: 100,
                  created_at: '2025-01-01',
                },
              ],
              error: null,
            }),
          })),
        })),
      }

      // Mock sub-users query
      const subUsersQuery = {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'sub-1',
                    email: 'sub1@test.com',
                    name: 'Sub User 1',
                    company_name: null,
                    phone: null,
                    wallet_balance: 50,
                    created_at: '2025-01-02',
                  },
                ],
                error: null,
              }),
            })),
          })),
        })),
      }

      // Mock BYOC query
      const byocQuery = {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'byoc-1',
                  email: 'byoc1@test.com',
                  name: 'BYOC Client 1',
                  company_name: 'BYOC Company',
                  phone: '456',
                  wallet_balance: 200,
                  created_at: '2025-01-03',
                },
              ],
              error: null,
            }),
          })),
        })),
      }

      ;(supabaseAdmin.from as any)
        .mockReturnValueOnce(userQuery) // User query
        .mockReturnValueOnce(resellersQuery) // Resellers query
        .mockReturnValueOnce(subUsersQuery) // Sub-users query
        .mockReturnValueOnce(byocQuery) // BYOC query

      const result = await getAllClientsForUser()

      expect(result.success).toBe(true)
      expect(result.clients).toBeDefined()
      expect(result.clients?.resellers).toHaveLength(1)
      expect(result.clients?.byocClients).toHaveLength(1)
      expect(result.clients?.stats.totalResellers).toBe(1)
      expect(result.clients?.stats.totalSubUsers).toBe(1)
      expect(result.clients?.stats.totalBYOC).toBe(1)
    })
  })

  describe('getSubUsers (updated)', () => {
    it('should return all sub-users for superadmin', async () => {
      ;(auth as any).mockResolvedValue({
        user: { email: 'admin@test.com' },
      })

      // Mock user query (superadmin)
      const userQuery = {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: { id: 'admin-id', account_type: 'superadmin', role: 'admin' },
              error: null,
            }),
          })),
        })),
      }

      // Mock all sub-users query (for superadmin - uses .not().eq())
      const allSubUsersQuery = {
        select: vi.fn(() => ({
          not: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'sub-1',
                    email: 'sub1@test.com',
                    name: 'Sub User 1',
                    company_name: null,
                    phone: null,
                    wallet_balance: 50,
                    created_at: '2025-01-02',
                  },
                ],
                error: null,
              }),
            })),
          })),
        })),
      }

      // Mock chain: user query (canViewAllClients) -> user query (isCurrentUserReseller) -> all sub-users query
      ;(supabaseAdmin.from as any)
        .mockReturnValueOnce(userQuery) // canViewAllClients - user query
        .mockReturnValueOnce(userQuery) // isCurrentUserReseller - user query  
        .mockReturnValueOnce(allSubUsersQuery) // getSubUsers - all sub-users query

      ;(hasCapability as any).mockResolvedValue(true)

      const result = await getSubUsers()

      expect(result.success).toBe(true)
      expect(result.subUsers).toBeDefined()
      expect(result.subUsers?.length).toBeGreaterThan(0)
    })

    it('should return only reseller sub-users for reseller', async () => {
      ;(auth as any).mockResolvedValue({
        user: { email: 'reseller@test.com' },
      })

      // Mock user queries
      const userQuery1 = {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: { id: 'reseller-id', account_type: 'user', role: 'user' },
              error: null,
            }),
          })),
        })),
      }

      const userQuery2 = {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: { id: 'reseller-id', is_reseller: true },
              error: null,
            }),
          })),
        })),
      }

      // Mock sub-users query
      const subUsersQuery = {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'sub-1',
                    email: 'sub1@test.com',
                    name: 'Sub User 1',
                    company_name: null,
                    phone: null,
                    wallet_balance: 50,
                    created_at: '2025-01-02',
                  },
                ],
                error: null,
              }),
            })),
          })),
        })),
      }

      ;(supabaseAdmin.from as any)
        .mockReturnValueOnce(userQuery1)
        .mockReturnValueOnce(userQuery2)
        .mockReturnValueOnce(subUsersQuery)

      ;(hasCapability as any).mockResolvedValue(false)

      const result = await getSubUsers()

      expect(result.success).toBe(true)
      expect(result.subUsers).toBeDefined()
      expect(result.subUsers?.length).toBe(1)
    })
  })
})
