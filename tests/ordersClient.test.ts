import { parseOrdersResponse } from "@/services/ordersClient";

describe("parseOrdersResponse", () => {
  it("parses orders array payload", () => {
    const payload = {
      orders: [
        {
          id: "ord_1",
          customer_name: "John Doe",
          product_name: "Day Pass",
          num_products: 2,
          amount: 129.5,
          currency: "EUR",
          status: "completed"
        }
      ]
    };

    const result = parseOrdersResponse(payload);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "ord_1",
      guestName: "John Doe",
      product: "Day Pass",
      productCount: 2,
      quantity: 2,
      totalPrice: 129.5,
      currency: "EUR",
      status: "completed"
    });
  });

  it("parses deeply nested rows payload", () => {
    const payload = {
      data: {
        result: {
          rows: [
            {
              orderId: "ord_2",
              customer: { firstName: "Jane", lastName: "Smith" },
              num_products: 3,
              product: { name: "Lift Ticket" },
              amount: 300,
              currency: "CHF",
              orderStatus: "completed",
              completedAtDay: "2026-02-19"
            }
          ]
        }
      }
    };

    const result = parseOrdersResponse(payload);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "ord_2",
      guestName: "Jane Smith",
      product: "Lift Ticket",
      productCount: 3,
      quantity: 3,
      totalPrice: 300,
      currency: "CHF",
      status: "completed",
      date: "2026-02-19"
    });
  });
});
