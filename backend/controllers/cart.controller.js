import User from "../models/user.model.js";
import Product from "../models/product.model.js";

export const getCartProducts = async (req, res) => {
  try {
    const products = await Product.find({ _id: { $in: req.user.cartItems } });
    if (!products) {
      return res.status(404).json({ message: "No products found" });
    }

    // add quantity to each product in the cart since product model doesnt have quantity column
    const cartItems = products.map((product) => {
      const item = req.user.cartItems.find(
        (cartItem) => cartItem.id === product.id
      );
      return {
        ...product.toJSON(),
        quantity: item.quantity,
      };
    });
    res.status(200).json(cartItems);
  } catch (error) {
    console.log("Error in getCartProducts:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const addToCart = async (req, res) => {
  try {
    const { productId } = req.body;
    const user = req.user;

    const existingItem = user.cartItems.find((item) => item.id === productId);

    if (existingItem) {
      // If the item already exists in the cart, update its quantity
      existingItem.quantity += 1;
    } else {
      // If the item does not exist, add it to the cart
      user.cartItems.push({ id: productId, quantity: 1 });
    }

    await user.save();
    res.status(200).json(user.cartItems);
  } catch (error) {
    console.log("Error in addToCart:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
export const removeAllFromCart = async (req, res) => {
  try {
    const { productId } = req.body;
    const user = req.user;

    if (!productId) {
      // If no productId is provided, remove all items from the cart
      user.cartItems = [];
    } else {
      // If a productId is provided, remove that specific item from the cart
      user.cartItems = user.cartItems.filter((item) => item.id !== productId);
    }
    await user.save();
    res.status(200).json(user.cartItems);
  } catch (error) {
    console.log("Error in removeAllFromCart:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
export const updateQuantity = async (req, res) => {
  try {
    const { id: productId } = req.params;
    const { quantity } = req.body;
    const user = req.user;

    const existingItem = await User.cartItems.find(
      (item) => item.id === productId
    );

    if (existingItem) {
      if (quantity === 0) {
        // If quantity is 0, remove the item from the cart
        user.cartItems = user.cartItems.filter((item) => item.id !== productId);

        await user.save();
        res.status(200).json(user.cartItems);
      }

      existingItem.quantity = quantity;
      await user.save();
      res.status(200).json(user.cartItems);
    } else {
      res.status(404).json({ message: "Product not found" });
    }
  } catch (error) {
    console.log("Error in updateQuantity:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
