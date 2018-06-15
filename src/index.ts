const ITERATOR_SYMBOL =
    typeof Symbol !== "undefined" ? Symbol.iterator : "@@iterator";

// ----- Common transducer interfaces -----

// Redeclare interfaces from transducers-js to avoid a dependency on its types.

export interface Reduced<TResult> {
    ["@@transducer/reduced"]: boolean;
    ["@@transducer/value"]: TResult;
}

/**
 * Reducers are allowed to indicate that no further computation is needed by
 * returning a Reduced result.
 */
export type QuittingReducer<TResult, TInput> = (
    result: TResult,
    input: TInput,
) => TResult | Reduced<TResult>;

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

// Courtesy of https://github.com/pelotom/type-zoo.
export type NonNullable<T> = T & {};

// ----- Library interfaces -----

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
        initialValue?: TResult,
    ): TCompleteResult;

    count(): number;
    every(pred: (item: T, index: number) => boolean): boolean;
    find(pred: (item: T, index: number) => boolean): T | null;
    first(): T | null;
    forEach(f: (item: T, index: number) => void): void;
    isEmpty(): boolean;
    some(pred: (item: T, index: number) => boolean): boolean;
    stringJoin(separator: string): string;
    toArray(): T[];

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
    return new TransducerChain(getIterator(collection));
}

export function transducerBuilder<T>(): TransducerBuilder<T, T> {
    return new TransducerChain<T, T>(getIterator([]));
}

type CombinedBuilder<TBase, T> = TransformChain<T> &
    TransducerBuilder<TBase, T>;

class TransducerChain<TBase, T> implements CombinedBuilder<TBase, T> {
    private readonly transducers: Array<Transducer<any, any>> = [];

    constructor(private readonly iterator: Iterator<TBase>) {}

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

    public dedupe(): CombinedBuilder<TBase, T> {
        return this.compose(xf => new Dedupe(xf));
    }

    public drop(n: number): CombinedBuilder<TBase, T> {
        return this.compose(xf => new Drop(xf, n));
    }

    public dropWhile(
        pred: (item: T, index: number) => boolean,
    ): CombinedBuilder<TBase, T> {
        return this.compose(xf => new DropWhile(xf, pred));
    }

    public filter(
        pred: (item: T, index: number) => boolean,
    ): CombinedBuilder<TBase, T> {
        return this.compose(xf => new Filter(xf, pred));
    }

    public flatMap<U>(
        f: (item: T, index: number) => Iterable<U>,
    ): CombinedBuilder<TBase, U> {
        return this.compose(xf => new FlatMap(xf, f));
    }

    public interpose(separator: T): CombinedBuilder<TBase, T> {
        return this.compose(xf => new Interpose(xf, separator));
    }

    public map<U>(f: (item: T, index: number) => U): CombinedBuilder<TBase, U> {
        return this.compose(xf => new Map(xf, f));
    }

    public partitionAll(n: number): CombinedBuilder<TBase, T[]> {
        if (n === 0) {
            throw new Error("Size in partitionAll() cannot be 0");
        } else if (n < 0) {
            throw new Error("Size in partitionAll() cannot be negative");
        }
        return this.compose(xf => new PartitionAll(xf, n));
    }

    public partitionBy(
        f: (item: T, index: number) => any,
    ): CombinedBuilder<TBase, T[]> {
        return this.compose(xf => new PartitionBy(xf, f));
    }

    public remove(
        pred: (item: T, index: number) => boolean,
    ): CombinedBuilder<TBase, T> {
        // Optimization around V8's handling of function arity. Calling a
        // function with a number of arguments different from its declared
        // argument count comes with a performance penalty as high as 25% in
        // some environments.
        return this.filter(
            pred.length > 1
                ? (item, i) => !pred(item, i)
                : item => !(pred as any)(item),
        );
    }

    public removeAbsent(): CombinedBuilder<TBase, NonNullable<T>> {
        // Surprising that TypeScript is okay with this.
        return this.remove(item => item == null);
    }

    public take(n: number): CombinedBuilder<TBase, T> {
        return this.compose(xf => new Take(xf, n));
    }

    public takeNth(n: number): CombinedBuilder<TBase, T> {
        if (n === 0) {
            throw new Error("Step in takeNth() cannot be 0");
        } else if (n < 0) {
            throw new Error("Step in takeNth() cannot be negative");
        }
        return this.filter((_, i) => i % n === 0);
    }

    public takeWhile(
        pred: (item: T, index: number) => boolean,
    ): CombinedBuilder<TBase, T> {
        return this.compose(xf => new TakeWhile(xf, pred));
    }

    // ----- Reductions -----

    public reduce<TResult>(
        reducer: QuittingReducer<TResult, T>,
        initialValue: TResult,
    ): TResult;
    public reduce<TResult, TCompleteResult>(
        transformer: CompletingTransformer<TResult, TCompleteResult, T>,
        initialValue?: TResult,
    ): TCompleteResult;
    public reduce<TResult, TCompleteResult>(
        reducerOrTransformer:
            | QuittingReducer<TResult, T>
            | CompletingTransformer<TResult, TCompleteResult, T>,
        initialValue: TResult,
    ): TCompleteResult {
        if (typeof reducerOrTransformer === "function") {
            const transformer = new ReducerWrappingTransformer(
                reducerOrTransformer,
            );
            // Cast is safe because TResult and TCompleteResult are the same in this case.
            return transduceWithInitialValue(
                this.build(),
                transformer,
                initialValue,
                this.iterator,
            ) as any;
        } else if (arguments.length >= 2) {
            // Initial value is provided.
            return transduceWithInitialValue(
                this.build(),
                reducerOrTransformer,
                initialValue,
                this.iterator,
            );
        } else {
            return transduce(this.build(), reducerOrTransformer, this.iterator);
        }
    }

    public count(): number {
        return this.reduce(COUNT_TRANSFORMER);
    }

    public every(pred: (item: T, index: number) => boolean): boolean {
        return this.remove(pred).isEmpty();
    }

    public find(pred: (item: T, index: number) => boolean): T | null {
        return this.filter(pred).first();
    }

    public first(): T | null {
        return this.reduce(first<T>());
    }

    public forEach(f: (item: T, index: number) => void): void {
        this.reduce(new ForEachTransformer(f));
    }

    public isEmpty(): boolean {
        return this.reduce(IS_EMPTY_TRANFORMER);
    }

    public some(pred: (item: T, index: number) => boolean): boolean {
        return !this.filter(pred).isEmpty();
    }

    public stringJoin(separator: string): string {
        return this.reduce(new StringJoin(separator));
    }

    public toArray(): T[] {
        return this.reduce(TO_ARRAY_TRANSFORMER);
    }

    public toIterator(): IterableIterator<T> {
        const iterable: Iterator<T> = new TransducerIterable(
            this.build(),
            this.iterator,
        );
        // We can't satisfy the IterableIterator interface while functioning in
        // environments without Symbol, hence the cast.
        return iterable as any;
    }
}

// ----- Utility functions -----

function transduce<TResult, TCompleteResult, TInput, TOutput>(
    xf: Transducer<TInput, TOutput>,
    f: CompletingTransformer<TResult, TCompleteResult, TOutput>,
    iterator: Iterator<TInput>,
): TCompleteResult {
    return transduceWithInitialValue(xf, f, f["@@transducer/init"](), iterator);
}

function transduceWithInitialValue<TResult, TCompleteResult, TInput, TOutput>(
    xf: Transducer<TInput, TOutput>,
    f: CompletingTransformer<TResult, TCompleteResult, TOutput>,
    initialValue: TResult,
    iterator: Iterator<TInput>,
): TCompleteResult {
    return reduceWithTransformer(xf(f), initialValue, iterator);
}

function reduceWithTransformer<TResult, TCompleteResult, TInput>(
    f: CompletingTransformer<TResult, TCompleteResult, TInput>,
    initialValue: TResult,
    iterator: Iterator<TInput>,
): TCompleteResult {
    const uncompleteResult = reduceWithFunction(
        f["@@transducer/step"].bind(f),
        initialValue,
        iterator,
    );
    return f["@@transducer/result"](unreduced(uncompleteResult));
}

function reduceWithFunction<TResult, TInput>(
    f: QuittingReducer<TResult, TInput>,
    initialValue: TResult,
    iterator: Iterator<TInput>,
): TResult | Reduced<TResult> {
    let result = initialValue;
    while (true) {
        const input = iterator.next();
        if (input.done) {
            return result;
        }
        const next = f(result, input.value);
        if (isReduced(next)) {
            return next;
        } else {
            result = next;
        }
    }
}

class ReducerWrappingTransformer<TResult, TInput>
    implements Transformer<TResult, TInput> {
    public readonly "@@transducer/step": QuittingReducer<TResult, TInput>;

    constructor(f: QuittingReducer<TResult, TInput>) {
        this["@@transducer/step"] = f;
    }

    public ["@@transducer/init"](): TResult | void {
        return undefined;
    }

    public ["@@transducer/result"](result: TResult): TResult {
        return result;
    }
}

class ReducerOperatorApplyingTransformer<
    TResult,
    TCompleteResult,
    TInput,
    TOutput
> implements CompletingTransformer<TResult, TCompleteResult, TInput> {
    public readonly "@@transducer/step": QuittingReducer<TResult, TInput>;

    constructor(
        private readonly xf: CompletingTransformer<
            TResult,
            TCompleteResult,
            TOutput
        >,
        f: (
            reducer: QuittingReducer<TResult, TOutput>,
        ) => QuittingReducer<TResult, TInput>,
    ) {
        this["@@transducer/step"] = f((result: TResult, input: TOutput) =>
            xf["@@transducer/step"](result, input),
        );
    }

    public ["@@transducer/init"](): TResult | void {
        return this.xf["@@transducer/init"]();
    }

    public ["@@transducer/result"](result: TResult): TCompleteResult {
        return this.xf["@@transducer/result"](result);
    }
}

/**
 * A helper for creating transducers. It makes defining a reducer equivalent to
 * defining a function of type (reducer -> reducer), which is much less verbose
 * than the full definition of (transformer -> transformer). After uncurrying,
 * (reducer -> reducer) is equivalent to the actual type used here:
 *
 *   ((reducer, result, input) -> newResult).
 *
 * Additionally, the function is provided the current index, to support creation
 * of APIs similar to JavaScript's array transformation methods such as `.map()`
 * and `.filter()` in which the index of the current element is passed to the
 * provided function as a second argument.
 */
export function makeTransducer<T, U>(
    f: <R>(
        reducer: QuittingReducer<R, U>,
        result: R,
        input: T,
        index: number,
    ) => R | Reduced<R>,
): Transducer<T, U> {
    let i = 0;
    return <R>(xf: CompletingTransformer<R, any, U>) =>
        new ReducerOperatorApplyingTransformer(
            xf,
            (reducer: QuittingReducer<R, U>) => (result: R, input: T) =>
                f(reducer, result, input, i++),
        );
}

class RangeIterator implements Iterator<number> {
    private readonly end: number;
    private readonly step: number;
    private i: number;

    constructor(startOrEnd: number, end?: number, step?: number) {
        if (step === 0) {
            throw new Error("Step in rangeIterator() cannot be 0");
        } else if (end == null) {
            this.i = 0;
            this.end = startOrEnd;
            this.step = 1;
        } else if (step == null) {
            this.i = startOrEnd;
            this.end = end;
            this.step = 1;
        } else {
            this.i = startOrEnd;
            this.end = end;
            this.step = step;
        }
    }

    public [ITERATOR_SYMBOL]() {
        return this;
    }

    public next(): IteratorResult<number> {
        const { i, end, step } = this;
        if ((step > 0 && i < end) || (step < 0 && i > end)) {
            const result = { done: false, value: i };
            this.i += step;
            return result;
        } else {
            return { done: true } as any;
        }
    }
}

export function rangeIterator(
    startOrEnd: number,
    end?: number,
    step?: number,
): IterableIterator<number> {
    return new RangeIterator(startOrEnd, end, step) as any;
}

export function reduced<T>(result: T): Reduced<T> {
    return {
        "@@transducer/reduced": true,
        "@@transducer/value": result,
    };
}

export function isReduced<T>(result: T | Reduced<T>): result is Reduced<T> {
    return result && (result as any)["@@transducer/reduced"] === true;
}

function ensureReduced<T>(result: T | Reduced<T>): Reduced<T> {
    return isReduced(result) ? result : reduced(result);
}

function unreduced<T>(result: T | Reduced<T>): T {
    return isReduced(result) ? result["@@transducer/value"] : result;
}

// ----- Transducers -----

// It seems like there should be a way to factor out the repeated logic between
// all of these transformer classes, but every attempt thus far has
// significantly damaged performance. These functions are the bottleneck of the
// code, so any added layers of indirection have a nontrivial perf cost.
//
// The transforms which provide the index as a second argument have an
// optimization around V8's handling of function arity. Calling a function with
// a number of arguments different from its declared argument count comes with a
// performance penalty as high as 25% in some environments, so they check the
// declared argument count of the function they are passed to decide whether to
// give it an index or not.

class Dedupe<TResult, TCompleteResult, TInput>
    implements CompletingTransformer<TResult, TCompleteResult, TInput> {
    private last: TInput | {} = {};

    constructor(
        private readonly xf: CompletingTransformer<
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
    ): TResult | Reduced<TResult> {
        if (input !== this.last) {
            this.last = input;
            return this.xf["@@transducer/step"](result, input);
        } else {
            return result;
        }
    }
}

class Drop<TResult, TCompleteResult, TInput>
    implements CompletingTransformer<TResult, TCompleteResult, TInput> {
    private i = 0;

    constructor(
        private readonly xf: CompletingTransformer<
            TResult,
            TCompleteResult,
            TInput
        >,
        private readonly n: number,
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
    ): TResult | Reduced<TResult> {
        return this.i++ < this.n
            ? result
            : this.xf["@@transducer/step"](result, input);
    }
}

class DropWhile<TResult, TCompleteResult, TInput>
    implements CompletingTransformer<TResult, TCompleteResult, TInput> {
    private readonly needsIndex: boolean;
    private isDoneDropping = false;
    private i = 0;

    constructor(
        private readonly xf: CompletingTransformer<
            TResult,
            TCompleteResult,
            TInput
        >,
        private readonly pred: (item: TInput, i: number) => boolean,
    ) {
        this.needsIndex = pred.length > 1;
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
    ): TResult | Reduced<TResult> {
        if (this.isDoneDropping) {
            return this.xf["@@transducer/step"](result, input);
        } else {
            const meetsCondition = this.needsIndex
                ? this.pred(input, this.i++)
                : (this.pred as any)(input);
            if (meetsCondition) {
                return result;
            } else {
                this.isDoneDropping = true;
                return this.xf["@@transducer/step"](result, input);
            }
        }
    }
}

class Filter<TResult, TCompleteResult, TInput>
    implements CompletingTransformer<TResult, TCompleteResult, TInput> {
    private readonly needsIndex: boolean;
    private i = 0;

    constructor(
        private readonly xf: CompletingTransformer<
            TResult,
            TCompleteResult,
            TInput
        >,
        private readonly pred: (item: TInput, i: number) => boolean,
    ) {
        this.needsIndex = pred.length > 1;
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
    ): TResult | Reduced<TResult> {
        const meetsCondition = this.needsIndex
            ? this.pred(input, this.i++)
            : (this.pred as any)(input);
        return meetsCondition
            ? this.xf["@@transducer/step"](result, input)
            : result;
    }
}

class FlatMap<TResult, TCompleteResult, TInput, TOutput>
    implements CompletingTransformer<TResult, TCompleteResult, TInput> {
    private readonly step: QuittingReducer<TResult, TOutput>;
    private readonly needsIndex: boolean;
    private i = 0;

    constructor(
        private readonly xf: CompletingTransformer<
            TResult,
            TCompleteResult,
            TOutput
        >,
        private readonly f: (item: TInput, i: number) => Iterable<TOutput>,
    ) {
        this.step = xf["@@transducer/step"].bind(xf);
        this.needsIndex = f.length > 1;
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
    ): TResult | Reduced<TResult> {
        const iterable: Iterable<TOutput> = this.needsIndex
            ? this.f(input, this.i++)
            : (this.f as any)(input);
        return reduceWithFunction(this.step, result, getIterator(iterable));
    }
}

class Interpose<TResult, TCompleteResult, TInput>
    implements CompletingTransformer<TResult, TCompleteResult, TInput> {
    private isStarted = false;

    constructor(
        private readonly xf: CompletingTransformer<
            TResult,
            TCompleteResult,
            TInput
        >,
        private readonly separator: TInput,
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
    ): TResult | Reduced<TResult> {
        if (this.isStarted) {
            const withSeparator = this.xf["@@transducer/step"](
                result,
                this.separator,
            );
            if (isReduced(withSeparator)) {
                return withSeparator;
            } else {
                return this.xf["@@transducer/step"](withSeparator, input);
            }
        } else {
            this.isStarted = true;
            return this.xf["@@transducer/step"](result, input);
        }
    }
}

class Map<TResult, TCompleteResult, TInput, TOutput>
    implements CompletingTransformer<TResult, TCompleteResult, TInput> {
    private readonly needsIndex: boolean;
    private i = 0;

    constructor(
        private readonly xf: CompletingTransformer<
            TResult,
            TCompleteResult,
            TOutput
        >,
        private readonly f: (item: TInput, i: number) => TOutput,
    ) {
        this.needsIndex = f.length > 1;
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
    ): TResult | Reduced<TResult> {
        const mappedInput = this.needsIndex
            ? this.f(input, this.i++)
            : (this.f as any)(input);
        return this.xf["@@transducer/step"](result, mappedInput);
    }
}

class PartitionAll<TResult, TCompleteResult, TInput>
    implements CompletingTransformer<TResult, TCompleteResult, TInput> {
    private buffer: TInput[] = [];

    constructor(
        private readonly xf: CompletingTransformer<
            TResult,
            TCompleteResult,
            TInput[]
        >,
        private readonly n: number,
    ) {}

    public ["@@transducer/init"](): TResult | void {
        return this.xf["@@transducer/init"]();
    }

    public ["@@transducer/result"](result: TResult): TCompleteResult {
        if (this.buffer.length > 0) {
            result = unreduced(
                this.xf["@@transducer/step"](result, this.buffer),
            );
            this.buffer = [];
        }
        return this.xf["@@transducer/result"](result);
    }

    public ["@@transducer/step"](
        result: TResult,
        input: TInput,
    ): TResult | Reduced<TResult> {
        this.buffer.push(input);
        if (this.buffer.length === this.n) {
            const newResult = this.xf["@@transducer/step"](result, this.buffer);
            this.buffer = [];
            return newResult;
        } else {
            return result;
        }
    }
}

class PartitionBy<TResult, TCompleteResult, TInput>
    implements CompletingTransformer<TResult, TCompleteResult, TInput> {
    private buffer: TInput[] = [];
    private lastValue: any;
    private i = 0;

    constructor(
        private readonly xf: CompletingTransformer<
            TResult,
            TCompleteResult,
            TInput[]
        >,
        private readonly f: (item: TInput, i: number) => any,
    ) {}

    public ["@@transducer/init"](): TResult | void {
        return this.xf["@@transducer/init"]();
    }

    public ["@@transducer/result"](result: TResult): TCompleteResult {
        if (this.buffer.length > 0) {
            result = unreduced(
                this.xf["@@transducer/step"](result, this.buffer),
            );
            this.buffer = [];
        }
        return this.xf["@@transducer/result"](result);
    }

    public ["@@transducer/step"](
        result: TResult,
        input: TInput,
    ): TResult | Reduced<TResult> {
        const i = this.i++;
        const value = this.f(input, i);
        const lastValue = this.lastValue;
        this.lastValue = value;
        let newResult: TResult | Reduced<TResult>;
        if (i === 0 || lastValue === value) {
            newResult = result;
        } else {
            newResult = this.xf["@@transducer/step"](result, this.buffer);
            this.buffer = [];
        }
        this.buffer.push(input);
        return newResult;
    }
}

class Take<TResult, TCompleteResult, TInput>
    implements CompletingTransformer<TResult, TCompleteResult, TInput> {
    private i = 0;

    constructor(
        private readonly xf: CompletingTransformer<
            TResult,
            TCompleteResult,
            TInput
        >,
        private readonly n: number,
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
    ): TResult | Reduced<TResult> {
        // Written this way to avoid pulling one more element than necessary.
        if (this.n <= 0) {
            return reduced(result);
        }
        const next = this.xf["@@transducer/step"](result, input);
        return this.i++ < this.n - 1 ? next : ensureReduced(next);
    }
}

class TakeWhile<TResult, TCompleteResult, TInput>
    implements CompletingTransformer<TResult, TCompleteResult, TInput> {
    private readonly needsIndex: boolean;
    private i = 0;

    constructor(
        private readonly xf: CompletingTransformer<
            TResult,
            TCompleteResult,
            TInput
        >,
        private readonly pred: (item: TInput, i: number) => boolean,
    ) {
        this.needsIndex = pred.length > 1;
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
    ): TResult | Reduced<TResult> {
        const meetsCondition = this.needsIndex
            ? this.pred(input, this.i++)
            : (this.pred as any)(input);
        return meetsCondition
            ? this.xf["@@transducer/step"](result, input)
            : reduced(result);
    }
}

// ----- Custom transformers -----

const COUNT_TRANSFORMER: Transformer<number, any> = {
    ["@@transducer/init"]: () => 0,
    ["@@transducer/result"]: (result: number) => result,
    ["@@transducer/step"]: (result: number) => result + 1,
};

const FIRST_TRANSFORMER: Transformer<any, any> = {
    ["@@transducer/init"]: () => null,
    ["@@transducer/result"]: (result: any) => result,
    ["@@transducer/step"]: (_: any, input: any) => reduced(input),
};

function first<T>(): Transformer<T | null, T> {
    return FIRST_TRANSFORMER;
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

const IS_EMPTY_TRANFORMER: Transformer<boolean, any> = {
    ["@@transducer/init"]: () => true,
    ["@@transducer/result"]: (result: boolean) => result,
    ["@@transducer/step"]: () => reduced(false),
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

// ----- Custom transfomers -----

const AVERAGE_TRANSFORMER: CompletingTransformer<
    [number, number],
    number | null,
    number
> = {
    ["@@transducer/init"]: () => [0, 0],
    ["@@transducer/result"]: (result: [number, number]) =>
        result[1] === 0 ? null : result[0] / result[1],
    ["@@transducer/step"]: (result: [number, number], input: number) => {
        result[0] += input;
        result[1]++;
        return result;
    },
};

export function toAverage(): CompletingTransformer<
    [number, number],
    number | null,
    number
> {
    return AVERAGE_TRANSFORMER;
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
                    let outValues = this.xfToArray["@@transducer/step"](
                        [],
                        value,
                    );
                    if (isReduced(outValues)) {
                        this.hasSeenEnd = true;
                        outValues = outValues["@@transducer/value"];
                    }
                    this.upcoming = new ArrayIterator(outValues);
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
    if (collection[ITERATOR_SYMBOL]) {
        return collection[ITERATOR_SYMBOL]();
    } else if (Array.isArray(collection)) {
        return new ArrayIterator(collection);
    } else if (typeof collection === "string") {
        // Treat a string like an array of chars.
        return new ArrayIterator(collection as any);
    } else if (isObject(collection)) {
        return new ArrayIterator(
            Object.keys(collection).map((key: string) => [
                key,
                collection[key],
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
