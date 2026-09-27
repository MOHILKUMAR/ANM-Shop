const sendEmail = require('./sendEmail');

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
}[character]));

const formatMoney = (value) => `₹${Number(value || 0).toFixed(2)}`;

const sendOrderInvoice = async (order, recipient) => {
    const rows = order.items.map((item) => {
        const name = item.productId?.name || 'ANM-Shop product';
        const quantity = Number(item.qty);
        const unitPrice = Number(item.price);
        return {
            name,
            quantity,
            unitPrice,
            lineTotal: unitPrice * quantity,
        };
    });
    const address = order.address || {};
    const orderNumber = String(order._id);
    const addressText = [address.fullName, address.street, address.city, address.postalCode, address.country, address.phone && `Phone: ${address.phone}`]
        .filter(Boolean)
        .join(', ');
    const itemLines = rows.map((item) => `${item.name} x ${item.quantity}: ${formatMoney(item.lineTotal)}`);
    // Orders placed before shipping and coupons existed only have a total.
    const breakdown = order.subtotalAmount !== undefined && order.subtotalAmount !== null ? [
        ['Subtotal', formatMoney(order.subtotalAmount)],
        ['Shipping', order.shippingFee ? formatMoney(order.shippingFee) : 'Free'],
        ...(order.discountAmount ? [[`Discount${order.couponCode ? ` (${order.couponCode})` : ''}`, `-${formatMoney(order.discountAmount)}`]] : []),
    ] : [];
    const text = [
        'ANM-SHOP - PAYMENT RECEIPT / E-BILL',
        `Order: ${orderNumber}`,
        `Date: ${new Date(order.createdAt || Date.now()).toLocaleString('en-IN')}`,
        `Payment ID: ${order.paymentId || 'N/A'}`,
        '',
        ...itemLines,
        '',
        ...breakdown.map(([label, value]) => `${label}: ${value}`),
        `Total paid: ${formatMoney(order.totalAmount)}`,
        `Ship to: ${addressText}`,
        '',
        'Thank you for shopping with ANM-Shop.',
    ].join('\n');
    const htmlRows = rows.map((item) => `<tr><td style="padding:12px;border-bottom:1px solid #e5e7eb">${escapeHtml(item.name)}</td><td style="padding:12px;border-bottom:1px solid #e5e7eb;text-align:center">${item.quantity}</td><td style="padding:12px;border-bottom:1px solid #e5e7eb;text-align:right">${formatMoney(item.unitPrice)}</td><td style="padding:12px;border-bottom:1px solid #e5e7eb;text-align:right">${formatMoney(item.lineTotal)}</td></tr>`).join('');
    const html = `<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#33252e"><header style="padding:24px;background:#754656;color:white"><h1 style="margin:0">ANM-Shop</h1><p style="margin:8px 0 0">Payment receipt / e-bill</p></header><main style="padding:24px"><p>Thank you for your order. Your payment was received successfully.</p><table style="width:100%;border-collapse:collapse"><tbody><tr><td style="padding:6px 0;color:#71646c">Order ID</td><td style="padding:6px 0;text-align:right">${escapeHtml(orderNumber)}</td></tr><tr><td style="padding:6px 0;color:#71646c">Date</td><td style="padding:6px 0;text-align:right">${escapeHtml(new Date(order.createdAt || Date.now()).toLocaleString('en-IN'))}</td></tr><tr><td style="padding:6px 0;color:#71646c">Payment ID</td><td style="padding:6px 0;text-align:right">${escapeHtml(order.paymentId || 'N/A')}</td></tr></tbody></table><table style="width:100%;margin-top:20px;border-collapse:collapse"><thead><tr style="background:#f6eeea"><th style="padding:12px;text-align:left">Item</th><th style="padding:12px">Qty</th><th style="padding:12px;text-align:right">Price</th><th style="padding:12px;text-align:right">Amount</th></tr></thead><tbody>${htmlRows}</tbody></table>${breakdown.map(([label, value]) => `<p style="margin:8px 0 0;text-align:right;color:#71646c">${escapeHtml(label)}: ${escapeHtml(value)}</p>`).join('')}<p style="margin-top:20px;text-align:right;font-size:20px;font-weight:bold">Total paid: ${formatMoney(order.totalAmount)}</p><h2 style="margin-top:28px;font-size:16px">Delivery address</h2><p>${escapeHtml(addressText)}</p><p style="margin-top:28px;color:#71646c;font-size:13px">This email is your ANM-Shop electronic bill. Please keep it for your records.</p></main></div>`;

    return sendEmail(recipient, `ANM-Shop e-bill for order ${orderNumber}`, text, html);
};

module.exports = sendOrderInvoice;
