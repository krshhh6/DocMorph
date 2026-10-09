/**
 * Forensic Engine Configuration Flags
 * 
 * All feature flags default to OFF (false).
 * Flipping all flags to false guarantees 100% identical behavior to the baseline.
 */

export interface ForensicsConfig {
  useNullDetectors: boolean      // Phase 2: return null instead of 50 for detectors that cannot run
  useQualityBadge: boolean       // Phase 3: advisory quality badge & strict inconclusive gate
  useAiClassifier: boolean       // Phase 4: extra pretrained neural classifier signal
  useProvenanceSignals: boolean  // Phase 5: additive-only provenance & perceptual hashing
  aiClassifierWeight: number     // Phase 4: blend weight w (0.0 to 0.5)
}

export const forensicsConfig: ForensicsConfig = {
  useNullDetectors: true,
  useQualityBadge: true,
  useAiClassifier: true,
  useProvenanceSignals: true,
  aiClassifierWeight: 0.25,
}

export function setForensicsConfig(overrides: Partial<ForensicsConfig>): ForensicsConfig {
  Object.assign(forensicsConfig, overrides)
  return forensicsConfig
}

export function resetForensicsConfig(): ForensicsConfig {
  forensicsConfig.useNullDetectors = false
  forensicsConfig.useQualityBadge = false
  forensicsConfig.useAiClassifier = false
  forensicsConfig.useProvenanceSignals = false
  forensicsConfig.aiClassifierWeight = 0.0
  return forensicsConfig
}
