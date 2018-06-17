import { filter, remove } from "./transducers";
import { Comparator, CompletingTransformer, Transformer } from "./types";
import { reduced } from "./util";

// Transformers with no parameters, such as the one for count() here, are
// created the first time they are called so they can be tree shaken if unused.
// Tree shaking does not remove top-level object literal constants.

let countTransformer: Transformer<number, any> | undefined;

export function count(): Transformer<number, any> {
    if (!countTransformer) {
        countTransformer = {
            ["@@transducer/init"]: () => 0,
            ["@@transducer/result"]: (result: number) => result,
            ["@@transducer/step"]: (result: number) => result + 1,
        };
    }
    return countTransformer;
}

export function every<T>(
    pred: (item: T, index: number) => boolean,
): Transformer<boolean, T> {
    return remove(pred)(isEmpty());
}

export function find<T>(
    pred: (item: T, index: number) => boolean,
): Transformer<T | null, T> {
    return filter(pred)(first());
}

let firstTransformer: Transformer<any, any> | undefined;

export function first<T>(): Transformer<T | null, T> {
    if (!firstTransformer) {
        firstTransformer = {
            ["@@transducer/init"]: () => null,
            ["@@transducer/result"]: (result: any) => result,
            ["@@transducer/step"]: (_: any, input: any) => reduced(input),
        };
    }
    return firstTransformer;
}

class ForEachTransformer<T> implements Transformer<void, T> {
    private i = 0;

    constructor(private readonly f: (input: T, index: number) => void) {}

    public ["@@transducer/init"]() {
        return undefined;
    }

    public ["@@transducer/result"]() {
        return undefined;
    }

    public ["@@transducer/step"](_: void, input: T) {
        return this.f(input, this.i++);
    }
}

export function forEach<T>(
    f: (input: T, i: number) => void,
): Transformer<void, T> {
    return new ForEachTransformer(f);
}

let isEmptyTransformer: Transformer<boolean, any> | undefined;

export function isEmpty(): Transformer<boolean, any> {
    if (!isEmptyTransformer) {
        isEmptyTransformer = {
            ["@@transducer/init"]: () => true,
            ["@@transducer/result"]: (result: boolean) => result,
            ["@@transducer/step"]: () => reduced(false),
        };
    }
    return isEmptyTransformer;
}

class JoinToString implements CompletingTransformer<any[], string, any> {
    constructor(private readonly separator: string) {}

    public ["@@transducer/init"]() {
        return [];
    }

    public ["@@transducer/result"](result: any[]) {
        return result.join(this.separator);
    }

    public ["@@transducer/step"](result: any[], input: any) {
        result.push(input);
        return result;
    }
}

export function joinToString(
    separator: string,
): CompletingTransformer<any[], string, any> {
    return new JoinToString(separator);
}

let isNotEmptyTransformer: Transformer<boolean, any> | undefined;

export function some<T>(
    pred: (item: T, i: number) => boolean,
): Transformer<boolean, T> {
    if (!isNotEmptyTransformer) {
        isNotEmptyTransformer = {
            ["@@transducer/init"]: () => false,
            ["@@transducer/result"]: (result: boolean) => result,
            ["@@transducer/step"]: () => reduced(true),
        };
    }
    return filter(pred)(isNotEmptyTransformer);
}

let averageTransformer:
    | CompletingTransformer<[number, number], number | null, number>
    | undefined;

export function toAverage(): CompletingTransformer<
    [number, number],
    number | null,
    number
> {
    if (!averageTransformer) {
        averageTransformer = {
            ["@@transducer/init"]: () => [0, 0],
            ["@@transducer/result"]: (result: [number, number]) =>
                result[1] === 0 ? null : result[0] / result[1],
            ["@@transducer/step"]: (
                result: [number, number],
                input: number,
            ) => {
                result[0] += input;
                result[1]++;
                return result;
            },
        };
    }
    return averageTransformer;
}

class Min<T> implements Transformer<T | null, T> {
    constructor(private readonly comparator: Comparator<T>) {}

    public ["@@transducer/init"]() {
        return null;
    }

    public ["@@transducer/result"](result: T | null) {
        return result;
    }

    public ["@@transducer/step"](result: T | null, input: T) {
        return result === null || this.comparator(input, result) < 0
            ? input
            : result;
    }
}

function invertComparator<T>(comparator: Comparator<T>): Comparator<T> {
    return (a, b) => -comparator(a, b);
}

const NATURAL_COMPARATOR: Comparator<number> = (a: number, b: number) => {
    if (a < b) {
        return -1;
    } else {
        return a > b ? 1 : 0;
    }
};

export function toMax(): Transformer<number | null, number>;
export function toMax<T>(
    comparator: (a: T, b: T) => number,
): Transformer<T | null, T>;
export function toMax(
    comparator: (a: any, b: any) => number = NATURAL_COMPARATOR,
): Transformer<any, any> {
    return new Min(invertComparator(comparator));
}

export function toMin(): Transformer<number | null, number>;
export function toMin<T>(
    comparator: (a: T, b: T) => number,
): Transformer<T | null, T>;
export function toMin(
    comparator: (a: any, b: any) => number = NATURAL_COMPARATOR,
): Transformer<any, any> {
    return new Min(comparator);
}

let toObjectTransformer:
    | Transformer<{ [key: string]: any }, [string, any]>
    | undefined;

export function toObject<T>(): Transformer<{ [key: string]: T }, [string, T]> {
    if (!toObjectTransformer) {
        toObjectTransformer = {
            ["@@transducer/init"]: () => ({}),
            ["@@transducer/result"]: (result: { [key: string]: any }) => result,
            ["@@transducer/step"]: (
                result: { [key: string]: any },
                [key, value]: [string, any],
            ) => {
                result[key] = value;
                return result;
            },
        };
    }
    return toObjectTransformer;
}

let sumTransformer: Transformer<number, number> | undefined;

export function toSum(): Transformer<number, number> {
    if (!sumTransformer) {
        sumTransformer = {
            ["@@transducer/init"]: () => 0,
            ["@@transducer/result"]: (result: number) => result,
            ["@@transducer/step"]: (result: number, input: number) => {
                return result + input;
            },
        };
    }
    return sumTransformer;
}

let toArrayTransformer: Transformer<any[], any> | undefined;

export function toArray<T>(): Transformer<T[], T> {
    if (!toArrayTransformer) {
        toArrayTransformer = {
            ["@@transducer/init"]: () => [],
            ["@@transducer/result"]: (result: any[]) => result,
            ["@@transducer/step"]: (result: any[], input: any) => {
                result.push(input);
                return result;
            },
        };
    }
    return toArrayTransformer;
}
