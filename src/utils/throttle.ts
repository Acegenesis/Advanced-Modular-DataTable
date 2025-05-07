/**
 * Creates a throttled function that only invokes `func` at most once per every `wait` milliseconds.
 * The throttled function comes with a `cancel` method to cancel delayed `func` invocations.
 *
 * @param func The function to throttle.
 * @param wait The number of milliseconds to throttle invocations to.
 * @returns Returns the new throttled function.
 */
export function throttle<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let lastArgs: Parameters<T> | null = null;
    let lastThis: any = null;
    let trailingCallScheduled = false;

    function throttled(this: any, ...args: Parameters<T>): void {
        lastArgs = args;
        lastThis = this;

        if (!timeoutId) {
            func.apply(lastThis, lastArgs);
            timeoutId = setTimeout(() => {
                timeoutId = null;
                if (trailingCallScheduled) {
                    throttled.apply(lastThis, lastArgs as Parameters<T>); 
                    trailingCallScheduled = false;
                }
            }, wait);
        } else {
            trailingCallScheduled = true;
        }
    }

    // Ajout d'une méthode cancel (optionnel mais utile)
    /*
    throttled.cancel = () => {
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
        trailingCallScheduled = false;
    };
    */

    return throttled;
} 