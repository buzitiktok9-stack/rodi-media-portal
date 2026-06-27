import React, { useState, useEffect } from "react";
import { Product, Country, Transaction, Subscriber, AppConfig, PaymentMethod } from "../types";
import {
  Key, LogIn, LayoutDashboard, Database, CreditCard, History, Users, Settings,
  Save, Plus, Trash2, Edit2, Check, AlertCircle, Eye, RefreshCw, Send, CheckCircle2, X
} from "lucide-react";

interface AdminPanelProps {
  onBackToStore: () => void;
}

type TabType = "dashboard" | "products" | "payments" | "transactions" | "subscribers" | "config";

export default function AdminPanel({ onBackToStore }: AdminPanelProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [adminToken, setAdminToken] = useState("");
  const [loginError, setLoginError] = useState("");

  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [db, setDb] = useState<{
    products: Product[];
    countries: Country[];
    transactions: Transaction[];
    subscribers: Subscriber[];
    config: AppConfig;
  } | null>(null);

  const [loadingDb, setLoadingDb] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Expanded image modal state
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  // Temp editing states
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingCountry, setEditingCountry] = useState<Country | null>(null);

  // Newsletter draft state
  const [broadcastSubject, setBroadcastSubject] = useState("");
  const [broadcastContent, setBroadcastContent] = useState("");
  const [broadcastStatus, setBroadcastStatus] = useState<string | null>(null);

  // Manual transaction delivery states
  const [manualDeliveryTexts, setManualDeliveryTexts] = useState<{ [txId: string]: string }>({});

  const [activeAlerts, setActiveAlerts] = useState<{ id: string; message: string; type: "info" | "success" }[]>([]);

  const playNotificationSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc1 = audioCtx.createOscillator();
      const osc2 = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
      
      gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
      
      osc1.start(audioCtx.currentTime);
      osc2.start(audioCtx.currentTime);
      osc1.stop(audioCtx.currentTime + 0.5);
      osc2.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
      console.error("Audio playback failed", e);
    }
  };

  // Polling database for real-time notifications on the Admin Panel
  useEffect(() => {
    if (!isAuthenticated || !adminToken) return;

    const intervalId = setInterval(() => {
      fetch("/api/admin/db", {
        headers: {
          Authorization: adminToken
        }
      })
        .then((res) => {
          if (!res.ok) throw new Error("Incorrect Password");
          return res.json();
        })
        .then((newData) => {
          setDb((prevDb) => {
            if (!prevDb) return newData;

            // Find new transactions
            const newTxList = newData.transactions || [];
            const oldTxList = prevDb.transactions || [];

            const addedTx = newTxList.filter(
              (newTx: any) => !oldTxList.some((oldTx: any) => oldTx.id === newTx.id)
            );

            if (addedTx.length > 0) {
              // Play notification sound!
              playNotificationSound();

              // Add banner alerts
              const newAlerts = addedTx.map((tx: any) => ({
                id: `alert-${tx.id}-${Date.now()}`,
                message: `📥 Reçu soumis : ${tx.productName} (${tx.amount.toLocaleString("fr-FR")} FCFA) par ${tx.email}`,
                type: "info" as const
              }));

              setActiveAlerts((prevAlerts) => [...prevAlerts, ...newAlerts]);
            }

            return newData;
          });
        })
        .catch((err) => {
          console.error("Admin silent poll error:", err);
        });
    }, 8000); // Poll every 8 seconds

    return () => clearInterval(intervalId);
  }, [isAuthenticated, adminToken]);

  useEffect(() => {
    // Check local storage for pre-saved login
    const savedToken = localStorage.getItem("admin_token");
    if (savedToken) {
      setAdminToken(savedToken);
      fetchAdminData(savedToken);
    }
  }, []);

  const fetchAdminData = (token: string) => {
    setLoadingDb(true);
    fetch("/api/admin/db", {
      headers: {
        Authorization: token
      }
    })
      .then((res) => {
        if (!res.ok) throw new Error("Incorrect Password");
        return res.json();
      })
      .then((data) => {
        setDb(data);
        setIsAuthenticated(true);
        setLoadingDb(false);
        setLoginError("");
      })
      .catch((err) => {
        console.error("Admin fetch error:", err);
        setLoginError("Accès refusé. Veuillez vérifier le mot de passe d'administration.");
        setIsAuthenticated(false);
        setLoadingDb(false);
        localStorage.removeItem("admin_token");
      });
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput) return;

    fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: passwordInput })
    })
      .then((res) => {
        if (!res.ok) throw new Error("Mot de passe invalide.");
        return res.json();
      })
      .then((data) => {
        if (data.success) {
          localStorage.setItem("admin_token", passwordInput);
          setAdminToken(passwordInput);
          fetchAdminData(passwordInput);
        }
      })
      .catch((err) => {
        setLoginError("Mot de passe d'administration incorrect.");
      });
  };

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    setAdminToken("");
    setIsAuthenticated(false);
    setDb(null);
  };

  const showFeedback = (msg: string) => {
    setSaveStatus(msg);
    setTimeout(() => setSaveStatus(null), 3000);
  };

  // PRODUCTS ACTIONS
  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !editingProduct) return;

    let updatedProducts = [...db.products];
    if (db.products.some(p => p.id === editingProduct.id)) {
      updatedProducts = db.products.map(p => p.id === editingProduct.id ? editingProduct : p);
    } else {
      updatedProducts.push(editingProduct);
    }

    fetch("/api/admin/products", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: adminToken
      },
      body: JSON.stringify({ products: updatedProducts })
    })
      .then(res => res.json())
      .then(() => {
        setDb({ ...db, products: updatedProducts });
        setEditingProduct(null);
        showFeedback("Produit enregistré avec succès !");
      })
      .catch(() => showFeedback("Erreur lors de l'enregistrement."));
  };

  const handleDeleteProduct = (productId: string) => {
    if (!db || !window.confirm("Êtes-vous sûr de vouloir supprimer ce produit ?")) return;

    const updatedProducts = db.products.filter(p => p.id !== productId);

    fetch("/api/admin/products", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: adminToken
      },
      body: JSON.stringify({ products: updatedProducts })
    })
      .then(res => res.json())
      .then(() => {
        setDb({ ...db, products: updatedProducts });
        showFeedback("Produit supprimé !");
      });
  };

  // PAYMENT METHODS ACTIONS
  const handleSaveCountry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !editingCountry) return;

    let updatedCountries = [...db.countries];
    if (db.countries.some(c => c.code === editingCountry.code)) {
      updatedCountries = db.countries.map(c => c.code === editingCountry.code ? editingCountry : c);
    } else {
      updatedCountries.push(editingCountry);
    }

    fetch("/api/admin/countries", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: adminToken
      },
      body: JSON.stringify({ countries: updatedCountries })
    })
      .then(res => res.json())
      .then(() => {
        setDb({ ...db, countries: updatedCountries });
        setEditingCountry(null);
        showFeedback("Pays et moyens enregistrés !");
      })
      .catch(() => showFeedback("Erreur lors de l'enregistrement."));
  };

  const handleDeleteCountry = (code: string) => {
    if (!db || !window.confirm("Supprimer ce pays ?")) return;
    const updatedCountries = db.countries.filter(c => c.code !== code);

    fetch("/api/admin/countries", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: adminToken
      },
      body: JSON.stringify({ countries: updatedCountries })
    })
      .then(res => res.json())
      .then(() => {
        setDb({ ...db, countries: updatedCountries });
        showFeedback("Pays supprimé !");
      });
  };

  // TRANSACTION ACTIONS
  const handleTransactionAction = (txId: string, action: "approve" | "reject") => {
    if (!db) return;
    const manualDeliveryText = manualDeliveryTexts[txId] || "";

    fetch(`/api/admin/transactions/${txId}/action`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: adminToken
      },
      body: JSON.stringify({
        action: action,
        manualDeliveryItem: manualDeliveryText.trim() || undefined
      })
    })
      .then((res) => res.json())
      .then(() => {
        // Refetch DB to synchronize
        fetchAdminData(adminToken);
        showFeedback(action === "approve" ? "Transaction approuvée !" : "Transaction rejetée !");
        // Clear manual input
        setManualDeliveryTexts(prev => {
          const next = { ...prev };
          delete next[txId];
          return next;
        });
      })
      .catch(() => showFeedback("Échec de l'action de transaction."));
  };

  // CONFIGS SAVE
  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!db) return;

    fetch("/api/admin/config", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: adminToken
      },
      body: JSON.stringify({ config: db.config })
    })
      .then(res => res.json())
      .then((data) => {
        if (data.success) {
          // If password changed, update local admin token
          if (db.config.adminPassword && db.config.adminPassword !== adminToken) {
            setAdminToken(db.config.adminPassword);
            localStorage.setItem("admin_token", db.config.adminPassword);
          }
          showFeedback("Configuration enregistrée !");
        }
      });
  };

  // NEWSLETTER BROADCAST
  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastSubject || !broadcastContent) return;

    setBroadcastStatus("Diffusion en cours...");
    fetch("/api/admin/broadcast", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: adminToken
      },
      body: JSON.stringify({
        subject: broadcastSubject,
        content: broadcastContent
      })
    })
      .then(res => res.json())
      .then((data) => {
        setBroadcastStatus(data.message || "Message diffusé !");
        setBroadcastSubject("");
        setBroadcastContent("");
        setTimeout(() => setBroadcastStatus(null), 4000);
      })
      .catch(() => {
        setBroadcastStatus("Erreur lors de la diffusion.");
        setTimeout(() => setBroadcastStatus(null), 3000);
      });
  };

  // RENDERING LOGIN FORM IF NOT AUTHENTICATED
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md border border-slate-100 flex flex-col items-center">
          <div className="w-14 h-14 bg-slate-900 text-white rounded-full flex items-center justify-center mb-5 shadow-xs">
            <Key className="w-6 h-6" />
          </div>

          <h1 className="text-xl font-bold text-slate-800 tracking-tight text-center mb-1">
            Espace Administrateur
          </h1>
          <p className="text-xs text-slate-400 font-medium text-center mb-6">
            Saisissez le mot de passe d'administration pour continuer
          </p>

          {loginError && (
            <div className="mb-4 p-4.5 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-sm flex items-start gap-2 w-full font-medium">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="w-full space-y-4">
            <div>
              <input
                type="password"
                placeholder="Mot de passe d'administration"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-slate-800 focus:bg-white rounded-xl py-3 px-4 text-sm font-medium outline-hidden transition-all text-slate-900"
              />
            </div>

            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 rounded-xl transition-all shadow-md active:scale-98 cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              Se connecter
            </button>
          </form>

          <button
            onClick={onBackToStore}
            className="mt-6 text-slate-500 hover:text-slate-800 text-xs font-semibold underline cursor-pointer"
          >
            Retourner au site public
          </button>
        </div>
      </div>
    );
  }

  if (!db) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-3 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
          <span className="text-sm font-semibold text-slate-500">Chargement de la base de données...</span>
        </div>
      </div>
    );
  }

  // CALC STATS
  const totalSalesCount = db.transactions.filter(t => t.status === "approved").length;
  const pendingCount = db.transactions.filter(t => t.status === "pending").length;
  const totalRevenue = db.transactions
    .filter(t => t.status === "approved")
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="bg-slate-900 text-white shadow-md p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center font-bold font-mono text-white text-lg border border-white/5">
            ⚙️
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight">Panneau de Contrôle Admin</h1>
            <p className="text-[10px] text-slate-400 font-semibold font-mono uppercase tracking-widest">
              Statut du Système : En ligne (Robot Actif)
            </p>
          </div>
        </div>

        {saveStatus && (
          <div className="bg-emerald-500 text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 font-semibold animate-pulse">
            <Check className="w-4 h-4" />
            {saveStatus}
          </div>
        )}

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={() => fetchAdminData(adminToken)}
            className="p-2 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Rafraîchir les données"
          >
            <RefreshCw className="w-4.5 h-4.5" />
          </button>
          <button
            onClick={onBackToStore}
            className="text-xs bg-white/10 hover:bg-white/15 text-white font-semibold px-4 py-2 rounded-lg transition-all cursor-pointer"
          >
            Voir Boutique
          </button>
          <button
            onClick={handleLogout}
            className="text-xs bg-rose-600 hover:bg-rose-500 text-white font-semibold px-4 py-2 rounded-lg transition-all cursor-pointer"
          >
            Déconnexion
          </button>
        </div>
      </div>

      {/* Real-time Alerts Stack */}
      {activeAlerts.length > 0 && (
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 space-y-2 max-w-7xl mx-auto w-full mt-4 rounded-2xl">
          {activeAlerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-center justify-between bg-blue-50 border border-blue-200 text-blue-800 text-sm px-4 py-3 rounded-xl shadow-xs animate-slide-in font-medium"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-ping shrink-0" />
                <span>{alert.message}</span>
              </div>
              <button
                onClick={() => setActiveAlerts((prev) => prev.filter((a) => a.id !== alert.id))}
                className="text-blue-500 hover:text-blue-800 p-1 rounded-md hover:bg-blue-100 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex-1 flex flex-col md:flex-row max-w-7xl mx-auto w-full p-4 sm:p-6 gap-6">
        {/* Navigation Sidebar */}
        <div className="w-full md:w-60 flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-visible py-2 md:py-0 border-b md:border-b-0 md:border-r border-slate-200 shrink-0 select-none">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer text-left whitespace-nowrap md:whitespace-normal ${
              activeTab === "dashboard" ? "bg-slate-900 text-white shadow-xs" : "text-slate-600 hover:bg-slate-200"
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            Statistiques
          </button>
          <button
            onClick={() => { setActiveTab("products"); setEditingProduct(null); }}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer text-left whitespace-nowrap md:whitespace-normal ${
              activeTab === "products" ? "bg-slate-900 text-white shadow-xs" : "text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Database className="w-4 h-4" />
            Produits & Stocks ({db.products.length})
          </button>
          <button
            onClick={() => { setActiveTab("payments"); setEditingCountry(null); }}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer text-left whitespace-nowrap md:whitespace-normal ${
              activeTab === "payments" ? "bg-slate-900 text-white shadow-xs" : "text-slate-600 hover:bg-slate-200"
            }`}
          >
            <CreditCard className="w-4 h-4" />
            Moyens de Paiement
          </button>
          <button
            onClick={() => setActiveTab("transactions")}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer text-left whitespace-nowrap md:whitespace-normal relative ${
              activeTab === "transactions" ? "bg-slate-900 text-white shadow-xs" : "text-slate-600 hover:bg-slate-200"
            }`}
          >
            <History className="w-4 h-4" />
            Transactions ({db.transactions.length})
            {pendingCount > 0 && (
              <span className="absolute md:relative top-1 right-1 md:top-0 md:right-0 bg-rose-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full md:ml-2">
                {pendingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("subscribers")}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer text-left whitespace-nowrap md:whitespace-normal ${
              activeTab === "subscribers" ? "bg-slate-900 text-white shadow-xs" : "text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Users className="w-4 h-4" />
            Abonnés ({db.subscribers.length})
          </button>
          <button
            onClick={() => setActiveTab("config")}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer text-left whitespace-nowrap md:whitespace-normal ${
              activeTab === "config" ? "bg-slate-900 text-white shadow-xs" : "text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Settings className="w-4 h-4" />
            Paramètres
          </button>
        </div>

        {/* Dynamic Content Panel */}
        <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 overflow-hidden flex flex-col min-h-[500px]">

          {/* TAB 1: DASHBOARD STATS */}
          {activeTab === "dashboard" && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-slate-800 tracking-tight">Vue d'ensemble</h2>

              {/* Bento grid stats cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Ventes Validées</span>
                  <div className="text-3xl font-extrabold text-slate-950 font-sans mt-1">{totalSalesCount}</div>
                  <p className="text-[10px] text-emerald-600 font-semibold mt-1">Livrées par le système ou admin</p>
                </div>
                <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Transactions en attente</span>
                  <div className="text-3xl font-extrabold text-slate-950 font-sans mt-1">{pendingCount}</div>
                  <p className="text-[10px] text-amber-600 font-semibold mt-1">Nécessite votre attention / vérification</p>
                </div>
                <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Chiffre d'Affaires</span>
                  <div className="text-3xl font-extrabold text-slate-950 font-sans mt-1">
                    {totalRevenue.toLocaleString("fr-FR")} <span className="text-sm font-bold">FCFA</span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-semibold mt-1">Montant total des paiements validés</p>
                </div>
              </div>

              {/* Recent activity list */}
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3">Activités Récentes</h3>
                {db.transactions.length === 0 ? (
                  <p className="text-slate-400 text-sm italic">Aucune transaction enregistrée pour le moment.</p>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden max-h-[300px] overflow-y-auto">
                    {db.transactions.slice(-10).reverse().map((tx) => (
                      <div key={tx.id} className="p-3.5 flex items-center justify-between text-sm bg-slate-50/40">
                        <div>
                          <span className="font-mono text-xs text-slate-400 block">{tx.id}</span>
                          <strong className="text-slate-700">{tx.productName}</strong>
                          <span className="text-slate-400 text-xs ml-2">({tx.email})</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-slate-950 block">{tx.amount} FCFA</span>
                          <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                            tx.status === "approved" ? "bg-emerald-50 text-emerald-700" :
                            tx.status === "rejected" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700 animate-pulse"
                          }`}>
                            {tx.status === "approved" ? "Validé" : tx.status === "rejected" ? "Refusé" : "En attente"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: PRODUCTS & STOCK MANAGEMENT */}
          {activeTab === "products" && (
            <div className="space-y-6 overflow-y-auto flex-1">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-800 tracking-tight">Gestion des Produits et Stocks</h2>
                {!editingProduct && (
                  <button
                    onClick={() => setEditingProduct({
                      id: "prod-" + Date.now(),
                      name: "",
                      price: 0,
                      description: "",
                      category: "Abonnements",
                      image: "https://images.unsplash.com/photo-1593305841991-05c297ba4575?auto=format&fit=crop&w=600&q=80",
                      stock: []
                    })}
                    className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3 py-2 rounded-lg cursor-pointer transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    Ajouter un Produit
                  </button>
                )}
              </div>

              {/* Product Edit / Creation Form */}
              {editingProduct ? (
                <form onSubmit={handleSaveProduct} className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-2">
                    {db.products.some(p => p.id === editingProduct.id) ? "Modifier le produit" : "Nouveau produit"}
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Nom du produit *</label>
                      <input
                        type="text"
                        required
                        value={editingProduct.name}
                        onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                        className="w-full bg-white border border-slate-200 focus:border-slate-800 rounded-lg p-2.5 text-sm outline-hidden font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Prix (en FCFA) *</label>
                      <input
                        type="number"
                        required
                        value={editingProduct.price || ""}
                        onChange={(e) => setEditingProduct({ ...editingProduct, price: parseInt(e.target.value) || 0 })}
                        className="w-full bg-white border border-slate-200 focus:border-slate-800 rounded-lg p-2.5 text-sm outline-hidden font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Catégorie *</label>
                      <input
                        type="text"
                        required
                        value={editingProduct.category}
                        onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })}
                        className="w-full bg-white border border-slate-200 focus:border-slate-800 rounded-lg p-2.5 text-sm outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Lien Image Unsplash *</label>
                      <input
                        type="text"
                        required
                        value={editingProduct.image}
                        onChange={(e) => setEditingProduct({ ...editingProduct, image: e.target.value })}
                        className="w-full bg-white border border-slate-200 focus:border-slate-800 rounded-lg p-2.5 text-sm outline-hidden font-mono text-xs text-slate-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Description du produit</label>
                    <textarea
                      value={editingProduct.description}
                      onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                      rows={3}
                      className="w-full bg-white border border-slate-200 focus:border-slate-800 rounded-lg p-2.5 text-sm outline-hidden"
                    />
                  </div>

                  {/* Stock Entry */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Stock Actuel (Un élément par ligne - Poppé automatiquement lors de la vente)
                    </label>
                    <textarea
                      placeholder="Licence ou accès 1&#10;Licence ou accès 2&#10;Licence ou accès 3"
                      value={editingProduct.stock ? editingProduct.stock.join("\n") : ""}
                      onChange={(e) => setEditingProduct({
                        ...editingProduct,
                        stock: e.target.value.split("\n").map(l => l.trim()).filter(Boolean)
                      })}
                      rows={4}
                      className="w-full bg-white border border-slate-200 focus:border-slate-800 rounded-lg p-2.5 text-sm outline-hidden font-mono text-xs"
                    />
                    <span className="text-[10px] text-slate-400 font-medium">
                      Total actuellement en stock : {editingProduct.stock ? editingProduct.stock.length : 0} éléments.
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 bg-slate-950 hover:bg-slate-800 text-white font-semibold text-xs px-4 py-2.5 rounded-lg cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      Enregistrer
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingProduct(null)}
                      className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs px-4 py-2.5 rounded-lg cursor-pointer"
                    >
                      Annuler
                    </button>
                  </div>
                </form>
              ) : (
                /* Products list grid */
                <div className="grid grid-cols-1 gap-4">
                  {db.products.map((product) => (
                    <div key={product.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div className="flex items-center gap-4">
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-16 h-12 rounded-lg object-cover border border-slate-200"
                        />
                        <div>
                          <strong className="text-slate-800 block text-base">{product.name}</strong>
                          <span className="text-xs text-slate-500 font-mono">{product.id} — {product.category}</span>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm font-bold text-slate-900">{product.price.toLocaleString()} FCFA</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              product.stock.length > 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                            }`}>
                              Stock : {product.stock.length} restants
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 self-end sm:self-center">
                        <button
                          onClick={() => setEditingProduct({ ...product })}
                          className="p-2 hover:bg-slate-200 text-slate-600 rounded-lg cursor-pointer transition-colors"
                          title="Modifier"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(product.id)}
                          className="p-2 hover:bg-rose-100 text-rose-600 rounded-lg cursor-pointer transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PAYMENT METHODS / COUNTRIES */}
          {activeTab === "payments" && (
            <div className="space-y-6 overflow-y-auto flex-1">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-800 tracking-tight">Moyens de Paiement par Pays</h2>
                {!editingCountry && (
                  <button
                    onClick={() => setEditingCountry({
                      code: "",
                      name: "",
                      paymentMethods: []
                    })}
                    className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3 py-2 rounded-lg cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Ajouter un Pays
                  </button>
                )}
              </div>

              {editingCountry ? (
                <form onSubmit={handleSaveCountry} className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-2">
                    {db.countries.some(c => c.code === editingCountry.code) ? "Modifier le pays" : "Nouveau Pays"}
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Code Pays (Ex: BF, CI, SN, ML) *</label>
                      <input
                        type="text"
                        required
                        disabled={db.countries.some(c => c.code === editingCountry.code)}
                        value={editingCountry.code}
                        onChange={(e) => setEditingCountry({ ...editingCountry, code: e.target.value.toUpperCase() })}
                        className="w-full bg-white border border-slate-200 focus:border-slate-800 rounded-lg p-2.5 text-sm outline-hidden font-mono uppercase"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Nom du Pays (Ex: Burkina Faso) *</label>
                      <input
                        type="text"
                        required
                        value={editingCountry.name}
                        onChange={(e) => setEditingCountry({ ...editingCountry, name: e.target.value })}
                        className="w-full bg-white border border-slate-200 focus:border-slate-800 rounded-lg p-2.5 text-sm outline-hidden font-semibold"
                      />
                    </div>
                  </div>

                  {/* Payment Methods List Editor */}
                  <div className="space-y-3.5">
                    <div className="flex justify-between items-center border-b border-slate-200 pb-1.5">
                      <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Moyens de paiement associés</span>
                      <button
                        type="button"
                        onClick={() => {
                          const newMethod: PaymentMethod = {
                            id: "method-" + Date.now(),
                            name: "Nouveau Moyen",
                            logo: "orange",
                            number: "+226 00 00 00 00",
                            holder: "Rodi A2Di",
                            instructions: "Effectuez un transfert direct..."
                          };
                          setEditingCountry({
                            ...editingCountry,
                            paymentMethods: [...editingCountry.paymentMethods, newMethod]
                          });
                        }}
                        className="text-[10px] bg-slate-200 text-slate-700 hover:bg-slate-300 px-2 py-1 rounded-md font-bold cursor-pointer"
                      >
                        + Ajouter un Moyen
                      </button>
                    </div>

                    {editingCountry.paymentMethods.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">Aucun moyen configuré.</p>
                    ) : (
                      <div className="space-y-3">
                        {editingCountry.paymentMethods.map((method, index) => (
                          <div key={method.id} className="p-3 bg-white rounded-xl border border-slate-200 relative space-y-2">
                            <button
                              type="button"
                              onClick={() => {
                                const nextMethods = editingCountry.paymentMethods.filter(m => m.id !== method.id);
                                setEditingCountry({ ...editingCountry, paymentMethods: nextMethods });
                              }}
                              className="absolute top-2 right-2 text-rose-500 hover:text-rose-700 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                              <div>
                                <label className="font-semibold block mb-0.5 text-slate-500">Nom de l'opérateur</label>
                                <input
                                  type="text"
                                  value={method.name}
                                  onChange={(e) => {
                                    const nextMethods = editingCountry.paymentMethods.map((m, i) => i === index ? { ...m, name: e.target.value } : m);
                                    setEditingCountry({ ...editingCountry, paymentMethods: nextMethods });
                                  }}
                                  className="w-full border border-slate-200 rounded p-1Outline bg-slate-50 outline-hidden font-semibold text-slate-700"
                                />
                              </div>
                              <div>
                                <label className="font-semibold block mb-0.5 text-slate-500">Logo/Type</label>
                                <select
                                  value={method.logo}
                                  onChange={(e) => {
                                    const nextMethods = editingCountry.paymentMethods.map((m, i) => i === index ? { ...m, logo: e.target.value } : m);
                                    setEditingCountry({ ...editingCountry, paymentMethods: nextMethods });
                                  }}
                                  className="w-full border border-slate-200 rounded p-1 bg-slate-50 outline-hidden text-slate-700"
                                >
                                  <option value="orange">Orange Money</option>
                                  <option value="mtn">MTN Mobile Money</option>
                                  <option value="moov">Moov Money (Flooz)</option>
                                  <option value="wave">Wave</option>
                                  <option value="payeer">Payeer</option>
                                  <option value="perfect_money">Perfect Money</option>
                                  <option value="other">Autre / Personnalisé</option>
                                </select>
                              </div>
                              <div>
                                <label className="font-semibold block mb-0.5 text-slate-500">Numéro ou Détail</label>
                                <input
                                  type="text"
                                  value={method.number}
                                  onChange={(e) => {
                                    const nextMethods = editingCountry.paymentMethods.map((m, i) => i === index ? { ...m, number: e.target.value } : m);
                                    setEditingCountry({ ...editingCountry, paymentMethods: nextMethods });
                                  }}
                                  className="w-full border border-slate-200 rounded p-1 bg-slate-50 outline-hidden font-mono"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                              <div>
                                <label className="font-semibold block mb-0.5 text-slate-500">Nom du bénéficiaire</label>
                                <input
                                  type="text"
                                  value={method.holder}
                                  onChange={(e) => {
                                    const nextMethods = editingCountry.paymentMethods.map((m, i) => i === index ? { ...m, holder: e.target.value } : m);
                                    setEditingCountry({ ...editingCountry, paymentMethods: nextMethods });
                                  }}
                                  className="w-full border border-slate-200 rounded p-1 bg-slate-50 outline-hidden"
                                />
                              </div>
                              <div>
                                <label className="font-semibold block mb-0.5 text-slate-500">Instructions pour le client</label>
                                <input
                                  type="text"
                                  value={method.instructions}
                                  onChange={(e) => {
                                    const nextMethods = editingCountry.paymentMethods.map((m, i) => i === index ? { ...m, instructions: e.target.value } : m);
                                    setEditingCountry({ ...editingCountry, paymentMethods: nextMethods });
                                  }}
                                  className="w-full border border-slate-200 rounded p-1 bg-slate-50 outline-hidden"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 bg-slate-950 hover:bg-slate-800 text-white font-semibold text-xs px-4 py-2.5 rounded-lg cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      Enregistrer
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingCountry(null)}
                      className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs px-4 py-2.5 rounded-lg cursor-pointer"
                    >
                      Annuler
                    </button>
                  </div>
                </form>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {db.countries.map((country) => (
                    <div key={country.code} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <strong className="text-slate-800 text-base flex items-center gap-2">
                          <span className="text-lg">
                            {country.code === "BF" && "🇧🇫"}
                            {country.code === "CI" && "🇨🇮"}
                            {country.code === "SN" && "🇸🇳"}
                            {country.code === "ML" && "🇲🇱"}
                            {country.code === "GL" && "🌐"}
                          </span>
                          {country.name} ({country.code})
                        </strong>
                        <span className="text-xs text-slate-500 mt-1 block">
                          Moyens de paiement configurés : {country.paymentMethods.map(m => m.name).join(", ") || "Aucun"}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 self-end sm:self-center">
                        <button
                          onClick={() => setEditingCountry({ ...country })}
                          className="p-2 hover:bg-slate-200 text-slate-600 rounded-lg cursor-pointer transition-colors"
                          title="Modifier"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteCountry(country.code)}
                          className="p-2 hover:bg-rose-100 text-rose-600 rounded-lg cursor-pointer transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: TRANSACTION LOG HISTORY & REVIEW */}
          {activeTab === "transactions" && (
            <div className="space-y-6 overflow-y-auto flex-1">
              <h2 className="text-xl font-bold text-slate-800 tracking-tight">Historique des Transactions</h2>

              <div className="space-y-4">
                {db.transactions.length === 0 ? (
                  <p className="text-slate-400 text-sm italic">Aucune transaction enregistrée pour le moment.</p>
                ) : (
                  db.transactions.slice().reverse().map((tx) => (
                    <div
                      key={tx.id}
                      className={`p-5 rounded-2xl border flex flex-col lg:flex-row gap-5 justify-between items-start ${
                        tx.status === "pending" ? "bg-amber-50/40 border-amber-100" :
                        tx.status === "approved" ? "bg-emerald-50/20 border-emerald-100" : "bg-rose-50/20 border-rose-100"
                      }`}
                    >
                      {/* Transaction Header Info */}
                      <div className="space-y-2 flex-1 w-full">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs text-slate-400 block font-semibold">
                            <code>{tx.id}</code>
                          </span>
                          <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            tx.status === "approved" ? "bg-emerald-100 text-emerald-800" :
                            tx.status === "rejected" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800 animate-pulse"
                          }`}>
                            {tx.status === "approved" ? "Validé" : tx.status === "rejected" ? "Refusé" : "En attente"}
                          </span>
                          {tx.isPendingManualDelivery && (
                            <span className="bg-rose-600 text-white text-[9px] font-bold px-2.5 py-0.5 rounded-full animate-pulse uppercase">
                              Stock Vide - Urgent !
                            </span>
                          )}
                        </div>

                        <div className="text-sm">
                          <strong className="text-slate-800 text-base">{tx.productName}</strong>
                          <span className="text-slate-500 font-mono text-xs block mt-0.5">
                            Montant : {tx.amount} FCFA | Méthode : {tx.paymentMethodId} ({tx.countryCode})
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs bg-white/50 p-3 rounded-xl border border-slate-100 max-w-lg">
                          <div>
                            <span className="text-slate-400 block font-medium">Email Client :</span>
                            <span className="font-semibold text-slate-800 break-all select-all">{tx.email}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block font-medium">WhatsApp :</span>
                            <span className="font-semibold text-slate-800 select-all">{tx.whatsapp || "Non renseigné"}</span>
                          </div>
                        </div>

                        {tx.deliveredItem && (
                          <div className="p-3 bg-white rounded-xl border border-emerald-100 text-xs">
                            <span className="text-[10px] font-bold text-emerald-600 block mb-0.5">PRODUIT AUTOMATIQUEMENT LIVRÉ :</span>
                            <code className="text-slate-800 break-all bg-emerald-50/50 p-2 rounded block border border-emerald-50">{tx.deliveredItem}</code>
                          </div>
                        )}

                        {tx.errorMessage && (
                          <p className="text-xs font-semibold text-rose-600 bg-rose-50/50 p-2 rounded-lg border border-rose-100">
                            Raison Robot: {tx.errorMessage}
                          </p>
                        )}

                        <span className="text-[10px] text-slate-400 font-semibold block pt-1">
                          Reçu le : {new Date(tx.createdAt).toLocaleString("fr-FR")}
                        </span>
                      </div>

                      {/* Receipt Screenshot and Admin Manual Overrides */}
                      <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto shrink-0 border-t lg:border-t-0 pt-4 lg:pt-0 border-slate-100">
                        {tx.receiptImage && (
                          <div className="relative group select-none shrink-0 cursor-pointer" onClick={() => setExpandedImage(tx.receiptImage)}>
                            <img
                              src={tx.receiptImage}
                              alt="Receipt proof"
                              className="w-24 h-32 rounded-lg object-cover border border-slate-200 group-hover:opacity-85 transition-opacity"
                            />
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-slate-900/40 rounded-lg transition-opacity">
                              <Eye className="w-5 h-5 text-white" />
                            </div>
                          </div>
                        )}

                        {tx.status === "pending" && (
                          <div className="space-y-2 w-full sm:w-48">
                            <label className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">
                              Livraison manuelle (Optionnelle)
                            </label>
                            <input
                              type="text"
                              placeholder="Code / Compte à livrer..."
                              value={manualDeliveryTexts[tx.id] || ""}
                              onChange={(e) => setManualDeliveryTexts({ ...manualDeliveryTexts, [tx.id]: e.target.value })}
                              className="w-full bg-white border border-slate-200 focus:border-slate-800 rounded-lg p-1.5 text-xs outline-hidden"
                            />
                            <div className="grid grid-cols-2 gap-1.5">
                              <button
                                onClick={() => handleTransactionAction(tx.id, "approve")}
                                className="inline-flex items-center justify-center gap-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 rounded-lg text-xs cursor-pointer transition-all"
                              >
                                <Check className="w-3.5 h-3.5" />
                                Valider
                              </button>
                              <button
                                onClick={() => handleTransactionAction(tx.id, "reject")}
                                className="inline-flex items-center justify-center gap-1 bg-rose-600 hover:bg-rose-500 text-white font-bold py-2 rounded-lg text-xs cursor-pointer transition-all"
                              >
                                <X className="w-3.5 h-3.5" />
                                Rejeter
                              </button>
                            </div>
                          </div>
                        )}
                        
                        {tx.status === "approved" && tx.isPendingManualDelivery && (
                          <div className="space-y-2 w-full sm:w-48 bg-rose-50 border border-rose-100 p-3 rounded-xl">
                            <span className="text-[10px] font-bold text-rose-600 block">EN ATTENTE DE LIVRAISON</span>
                            <input
                              type="text"
                              required
                              placeholder="Éléments d'accès à envoyer..."
                              value={manualDeliveryTexts[tx.id] || ""}
                              onChange={(e) => setManualDeliveryTexts({ ...manualDeliveryTexts, [tx.id]: e.target.value })}
                              className="w-full bg-white border border-rose-200 focus:border-rose-800 rounded-lg p-1.5 text-xs outline-hidden"
                            />
                            <button
                              onClick={() => handleTransactionAction(tx.id, "approve")}
                              disabled={!(manualDeliveryTexts[tx.id] || "").trim()}
                              className="w-full inline-flex items-center justify-center gap-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 text-white disabled:text-slate-400 font-bold py-2 rounded-lg text-xs cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Livrer Maintenant
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 5: NEWSLETTER & SUBSCRIBERS */}
          {activeTab === "subscribers" && (
            <div className="space-y-6 overflow-y-auto flex-1">
              <h2 className="text-xl font-bold text-slate-800 tracking-tight">Liste de Diffusion et Abonnés</h2>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Send broadcast newsletter */}
                <div className="lg:col-span-2 bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-4">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-2">
                    Diffuser un Message / Offre
                  </h3>

                  {broadcastStatus && (
                    <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs font-semibold rounded-lg">
                      {broadcastStatus}
                    </div>
                  )}

                  <form onSubmit={handleSendBroadcast} className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Objet du Mail *</label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Promotion Spéciale : Netflix Premium à -20% !"
                        value={broadcastSubject}
                        onChange={(e) => setBroadcastSubject(e.target.value)}
                        className="w-full bg-white border border-slate-200 focus:border-slate-800 rounded-lg p-2.5 text-sm outline-hidden font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Contenu de l'offre (Texte / HTML) *</label>
                      <textarea
                        required
                        rows={6}
                        placeholder="Bonjour, nous avons le plaisir de vous annoncer notre nouvelle offre..."
                        value={broadcastContent}
                        onChange={(e) => setBroadcastContent(e.target.value)}
                        className="w-full bg-white border border-slate-200 focus:border-slate-800 rounded-lg p-2.5 text-sm outline-hidden"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={db.subscribers.length === 0 || !broadcastSubject || !broadcastContent}
                      className="inline-flex items-center gap-1.5 bg-slate-950 hover:bg-slate-800 disabled:bg-slate-200 text-white disabled:text-slate-400 font-bold text-xs px-4 py-2.5 rounded-lg cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                      Envoyer à tous les abonnés ({db.subscribers.length})
                    </button>
                  </form>
                </div>

                {/* Subscribers list */}
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-2 mb-3">
                    Abonnés ({db.subscribers.length})
                  </h3>

                  {db.subscribers.length === 0 ? (
                    <p className="text-slate-400 text-xs italic text-center py-6">Aucun abonné pour le moment.</p>
                  ) : (
                    <div className="divide-y divide-slate-200 max-h-[300px] overflow-y-auto pr-1">
                      {db.subscribers.map((sub, index) => (
                        <div key={index} className="py-2 flex flex-col">
                          <span className="font-semibold text-xs text-slate-800 break-all select-all">{sub.email}</span>
                          <span className="text-[9px] text-slate-400">Le : {new Date(sub.createdAt).toLocaleDateString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: CONFIGS & TELEGRAM BOT SETUP */}
          {activeTab === "config" && (
            <div className="space-y-6 overflow-y-auto flex-1">
              <h2 className="text-xl font-bold text-slate-800 tracking-tight">Paramètres Généraux et Notifications</h2>

              <form onSubmit={handleSaveConfig} className="p-5 bg-slate-50 border border-slate-100 rounded-2xl space-y-5">
                
                {/* Admin login password */}
                <div className="space-y-2 border-b border-slate-200 pb-4">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Accès Administration</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Mot de passe admin</label>
                      <input
                        type="password"
                        required
                        value={db.config.adminPassword || ""}
                        onChange={(e) => setDb({
                          ...db,
                          config: { ...db.config, adminPassword: e.target.value }
                        })}
                        className="w-full bg-white border border-slate-200 focus:border-slate-800 rounded-lg p-2.5 text-sm outline-hidden font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Contact Telegram Support (Client)</label>
                      <input
                        type="text"
                        required
                        value={db.config.supportTelegram || ""}
                        onChange={(e) => setDb({
                          ...db,
                          config: { ...db.config, supportTelegram: e.target.value }
                        })}
                        className="w-full bg-white border border-slate-200 focus:border-slate-800 rounded-lg p-2.5 text-sm outline-hidden font-semibold"
                      />
                    </div>
                  </div>
                </div>

                {/* Telegram Bot configs */}
                <div className="space-y-2 border-b border-slate-200 pb-4">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    🤖 Alertes et Notifications Bot Telegram
                  </h3>
                  <p className="text-xs text-slate-400">
                    Configurez votre Bot Telegram pour recevoir des notifications en temps réel lors des ventes, des ruptures de stock ou des rejets de reçus.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Telegram Bot Token (API Key)</label>
                      <input
                        type="text"
                        placeholder="Ex: 123456789:ABCdefGhIJKlmNoPQRsT"
                        value={db.config.telegramBotToken || ""}
                        onChange={(e) => setDb({
                          ...db,
                          config: { ...db.config, telegramBotToken: e.target.value }
                        })}
                        className="w-full bg-white border border-slate-200 focus:border-slate-800 rounded-lg p-2.5 text-sm outline-hidden font-mono text-xs text-slate-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Telegram Chat ID (Canal, Groupe, Perso)</label>
                      <input
                        type="text"
                        placeholder="Ex: -100123456789 (canal) ou 987654321"
                        value={db.config.telegramChatId || ""}
                        onChange={(e) => setDb({
                          ...db,
                          config: { ...db.config, telegramChatId: e.target.value }
                        })}
                        className="w-full bg-white border border-slate-200 focus:border-slate-800 rounded-lg p-2.5 text-sm outline-hidden font-mono text-xs text-slate-500"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2.5 rounded-lg cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  Sauvegarder les configurations
                </button>
              </form>
            </div>
          )}

        </div>
      </div>

      {/* Expanded Receipt Screenshot Modal Overlay */}
      {expandedImage && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 select-none"
          onClick={() => setExpandedImage(null)}
        >
          <div className="relative max-w-lg w-full max-h-[85vh] flex items-center justify-center bg-transparent rounded-2xl overflow-hidden shadow-2xl border border-white/10 p-2">
            <button
              onClick={() => setExpandedImage(null)}
              className="absolute top-4 right-4 bg-slate-900/80 hover:bg-slate-900 text-white p-2 rounded-full cursor-pointer transition-transform duration-100 active:scale-95"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={expandedImage}
              alt="Receipt complete view"
              className="max-w-full max-h-[80vh] object-contain rounded-xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
