import { describe, expect, it } from "vitest";
import { buildZohoLineItems, buildZohoRecurringLineItems } from "./order-payload";

describe("buildZohoLineItems", () => {
  it("includes the main product line item with the given quantity", () => {
    const items = buildZohoLineItems({ zohoItemId: "MAIN1", zohoRecurringItemId: null }, 2, []);
    expect(items).toEqual([{ item_id: "MAIN1", quantity: "2", discount: "0.00", tax_id: "" }]);
  });

  it("omits the main line item when the checkout page has no zohoItemId", () => {
    const items = buildZohoLineItems({ zohoItemId: null, zohoRecurringItemId: null }, 1, []);
    expect(items).toEqual([]);
  });

  it("adds one line item per addon that has a zohoItemId, always quantity 1", () => {
    const items = buildZohoLineItems({ zohoItemId: "MAIN1", zohoRecurringItemId: null }, 1, [
      { zohoItemId: "ADDON1" },
      { zohoItemId: "ADDON2" },
    ]);
    expect(items).toEqual([
      { item_id: "MAIN1", quantity: "1", discount: "0.00", tax_id: "" },
      { item_id: "ADDON1", quantity: "1", discount: "0.00", tax_id: "" },
      { item_id: "ADDON2", quantity: "1", discount: "0.00", tax_id: "" },
    ]);
  });

  it("skips addons without a zohoItemId", () => {
    const items = buildZohoLineItems({ zohoItemId: null, zohoRecurringItemId: null }, 1, [{ zohoItemId: null }]);
    expect(items).toEqual([]);
  });
});

describe("buildZohoRecurringLineItems", () => {
  it("returns one recurring line item scaled by quantity", () => {
    const items = buildZohoRecurringLineItems({ zohoItemId: null, zohoRecurringItemId: "REC1" }, 4900, 2);
    expect(items).toEqual([{ item_id: "REC1", rate: "49.00", quantity: "2", discount: "0.00", tax_id: "" }]);
  });

  it("returns an empty array when there is no zohoRecurringItemId", () => {
    expect(buildZohoRecurringLineItems({ zohoItemId: null, zohoRecurringItemId: null }, 4900, 1)).toEqual([]);
  });

  it("returns an empty array when the recurring total is zero", () => {
    expect(buildZohoRecurringLineItems({ zohoItemId: null, zohoRecurringItemId: "REC1" }, 0, 1)).toEqual([]);
  });

  it("returns an empty array when the recurring total is negative", () => {
    expect(buildZohoRecurringLineItems({ zohoItemId: null, zohoRecurringItemId: "REC1" }, -100, 1)).toEqual([]);
  });
});
