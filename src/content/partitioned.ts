import type { Loader } from "astro/loaders";

type Data = Record<string, unknown>;

/**
 * `loader`, keeping only the entries whose data passes `keep`. Two of these
 * with opposite predicates split one set of files between two collections.
 *
 * Both halves are needed. A glob loader keeps an unchanged entry without
 * setting it again, so the sweep after loading is what re-judges yesterday's
 * entries against today. The gate on `set` covers the dev server's watcher,
 * which sets entries outside any load.
 */
export function partitioned(loader: Loader, keep: (data: Data) => boolean) {
    return {
        name: `partitioned-${loader.name}`,
        load: async (context) => {
            const { store } = context;
            await loader.load({
                ...context,
                store: {
                    ...store,
                    set: (entry) => keep(entry.data) && store.set(entry),
                },
            });
            for (const { id, data } of store.values()) {
                if (!keep(data)) store.delete(id);
            }
        },
    } satisfies Loader;
}
