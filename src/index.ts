import * as t from "transducers-js";

const ITERATOR_SYMBOL = typeof Symbol !== "undefined"
    ? Symbol.iterator
    : "@@iterator";

// ----- Common transducer interfaces -----

export interface Reduced<TResult> {
    ["@@transducer/reduced"]: boolean;
    ["@@transducer/value"]: TResult;
}

export type Reducer<TResult, TInput> = (
    result: TResult,
    input: TInput,
) => TResult;

export type Transducer<TInput, TOutput> = <TResult, TCompleteResult>(
    xf: CompletingTransformer<TResult, TCompleteResult, TOutput>,
) => CompletingTransformer<TResult, TCompleteResult, TInput>;

export interface CompletingTransformer<TResult, TCompleteResult, TInput> {
    ["@@transducer/init"](): TResult | void;
    ["@@transducer/step"](
        result: TResult,
        input: TInput,
    ): TResult | Reduced<TResult>;
    ["@@transducer/result"](result: TResult): TCompleteResult;
}

export type Transformer<TResult, TInput> = CompletingTransformer<
    TResult,
    TResult,
    TInput
>;

// ----- Library interfaces -----

export interface TransformChain<T> {
    compose<U>(transducer: Transducer<T, U>): TransformChain<U>;

    map<U>(f: (item: T) => U): TransformChain<U>;
    filter(pred: (item: T) => boolean): TransformChain<T>;
    remove(pred: (item: T) => boolean): TransformChain<T>;
    keep<U>(f: (item: T) => U | null | void): TransformChain<U>;
    mapcat<U>(f: (item: T) => U[]): TransformChain<U>;
    dedupe(): TransformChain<T>;
    take(n: number): TransformChain<T>;
    takeWhile(pred: (item: T) => boolean): TransformChain<T>;
    takeNth(n: number): TransformChain<T>;
    drop(n: number): TransformChain<T>;
    dropWhile(pred: (item: T) => boolean): TransformChain<T>;
    partitionAll(n: number): TransformChain<T[]>;
    partitionBy(pred: (item: T) => any): TransformChain<T[]>;
    interpose(separator: T): TransformChain<T>;

    reduce<TResult>(
        reducer: Reducer<TResult, T>,
        initialValue: TResult,
    ): TResult;
    reduce<TResult, TCompleteResult>(
        transformer: CompletingTransformer<TResult, TCompleteResult, T>,
        initialValue?: TResult,
    ): TCompleteResult;

    toArray(): T[];
    toIterator(): IterableIterator<T>;
    forEach(f: (item: T) => void): void;
    first(): T | null;
    find(pred: (item: T) => boolean): T | null;
    count(): number;
    stringJoin(separator: string): string;
}

export interface TransducerBuilder<TBase, T> {
    compose<U>(transducer: Transducer<T, U>): TransducerBuilder<TBase, U>;

    map<U>(f: (item: T) => U): TransducerBuilder<TBase, U>;
    filter(pred: (item: T) => boolean): TransducerBuilder<TBase, T>;
    remove(pred: (item: T) => boolean): TransducerBuilder<TBase, T>;
    keep<U>(f: (item: T) => U | null | void): TransducerBuilder<TBase, U>;
    mapcat<U>(f: (item: T) => U[]): TransducerBuilder<TBase, U>;
    dedupe(): TransducerBuilder<TBase, T>;
    take(n: number): TransducerBuilder<TBase, T>;
    takeWhile(pred: (item: T) => boolean): TransducerBuilder<TBase, T>;
    takeNth(n: number): TransducerBuilder<TBase, T>;
    drop(n: number): TransducerBuilder<TBase, T>;
    dropWhile(pred: (item: T) => boolean): TransducerBuilder<TBase, T>;
    partitionAll(n: number): TransducerBuilder<TBase, T[]>;
    partitionBy(pred: (item: T) => boolean): TransducerBuilder<TBase, T[]>;
    interpose(separator: T): TransducerBuilder<TBase, T>;

    build(): Transducer<TBase, T>;
}

export interface Dictionary<V> {
    [key: string]: V;
}

export type Comparator<T> = (a: T, b: T) => number;

// ----- Implementation begins -----

// ----- Main chain class implementation -----

export function chainFrom<T>(collection: Iterable<T>): TransformChain<T>;
export function chainFrom<V>(
    collection: Dictionary<V>,
): TransformChain<[string, V]>;
export function chainFrom(collection: any): any {
    // transduce() from transducers-js will handle object vs iterable.
    return new TransducerChain(collection);
}

export function transducerBuilder<T>(): TransducerBuilder<T, T> {
    return new TransducerChain<T, T>([]);
}

type CombinedBuilder<TBase, T> = TransformChain<T> &
    TransducerBuilder<TBase, T>;

class TransducerChain<TBase, T> implements CombinedBuilder<TBase, T> {
    private readonly transducers: Array<Transducer<any, any>> = [];

    constructor(private readonly collection: Iterable<TBase>) {}

    public compose<U>(transducer: Transducer<T, U>): CombinedBuilder<TBase, U> {
        this.transducers.push(transducer);
        return this as any;
    }

    public build(): Transducer<TBase, T> {
        // Don't use comp() from transducers-js because it fails on 0 or 1
        // inputs.
        return (x: any) => {
            let result = x;
            for (let i = this.transducers.length - 1; i >= 0; i--) {
                result = this.transducers[i](result);
            }
            return result;
        };
    }

    // ----- Composing transducers -----

    public map<U>(f: (item: T) => U): CombinedBuilder<TBase, U> {
        return this.compose(t.map(f));
    }

    public filter(pred: (item: T) => boolean): CombinedBuilder<TBase, T> {
        return this.compose(t.filter(pred));
    }

    public remove(pred: (item: T) => boolean): CombinedBuilder<TBase, T> {
        return this.compose(t.remove(pred));
    }

    public keep<U>(f: (item: T) => U | null | void): CombinedBuilder<TBase, U> {
        return this.compose(keep(f));
    }

    public mapcat<U>(f: (item: T) => U[]): CombinedBuilder<TBase, U> {
        return this.compose(t.mapcat(f));
    }

    public dedupe(): CombinedBuilder<TBase, T> {
        return this.compose(dedupe<T>());
    }

    public take(n: number): CombinedBuilder<TBase, T> {
        return this.compose(take<T>(n));
    }

    public takeWhile(pred: (item: T) => boolean): CombinedBuilder<TBase, T> {
        return this.compose(t.takeWhile(pred));
    }

    public takeNth(n: number): CombinedBuilder<TBase, T> {
        return this.compose(t.takeNth<T>(n));
    }

    public drop(n: number): CombinedBuilder<TBase, T> {
        return this.compose(t.drop<T>(n));
    }

    public dropWhile(pred: (item: T) => boolean): CombinedBuilder<TBase, T> {
        return this.compose(t.dropWhile(pred));
    }

    public partitionAll(n: number): CombinedBuilder<TBase, T[]> {
        return this.compose(t.partitionAll<T>(n));
    }

    public partitionBy(pred: (item: T) => any): CombinedBuilder<TBase, T[]> {
        return this.compose(t.partitionBy(pred));
    }

    public interpose(separator: T): CombinedBuilder<TBase, T> {
        return this.compose(interpose(separator));
    }

    // ----- Reductions -----

    public reduce<TResult>(
        reducer: Reducer<TResult, T>,
        initialValue: TResult,
    ): TResult;
    public reduce<TResult, TCompleteResult>(
        transformer: CompletingTransformer<TResult, TCompleteResult, T>,
        initialValue?: TResult,
    ): TCompleteResult;
    public reduce<TResult, TCompleteResult>(
        transformer:
            | Reducer<TResult, T>
            | CompletingTransformer<TResult, TCompleteResult, T>,
        initialValue: TResult,
    ): TCompleteResult {
        // Need to contort the type system a bit to get this overload.
        if (typeof transformer === "function") {
            const result: TResult = t.transduce<TResult, TBase, T>(
                this.build(),
                transformer,
                initialValue,
                this.collection,
            );
            // Safe because TResult and TCompleteResult are the same in this
            // case.
            return result as any;
        } else {
            if (initialValue === undefined) {
                return t.transduce<TResult, TCompleteResult, TBase, T>(
                    this.build(),
                    transformer,
                    this.collection,
                );
            } else {
                return t.transduce<TResult, TCompleteResult, TBase, T>(
                    this.build(),
                    transformer,
                    initialValue,
                    this.collection,
                );
            }
        }
    }

    public toArray(): T[] {
        return t.into([], this.build(), this.collection);
    }

    public forEach(f: (item: T) => void): void {
        this.reduce(new ForEachTransformer(f));
    }

    public first(): T | null {
        return this.reduce(new Find<T>(() => true));
    }

    public find(pred: (item: T) => boolean): T | null {
        return this.reduce(new Find(pred));
    }

    public count(): number {
        return this.reduce(COUNT_TRANSFORMER);
    }

    public stringJoin(separator: string): string {
        return this.reduce(new StringJoin(separator));
    }

    public toIterator(): IterableIterator<T> {
        const iterable: Iterator<T> = new TransducerIterable(
            this.build(),
            getIterator(this.collection),
        );
        // We can't satisfy the IterableIterator interface while functioning in
        // environments without Symbol, hence the cast.
        return iterable as any;
    }
}

// ----- Custom transducers -----

type QuittingReducer<TResult, TInput> = (
    result: TResult,
    input: TInput,
) => TResult | t.Reduced<TResult>;

class SimpleDelegatingTransformer<TResult, TCompleteResult, TInput, TOutput>
    implements CompletingTransformer<TResult, TCompleteResult, TInput> {
    private readonly step: QuittingReducer<TResult, TInput>;

    constructor(
        private readonly xf: CompletingTransformer<
            TResult,
            TCompleteResult,
            TOutput
        >,
        f: <TResult>(
            reducer: QuittingReducer<TResult, TOutput>,
        ) => QuittingReducer<TResult, TInput>,
    ) {
        this.step = f((result: TResult, input: TOutput) =>
            xf["@@transducer/step"](result, input),
        );
    }

    public ["@@transducer/init"](): TResult | void {
        return this.xf["@@transducer/init"]();
    }

    public ["@@transducer/result"](result: TResult): TCompleteResult {
        return this.xf["@@transducer/result"](result);
    }

    public ["@@transducer/step"](
        result: TResult,
        input: TInput,
    ): TResult | t.Reduced<TResult> {
        return this.step(result, input);
    }
}

/**
 * A helper for creating transducers. It makes defining a reducer equivalent to
 * defining a function of type (reducer -> reducer), which is much less verbose
 * than the full definition of (transformer -> transformer). After uncurrying,
 * (reducer -> reducer) is equivalent to the actual type used here:
 *
 *   ((reducer, result, input) -> newResult).
 */
function makeTransducer<T, U>(
    f: <R>(
        reducer: QuittingReducer<R, U>,
        result: R,
        input: T,
    ) => R | t.Reduced<R>,
): Transducer<T, U> {
    return <R>(xf: CompletingTransformer<R, any, U>) =>
        new SimpleDelegatingTransformer(
            xf,
            (reducer: QuittingReducer<R, U>) => (result: R, input: T) =>
                f(reducer, result, input),
        );
}

function keep<T, U>(f: (item: T) => U | null | void): Transducer<T, U> {
    return makeTransducer(<
        R
    >(reducer: QuittingReducer<R, U>, result: R, input: T) => {
        const output = f(input);
        return output == null ? result : reducer(result, output);
    });
}

function dedupe<T>(): Transducer<T, T> {
    let last: T | {} = {};
    return makeTransducer(<
        R
    >(reducer: QuittingReducer<R, T>, result: R, input: T) => {
        if (input !== last) {
            last = input;
            return reducer(result, input);
        } else {
            return result;
        }
    });
}

// Don't use take() from transducers-js because it reads one more element than
// necessary.
function take<T>(n: number): Transducer<T, T> {
    let i = 0;
    return makeTransducer(<
        R
    >(reducer: QuittingReducer<R, T>, result: R, input: T) => {
        if (i < n) {
            i++;
            const output = reducer(result, input);
            return i === n ? t.reduced(output) : output;
        } else {
            return t.reduced(result);
        }
    });
}

function interpose<T>(separator: T): Transducer<T, T> {
    let isStarted = false;
    return makeTransducer(<
        R
    >(reducer: QuittingReducer<R, T>, result: R, input: T) => {
        if (isStarted) {
            const withSeparator = reducer(result, separator);
            if (t.isReduced(withSeparator)) {
                return withSeparator;
            } else {
                return reducer(withSeparator as R, input);
            }
        } else {
            isStarted = true;
            return reducer(result, input);
        }
    });
}

// ----- Custom transformers -----

class ForEachTransformer<T> implements Transformer<void, T> {
    constructor(private readonly f: (input: T) => void) {}

    public ["@@transducer/init"]() {
        return undefined;
    }

    public ["@@transducer/result"]() {
        return undefined;
    }

    public ["@@transducer/step"](_: void, input: T) {
        return this.f(input);
    }
}

class Find<T> implements Transformer<T | null, T> {
    constructor(private readonly pred: (item: T) => boolean) {}

    public ["@@transducer/init"]() {
        return null;
    }

    public ["@@transducer/result"](result: T | null) {
        return result;
    }

    public ["@@transducer/step"](result: T | null, input: T) {
        if (this.pred(input)) {
            return t.reduced(input);
        } else {
            return result;
        }
    }
}

const COUNT_TRANSFORMER: Transformer<number, any> = {
    ["@@transducer/init"]: () => 0,
    ["@@transducer/result"]: (result: number) => result,
    ["@@transducer/step"]: (result: number) => {
        return result + 1;
    },
};

class StringJoin implements CompletingTransformer<any[], string, any> {
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

const SUM_TRANSFORMER: Transformer<number, number> = {
    ["@@transducer/init"]: () => 0,
    ["@@transducer/result"]: (result: number) => result,
    ["@@transducer/step"]: (result: number, input: number) => {
        return result + input;
    },
};

export function toSum(): Transformer<number, number> {
    return SUM_TRANSFORMER;
}

const AVERAGE_TRANSFORMER: CompletingTransformer<
    [number, number],
    number,
    number
> = {
    ["@@transducer/init"]: () => [0, 0],
    ["@@transducer/result"]: (result: [number, number]) =>
        result[0] / result[1],
    ["@@transducer/step"]: (result: [number, number], input: number) => {
        result[0] += input;
        result[1]++;
        return result;
    },
};

export function toAverage(): CompletingTransformer<
    [number, number],
    number,
    number
> {
    return AVERAGE_TRANSFORMER as any;
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

export function toMin<T extends number | string>(): Transformer<T | null, T> &
    Transformer<T | null, T>;
export function toMin<T>(
    comparator: (a: T, b: T) => number,
): Transformer<T | null, T>;
export function toMin(
    comparator: (a: any, b: any) => number = NATURAL_COMPARATOR,
): Transformer<any, any> {
    return new Min(comparator);
}

export function toMax<T extends number | string>(): Transformer<T | null, T> &
    Transformer<T | null, T>;
export function toMax<T>(
    comparator: (a: T, b: T) => number,
): Transformer<T | null, T>;
export function toMax(
    comparator: (a: any, b: any) => number = NATURAL_COMPARATOR,
): Transformer<any, any> {
    return new Min(invertComparator(comparator));
}

const TO_OBJECT_TRANSFORMER: Transformer<Dictionary<any>, [string, any]> = {
    ["@@transducer/init"]: () => ({}),
    ["@@transducer/result"]: (result: Dictionary<any>) => result,
    ["@@transducer/step"]: (
        result: Dictionary<any>,
        [key, value]: [string, any],
    ) => {
        result[key] = value;
        return result;
    },
};

export function toObject<T>(): Transformer<Dictionary<T>, [string, T]> {
    return TO_OBJECT_TRANSFORMER;
}

const TO_ARRAY_TRANSFORMER: Transformer<any[], any> = {
    ["@@transducer/init"]: () => [],
    ["@@transducer/result"]: (result: any[]) => result,
    ["@@transducer/step"]: (result: any[], input: any) => {
        result.push(input);
        return result;
    },
};

function toArrayTransformer<T>(): Transformer<T[], T> {
    return TO_ARRAY_TRANSFORMER;
}

// ----- Lazy computation -----

class TransducerIterable<TInput, TOutput> implements Iterator<TOutput> {
    private readonly xfToArray: Transformer<TOutput[], TInput>;
    private upcoming: Iterator<TOutput> = new ArrayIterator([]);
    private hasSeenEnd: boolean = false;

    constructor(
        xf: Transducer<TInput, TOutput>,
        private readonly iterator: Iterator<TInput>,
    ) {
        this.xfToArray = xf(toArrayTransformer<TOutput>());
    }

    public [ITERATOR_SYMBOL]() {
        return this;
    }

    public next(): IteratorResult<TOutput> {
        while (true) {
            const backlogged = this.upcoming.next();
            if (!backlogged.done) {
                return backlogged;
            } else if (this.hasSeenEnd) {
                return { done: true } as any;
            } else {
                const { done, value } = this.iterator.next();
                if (done) {
                    return { done } as any;
                } else {
                    const outValues = this.xfToArray["@@transducer/step"](
                        [],
                        value,
                    );
                    if (t.isReduced(outValues)) {
                        this.hasSeenEnd = true;
                    }
                    this.upcoming = new ArrayIterator(t.unreduced(outValues));
                }
            }
        }
    }
}

// ----- Iterator utilities -----

function isObject(x: any): boolean {
    return (
        x instanceof Object &&
        Object.getPrototypeOf(x) === Object.getPrototypeOf({})
    );
}

/**
 * For compatibility with environments where common types aren't iterable.
 */
function getIterator<T>(collection: Iterable<T>): Iterator<T>;
function getIterator<V>(object: Dictionary<V>): Iterator<[string, V]>;
function getIterator(collection: any): Iterator<any> {
    const anyCollection = collection as any;
    if (anyCollection[ITERATOR_SYMBOL]) {
        return anyCollection[ITERATOR_SYMBOL]();
    } else if (Array.isArray(anyCollection)) {
        return new ArrayIterator(anyCollection);
    } else if (typeof anyCollection === "string") {
        return new ArrayIterator(anyCollection.split("")) as any;
    } else if (isObject(anyCollection)) {
        return new ArrayIterator(
            Object.keys(anyCollection).map((key: string) => [
                key,
                anyCollection[key],
            ]),
        );
    } else {
        throw new Error(
            "Cannot get iterator of non iterable value: " + collection,
        );
    }
}

class ArrayIterator<T> implements Iterator<T> {
    private i: number = 0;

    constructor(private readonly array: T[]) {}

    public [ITERATOR_SYMBOL]() {
        return this;
    }

    public next(): IteratorResult<T> {
        const { i, array } = this;
        if (i < array.length) {
            this.i++;
            return { done: false, value: array[i] };
        } else {
            return { done: true } as any;
        }
    }
}
