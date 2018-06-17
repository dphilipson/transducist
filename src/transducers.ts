import { reduceWithFunction } from "./core";
import {
    CompletingTransformer,
    QuittingReducer,
    Reduced,
    Transducer,
} from "./types";
import { ensureReduced, isReduced, reduced, unreduced } from "./util";

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

    public ["@@transducer/init"](): TResult | undefined {
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

    public ["@@transducer/init"](): TResult | undefined {
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

export function drop<T>(n: number): Transducer<T, T> {
    return xf => new Drop(xf, n);
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

    public ["@@transducer/init"](): TResult | undefined {
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

export function dropWhile<T>(
    pred: (item: T, i: number) => boolean,
): Transducer<T, T> {
    return xf => new DropWhile(xf, pred);
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

    public ["@@transducer/init"](): TResult | undefined {
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

export function filter<T>(
    pred: (item: T, i: number) => boolean,
): Transducer<T, T> {
    return xf => new Filter(xf, pred);
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

    public ["@@transducer/init"](): TResult | undefined {
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
        return reduceWithFunction(iterable, this.step, result);
    }
}

export function flatMap<T, U>(
    f: (item: T, i: number) => Iterable<U>,
): Transducer<T, U> {
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

    public ["@@transducer/init"](): TResult | undefined {
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

export function interpose<T>(separator: T): Transducer<T, T> {
    return xf => new Interpose(xf, separator);
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

    public ["@@transducer/init"](): TResult | undefined {
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

export function map<T, U>(f: (item: T, i: number) => U): Transducer<T, U> {
    return xf => new Map(xf, f);
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

    public ["@@transducer/init"](): TResult | undefined {
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

export function partitionAll<T>(n: number): Transducer<T, T[]> {
    if (n === 0) {
        throw new Error("Size in partitionAll() cannot be 0");
    } else if (n < 0) {
        throw new Error("Size in partitionAll() cannot be negative");
    }
    return xf => new PartitionAll(xf, n);
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

    public ["@@transducer/init"](): TResult | undefined {
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

export function partitionBy<T>(
    f: (item: T, i: number) => any,
): Transducer<T, T[]> {
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

    public ["@@transducer/init"](): TResult | undefined {
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

export function remove<T>(
    pred: (item: T, index: number) => boolean,
): Transducer<T, T> {
    // Optimization around V8's handling of function arity. Calling a
    // function with a number of arguments different from its declared
    // argument count comes with a performance penalty as high as 25% in
    // some environments.
    return filter(
        pred.length > 1
            ? (item, i) => !pred(item, i)
            : item => !(pred as any)(item),
    );
}

export function take<T>(n: number): Transducer<T, T> {
    return xf => new Take(xf, n);
}

export function takeNth<T>(n: number): Transducer<T, T> {
    if (n === 0) {
        throw new Error("Step in takeNth() cannot be 0");
    } else if (n < 0) {
        throw new Error("Step in takeNth() cannot be negative");
    }
    return filter((_, i) => i % n === 0);
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

    public ["@@transducer/init"](): TResult | undefined {
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

export function takeWhile<T>(
    pred: (item: T, i: number) => boolean,
): Transducer<T, T> {
    return xf => new TakeWhile(xf, pred);
}
