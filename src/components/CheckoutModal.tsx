import React, { useState, useEffect } from "react";
import { Product, Country, PaymentMethod } from "../types";
import { X, ArrowRight, ArrowLeft, Upload, Send, AlertTriangle, Phone, Mail, HelpCircle } from "lucide-react";

interface CheckoutModalProps {
  product: Product;
  onClose: () => void;
  onCheckoutSuccess: (transactionId: string) => void;
}

export default function CheckoutModal({ product, onClose, onCheckoutSuccess }: CheckoutModalProps) {
  const [countries, setCountries] = useState<Country[]>([]);
  const [supportTelegram, setSupportTelegram] = useState("@rodiA2Di");
  const [loadingCountries, setLoadingCountries] = useState(true);

  // Form states
  const [currentStep, setCurrentStep] = useState(1); // 1: Country, 2: Payment, 3: Proof
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    // Fetch countries and configs
    fetch("/api/countries")
      .then((res) => res.json())
      .then((data) => {
        setCountries(data.countries || []);
        setSupportTelegram(data.supportTelegram || "@rodiA2Di");
        setLoadingCountries(false);
      })
      .catch((err) => {
        console.error("Error loading countries:", err);
        setLoadingCountries(false);
      });
  }, []);

  const handleCountrySelect = (country: Country) => {
    setSelectedCountry(country);
    setSelectedMethod(null);
    setCurrentStep(2);
  };

  const handleMethodSelect = (method: PaymentMethod) => {
    setSelectedMethod(method);
    setCurrentStep(3);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setErrorMessage("Veuillez sélectionner uniquement une image (PNG, JPG ou JPEG).");
      return;
    }
    setErrorMessage("");
    setReceiptFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setReceiptPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCountry || !selectedMethod || !email || !receiptFile) {
      setErrorMessage("Veuillez remplir toutes les informations requises.");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");

    const formData = new FormData();
    formData.append("productId", product.id);
    formData.append("countryCode", selectedCountry.code);
    formData.append("paymentMethodId", selectedMethod.id);
    formData.append("email", email);
    formData.append("whatsapp", whatsapp);
    formData.append("receipt", receiptFile);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (response.ok && data.success) {
        onCheckoutSuccess(data.transactionId);
      } else {
        setErrorMessage(data.error || "Une erreur est survenue lors de la soumission.");
        setSubmitting(false);
      }
    } catch (err) {
      console.error("Submit checkout error:", err);
      setErrorMessage("Impossible de se connecter au serveur. Veuillez réessayer.");
      setSubmitting(false);
    }
  };

  // Helper to render provider logo
  const renderLogo = (logoType: string) => {
    const commonClasses = "w-10 h-10 rounded-full flex items-center justify-center font-bold text-white uppercase text-xs";
    switch (logoType.toLowerCase()) {
      case "orange":
        return <div className={`${commonClasses} bg-orange-500`}>OM</div>;
      case "mtn":
        return <div className={`${commonClasses} bg-yellow-400 text-slate-900`}>MTN</div>;
      case "moov":
        return <div className={`${commonClasses} bg-blue-600`}>MOOV</div>;
      case "wave":
        return <div className={`${commonClasses} bg-sky-400`}>W</div>;
      case "payeer":
        return <div className={`${commonClasses} bg-slate-800`}>PR</div>;
      case "perfect_money":
        return <div className={`${commonClasses} bg-red-600`}>PM</div>;
      default:
        return <div className={`${commonClasses} bg-slate-400`}>PAY</div>;
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col relative my-8">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Commande en cours</span>
            <h2 className="text-lg font-bold text-slate-800 line-clamp-1">{product.name}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 flex-1 overflow-y-auto">
          {/* Progress Indicators */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <span className={`w-2.5 h-2.5 rounded-full ${currentStep >= 1 ? "bg-slate-900" : "bg-slate-200"}`} />
            <span className="w-6 h-[2px] bg-slate-200" />
            <span className={`w-2.5 h-2.5 rounded-full ${currentStep >= 2 ? "bg-slate-900" : "bg-slate-200"}`} />
            <span className="w-6 h-[2px] bg-slate-200" />
            <span className={`w-2.5 h-2.5 rounded-full ${currentStep >= 3 ? "bg-slate-900" : "bg-slate-200"}`} />
          </div>

          {errorMessage && (
            <div className="mb-4 p-4.5 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-sm flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* STEP 1: CHOOSE COUNTRY */}
          {currentStep === 1 && (
            <div>
              <h3 className="text-base font-semibold text-slate-800 mb-4 text-center">
                Choisissez votre pays de résidence
              </h3>
              
              {loadingCountries ? (
                <div className="py-8 text-center text-slate-400 text-sm">Chargement des options de paiement...</div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {countries.map((country) => (
                    <button
                      key={country.code}
                      onClick={() => handleCountrySelect(country)}
                      className="flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 border border-slate-100 hover:border-slate-200 rounded-xl transition-all cursor-pointer text-left font-medium text-slate-800"
                    >
                      <span className="flex items-center gap-3">
                        <span className="text-lg bg-white shadow-xs px-2.5 py-1 rounded border border-slate-100">
                          {country.code === "BF" && "🇧🇫"}
                          {country.code === "CI" && "🇨🇮"}
                          {country.code === "SN" && "🇸🇳"}
                          {country.code === "ML" && "🇲🇱"}
                          {country.code === "GL" && "🌐"}
                        </span>
                        {country.name}
                      </span>
                      <ArrowRight className="w-4 h-4 text-slate-400" />
                    </button>
                  ))}

                  {/* Manual/Other country support */}
                  <div className="mt-4 p-4 bg-amber-50/50 border border-amber-100 rounded-xl text-amber-800 text-sm">
                    <p className="flex items-start gap-2.5">
                      <HelpCircle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
                      <span>
                        Votre pays n'est pas répertorié ? Contactez directement notre support sur Telegram 
                        <a 
                          href={`https://t.me/${supportTelegram.replace("@", "")}`} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="font-bold underline text-amber-900 ml-1 block sm:inline hover:text-amber-700"
                        >
                          {supportTelegram}
                        </a> pour effectuer votre paiement et finaliser l'achat.
                      </span>
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: CHOOSE PAYMENT METHOD */}
          {currentStep === 2 && selectedCountry && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <button
                  onClick={() => setCurrentStep(1)}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-medium text-slate-400">
                  Pays : <strong className="text-slate-700">{selectedCountry.name}</strong>
                </span>
              </div>

              <h3 className="text-base font-semibold text-slate-800 mb-4 text-center">
                Choisissez votre moyen de paiement
              </h3>

              <div className="grid grid-cols-1 gap-2">
                {selectedCountry.paymentMethods.map((method) => (
                  <button
                    key={method.id}
                    onClick={() => handleMethodSelect(method)}
                    className="flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 border border-slate-100 hover:border-slate-200 rounded-xl transition-all cursor-pointer text-left"
                  >
                    <span className="flex items-center gap-3.5">
                      {renderLogo(method.logo)}
                      <span>
                        <span className="font-semibold text-slate-800 block">{method.name}</span>
                        <span className="text-xs text-slate-500 line-clamp-1">{method.number}</span>
                      </span>
                    </span>
                    <ArrowRight className="w-4 h-4 text-slate-400" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3: TRANSACTION PAYMENT & PROOF SUBMISSION */}
          {currentStep === 3 && selectedCountry && selectedMethod && (
            <form onSubmit={handleSubmit}>
              <div className="flex items-center gap-2 mb-4">
                <button
                  onClick={() => setCurrentStep(2)}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
                  disabled={submitting}
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-medium text-slate-400">
                  Méthode : <strong className="text-slate-700">{selectedMethod.name}</strong>
                </span>
              </div>

              {/* Account Details Box */}
              <div className="p-5 bg-slate-900 text-white rounded-2xl mb-5 space-y-3.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
                  INFORMATIONS DE PAIEMENT
                </span>

                <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-sm border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-xs text-slate-500 block">Numéro de transfert</span>
                    <strong className="text-base font-mono">{selectedMethod.number}</strong>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Nom du bénéficiaire</span>
                    <strong className="text-base">{selectedMethod.holder}</strong>
                  </div>
                </div>

                <div>
                  <span className="text-xs text-slate-500 block mb-1">Instructions de transfert</span>
                  <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/40 p-3 rounded-lg border border-slate-800">
                    {selectedMethod.instructions}
                  </p>
                </div>

                <div className="bg-slate-950/80 rounded-lg p-3 text-center border border-slate-800">
                  <span className="text-xs text-slate-400">Montant exact à envoyer</span>
                  <div className="text-lg font-bold text-white font-sans mt-0.5">
                    {product.price.toLocaleString("fr-FR")} FCFA
                  </div>
                </div>
              </div>

              {/* Customer Inputs */}
              <div className="space-y-4 mb-5">
                <div>
                  <label htmlFor="email" className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                    Adresse Email (Pour recevoir vos produits) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      id="email"
                      type="email"
                      required
                      placeholder="exemple@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={submitting}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-slate-800 focus:bg-white rounded-xl py-3 pl-11 pr-4 text-sm font-medium outline-hidden transition-all text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="whatsapp" className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                    Numéro WhatsApp (Optionnel - Pour le support)
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      id="whatsapp"
                      type="tel"
                      placeholder="+226 70 00 00 00"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      disabled={submitting}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-slate-800 focus:bg-white rounded-xl py-3 pl-11 pr-4 text-sm font-medium outline-hidden transition-all text-slate-900"
                    />
                  </div>
                </div>

                {/* Receipt Upload Area */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                    Photo du Reçu de Transaction <span className="text-rose-500">*</span>
                  </label>

                  <input
                    id="receiptInput"
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    disabled={submitting}
                    className="hidden"
                  />

                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => document.getElementById("receiptInput")?.click()}
                    className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[140px] ${
                      dragActive
                        ? "border-slate-900 bg-slate-50"
                        : receiptPreview
                        ? "border-emerald-300 bg-emerald-50/20"
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {/* Preview Block */}
                    <div className={`w-full flex-col items-center gap-2 ${receiptPreview ? "flex" : "hidden"}`}>
                      <img
                        src={receiptPreview || ""}
                        alt="Receipt preview"
                        className="max-h-24 rounded-lg object-contain shadow-xs border border-slate-200"
                      />
                      <span className="text-xs font-medium text-emerald-700">
                        {receiptFile?.name} (Modifier)
                      </span>
                    </div>

                    {/* Placeholder Block */}
                    <div className={`flex-col items-center ${receiptPreview ? "hidden" : "flex"}`}>
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mb-2.5">
                        <Upload className="w-5 h-5" />
                      </div>
                      <p className="text-sm font-semibold text-slate-700">
                        Glissez-déposez le reçu ici
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        ou cliquez pour parcourir votre appareil
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={submitting || !receiptFile || !email}
                className="w-full inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 text-white disabled:text-slate-400 font-semibold py-3.5 rounded-xl transition-all active:scale-98 shadow-md cursor-pointer disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-slate-400 border-t-white rounded-full animate-spin" />
                    Enregistrement de la commande...
                  </>
                ) : (
                  <>
                    <Send className="w-4.5 h-4.5" />
                    Confirmer & Soumettre Reçu
                  </>
                )}
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
