export const ticketCategories = [
  ["order", "Order"],
  ["payment", "Payment"],
  ["refund", "Refund"],
  ["delivery", "Delivery"],
  ["return", "Return or exchange"],
  ["product", "Product question"],
  ["account", "Account"],
  ["other", "Something else"],
];

export const categoryLabel = (value) => ticketCategories.find(([key]) => key === value)?.[1] || value;

export const ticketStatuses = {
  open: ["Open", "bg-amber-50 text-amber-800"],
  in_progress: ["In progress", "bg-brand-50 text-brand-800"],
  resolved: ["Resolved", "bg-green-50 text-green-800"],
  closed: ["Closed", "bg-gray-100 text-gray-700"],
};

// Opens the floating support chat from anywhere (e.g. the Support page).
export const OPEN_CHAT_EVENT = "anm-shop:open-chat";
