/**
 * `lookup`, asked at most once per key for the life of the build. Later calls
 * share the first call's promise, so lookups still in flight are shared too.
 */
export function memoise<T>(
    lookup: (key: string) => Promise<T>,
): (key: string) => Promise<T> {
    const answers = new Map<string, Promise<T>>();
    return (key) => {
        let answer = answers.get(key);
        if (answer === undefined) {
            answer = lookup(key);
            answers.set(key, answer);
        }
        return answer;
    };
}
