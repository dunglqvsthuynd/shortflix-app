import en from "./en";
import vi from "./vi";

function keys(obj: any, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === "object" && v !== null ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]
  );
}

test("en and vi have identical key sets", () => {
  expect(keys(vi).sort()).toEqual(keys(en).sort());
});
