# TypeScript Transducers

Ergonomic TypeScript transducers for beginners and experts.

## Introduction

This library will let you write code that looks like this:
```ts
// Let's find 100 people who have a parent named Brad who runs Haskell projects
// so we can ask them about their dads Brads' monads.
const result = chainFrom(allProjects)
    .filter(project => project.language === "Haskell")
    .map(project => project.owner)
    .filter(owner => owner.name === "Brad")
    .flatMap(owner => owner.children)
    .take(100)
    .forEach(person => console.log(person));
```
This computation is very efficient because no intermediate arrays are created
and work stops early once 100 people are found.

You might be thinking that this looks very similar to [chains in
Lodash](https://lodash.com/docs/4.17.4#chain) or various other libraries that
offer a similar API. But this library is different because it's built on top of
[transducers-js](https://github.com/cognitect-labs/transducers-js) and exposes
all the benefits of using transducers, such as being able to easily add new
transformation types to the middle of a chain and producing logic applicable to
any data structure, not just arrays.

Never heard of a transducer? Check the links in the
[transducers-js](https://github.com/cognitect-labs/transducers-js) readme for an
introduction to the concept, but note that **you don't need to understand
anything about transducers to use this library**.

## Goals

Provide an API for using transducers that is…

* **…easy** to use even **without transducer knowledge or experience**. If you
  haven't yet wrapped your head around transducers or need to share a codebase
  with others who haven't, the basic chaining API is fully usable without ever
  seeing a reference to transducers or anything more advanced than `map` and
  `filter`. However, it is also…

* …able to reap the **full benefits of transducers** for those who are familiar
  with them. By using the general purpose `.compose()` to place custom
  transducers in the middle of a chain, any kind of novel transform can be added
  while still maintaining the efficiency bonuses of laziness and
  short-cicuiting. Further, the library can also be used to construct standalone
  transducers which may be used elsewhere by other libraries that incorporate
  transducers into their API.

* **…convenient with TypeScript IDEs**. Typical transducer libraries, such as
  [transducers.js](https://github.com/jlongster/transducers.js) and
  [transducers-js](https://github.com/cognitect-labs/transducers-js), are hard
  to use with TypeScript. They depend on calling `compose` to glue transducers
  together, which if typed correctly has an ugly type signature with many type
  parameters and overloads, and which generates cryptic TypeScript errors if
  something is amiss. Instead, we use a familiar chaining API which grants easy
  autocompletion in an IDE, as well as aiding readability.

  Of course, this library can be consumed without TypeScript as well. You will
  lose the typechecking and autocomplete benefits, but keep all the other
  advantages.

* **…typesafe**. Avoid the type fuzziness that is present in other transform
  chaining APIs. For example, under Lodash's type definitions, the following
  typechecks:
  ```ts
  const badSum = _([{a: true}, {b: false}]).sum();
  // Returns "[object Object][object Object]", if you're curious.
  ```
  and given Lodash's API, there is no way to correctly type this. By contrast,
  this library has the typesafe
  ```ts
  const goodSum = chainFrom([1, 2, 3]).reduce(toSum()); // -> 6
  ```

* **…fast**! Typescript-transducers is a thin wrapper on top of
  [transducers-js](https://github.com/cognitect-labs/transducers-js) and is
  therefore very efficient. See this [blog
  post](http://jlongster.com/Transducers.js-Round-2-with-Benchmarks) by the
  author of [transducers.js](https://github.com/jlongster/transducers.js) for
  some benchmarks. That post is also a great description of some other
  advantages of transducers.

## Installation

With Yarn:
```
yarn add typescript-transducers
```
With NPM:
```
npm install --save typescript-transducers
```
This library works fine on ES5 without any polyfills, but its TypeScript
definitions depend on ES6 definitions for the `Iterable` type. If you use it
with TypeScript, you must make definitions for `Iterable` and `Iterator`
available by doing one of the following:

* In `tsconfig.json`, set `"target"` to `"es6"` or higher.
* In `tsconfig.json`, set `"libs"` to include `"es2015.iterable"` or something
  that includes it.
* Add the definitions by some other means, such as importing types for
  `es6-shim`.

## Basic Usage (no transducer knowledge required)

Import with
```ts
import { chainFrom } from "typescript-transducers";
```
Start a chain by calling `chainFrom` on any iterable, including an array or a
string (or an object, see the full [API](#api)).
```ts
const result = chainFrom(["a", "bb", "ccc", "dddd", "eeeee"])
```
Then follow up with any number of transforms.
```ts
    .map(s => s.toUpperCase())
    .filter(s => s.length % 2 === 1)
    .take(2)
```
To finish the chain and get a result out, call a method which terminates the
chain and produces a result.
```ts
    .toArray(); // -> ["A", "CCC"]
```
For a list of all possible transformations and terminations, see [API](#api).

## Advanced Usage

### Adding arbitrary transducers

Arbitrary transducers that satisfy the [transducer
protocol](https://github.com/cognitect-labs/transducers-js#the-transducer-protocol)
can be added to the chain using the `.compose()` method. This includes
transducers defined by other libraries, so we could for instance do
```ts
import { chainFrom } from "typescript-transducers";
import { cat } from "transducers.js";

const result = chainFrom([[1, 2], [3, 4, 5], [6]])
    .drop(1)
    .compose(cat)
    .map(x => -x)
    .toArray(); // -> [-3, -4, -5, -6];
```
Similarly, arbitrary terminating operations can be introduced using the
`.reduce()` method, which can accept not only a plain reducer function (that is,
a function of the form `(acc, x) => acc`) but also any object satisfying the
[transformer
protocol](https://github.com/cognitect-labs/transducers-js#transformer-protocol).
In fact, all of this library's built-in methods are implemented with calls to
`.compose()` or `.reduce()` (with the single exception of `.toIterator()`).

### Creating a standalone transducer

It is also possible to use a chaining API to define a transducer without using
it in a computation, so it can be passed around and consumed by other APIs which
understand the transducer protocol, such as
[transduce-stream](https://github.com/transduce/transduce-stream). This is done
by starting the chain by calling `transducerBuilder()` and calling `.build()`
when done, for example:
```ts
import { chainFrom, transducerBuilder } from "typescript-transducers";

const firstThreeOdds = transducerBuilder<number>()
    .filter(n => n % 2 === 1)
    .take(3)
    .build();
```
Since this returns a transducer, we can also use it ourselves with `.compose()`:
```ts
const result = chainFrom([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    .compose(firstThreeOdds)
    .toArray(); // -> [1, 3, 5]
```
This is a good way to factor out a transformation for reuse.

### Equivalents in other libraries

For users familiar with other transducer libraries,
```ts
fromChain(collection)
    .compose(transducerA)
    .compose(transducerB)
    .reduce(transformer, initialValue);
```
is equivalent to other libraries'
```ts
transduce(
    compose(transducerA, transducerB),
    transformer,
    initialValue,
    collection
);
```
and
```ts
transducerBuilder()
    .compose(transducerA)
    .compose(transducerB)
    .build();
```
is equivalent to other libraries'
```ts
compose(transducerA, transducerB);
```

## API

### Starting a chain

#### `chainFrom(iterable)`

Starts a chain. Any number of transformation methods may be added, after which a
termination method should be called to produce a result. No computation is done
until a termination method is called.

The argument may be any iterable, including an array or a string. The argument
may also be an object, in which case it is treated as an iterable of key-value
pairs, each a two element array.

#### `transducerBuilder()`

Starts a chain for constructing a new transducer. Any number of trasformation
methods may be added, after which `.build()` should be called to produce a
transducer.

### Transformation methods

Any number of these methods may be called on a chain to add transformations in
sequence.

#### `map(f)`

Transforms each element by applying `f` to it. For example:
```ts
chainFrom([1, 2, 3])
    .map(x => x * 2)
    .toArray(); // -> [2, 4, 6]
```

#### `filter(pred)`

Keeps only the elements matching the predicate `pred`. For example:
```ts
chainFrom([1, 2, 3, 4])
    .map(x => x % 2 === 1)
    .toArray(); // -> [1, 3]
```

#### `remove(pred)`

Like `filter()`, but removes the elements matching `pred` instead. For example:
```ts
chainFrom([1, 2, 3])
    .remove(x => x % 2 === 1)
    .toArray(); // -> [2, 4]
```

#### `keep(f)`

Transforms each element by applying `f` to it, but drops any elements for which
`f` returns `null` or `undefined` (but not other falsy values). For example:
```ts
chainFrom([{a: 1}, {a: 2}, {b: 3}])
    .keep(o => o.a)
    .toArray(); // -> [1, 2]
```

#### `flatMap(f)`

For `f` a function which maps each element to an iterable, applies `f` to each
element and concatenates the results. For example:
```ts
const authors = [
    { name: "cbrontë", books: ["Jane Eyre", "Shirley"] },
    { name: "mshelley", books: ["Frankenstein"] },
]

chainFrom(authors)
    .mapcat(author => author.books)
    .toArray();
// -> ["Jane Eyre", "Shirley", "Frankenstein"]
```

#### `dedupe()`

Removes elements that are equal to the proceeding element according to an `===`
check. For example:
```ts
chainFrom([1, 2, 2, 3, 3, 3])
    .dedupe()
    .toArray(); // -> [1, 2, 3]
```

#### `take(n)`

Takes the first `n` elements and drops the rest. An essential opperation for
efficiency, because it stops computations from occurring on more elements of the
input than needed to produce `n` results. For example:
```ts
chainFrom([1, 2, 3, 4, 5])
    .take(3)
    .toArray(); // -> [1, 2, 3]
```

#### `takeWhile(pred)`

Takes elements as long as the predicate `pred` holds, then drops the rest. Like
`take()`, stops unnecessary computations on elements after `pred` fails. For
example:
```ts
chainFrom([1, 2, 3, 4, 5])
    .takeWhile(n => n < 3)
    .toArray(); // -> [1, 2]
```

#### `takeNth(n)`

Takes every `n`th element, starting from the first one. In other words, it takes
the elements whose indices are multiples of `n`. For example:
```ts
chainFrom([1, 2, 3, 4, 5, 6])
    .takeNth(2)
    .toArray(); // [1, 3, 5]
```

#### `drop(n)`

Skips the first `n` elements. For example:
```ts
chainFrom([1, 2, 3, 4, 5])
    .drop(3)
    .toArray(); // -> [4, 5]
```

#### `dropWhile(pred)`

Skips elements as long as the predicate `pred` holds. For example:
```ts
chainFrom([1, 2, 3, 4, 5])
    .dropWhile(n => n < 3)
    .toArray(); // -> [3, 4, 5]
```

#### `partitionAll(n)`

Groups elements into arrays of `n` elements. If the number of elements does not
divide perfectly by `n`, the last array will have fewer than `n` elements. For
example:
```ts
chainFrom([1, 2, 3, 4, 5])
    .partitionAll(2)
    .toArray();
// -> [[1, 2], [3, 4], [5]]
```

#### `partitionBy(f)`

Groups consecutive elements for which `f` returns the same value by a `===`
check into arrays. For example:
```ts
chainFrom(["a", "ab", "bc", "c", "cd", "cde"])
    .partitionBy(s => s[0])
    .toArray();
// -> [["a", "ab"], ["bc"], ["c", "cd", "cde"]]
```

#### `interpose(separator)`

Inserts `separator` between each pair of elements. For example:
```ts
chainFrom([1, 2, 3, 4, 5])
    .interpose(0)
    .toArray();
// -> [1, 0, 2, 0, 3, 0, 4, 0, 5]
```

#### `compose(transducer)`

Add an arbitrary transducer to the chain. `transducer` should be a function
which implements the [transducer
protocol](https://githube.com/cognitect-labs/transducers-js#the-transducer-protocol),
meaning it is a function which takes a `Transformer` and returns another
`Transformer`. This is the most general transformation, and it is used by this
library internally to implement all the others. For example usage, see the
[Advanced Usage](#advanced-usage) section.

### Ending a chain

The following methods terminate a chain started with `chainFrom`, performing the
calculations and producing a result.

#### `toArray()`

Returns an array of the results. See any of the above examples.

#### `forEach(f)`

Calls `f` on each element of the result, presumably for side-effects. For
example:
```ts
chainFrom([1, 2, 3, 4, 5])
    .map(x => x * 10)
    .forEach(x => console.log(x));
// Prints 10, 20, 30, 40, 50
```

#### `first()`

Returns the first element of the result, or `null` if there are no other
elements. Short-circuits computation, so no more work is done than necessary to
get the first element.

Example:
```ts
chainFrom([1, 2, 3, 4, 5])
    .map(x => x * 10)
    .first(); // -> 10
```

#### `find(pred)`

Returns the first element of the result which satisfies the predicate `pred`, or
`null` if no such element exists. Note that this is equivalent to
`.filter(pred).first()`.

Example:
```ts
chainFrom([1, 2, 3, 4, 5])
    .map(x => x * 10)
    .find(x => x % 6 === 0); // -> 30
```

#### `count()`

Returns the number of elements. For example:
```ts
chainFrom([1, 2, 3, 4, 5])
    .filter(x => x % 2 === 1)
    .count(); // -> 3
```

#### `stringJoin(separator)`

Returns a string obtained by concatenating the elements together as strings with
the separator between them. For example:
```ts
chainFrom([1, 2, 3, 4, 5])
    .filter(n => n % 2 === 1)
    .stringJoin(" -> "); // -> "1 -> 3 -> 5"
```
Not called `toString()` in order to avoid clashing with the `Object` prototype
method.

#### `toIterator()`

Returns an iterator. Elements of the input iterator are not read until this
iterator is read, and then only as many as needed to compute number of results
requested. This is the primary way of reading results lazily.

Example:
```ts
const iterator = chainFrom([1, 2, 3, 4, 5])
    .map(x => x * 10)
    .toIterator();
console.log(iterator.next().value()); // Prints 10
// So far, the map function has only been called once.
```

#### `reduce(reducer, intialValue?)`

Reduces the elements according to the reducer, and returns the result. `reducer`
may be either a plain function of the form `(acc, x) => acc` or a transformer as
defined by the [transformer
protocol](https://github.com/cognitect-labs/transducers-js#transformer-protocol).
This is the most general way to terminate a chain, and all the others (except
for `toIterator`) are implemented using it.

Example of using a plain function reducer:
```ts
chainFrom([1, 2, 3, 4, 5])
    .map(x => x * 10)
    .reduce((acc, x) => acc + x, 0); // -> 150
```
A handful of pre-made transformers are provided by this library to be used with
`reduce()`. They are described in the next section.

### Reducers

These APIs provide objects which may be passed to `reduce()`, as described in
the previous section, to provide additional options for completing chains whose
elements are of specific types- for example, `toSum()` can only be used on a
chain of numbers.

They are kept as separate transformer objects, rather than added as additional
termination methods, to maintain type safety, since methods on the chain can be
regardless of the current type of its elements. By contrast, passing one of
these reducers to `reduce()` on a chain of the incorrect type will be caught by
TypeScript.

Some discussion of this is in the [Goals](#goals) section above.

#### `toSum()`

For a chain of numbers, return their sum. For example:
```ts
chainFrom(["a", "bb", "ccc"])
    .map(s => s.length)
    .reduce(toSum()); // -> 6
```

#### `toAverage()`

For a chain of numbers, return their average, or `NaN` if there are no elements.
For example:
```ts
chainFrom(["a", "bb", "ccc"])
    .map(s => s.length)
    .reduce(toAverage()); // -> 2
```

### `toMin(comparator?)`

Returns the minimum element, according to the comparator. If no comparator is
provided, then this reducer may only be applied if the elements are strings or
numbers and uses the natural comparator. Returns `null` if there are no
elements.

Example:
```ts
chainFrom(["a", "bb", "ccc"])
    .map(s => s.length)
    .reduce(toMin()); // -> 1
```

### `toMax(comparator?)`

Returns the maximum element, according to the comparator. If no comparator is
provided, then this reducer may only be applied if the elements are strings or
numbers and uses the natural comparator. Returns `null` if there are no
elements.

Example:
```ts
chainFrom(["a", "bb", "ccc"])
    .map(s => s.length)
    .reduce(toMax()); // -> 3
```

### `toObject()`

For a chain of two element arrays, creates an object whose keys are the first
element of each array and whose values are the second. The first element of each
pair must be a string. Further, a type parameter must be provided to specify the
type of the values. For example:
```ts
chainFrom(["a", "bb", "ccc"])
    .map(s => [s, s.length])
    .reduce(toObject<number>()); // -> { a: 1, bb: 2, ccc: 3 }
```

Copyright © 2017 David Philipson
