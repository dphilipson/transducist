import { INIT, RESULT, STEP, VALUE } from "./propertyNames";
import { filter, remove } from "./transducers";
import { Comparator, CompletingTransformer, Transformer } from "./types";
import { isReduced, reduced } from "./util";

// Transformers with no parameters, such as the one for count() here, are
// created the first time they are called so they can be tree shaken if unused.
// Tree shaking does not remove top-level object literal constants if they have
// computed keys.

let countTransformer: Transformer<number, any> | undefined;

export function count(): Transformer<number, any> {
    if (!countTransformer) {
        countTransformer = {
            [INIT]: () => 0,
            [RESULT]: (result: number) => result,
            [STEP]: (result: number) => result + 1,
        };
    }
    return countTransformer;
}

export function every<T>(pred: (item: T) => boolean): Transformer<boolean, T> {
    return remove(pred)(isEmpty());
}

export function find<T, U extends T>(
    pred: (item: T) => item is U,
): Transformer<U | null, T>;
export function find<T>(pred: (item: T) => boolean): Transformer<T | null, T>;
export function find<T>(pred: (item: T) => boolean): Transformer<T | null, T> {
    return filter(pred)(first());
}

let firstTransformer: Transformer<any, any> | undefined;

export function first<T>(): Transformer<T | null, T> {
    if (!firstTransformer) {
        firstTransformer = {
            [INIT]: () => null,
            [RESULT]: (result: any) => result,
            [STEP]: (_: any, input: any) => reduced(input),
        };
    }
    return firstTransformer;
}

class ForEachTransformer<T> implements Transformer<void, T> {
    constructor(private readonly f: (input: T) => void) {}

    public [INIT]() {
        return undefined;
    }

    public [RESULT]() {
        return undefined;
    }

    public [STEP](_: void, input: T) {
        return this.f(input);
    }
}

export function forEach<T>(f: (input: T) => void): Transformer<void, T> {
    return new ForEachTransformer(f);
}

let isEmptyTransformer: Transformer<boolean, any> | undefined;

export function isEmpty(): Transformer<boolean, any> {
    if (!isEmptyTransformer) {
        isEmptyTransformer = {
            [INIT]: () => true,
            [RESULT]: (result: boolean) => result,
            [STEP]: () => reduced(false),
        };
    }
    return isEmptyTransformer;
}

class JoinToString implements CompletingTransformer<any[], string, any> {
    constructor(private readonly separator: string) {}

    public [INIT]() {
        return [];
    }

    public [RESULT](result: any[]) {
        return result.join(this.separator);
    }

    public [STEP](result: any[], input: any) {
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

export function some<T>(pred: (item: T) => boolean): Transformer<boolean, T> {
    if (!isNotEmptyTransformer) {
        isNotEmptyTransformer = {
            [INIT]: () => false,
            [RESULT]: (result: boolean) => result,
            [STEP]: () => reduced(true),
        };
    }
    return filter(pred)(isNotEmptyTransformer);
}

let toArrayTransformer: Transformer<any[], any> | undefined;

export function toArray<T>(): Transformer<T[], T> {
    if (!toArrayTransformer) {
        toArrayTransformer = {
            [INIT]: () => [],
            [RESULT]: (result: any[]) => result,
            [STEP]: (result: any[], input: any) => {
                result.push(input);
                return result;
            },
        };
    }
    return toArrayTransformer;
}

class ToMap<T, K, V> implements Transformer<Map<K, V>, T> {
    constructor(
        private readonly getKey: (item: T) => K,
        private readonly getValue: (item: T) => V,
    ) {}

    public [INIT](): Map<K, V> {
        return new Map();
    }

    public [RESULT](result: Map<K, V>): Map<K, V> {
        return result;
    }

    public [STEP](result: Map<K, V>, item: T): Map<K, V> {
        result.set(this.getKey(item), this.getValue(item));
        return result;
    }
}

export function toMap<T, K, V>(
    getKey: (item: T) => K,
    getValue: (item: T) => V,
): Transformer<Map<K, V>, T> {
    return new ToMap(getKey, getValue);
}

class InProgressTransformer<TResult, TCompleteResult, TInput> {
    private result: TResult;
    private isReduced = false;

    public constructor(
        private readonly xf: CompletingTransformer<
            TResult,
            TCompleteResult,
            TInput
        >,
    ) {
        this.result = xf[INIT]();
    }

    public step(input: TInput): void {
        if (!this.isReduced) {
            const newResult = this.xf[STEP](this.result, input);
            if (isReduced(newResult)) {
                this.result = newResult[VALUE];
                this.isReduced = true;
            } else {
                this.result = newResult;
            }
        }
    }

    public getResult(): TCompleteResult {
        return this.xf[RESULT](this.result);
    }
}

class ToMapGroupBy<T, K, V>
    implements
        CompletingTransformer<
            Map<K, InProgressTransformer<any, V, T>>,
            Map<K, V>,
            T
        > {
    constructor(
        private readonly getKey: (item: T) => K,
        private readonly xf: CompletingTransformer<any, V, T>,
    ) {}

    public [INIT](): Map<K, InProgressTransformer<any, V, T>> {
        return new Map();
    }

    public [RESULT](
        result: Map<K, InProgressTransformer<any, V, T>>,
    ): Map<K, V> {
        const completeResult = new Map<K, V>();
        const entries = result.entries();
        for (let step = entries.next(); !step.done; step = entries.next()) {
            const [key, value] = step.value;
            completeResult.set(key, value.getResult());
        }
        return completeResult;
    }

    public [STEP](
        result: Map<K, InProgressTransformer<any, V, T>>,
        item: T,
    ): Map<K, InProgressTransformer<any, V, T>> {
        const key = this.getKey(item);
        if (!result.has(key)) {
            result.set(key, new InProgressTransformer(this.xf));
        }
        result.get(key)!.step(item);
        return result;
    }
}

export function toMapGroupBy<T, K>(
    getKey: (item: T) => K,
): Transformer<Map<K, T[]>, T>;
export function toMapGroupBy<T, K, V>(
    getKey: (item: T) => K,
    transformer: CompletingTransformer<any, V, T>,
): Transformer<Map<K, V>, T>;
export function toMapGroupBy<T, K>(
    getKey: (item: T) => K,
    transformer: CompletingTransformer<any, any, T> = toArray(),
): Transformer<Map<K, any>, T> {
    return new ToMapGroupBy(getKey, transformer);
}

class ToObject<T, K extends keyof any, V>
    implements Transformer<Record<K, V>, T> {
    constructor(
        private readonly getKey: (item: T) => K,
        private readonly getValue: (item: T) => V,
    ) {}

    public [INIT](): Record<K, V> {
        return {} as any;
    }

    public [RESULT](result: Record<K, V>): Record<K, V> {
        return result;
    }

    public [STEP](result: Record<K, V>, item: T): Record<K, V> {
        result[this.getKey(item)] = this.getValue(item);
        return result;
    }
}

export function toObject<T, K extends keyof any, V>(
    getKey: (item: T) => K,
    getValue: (item: T) => V,
): Transformer<Record<K, V>, T> {
    return new ToObject(getKey, getValue);
}

class ToObjectGroupBy<T, K extends keyof any, V>
    implements
        CompletingTransformer<
            Record<K, InProgressTransformer<any, V, T>>,
            Record<K, V>,
            T
        > {
    constructor(
        private readonly getKey: (item: T) => K,
        private readonly xf: CompletingTransformer<any, V, T>,
    ) {}

    public [INIT](): Record<K, InProgressTransformer<any, V, T>> {
        return {} as any;
    }

    public [RESULT](
        result: Record<K, InProgressTransformer<any, V, T>>,
    ): Record<K, V> {
        const completeResult: Record<K, V> = {} as any;
        Object.keys(result).forEach(
            key =>
                ((completeResult as any)[key] = (result as any)[
                    key
                ].getResult()),
        );
        return completeResult;
    }

    public [STEP](
        result: Record<K, InProgressTransformer<any, V, T>>,
        item: T,
    ): Record<K, InProgressTransformer<any, V, T>> {
        const key = this.getKey(item);
        if (!result[key]) {
            result[key] = new InProgressTransformer(this.xf);
        }
        result[key].step(item);
        return result;
    }
}

export function toObjectGroupBy<T, K extends keyof any, V>(
    getKey: (item: T) => K,
): Transformer<Record<K, V[]>, V>;
export function toObjectGroupBy<T, K extends keyof any, V>(
    getKey: (item: T) => K,
    transformer: CompletingTransformer<any, V, T>,
): Transformer<Record<K, V>, T>;
export function toObjectGroupBy<T, K extends keyof any>(
    getKey: (item: T) => K,
    transformer: CompletingTransformer<any, any, T> = toArray(),
): Transformer<Record<K, any>, T> {
    return new ToObjectGroupBy(getKey, transformer);
}

let toSetTransformer: Transformer<Set<any>, any> | undefined;

export function toSet<T>(): Transformer<Set<T>, T> {
    if (!toSetTransformer) {
        toSetTransformer = {
            [INIT]: () => new Set(),
            [RESULT]: (result: Set<any>) => result,
            [STEP]: (result: Set<any>, input: any) => {
                result.add(input);
                return result;
            },
        };
    }
    return toSetTransformer;
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
            [INIT]: () => [0, 0],
            [RESULT]: (result: [number, number]) =>
                result[1] === 0 ? null : result[0] / result[1],
            [STEP]: (result: [number, number], input: number) => {
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

    public [INIT]() {
        return null;
    }

    public [RESULT](result: T | null) {
        return result;
    }

    public [STEP](result: T | null, input: T) {
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

export function max(): Transformer<number | null, number>;
export function max<T>(comparator: Comparator<T>): Transformer<T | null, T>;
export function max(
    comparator: Comparator<any> = NATURAL_COMPARATOR,
): Transformer<any, any> {
    return new Min(invertComparator(comparator));
}

export function min(): Transformer<number | null, number>;
export function min<T>(comparator: Comparator<T>): Transformer<T | null, T>;
export function min(
    comparator: Comparator<any> = NATURAL_COMPARATOR,
): Transformer<any, any> {
    return new Min(comparator);
}

let sumTransformer: Transformer<number, number> | undefined;

export function sum(): Transformer<number, number> {
    if (!sumTransformer) {
        sumTransformer = {
            [INIT]: () => 0,
            [RESULT]: (result: number) => result,
            [STEP]: (result: number, input: number) => {
                return result + input;
            },
        };
    }
    return sumTransformer;
}
