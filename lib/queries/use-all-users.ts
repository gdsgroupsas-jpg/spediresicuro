'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAllUsers, toggleResellerStatus, manageWallet } from '@/actions/super-admin'
import type { UserFilters } from '@/lib/validations/user-schema'
import type { WalletOperationInput, BulkWalletOperationInput } from '@/lib/validations/wallet-schema'

/**
 * Hook per ottenere tutti gli utenti (Super Admin)
 */
export function useAllUsers(filters?: Partial<UserFilters>) {
  return useQuery({
    queryKey: ['all-users', filters],
    queryFn: async () => {
      const result = await getAllUsers(filters?.limit || 100)
      if (!result.success) {
        throw new Error(result.error || 'Errore nel caricamento degli utenti')
      }
      return result.users || []
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  })
}

/**
 * Hook per toggle status reseller
 */
export function useToggleResellerStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ userId, enabled }: { userId: string; enabled: boolean }) => {
      const result = await toggleResellerStatus(userId, enabled)
      if (!result.success) {
        throw new Error(result.error || 'Errore nel cambio status reseller')
      }
      return result
    },
    onMutate: async ({ userId, enabled }) => {
      await queryClient.cancelQueries({ queryKey: ['all-users'] })
      const previousUsers = queryClient.getQueryData(['all-users'])

      queryClient.setQueryData(['all-users'], (old: any[] | undefined) => {
        if (!old) return old
        return old.map((user: any) =>
          user.id === userId ? { ...user, is_reseller: enabled } : user
        )
      })

      return { previousUsers }
    },
    onError: (err, variables, context) => {
      if (context?.previousUsers) {
        queryClient.setQueryData(['all-users'], context.previousUsers)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['all-users'] })
    },
  })
}

/**
 * Hook per gestire wallet utente
 */
export function useManageWallet() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ userId, amount, reason }: WalletOperationInput) => {
      const result = await manageWallet(userId, amount, reason)
      if (!result.success) {
        throw new Error(result.error || 'Errore nella gestione wallet')
      }
      return result
    },
    onMutate: async ({ userId, amount }) => {
      await queryClient.cancelQueries({ queryKey: ['all-users'] })
      const previousUsers = queryClient.getQueryData(['all-users'])

      queryClient.setQueryData(['all-users'], (old: any[] | undefined) => {
        if (!old) return old
        return old.map((user: any) =>
          user.id === userId
            ? { ...user, wallet_balance: (user.wallet_balance || 0) + amount }
            : user
        )
      })

      return { previousUsers }
    },
    onError: (err, variables, context) => {
      if (context?.previousUsers) {
        queryClient.setQueryData(['all-users'], context.previousUsers)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['all-users'] })
      queryClient.invalidateQueries({ queryKey: ['sub-users'] })
      queryClient.invalidateQueries({ queryKey: ['sub-users-stats'] })
    },
  })
}

/**
 * Hook per operazioni wallet massive
 */
export function useBulkWalletOperation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ userIds, amount, reason }: BulkWalletOperationInput) => {
      const results = await Promise.allSettled(
        userIds.map((userId) => manageWallet(userId, amount, reason))
      )

      const successful = results.filter(
        (r) => r.status === 'fulfilled' && r.value.success
      ).length
      const failed = userIds.length - successful

      return { successful, failed, total: userIds.length }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['all-users'] })
      queryClient.invalidateQueries({ queryKey: ['sub-users'] })
      queryClient.invalidateQueries({ queryKey: ['sub-users-stats'] })
    },
  })
}

/**
 * Hook per invalidare la cache degli utenti
 */
export function useInvalidateAllUsers() {
  const queryClient = useQueryClient()

  return () => {
    queryClient.invalidateQueries({ queryKey: ['all-users'] })
  }
}
