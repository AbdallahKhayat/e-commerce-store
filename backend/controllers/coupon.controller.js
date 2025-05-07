import Coupon from "../models/coupon.model.js";

export const getCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findOne({
      userId: req.user._id,
      isActive: true,
    });

    res.status(200).json(coupon || null);
  } catch (error) {
    console.error("Error in getCoupon:", error.message);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

export const validateCoupon = async (req, res) => {
  const { couponCode } = req.body;
  try {
    const coupon = await Coupon.findOne({
      code: couponCode,
      userId: req.user._id,
      isActive: true,
    });

    if (!coupon) {
      return res.status(404).json({ message: "Coupon not found" });
    }
    if (coupon.expiryDate < new Date()) {
      coupon.isActive = false;
      await coupon.save();
      return res.status(400).json({ message: "Coupon has expired" });
    }

    res
      .status(200)
      .json({
        message: "Coupon is valid",
        code: coupon.code,
        discountPercentage: coupon.discountPercentage,
      });
  } catch (error) {
    console.error("Error in validateCoupon:", error.message);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};
