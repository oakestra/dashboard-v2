import { createContext, useContext } from 'react';

import { DEFAULT_PRESET, type Preset } from './preset';

// Defaults to the no-preset behavior, so components rendered without the app providers (unit
// tests of single components) behave like a deployment without a preset.
export const PresetContext = createContext<Preset>(DEFAULT_PRESET);

export function usePreset(): Preset {
  return useContext(PresetContext);
}
