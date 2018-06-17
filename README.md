# Transducist

Ergonomic JavaScript/TypeScript transducers for beginners and experts.

[![Build
Status](https://travis-ci.org/dphilipson/transducist.svg?branch=master)](https://travis-ci.org/dphilipson/transducist)

## Table of Contents

<!-- toc -->

- [Introduction](#introduction)
- [Goals](#goals)
- [Installation](#installation)
- [Basic Usage](#basic-usage)
- [Advanced Usage](#advanced-usage)
  * [Using custom transducers](#using-custom-transducers)
  * [Using custom reductions](#using-custom-reductions)
  * [Creating a standalone transducer](#creating-a-standalone-transducer)
- [API](#api)

<!-- tocstop -->

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
    .toArray();
```
This computation is very efficient because no intermediate arrays are created
and work stops early once 100 people are found.

You might be thinking that this looks very similar to [chains in
Lodash](https://lodash.com/docs/4.17.4#chain) or various other libraries that
offer a similar API. But this library is different because it's implemented with
transducers and exposes all the benefits of using transducers, such as being
able to easily add new transformation types to the middle of a chain and
producing logic applicable to any data structure, not just arrays.

Never heard of a transducer? Check the links in the
[transducers-js](https://github.com/cognitect-labs/transducers-js#transducers-js)
readme for an introduction to the concept, but note that **you don't need to
understand anything about transducers to use this library**.

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
  short-circuiting. Further, the library can also be used to construct
  standalone transducers which may be used elsewhere by other libraries that
  incorporate transducers into their API.

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

* **…typesafe** when used in a TypeScript project. Avoid the type fuzziness that
  is present in other transform chaining APIs. For example, under Lodash's type
  definitions, the following typechecks:
  ```ts
  const badSum = _([{a: true}, {b: false}]).sum();
  // Returns "[object Object][object Object]", if you're curious.
  ```
  and given Lodash's API, there is no way to correctly type this. By contrast,
  this library has the typesafe
  ```ts
  const goodSum = chainFrom([1, 2, 3]).reduce(toSum()); // -> 6
  ```

* **…fast**! Transducist is a thin wrapper on top of
  [transducers-js](https://github.com/cognitect-labs/transducers-js) and is
  therefore very efficient. See this [blog
  post](http://jlongster.com/Transducers.js-Round-2-with-Benchmarks) by the
  author of [transducers.js](https://github.com/jlongster/transducers.js) for
  some benchmarks. That post is also a great description of some other
  advantages of transducers.

## Installation

With Yarn:
```
yarn add transducist
```
With NPM:
```
npm install --save transducist
```
This library works fine on ES5 without any polyfills or transpilation, but its
TypeScript definitions depend on ES6 definitions for the `Iterable` type. If you
use TypeScript in your project, you must make definitions for `Iterable` and
`Iterator` available by doing one of the following:

* In `tsconfig.json`, set `"target"` to `"es6"` or higher.
* In `tsconfig.json`, set `"libs"` to include `"es2015.iterable"` or something
  that includes it.
* Add the definitions by some other means, such as importing types for
  `es6-shim`.

## Basic Usage

Import with
```ts
import { chainFrom } from "transducist";
```
Start a chain by calling `chainFrom()` on any iterable, including an array or a
string.
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
Other terminating methods include `.forEach()`, `.count()`, and `.find()`, among
others.

All transforms and terminations which take a function as an argument, such as
`.map()`, `.filter()`, and `.forEach()`, provide that function with the index of
each element as the second argument, as is typical in JavaScript APIs. For
example:
```ts
const result = chainFrom(["a", "bb", "ccc"])
    .map((s, i) => s + i)
    .toArray(); // -> ["a0", "bb1", "ccc2"]
```

For a list of all possible transformations and terminations, see the [full API
docs](https://github.com/dphilipson/transducist/blob/master/docs/api.md#api).

## Advanced Usage

These advanced usage patterns make use of transducers. If you aren't familiar
with transducers yet, see the links in the
[transducers-js](https://github.com/cognitect-labs/transducers-js#transducers-js)
readme for an introduction.

### Using custom transducers

Arbitrary transducers that satisfy the [transducer
protocol](https://github.com/cognitect-labs/transducers-js#the-transducer-protocol)
can be added to the chain using the `.compose()` method. This includes
transducers defined by other libraries, so we could for instance do
```ts
import { chainFrom } from "transducist";
import { cat } from "transducers.js";

const result = chainFrom([[1, 2], [3, 4, 5], [6]])
    .drop(1)
    .compose(cat)
    .map(x => 10 * x)
    .toArray(); // -> [30, 40, 50, 60];
```
As an example of implementing a custom transducer, suppose we want to implement
a "replace" operation, in which we provide two values and all instances of the
first value are replaced by the second one. We can do so as follows:
```ts
// Imports not needed if not using TypeScript.
import {
    CompletingTransformer,
    Transducer,
    Transformer,
 } from "transducist";

function replace<T>(initial: T, replacement: T): Transducer<T, T> {
    return (xf: CompletingTransformer<T, any, T>) => ({
        ["@@transducer/init"]: () => xf["@@transducer/init"](),
        ["@@transducer/result"]: (result: T) => xf["@@transducer/result"](result),
        ["@@transducer/step"]: (result: T, input: T) => {
            const output = input === initial ? replacement : input;
            return xf["@@transducer/step"](result, output);
        },
    });
}
```
We could then use it as
```ts
const result = chainFrom([1, 2, 3, 4, 5])
    .compose(replace(3, 1000))
    .toArray(); // -> [1, 2, 1000, 4, 5]
```
All of this library's transformation methods are implemented internally with
calls to `.compose()`.

### Using custom reductions

Similarly, arbitrary terminating operations can be introduced using the
`.reduce()` method, which can accept not only a plain reducer function (that is,
a function of the form `(acc, x) => acc`) but also any object satisfying the
[transformer
protocol](https://github.com/cognitect-labs/transducers-js#transformer-protocol).
All of this library's termination methods are implemented internally with a call
to `.reduce()` (with the single exception of `.toIterator()`).

### Creating a standalone transducer

It is also possible to use a chaining API to define a transducer without using
it in a computation, so it can be passed around and consumed by other APIs which
understand the transducer protocol, such as
[transduce-stream](https://github.com/transduce/transduce-stream). This is done
by starting the chain by calling `transducerBuilder()` and calling `.build()`
when done, for example:
```ts
import { chainFrom, transducerBuilder } from "transducist";

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

## API

View the [full API
docs](https://github.com/dphilipson/transducist/blob/master/docs/api.md#api).

Copyright © 2017 David Philipson
