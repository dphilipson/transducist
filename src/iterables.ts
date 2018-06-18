import { STEP, VALUE } from "./propertyNames";
import { toArray } from "./reducers";
import { Transducer, Transformer } from "./types";
import { isReduced } from "./util";

const ITERATOR_SYMBOL =
    typeof Symbol !== "undefined" ? Symbol.iterator : "@@iterator";

/**
 * For compatibility with environments where common types aren't iterable.
 */
export function getIterator<T>(collection: Iterable<T>): Iterator<T> {
    const anyCollection: any = collection;
    if (anyCollection[ITERATOR_SYMBOL]) {
        return anyCollection[ITERATOR_SYMBOL]();
    } else if (
        Array.isArray(anyCollection) ||
        typeof anyCollection === "string"
    ) {
        // Treat a string like an array of characters.
        return new ArrayIterator(anyCollection as T[]);
    } else {
        throw new Error(
            "Cannot get iterator of non iterable value: " + anyCollection,
        );
    }
}

/**
 * Iterator for arrays in environments without Iterable.
 */
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
    // We can't satisfy the IterableIterator interface while functioning in
    // environments without Symbol, hence the cast.
    return new RangeIterator(startOrEnd, end, step) as any;
}

/**
 * An iterable which enables lazy consumption of the output of a
 * transducer-based transform.
 */
class TransducerIterable<TInput, TOutput> implements Iterator<TOutput> {
    private readonly xfToArray: Transformer<TOutput[], TInput>;
    private upcoming: Iterator<TOutput> = new ArrayIterator([]);
    private hasSeenEnd: boolean = false;

    constructor(
        private readonly iterator: Iterator<TInput>,
        xf: Transducer<TInput, TOutput>,
    ) {
        this.xfToArray = xf(toArray());
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
                    let outValues = this.xfToArray[STEP]([], value);
                    if (isReduced(outValues)) {
                        this.hasSeenEnd = true;
                        outValues = outValues[VALUE];
                    }
                    this.upcoming = new ArrayIterator(outValues);
                }
            }
        }
    }
}

export function lazyTransduce<TInput, TOutput>(
    collection: Iterable<TInput>,
    transform: Transducer<TInput, TOutput>,
): IterableIterator<TOutput> {
    // We can't satisfy the IterableIterator interface while functioning in
    // environments without Symbol, hence the cast.
    return new TransducerIterable(getIterator(collection), transform) as any;
}
