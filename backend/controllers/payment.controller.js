import { stripe } from "../lib/stripe.js";
import Coupon from "../models/coupon.model.js";

import dotenv from "dotenv";
import Order from "../models/order.model.js";

dotenv.config();

export const createCheckoutSession = async (req, res) => {
  const { products, couponCode } = req.body;

  try {
    // check if products is in the format of an array
    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: "Invalid or empty products array" });
    }

    let totalAmount = 0;

    const lineItems = products.map((product) => {
      const amount = Math.round(product.price * 100); // Convert to cents
      totalAmount += amount * product.quantity; // Calculate total amount for the product

      // return for stripe
      return {
        price_data: {
          currency: "usd",
          product_data: {
            name: product.name,
            images: [product.image],
          },
          unit_amount: amount,
        },
        quantity: product.quantity,
      };
    });

    let coupon = null;

    if (couponCode) {
      coupon = await Coupon.findOne({
        code: couponCode,
        userId: req.user._id,
        isActive: true,
      });

      if (coupon) {
        totalAmount -= Math.round(
          totalAmount * (coupon.discountPercentage / 100)
        ); // Apply discount
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: lineItems,
        mode: "payment",
        success_url: `${process.env.CLIENT_URL}/purchase_success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.CLIENT_URL}/purchase-cancel`,
        discounts: coupon
          ? [
              {
                coupon: await createStripeCoupon(coupon.discountPercentage),
              },
            ]
          : [],
        metadata: {
          userId: req.user._id.toString(),
          couponCode: couponCode || "",
          products: JSON.stringify(
            products.map((p) => ({
              id: p._id,
              quantity: p.quantity,
              price: p.price,
            }))
          ),
        },
      });

      // create a new coupon if the user is buying 200$ or more
      if (totalAmount >= 20000) {
        await createNewCoupon(req.user._id);
      }

      res.status(200).json({
        id: session.id,
        totalAmount: totalAmount / 100, // Convert back to dollars
      });
    }
  } catch (error) {
    console.error("Error creating checkout session:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const checkoutSuccess = async (req, res) => {
  try {
    const { sessionId } = req.body;
    //get sessionId from stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    //check if payment is successful done

    if (session.payment_status === "paid") {
      //check for the coupon if its used then deactive it
      if (session.metadata.couponCode) {
        await Coupon.findOneAndUpdate(
          {
            code: session.metadata.couponCode,
            userId: session.metadata.userId,
          },
          { isActive: false }
        );
      }

      // create a new order in the database
      const products = JSON.parse(session.metadata.products);

      const newOrder = new Order({
        user: session.metadata.userId,
        products: products.map((p) => ({
          product: p.id,
          quantity: p.quantity,
          price: p.price,
        })),
        totalAmount: session.amount_total / 100, // Convert back to dollars
        stripeSessionId: sessionId,
      });
      await newOrder.save();

      res.status(200).json({
        success: true,
        message:
          "Payment successful, order created, and coupon deactivated if used.",
        orderId: newOrder._id,
      });
    }
  } catch (error) {
    console.error("Error in checkout success:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

async function createStripeCoupon(discountPercentage) {
  try {
    const coupon = await stripe.coupons.create({
      percent_off: discountPercentage,
      duration: "once",
    });
    return coupon.id;
  } catch (error) {
    console.error("Error creating Stripe coupon:", error);
    throw new Error("Failed to create Stripe coupon");
  }
}

async function createNewCoupon(userId) {
  const newCoupon = new Coupon({
    code: "GIFT" + Math.random().toString(36).substring(2, 8).toUpperCase(),
    discountPercentage: 10,
    expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    userId: userId,
  });

  await newCoupon.save();
  return newCoupon;
}
