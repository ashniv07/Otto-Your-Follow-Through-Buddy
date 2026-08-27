// Realistic order confirmation / shipping emails for demo and fallback.
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

module.exports = [
  {
    threadId: "mock-gmail-thread-001",
    subject: "Your Amazon order #112-3456789-0123456 has shipped!",
    from: "ship-confirm@amazon.com",
    date: daysAgo(10),
    body: `Hello,
Your order has shipped and is on its way!

Order #112-3456789-0123456
Item: Sony WH-1000XM5 Wireless Noise Canceling Headphones
Quantity: 1

Tracking Number: 1Z999AA10123456784
Carrier: UPS
Estimated delivery: ${daysAgo(4)}

Thank you for shopping with Amazon.`,
  },
  {
    threadId: "mock-gmail-thread-002",
    subject: "Your Nike order N12345678 is confirmed",
    from: "orders@nike.com",
    date: daysAgo(15),
    body: `Hi there,

Thanks for your order!

Order Number: N12345678
Items: Nike Air Max 270 - Size 10 - Black/White
Total: $150.00

Estimated Delivery: ${daysAgo(5)}
Carrier: FedEx
Tracking: 789456123014

Questions? Contact Nike Support.`,
  },
  {
    threadId: "mock-gmail-thread-003",
    subject: "Order Confirmation - Best Buy #BBY-45678901",
    from: "BestBuyInfo@emailinfo.bestbuy.com",
    date: daysAgo(8),
    body: `Thank you for your purchase!

Order Number: BBY-45678901
Product: Samsung 65" 4K Smart TV - Model QN65Q80C
Price: $1,099.99

Scheduled Delivery: ${daysAgo(2)}
Delivery Method: In-Home Delivery
Tracking Number: 274899689820`,
  },
  {
    threadId: "mock-gmail-thread-004",
    subject: "Your Etsy order from HandmadeGiftsShop has shipped",
    from: "transaction@etsy.com",
    date: daysAgo(12),
    body: `Great news! Your order from HandmadeGiftsShop is on its way.

Order: #1234567890
Item: Personalized Leather Wallet - Initials "JD"
Price: $45.00

Expected delivery: ${daysAgo(3)}
Shipped via: USPS First Class
Tracking: 9400111899223397283940`,
  },
  {
    threadId: "mock-gmail-thread-005",
    subject: "Walmart Order Confirmation #8374623847",
    from: "help@walmart.com",
    date: daysAgo(6),
    body: `Your Walmart order is confirmed.

Order #: 8374623847
Items: Instant Pot Duo 7-in-1 Electric Pressure Cooker, 6 Qt - $79.95

Estimated delivery: ${daysAgo(1)}
Tracking: 9261290100830368223827`,
  },
];
