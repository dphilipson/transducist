# Transducist

Ergonomic JavaScript/TypeScript transducers for beginners and experts.

[![Build
Status](https://travis-ci.org/dphilipson/transducist.svg?branch=master)](https://travis-ci.org/dphilipson/transducist)

## Table of Contents

<!-- toc -->

-   [Introduction](#introduction)
-   [Goals](#goals)
-   [Installation](#installation)
-   [Basic Usage](#basic-usage)
-   [Advanced Usage](#advanced-usage)
    -   [Using custom transducers](#using-custom-transducers)
    -   [Using custom reductions](#using-custom-reductions)
    -   [Creating a standalone transducer](#creating-a-standalone-transducer)
-   [Bundle Size and Tree Shaking](#bundle-size-and-tree-shaking)
-   [Benchmarks](#benchmarks)
-   [API](#api)

<!-- tocstop -->

## Introduction

This library will let you write code that looks like this:

```ts
// Let's find 100 people who have a parent named Brad who runs Haskell projects
// so we can ask them about their dads Brads' monads.
const result = chainFrom(haskellProjects)
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
transducers and exposes all benefits of the transducer protocol, such as being
able to easily add novel transformation types to the middle of a chain and
producing logic applicable to any data structure, not just arrays.

Never heard of a transducer? Check the links in the
[transducers-js](https://github.com/cognitect-labs/transducers-js#transducers-js)
readme for an introduction to the concept, but note that **you don't need to
understand anything about transducers to use this library**.

## Goals

Provide an API for using transducers that is…

-   **…easy** to use even **without transducer knowledge or experience**. If you
    haven't yet wrapped your head around transducers or need to share a codebase
    with others who haven't, the basic chaining API is fully usable without ever
    seeing a reference to transducers or anything more advanced than `map` and
    `filter`. However, it is also…

-   …able to reap the **full benefits of transducers** for those who are
    familiar with them. By using the general purpose `.compose()` to place
    custom transducers in the middle of a chain, any kind of novel transform can
    be added while still maintaining the efficiency bonuses of laziness and
    short-circuiting. Further, the library can also be used to construct
    standalone transducers which may be used elsewhere by other libraries that
    incorporate transducers into their API.

-   **…fast**! Transducist performs efficient computations by never creating
    more objects than necessary. [See the
    benchmarks](https://github.com/dphilipson/transducist/blob/master/docs/benchmarks.md#benchmarks)
    for details.

-   **…typesafe**. Transducist is written in TypeScript and is designed to be
    fully typesafe without requiring you to manually specify type parameters
    everywhere.

-   **…small**. Transducist is less than 4kB gzipped, and can be made even
    smaller through [tree shaking](#bundle-size-and-tree-shaking).

## Installation

With Yarn:

```
yarn add transducist
```

With NPM:

```
npm install transducist
```

This library, with the exception of the functions which relate to `Set` and
`Map`, works fine on ES5 without any polyfills or transpilation, but its
TypeScript definitions depend on ES6 definitions for the `Iterable` type. If you
use TypeScript in your project, you must make definitions for these types
available by doing one of the following:

-   In `tsconfig.json`, set `"target"` to `"es6"` or higher.
-   In `tsconfig.json`, set `"libs"` to include `"es2015.iterable"` or something
    that includes it
-   Add the definitions by some other means, such as importing types for
    `es6-shim`.

Furthermore, the methods `toSet`, `toMap`, and `toMapGroupBy` assume the
presence of ES6 `Set` and `Map` classes in your environment. If you wish to use
these methods, you must ensure your environment has these classes or provide a
polyfill.

## Basic Usage

Import with

```ts
import { chainFrom } from "transducist";
```

Start a chain by calling `chainFrom()` on any iterable, such as an array, a
string, or an ES6 `Set`.

```ts
const result = chainFrom(["a", "bb", "ccc", "dddd", "eeeee"]);
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

Other terminating methods include `.forEach()`, `.find()`, and `.toSet()`, among
many others. For a particularly interesting one, see
[`.toMapGroupBy()`](https://github.com/dphilipson/transducist/blob/master/docs/api.md#tomapgroupbygetkey-transformer).

For a list of all possible transformations and terminations, [see the full API
docs](https://github.com/dphilipson/transducist/blob/master/docs/api.md#api).

## Advanced Usage

These advanced usage patterns make use of transducers. If you aren't familiar
with transducers yet, see the links in the
[transducers-js](https://github.com/cognitect-labs/transducers-js#transducers-js)
readme for an introduction.

### Using custom transducers

Arbitrary objects that satisfy the [transducer
protocol](https://github.com/cognitect-labs/transducers-js#the-transducer-protocol)
can be added to the chain using the `.compose()` method, allowing you to write
new types of transforms that can be included in the middle of the chain without
losing the benefits of early termination and no intermediate array creation.
This includes transducers defined by other libraries, so we could for instance
reuse a transducer from
[`transducers.js`](https://github.com/jlongster/transducers.js/) as follows:

```ts
import { chainFrom } from "transducist";
import { cat } from "transducers.js";

const result = chainFrom([[1, 2], [3, 4, 5], [6]])
    .drop(1)
    .compose(cat)
    .map(x => 10 * x)
    .toArray(); // -> [30, 40, 50, 60];
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

## Bundle Size and Tree Shaking

If you are using a bundler which supports tree shaking (e.g. Webpack 4+, Rollup)
and are looking to decrease bundle size, Transducist also provides an alternate
API to allow you to only pay for the functions you actually use, which
incidentally is similar to the API provided by more typical transducer
libraries. All chain methods are also available as standalone functions and can
be used as follows:

```ts
import { compose, filter, map, toArray, transduce } from "transducist";

transduce(
    [1, 2, 3, 4, 5],
    compose(
        filter(x => x > 2),
        map(x => 2 * x),
    ),
    toArray(),
); // -> [6, 8, 10]
```

which is equivalent to the fluent version:

```ts
import { chainFrom } from "transducist";

chainFrom([1, 2, 3, 4, 5])
    .filter(x => x > 2)
    .map(x => 2 * x)
    .toArray(); // -> [6, 8, 10]
```

However, the standalone function version of this example adds a mere 1.64 kB to
bundle size (pre-gzip), compared to the chained version which adds 11.1 kB (as
of version 1.0.0). Note that after gzipping, the fluent version is below 4kB as
well.

For details, [see the tree shaking
API](https://github.com/dphilipson/transducist/blob/master/docs/api.md#tree-shakeable-api)
section of the API docs.

## Benchmarks

[View the
benchmarks.](https://github.com/dphilipson/transducist/blob/master/docs/benchmarks.md#benchmarks)

## API

[View the full API
docs.](https://github.com/dphilipson/transducist/blob/master/docs/api.md#api)

Copyright © 2017 David Philipson
