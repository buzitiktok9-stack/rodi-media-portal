import { Product } from "../types";
import { ShoppingBag, CheckCircle, Clock } from "lucide-react";

interface ProductCardProps {
  key?: string | number;
  product: {
    id: string;
    name: string;
    price: number;
    description: string;
    category: string;
    image: string;
    inStock: boolean;
    stockCount: number;
  };
  onBuy: (product: Product) => void;
}

export default function ProductCard({ product, onBuy }: ProductCardProps) {
  // Map simple object to full product interface for the callback
  const fullProduct: Product = {
    id: product.id,
    name: product.name,
    price: product.price,
    description: product.description,
    category: product.category,
    image: product.image,
    stock: [] // Hidden from client
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md transition-shadow flex flex-col h-full group">
      {/* Product Image */}
      <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          referrerPolicy="no-referrer"
        />
        <div className="absolute top-3 left-3 bg-slate-900/85 backdrop-blur-xs text-white text-xs font-semibold px-2.5 py-1 rounded-full">
          {product.category}
        </div>

        {/* Stock Badge */}
        <div className="absolute top-3 right-3">
          {product.inStock ? (
            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs font-medium px-2.5 py-1 rounded-full border border-emerald-100">
              <CheckCircle className="w-3.5 h-3.5" />
              Livraison Instantanée
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-xs font-medium px-2.5 py-1 rounded-full border border-amber-100">
              <Clock className="w-3.5 h-3.5" />
              Sur Commande (Rupture)
            </span>
          )}
        </div>
      </div>

      {/* Product Info */}
      <div className="p-5 flex flex-col flex-1">
        <h3 className="text-lg font-semibold text-slate-800 line-clamp-1 mb-2">
          {product.name}
        </h3>
        <p className="text-slate-500 text-sm line-clamp-3 mb-4 flex-1">
          {product.description}
        </p>

        {/* Pricing and CTA */}
        <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-50">
          <div>
            <span className="text-xs text-slate-400 block font-medium uppercase tracking-wider">Prix</span>
            <span className="text-xl font-bold text-slate-950 font-sans">
              {product.price.toLocaleString("fr-FR")} <span className="text-sm font-semibold">FCFA</span>
            </span>
          </div>

          <button
            onClick={() => onBuy(fullProduct)}
            className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm px-4 py-2.5 rounded-xl transition-all shadow-xs active:scale-95 cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4" />
            Commander
          </button>
        </div>
      </div>
    </div>
  );
}
