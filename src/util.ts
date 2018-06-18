import { Reduced, Transducer } from "./types";

export function reduced<T>(result: T): Reduced<T> {
    return {
        "@@transducer/reduced": true,
        "@@transducer/value": result,
    };
}

export function isReduced<T>(result: T | Reduced<T>): result is Reduced<T> {
    return result && (result as any)["@@transducer/reduced"] === true;
}

export function ensureReduced<T>(result: T | Reduced<T>): Reduced<T> {
    return isReduced(result) ? result : reduced(result);
}

export function unreduced<T>(result: T | Reduced<T>): T {
    return isReduced(result) ? result["@@transducer/value"] : result;
}

export function compose<T0>(): Transducer<T0, T0>;
export function compose<T0, T1>(f0: Transducer<T0, T1>): Transducer<T0, T1>;
export function compose<T0, T1, T2>(
    f0: Transducer<T0, T1>,
    f1: Transducer<T1, T2>,
): Transducer<T0, T2>;
export function compose<T0, T1, T2, T3>(
    f0: Transducer<T0, T1>,
    f1: Transducer<T1, T2>,
    f2: Transducer<T2, T3>,
): Transducer<T0, T3>;
export function compose<T0, T1, T2, T3, T4>(
    f0: Transducer<T0, T1>,
    f1: Transducer<T1, T2>,
    f2: Transducer<T2, T3>,
    f3: Transducer<T3, T4>,
): Transducer<T0, T4>;
export function compose<T0, T1, T2, T3, T4, T5>(
    f0: Transducer<T0, T1>,
    f1: Transducer<T1, T2>,
    f2: Transducer<T2, T3>,
    f3: Transducer<T3, T4>,
    f4: Transducer<T4, T5>,
): Transducer<T0, T5>;
export function compose<T0, T1, T2, T3, T4, T5, T6>(
    f0: Transducer<T0, T1>,
    f1: Transducer<T1, T2>,
    f2: Transducer<T2, T3>,
    f3: Transducer<T3, T4>,
    f4: Transducer<T4, T5>,
    f5: Transducer<T5, T6>,
): Transducer<T0, T6>;
export function compose<T0, T1, T2, T3, T4, T5, T6, T7>(
    f0: Transducer<T0, T1>,
    f1: Transducer<T1, T2>,
    f2: Transducer<T2, T3>,
    f3: Transducer<T3, T4>,
    f4: Transducer<T4, T5>,
    f5: Transducer<T5, T6>,
    f6: Transducer<T6, T7>,
): Transducer<T0, T7>;
export function compose<T0, T1, T2, T3, T4, T5, T6, T7, T8>(
    f0: Transducer<T0, T1>,
    f1: Transducer<T1, T2>,
    f2: Transducer<T2, T3>,
    f3: Transducer<T3, T4>,
    f4: Transducer<T4, T5>,
    f5: Transducer<T5, T6>,
    f6: Transducer<T6, T7>,
    f7: Transducer<T7, T8>,
): Transducer<T0, T8>;
export function compose<T0, T1, T2, T3, T4, T5, T6, T7, T8>(
    f0: Transducer<T0, T1>,
    f1: Transducer<T1, T2>,
    f2: Transducer<T2, T3>,
    f3: Transducer<T3, T4>,
    f4: Transducer<T4, T5>,
    f5: Transducer<T5, T6>,
    f6: Transducer<T6, T7>,
    f7: Transducer<T7, T8>,
    ...rest: Array<Transducer<any, any>>
): Transducer<T0, any>;
export function compose(...fs: any[]): any {
    return (x: any) => {
        let result = x;
        for (let i = fs.length - 1; i >= 0; i--) {
            result = fs[i](result);
        }
        return result;
    };
}
