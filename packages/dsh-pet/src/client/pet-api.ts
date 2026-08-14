/**
 * Shared browser-side pet HTTP API (same-origin JSON endpoints).
 * Both the floating pet entry and the settings card talk to the host
 * through this single client.
 * @module @linxin666/dsh-pet/client/pet-api
 */

import type { PetDisplayConfig } from '../persist.ts'
import type { PetInteractResult, PetStateView } from '../service.ts'
import type { PetInteraction } from '../affinity.ts'

/** The host pet API as the browser sees it (same-origin JSON endpoints). */
export interface PetHttpApi {
  state(): Promise<PetStateView>
  interact(kind: PetInteraction): Promise<PetInteractResult>
  setVisible(visible: boolean): Promise<{ ok: true; display: PetDisplayConfig }>
  setConfig(patch: Partial<PetDisplayConfig>): Promise<{ ok: true; display: PetDisplayConfig }>
  setName(name: string): Promise<{ ok: true; name: string } | { ok: false; error: string }>
  setSkin(skinId: string): Promise<{ ok: true; skin: string } | { ok: false; error: string }>
}

/** Same-origin JSON fetch helper (GET without body, POST with JSON body). */
async function petFetch<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, body === undefined
    ? {}
    : {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
  if (!response.ok) {
    throw new Error(`pet ${path} failed: ${response.status}`)
  }
  return (await response.json()) as T
}

/** The live host API instance (always defined; failures surface per call). */
export const petApi: PetHttpApi = {
  state: () => petFetch('/api/pet/state'),
  interact: (kind) => petFetch('/api/pet/interact', { kind }),
  setVisible: (visible) => petFetch('/api/pet/set-visible', { visible }),
  setConfig: (patch) => petFetch('/api/pet/set-config', patch),
  setName: (name) => petFetch('/api/pet/set-name', { name }),
  setSkin: (skinId) => petFetch('/api/pet/set-skin', { skin: skinId }),
}
