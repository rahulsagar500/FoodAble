// src/lib/format.js
export const formatPrice = (cents) => `$${(cents / 100).toFixed(2)}`;
