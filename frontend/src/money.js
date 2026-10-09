// A rupee amount for display, e.g. "₹1,299.00".
export const formatInr = (amount) => Number(amount || 0).toLocaleString("en-IN", { style: "currency", currency: "INR" });
