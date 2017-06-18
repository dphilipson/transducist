import * as t from "../src/index";

describe("Jest", () => {
    it("should run tests", () => {
        t.hello();
        expect(2).toEqual(2);
    });
});
