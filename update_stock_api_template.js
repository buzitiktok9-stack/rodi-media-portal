/**
 * TEMPLATE DE SCRIPT JS POUR METTRE À JOUR LE STOCK AUTOMATIQUEMENT
 * 
 * Ce script permet d'ajouter ou de remplacer des éléments de stock (licences, comptes, fichiers)
 * pour un produit spécifique en appelant de manière sécurisée l'API de votre site.
 * 
 * Prérequis:
 * 1. Node.js installé sur votre machine.
 * 2. Remplacez l'URL, le mot de passe admin, l'ID du produit et vos éléments de stock ci-dessous.
 * 
 * Pour exécuter ce script:
 *   node update_stock_api_template.js
 */

// CONFIGURATION
const SITE_URL = "https://votre-site-sur-render.com"; // URL de votre site hébergé (ex: sur Render ou local: http://localhost:3000)
const ADMIN_PASSWORD = "admin"; // Votre mot de passe admin configuré sur le site
const PRODUCT_ID = "prod-1"; // L'ID du produit à mettre à jour (ex: prod-1 pour Netflix)

// VOS NOUVEAUX ÉLÉMENTS DE STOCK
// Chaque élément de la liste représente un produit livrable (un compte, un code, ou un lien)
const NEW_STOCK_ITEMS = [
  "Email: netflix.auto33@gmail.com | MDP: AutoPass99! | Écran: 2 | PIN: 1234",
  "Email: netflix.auto44@gmail.com | MDP: SecureAuto10$ | Écran: 1 | PIN: 8890"
];

// MODE DE MISE À JOUR :
// - "append" : Ajoute ces nouveaux éléments à la suite du stock existant.
// - "replace" : Écrase le stock actuel par cette nouvelle liste.
const UPDATE_MODE = "append"; 

async function updateStock() {
  const url = `${SITE_URL.replace(/\/$/, "")}/api/admin/products/update-stock`;

  const payload = {
    productId: PRODUCT_ID,
    stockItems: NEW_STOCK_ITEMS,
    mode: UPDATE_MODE
  };

  console.log(`[Stock Updater] Envoi de la mise à jour pour le produit "${PRODUCT_ID}"...`);
  console.log(`[Stock Updater] Nombre d'éléments envoyés: ${NEW_STOCK_ITEMS.length}`);
  console.log(`[Stock Updater] Mode sélectionné: ${UPDATE_MODE}`);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Envoi du mot de passe admin pour l'authentification sécurisée
        "Authorization": ADMIN_PASSWORD 
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (response.ok) {
      console.log("\n✅ SUCCÈS ! Le stock a été mis à jour.");
      console.log(`ID Produit: ${data.productId}`);
      console.log(`Nouveau total en stock: ${data.stockCount} éléments.`);
      console.log(`Message du serveur: ${data.message}`);
    } else {
      console.error(`\n❌ ÉCHEC : ${data.error || "Une erreur inconnue est survenue."}`);
    }
  } catch (error) {
    console.error("\n❌ ERREUR DE CONNEXION :", error.message);
    console.error("Veuillez vérifier l'URL de votre site et assurez-vous qu'il est en ligne.");
  }
}

// Lancement de la mise à jour
updateStock();
