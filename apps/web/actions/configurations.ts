'use server';

/**
 * Server Actions per Gestione Configurazioni Corrieri
 *
 * Facade non-breaking: export pubblici invariati,
 * implementazioni separate in file *.impl.ts.
 */

import type { CourierConfig, CourierConfigInput } from './configurations.types';
import {
  assignConfigurationToUserImpl,
  deleteConfigurationImpl,
  deletePersonalConfigurationImpl,
  setPersonalConfigurationAsDefaultImpl,
  updateConfigurationStatusImpl,
} from './configurations-management.impl';
import {
  removeSpedisciOnlineContractImpl,
  updateSpedisciOnlineContractImpl,
} from './configurations-contracts.impl';
import { getConfigurationImpl, listConfigurationsImpl } from './configurations-read.impl';
import { saveConfigurationImpl, savePersonalConfigurationImpl } from './configurations-upsert.impl';

export type { CourierConfig, CourierConfigInput } from './configurations.types';

export async function saveConfiguration(data: CourierConfigInput): Promise<{
  success: boolean;
  config?: CourierConfig;
  error?: string;
}> {
  return saveConfigurationImpl(data);
}

export async function savePersonalConfiguration(
  data: Omit<CourierConfigInput, 'is_default'> & { is_default?: never }
): Promise<{
  success: boolean;
  config?: CourierConfig;
  error?: string;
}> {
  return savePersonalConfigurationImpl(data);
}

export async function deletePersonalConfiguration(id: string): Promise<{
  success: boolean;
  error?: string;
  message?: string;
}> {
  return deletePersonalConfigurationImpl(id);
}

export async function deleteConfiguration(id: string): Promise<{
  success: boolean;
  error?: string;
  message?: string;
}> {
  return deleteConfigurationImpl(id);
}

export async function removeSpedisciOnlineContract(
  configId: string,
  contractCode: string
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  return removeSpedisciOnlineContractImpl(configId, contractCode);
}

export async function updateSpedisciOnlineContract(
  configId: string,
  oldContractCode: string,
  newContractCode: string,
  courierName: string
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  return updateSpedisciOnlineContractImpl(configId, oldContractCode, newContractCode, courierName);
}

export async function updateConfigurationStatus(
  id: string,
  isActive: boolean
): Promise<{
  success: boolean;
  error?: string;
  message?: string;
}> {
  return updateConfigurationStatusImpl(id, isActive);
}

export async function setPersonalConfigurationAsDefault(id: string): Promise<{
  success: boolean;
  error?: string;
  message?: string;
}> {
  return setPersonalConfigurationAsDefaultImpl(id);
}

export async function assignConfigurationToUser(
  userId: string,
  configId: string | null
): Promise<{
  success: boolean;
  error?: string;
  message?: string;
}> {
  return assignConfigurationToUserImpl(userId, configId);
}

export async function listConfigurations(): Promise<{
  success: boolean;
  configs?: CourierConfig[];
  currentUserEmail?: string;
  error?: string;
}> {
  return listConfigurationsImpl();
}

export async function getConfiguration(id: string): Promise<{
  success: boolean;
  config?: CourierConfig;
  error?: string;
}> {
  return getConfigurationImpl(id);
}
