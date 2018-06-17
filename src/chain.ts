import { transduce } from "./core";
import { lazyTransduce } from "./iterables";
import {
    count,
    every,
    find,
    first,
    forEach,
    isEmpty,
    joinToString,
    some,
    toArray,
    toObject,
} from "./reducers";
import {
    dedupe,
    drop,
    dropWhile,
    filter,
    flatMap,
    interpose,
    map,
    partitionAll,
    partitionBy,
    remove,
    take,
    takeNth,
    takeWhile,
} from "./transducers";
import { CompletingTransformer, QuittingReducer, Transducer } from "./types";

export interface TransformChain<T> {
    compose<U>(transducer: Transducer<T, U>): TransformChain<U>;

    dedupe(): TransformChain<T>;
    drop(n: number): TransformChain<T>;
    dropWhile(pred: (item: T, index: number) => boolean): TransformChain<T>;
    filter(pred: (item: T, index: number) => boolean): TransformChain<T>;
    flatMap<U>(f: (item: T, index: number) => Iterable<U>): TransformChain<U>;
    interpose(separator: T): TransformChain<T>;
    map<U>(f: (item: T, index: number) => U): TransformChain<U>;
    partitionAll(n: number): TransformChain<T[]>;
    partitionBy(pred: (item: T, index: number) => any): TransformChain<T[]>;
    remove(pred: (item: T, index: number) => boolean): TransformChain<T>;
    removeAbsent(): TransformChain<NonNullable<T>>;
    take(n: number): TransformChain<T>;
    takeNth(n: number): TransformChain<T>;
    takeWhile(pred: (item: T, index: number) => boolean): TransformChain<T>;

    reduce<TResult>(
        reducer: QuittingReducer<TResult, T>,
        initialValue: TResult,
    ): TResult;
    reduce<TResult, TCompleteResult>(
        transformer: CompletingTransformer<TResult, TCompleteResult, T>,
    ): TCompleteResult;

    count(): number;
    every(pred: (item: T, index: number) => boolean): boolean;
    find(pred: (item: T, index: number) => boolean): T | null;
    first(): T | null;
    forEach(f: (item: T, index: number) => void): void;
    isEmpty(): boolean;
    joinToString(separator: string): string;
    some(pred: (item: T, index: number) => boolean): boolean;
    toArray(): T[];
    toObject<U>(
        getKey: (item: T, index: number) => string,
        getValue: (item: T, index: number) => U,
    ): { [key: string]: U };

    toIterator(): IterableIterator<T>;
}

export interface TransducerBuilder<TBase, T> {
    compose<U>(transducer: Transducer<T, U>): TransducerBuilder<TBase, U>;

    dedupe(): TransducerBuilder<TBase, T>;
    drop(n: number): TransducerBuilder<TBase, T>;
    dropWhile(
        pred: (item: T, index: number) => boolean,
    ): TransducerBuilder<TBase, T>;
    filter(
        pred: (item: T, index: number) => boolean,
    ): TransducerBuilder<TBase, T>;
    flatMap<U>(
        f: (item: T, index: number) => Iterable<U>,
    ): TransducerBuilder<TBase, U>;
    interpose(separator: T): TransducerBuilder<TBase, T>;
    map<U>(f: (item: T, index: number) => U): TransducerBuilder<TBase, U>;
    partitionAll(n: number): TransducerBuilder<TBase, T[]>;
    partitionBy(
        pred: (item: T, index: number) => boolean,
    ): TransducerBuilder<TBase, T[]>;
    remove(
        pred: (item: T, index: number) => boolean,
    ): TransducerBuilder<TBase, T>;
    removeAbsent(): TransducerBuilder<TBase, NonNullable<T>>;
    take(n: number): TransducerBuilder<TBase, T>;
    takeNth(n: number): TransducerBuilder<TBase, T>;
    takeWhile(
        pred: (item: T, index: number) => boolean,
    ): TransducerBuilder<TBase, T>;

    build(): Transducer<TBase, T>;
}

export function chainFrom<T>(collection: Iterable<T>): TransformChain<T> {
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
        return (x: any) => {
            let result = x;
            for (let i = this.transducers.length - 1; i >= 0; i--) {
                result = this.transducers[i](result);
            }
            return result;
        };
    }

    // ----- Composing transducers -----

    public dedupe(): CombinedBuilder<TBase, T> {
        return this.compose(dedupe());
    }

    public drop(n: number): CombinedBuilder<TBase, T> {
        return this.compose(drop(n));
    }

    public dropWhile(
        pred: (item: T, index: number) => boolean,
    ): CombinedBuilder<TBase, T> {
        return this.compose(dropWhile(pred));
    }

    public filter(
        pred: (item: T, index: number) => boolean,
    ): CombinedBuilder<TBase, T> {
        return this.compose(filter(pred));
    }

    public flatMap<U>(
        f: (item: T, index: number) => Iterable<U>,
    ): CombinedBuilder<TBase, U> {
        return this.compose(flatMap(f));
    }

    public interpose(separator: T): CombinedBuilder<TBase, T> {
        return this.compose(interpose(separator));
    }

    public map<U>(f: (item: T, index: number) => U): CombinedBuilder<TBase, U> {
        return this.compose(map(f));
    }

    public partitionAll(n: number): CombinedBuilder<TBase, T[]> {
        return this.compose(partitionAll(n));
    }

    public partitionBy(
        f: (item: T, index: number) => any,
    ): CombinedBuilder<TBase, T[]> {
        return this.compose(partitionBy(f));
    }

    public remove(
        pred: (item: T, index: number) => boolean,
    ): CombinedBuilder<TBase, T> {
        return this.compose(remove(pred));
    }

    public removeAbsent(): CombinedBuilder<TBase, NonNullable<T>> {
        return this.remove(item => item == null) as CombinedBuilder<
            TBase,
            NonNullable<T>
        >;
    }

    public take(n: number): CombinedBuilder<TBase, T> {
        return this.compose(take(n));
    }

    public takeNth(n: number): CombinedBuilder<TBase, T> {
        return this.compose(takeNth(n));
    }

    public takeWhile(
        pred: (item: T, index: number) => boolean,
    ): CombinedBuilder<TBase, T> {
        return this.compose(takeWhile(pred));
    }

    // ----- Reductions -----

    public reduce<TResult>(
        reducer: QuittingReducer<TResult, T>,
        initialValue: TResult,
    ): TResult;
    public reduce<TResult, TCompleteResult>(
        reducer: CompletingTransformer<TResult, TCompleteResult, T>,
    ): TCompleteResult;
    public reduce<TResult, TCompleteResult>(
        reducer:
            | QuittingReducer<TResult, T>
            | CompletingTransformer<TResult, TCompleteResult, T>,
        initialValue?: TResult,
    ): TCompleteResult {
        if (typeof reducer === "function") {
            // Type coercion because in this branch, TResult and TCompleteResult are
            // the same, but the checker doesn't know that.
            return transduce(
                this.collection,
                this.build(),
                reducer,
                initialValue!,
            ) as any;
        } else {
            return transduce(this.collection, this.build(), reducer);
        }
    }

    public count(): number {
        return this.reduce(count());
    }

    public every(pred: (item: T, index: number) => boolean): boolean {
        return this.reduce(every(pred));
    }

    public find(pred: (item: T, index: number) => boolean): T | null {
        return this.reduce(find(pred));
    }

    public first(): T | null {
        return this.reduce(first());
    }

    public forEach(f: (item: T, index: number) => void): void {
        this.reduce(forEach(f));
    }

    public isEmpty(): boolean {
        return this.reduce(isEmpty());
    }

    public joinToString(separator: string): string {
        return this.reduce(joinToString(separator));
    }

    public some(pred: (item: T, index: number) => boolean): boolean {
        return this.reduce(some(pred));
    }

    public toArray(): T[] {
        return this.reduce(toArray());
    }

    public toObject<U>(
        getKey: (item: T, index: number) => string,
        getValue: (item: T, index: number) => U,
    ): { [key: string]: U } {
        return this.reduce(toObject(getKey, getValue));
    }

    public toIterator(): IterableIterator<T> {
        return lazyTransduce(this.collection, this.build());
    }
}
