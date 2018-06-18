import { reduceWithFunction } from "./core";
import { INIT, RESULT, STEP, VALUE } from "./propertyNames";
import {
    CompletingTransformer,
    MaybeReduced,
    QuittingReducer,
    Transducer,
} from "./types";
import { ensureReduced, isReduced, reduced, unreduced } from "./util";

// It seems like there should be a way to factor out the repeated logic between
// all of these transformer classes, but every attempt thus far has
// significantly damaged performance. These functions are the bottleneck of the
// code, so any added layers of indirection have a nontrivial perf cost.

interface ValueWrapper<T> {
    value: T;
}

function updateValue<T, TWrapper extends ValueWrapper<T>>(
    result: TWrapper,
    newValue: MaybeReduced<T>,
): MaybeReduced<TWrapper> {
    if (isReduced(newValue)) {
        result.value = newValue[VALUE];
        return reduced(result);
    } else {
        result.value = newValue;
        return result;
    }
}

interface DedupeState<T> extends ValueWrapper<T> {
    last: T | {};
}

class Dedupe<TResult, TCompleteResult, TInput>
    implements
        CompletingTransformer<DedupeState<TResult>, TCompleteResult, TInput> {
    constructor(
        private readonly xf: CompletingTransformer<
            TResult,
            TCompleteResult,
            TInput
        >,
    ) {}

    public [INIT](): DedupeState<TResult> {
        return { last: {}, value: this.xf[INIT]() };
    }

    public [RESULT](result: DedupeState<TResult>): TCompleteResult {
        return this.xf[RESULT](result.value);
    }

    public [STEP](
        result: DedupeState<TResult>,
        input: TInput,
    ): MaybeReduced<DedupeState<TResult>> {
        if (input !== result.last) {
            result.last = input;
            return updateValue(result, this.xf[STEP](result.value, input));
        } else {
            return result;
        }
    }
}

export function dedupe<T>(): Transducer<T, T> {
    return xf => new Dedupe(xf);
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

    public [INIT](): TResult {
        return this.xf[INIT]();
    }

    public [RESULT](result: TResult): TCompleteResult {
        return this.xf[RESULT](result);
    }

    public [STEP](result: TResult, input: TInput): MaybeReduced<TResult> {
        return this.i++ < this.n ? result : this.xf[STEP](result, input);
    }
}

export function drop<T>(n: number): Transducer<T, T> {
    return xf => new Drop(xf, n);
}

interface DropWhileState<T> extends ValueWrapper<T> {
    isDoneDropping: boolean;
}

class DropWhile<TResult, TCompleteResult, TInput>
    implements
        CompletingTransformer<
            DropWhileState<TResult>,
            TCompleteResult,
            TInput
        > {
    constructor(
        private readonly xf: CompletingTransformer<
            TResult,
            TCompleteResult,
            TInput
        >,
        private readonly pred: (item: TInput) => boolean,
    ) {}

    public [INIT](): DropWhileState<TResult> {
        return { value: this.xf[INIT](), isDoneDropping: false };
    }

    public [RESULT](result: DropWhileState<TResult>): TCompleteResult {
        return this.xf[RESULT](result.value);
    }

    public [STEP](
        result: DropWhileState<TResult>,
        input: TInput,
    ): MaybeReduced<DropWhileState<TResult>> {
        if (result.isDoneDropping) {
            return updateValue(result, this.xf[STEP](result.value, input));
        } else {
            if (this.pred(input)) {
                return result;
            } else {
                result.isDoneDropping = true;
                return updateValue(result, this.xf[STEP](result.value, input));
            }
        }
    }
}

export function dropWhile<T>(pred: (item: T) => boolean): Transducer<T, T> {
    return xf => new DropWhile(xf, pred);
}

class Filter<TResult, TCompleteResult, TInput>
    implements CompletingTransformer<TResult, TCompleteResult, TInput> {
    constructor(
        private readonly xf: CompletingTransformer<
            TResult,
            TCompleteResult,
            TInput
        >,
        private readonly pred: (item: TInput) => boolean,
    ) {}

    public [INIT](): TResult {
        return this.xf[INIT]();
    }

    public [RESULT](result: TResult): TCompleteResult {
        return this.xf[RESULT](result);
    }

    public [STEP](result: TResult, input: TInput): MaybeReduced<TResult> {
        return this.pred(input) ? this.xf[STEP](result, input) : result;
    }
}

export function filter<T>(pred: (item: T) => boolean): Transducer<T, T> {
    return xf => new Filter(xf, pred);
}

class FlatMap<TResult, TCompleteResult, TInput, TOutput>
    implements CompletingTransformer<TResult, TCompleteResult, TInput> {
    private readonly step: QuittingReducer<TResult, TOutput>;

    constructor(
        private readonly xf: CompletingTransformer<
            TResult,
            TCompleteResult,
            TOutput
        >,
        private readonly f: (item: TInput) => Iterable<TOutput>,
    ) {
        this.step = xf[STEP].bind(xf);
    }

    public [INIT](): TResult {
        return this.xf[INIT]();
    }

    public [RESULT](result: TResult): TCompleteResult {
        return this.xf[RESULT](result);
    }

    public [STEP](result: TResult, input: TInput): MaybeReduced<TResult> {
        return reduceWithFunction(this.f(input), this.step, result);
    }
}

export function flatMap<T, U>(f: (item: T) => Iterable<U>): Transducer<T, U> {
    return xf => new FlatMap(xf, f);
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

    public [INIT](): TResult {
        return this.xf[INIT]();
    }

    public [RESULT](result: TResult): TCompleteResult {
        return this.xf[RESULT](result);
    }

    public [STEP](result: TResult, input: TInput): MaybeReduced<TResult> {
        if (this.isStarted) {
            const withSeparator = this.xf[STEP](result, this.separator);
            if (isReduced(withSeparator)) {
                return withSeparator;
            } else {
                return this.xf[STEP](withSeparator, input);
            }
        } else {
            this.isStarted = true;
            return this.xf[STEP](result, input);
        }
    }
}

export function interpose<T>(separator: T): Transducer<T, T> {
    return xf => new Interpose(xf, separator);
}

// Not named Map to avoid confusion with the native Map class.
class MapTransformer<TResult, TCompleteResult, TInput, TOutput>
    implements CompletingTransformer<TResult, TCompleteResult, TInput> {
    constructor(
        private readonly xf: CompletingTransformer<
            TResult,
            TCompleteResult,
            TOutput
        >,
        private readonly f: (item: TInput) => TOutput,
    ) {}

    public [INIT](): TResult {
        return this.xf[INIT]();
    }

    public [RESULT](result: TResult): TCompleteResult {
        return this.xf[RESULT](result);
    }

    public [STEP](result: TResult, input: TInput): MaybeReduced<TResult> {
        return this.xf[STEP](result, this.f(input));
    }
}

export function map<T, U>(f: (item: T) => U): Transducer<T, U> {
    return xf => new MapTransformer(xf, f);
}

interface MapIndexedState<T> extends ValueWrapper<T> {
    i: number;
}

class MapIndexed<TResult, TCompleteResult, TInput, TOutput>
    implements
        CompletingTransformer<
            MapIndexedState<TResult>,
            TCompleteResult,
            TInput
        > {
    constructor(
        private readonly xf: CompletingTransformer<
            TResult,
            TCompleteResult,
            TOutput
        >,
        private readonly f: (item: TInput, index: number) => TOutput,
    ) {}

    public [INIT](): MapIndexedState<TResult> {
        return { value: this.xf[INIT](), i: 0 };
    }

    public [RESULT](result: MapIndexedState<TResult>): TCompleteResult {
        return this.xf[RESULT](result.value);
    }

    public [STEP](
        result: MapIndexedState<TResult>,
        input: TInput,
    ): MaybeReduced<MapIndexedState<TResult>> {
        return updateValue(
            result,
            this.xf[STEP](result.value, this.f(input, result.i++)),
        );
    }
}

export function mapIndexed<T, U>(
    f: (item: T, index: number) => U,
): Transducer<T, U> {
    return xf => new MapIndexed(xf, f);
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

    public [INIT](): TResult {
        return this.xf[INIT]();
    }

    public [RESULT](result: TResult): TCompleteResult {
        if (this.buffer.length > 0) {
            result = unreduced(this.xf[STEP](result, this.buffer));
            this.buffer = [];
        }
        return this.xf[RESULT](result);
    }

    public [STEP](result: TResult, input: TInput): MaybeReduced<TResult> {
        this.buffer.push(input);
        if (this.buffer.length === this.n) {
            const newResult = this.xf[STEP](result, this.buffer);
            this.buffer = [];
            return newResult;
        } else {
            return result;
        }
    }
}

export function partitionAll<T>(n: number): Transducer<T, T[]> {
    if (n === 0) {
        throw new Error("Size in partitionAll() cannot be 0");
    } else if (n < 0) {
        throw new Error("Size in partitionAll() cannot be negative");
    }
    return xf => new PartitionAll(xf, n);
}

interface PartitionByState<TResult, TInput> extends ValueWrapper<TResult> {
    buffer: TInput[];
    lastKey: any;
}

const INITIAL_LAST_KEY = {};

class PartitionBy<TResult, TCompleteResult, TInput>
    implements
        CompletingTransformer<
            PartitionByState<TResult, TInput>,
            TCompleteResult,
            TInput
        > {
    constructor(
        private readonly xf: CompletingTransformer<
            TResult,
            TCompleteResult,
            TInput[]
        >,
        private readonly f: (item: TInput) => any,
    ) {}

    public [INIT](): PartitionByState<TResult, TInput> {
        return {
            value: this.xf[INIT](),
            buffer: [],
            lastKey: INITIAL_LAST_KEY,
        };
    }

    public [RESULT](
        result: PartitionByState<TResult, TInput>,
    ): TCompleteResult {
        if (result.buffer.length > 0) {
            result.value = unreduced(
                this.xf[STEP](result.value, result.buffer),
            );
            result.buffer = [];
        }
        return this.xf[RESULT](result.value);
    }

    public [STEP](
        result: PartitionByState<TResult, TInput>,
        input: TInput,
    ): MaybeReduced<PartitionByState<TResult, TInput>> {
        const key = this.f(input);
        const { value, buffer, lastKey } = result;
        result.lastKey = key;
        let newResult: MaybeReduced<PartitionByState<TResult, TInput>>;
        if (lastKey === INITIAL_LAST_KEY || lastKey === key) {
            newResult = result;
        } else {
            newResult = updateValue(result, this.xf[STEP](value, buffer));
            unreduced(newResult).buffer = [];
        }
        unreduced(newResult).buffer.push(input);
        return newResult;
    }
}

export function partitionBy<T>(f: (item: T) => any): Transducer<T, T[]> {
    return xf => new PartitionBy(xf, f);
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

    public [INIT](): TResult {
        return this.xf[INIT]();
    }

    public [RESULT](result: TResult): TCompleteResult {
        return this.xf[RESULT](result);
    }

    public [STEP](result: TResult, input: TInput): MaybeReduced<TResult> {
        // Written this way to avoid pulling one more element than necessary.
        if (this.n <= 0) {
            return reduced(result);
        }
        const next = this.xf[STEP](result, input);
        return this.i++ < this.n - 1 ? next : ensureReduced(next);
    }
}

export function remove<T>(pred: (item: T) => boolean): Transducer<T, T> {
    return filter(item => !pred(item));
}

export function take<T>(n: number): Transducer<T, T> {
    return xf => new Take(xf, n);
}

interface TakeNthState<T> extends ValueWrapper<T> {
    i: number;
}

class TakeNth<TResult, TCompleteResult, TInput>
    implements
        CompletingTransformer<TakeNthState<TResult>, TCompleteResult, TInput> {
    constructor(
        private readonly xf: CompletingTransformer<
            TResult,
            TCompleteResult,
            TInput
        >,
        private readonly n: number,
    ) {}

    public [INIT](): TakeNthState<TResult> {
        return { value: this.xf[INIT](), i: 0 };
    }

    public [RESULT](result: TakeNthState<TResult>): TCompleteResult {
        return this.xf[RESULT](result.value);
    }

    public [STEP](
        result: TakeNthState<TResult>,
        input: TInput,
    ): MaybeReduced<TakeNthState<TResult>> {
        return result.i++ % this.n === 0
            ? updateValue(result, this.xf[STEP](result.value, input))
            : result;
    }
}

export function takeNth<T>(n: number): Transducer<T, T> {
    if (n === 0) {
        throw new Error("Step in takeNth() cannot be 0");
    } else if (n < 0) {
        throw new Error("Step in takeNth() cannot be negative");
    }
    return xf => new TakeNth(xf, n);
}

class TakeWhile<TResult, TCompleteResult, TInput>
    implements CompletingTransformer<TResult, TCompleteResult, TInput> {
    constructor(
        private readonly xf: CompletingTransformer<
            TResult,
            TCompleteResult,
            TInput
        >,
        private readonly pred: (item: TInput) => boolean,
    ) {}

    public [INIT](): TResult {
        return this.xf[INIT]();
    }

    public [RESULT](result: TResult): TCompleteResult {
        return this.xf[RESULT](result);
    }

    public [STEP](result: TResult, input: TInput): MaybeReduced<TResult> {
        return this.pred(input)
            ? this.xf[STEP](result, input)
            : reduced(result);
    }
}

export function takeWhile<T>(pred: (item: T) => boolean): Transducer<T, T> {
    return xf => new TakeWhile(xf, pred);
}
