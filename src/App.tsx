import React, { useState, useEffect } from "react";
import { Product } from "./types";
import ProductCard from "./components/ProductCard";
import CheckoutModal from "./components/CheckoutModal";
import StatusModal from "./components/StatusModal";
import AdminPanel from "./components/AdminPanel";
import { Mail, CheckCircle, ShieldCheck, CreditCard, Award, HelpCircle, Lock } from "lucide-react";

export default function App() {
  const [view, setView] = useState<"store" | "admin">("store");
  const [products, setProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // Active product for checkout
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Active transaction being tracked
  const [activeTransactionId, setActiveTransactionId] = useState<string | null>(null);

  // Category filter
  const [selectedCategory, setSelectedCategory] = useState("Tous");
  const [categories, setCategories] = useState<string[]>(["Tous"]);

  // Newsletter state
  const [subscriberEmail, setSubscriberEmail] = useState("");
  const [subscriberSuccess, setSubscriberSuccess] = useState(false);
  const [subscriberLoading, setSubscriberLoading] = useState(false);
  const [subscriberError, setSubscriberError] = useState("");

  useEffect(() => {
    // Fetch products catalog
    fetch("/api/products")
      .then((res) => res.json())
      .then((data) => {
        setProducts(data || []);
        setLoadingProducts(false);

        // Derive unique categories
        const cats = ["Tous", ...Array.from(new Set(data.map((p: any) => p.category))) as string[]];
        setCategories(cats);
      })
      .catch((err) => {
        console.error("Error fetching products:", err);
        setLoadingProducts(false);
      });
  }, []);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subscriberEmail || !subscriberEmail.includes("@")) return;

    setSubscriberLoading(true);
    setSubscriberError("");
    setSubscriberSuccess(false);

    fetch("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: subscriberEmail })
    })
      .then((res) => res.json())
      .then((data) => {
        setSubscriberLoading(false);
        if (data.success) {
          setSubscriberSuccess(true);
          setSubscriberEmail("");
        } else {
          setSubscriberError(data.error || "Une erreur est survenue.");
        }
      })
      .catch(() => {
        setSubscriberLoading(false);
        setSubscriberError("Impossible de se connecter au serveur.");
      });
  };

  const filteredProducts = selectedCategory === "Tous"
    ? products
    : products.filter(p => p.category === selectedCategory);

  if (view === "admin") {
    return <AdminPanel onBackToStore={() => setView("store")} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      
      {/* Upper Announcement Banner */}
      <div className="bg-slate-900 text-white py-2 text-center text-xs font-semibold tracking-wide border-b border-slate-800">
        ⚡ LIVRAISON SÉCURISÉE & AUTOMATIQUE 24H/7J
      </div>

      {/* Navigation Header */}
      <header className="bg-white/80 backdrop-blur-md sticky top-0 border-b border-slate-100 z-40 p-4 sm:p-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setSelectedCategory("Tous")}>
            <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-bold font-mono text-lg shadow-sm border border-slate-800">
              💎
            </div>
            <div>
              <span className="text-lg font-extrabold tracking-tight text-slate-950 block">Rodi Media</span>
              <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">Abonnements & Licences</span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm font-semibold text-slate-600">
            <button
              onClick={() => {
                const element = document.getElementById("faq-section");
                element?.scrollIntoView({ behavior: "smooth" });
              }}
              className="hover:text-slate-950 transition-colors cursor-pointer hidden sm:block"
            >
              Comment ça marche ?
            </button>
            <button
              onClick={() => setView("admin")}
              className="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs px-3.5 py-2 rounded-xl transition-all cursor-pointer font-bold"
            >
              <Lock className="w-3.5 h-3.5" />
              Espace Client
            </button>
          </div>
        </div>
      </header>

      {/* Hero Visual Section */}
      <section className="bg-white border-b border-slate-100 py-12 sm:py-16 text-center">
        <div className="max-w-3xl mx-auto px-4 space-y-4">
          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full border border-emerald-100 uppercase tracking-wider">
            ⚡ Services premium et immédiats
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-950 tracking-tight leading-none">
            Vos abonnements favoris livrés en un instant
          </h1>
          <p className="text-slate-500 text-sm sm:text-base max-w-xl mx-auto leading-relaxed font-medium">
            Achetez vos codes, licences et abonnements (Netflix, Canal+, Spotify, IPTV, Free Fire...) de manière sécurisée et recevez-les instantanément après paiement.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-6 pt-2.5 text-xs text-slate-400 font-semibold uppercase tracking-wider">
            <span className="flex items-center gap-1.5"><ShieldCheck className="w-4.5 h-4.5 text-emerald-500" /> Transaction Sécurisée</span>
            <span className="flex items-center gap-1.5"><CreditCard className="w-4.5 h-4.5 text-emerald-500" /> Mobile Money Facile</span>
            <span className="flex items-center gap-1.5"><Award className="w-4.5 h-4.5 text-emerald-500" /> Assistance 24H/7J</span>
          </div>
        </div>
      </section>

      {/* Main Catalog Section */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12 flex flex-col gap-8">
        
        {/* Category Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 shrink-0 select-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4.5 py-2 rounded-full text-xs font-bold tracking-wide transition-all cursor-pointer whitespace-nowrap ${
                selectedCategory === cat
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-100"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        {loadingProducts ? (
          <div className="py-24 flex flex-col items-center justify-center gap-2">
            <div className="w-8 h-8 border-3 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
            <span className="text-sm font-semibold text-slate-400">Chargement de la vitrine...</span>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-24 bg-white border border-slate-100 rounded-3xl text-center">
            <p className="text-slate-400 text-sm italic font-medium">Aucun produit disponible dans cette catégorie pour le moment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onBuy={(p) => setSelectedProduct(p)}
              />
            ))}
          </div>
        )}

        {/* HOW IT WORKS / FAQ SECTION */}
        <section id="faq-section" className="bg-white border border-slate-100 rounded-3xl p-6 sm:p-10 space-y-6 sm:space-y-8 mt-12">
          <div className="text-center space-y-1.5 max-w-lg mx-auto">
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-950 tracking-tight">Comment fonctionne notre plateforme ?</h2>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Un processus simple, rapide et entièrement automatisé</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            <div className="space-y-2.5 text-center sm:text-left">
              <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-bold text-sm mx-auto sm:mx-0 shadow-xs">1</div>
              <h3 className="text-base font-bold text-slate-800">Sélectionnez et payez</h3>
              <p className="text-slate-500 text-xs leading-relaxed font-medium">
                Choisissez votre produit, sélectionnez votre pays et effectuez le transfert Mobile Money (Orange, MTN, Moov, Wave, etc.) vers le numéro indiqué.
              </p>
            </div>
            <div className="space-y-2.5 text-center sm:text-left">
              <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-bold text-sm mx-auto sm:mx-0 shadow-xs">2</div>
              <h3 className="text-base font-bold text-slate-800">Soumettez le Reçu</h3>
              <p className="text-slate-500 text-xs leading-relaxed font-medium">
                Renseignez votre adresse email et importez la capture d'écran / photo de votre reçu de paiement pour que notre passerelle valide votre transfert.
              </p>
            </div>
            <div className="space-y-2.5 text-center sm:text-left">
              <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-bold text-sm mx-auto sm:mx-0 shadow-xs">3</div>
              <h3 className="text-base font-bold text-slate-800">Livraison Instantanée</h3>
              <p className="text-slate-500 text-xs leading-relaxed font-medium">
                Notre plateforme analyse le reçu et valide votre commande. Les codes ou accès s'affichent instantanément à l'écran sans que vous n'ayez à rafraîchir !
              </p>
            </div>
          </div>
        </section>

        {/* NEWSLETTER SUBSCRIPTION BANNER */}
        <section className="bg-slate-950 text-white rounded-3xl p-6 sm:p-10 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden shadow-lg">
          <div className="space-y-2 z-10 text-center md:text-left">
            <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight">Inscrivez-vous à nos offres exclusives</h3>
            <p className="text-slate-400 text-xs sm:text-sm max-w-sm font-medium leading-relaxed">
              Recevez régulièrement par email nos promotions limitées, nouveautés abonnements et cadeaux flash personnalisés.
            </p>
          </div>

          <div className="w-full md:w-auto z-10">
            {subscriberSuccess ? (
              <div className="bg-emerald-500 text-white rounded-2xl p-4 flex items-center gap-2.5 font-semibold text-xs animate-bounce shadow-md">
                <CheckCircle className="w-5 h-5" />
                <span>Félicitations ! Vous êtes inscrit à nos offres exclusives.</span>
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-2">
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="email"
                    required
                    placeholder="Saisissez votre adresse email"
                    value={subscriberEmail}
                    onChange={(e) => setSubscriberEmail(e.target.value)}
                    disabled={subscriberLoading}
                    className="w-full sm:w-64 bg-slate-900/80 border border-slate-800 focus:border-slate-500 rounded-xl py-3 pl-11 pr-4 text-sm outline-hidden font-medium transition-all"
                  />
                </div>
                <button
                  type="submit"
                  disabled={subscriberLoading || !subscriberEmail}
                  className="bg-white hover:bg-slate-100 disabled:bg-slate-800 text-slate-950 disabled:text-slate-500 font-bold px-5 py-3 rounded-xl text-sm transition-all active:scale-98 cursor-pointer shadow-md disabled:cursor-not-allowed"
                >
                  {subscriberLoading ? "Inscription..." : "M'abonner"}
                </button>
              </form>
            )}

            {subscriberError && (
              <p className="text-rose-400 text-xs mt-2 text-center md:text-left font-semibold">{subscriberError}</p>
            )}
          </div>

          {/* Abstract subtle background visual circles */}
          <div className="absolute -top-12 -left-12 w-32 h-32 rounded-full bg-slate-800/15" />
          <div className="absolute -bottom-16 -right-16 w-48 h-48 rounded-full bg-slate-800/15" />
        </section>

      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-100 py-6 sm:py-8 mt-12 text-center text-slate-400 text-xs font-semibold">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p>© 2026 Rodi Media. Tous droits réservés.</p>
          <div className="flex items-center gap-4">
            <a href="https://t.me/rodiA2Di" target="_blank" rel="noreferrer" className="hover:text-slate-800 transition-colors">
              Support Telegram : @rodiA2Di
            </a>
            <span className="text-slate-200">|</span>
            <button onClick={() => setView("admin")} className="hover:text-slate-800 transition-colors inline-flex items-center gap-1 cursor-pointer">
              Espace Partenaire
            </button>
          </div>
        </div>
      </footer>

      {/* MODAL 1: CHECKOUT OVERLAY */}
      {selectedProduct && (
        <CheckoutModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onCheckoutSuccess={(txId) => {
            setSelectedProduct(null);
            setActiveTransactionId(txId);
          }}
        />
      )}

      {/* MODAL 2: DYNAMIC POLLED STATUS OVERLAY */}
      {activeTransactionId && (
        <StatusModal
          transactionId={activeTransactionId}
          onClose={() => setActiveTransactionId(null)}
        />
      )}

    </div>
  );
}
