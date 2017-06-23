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
    partition(n: number): TransformChain<T[]>;
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
    partition(n: number): TransducerBuilder<TBase, T[]>;
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
        this.reduce(
            new SimpleTransformer((_: void, input: T) => f(input)),
            0 as any, // We need any non-undefined initial value.
        );
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
        return this.compose(t.take<T>(n));
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

    public partition(n: number): CombinedBuilder<TBase, T[]> {
        return this.compose(t.partitionAll<T>(n));
    }

    public partitionBy(pred: (item: T) => any): CombinedBuilder<TBase, T[]> {
        return this.compose(t.partitionBy(pred));
    }

    public interpose(separator: T): CombinedBuilder<TBase, T> {
        return this.compose(interpose(separator));
    }
}

class SimpleTransformer<TResult, TInput>
    implements t.Transformer<TResult, TInput> {
    constructor(
        private readonly reducer: (
            result: TResult,
            input: TInput,
        ) => TResult | t.Reduced<TResult>,
    ) {}

    public ["@@transducer/init"](): TResult {
        throw new Error("init not implemented");
    }

    public ["@@transducer/result"](result: TResult): TResult {
        return result;
    }

    public ["@@transducer/step"](
        result: TResult,
        input: TInput,
    ): TResult | t.Reduced<TResult> {
        return this.reducer(result, input);
    }
}

function keep<T, U>(f: (item: T) => U | null | void): t.Transducer<T, U> {
    return <TResult>(xf: t.CompletingTransformer<TResult, any, U>) =>
        new SimpleTransformer((result: TResult, input: T) => {
            const output = f(input);
            return output == null
                ? result
                : xf["@@transducer/step"](result, output);
        });
}

function dedupe<T>(): t.Transducer<T, T> {
    return <TResult>(xf: t.CompletingTransformer<TResult, any, T>) => {
        let last: T | {} = {};
        return new SimpleTransformer((result: TResult, input: T) => {
            if (input !== last) {
                last = input;
                return xf["@@transducer/step"](result, input);
            } else {
                return result;
            }
        });
    };
}

function interpose<T>(separator: T): t.Transducer<T, T> {
    return <TResult>(xf: t.CompletingTransformer<TResult, any, T>) => {
        let isStarted: boolean = false;
        return new SimpleTransformer((result: TResult, input: T) => {
            if (isStarted) {
                const withSeparator = xf["@@transducer/step"](
                    result,
                    separator,
                );
                if (t.isReduced(withSeparator)) {
                    return withSeparator;
                } else {
                    return xf["@@transducer/step"](
                        withSeparator as TResult,
                        input,
                    );
                }
            } else {
                isStarted = true;
                return xf["@@transducer/step"](result, input);
            }
        });
    };
}

const firstTransformerConstant: t.Transformer<any, any> = {
    ["@@transducer/init"]: () => null,
    ["@@transducer/result"]: (result: any) => result,
    ["@@transducer/step"]: (_: void, input: any) => t.reduced(input),
};

function firstTransformer<T>(): t.Transformer<T | null, T> {
    return firstTransformerConstant;
}

class TransducerIterable<TInput, TOutput> implements IterableIterator<TOutput> {
    private upcoming: Iterator<TOutput> = new ArrayIterator([]);

    constructor(
        private readonly xf: t.Transducer<TInput, TOutput>,
        private readonly iterator: Iterator<TInput>,
    ) {}

    public [Symbol.iterator](): IterableIterator<TOutput> {
        return this;
    }

    public next(): IteratorResult<TOutput> {
        const backlogged = this.upcoming.next();
        if (!backlogged.done) {
            return backlogged;
        } else {
            const { done, value } = this.iterator.next();
            if (done) {
                return { done } as any;
            } else {
                const outValues = t.into([], this.xf, [value]);
                this.upcoming = new ArrayIterator(outValues);
                return this.next();
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
