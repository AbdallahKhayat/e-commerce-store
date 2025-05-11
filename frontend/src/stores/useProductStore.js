import { create } from "zustand";
import toast from "react-hot-toast";
import axios from "../lib/axios";

export const useProductStore = create((set) => ({
  product: [],
  loading: false,

  setProducts: (products) => set({ product: products }),

  createProduct: async (productData) => {
    set({ loading: true });

    try {
      const res = await axios.post("/products", productData);

      set((prevState) => ({
        product: [...prevState.product, res.data],
        loading: false,
      }));
      toast.success("Product created successfully");
    } catch {
      set({ loading: false });
      toast.error("Error creating product");
    }
  },
}));
