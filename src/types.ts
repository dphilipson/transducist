export interface Reduced<T> {
    ["@@transducer/reduced"]: boolean;
    ["@@transducer/value"]: T;
}

export type MaybeReduced<T> = T | Reduced<T>;

/**
 * Reducers are allowed to indicate that no further computation is needed by
 * returning a Reduced result.
 */
export type QuittingReducer<TResult, TInput> = (
    result: TResult,
    input: TInput,
) => MaybeReduced<TResult>;

export type Transducer<TInput, TOutput> = <TCompleteResult>(
    xf: CompletingTransformer<any, TCompleteResult, TOutput>,
) => CompletingTransformer<any, TCompleteResult, TInput>;

export interface CompletingTransformer<TResult, TCompleteResult, TInput> {
    ["@@transducer/init"](): TResult;
    ["@@transducer/step"](
        result: TResult,
        input: TInput,
    ): MaybeReduced<TResult>;
    ["@@transducer/result"](result: TResult): TCompleteResult;
}

export type Transformer<TResult, TInput> = CompletingTransformer<
    TResult,
    TResult,
    TInput
>;

export type Comparator<T> = (a: T, b: T) => number;
