// By using these constants rather than string literals everywhere, we save
// multiple kilobytes of script size after minification, since each instance of
// these properties is represented by a single character variable rather than a
// roughly 20 character string constant.

export const INIT = "@@transducer/init";
export const RESULT = "@@transducer/result";
export const STEP = "@@transducer/step";

export const REDUCED = "@@transducer/reduced";
export const VALUE = "@@transducer/value";
