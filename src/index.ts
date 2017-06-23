import * as t from "transducers-js";

export interface TransformChain<T> {
    compose<U>(transducer: t.Transducer<T, U>): TransformChain<U>;

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
        reducer: t.Reducer<TResult, T>,
        initialValue: TResult,
    ): TResult;
    reduce<TResult, TCompleteResult>(
        transformer: t.CompletingTransformer<TResult, TCompleteResult, T>,
        initialValue?: TResult,
    ): TCompleteResult;

    toArray(): T[];
    toIterator(): IterableIterator<T>;
    forEach(f: (item: T) => void): void;
    first(): T | null;
}

export interface TransducerBuilder<TBase, T> {
    compose<U>(transducer: t.Transducer<T, U>): TransducerBuilder<TBase, U>;

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

    build(): t.Transducer<TBase, T>;
}

export function chainFrom<T>(collection: Iterable<T>): TransformChain<T> {
    return new TransducerChain<T, T>(collection);
}

export function transducerBuilder<T>(): TransducerBuilder<T, T> {
    return new TransducerChain<T, T>([]);
}

type CombinedBuilder<TBase, T> = TransformChain<T> &
    TransducerBuilder<TBase, T>;

class TransducerChain<TBase, T> implements CombinedBuilder<TBase, T> {
    private readonly transducers: Array<t.Transducer<any, any>> = [];

    constructor(private readonly collection: Iterable<TBase>) {}

    public compose<U>(
        transducer: t.Transducer<T, U>,
    ): CombinedBuilder<TBase, U> {
        this.transducers.push(transducer);
        return this as any;
    }

    public build(): t.Transducer<TBase, T> {
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

    public reduce<TResult>(
        reducer: t.Reducer<TResult, T>,
        initialValue: TResult,
    ): TResult;
    public reduce<TResult, TCompleteResult>(
        transformer: t.CompletingTransformer<TResult, TCompleteResult, T>,
        initialValue?: TResult,
    ): TCompleteResult;
    public reduce<TResult, TCompleteResult>(
        transformer:
            | t.Reducer<TResult, T>
            | t.CompletingTransformer<TResult, TCompleteResult, T>,
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

    public toIterator(): IterableIterator<T> {
        return new TransducerIterable(
            this.build(),
            this.collection[Symbol.iterator](),
        );
    }

    public forEach(f: (item: T) => void): void {
        this.reduce(new ForEachTransformer(f));
    }

    public first(): T | null {
        return this.reduce(firstTransformer<T>());
    }

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
}

type QuittingReducer<TResult, TInput> = (
    result: TResult,
    input: TInput,
) => TResult | t.Reduced<TResult>;

class SimpleDelegatingTransformer<TResult, TCompleteResult, TInput, TOutput>
    implements t.CompletingTransformer<TResult, TCompleteResult, TInput> {
    private readonly step: QuittingReducer<TResult, TInput>;

    constructor(
        private readonly xf: t.CompletingTransformer<
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
): t.Transducer<T, U> {
    return <R>(xf: t.CompletingTransformer<R, any, U>) =>
        new SimpleDelegatingTransformer(
            xf,
            (reducer: QuittingReducer<R, U>) => (result: R, input: T) =>
                f(reducer, result, input),
        );
}

function keep<T, U>(f: (item: T) => U | null | void): t.Transducer<T, U> {
    return makeTransducer(<
        R
    >(reducer: QuittingReducer<R, U>, result: R, input: T) => {
        const output = f(input);
        return output == null ? result : reducer(result, output);
    });
}

function dedupe<T>(): t.Transducer<T, T> {
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
function take<T>(n: number): t.Transducer<T, T> {
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

function interpose<T>(separator: T): t.Transducer<T, T> {
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

class ForEachTransformer<T> implements t.Transformer<void, T> {
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

const FIRST_TRANSFORMER: t.Transformer<any, any> = {
    ["@@transducer/init"]: () => null,
    ["@@transducer/result"]: (result: any) => result,
    ["@@transducer/step"]: (_: any, input: any) => t.reduced(input),
};

function firstTransformer<T>(): t.Transformer<T | null, T> {
    return FIRST_TRANSFORMER;
}

const TO_ARRAY_TRANSFORMER: t.Transformer<any[], any> = {
    ["@@transducer/init"]: () => [],
    ["@@transducer/result"]: (result: any[]) => result,
    ["@@transducer/step"]: (result: any[], input: any) => {
        result.push(input);
        return result;
    },
};

function toArrayTransformer<T>(): t.Transformer<T[], T> {
    return TO_ARRAY_TRANSFORMER;
}

class TransducerIterable<TInput, TOutput> implements IterableIterator<TOutput> {
    private readonly xfToArray: t.Transformer<TOutput[], TInput>;
    private upcoming: Iterator<TOutput> = new ArrayIterator([]);
    private hasSeenEnd: boolean = false;

    constructor(
        xf: t.Transducer<TInput, TOutput>,
        private readonly iterator: Iterator<TInput>,
    ) {
        this.xfToArray = xf(toArrayTransformer<TOutput>());
    }

    public [Symbol.iterator](): IterableIterator<TOutput> {
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

class ArrayIterator<T> implements IterableIterator<T> {
    private i: number = 0;

    constructor(private readonly array: T[]) {}

    public [Symbol.iterator]() {
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
