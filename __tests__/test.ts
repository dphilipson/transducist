import * as t from "transducers-js";
import {
    chainFrom,
    toAverage,
    toMax,
    toMin,
    toSum,
    transducerBuilder,
} from "../src/index";

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

    it("should iterate over key-value pairs for objects", () => {
        const input = { a: 1, b: 2, c: 3 };
        const result = chainFrom(input)
            .filter(([key, value]) => key === "b" || value === 3)
            .toArray();
        expect(result).toContainEqual(["b", 2]);
        expect(result).toContainEqual(["c", 3]);
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

    it("should terminate after pulling n elements", () => {
        const rangeIterator = new ArrayIterator([1, 2, 3, 4, 5]);
        const result = chainFrom(rangeIterator).take(2).toArray();
        expect(result).toEqual([1, 2]);
        expect(rangeIterator.next().value).toEqual(3);
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

describe("partitionAll()", () => {
    it("should group elements by the specified size", () => {
        const result = chainFrom([1, 2, 3, 4, 5]).partitionAll(2).toArray();
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

    it("should work with mapcat()", () => {
        // This tests that the iterator works with transducers that produce
        // multiple outputs for one input.
        const iterator = chainFrom(["a", "bb", "ccc"])
            .mapcat(s => s.split(""))
            .toIterator();
        const result = Array.from(iterator);
        expect(result).toEqual(["a", "b", "b", "c", "c", "c"]);
    });

    it("should work when iterating objects", () => {
        const iterator = chainFrom({ a: 1, b: 2, c: 3 })
            .filter(([key, value]) => key === "b" || value === 3)
            .toIterator();
        const result = Array.from(iterator);
        expect(result).toContainEqual(["b", 2]);
        expect(result).toContainEqual(["c", 3]);
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

describe("find()", () => {
    const input = [1, 2, 3, 4, 5];

    it("should return the first element matching the predicate", () => {
        const result = chainFrom(input).find(x => x > 2);
        expect(result).toEqual(3);
    });

    it("should return null if there are no matching elements", () => {
        const result = chainFrom(input).map(x => x * 2).find(x => x % 2 === 1);
        expect(result).toBeNull();
    });

    it("should terminate computation upon finding a match", () => {
        const rangeIterator = new ArrayIterator([1, 2, 3, 4, 5]);
        const result = chainFrom(rangeIterator)
            .map(x => 10 * x)
            .find(x => x === 20);
        expect(result).toEqual(20);
        expect(rangeIterator.next().value).toEqual(3);
    });
});

describe("count()", () => {
    it("should return the number of elements", () => {
        const result = chainFrom([1, 2, 3, 4, 5]).filter(n => n < 3).count();
        expect(result).toEqual(2);
    });
});

describe("toSum()", () => {
    it("should sum the elements", () => {
        const result = chainFrom([1, 2, 3, 4, 5]).reduce(toSum());
        expect(result).toEqual(15);
    });
});

describe("toAverage()", () => {
    it("should average the elements", () => {
        const result = chainFrom([1, 2, 3, 4, 5]).reduce(toAverage());
        expect(result).toEqual(3);
    });
});

describe("toMin()", () => {
    it("should take the min of numbers", () => {
        const result = chainFrom([3, 4, 5, 1, 2]).reduce(toMin());
        expect(result).toEqual(1);
    });

    it("should take the min of strings", () => {
        const result = chainFrom(["c", "b", "a", "e", "d"]).reduce(toMin());
        expect(result).toEqual("a");
    });

    it("should return null on no input", () => {
        const result = chainFrom([]).reduce(toMin());
        expect(result).toBeNull();
    });

    it("should use the comparator if provided", () => {
        const result = chainFrom({ a: 2, b: 1, c: 3 }).reduce(
            toMin(
                (a: [string, number], b: [string, number]) =>
                    a[1] < b[1] ? -1 : 1,
            ),
        );
        expect(result).toEqual(["b", 1]);
    });
});

describe("toMax()", () => {
    it("should take the max of numbers", () => {
        const result = chainFrom([3, 4, 5, 1, 2]).reduce(toMax());
        expect(result).toEqual(5);
    });

    it("should take the max of strings", () => {
        const result = chainFrom(["c", "b", "a", "e", "d"]).reduce(toMax());
        expect(result).toEqual("e");
    });

    it("should return null on no input", () => {
        const result = chainFrom([]).reduce(toMax());
        expect(result).toBeNull();
    });

    it("should use the comparator if provided", () => {
        const result = chainFrom({ a: 2, b: 1, c: 3 }).reduce(
            toMax(
                (a: [string, number], b: [string, number]) =>
                    a[1] < b[1] ? -1 : 1,
            ),
        );
        expect(result).toEqual(["c", 3]);
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
        const result = t.into([], transducer, [1, 2, 3, 4, 5]);
        expect(result).toEqual([2, 4, 6]);
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
