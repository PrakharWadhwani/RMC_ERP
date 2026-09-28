import { create } from 'zustand';

export interface CartItem {
  id: number;
  name: string;
  price: number;
  qty: number;
  cost_price: number; // Snapshot of cost at time of adding to cart
  min_selling_price: number;
}

interface CartStore {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: number) => void;
  // THE KEY FUNCTION: Update price or quantity on the fly
  updateItem: (id: number, updates: Partial<CartItem>) => void;
  clearCart: () => void;
}

export const useCartStore = create<CartStore>((set) => ({
  items: [],
  addItem: (newItem) => set((state) => {
    const existing = state.items.find(i => i.id === newItem.id);
    if (existing) return state; // Don't add duplicates, just edit them in the table
    return { items: [...state.items, newItem] };
  }),
  removeItem: (id) => set((state) => ({
    items: state.items.filter(i => i.id !== id)
  })),
  // Update price or quantity on the fly
  updateItem: (id, updates) => set((state) => ({
    items: state.items.map((item) => 
      item.id === id ? { ...item, ...updates } : item
    )
  })),
  clearCart: () => set({ items: [] }),
}));