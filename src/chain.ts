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
    toAverage,
    toMap,
    toMapGroupBy,
    toMax,
    toMin,
    toObject,
    toObjectGroupBy,
    toSet,
    toSum,
} from "./reducers";
import {
    dedupe,
    drop,
    dropWhile,
    filter,
    flatMap,
    interpose,
    map,
    mapIndexed,
    partitionAll,
    partitionBy,
    remove,
    take,
    takeNth,
    takeWhile,
} from "./transducers";
import {
    Comparator,
    CompletingTransformer,
    QuittingReducer,
    Transducer,
} from "./types";

export interface TransformChain<T> {
    compose<U>(transducer: Transducer<T, U>): TransformChain<U>;

    dedupe(): TransformChain<T>;
    drop(n: number): TransformChain<T>;
    dropWhile(pred: (item: T) => boolean): TransformChain<T>;
    filter(pred: (item: T) => boolean): TransformChain<T>;
    flatMap<U>(f: (item: T) => Iterable<U>): TransformChain<U>;
    interpose(separator: T): TransformChain<T>;
    map<U>(f: (item: T) => U): TransformChain<U>;
    mapIndexed<U>(f: (item: T, index: number) => U): TransformChain<U>;
    partitionAll(n: number): TransformChain<T[]>;
    partitionBy(pred: (item: T) => any): TransformChain<T[]>;
    remove(pred: (item: T) => boolean): TransformChain<T>;
    removeAbsent(): TransformChain<NonNullable<T>>;
    take(n: number): TransformChain<T>;
    takeNth(n: number): TransformChain<T>;
    takeWhile(pred: (item: T) => boolean): TransformChain<T>;

    reduce<TResult>(
        reducer: QuittingReducer<TResult, T>,
        initialValue: TResult,
    ): TResult;
    reduce<TResult, TCompleteResult>(
        transformer: CompletingTransformer<TResult, TCompleteResult, T>,
    ): TCompleteResult;

    // tslint:disable: member-ordering
    average: T extends number ? () => number | null : void;
    count(): number;
    every(pred: (item: T) => boolean): boolean;
    find(pred: (item: T) => boolean): T | null;
    first(): T | null;
    forEach(f: (item: T) => void): void;
    isEmpty(): boolean;
    joinToString(separator: string): string;
    max: T extends number
        ? (comparator?: Comparator<number>) => number | null
        : (comparator: Comparator<T>) => number | null;
    min: T extends number
        ? (comparator?: Comparator<number>) => number | null
        : (comparator: Comparator<T>) => number | null;
    some(pred: (item: T) => boolean): boolean;
    sum: T extends number ? () => number : void;
    toArray(): T[];
    toMap<K, V>(getKey: (item: T) => K, getValue: (item: T) => V): Map<K, V>;
    toMapGroupBy<K>(getKey: (item: T) => K): Map<K, T[]>;
    toMapGroupBy<K, V>(
        getKey: (item: T) => K,
        transformer: CompletingTransformer<any, V, T>,
    ): Map<K, V>;
    toObject<K extends keyof any, V>(
        getKey: (item: T) => K,
        getValue: (item: T) => V,
    ): Record<K, V>;
    toObjectGroupBy<K extends keyof any>(
        getKey: (item: T) => K,
    ): Record<K, T[]>;
    toObjectGroupBy<K extends keyof any, V>(
        getKey: (item: T) => K,
        transformer: CompletingTransformer<any, V, T>,
    ): Record<K, V>;
    toSet(): Set<T>;
    // tslint:enable: member-ordering

    toIterator(): IterableIterator<T>;
}

export interface TransducerBuilder<TBase, T> {
    compose<U>(transducer: Transducer<T, U>): TransducerBuilder<TBase, U>;

    dedupe(): TransducerBuilder<TBase, T>;
    drop(n: number): TransducerBuilder<TBase, T>;
    dropWhile(pred: (item: T) => boolean): TransducerBuilder<TBase, T>;
    filter(pred: (item: T) => boolean): TransducerBuilder<TBase, T>;
    flatMap<U>(f: (item: T) => Iterable<U>): TransducerBuilder<TBase, U>;
    interpose(separator: T): TransducerBuilder<TBase, T>;
    map<U>(f: (item: T) => U): TransducerBuilder<TBase, U>;
    mapIndexed<U>(
        f: (item: T, index: number) => U,
    ): TransducerBuilder<TBase, U>;
    partitionAll(n: number): TransducerBuilder<TBase, T[]>;
    partitionBy(pred: (item: T) => boolean): TransducerBuilder<TBase, T[]>;
    remove(pred: (item: T) => boolean): TransducerBuilder<TBase, T>;
    removeAbsent(): TransducerBuilder<TBase, NonNullable<T>>;
    take(n: number): TransducerBuilder<TBase, T>;
    takeNth(n: number): TransducerBuilder<TBase, T>;
    takeWhile(pred: (item: T) => boolean): TransducerBuilder<TBase, T>;

    build(): Transducer<TBase, T>;
}

export function chainFrom<T>(collection: Iterable<T>): TransformChain<T> {
    return new TransducerChain(collection) as any;
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

    public dropWhile(pred: (item: T) => boolean): CombinedBuilder<TBase, T> {
        return this.compose(dropWhile(pred));
    }

    public filter(pred: (item: T) => boolean): CombinedBuilder<TBase, T> {
        return this.compose(filter(pred));
    }

    public flatMap<U>(f: (item: T) => Iterable<U>): CombinedBuilder<TBase, U> {
        return this.compose(flatMap(f));
    }

    public interpose(separator: T): CombinedBuilder<TBase, T> {
        return this.compose(interpose(separator));
    }

    public map<U>(f: (item: T) => U): CombinedBuilder<TBase, U> {
        return this.compose(map(f));
    }

    public mapIndexed<U>(
        f: (item: T, index: number) => U,
    ): CombinedBuilder<TBase, U> {
        return this.compose(mapIndexed(f));
    }

    public partitionAll(n: number): CombinedBuilder<TBase, T[]> {
        return this.compose(partitionAll(n));
    }

    public partitionBy(f: (item: T) => any): CombinedBuilder<TBase, T[]> {
        return this.compose(partitionBy(f));
    }

    public remove(pred: (item: T) => boolean): CombinedBuilder<TBase, T> {
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

    public takeWhile(pred: (item: T) => boolean): CombinedBuilder<TBase, T> {
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

    // @ts-ignore
    public average(): number | null {
        return this.reduce(toAverage() as any);
    }

    public count(): number {
        return this.reduce(count());
    }

    public every(pred: (item: T) => boolean): boolean {
        return this.reduce(every(pred));
    }

    public find(pred: (item: T) => boolean): T | null {
        return this.reduce(find(pred));
    }

    public first(): T | null {
        return this.reduce(first());
    }

    public forEach(f: (item: T) => void): void {
        this.reduce(forEach(f));
    }

    public isEmpty(): boolean {
        return this.reduce(isEmpty());
    }

    public joinToString(separator: string): string {
        return this.reduce(joinToString(separator));
    }

    // @ts-ignore
    public max(comparator: Comparator<T>): T | null {
        return this.reduce(toMax(comparator));
    }

    // @ts-ignore
    public max(comparator: Comparator<T>): T | null {
        return this.reduce(toMax(comparator));
    }

    // @ts-ignore
    public min(comparator: Comparator<T>): T | null {
        return this.reduce(toMin(comparator));
    }

    public some(pred: (item: T) => boolean): boolean {
        return this.reduce(some(pred));
    }

    // @ts-ignore
    public sum(): number {
        return this.reduce(toSum() as any);
    }

    public toArray(): T[] {
        return this.reduce(toArray());
    }

    public toMap<K, V>(
        getKey: (item: T) => K,
        getValue: (item: T) => V,
    ): Map<K, V> {
        return this.reduce(toMap(getKey, getValue));
    }

    public toMapGroupBy<K>(getKey: (item: T) => K): Map<K, T[]>;
    public toMapGroupBy<K, V>(
        getKey: (item: T) => K,
        transformer: CompletingTransformer<any, V, T>,
    ): Map<K, V>;
    public toMapGroupBy<K>(
        getKey: (item: T) => K,
        transformer?: CompletingTransformer<any, any, T>,
    ): Map<K, any> {
        return this.reduce(toMapGroupBy(getKey, transformer as any));
    }

    public toObject<K extends keyof any, V>(
        getKey: (item: T) => K,
        getValue: (item: T) => V,
    ): Record<K, V> {
        return this.reduce(toObject(getKey, getValue));
    }

    public toObjectGroupBy<K extends keyof any>(
        getKey: (item: T) => K,
    ): Record<K, T[]>;
    public toObjectGroupBy<K extends keyof any, V>(
        getKey: (item: T) => K,
        transformer: CompletingTransformer<any, V, T>,
    ): Record<K, V>;
    public toObjectGroupBy<K extends keyof any>(
        getKey: (item: T) => K,
        transformer?: CompletingTransformer<any, any, T>,
    ): Record<K, any> {
        return this.reduce(toObjectGroupBy(getKey, transformer as any));
    }

    public toSet(): Set<T> {
        return this.reduce(toSet());
    }

    public toIterator(): IterableIterator<T> {
        return lazyTransduce(this.collection, this.build());
    }
}
