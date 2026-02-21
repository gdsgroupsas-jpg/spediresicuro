// Main wizard component
export { ShipmentWizard, default } from './ShipmentWizard';

// Context and hooks
export {
  ShipmentWizardProvider,
  useShipmentWizard,
  type AddressData,
  type PackageData,
  type ServicesData,
  type PickupData,
  type CarrierData,
  type WizardStep,
  type ShipmentWizardData,
} from './ShipmentWizardContext';

// Step components
export { SenderStep } from './steps/SenderStep';
export { RecipientStep } from './steps/RecipientStep';
export { PackagesStep } from './steps/PackagesStep';
export { ServicesStep } from './steps/ServicesStep';
export { PickupStep } from './steps/PickupStep';
export { CarrierStep } from './steps/CarrierStep';
export { ConfirmStep } from './steps/ConfirmStep';

// UI components
export { WizardProgress } from './components/WizardProgress';
export { StepNavigation } from './components/StepNavigation';
