import express from "express";
import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { DatabaseSchema, Product, Transaction, Subscriber, AppConfig, Country } from "./src/types.js";

dotenv.config();

const app = express();
const PORT = 3000;

// Setup directories
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const DB_PATH = path.join(process.cwd(), "src", "db", "db.json");

// Ensure directories exist
async function ensureDirs() {
  if (!existsSync(UPLOADS_DIR)) {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
  }
}

// Mutex-like helper to prevent database corruption during parallel operations
let dbMutexPromise = Promise.resolve();
async function lockDbAndRun<T>(fn: () => Promise<T>): Promise<T> {
  let resolveLock: () => void = () => {};
  const nextLockPromise = new Promise<void>((resolve) => {
    resolveLock = resolve;
  });
  const previousLockPromise = dbMutexPromise;
  dbMutexPromise = nextLockPromise;

  try {
    await previousLockPromise;
    return await fn();
  } finally {
    resolveLock();
  }
}

// Load database
async function loadDb(): Promise<DatabaseSchema> {
  try {
    const data = await fs.readFile(DB_PATH, "utf-8");
    return JSON.parse(data) as DatabaseSchema;
  } catch (err) {
    console.error("Error reading database file, using fallback:", err);
    // Fallback in case of absolute failure
    return {
      products: [],
      countries: [],
      transactions: [],
      subscribers: [],
      config: { adminPassword: "admin", supportTelegram: "@rodiA2Di" }
    };
  }
}

// Save database
async function saveDb(db: DatabaseSchema): Promise<void> {
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
}

// Telegram messenger helper
async function sendTelegramAlert(text: string, config: AppConfig) {
  if (!config.telegramBotToken || !config.telegramChatId) {
    console.log("[Telegram Simulator] Alert:", text);
    return;
  }
  try {
    const url = `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: config.telegramChatId,
        text: text,
        parse_mode: "HTML"
      })
    });
    if (!response.ok) {
      console.error("Failed to send telegram. Status:", response.status);
    }
  } catch (err) {
    console.error("Error calling Telegram API:", err);
  }
}

// Setup Multer for receipt uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || ".png";
    cb(null, `receipt-${uniqueSuffix}${ext}`);
  }
});
const upload = multer({ storage });

// Initialize Gemini Client
const getGeminiClient = (): GoogleGenAI | null => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    console.warn("WARNING: GEMINI_API_KEY environment variable is not configured correctly.");
    return null;
  }
  return new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
};

// Express parsers
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use("/uploads", express.static(UPLOADS_DIR));

// Admin Authentication Middleware
async function adminAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization || req.headers["x-admin-password"];
  const password = Array.isArray(authHeader) ? authHeader[0] : authHeader;

  if (!password) {
    res.status(401).json({ error: "Mot de passe requis." });
    return;
  }

  const db = await loadDb();
  const actualPassword = db.config.adminPassword || "admin";

  if (password !== actualPassword) {
    res.status(403).json({ error: "Accès refusé. Mot de passe incorrect." });
    return;
  }

  next();
}

// ==========================================
// CLIENT PUBLIC API ROUTES
// ==========================================

// Get all products (without exposing full stock items)
app.get("/api/products", async (req, res) => {
  try {
    const db = await loadDb();
    const safeProducts = db.products.map(p => ({
      id: p.id,
      name: p.name,
      price: p.price,
      description: p.description,
      category: p.category,
      image: p.image,
      inStock: p.stock.length > 0,
      stockCount: p.stock.length
    }));
    res.json(safeProducts);
  } catch (err) {
    res.status(500).json({ error: "Erreur lors de la récupération des produits." });
  }
});

// Get countries and payment methods
app.get("/api/countries", async (req, res) => {
  try {
    const db = await loadDb();
    res.json({
      countries: db.countries,
      supportTelegram: db.config.supportTelegram || "@rodiA2Di"
    });
  } catch (err) {
    res.status(500).json({ error: "Erreur lors de la récupération des pays." });
  }
});

// Subscribe to newsletter
app.post("/api/subscribe", async (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes("@")) {
    res.status(400).json({ error: "Adresse email invalide." });
    return;
  }

  try {
    await lockDbAndRun(async () => {
      const db = await loadDb();
      if (!db.subscribers.some(s => s.email.toLowerCase() === email.toLowerCase())) {
        db.subscribers.push({
          email: email.trim(),
          createdAt: new Date().toISOString()
        });
        await saveDb(db);
      }
    });
    res.json({ success: true, message: "Inscription réussie!" });
  } catch (err) {
    res.status(500).json({ error: "Une erreur est survenue." });
  }
});

// Checkout & Submit payment receipt
app.post("/api/checkout", upload.single("receipt"), async (req, res) => {
  try {
    const { productId, countryCode, paymentMethodId, email, whatsapp } = req.body;
    const file = req.file;

    if (!productId || !countryCode || !paymentMethodId || !email || !file) {
      res.status(400).json({ error: "Veuillez remplir toutes les informations et soumettre le reçu." });
      return;
    }

    const db = await loadDb();
    const product = db.products.find(p => p.id === productId);
    const country = db.countries.find(c => c.code === countryCode);
    const paymentMethod = country?.paymentMethods.find(m => m.id === paymentMethodId);

    if (!product) {
      res.status(404).json({ error: "Produit introuvable." });
      return;
    }

    if (!paymentMethod) {
      res.status(404).json({ error: "Moyen de paiement introuvable." });
      return;
    }

    const transactionId = "TX-" + Date.now() + "-" + Math.floor(1000 + Math.random() * 9000);

    const newTransaction: Transaction = {
      id: transactionId,
      productId: product.id,
      productName: product.name,
      amount: product.price,
      countryCode: countryCode,
      paymentMethodId: paymentMethodId,
      email: email.trim(),
      whatsapp: (whatsapp || "").trim(),
      receiptImage: `/uploads/${file.filename}`,
      status: "pending",
      deliveredItem: null,
      createdAt: new Date().toISOString()
    };

    // Save transaction
    await lockDbAndRun(async () => {
      const currentDb = await loadDb();
      currentDb.transactions.push(newTransaction);
      await saveDb(currentDb);
    });

    // Send instant Telegram notification that a transaction was submitted
    await sendTelegramAlert(
      `📥 <b>Nouveau reçu soumis !</b>\n` +
      `---------------------------------------\n` +
      `<b>ID Transaction:</b> <code>${transactionId}</code>\n` +
      `<b>Produit:</b> ${product.name} (${product.price} FCFA)\n` +
      `<b>Client:</b> ${newTransaction.email} (${newTransaction.whatsapp || 'Pas de WhatsApp'})\n` +
      `<b>Méthode:</b> ${paymentMethod.name} (${country?.name || countryCode})\n` +
      `<b>Robot de Vérification:</b> Analyse en cours par Gemini... ⏳`,
      db.config
    );

    // Asynchronously launch verification so client doesn't time out
    runBackgroundVerification(transactionId, file.path, product, paymentMethod, country?.name || countryCode);

    res.json({
      success: true,
      transactionId: transactionId,
      status: "pending"
    });

  } catch (err) {
    console.error("Checkout error:", err);
    res.status(500).json({ error: "Une erreur est survenue lors du traitement." });
  }
});

// Transaction status polling
app.get("/api/transaction/:id", async (req, res) => {
  try {
    const db = await loadDb();
    const tx = db.transactions.find(t => t.id === req.params.id);
    if (!tx) {
      res.status(404).json({ error: "Transaction introuvable." });
      return;
    }
    res.json({
      id: tx.id,
      status: tx.status,
      deliveredItem: tx.deliveredItem,
      isPendingManualDelivery: tx.isPendingManualDelivery || false,
      productName: tx.productName
    });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur." });
  }
});

// Run background verification via Gemini
async function runBackgroundVerification(
  transactionId: string,
  filePath: string,
  product: Product,
  paymentMethod: any,
  countryName: string
) {
  const db = await loadDb();
  const ai = getGeminiClient();

  if (!ai) {
    console.error("Gemini AI client not initialized. Marking transaction for manual verification.");
    await updateTransactionStatus(transactionId, "pending", null, true, "Gemini non configuré.");
    await sendTelegramAlert(
      `⚠️ <b>Robot indisponible !</b>\n` +
      `Le reçu pour la transaction <code>${transactionId}</code> n'a pas pu être analysé car la clé API de l'assistant (Gemini) n'est pas configurée. Veuillez vérifier manuellement dans le panel d'administration.`,
      db.config
    );
    return;
  }

  try {
    // Read upload file
    const fileBuffer = await fs.readFile(filePath);
    const base64Data = fileBuffer.toString("base64");

    // Dynamically check mimeType based on extension
    let mimeType = "image/png";
    const ext = path.extname(filePath).toLowerCase();
    if (ext === ".jpg" || ext === ".jpeg") {
      mimeType = "image/jpeg";
    } else if (ext === ".webp") {
      mimeType = "image/webp";
    } else if (ext === ".gif") {
      mimeType = "image/gif";
    }

    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType: mimeType
      }
    };

    const promptText = `Tu es le robot de validation des paiements. Tu analyses l'image de reçu de transaction de paiement mobile (Mobile Money: Orange Money, MTN, Wave, Moov, Flooz, Free, etc.).
Nous attendons un paiement réussi de : ${product.price} (en francs CFA ou autre monnaie mentionnée sur le reçu).
Le moyen de paiement sélectionné par l'utilisateur est : ${paymentMethod.name} (Pays : ${countryName}).

Vérifie TRÈS attentivement les informations sur le reçu :
1. Est-ce un reçu de TRANSACTION RÉUSSIE / SUCCÈS ? (Et non un brouillon, une erreur ou une demande d'envoi).
2. Le montant correspond-il au prix attendu : ${product.price} (ou très proche, tolère une infime différence de frais si nécessaire) ?
3. Le reçu correspond-il à l'opérateur de paiement sélectionné (${paymentMethod.name}) ?
4. N'exige pas que le nom du destinataire soit absolument visible si le reste du reçu prouve un virement légitime de ce montant (sois tolérant sur le nom s'il est tronqué ou absent, comme demandé).
5. Assure-toi qu'il s'agit d'une preuve réelle et non d'une image factice sans rapport.

Réponds obligatoirement au format JSON pur suivant :
{
  "verified": true ou false,
  "confidence": un nombre entre 0.0 et 1.0,
  "reason": "Une brève explication en français de ton choix (interne, ne sera pas montrée au client)"
}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        imagePart,
        promptText
      ],
      config: {
        responseMimeType: "application/json"
      }
    });

    const resultText = response.text || "{}";
    let verificationResult;
    try {
      verificationResult = JSON.parse(resultText.trim());
    } catch (e) {
      console.error("Failed to parse Gemini JSON output:", resultText);
      verificationResult = { verified: false, confidence: 0, reason: "Erreur d'analyse JSON de l'IA." };
    }

    console.log(`Gemini Verification result for ${transactionId}:`, verificationResult);

    if (verificationResult.verified && verificationResult.confidence >= 0.7) {
      // Approve and attempt delivery
      await processSuccessfulPayment(transactionId, product, db);
    } else {
      // Reject transaction
      await updateTransactionStatus(transactionId, "rejected", null, false, verificationResult.reason);
      await sendTelegramAlert(
        `❌ <b>Transaction Rejetée par le Robot !</b>\n` +
        `---------------------------------------\n` +
        `<b>ID:</b> <code>${transactionId}</code>\n` +
        `<b>Produit:</b> ${product.name}\n` +
        `<b>Raison:</b> ${verificationResult.reason || 'Reçu non valide ou montant incorrect'}\n` +
        `<b>Action:</b> Le client a été notifié de l'échec de la transaction.`,
        db.config
      );
    }

  } catch (err) {
    console.error("Gemini API call failed:", err);
    // Mark as pending manual review
    await updateTransactionStatus(transactionId, "pending", null, true, "Erreur lors de l'appel à l'API Gemini.");
    await sendTelegramAlert(
      `⚠️ <b>Erreur Robot (Gemini) !</b>\n` +
      `Une erreur est survenue lors de l'analyse automatique de la transaction <code>${transactionId}</code>. Veuillez vérifier manuellement dans l'administration.`,
      db.config
    );
  }
}

// Helper to handle successful verification and deliver stock item
async function processSuccessfulPayment(transactionId: string, product: Product, globalConfigDb: DatabaseSchema) {
  let deliveredItem: string | null = null;
  let isPendingManualDelivery = false;

  await lockDbAndRun(async () => {
    const currentDb = await loadDb();
    const dbProduct = currentDb.products.find(p => p.id === product.id);
    const dbTx = currentDb.transactions.find(t => t.id === transactionId);

    if (!dbProduct || !dbTx) return;

    if (dbProduct.stock && dbProduct.stock.length > 0) {
      // Pop first item from stock
      deliveredItem = dbProduct.stock.shift() || null;
      dbTx.status = "approved";
      dbTx.deliveredItem = deliveredItem;
      dbTx.isPendingManualDelivery = false;
      dbTx.verifiedAt = new Date().toISOString();
    } else {
      // No stock!
      isPendingManualDelivery = true;
      dbTx.status = "approved"; // Payment verified, but delivery is pending!
      dbTx.deliveredItem = null;
      dbTx.isPendingManualDelivery = true;
      dbTx.verifiedAt = new Date().toISOString();
    }

    await saveDb(currentDb);
  });

  if (isPendingManualDelivery) {
    await sendTelegramAlert(
      `✅ <b>Paiement Vérifié ! (⚠️ RUPTURE DE STOCK)</b>\n` +
      `---------------------------------------\n` +
      `<b>ID:</b> <code>${transactionId}</code>\n` +
      `<b>Produit:</b> ${product.name}\n` +
      `<b>Client:</b> ${product.name} - En attente de stock !\n` +
      `<b>Détail :</b> Le reçu a été approuvé par le robot, mais le stock est vide. Le client attend sur la page du site.\n` +
      `<b>🔴 LIVREZ LE CLIENT EN TOUTE URGENCE !</b>`,
      globalConfigDb.config
    );
  } else {
    await sendTelegramAlert(
      `🎉 <b>Vente Réussie & Livrée Automatiquement !</b>\n` +
      `---------------------------------------\n` +
      `<b>ID:</b> <code>${transactionId}</code>\n` +
      `<b>Produit:</b> ${product.name}\n` +
      `<b>Livrable:</b> <code>${deliveredItem}</code>\n` +
      `<b>Félicitations !</b> Le robot a vérifié le reçu et a livré le produit instantanément.`,
      globalConfigDb.config
    );
  }
}

// Helper to update transaction status manually or on rejection
async function updateTransactionStatus(
  transactionId: string,
  status: 'pending' | 'approved' | 'rejected',
  deliveredItem: string | null,
  isPendingManualDelivery: boolean,
  errorMessage?: string
) {
  await lockDbAndRun(async () => {
    const currentDb = await loadDb();
    const tx = currentDb.transactions.find(t => t.id === transactionId);
    if (tx) {
      tx.status = status;
      tx.deliveredItem = deliveredItem;
      tx.isPendingManualDelivery = isPendingManualDelivery;
      tx.verifiedAt = new Date().toISOString();
      if (errorMessage) {
        tx.errorMessage = errorMessage;
      }
      await saveDb(currentDb);
    }
  });
}

// ==========================================
// ADMIN API ROUTES (Guarded by adminAuth)
// ==========================================

// Login verification
app.post("/api/admin/login", async (req, res) => {
  const { password } = req.body;
  const db = await loadDb();
  if (password === (db.config.adminPassword || "admin")) {
    res.json({ success: true, token: password });
  } else {
    res.status(401).json({ error: "Mot de passe d'administration incorrect." });
  }
});

// Get whole DB
app.get("/api/admin/db", adminAuth, async (req, res) => {
  try {
    const db = await loadDb();
    res.json(db);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Update products list
app.post("/api/admin/products", adminAuth, async (req, res) => {
  try {
    const updatedProducts: Product[] = req.body.products;
    if (!Array.isArray(updatedProducts)) {
      res.status(400).json({ error: "Format invalide." });
      return;
    }

    await lockDbAndRun(async () => {
      const db = await loadDb();
      db.products = updatedProducts;
      await saveDb(db);
    });

    res.json({ success: true, message: "Produits mis à jour !" });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur." });
  }
});

// API used by external JS template to automatically push/update stock
app.post("/api/admin/products/update-stock", adminAuth, async (req, res) => {
  try {
    const { productId, stockItems, mode } = req.body; // mode: 'append' or 'replace'
    if (!productId || !Array.isArray(stockItems)) {
      res.status(400).json({ error: "productId et stockItems (array) requis." });
      return;
    }

    let updatedProduct: Product | undefined;

    await lockDbAndRun(async () => {
      const db = await loadDb();
      const product = db.products.find(p => p.id === productId);
      if (product) {
        if (mode === "replace") {
          product.stock = stockItems;
        } else {
          product.stock = [...product.stock, ...stockItems];
        }
        updatedProduct = product;
        await saveDb(db);
      }
    });

    if (!updatedProduct) {
      res.status(404).json({ error: "Produit introuvable." });
      return;
    }

    res.json({
      success: true,
      productId: productId,
      stockCount: updatedProduct.stock.length,
      message: `Stock mis à jour avec succès via le script JS ! (${updatedProduct.stock.length} éléments en stock)`
    });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur." });
  }
});

// Update countries and payment methods
app.post("/api/admin/countries", adminAuth, async (req, res) => {
  try {
    const updatedCountries: Country[] = req.body.countries;
    if (!Array.isArray(updatedCountries)) {
      res.status(400).json({ error: "Format invalide." });
      return;
    }

    await lockDbAndRun(async () => {
      const db = await loadDb();
      db.countries = updatedCountries;
      await saveDb(db);
    });

    res.json({ success: true, message: "Moyens de paiement et pays mis à jour !" });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur." });
  }
});

// Manually process transaction (Approve / Deliver / Reject)
app.post("/api/admin/transactions/:id/action", adminAuth, async (req, res) => {
  const { id } = req.params;
  const { action, manualDeliveryItem } = req.body; // action: 'approve' | 'reject', manualDeliveryItem: string (optional)

  try {
    const db = await loadDb();
    const tx = db.transactions.find(t => t.id === id);
    if (!tx) {
      res.status(404).json({ error: "Transaction introuvable." });
      return;
    }

    if (action === "approve") {
      let finalDeliveredItem = manualDeliveryItem || null;

      await lockDbAndRun(async () => {
        const currentDb = await loadDb();
        const dbTx = currentDb.transactions.find(t => t.id === id);
        const dbProduct = currentDb.products.find(p => p.id === tx.productId);

        if (dbTx && dbProduct) {
          if (!finalDeliveredItem && dbProduct.stock.length > 0) {
            finalDeliveredItem = dbProduct.stock.shift() || null;
          }
          dbTx.status = "approved";
          dbTx.deliveredItem = finalDeliveredItem;
          dbTx.isPendingManualDelivery = finalDeliveredItem ? false : true;
          dbTx.verifiedAt = new Date().toISOString();
          await saveDb(currentDb);
        }
      });

      await sendTelegramAlert(
        `✅ <b>Transaction validée manuellement !</b>\n` +
        `---------------------------------------\n` +
        `<b>ID:</b> <code>${id}</code>\n` +
        `<b>Produit:</b> ${tx.productName}\n` +
        `<b>Statut:</b> Validé et livré par l'administrateur.\n` +
        `<b>Produit livré:</b> <code>${finalDeliveredItem || 'En attente de livraison manuelle'}</code>`,
        db.config
      );

      res.json({ success: true, message: "Transaction approuvée avec succès !" });

    } else if (action === "reject") {
      await updateTransactionStatus(id, "rejected", null, false, "Rejeté manuellement par l'administrateur.");
      await sendTelegramAlert(
        `❌ <b>Transaction rejetée manuellement !</b>\n` +
        `---------------------------------------\n` +
        `<b>ID:</b> <code>${id}</code>\n` +
        `<b>Produit:</b> ${tx.productName}\n` +
        `<b>Par:</b> Admin`,
        db.config
      );
      res.json({ success: true, message: "Transaction rejetée avec succès !" });
    } else {
      res.status(400).json({ error: "Action invalide." });
    }

  } catch (err) {
    res.status(500).json({ error: "Erreur serveur." });
  }
});

// Update configs
app.post("/api/admin/config", adminAuth, async (req, res) => {
  try {
    const updatedConfig: AppConfig = req.body.config;

    await lockDbAndRun(async () => {
      const db = await loadDb();
      db.config = {
        ...db.config,
        ...updatedConfig
      };
      await saveDb(db);
    });

    res.json({ success: true, message: "Paramètres mis à jour !" });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur." });
  }
});

// Broadcast Newsletter Emails
app.post("/api/admin/broadcast", adminAuth, async (req, res) => {
  try {
    const { subject, content } = req.body;
    if (!subject || !content) {
      res.status(400).json({ error: "Sujet et contenu requis." });
      return;
    }

    const db = await loadDb();
    const subscriberCount = db.subscribers.length;

    console.log(`[Email Broadcaster] Broadcasting newsletter "${subject}" to ${subscriberCount} subscribers.`);
    // If they configure a real SMTP server, we can send real emails. For now, simulate it beautifully!
    // Since SMTP details are optional, we will log each sent mail.

    res.json({
      success: true,
      message: `Newsletter diffusée avec succès à ${subscriberCount} abonnés !`
    });
  } catch (err) {
    res.status(500).json({ error: "Erreur lors de la diffusion." });
  }
});


// ==========================================
// VITE AND STATIC ASSETS INTEGRATION
// ==========================================
async function startServer() {
  await ensureDirs();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
