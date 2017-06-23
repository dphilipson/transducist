import * as t from "transducers-js";
import { chainFrom, transducerBuilder } from "../src/index";

describe("toArray()", () => {
    const input = ["a", "bb", "ccc"];

    it("should return an input array if no transforms", () => {
        const result = chainFrom(input).toArray();
        expect(result).toEqual(input);
    });

    it("should convert iterable input to an array", () => {
        const set = new ArrayIterator(input);
        const result = chainFrom(set).toArray();
        expect(result).toEqual(input);
    });
});

describe("transformer chain", () => {
    it("should apply transformations in order", () => {
        const input = [1, 2, 3, 4, 5];
        const inc = (n: number) => n + 1;
        const isEven = (n: number) => n % 2 === 0;
        const result1 = chainFrom(input).map(inc).filter(isEven).toArray();
        const result2 = chainFrom(input).filter(isEven).map(inc).toArray();
        expect(result1).toEqual([2, 4, 6]);
        expect(result2).toEqual([3, 5]);
    });
});

describe("compose()", () => {
    it("should apply the specified transform", () => {
        const result = chainFrom(["a", "bb", "ccc"])
            .compose(t.map((s: string) => s.length))
            .toArray();
        expect(result).toEqual([1, 2, 3]);
    });
});

describe("map()", () => {
    it("should map over elements", () => {
        const result = chainFrom(["a", "bb", "ccc"])
            .map(s => s.length)
            .toArray();
        expect(result).toEqual([1, 2, 3]);
    });
});

describe("filter()", () => {
    it("should remove elements not matching the filter", () => {
        const result = chainFrom([1, 2, 3, 4, 5])
            .filter(n => n % 2 === 0)
            .toArray();
        expect(result).toEqual([2, 4]);
    });
});

describe("remove()", () => {
    it("should remove elements matching the filter", () => {
        const result = chainFrom([1, 2, 3, 4, 5])
            .remove(n => n % 2 === 0)
            .toArray();
        expect(result).toEqual([1, 3, 5]);
    });
});

describe("keep()", () => {
    it("should map elements and keep non-nulls", () => {
        const map: { [key: string]: boolean | null | undefined } = {
            a: true,
            b: null,
            c: true,
            d: undefined,
            e: false,
        };
        const result = chainFrom(["a", "b", "c", "d", "e"])
            .keep(s => map[s])
            .toArray();
        expect(result).toEqual([true, true, false]);
    });
});

describe("mapcat()", () => {
    it("should map then concatenate elements", () => {
        const result = chainFrom(["a", "bb", "ccc"])
            .mapcat(s => s.split(""))
            .toArray();
        expect(result).toEqual(["a", "b", "b", "c", "c", "c"]);
    });
});

describe("dedupe()", () => {
    it("should remove consecutive duplicates", () => {
        const result = chainFrom([1, 2, 2, 3, 3, 3]).dedupe().toArray();
        expect(result).toEqual([1, 2, 3]);
    });
});

describe("take()", () => {
    it("should take the first n elements", () => {
        const result = chainFrom([1, 2, 3, 4, 5]).take(3).toArray();
        expect(result).toEqual([1, 2, 3]);
    });
});

describe("takeWhile()", () => {
    it("should take elements until the predicate fails", () => {
        const result = chainFrom([1, 2, 3, 4, 5])
            .takeWhile(n => n < 3)
            .toArray();
        expect(result).toEqual([1, 2]);
    });
});

describe("takeNth()", () => {
    it("should take every nth element", () => {
        const result = chainFrom([1, 2, 3, 4, 5]).takeNth(2).toArray();
        expect(result).toEqual([1, 3, 5]);
    });
});

describe("drop()", () => {
    it("should drop the first n elements", () => {
        const result = chainFrom([1, 2, 3, 4, 5]).drop(2).toArray();
        expect(result).toEqual([3, 4, 5]);
    });
});

describe("dropWhile()", () => {
    it("should drop elements until the predicate fails", () => {
        const result = chainFrom([1, 2, 3, 4, 5])
            .dropWhile(n => n < 3)
            .toArray();
        expect(result).toEqual([3, 4, 5]);
    });
});

describe("partition()", () => {
    it("should group elements by the specified size", () => {
        const result = chainFrom([1, 2, 3, 4, 5]).partition(2).toArray();
        expect(result).toEqual([[1, 2], [3, 4], [5]]);
    });
});

describe("partitionBy()", () => {
    it("should group elements with the same function value", () => {
        const result = chainFrom(["a", "b", "cc", "dd", "e"])
            .partitionBy(s => s.length)
            .toArray();
        expect(result).toEqual([["a", "b"], ["cc", "dd"], ["e"]]);
    });
});

describe("interpose()", () => {
    it("should insert the separator between elements", () => {
        const result = chainFrom([1, 2, 3]).interpose(0).toArray();
        expect(result).toEqual([1, 0, 2, 0, 3]);
    });
});

describe("reduce()", () => {
    const aPush = <T>(array: T[], x: T): T[] => {
        array.push(x);
        return array;
    };

    const transformer: t.Transformer<number[], number> = {
        ["@@transducer/init"]: () => [],
        ["@@transducer/result"]: x => x,
        ["@@transducer/step"]: aPush,
    };

    it("should use a reducer and initial value", () => {
        const result = chainFrom([1, 2, 3]).map(n => 2 * n).reduce(aPush, []);
        expect(result).toEqual([2, 4, 6]);
    });

    it("should use a transformer and no initial value", () => {
        const result = chainFrom([1, 2, 3]).map(n => 2 * n).reduce(transformer);
        expect(result).toEqual([2, 4, 6]);
    });

    it("should use a transformer and initial value", () => {
        const result = chainFrom([1, 2, 3])
            .map(n => 2 * n)
            .reduce(transformer, [1]);
        expect(result).toEqual([1, 2, 4, 6]);
    });
});

describe("toIterator()", () => {
    it("should return an iterator of the elements", () => {
        const iterator = chainFrom([1, 2, 3]).map(n => 2 * n).toIterator();
        const result = Array.from(iterator);
        expect(result).toEqual([2, 4, 6]);
    });

    it("should respect early termination", () => {
        const rangeIterator = new ArrayIterator([1, 2, 3, 4, 5]);
        const truncatedIterator = chainFrom(rangeIterator).take(2).toIterator();
        const result = Array.from(truncatedIterator);
        expect(result).toEqual([1, 2]);
        expect(rangeIterator.next().value).toEqual(3);
    });
});

describe("forEach()", () => {
    it("should call the provided function on each input", () => {
        const input = ["a", "bb", "ccc"];
        const result: number[] = [];
        chainFrom(input).map(s => s.length).forEach(n => result.push(n));
        expect(result).toEqual([1, 2, 3]);
    });
});

describe("first()", () => {
    const input = [1, 2, 3, 4, 5];

    it("should return the first element if it exists", () => {
        const result = chainFrom(input).map(x => 2 * x).drop(2).first();
        expect(result).toEqual(6);
    });

    it("should return null if there are no elements", () => {
        const result = chainFrom(input).filter(n => n > 10).first();
        expect(result).toBeNull();
    });

    it("should terminate computation", () => {
        const rangeIterator = new ArrayIterator([1, 2, 3, 4, 5]);
        const result = chainFrom(rangeIterator).map(x => 10 * x).first();
        expect(result).toEqual(10);
        expect(rangeIterator.next().value).toEqual(2);
    });
});

describe("transducer builder", () => {
    it("should return the identity if no transforms provided", () => {
        const transducer = transducerBuilder<number>().build();
        const result = t.into([], transducer, [1, 2, 3]);
        expect(result).toEqual([1, 2, 3]);
    });

    it("should return the composition of the specified operations", () => {
        const transducer = transducerBuilder<number>()
            .map(x => x + 1)
            .filter(x => x % 2 === 0)
            .build();
        const result = t.into([], transducer, [1, 2, 3]);
        expect(result).toEqual([2, 4]);
    });
});

class ArrayIterator<T> implements IterableIterator<T> {
    private i: number = 0;

    constructor(private readonly array: T[]) {}

    public [Symbol.iterator]() {
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
