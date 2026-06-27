import { useState, useEffect } from "react";
import { Copy, Check, ShieldCheck, ShieldAlert, Clock, AlertCircle, MessageCircle } from "lucide-react";

interface StatusModalProps {
  transactionId: string;
  onClose: () => void;
}

export default function StatusModal({ transactionId, onClose }: StatusModalProps) {
  const [status, setStatus] = useState<"pending" | "approved" | "rejected">("pending");
  const [deliveredItem, setDeliveredItem] = useState<string | null>(null);
  const [isPendingManualDelivery, setIsPendingManualDelivery] = useState(false);
  const [productName, setProductName] = useState("");
  
  const [copied, setCopied] = useState(false);
  const [loaderMessage, setLoaderMessage] = useState("Vérification de la transaction...");
  const [pollingErrorCount, setPollingErrorCount] = useState(0);

  // Prevent user from re-loading or navigating away easily
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "Votre commande est en cours de traitement automatique. Si vous quittez ou actualisez la page, vous risquez de perturber la livraison.";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  // Poll transaction status
  useEffect(() => {
    let active = true;
    const intervalId = setInterval(() => {
      if (!active) return;

      fetch(`/api/transaction/${transactionId}`)
        .then((res) => {
          if (!res.ok) throw new Error("Server error");
          return res.json();
        })
        .then((data) => {
          setPollingErrorCount(0);
          setProductName(data.productName || "");
          setStatus(data.status);
          setDeliveredItem(data.deliveredItem);
          setIsPendingManualDelivery(data.isPendingManualDelivery || false);

          if (data.status === "approved" || data.status === "rejected") {
            clearInterval(intervalId);
          }
        })
        .catch((err) => {
          console.error("Polling error:", err);
          setPollingErrorCount((prev) => prev + 1);
        });
    }, 3000);

    // Dynamic messaging on loading screen
    const messages = [
      "Vérification de la validité de la transaction...",
      "Analyse sécurisée du reçu en cours...",
      "Traitement de votre commande en arrière-plan...",
      "Veuillez patienter, la livraison automatique approche...",
      "Presque fini... Merci de ne pas actualiser la page."
    ];
    let msgIndex = 0;
    const msgIntervalId = setInterval(() => {
      msgIndex = (msgIndex + 1) % messages.length;
      setLoaderMessage(messages[msgIndex]);
    }, 5000);

    return () => {
      active = false;
      clearInterval(intervalId);
      clearInterval(msgIntervalId);
    };
  }, [transactionId]);

  const handleCopy = () => {
    if (!deliveredItem) return;
    navigator.clipboard.writeText(deliveredItem);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden p-8 flex flex-col items-center text-center border border-slate-100">
        
        {/* PENDING / PROCESSING STATE - AUTOMATIC ROBOT */}
        {status === "pending" && !isPendingManualDelivery && (
          <div className="py-8 space-y-6">
            {/* Spinning Loader Ring */}
            <div className="relative flex items-center justify-center w-24 h-24 mx-auto">
              <div className="absolute w-20 h-20 border-4 border-slate-100 rounded-full" />
              <div className="absolute w-20 h-20 border-4 border-slate-900 border-t-transparent rounded-full animate-spin" />
              <Clock className="w-8 h-8 text-slate-800 animate-pulse" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-bold text-slate-950">Traitement en cours</h3>
              <p className="text-sm font-semibold text-slate-500 max-w-xs mx-auto">
                {loaderMessage}
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl text-amber-800 text-xs leading-relaxed max-w-sm text-left font-medium">
              <span className="font-bold flex items-center gap-1.5 text-amber-900 uppercase tracking-wide mb-1">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-700" />
                Attention
              </span>
              Ne fermez pas et n'actualisez pas cette fenêtre. Notre robot vérifie la transaction et vous livrera dès validation.
            </div>

            {pollingErrorCount > 3 && (
              <p className="text-xs text-rose-500 italic">
                Légère latence réseau détectée, reconnexion automatique en cours...
              </p>
            )}
          </div>
        )}

        {/* PENDING / PROCESSING STATE - MANUAL TEAM TAKE OVER */}
        {status === "pending" && isPendingManualDelivery && (
          <div className="py-6 space-y-6 w-full flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 mb-1 animate-pulse">
              <Clock className="w-9 h-9 animate-spin" style={{ animationDuration: '4s' }} />
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-slate-950">Vérification Manuelle</h3>
              <p className="text-sm font-semibold text-blue-800">
                Un agent vérifie votre reçu actuellement
              </p>
            </div>

            <p className="text-sm text-slate-500 leading-relaxed text-left bg-slate-50 p-4.5 rounded-2xl border border-slate-100 font-medium">
              Votre reçu de paiement a bien été enregistré. 
              <br /><br />
              Comme le robot automatique prend un peu plus de temps ou est indisponible, <strong>un de nos agents du support technique prend le relais immédiatement pour valider votre transaction</strong>.
              <br /><br />
              Veuillez <span className="underline font-bold text-slate-900">laisser cette page ouverte</span>. Dès que l'agent valide votre paiement depuis son panneau d'administration, votre produit s'affichera instantanément ici.
            </p>

            <div className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-400 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              Notification envoyée aux administrateurs...
            </div>

            <a
              href="https://t.me/rodiA2Di"
              target="_blank"
              rel="noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-600 text-white font-bold py-3.5 rounded-xl transition-all cursor-pointer shadow-md"
            >
              <MessageCircle className="w-4.5 h-4.5" />
              Contacter le support Telegram
            </a>
          </div>
        )}

        {/* APPROVED & DELIVERED STATE */}
        {status === "approved" && !isPendingManualDelivery && deliveredItem && (
          <div className="py-6 space-y-6 w-full">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-1 animate-bounce">
              <ShieldCheck className="w-9 h-9" />
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-slate-950">Paiement Validé !</h3>
              <p className="text-sm text-slate-500">
                Votre transaction a été approuvée par notre système sécurisé. Voici vos accès pour <strong>{productName}</strong>.
              </p>
            </div>

            {/* Delivered Product Box */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4.5 text-left relative group">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Votre Produit</span>
              <div className="font-mono text-sm text-slate-800 break-all pr-12 bg-white p-3.5 rounded-xl border border-slate-100 select-all leading-relaxed whitespace-pre-line font-medium">
                {deliveredItem}
              </div>

              <button
                onClick={handleCopy}
                className="absolute right-7 top-13 p-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors cursor-pointer"
                title="Copier les détails"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <p className="text-xs text-slate-400 italic">
              Nous vous recommandons de copier ces accès de suite. Un récapitulatif a été également archivé pour votre email.
            </p>

            <button
              onClick={onClose}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 rounded-xl transition-all active:scale-98 cursor-pointer shadow-md"
            >
              Fermer et retourner au site
            </button>
          </div>
        )}

        {/* APPROVED BUT RUPTURE DE STOCK (PENDING MANUAL DELIVERY) */}
        {status === "approved" && isPendingManualDelivery && (
          <div className="py-6 space-y-6 w-full">
            <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 mb-1 animate-pulse">
              <Clock className="w-9 h-9" />
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-slate-950">Paiement Approuvé</h3>
              <p className="text-sm font-semibold text-amber-800">
                Commande en cours de préparation immédiate
              </p>
            </div>

            <p className="text-sm text-slate-500 leading-relaxed text-left bg-slate-50 p-4.5 rounded-2xl border border-slate-100 font-medium">
              Félicitations, votre paiement est bien validé ! 
              Notre stock de livraison automatique pour <strong>{productName}</strong> est momentanément épuisé.
              <br /><br />
              <strong className="text-slate-800">Pas de panique !</strong> Nos agents préparent et rechargent votre produit manuellement en priorité. 
              Veuillez <span className="underline font-bold text-slate-900">laisser cette page ouverte</span>. Votre produit s'affichera directement ici d'ici quelques minutes.
            </p>

            <div className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-400 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Traitement par notre support technique en cours...
            </div>

            <a
              href="https://t.me/rodiA2Di"
              target="_blank"
              rel="noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-600 text-white font-bold py-3.5 rounded-xl transition-all cursor-pointer"
            >
              <MessageCircle className="w-4.5 h-4.5" />
              Contacter le support Telegram
            </a>
          </div>
        )}

        {/* REJECTED STATE */}
        {status === "rejected" && (
          <div className="py-6 space-y-6 w-full">
            <div className="w-16 h-16 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 mb-1">
              <ShieldAlert className="w-9 h-9" />
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-slate-950">Vérification Échouée</h3>
              <p className="text-sm text-slate-500 leading-relaxed max-w-xs mx-auto">
                La validation automatique de votre reçu a été refusée par notre passerelle de vérification.
              </p>
            </div>

            <div className="bg-rose-50/50 border border-rose-100 rounded-2xl p-4.5 text-left text-xs text-rose-800 leading-relaxed font-medium">
              Veuillez vous assurer de :
              <ul className="list-disc list-inside mt-1.5 space-y-1 font-semibold text-rose-950">
                <li>Soumettre la vraie capture finale de succès du transfert.</li>
                <li>Que le montant envoyé correspond au prix du produit.</li>
                <li>Que l'image n'est pas floue ou tronquée.</li>
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-3 w-full">
              <button
                onClick={onClose}
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-3.5 rounded-xl transition-all cursor-pointer text-sm"
              >
                Réessayer
              </button>
              <a
                href="https://t.me/rodiA2Di"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 rounded-xl transition-all cursor-pointer text-sm"
              >
                Support @rodiA2Di
              </a>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
