import {
    chainFrom,
    rangeIterator,
    toAverage,
    toMax,
    toMin,
    toSum,
    transducerBuilder,
    Transformer,
} from "../src/index";

describe("transformer chain", () => {
    it("should apply transformations in order", () => {
        const input = [1, 2, 3, 4, 5];
        const inc = (n: number) => n + 1;
        const isEven = (n: number) => n % 2 === 0;
        const result1 = chainFrom(input)
            .map(inc)
            .filter(isEven)
            .toArray();
        const result2 = chainFrom(input)
            .filter(isEven)
            .map(inc)
            .toArray();
        expect(result1).toEqual([2, 4, 6]);
        expect(result2).toEqual([3, 5]);
    });
});

// ----- Transformations -----

describe("compose()", () => {
    it("should apply the specified transform", () => {
        const transducer = transducerBuilder<string>()
            .map(s => s.length)
            .build();
        const result = chainFrom(["a", "bb", "ccc"])
            .compose(transducer)
            .toArray();
        expect(result).toEqual([1, 2, 3]);
    });
});

describe("dedupe()", () => {
    it("should remove consecutive duplicates", () => {
        const result = chainFrom([1, 2, 2, 3, 3, 3])
            .dedupe()
            .toArray();
        expect(result).toEqual([1, 2, 3]);
    });
});

describe("drop()", () => {
    it("should drop the first n elements", () => {
        const result = chainFrom([1, 2, 3, 4, 5])
            .drop(2)
            .toArray();
        expect(result).toEqual([3, 4, 5]);
    });

    it("should drop everything if n is greater than the length", () => {
        const result = chainFrom([1, 2, 3, 4, 5])
            .drop(7)
            .toArray();
        expect(result).toEqual([]);
    });

    it("should drop nothing if n is 0", () => {
        const result = chainFrom([1, 2, 3, 4, 5])
            .drop(0)
            .toArray();
        expect(result).toEqual([1, 2, 3, 4, 5]);
    });

    it("should drop nothing if n is negative", () => {
        const result = chainFrom([1, 2, 3, 4, 5])
            .drop(-2)
            .toArray();
        expect(result).toEqual([1, 2, 3, 4, 5]);
    });
});

describe("dropWhile()", () => {
    it("should drop elements until the predicate fails", () => {
        const result = chainFrom([1, 2, 3, 4, 5])
            .dropWhile(n => n < 3)
            .toArray();
        expect(result).toEqual([3, 4, 5]);
    });

    it("should pass the index to the predicate as the second argument", () => {
        const result = chainFrom([0, 1, 2, 10, 4])
            .dropWhile((n, i) => n === i)
            .toArray();
        expect(result).toEqual([10, 4]);
    });
});

describe("filter()", () => {
    it("should remove elements not matching the filter", () => {
        const result = chainFrom([1, 2, 3, 4, 5])
            .filter(n => n % 2 === 0)
            .toArray();
        expect(result).toEqual([2, 4]);
    });

    it("should pass the index to the predicate as the second argument", () => {
        const result = chainFrom([0, 1, 2, 10, 4])
            .filter((n, i) => n === i)
            .toArray();
        expect(result).toEqual([0, 1, 2, 4]);
    });
});

describe("flatMap()", () => {
    it("should map then concatenate elements", () => {
        const result = chainFrom(["a", "bb", "ccc"])
            .flatMap(s => s.split(""))
            .toArray();
        expect(result).toEqual(["a", "b", "b", "c", "c", "c"]);
    });

    it("should pass the index to the function as the second argument", () => {
        const result = chainFrom([10, 20, 30])
            .flatMap((n, i) => [n, i])
            .toArray();
        expect(result).toEqual([10, 0, 20, 1, 30, 2]);
    });

    it("should work when mapping to iterators", () => {
        const result = chainFrom(["a", "bb", "ccc"])
            .flatMap(s => rangeIterator(s.length))
            .toArray();
        expect(result).toEqual([0, 0, 1, 0, 1, 2]);
    });

    it("should work when mapping to strings", () => {
        const result = chainFrom(["a", "bb", "ccc"])
            .flatMap(s => s)
            .toArray();
        expect(result).toEqual(["a", "b", "b", "c", "c", "c"]);
    });

    it("should consume iterators only as much as necessary", () => {
        const iterators = [
            rangeIterator(3),
            rangeIterator(3),
            rangeIterator(3),
        ];
        const result = chainFrom([0, 1, 2])
            .flatMap(n => iterators[n])
            .take(5)
            .toArray();
        expect(result).toEqual([0, 1, 2, 0, 1]);
        expect(iterators[0].next().done).toEqual(true);
        expect(iterators[1].next().value).toEqual(2);
        expect(iterators[2].next().value).toEqual(0);
    });
});

describe("interpose()", () => {
    it("should insert the separator between elements", () => {
        const result = chainFrom([1, 2, 3])
            .interpose(0)
            .toArray();
        expect(result).toEqual([1, 0, 2, 0, 3]);
    });
});

describe("map()", () => {
    it("should map over elements", () => {
        const result = chainFrom(["a", "bb", "ccc"])
            .map(s => s.length)
            .toArray();
        expect(result).toEqual([1, 2, 3]);
    });

    it("should pass the index to the function as the second argument", () => {
        const result = chainFrom([10, 10, 10])
            .map((x, i) => x * i)
            .toArray();
        expect(result).toEqual([0, 10, 20]);
    });
});

describe("partitionAll()", () => {
    it("should group elements by the specified size", () => {
        const result = chainFrom([1, 2, 3, 4, 5])
            .partitionAll(2)
            .toArray();
        expect(result).toEqual([[1, 2], [3, 4], [5]]);
    });

    it("should throw if n is 0", () => {
        expect(() => chainFrom([1, 2, 3, 4, 5]).partitionAll(0)).toThrowError(
            /0/,
        );
    });

    it("should throw if n is negative", () => {
        expect(() => chainFrom([1, 2, 3, 4, 5]).partitionAll(-2)).toThrowError(
            /negative/,
        );
    });
});

describe("partitionBy()", () => {
    it("should group elements with the same function value", () => {
        const result = chainFrom(["a", "b", "cc", "dd", "e"])
            .partitionBy(s => s.length)
            .toArray();
        expect(result).toEqual([["a", "b"], ["cc", "dd"], ["e"]]);
    });

    it("should pass the index to the function as the second argument", () => {
        const result = chainFrom([10, 9, 6, 5, 3, 1])
            .partitionBy((n, i) => n + i)
            .toArray();
        expect(result).toEqual([[10, 9], [6, 5], [3], [1]]);
    });
});

describe("remove()", () => {
    it("should remove elements matching the filter", () => {
        const result = chainFrom([1, 2, 3, 4, 5])
            .remove(n => n % 2 === 0)
            .toArray();
        expect(result).toEqual([1, 3, 5]);
    });

    it("should pass the index to the predicate as the second argument", () => {
        const result = chainFrom([0, 1, 2, 10, 4])
            .remove((n, i) => n === i)
            .toArray();
        expect(result).toEqual([10]);
    });
});

describe("removeAbsent()", () => {
    it("should remove null and undefined elements", () => {
        const result = chainFrom([1, null, 2, undefined, 3])
            .removeAbsent()
            .toArray();
        expect(result).toEqual([1, 2, 3]);
    });

    it("should preserve other falsy elements", () => {
        const result = chainFrom([false, null, 0, undefined, "", NaN])
            .removeAbsent()
            .toArray();
        expect(result).toEqual([false, 0, "", NaN]);
    });
});

describe("take()", () => {
    it("should take the first n elements", () => {
        const result = chainFrom([1, 2, 3, 4, 5])
            .take(3)
            .toArray();
        expect(result).toEqual([1, 2, 3]);
    });

    it("should terminate after pulling n elements", () => {
        const iterator = rangeIterator(1, 5);
        const result = chainFrom(iterator)
            .take(2)
            .toArray();
        expect(result).toEqual([1, 2]);
        expect(iterator.next().value).toEqual(3);
    });

    it("should take all elements if n is greater than length", () => {
        const result = chainFrom([1, 2, 3, 4, 5])
            .take(7)
            .toArray();
        expect(result).toEqual([1, 2, 3, 4, 5]);
    });

    it("should return empty if n is 0", () => {
        const result = chainFrom([1, 2, 3, 4, 5])
            .take(0)
            .toArray();
        expect(result).toEqual([]);
    });

    it("should return empty if n is negative", () => {
        const result = chainFrom([1, 2, 3, 4, 5])
            .take(-2)
            .toArray();
        expect(result).toEqual([]);
    });
});

describe("takeNth()", () => {
    it("should take every nth element", () => {
        const result = chainFrom([1, 2, 3, 4, 5])
            .takeNth(2)
            .toArray();
        expect(result).toEqual([1, 3, 5]);
    });

    it("should throw if n is 0", () => {
        expect(() => chainFrom([1, 2, 3, 4, 5]).takeNth(0)).toThrow(/0/);
    });

    it("should throw if n is negative", () => {
        expect(() => chainFrom([1, 2, 3, 4, 5]).takeNth(-2)).toThrow(
            /negative/,
        );
    });
});

describe("takeWhile()", () => {
    it("should take elements until the predicate fails", () => {
        const result = chainFrom([1, 2, 3, 4, 5])
            .takeWhile(n => n < 3)
            .toArray();
        expect(result).toEqual([1, 2]);
    });

    it("should pass the index to the predicate as the second argument", () => {
        const result = chainFrom([0, 1, 2, 10, 4])
            .takeWhile((n, i) => n === i)
            .toArray();
        expect(result).toEqual([0, 1, 2]);
    });

    it("should terminate after the predicate fails", () => {
        const iterator = rangeIterator(1, 5);
        const result = chainFrom(iterator)
            .takeWhile(n => n < 3)
            .toArray();
        expect(result).toEqual([1, 2]);
        expect(iterator.next().value).toEqual(4);
    });
});

// ----- Reductions -----

describe("reduce()", () => {
    const aPush = <T>(array: T[], x: T): T[] => {
        array.push(x);
        return array;
    };

    const transformer: Transformer<number[], number> = {
        ["@@transducer/init"]: () => [],
        ["@@transducer/result"]: x => x,
        ["@@transducer/step"]: aPush,
    };

    it("should use a reducer and initial value", () => {
        const result = chainFrom([1, 2, 3])
            .map(n => 2 * n)
            .reduce<number[]>(aPush, []);
        expect(result).toEqual([2, 4, 6]);
    });

    it("should use a transformer and no initial value", () => {
        const result = chainFrom([1, 2, 3])
            .map(n => 2 * n)
            .reduce(transformer);
        expect(result).toEqual([2, 4, 6]);
    });
});

describe("count()", () => {
    it("should return the number of elements", () => {
        const result = chainFrom([1, 2, 3, 4, 5])
            .filter(n => n < 3)
            .count();
        expect(result).toEqual(2);
    });
});

describe("every()", () => {
    it("should return true if all elements match the predicate", () => {
        const result = chainFrom([1, 2, 3, 4, 5])
            .map(n => 10 * n)
            .every(n => n > 3);
        expect(result).toEqual(true);
    });

    it("should return false if any element fails the predicate", () => {
        const result = chainFrom([1, 2, 3, 4, 5])
            .map(n => 10 * n)
            .every(n => n < 30);
        expect(result).toEqual(false);
    });

    it("should short-circuit if a failure is found", () => {
        const iterator = rangeIterator(1, 5);
        const result = chainFrom(iterator)
            .map(n => 10 * n)
            .every(n => n < 30);
        expect(result).toEqual(false);
        expect(iterator.next().value).toEqual(4);
    });

    it("should pass the index to the predicate as the second argument", () => {
        const result1 = chainFrom([0, 1, 2, 3, 4]).every((n, i) => n === i);
        const result2 = chainFrom([0, 1, 2, 4, 4]).every((n, i) => n === i);
        expect(result1).toEqual(true);
        expect(result2).toEqual(false);
    });
});

describe("find()", () => {
    const input = [1, 2, 3, 4, 5];

    it("should return the first element matching the predicate", () => {
        const result = chainFrom(input).find(x => x > 2);
        expect(result).toEqual(3);
    });

    it("should return null if there are no matching elements", () => {
        const result = chainFrom(input)
            .map(x => x * 2)
            .find(x => x % 2 === 1);
        expect(result).toBeNull();
    });

    it("should terminate computation upon finding a match", () => {
        const iterator = rangeIterator(1, 5);
        const result = chainFrom(iterator)
            .map(x => 10 * x)
            .find(x => x === 20);
        expect(result).toEqual(20);
        expect(iterator.next().value).toEqual(3);
    });

    it("should pass the index to the predicate as the second argument", () => {
        const result = chainFrom([0, 1, 2, 10, 4]).find((x, i) => x !== i);
        expect(result).toEqual(10);
    });
});

describe("first()", () => {
    const input = [1, 2, 3, 4, 5];

    it("should return the first element if it exists", () => {
        const result = chainFrom(input)
            .map(x => 2 * x)
            .drop(2)
            .first();
        expect(result).toEqual(6);
    });

    it("should return null if there are no elements", () => {
        const result = chainFrom(input)
            .filter(n => n > 10)
            .first();
        expect(result).toBeNull();
    });

    it("should terminate computation", () => {
        const iterator = rangeIterator(1, 5);
        const result = chainFrom(iterator)
            .map(x => 10 * x)
            .first();
        expect(result).toEqual(10);
        expect(iterator.next().value).toEqual(2);
    });
});

describe("forEach()", () => {
    it("should call the provided function on each input", () => {
        const input = ["a", "bb", "ccc"];
        const result: number[] = [];
        chainFrom(input)
            .map(s => s.length)
            .forEach(n => result.push(n));
        expect(result).toEqual([1, 2, 3]);
    });

    it("should pass the index to the function as the second argument", () => {
        const result: number[] = [];
        chainFrom([10, 20, 30]).forEach((n, i) => result.push(n * i));
        expect(result).toEqual([0, 20, 60]);
    });
});

describe("isEmpty()", () => {
    it("should return true if there are no elements", () => {
        const result = chainFrom([1, 2, 3, 4, 5])
            .filter(n => n > 10)
            .isEmpty();
        expect(result).toEqual(true);
    });

    it("should return false if there are any elements", () => {
        const result = chainFrom([1, 2, 3, 4, 5])
            .filter(n => n % 2 === 0)
            .isEmpty();
        expect(result).toEqual(false);
    });

    it("should terminate after one element", () => {
        const iterator = rangeIterator(1, 5);
        const result = chainFrom(iterator)
            .map(n => 10 * n)
            .isEmpty();
        expect(result).toEqual(false);
        expect(iterator.next().value).toEqual(2);
    });
});

describe("joinToString()", () => {
    it("should concatenate the elements into a string with the separator", () => {
        const result = chainFrom([1, 2, 3, 4, 5])
            .filter(n => n % 2 === 1)
            .joinToString(" -> ");
        expect(result).toEqual("1 -> 3 -> 5");
    });

    it("should work if the separator is the empty string", () => {
        const result = chainFrom([1, 2, 3, 4, 5])
            .filter(n => n % 2 === 1)
            .joinToString("");
        expect(result).toEqual("135");
    });
});

describe("some()", () => {
    it("should return true if any element matches the predicate", () => {
        const result = chainFrom([1, 2, 3, 4, 5])
            .map(n => 10 * n)
            .some(n => n === 30);
        expect(result).toEqual(true);
    });

    it("should return false if no element matches the predicate", () => {
        const result = chainFrom([1, 2, 3, 4, 5])
            .map(n => 10 * n)
            .some(n => n === 1);
        expect(result).toEqual(false);
    });

    it("should short-circuit if a match is found", () => {
        const iterator = rangeIterator(1, 5);
        const result = chainFrom(iterator)
            .map(n => 10 * n)
            .some(n => n === 30);
        expect(result).toEqual(true);
        expect(iterator.next().value).toEqual(4);
    });
});

describe("toObject()", () => {
    it("should make an object using the provided functions", () => {
        const input = ["a", "bb", "ccc"];
        const result = chainFrom(input).toObject(s => s, s => s.length);
        expect(result).toEqual({ a: 1, bb: 2, ccc: 3 });
    });

    it("should replace earlier values with later ones at the same key", () => {
        const input: Array<[string, number]> = [["a", 1], ["b", 1], ["a", 2]];
        const result = chainFrom(input).toObject(x => x[0], x => x[1]);
        expect(result).toEqual({ a: 2, b: 1 });
    });

    it("should pass the index to the functions as the second argument", () => {
        const input = ["a", "b", "c"];
        const result = chainFrom(input).toObject((s, i) => s + i, (_, i) => i);
        expect(result).toEqual({ a0: 0, b1: 1, c2: 2 });
    });
});

describe("toArray()", () => {
    const input = ["a", "bb", "ccc"];

    it("should return an input array if no transforms", () => {
        const result = chainFrom(input).toArray();
        expect(result).toEqual(input);
    });

    it("should convert iterable input to an array", () => {
        const iterator = input[Symbol.iterator]();
        const result = chainFrom(iterator).toArray();
        expect(result).toEqual(input);
    });
});

describe("toIterator()", () => {
    it("should return an iterable whose @@iterator is itself", () => {
        const iterator = chainFrom([1, 2, 3])
            .map(n => 2 * n)
            .toIterator();
        expect(iterator[Symbol.iterator]()).toBe(iterator);
    });

    it("should return an iterator of the elements", () => {
        const iterator = chainFrom([1, 2, 3])
            .map(n => 2 * n)
            .toIterator();
        const result = Array.from(iterator);
        expect(result).toEqual([2, 4, 6]);
    });

    it("should respect early termination", () => {
        const iterator = rangeIterator(1, 5);
        const truncatedIterator = chainFrom(iterator)
            .take(2)
            .toIterator();
        const result = Array.from(truncatedIterator);
        expect(result).toEqual([1, 2]);
        expect(iterator.next().value).toEqual(3);
    });

    it("should work with flatMap()", () => {
        // This tests that the iterator works with transducers that produce
        // multiple outputs for one input.
        const iterator = chainFrom(["a", "bb", "ccc"])
            .flatMap(s => s.split(""))
            .toIterator();
        const result = Array.from(iterator);
        expect(result).toEqual(["a", "b", "b", "c", "c", "c"]);
    });

    it("should work when iterating strings", () => {
        const iterator = chainFrom("hello")
            .filter(c => c !== "l")
            .toIterator();
        const result = Array.from(iterator);
        expect(result).toEqual(["h", "e", "o"]);
    });
});

describe("toAverage()", () => {
    it("should average the elements", () => {
        const result = chainFrom([1, 2, 3, 4, 5]).reduce(toAverage());
        expect(result).toEqual(3);
    });

    it("should return null on empty input", () => {
        const result = chainFrom([]).reduce(toAverage());
        expect(result).toBeNull();
    });
});

describe("toMax()", () => {
    it("should take the max of numbers", () => {
        const result = chainFrom([3, 4, 5, 1, 2]).reduce(toMax());
        expect(result).toEqual(5);
    });

    it("should return null on empty input", () => {
        const result = chainFrom([]).reduce(toMax());
        expect(result).toBeNull();
    });

    it("should use the comparator if provided", () => {
        const result = chainFrom([["a", 2], ["b", 1], ["c", 3]]).reduce(
            toMax(
                (a: [string, number], b: [string, number]) =>
                    a[1] < b[1] ? -1 : 1,
            ),
        );
        expect(result).toEqual(["c", 3]);
    });
});

describe("toMin()", () => {
    it("should take the min of numbers", () => {
        const result = chainFrom([3, 4, 5, 1, 2]).reduce(toMin());
        expect(result).toEqual(1);
    });

    it("should return null on empty input", () => {
        const result = chainFrom([]).reduce(toMin());
        expect(result).toBeNull();
    });

    it("should use the comparator if provided", () => {
        const result = chainFrom([["a", 2], ["b", 1], ["c", 3]]).reduce(
            toMin(
                (a: [string, number], b: [string, number]) =>
                    a[1] < b[1] ? -1 : 1,
            ),
        );
        expect(result).toEqual(["b", 1]);
    });
});

describe("toSum()", () => {
    it("should sum the elements", () => {
        const result = chainFrom([1, 2, 3, 4, 5]).reduce(toSum());
        expect(result).toEqual(15);
    });

    it("should return 0 on empty input", () => {
        const result = chainFrom([]).reduce(toSum());
        expect(result).toEqual(0);
    });
});

describe("transducer builder", () => {
    it("should return the identity if no transforms provided", () => {
        const transducer = transducerBuilder<number>().build();
        const result = chainFrom([1, 2, 3])
            .compose(transducer)
            .toArray();
        expect(result).toEqual([1, 2, 3]);
    });

    it("should return the composition of the specified operations", () => {
        const transducer = transducerBuilder<number>()
            .map(x => x + 1)
            .filter(x => x % 2 === 0)
            .build();
        const result = chainFrom([1, 2, 3, 4, 5])
            .compose(transducer)
            .toArray();
        expect(result).toEqual([2, 4, 6]);
    });
});

// ----- Utilities -----

describe("rangeIterator()", () => {
    it("should iterate from 0 to end with single argument", () => {
        expect(Array.from(rangeIterator(5))).toEqual([0, 1, 2, 3, 4]);
    });

    it("should iterate from start to end with two arguments", () => {
        expect(Array.from(rangeIterator(2, 5))).toEqual([2, 3, 4]);
    });

    it("should iterate in steps with three arguments", () => {
        expect(Array.from(rangeIterator(2, 7, 2))).toEqual([2, 4, 6]);
    });

    it("should iterate backwards if the step is negative", () => {
        expect(Array.from(rangeIterator(7, 2, -2))).toEqual([7, 5, 3]);
    });

    it("should be empty if start is at least end and step is positive", () => {
        expect(Array.from(rangeIterator(2, 2))).toEqual([]);
        expect(Array.from(rangeIterator(3, 2))).toEqual([]);
    });

    it("should be empty if start is at most end and step is negative", () => {
        expect(Array.from(rangeIterator(2, 2, -1))).toEqual([]);
        expect(Array.from(rangeIterator(2, 3, -1))).toEqual([]);
    });

    it("should throw if step is 0", () => {
        expect(() => rangeIterator(1, 5, 0)).toThrowError(/0/);
    });
});
