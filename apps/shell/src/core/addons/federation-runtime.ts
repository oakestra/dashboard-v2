import { loadRemote, registerRemotes } from '@module-federation/runtime';

/** The two Module Federation calls the loader needs, behind an interface so tests can fake them. */
export interface AddonModuleRuntime {
  register(name: string, entry: string): void;
  load(name: string): Promise<unknown>;
}

export const federationRuntime: AddonModuleRuntime = {
  register(name, entry) {
    // `force` drops whatever the runtime cached for this name, which is what makes a retry after a
    // failed load actually fetch the manifest again.
    registerRemotes([{ name, entry }], { force: true });
  },
  async load(name) {
    const module = await loadRemote<unknown>(`${name}/addon`);
    if (module === null || module === undefined) {
      throw new Error(`loadRemote("${name}/addon") returned nothing`);
    }
    return module;
  },
};
