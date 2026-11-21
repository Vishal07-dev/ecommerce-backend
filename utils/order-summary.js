/**
 * One place that turns a stored order into the numbers people see, so the
 * receipt, the account page, Studio and the success page always agree.
 *
 * Stored item `price` is the LINE total as charged by Stripe (unit × qty).
 * Orders saved since the receipt fix also store `unitPrice`, `subtotal` and
 * `deliveryFee`; older orders get them derived from what they stored:
 *   unit price  = line total ÷ quantity
 *   subtotal    = sum of line totals
 *   delivery    = order total − subtotal (never negative)
 */
const round2 = n => Math.round((Number(n) || 0) * 100) / 100;

/** Short, human order reference used everywhere: # + last 8 characters. */
export function orderRef(id) {
  return String(id ?? '').slice(-8).toUpperCase();
}

export function summarizeOrder(order) {
  const o = typeof order?.toObject === 'function' ? order.toObject() : order;
  const lines = (o.items ?? []).map(i => {
    const quantity = Math.max(1, Math.floor(Number(i.quantity) || 1));
    const amount = round2(i.price);
    const unitPrice = i.unitPrice != null ? round2(i.unitPrice) : round2(amount / quantity);
    // Stripe line names look like "The Long Coat (M)": split the size back out.
    const fromName = /\s*\(([^()]+)\)\s*$/.exec(i.name ?? '');
    const size = i.size || fromName?.[1] || null;
    const name = (i.name ?? 'Item').replace(/\s*\([^()]+\)\s*$/, '') || 'Item';
    return { name, size, quantity, unitPrice, amount, image: i.image ?? null, productId: i.productId ?? null };
  });
  const itemsTotal = round2(lines.reduce((n, l) => n + l.amount, 0));
  const total = round2(o.totalAmount);
  const subtotal = o.subtotal != null ? round2(o.subtotal) : itemsTotal;
  const deliveryFee = o.deliveryFee != null ? round2(o.deliveryFee) : Math.max(0, round2(total - itemsTotal));
  return {
    _id: String(o._id),
    ref: orderRef(o._id),
    createdAt: o.createdAt,
    email: o.email,
    status: o.status ?? 'paid',
    lines,
    itemCount: lines.reduce((n, l) => n + l.quantity, 0),
    subtotal,
    deliveryFee,
    total,
  };
}
