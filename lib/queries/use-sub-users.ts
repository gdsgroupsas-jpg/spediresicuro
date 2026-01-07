'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSubUsers, createSubUser, getSubUsersStats, getAllClientsForUser } from '@/actions/admin-reseller'
import type { CreateUserInput } from '@/lib/validations/user-schema'

/**
 * Hook per ottenere la lista dei sub-users del reseller corrente
 */
export function useSubUsers() {
  return useQuery({
    queryKey: ['sub-users'],
    queryFn: async () => {
      const result = await getSubUsers()
      if (!result.success) {
        throw new Error(result.error || 'Errore nel caricamento dei clienti')
      }
      return result.subUsers || []
    },
    staleTime: 30_000, // 30 secondi
    refetchOnWindowFocus: true,
  })
}

/**
 * Hook per ottenere le statistiche dei sub-users
 */
export function useSubUsersStats() {
  return useQuery({
    queryKey: ['sub-users-stats'],
    queryFn: async () => {
      const result = await getSubUsersStats()
      if (!result.success) {
        throw new Error(result.error || 'Errore nel caricamento delle statistiche')
      }
      return result.stats || {
        totalSubUsers: 0,
        totalShipments: 0,
        totalRevenue: 0,
        activeSubUsers: 0,
      }
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  })
}

/**
 * Hook per creare un nuovo sub-user con optimistic update
 */
export function useCreateSubUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateUserInput) => {
      const result = await createSubUser({
        name: data.name,
        email: data.email,
        password: data.password || undefined,
      })

      if (!result.success) {
        throw new Error(result.error || 'Errore nella creazione del cliente')
      }

      return result
    },
    onMutate: async (newUser) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['sub-users'] })

      // Snapshot the previous value
      const previousUsers = queryClient.getQueryData(['sub-users'])

      // Optimistically update to the new value
      queryClient.setQueryData(['sub-users'], (old: any[] | undefined) => {
        if (!old) return [{ ...newUser, id: 'temp-' + Date.now(), created_at: new Date().toISOString() }]
        return [...old, { ...newUser, id: 'temp-' + Date.now(), created_at: new Date().toISOString() }]
      })

      // Return a context object with the snapshotted value
      return { previousUsers }
    },
    onError: (err, newUser, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousUsers) {
        queryClient.setQueryData(['sub-users'], context.previousUsers)
      }
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ['sub-users'] })
      queryClient.invalidateQueries({ queryKey: ['sub-users-stats'] })
    },
  })
}

/**
 * Hook per invalidare la cache dei sub-users
 */
export function useInvalidateSubUsers() {
  const queryClient = useQueryClient()

  return () => {
    queryClient.invalidateQueries({ queryKey: ['sub-users'] })
    queryClient.invalidateQueries({ queryKey: ['sub-users-stats'] })
    queryClient.invalidateQueries({ queryKey: ['all-clients'] })
  }
}

/**
 * Hook per ottenere tutti i clienti in modo gerarchico (Superadmin/Admin)
 */
export function useAllClients() {
  return useQuery({
    queryKey: ['all-clients'],
    queryFn: async () => {
      const result = await getAllClientsForUser()
      if (!result.success) {
        throw new Error(result.error || 'Errore nel caricamento dei clienti')
      }
      return result.clients || {
        resellers: [],
        byocClients: [],
        stats: {
          totalResellers: 0,
          totalSubUsers: 0,
          totalBYOC: 0,
          totalWalletBalance: 0,
        },
      }
    },
    staleTime: 30_000, // 30 secondi
    refetchOnWindowFocus: true,
  })
}
