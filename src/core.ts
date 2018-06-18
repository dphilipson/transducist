import { getIterator } from "./iterables";
import { INIT, RESULT, STEP } from "./propertyNames";
import {
    CompletingTransformer,
    MaybeReduced,
    QuittingReducer,
    Transducer,
    Transformer,
} from "./types";
import { isReduced, unreduced } from "./util";

export function transduce<TResult, TCompleteResult, TInput, TOutput>(
    collection: Iterable<TInput>,
    transform: Transducer<TInput, TOutput>,
    reducer: CompletingTransformer<TResult, TCompleteResult, TOutput>,
): TCompleteResult;
export function transduce<TResult, TInput, TOutput>(
    collection: Iterable<TInput>,
    transform: Transducer<TInput, TOutput>,
    reducer: QuittingReducer<TResult, TOutput>,
    initialValue: TResult,
): TResult;
export function transduce<TResult, TCompleteResult, TInput, TOutput>(
    collection: Iterable<TInput>,
    transform: Transducer<TInput, TOutput>,
    reducer:
        | CompletingTransformer<TResult, TCompleteResult, TOutput>
        | QuittingReducer<TResult, TOutput>,
    initialValue?: TResult,
): TCompleteResult {
    let transformer: CompletingTransformer<TResult, TCompleteResult, TOutput>;
    if (typeof reducer === "function") {
        // Type coercion because in this branch, TResult and TCompleteResult are
        // the same, but the checker doesn't know that.
        transformer = new ReducerWrappingTransformer(
            reducer,
            initialValue!,
        ) as any;
    } else {
        transformer = reducer;
    }
    return reduceWithTransformer(collection, transform(transformer));
}

function reduceWithTransformer<TResult, TCompleteResult, TInput>(
    collection: Iterable<TInput>,
    f: CompletingTransformer<TResult, TCompleteResult, TInput>,
): TCompleteResult {
    const uncompleteResult = reduceWithFunction(
        collection,
        f[STEP].bind(f),
        f[INIT](),
    );
    return f[RESULT](unreduced(uncompleteResult));
}

export function reduceWithFunction<TResult, TInput>(
    collection: Iterable<TInput>,
    f: QuittingReducer<TResult, TInput>,
    initialValue: TResult,
): MaybeReduced<TResult> {
    const iterator = getIterator(collection);
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
    public readonly [STEP]: QuittingReducer<TResult, TInput>;

    constructor(
        f: QuittingReducer<TResult, TInput>,
        private readonly initialValue: TResult,
    ) {
        this[STEP] = f;
    }

    public [INIT](): TResult {
        return this.initialValue;
    }

    public [RESULT](result: TResult): TResult {
        return result;
    }
}
