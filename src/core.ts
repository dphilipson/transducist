import { getIterator } from "./iterables";
import {
    CompletingTransformer,
    QuittingReducer,
    Reduced,
    Transducer,
    Transformer,
} from "./types";
import { isReduced, unreduced } from "./util";

export function transduce<TResult, TCompleteResult, TInput, TOutput>(
    collection: Iterable<TInput>,
    transform: Transducer<TInput, TOutput>,
    reducer: CompletingTransformer<TResult, TCompleteResult, TOutput>,
    initialValue?: TInput,
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
        transformer = new ReducerWrappingTransformer(reducer) as any;
    } else {
        transformer = reducer;
        if (arguments.length < 4) {
            initialValue = transformer["@@transducer/init"]();
        }
    }
    return reduceWithTransformer(
        collection,
        transform(transformer),
        initialValue,
    );
}

function reduceWithTransformer<TResult, TCompleteResult, TInput>(
    collection: Iterable<TInput>,
    f: CompletingTransformer<TResult, TCompleteResult, TInput>,
    initialValue: TResult,
): TCompleteResult {
    const uncompleteResult = reduceWithFunction(
        collection,
        f["@@transducer/step"].bind(f),
        initialValue,
    );
    return f["@@transducer/result"](unreduced(uncompleteResult));
}

export function reduceWithFunction<TResult, TInput>(
    collection: Iterable<TInput>,
    f: QuittingReducer<TResult, TInput>,
    initialValue: TResult,
): TResult | Reduced<TResult> {
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
    public readonly "@@transducer/step": QuittingReducer<TResult, TInput>;

    constructor(f: QuittingReducer<TResult, TInput>) {
        this["@@transducer/step"] = f;
    }

    public ["@@transducer/init"](): TResult | undefined {
        return undefined;
    }

    public ["@@transducer/result"](result: TResult): TResult {
        return result;
    }
}
