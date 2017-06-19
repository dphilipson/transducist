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

    reduce<ResultT>(
        reducer: t.Reducer<ResultT, T>,
        initialValue: ResultT,
    ): ResultT;
    reduce<ResultT, CompleteResultT>(
        transformer: t.CompletingTransformer<ResultT, CompleteResultT, T>,
        initialValue?: ResultT,
    ): CompleteResultT;

    toArray(): T[];
    toIterator(): IterableIterator<T>;
    forEach(f: (item: T) => void): void;
    first(): T | null;
}

export interface TransducerBuilder<BaseT, T> {
    compose<U>(transducer: t.Transducer<T, U>): TransducerBuilder<BaseT, U>;

    map<U>(f: (item: T) => U): TransducerBuilder<BaseT, U>;
    filter(pred: (item: T) => boolean): TransducerBuilder<BaseT, T>;
    remove(pred: (item: T) => boolean): TransducerBuilder<BaseT, T>;
    keep<U>(f: (item: T) => U | null | void): TransducerBuilder<BaseT, U>;
    mapcat<U>(f: (item: T) => U[]): TransducerBuilder<BaseT, U>;
    dedupe(): TransducerBuilder<BaseT, T>;
    take(n: number): TransducerBuilder<BaseT, T>;
    takeWhile(pred: (item: T) => boolean): TransducerBuilder<BaseT, T>;
    takeNth(n: number): TransducerBuilder<BaseT, T>;
    drop(n: number): TransducerBuilder<BaseT, T>;
    dropWhile(pred: (item: T) => boolean): TransducerBuilder<BaseT, T>;
    partition(n: number): TransducerBuilder<BaseT, T[]>;
    partitionBy(pred: (item: T) => boolean): TransducerBuilder<BaseT, T[]>;
    interpose(separator: T): TransducerBuilder<BaseT, T>;

    build(): t.Transducer<BaseT, T>;
}

export function chainFrom<T>(collection: T[] | Iterable<T>): TransformChain<T> {
    return new TransducerChain<T, T>(collection);
}

export function transducerBuilder<T>(): TransducerBuilder<T, T> {
    return new TransducerChain<T, T>([]);
}

type CombinedBuilder<BaseT, T> = TransformChain<T> &
    TransducerBuilder<BaseT, T>;

class TransducerChain<BaseT, T> implements CombinedBuilder<BaseT, T> {
    private readonly transducers: Array<t.Transducer<any, any>> = [];

    constructor(private readonly collection: BaseT[] | Iterable<BaseT>) {}

    public compose<U>(
        transducer: t.Transducer<T, U>,
    ): CombinedBuilder<BaseT, U> {
        this.transducers.push(transducer);
        return this as any;
    }

    public build(): t.Transducer<BaseT, T> {
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

    public reduce<ResultT>(
        reducer: t.Reducer<ResultT, T>,
        initialValue: ResultT,
    ): ResultT;
    public reduce<ResultT, CompleteResultT>(
        transformer: t.CompletingTransformer<ResultT, CompleteResultT, T>,
        initialValue?: ResultT,
    ): CompleteResultT;
    public reduce<ResultT, CompleteResultT>(
        transformer:
            | t.Reducer<ResultT, T>
            | t.CompletingTransformer<ResultT, CompleteResultT, T>,
        initialValue: ResultT,
    ): CompleteResultT {
        // Need to contort the type system a bit to get this overload.
        if (typeof transformer === "function") {
            const result: ResultT = t.transduce<ResultT, BaseT, T>(
                this.build(),
                transformer,
                initialValue,
                this.collection,
            );
            // Safe because ResultT and CompleteResultT are the same in this
            // case.
            return result as any;
        } else {
            if (initialValue === undefined) {
                return t.transduce<ResultT, CompleteResultT, BaseT, T>(
                    this.build(),
                    transformer,
                    this.collection,
                );
            } else {
                return t.transduce<ResultT, CompleteResultT, BaseT, T>(
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
        return t.toIter(this.collection, this.build());
    }

    public forEach(f: (item: T) => void): void {
        this.reduce(new ForEach(f));
    }

    public first(): T | null {
        return this.reduce(firstTransformer<T>());
    }

    public map<U>(f: (item: T) => U): CombinedBuilder<BaseT, U> {
        return this.compose(t.map(f));
    }

    public filter(pred: (item: T) => boolean): CombinedBuilder<BaseT, T> {
        return this.compose(t.filter(pred));
    }

    public remove(pred: (item: T) => boolean): CombinedBuilder<BaseT, T> {
        return this.compose(t.remove(pred));
    }

    public keep<U>(f: (item: T) => U | null | void): CombinedBuilder<BaseT, U> {
        return this.compose(keep(f));
    }

    public mapcat<U>(f: (item: T) => U[]): CombinedBuilder<BaseT, U> {
        return this.compose(t.mapcat(f));
    }

    public dedupe(): CombinedBuilder<BaseT, T> {
        return this.compose(dedupe<T>());
    }

    public take(n: number): CombinedBuilder<BaseT, T> {
        return this.compose(t.take<T>(n));
    }

    public takeWhile(pred: (item: T) => boolean): CombinedBuilder<BaseT, T> {
        return this.compose(t.takeWhile(pred));
    }

    public takeNth(n: number): CombinedBuilder<BaseT, T> {
        return this.compose(t.takeNth<T>(n));
    }

    public drop(n: number): CombinedBuilder<BaseT, T> {
        return this.compose(t.drop<T>(n));
    }

    public dropWhile(pred: (item: T) => boolean): CombinedBuilder<BaseT, T> {
        return this.compose(t.dropWhile(pred));
    }

    public partition(n: number): CombinedBuilder<BaseT, T[]> {
        return this.compose(t.partitionAll<T>(n));
    }

    public partitionBy(pred: (item: T) => any): CombinedBuilder<BaseT, T[]> {
        return this.compose(t.partitionBy(pred));
    }

    public interpose(separator: T): CombinedBuilder<BaseT, T> {
        return this.compose(interpose(separator));
    }
}

class Keep<TResult, TCompleteResult, TInput, TOutput>
    implements t.CompletingTransformer<TResult, TCompleteResult, TInput> {
    constructor(
        private readonly f: (x: TInput) => TOutput | null | void,
        private readonly xf: t.CompletingTransformer<
            TResult,
            TCompleteResult,
            TOutput
        >,
    ) {}

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
        const output = this.f(input);
        return output == null
            ? result
            : this.xf["@@transducer/step"](result, output);
    }
}

function keep<T, U>(f: (item: T) => U | null | void): t.Transducer<T, U> {
    return <TResult, TCompleteResult>(
        xf: t.CompletingTransformer<TResult, TCompleteResult, U>,
    ) => new Keep<TResult, TCompleteResult, T, U>(f, xf);
}

class Dedupe<TResult, TCompleteResult, TInput>
    implements t.CompletingTransformer<TResult, TCompleteResult, TInput> {
    private last?: TInput;

    constructor(
        private readonly xf: t.CompletingTransformer<
            TResult,
            TCompleteResult,
            TInput
        >,
    ) {}

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
        if (input !== this.last) {
            this.last = input;
            return this.xf["@@transducer/step"](result, input);
        } else {
            return result;
        }
    }
}

function dedupe<T>(): t.Transducer<T, T> {
    return <TResult, TCompleteResult>(
        xf: t.CompletingTransformer<TResult, TCompleteResult, T>,
    ) => new Dedupe(xf);
}

class Interpose<TResult, TCompleteResult, TInput>
    implements t.CompletingTransformer<TResult, TCompleteResult, TInput> {
    private isStarted: boolean = false;

    constructor(
        private readonly separator: TInput,
        private readonly xf: t.CompletingTransformer<
            TResult,
            TCompleteResult,
            TInput
        >,
    ) {}

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
        if (this.isStarted) {
            const withSeparator = this.xf["@@transducer/step"](
                result,
                this.separator,
            );
            if (t.isReduced(withSeparator)) {
                return withSeparator;
            } else {
                return this.xf["@@transducer/step"](
                    withSeparator as TResult,
                    input,
                );
            }
        } else {
            this.isStarted = true;
            return this.xf["@@transducer/step"](result, input);
        }
    }
}

function interpose<T>(separator: T): t.Transducer<T, T> {
    return <TResult, TCompleteResult>(
        xf: t.CompletingTransformer<TResult, TCompleteResult, T>,
    ) => new Interpose(separator, xf);
}

class ForEach<T> implements t.Transformer<void, T> {
    constructor(private readonly f: (item: T) => void) {}

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

const firstTransformerConstant: t.Transformer<any, any> = {
    ["@@transducer/init"]: () => null,
    ["@@transducer/result"]: (result: any) => result,
    ["@@transducer/step"]: (_: void, input: any) => t.reduced(input),
};

function firstTransformer<T>(): t.Transformer<T | null, T> {
    return firstTransformerConstant;
}
