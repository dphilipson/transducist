#!/bin/sh

# This replaces "/** @class */" with "/**@__PURE__*/" in all .js files in the
# dist directory. This is useful because when TypeScript compiles classes to
# ES5, it marks them with /** @class */, but UglifyJS looks for /**@__PURE__*/
# when performing dead code removal, such as during tree shaking.
#
# Intentionally removes an extra space to keep the same length, to maintain
# accuracy of sourcemaps.

find dist | grep '\.js$' | xargs perl -p -i -e 's~/\*\* \@class \*/ ~/\*\*\@__PURE__\*/~g'
