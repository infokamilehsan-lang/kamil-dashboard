import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { initialShops } from '../data/initialData';
import { notify } from './NotificationContext';
import { tStatic } from './LanguageContext';

// Returns local date string "YYYY-MM-DD" matching the user's wall-clock day (not UTC)
const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const STORAGE_KEY = 'dashboard_shops';
const ACTIVE_KEY = 'dashboard_activeShopId';
const BRAND_KEY = 'dashboard_brand';
const CONTACTS_KEY = 'email_saved_contacts';
const EMAIL_SETTINGS_KEY = 'email_notification_settings';
const PENDING_KEY = 'dashboard_pendingWrite'; // set when local has un-synced changes

function localLoadBrand() {
  try { const r = localStorage.getItem(BRAND_KEY); if (r) return JSON.parse(r); } catch { }
  return { name: 'ShopManager', image: '' };
}
function localSaveBrand(brand) {
  try { localStorage.setItem(BRAND_KEY, JSON.stringify(brand)); } catch { }
}

const DEFAULT_EMAIL_SETTINGS = { enabled: true, ownerEmail: 'infokamilstoreitalia@gmail.com' };

function localLoadContacts() {
  try { const r = localStorage.getItem(CONTACTS_KEY); if (r) return JSON.parse(r); } catch { }
  return [];
}
function localSaveContacts(contacts) {
  try { localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts)); } catch { }
}
function localLoadEmailSettings() {
  try { const r = localStorage.getItem(EMAIL_SETTINGS_KEY); if (r) return JSON.parse(r); } catch { }
  return DEFAULT_EMAIL_SETTINGS;
}
function localSaveEmailSettings(settings) {
  try { localStorage.setItem(EMAIL_SETTINGS_KEY, JSON.stringify(settings)); } catch { }
}

// ── Local cache helpers ───────────────────────────────────────
const DEMO_NAMES = new Set(['Barbiere del Re', 'TechZone Elettronica', 'Bella Cucina Ristorante']);
function localLoadShops() {
  try {
    const r = localStorage.getItem(STORAGE_KEY);
    if (r) {
      const parsed = JSON.parse(r);
      return parsed.filter(s => !DEMO_NAMES.has(s.name));
    }
  } catch { }
  return initialShops;
}
function localLoadActiveId(shops) {
  try { const id = localStorage.getItem(ACTIVE_KEY); if (id && shops.find(s => s.id === id)) return id; } catch { }
  return shops[0]?.id;
}
function localSave(shops, activeShopId, markPending = true) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(shops));
    localStorage.setItem(ACTIVE_KEY, activeShopId);
    if (markPending) {
      localStorage.setItem(PENDING_KEY, '1');
    } else {
      localStorage.removeItem(PENDING_KEY);
    }
  } catch { }
}

// Stable JSON for echo-detection: sort by id so array order doesn't matter
function shopsJson(arr) {
  return JSON.stringify([...arr].sort((a, b) => (a.id < b.id ? -1 : 1)));
}

const ShopContext = createContext(null);

// ── MySQL REST API ────────────────────────────────────────────
// Set VITE_API_URL in .env to point at your backend server.
// Default: http://localhost:3001 (local dev)
const API_URL = (import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3001`).replace(/\/$/, '');

function apiToken() {
  return localStorage.getItem('kamil_auth_token') || null;
}

async function apiFetch(path, method, body) {
  const token = apiToken();
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) throw new Error(`API ${method} ${path} → ${res.status}`);
  return res.json();
}

const DEFAULT_BRAND = { name: 'ShopManager', image: '' };

export function ShopProvider({ children }) {
  const { user } = useAuth();
  const [shops, setShops] = useState(() => localLoadShops());
  const [activeShopId, setActiveShopId] = useState(() => localLoadActiveId(localLoadShops()));
  const [brand, setBrand] = useState(() => localLoadBrand());
  const [syncStatus, setSyncStatus] = useState('syncing');
  const [syncTrigger, setSyncTrigger] = useState(0);
  const saveTimer = useRef(null);
  const brandSaveTimer = useRef(null);
  const lastWrittenShopsJson = useRef('');
  const lastWrittenBrandJson = useRef('');
  const initialized = useRef(false);
  const flushNow = useRef(false);
  const shopsRef = useRef(shops);
  shopsRef.current = shops;
  const pollTimer = useRef(null);

  // ── Load from API — always use server as source of truth ──
  useEffect(() => {
    if (!user) return;
    initialized.current = false;
    clearTimeout(saveTimer.current);
    clearTimeout(brandSaveTimer.current);
    clearInterval(pollTimer.current);

    async function fetchFromServer(isInitial = false) {
      try {
        const { shops: remoteShops, brand: remoteBrand } = await apiFetch('/api/all', 'GET', undefined);
        // After the async fetch, re-check if local edits happened while we were waiting.
        // Skip overwrite unless this is the first load (initial must always apply).
        if (!isInitial && localStorage.getItem(PENDING_KEY) === '1') {
          if (!initialized.current) initialized.current = true;
          return;
        }
        const filtered = (remoteShops || [])
          .filter(s => !DEMO_NAMES.has(s.name))
          .map(s => ({
            ...s,
            contacts: s.contacts || [],
            emailSettings: s.emailSettings || DEFAULT_EMAIL_SETTINGS,
          }));
        // Server is always the source of truth — overwrite local
        setShops(filtered);
        setActiveShopId(prev => {
          const exists = filtered.some(s => s.id === prev);
          return exists ? prev : (filtered[0]?.id || prev);
        });
        setBrand(remoteBrand || DEFAULT_BRAND);
        localSave(filtered, localStorage.getItem(ACTIVE_KEY) || filtered[0]?.id, false);
        localSaveBrand(remoteBrand || DEFAULT_BRAND);
        lastWrittenShopsJson.current = shopsJson(filtered);
        lastWrittenBrandJson.current = JSON.stringify(remoteBrand || DEFAULT_BRAND);
        initialized.current = true;
        setSyncStatus('saved');
      } catch (err) {
        console.error('[ShopContext] Load from API failed:', err);
        setSyncStatus('offline');
        initialized.current = true;
      }
    }

    fetchFromServer(true);

    // Poll every 5s — instant sync across all devices
    pollTimer.current = setInterval(async () => {
      if (localStorage.getItem(PENDING_KEY) === '1') return; // skip if write in-flight
      try {
        const { shops: remoteShops, brand: remoteBrand } = await apiFetch('/api/all', 'GET', undefined);
        const filtered = (remoteShops || [])
          .filter(s => !DEMO_NAMES.has(s.name))
          .map(s => ({
            ...s,
            contacts: s.contacts || [],
            emailSettings: s.emailSettings || DEFAULT_EMAIL_SETTINGS,
          }));
        const incoming = shopsJson(filtered);
        if (incoming === lastWrittenShopsJson.current) return; // nothing changed

        setShops(filtered);
        setActiveShopId(prev => {
          const exists = filtered.some(s => s.id === prev);
          return exists ? prev : (filtered[0]?.id || prev);
        });
        if (remoteBrand) { setBrand(remoteBrand); localSaveBrand(remoteBrand); }
        localSave(filtered, localStorage.getItem(ACTIVE_KEY) || filtered[0]?.id, false);
        lastWrittenShopsJson.current = incoming;
        setSyncStatus('saved');
      } catch { /* ignore poll errors */ }
    }, 5_000);

    // Instant refresh when user switches back to the tab/app
    // BUT skip if there are pending local writes to avoid overwriting user edits
    function handleVisibility() {
      if (document.visibilityState === 'visible' && localStorage.getItem(PENDING_KEY) !== '1') {
        fetchFromServer();
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearTimeout(saveTimer.current);
      clearTimeout(brandSaveTimer.current);
      clearInterval(pollTimer.current);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user]);

  // ── Write shops to MySQL (per-shop delta) ─────────────────
  useEffect(() => {
    if (!user) return;

    const currentJson = shopsJson(shops);
    if (currentJson === lastWrittenShopsJson.current) return;

    localSave(shops, activeShopId, true);
    if (!initialized.current) return;

    setSyncStatus('syncing');
    clearTimeout(saveTimer.current);
    const delay = flushNow.current ? 50 : 800;
    flushNow.current = false;

    saveTimer.current = setTimeout(async () => {
      try {
        let prevShops = [];
        try { prevShops = JSON.parse(lastWrittenShopsJson.current) || []; } catch { }
        const prevMap = new Map(prevShops.map(s => [s.id, JSON.stringify(s)]));
        const currentIds = new Set(shops.map(s => s.id));

        const toWrite = shops.filter(s => {
          const prev = prevMap.get(s.id);
          return !prev || prev !== JSON.stringify(s);
        });
        const toDelete = prevShops.filter(s => !currentIds.has(s.id));

        await Promise.all([
          ...toWrite.map(shop => apiFetch(`/api/shops/${shop.id}`, 'PUT', shop)),
          ...toDelete.map(shop => apiFetch(`/api/shops/${shop.id}`, 'DELETE', undefined)),
        ]);

        lastWrittenShopsJson.current = currentJson;
        localStorage.removeItem(PENDING_KEY);
        setSyncStatus('saved');
        console.log('[ShopContext] MySQL write success:', toWrite.length, 'updated,', toDelete.length, 'deleted');
      } catch (err) {
        console.error('[ShopContext] MySQL write failed:', err);
        setSyncStatus('offline');
        // Retry after 3s so pending edits eventually sync when server recovers
        saveTimer.current = setTimeout(() => setSyncTrigger(t => t + 1), 3000);
      }
    }, delay);
  }, [shops, user, syncTrigger]);

  // ── Write brand to MySQL ──────────────────────────────────
  useEffect(() => {
    if (!user || !initialized.current) return;
    const currentJson = JSON.stringify(brand);
    if (currentJson === lastWrittenBrandJson.current) return;

    localSaveBrand(brand);
    clearTimeout(brandSaveTimer.current);
    brandSaveTimer.current = setTimeout(async () => {
      try {
        await apiFetch('/api/brand', 'PUT', brand);
        lastWrittenBrandJson.current = currentJson;
        console.log('[ShopContext] Brand MySQL write success');
      } catch (err) {
        console.error('[ShopContext] Brand MySQL write failed:', err);
      }
    }, 800);
  }, [brand, user]);

  // Persist active shop selection immediately on change
  useEffect(() => {
    try { localStorage.setItem(ACTIVE_KEY, activeShopId); } catch { }
  }, [activeShopId]);

  const updateBrand = useCallback((newBrand) => {
    setBrand(newBrand);
    localSaveBrand(newBrand);
  }, []);

  const activeShop = shops.find((s) => s.id === activeShopId) || shops[0];

  // ── Contacts (per-shop, synced via Firestore) ──
  const contacts = activeShop?.contacts || [];
  const emailSettings = activeShop?.emailSettings || DEFAULT_EMAIL_SETTINGS;
  const getSavedContacts = useCallback(() => contacts, [contacts]);

  const addOrUpdateContact = useCallback((contact) => {
    console.log('[ShopContext] addOrUpdateContact called:', contact, 'activeShopId:', activeShopId);
    flushNow.current = true;
    setShops((prev) => {
      const updated = prev.map((shop) => {
        if (shop.id !== activeShopId) return shop;
        const prevContacts = shop.contacts || [];
        // Match by id first, then by email (only if email is non-empty)
        const idx = contact.id
          ? prevContacts.findIndex(c => c.id === contact.id)
          : (contact.email ? prevContacts.findIndex(c => c.email && c.email === contact.email) : -1);
        if (idx >= 0) {
          const newContacts = [...prevContacts];
          newContacts[idx] = { ...newContacts[idx], ...contact };
          console.log('[ShopContext] Updated existing contact at idx', idx);
          return { ...shop, contacts: newContacts };
        }
        const newContact = { ...contact, id: contact.id || `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` };
        console.log('[ShopContext] Added new contact:', newContact.id, 'total:', prevContacts.length + 1);
        return { ...shop, contacts: [newContact, ...prevContacts].slice(0, 500) };
      });
      return updated;
    });
  }, [activeShopId]);

  const removeContact = useCallback((id) => {
    flushNow.current = true;
    setShops((prev) =>
      prev.map((shop) =>
        shop.id === activeShopId
          ? { ...shop, contacts: (shop.contacts || []).filter(c => c.id !== id) }
          : shop
      )
    );
  }, [activeShopId]);

  // ── Email Settings (per-shop, synced via Firestore) ──
  const getEmailSettingsSynced = useCallback(() => emailSettings, [emailSettings]);

  const updateEmailSettings = useCallback((settings) => {
    flushNow.current = true;
    localSaveEmailSettings(settings);
    setShops((prev) =>
      prev.map((shop) =>
        shop.id === activeShopId
          ? { ...shop, emailSettings: settings }
          : shop
      )
    );
  }, [activeShopId]);

  const addShop = useCallback((shopData) => {
    const newShop = {
      id: `shop-${Date.now()}`,
      createdAt: localDate(),
      transactions: [],
      team: [],
      skus: [],
      repairs: [],
      advances: [],
      secondhand: [],
      bankCards: [],
      notes: [],
      contacts: [],
      emailSettings: { ...DEFAULT_EMAIL_SETTINGS },
      ...shopData,
    };
    flushNow.current = true; // write immediately, don't wait 800ms
    setShops((prev) => [...prev, newShop]);
    setActiveShopId(newShop.id);
    notify('success', tStatic('notify_newShopCreated'), newShop.name);
    return newShop;
  }, []);

  const addTransaction = useCallback(
    (txData) => {
      const newTx = {
        id: `t-${Date.now()}`,
        date: localDate(),
        ...txData,
      };
      setShops((prev) =>
        prev.map((shop) =>
          shop.id === activeShopId
            ? { ...shop, transactions: [newTx, ...(shop.transactions || [])] }
            : shop
        )
      );
      const amt = txData.amount ? ` · ${Number(txData.amount).toLocaleString('it-IT')} €` : '';
      notify('success', tStatic('notify_transactionAdded'), `${txData.description || txData.clientName || ''}${amt}`);
    },
    [activeShopId]
  );

  const deleteTransaction = useCallback(
    (txId) => {
      setShops((prev) =>
        prev.map((shop) =>
          shop.id === activeShopId
            ? { ...shop, transactions: (shop.transactions || []).filter((t) => t.id !== txId) }
            : shop
        )
      );
      notify('error', tStatic('notify_transactionDeleted'), tStatic('notify_recordRemoved'));
    },
    [activeShopId]
  );

  const deleteShop = useCallback(
    (shopId) => {
      setShops((prev) => {
        const next = prev.filter((s) => s.id !== shopId);
        if (activeShopId === shopId && next.length > 0) {
          setActiveShopId(next[0].id);
        }
        return next;
      });
    },
    [activeShopId]
  );

  const updateShop = useCallback((shopId, updates) => {
    setShops((prev) =>
      prev.map((shop) => (shop.id === shopId ? { ...shop, ...updates } : shop))
    );
  }, []);

  const addTeamMember = useCallback((memberData) => {
    const newMember = {
      id: `m-${Date.now()}`,
      joinDate: localDate(),
      status: 'active',
      ...memberData,
    };
    setShops((prev) =>
      prev.map((shop) =>
        shop.id === activeShopId
          ? { ...shop, team: [newMember, ...(shop.team || [])] }
          : shop
      )
    );
    notify('info', tStatic('notify_teamMemberAdded'), memberData.name || tStatic('notify_newMemberJoined'));
  }, [activeShopId]);

  const updateTeamMember = useCallback((shopId, memberId, updates) => {
    setShops((prev) =>
      prev.map((shop) =>
        shop.id === shopId
          ? { ...shop, team: (shop.team || []).map((m) => m.id === memberId ? { ...m, ...updates } : m) }
          : shop
      )
    );
  }, []);

  const deleteTeamMember = useCallback((shopId, memberId) => {
    setShops((prev) =>
      prev.map((shop) =>
        shop.id === shopId
          ? { ...shop, team: (shop.team || []).filter((m) => m.id !== memberId) }
          : shop
      )
    );
  }, []);

  const addTransactionForShop = useCallback((shopId, txData) => {
    const newTx = {
      id: `t-${Date.now()}`,
      date: localDate(),
      ...txData,
    };
    setShops((prev) =>
      prev.map((shop) =>
        shop.id === shopId
          ? { ...shop, transactions: [newTx, ...(shop.transactions || [])] }
          : shop
      )
    );
  }, []);

  // ── REPAIRS ──
  const addRepair = useCallback((repairData) => {
    const today = localDate();
    const newRepair = {
      id: `rep-${Date.now()}`,
      createdAt: today,
      updatedAt: today,
      status: 'pending',
      // Event dates keep summary math aligned with what happened today.
      partsRecordedAt: Number(repairData.partsCost) > 0 ? today : null,
      advanceReceivedAt: Number(repairData.advance) > 0 ? today : null,
      feeReceivedAt: null,
      ...repairData,
    };
    setShops((prev) =>
      prev.map((shop) =>
        shop.id === activeShopId
          ? { ...shop, repairs: [newRepair, ...(shop.repairs || [])] }
          : shop
      )
    );
    notify('info', tStatic('notify_newRepairJob'), `${repairData.customerName || ''} · ${repairData.device || ''}`);
  }, [activeShopId]);

  const updateRepair = useCallback((shopId, repairId, updates) => {
    const today = localDate();
    setShops((prev) =>
      prev.map((shop) =>
        shop.id === shopId
          ? {
            ...shop,
            repairs: (shop.repairs || []).map((r) => {
              if (r.id !== repairId) return r;
              const next = { ...r, ...updates, updatedAt: today };
              // Mark fee date when a repair reaches a done state with a fee amount.
              const doneStates = ['ready', 'delivered', 'completed'];
              if (!next.feeReceivedAt && doneStates.includes(next.status) && Number(next.repairCost) > 0) {
                next.feeReceivedAt = today;
              }
              if (!next.partsRecordedAt && Number(next.partsCost) > 0) next.partsRecordedAt = today;
              if (!next.advanceReceivedAt && Number(next.advance) > 0) next.advanceReceivedAt = today;
              return next;
            }),
          }
          : shop
      )
    );
    if (updates.status) {
      const labels = { completed: tStatic('notify_repairCompleted'), in_progress: tStatic('notify_repairInProgress'), pending: tStatic('notify_repairPending'), cancelled: tStatic('notify_repairCancelled') };
      notify(updates.status === 'completed' ? 'success' : 'info', labels[updates.status] || tStatic('notify_repairUpdated'), updates.customerName || '');
    }
  }, []);

  const deleteRepair = useCallback((shopId, repairId) => {
    setShops((prev) =>
      prev.map((shop) =>
        shop.id === shopId
          ? { ...shop, repairs: (shop.repairs || []).filter((r) => r.id !== repairId) }
          : shop
      )
    );
    notify('error', tStatic('notify_repairDeleted'), tStatic('notify_repairRecordRemoved'));
  }, []);

  // Add an order to a repair
  const addRepairOrder = useCallback((shopId, repairId, orderData) => {
    const newOrder = {
      id: `ord-${Date.now()}`,
      date: localDate(),
      status: 'ordered', // 'ordered' | 'received'
      ...orderData,
    };
    setShops((prev) =>
      prev.map((shop) =>
        shop.id === shopId
          ? {
            ...shop,
            repairs: (shop.repairs || []).map((r) =>
              r.id === repairId
                ? { ...r, orders: [newOrder, ...(r.orders || [])] }
                : r
            ),
          }
          : shop
      )
    );
  }, []);

  // Update an order on a repair (e.g. mark received)
  const updateRepairOrder = useCallback((shopId, repairId, orderId, updates) => {
    setShops((prev) =>
      prev.map((shop) =>
        shop.id === shopId
          ? {
            ...shop,
            repairs: (shop.repairs || []).map((r) =>
              r.id === repairId
                ? { ...r, orders: (r.orders || []).map((o) => o.id === orderId ? { ...o, ...updates } : o) }
                : r
            ),
          }
          : shop
      )
    );
  }, []);

  // Delete an order from a repair
  const deleteRepairOrder = useCallback((shopId, repairId, orderId) => {
    setShops((prev) =>
      prev.map((shop) =>
        shop.id === shopId
          ? {
            ...shop,
            repairs: (shop.repairs || []).map((r) =>
              r.id === repairId
                ? { ...r, orders: (r.orders || []).filter((o) => o.id !== orderId) }
                : r
            ),
          }
          : shop
      )
    );
  }, []);

  // ── ADVANCES ──
  const addAdvance = useCallback((advanceData) => {
    const newAdv = {
      id: `adv-${Date.now()}`,
      date: localDate(),
      status: 'pending',
      payments: [],
      ...advanceData,
    };
    setShops((prev) =>
      prev.map((shop) =>
        shop.id === activeShopId
          ? { ...shop, advances: [newAdv, ...(shop.advances || [])] }
          : shop
      )
    );
    const amt = advanceData.amount ? `${Number(advanceData.amount).toLocaleString('it-IT')} €` : '';
    notify('warning', tStatic('notify_advanceGiven'), `${advanceData.customerName || ''} · ${amt}`);
  }, [activeShopId]);

  const updateAdvance = useCallback((shopId, advId, updates) => {
    setShops((prev) =>
      prev.map((shop) =>
        shop.id === shopId
          ? { ...shop, advances: (shop.advances || []).map((a) => a.id === advId ? { ...a, ...updates } : a) }
          : shop
      )
    );
  }, []);

  const deleteAdvance = useCallback((shopId, advId) => {
    setShops((prev) =>
      prev.map((shop) =>
        shop.id === shopId
          ? { ...shop, advances: (shop.advances || []).filter((a) => a.id !== advId) }
          : shop
      )
    );
  }, []);

  // ── SKU / INVENTORY ──
  const addSku = useCallback((skuData) => {
    setShops((prev) => {
      const shop = prev.find((s) => s.id === activeShopId);
      const existing = shop?.skus || [];
      const num = String(existing.length + 1).padStart(3, '0');
      const openingQty = Number(skuData.stock) || 0;
      const openingBuy = Number(skuData.buyPrice) || 0;
      const today = localDate();
      // Create an opening stock movement so it appears in Transaction History & Summary
      const openingMovements = openingQty > 0 ? [{
        id: `mov-open-${Date.now()}`,
        date: today,
        type: 'in',
        qty: openingQty,
        price: openingBuy,
        note: 'Opening stock',
      }] : [];
      const newSku = {
        id: `sku-${Date.now()}`,
        code: `SKU-${num}`,
        createdAt: today,
        stock: 0,
        movements: [],
        ...skuData,
        movements: openingMovements,
      };
      return prev.map((s) =>
        s.id === activeShopId ? { ...s, skus: [newSku, ...(s.skus || [])] } : s
      );
    });
    notify('info', tStatic('notify_inventoryItemAdded'), skuData.name || tStatic('notify_newSKUCreated'));
  }, [activeShopId]);

  const updateSku = useCallback((shopId, skuId, updates) => {
    setShops((prev) =>
      prev.map((shop) =>
        shop.id === shopId
          ? { ...shop, skus: (shop.skus || []).map((sk) => sk.id === skuId ? { ...sk, ...updates } : sk) }
          : shop
      )
    );
  }, []);

  const deleteSku = useCallback((shopId, skuId) => {
    setShops((prev) =>
      prev.map((shop) =>
        shop.id === shopId
          ? { ...shop, skus: (shop.skus || []).filter((sk) => sk.id !== skuId) }
          : shop
      )
    );
  }, []);

  // ── Secondhand ──────────────────────────────────────────────────────────
  const addSecondhand = useCallback((shopId, item) => {
    setShops((prev) =>
      prev.map((shop) =>
        shop.id === shopId
          ? { ...shop, secondhand: [{ id: `sh-${Date.now()}`, createdAt: new Date().toISOString(), ...item }, ...(shop.secondhand || [])] }
          : shop
      )
    );
    notify('success', tStatic('notify_itemBought'), `${item.itemName || ''} ${item.brand ? '· ' + item.brand : ''}`);
  }, []);

  const updateSecondhand = useCallback((shopId, itemId, changes) => {
    setShops((prev) =>
      prev.map((shop) =>
        shop.id === shopId
          ? { ...shop, secondhand: (shop.secondhand || []).map((sh) => sh.id === itemId ? { ...sh, ...changes } : sh) }
          : shop
      )
    );
    if (changes.status === 'sold') {
      const amt = changes.sellPrice ? `${Number(changes.sellPrice).toLocaleString('it-IT')} €` : '';
      notify('success', tStatic('notify_itemSold'), `${changes.buyerName || ''} · ${amt}`);
    }
  }, []);

  const deleteSecondhand = useCallback((shopId, itemId) => {
    setShops((prev) =>
      prev.map((shop) =>
        shop.id === shopId
          ? { ...shop, secondhand: (shop.secondhand || []).filter((sh) => sh.id !== itemId) }
          : shop
      )
    );
    notify('error', tStatic('notify_secondhandDeleted'), tStatic('notify_recordRemoved'));
  }, []);

  // ── BANK CARDS (admin's own cards) ──────────────────────────────────────
  const addBankCard = useCallback((shopId, cardData) => {
    const newCard = {
      id: `card-${Date.now()}`,
      createdAt: localDate(),
      cardType: 'debit',
      color: 'blue',
      ...cardData,
    };
    setShops((prev) =>
      prev.map((shop) =>
        shop.id === shopId
          ? { ...shop, bankCards: [newCard, ...(shop.bankCards || [])] }
          : shop
      )
    );
    notify('success', tStatic('notify_bankCardAdded'), cardData.bankName || tStatic('notify_newCardSaved'));
  }, []);

  const updateBankCard = useCallback((shopId, cardId, updates) => {
    setShops((prev) =>
      prev.map((shop) =>
        shop.id === shopId
          ? { ...shop, bankCards: (shop.bankCards || []).map((c) => c.id === cardId ? { ...c, ...updates } : c) }
          : shop
      )
    );
  }, []);

  const deleteBankCard = useCallback((shopId, cardId) => {
    setShops((prev) =>
      prev.map((shop) =>
        shop.id === shopId
          ? { ...shop, bankCards: (shop.bankCards || []).filter((c) => c.id !== cardId) }
          : shop
      )
    );
    notify('error', tStatic('notify_cardRemoved'), tStatic('notify_bankCardDeleted'));
  }, []);

  // ── QUICK NOTES ──
  const addNote = useCallback((noteData) => {
    const newNote = {
      id: `note-${Date.now()}`,
      createdAt: new Date().toISOString(),
      date: localDate(),
      ...noteData,
    };
    setShops((prev) =>
      prev.map((shop) =>
        shop.id === activeShopId
          ? { ...shop, notes: [newNote, ...(shop.notes || [])] }
          : shop
      )
    );
    notify('success', tStatic('notify_noteSaved'), noteData.name || tStatic('notify_newNoteAdded'));
  }, [activeShopId]);

  const updateNote = useCallback((noteId, updates) => {
    setShops((prev) =>
      prev.map((shop) =>
        shop.id === activeShopId
          ? { ...shop, notes: (shop.notes || []).map((n) => n.id === noteId ? { ...n, ...updates } : n) }
          : shop
      )
    );
    notify('success', tStatic('notify_noteSaved'), updates.name || '');
  }, [activeShopId]);

  const deleteNote = useCallback((noteId) => {
    setShops((prev) =>
      prev.map((shop) =>
        shop.id === activeShopId
          ? { ...shop, notes: (shop.notes || []).filter((n) => n.id !== noteId) }
          : shop
      )
    );
    notify('error', tStatic('notify_noteDeleted'), tStatic('notify_recordRemoved'));
  }, [activeShopId]);

  const addSkuMovement = useCallback((shopId, skuId, movement) => {
    // movement: { type: 'in'|'out', qty, note, price, skuName, buyPrice }
    let updatedSku = null;
    setShops((prev) =>
      prev.map((shop) => {
        if (shop.id !== shopId) return shop;
        const updatedSkus = (shop.skus || []).map((sk) => {
          if (sk.id !== skuId) return sk;
          const newMov = { id: `mov-${Date.now()}`, date: localDate(), ...movement };
          const newStock = movement.type === 'in'
            ? (sk.stock || 0) + Number(movement.qty)
            : Math.max(0, (sk.stock || 0) - Number(movement.qty));
          updatedSku = { ...sk, stock: newStock };
          return { ...updatedSku, movements: [newMov, ...(sk.movements || [])] };
        });
        return { ...shop, skus: updatedSkus };
      })
    );
    const qty = Number(movement.qty) || 1;
    const price = Number(movement.price) || 0;
    const skuName = movement.skuName || '';
    if (price > 0) {
      if (movement.type === 'in') {
        notify('error', tStatic('notify_expenseAdded') || 'Expense Recorded', `${skuName} ×${qty} — ${(price * qty).toLocaleString()}`);
      } else {
        const profit = (price - (Number(movement.buyPrice) || 0)) * qty;
        notify('success', tStatic('notify_saleRecorded') || 'Sale Recorded', `${skuName} ×${qty} | Profit: ${profit >= 0 ? '+' : ''}${profit.toLocaleString()}`);
      }
    }
  }, []);

  // ── Backup Download ───────────────────────────────────────────
  const downloadBackup = useCallback(() => {
    const payload = {
      exportedAt: new Date().toISOString(),
      version: 2,
      brand,
      shops,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `dashboard-backup-${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify('success', 'Backup Downloaded', `dashboard-backup-${dateStr}.json`);
  }, [shops, brand]);

  return (
    <ShopContext.Provider
      value={{
        shops,
        activeShop,
        activeShopId,
        setActiveShopId,
        syncStatus,
        brand,
        updateBrand,
        downloadBackup,
        addShop,
        updateShop,
        addTransaction,
        deleteTransaction,
        deleteShop,
        addTeamMember,
        updateTeamMember,
        deleteTeamMember,
        addTransactionForShop,
        addRepair,
        updateRepair,
        deleteRepair,
        addRepairOrder,
        updateRepairOrder,
        deleteRepairOrder,
        addAdvance,
        updateAdvance,
        deleteAdvance,
        addSku,
        updateSku,
        deleteSku,
        addSkuMovement,
        addSecondhand,
        updateSecondhand,
        deleteSecondhand,
        addBankCard,
        updateBankCard,
        deleteBankCard,
        addNote,
        updateNote,
        deleteNote,
        contacts,
        getSavedContacts,
        addOrUpdateContact,
        removeContact,
        emailSettings,
        getEmailSettingsSynced,
        updateEmailSettings,
      }}
    >
      {children}
    </ShopContext.Provider>
  );
}

export function useShop() {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error('useShop must be used inside ShopProvider');
  return ctx;
}
