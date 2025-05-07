import { redis } from "../lib/redis.js";
import Product from "../models/product.model.js";
import cloudinary from "../lib/cloudinary.js";
export const getAllProducts = async (req, res) => {
  try {
    const products = await Product.find();

    if (!products) {
      return res.status(404).json({ message: "No products found" });
    }
    res.status(200).json(products);
  } catch (error) {
    console.error("Error in getAllProducts: ", error);
    res.status(500).json({ message: error.message });
  }
};

export const getFeaturedProducts = async (req, res) => {
  try {
    //check if we have anything in redis
    let featuredProducts = await redis.get("featured_products");

    //redis here acts like a cache
    if (featuredProducts) {
      return res.status(200).json(JSON.parse(featuredProducts));
    }

    // if not in redis, we fetch from mongoDB
    // .lean() is used to convert the mongoose object to a plain javascript object
    // which is good for performance
    featuredProducts = await Product.find({ isFeatured: true }).lean();
    if (!featuredProducts) {
      return res.status(404).json({ message: "No featured products found" });
    }

    // store in redis for future qick access
    await redis.set("featured_products", JSON.stringify(featuredProducts));

    res.status(200).json(featuredProducts);
  } catch (error) {
    console.error("Error in getFeaturedProducts: ", error);
    res.status(500).json({ message: error.message });
  }
};

export const createProduct = async (req, res) => {
  const { name, description, price, image, category } = req.body;
  try {
    let cloudinaryResponse = null;

    if (image) {
      // upload image to cloudinary
      cloudinaryResponse = await cloudinary.uploader.upload(image, {
        folder: "products",
      });
    }
    const product = await Product.create({
      name,
      description,
      price,
      image: cloudinaryResponse?.secure_url || "",
      category,
    });

    res.status(201).json(product);
  } catch (error) {
    console.error("Error in createProduct: ", error);
    res.status(500).json({ message: error.message });
  }
};

export const deleteProduct = async (req, res) => {
  const { id } = req.params;
  try {
    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    if (product.image) {
      const publicId = product.image.split("/").pop().split(".")[0]; //to get the id of the image so we can delete it
      await cloudinary.uploader.destroy(publicId, {
        folder: "products",
      });
    }

    await Product.findByIdAndDelete(id);

    res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("Error in deleteProduct: ", error);
    res.status(500).json({ message: error.message });
  }
};

export const getRecommendedProducts = async (req, res) => {
  try {
    const recommendedProducts = await Product.aggregate([
      { $sample: { size: 3 } }, // Randomly select 3 products
      {
        $project: {
          _id: 1,
          name: 1,
          description: 1,
          image: 1,
          price: 1,
        },
      },
    ]);

    if (!recommendedProducts) {
      return res.status(404).json({ message: "No recommended products found" });
    }
    res.status(200).json(recommendedProducts);
  } catch (error) {
    console.error("Error in getRecommendedProducts: ", error);
    res.status(500).json({ message: error.message });
  }
};

export const getProductsByCategory = async (req, res) => {
  const { category } = req.params;
  try {
    const products = await Product.find({ category }).lean();
    if (!products) {
      return res
        .status(404)
        .json({ message: "No products found in this category" });
    }
    res.status(200).json(products);
  } catch (error) {
    console.error("Error in getProductsByCategory: ", error);
    res.status(500).json({ message: error.message });
  }
};

export const toggleFeaturedProduct = async (req, res) => {
  const { id } = req.params;
  try {
    const product = await Product.findById(id);

    if (product) {
      product.isFeatured = !product.isFeatured; // Toggle the isFeatured property
      const updatedProduct = await product.save(); // Save the updated product

      // update the redis cache
      await updateFeaturedProductsCache();
      res.status(200).json(updatedProduct);
    } else {
      return res.status(404).json({ message: "Product not found" });
    }
  } catch (error) {
    console.error("Error in toggleFeaturedProduct: ", error);
    res.status(500).json({ message: error.message });
  }
};
async function updateFeaturedProductsCache() {
  try {
    const featuredProducts = await Product.find({ isFeatured: true }).lean();
    await redis.set("featured_products", JSON.stringify(featuredProducts));
  } catch (error) {
    console.error("Error updating featured products cache: ", error);
  }
}
