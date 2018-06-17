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

export type Transducer<TInput, TOutput> = <TCompleteResult>(
    xf: CompletingTransformer<any, TCompleteResult, TOutput>,
) => CompletingTransformer<any, TCompleteResult, TInput>;

export interface CompletingTransformer<TResult, TCompleteResult, TInput> {
    ["@@transducer/init"](): TResult;
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

export type Comparator<T> = (a: T, b: T) => number;
