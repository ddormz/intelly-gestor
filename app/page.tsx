"use client";

/* eslint-disable @next/next/no-img-element -- Local brand assets are already optimized and used at fixed sizes. */

import {
  Archive,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDollarSign,
  Copy,
  Download,
  FileText,
  History,
  Landmark,
  Mail,
  Menu,
  Plus,
  RotateCcw,
  Save,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  buildOrderPdf,
  CompanySettings,
  formatClp,
  formatDate,
  OrderItem,
  PaymentOrder,
  ServiceType,
} from "../lib/order-pdf";

const STORAGE = {
  settings: "intelly.op.settings.v1",
  orders: "intelly.op.orders.v1",
  sequence: "intelly.op.sequence.v1",
  paymentDetails: "intelly.op.payment-details.v1",
};

const paymentDetails: Partial<CompanySettings> = {
  companyName: "INTELLY SPA",
  companyRut: "78.202.703-4",
  email: "dramirez@intelly.cl",
  bankName: "Banco de Chile",
  accountType: "Cuenta Corriente",
  accountNumber: "00-171-21318-01",
  accountHolder: "INTELLY SPA",
  accountRut: "78.202.703-4",
  transferEmail: "dramirez@intelly.cl",
};

const blankSettings: CompanySettings = {
  companyName: "INTELLY SPA",
  companyRut: "78.202.703-4",
  businessLine: "",
  address: "",
  email: "dramirez@intelly.cl",
  phone: "",
  bankName: "Banco de Chile",
  accountType: "Cuenta Corriente",
  accountNumber: "00-171-21318-01",
  accountHolder: "INTELLY SPA",
  accountRut: "78.202.703-4",
  transferEmail: "dramirez@intelly.cl",
  paymentTerms: "",
  paymentInstructions: "",
  dueDays: 10,
};

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const today = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
};

const addDays = (date: string, days: number) => {
  const result = new Date(`${date}T12:00:00`);
  result.setDate(result.getDate() + days);
  return result.toISOString().slice(0, 10);
};

const sequenceForYear = (year: number) => {
  if (typeof window === "undefined") return 1;
  const stored = JSON.parse(
    window.localStorage.getItem(STORAGE.sequence) || "{}",
  ) as Record<string, number>;
  return (stored[String(year)] || 0) + 1;
};

const formatOrderNumber = (year: number, sequence: number) =>
  `OP-${year}-${String(sequence).padStart(4, "0")}`;

const hostingItem = (): OrderItem => ({
  id: uid(),
  name: "Servicio de Hosting",
  description: "Plan de hosting · dominio y período por especificar",
  amount: 0,
});

const createDraft = (
  dueDays = 10,
  serviceType: ServiceType = "hosting",
): PaymentOrder => {
  const issueDate = today();
  const year = Number(issueDate.slice(0, 4));
  return {
    id: uid(),
    number: formatOrderNumber(year, sequenceForYear(year)),
    committed: false,
    issueDate,
    dueDate: addDays(issueDate, dueDays),
    customerName: "",
    customerRut: "",
    customerEmail: "",
    serviceType,
    invoice: true,
    discountPercent: 0,
    discountReason: "",
    items: serviceType === "hosting" ? [hostingItem()] : [],
  };
};

const requiredSettings = (settings: CompanySettings) =>
  Boolean(
    settings.companyName.trim() &&
      settings.companyRut.trim() &&
      settings.bankName.trim() &&
      settings.accountType.trim() &&
      settings.accountNumber.trim() &&
      settings.accountHolder.trim() &&
      settings.paymentTerms.trim(),
  );

const getErrors = (order: PaymentOrder, settings: CompanySettings) => {
  const errors: string[] = [];
  if (!requiredSettings(settings)) {
    errors.push("Completa los datos obligatorios de Intelly y la cuenta bancaria.");
  }
  if (!order.customerName.trim()) errors.push("Ingresa el nombre del cliente.");
  if (!order.customerRut.trim()) errors.push("Ingresa el RUT del cliente.");
  if (!order.customerEmail.trim() || !order.customerEmail.includes("@")) {
    errors.push("Ingresa un correo válido del cliente.");
  }
  if (!order.issueDate || !order.dueDate) {
    errors.push("Completa las fechas de emisión y vencimiento.");
  } else if (order.dueDate < order.issueDate) {
    errors.push("El vencimiento no puede ser anterior a la emisión.");
  }
  if (!order.items.length) errors.push("Agrega al menos un ítem.");
  if (
    !Number.isFinite(Number(order.discountPercent)) ||
    Number(order.discountPercent) < 0 ||
    Number(order.discountPercent) > 100
  ) {
    errors.push("El descuento debe estar entre 0% y 100%.");
  }
  if (
    Number(order.discountPercent) > 0 &&
    !order.discountReason?.trim()
  ) {
    errors.push("Indica el motivo del descuento.");
  }
  if (
    order.items.some(
      (item) =>
        !item.name.trim() ||
        !item.description.trim() ||
        !Number.isFinite(item.amount) ||
        item.amount <= 0,
    )
  ) {
    errors.push("Completa cada ítem con nombre, descripción y monto positivo.");
  }
  return errors;
};

async function imageToDataUrl(url: string) {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

type Toast = { tone: "success" | "error"; message: string } | null;

export default function Home() {
  const [settings, setSettings] = useState<CompanySettings>(blankSettings);
  const [draftSettings, setDraftSettings] =
    useState<CompanySettings>(blankSettings);
  const [order, setOrder] = useState<PaymentOrder>(() => createDraft());
  const [orders, setOrders] = useState<PaymentOrder[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  useEffect(() => {
    const storedSettings = JSON.parse(
      window.localStorage.getItem(STORAGE.settings) || "null",
    ) as CompanySettings | null;
    const storedOrders = (
      JSON.parse(
      window.localStorage.getItem(STORAGE.orders) || "[]",
      ) as PaymentOrder[]
    ).map((saved) => ({
      ...saved,
      discountPercent: Number(saved.discountPercent) || 0,
      discountReason: saved.discountReason || "",
    }));
    if (storedSettings) {
      const shouldApplyPaymentDetails =
        window.localStorage.getItem(STORAGE.paymentDetails) !== "1";
      const normalized = {
        ...blankSettings,
        ...storedSettings,
        ...(shouldApplyPaymentDetails ? paymentDetails : {}),
      };
      if (shouldApplyPaymentDetails) {
        window.localStorage.setItem(
          STORAGE.settings,
          JSON.stringify(normalized),
        );
        window.localStorage.setItem(STORAGE.paymentDetails, "1");
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect -- This hydrates browser-only localStorage after mount.
      setSettings(normalized);
      setDraftSettings(normalized);
      setOrder(createDraft(normalized.dueDays));
    } else {
      window.localStorage.setItem(STORAGE.paymentDetails, "1");
      setSettingsOpen(true);
    }
    setOrders(storedOrders);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const subtotal = useMemo(
    () =>
      order.items.reduce(
        (sum, item) => sum + Math.round(Number(item.amount) || 0),
        0,
      ),
    [order.items],
  );
  const discountPercent = Math.min(
    100,
    Math.max(0, Number(order.discountPercent) || 0),
  );
  const discount = Math.round(subtotal * (discountPercent / 100));
  const discountedSubtotal = Math.max(0, subtotal - discount);
  const tax = order.invoice ? Math.round(discountedSubtotal * 0.19) : 0;
  const total = discountedSubtotal + tax;

  const persistOrders = (next: PaymentOrder[]) => {
    setOrders(next);
    window.localStorage.setItem(STORAGE.orders, JSON.stringify(next));
  };

  const updateOrder = <K extends keyof PaymentOrder>(
    key: K,
    value: PaymentOrder[K],
  ) => setOrder((current) => ({ ...current, [key]: value }));

  const updateItem = (
    id: string,
    key: keyof Omit<OrderItem, "id">,
    value: string | number,
  ) => {
    setOrder((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === id ? { ...item, [key]: value } : item,
      ),
    }));
  };

  const addItem = () => {
    setOrder((current) => ({
      ...current,
      items: [
        ...current.items,
        { id: uid(), name: "", description: "", amount: 0 },
      ],
    }));
  };

  const removeItem = (id: string) => {
    setOrder((current) => ({
      ...current,
      items: current.items.filter((item) => item.id !== id),
    }));
  };

  const changeService = (serviceType: ServiceType) => {
    setOrder((current) => {
      const isUntouchedHosting =
        current.items.length === 1 &&
        current.items[0].name === "Servicio de Hosting" &&
        current.items[0].amount === 0;
      return {
        ...current,
        serviceType,
        items:
          serviceType === "hosting" && current.items.length === 0
            ? [hostingItem()]
            : serviceType === "custom" && isUntouchedHosting
              ? []
              : current.items,
      };
    });
  };

  const saveSettings = () => {
    if (!requiredSettings(draftSettings)) {
      setToast({
        tone: "error",
        message:
          "Completa razón social, RUT, banco, tipo y número de cuenta, titular y condiciones.",
      });
      return;
    }
    const normalized = {
      ...draftSettings,
      dueDays: Math.max(1, Number(draftSettings.dueDays) || 10),
    };
    setSettings(normalized);
    window.localStorage.setItem(STORAGE.settings, JSON.stringify(normalized));
    setSettingsOpen(false);
    setToast({ tone: "success", message: "Configuración guardada." });
  };

  const openSettings = () => {
    setDraftSettings(settings);
    setSettingsOpen(true);
    setMobileMenuOpen(false);
  };

  const commitOrder = () => {
    const errors = getErrors(order, settings);
    if (errors.length) {
      setToast({ tone: "error", message: errors[0] });
      if (!requiredSettings(settings)) openSettings();
      return null;
    }

    const committed = {
      ...order,
      committed: true,
      createdAt: order.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (!order.committed) {
      const year = Number(order.number.split("-")[1]);
      const number = Number(order.number.split("-")[2]);
      const sequence = JSON.parse(
        window.localStorage.getItem(STORAGE.sequence) || "{}",
      ) as Record<string, number>;
      sequence[String(year)] = Math.max(sequence[String(year)] || 0, number);
      window.localStorage.setItem(STORAGE.sequence, JSON.stringify(sequence));
    }

    const exists = orders.some((saved) => saved.id === committed.id);
    const nextOrders = exists
      ? orders.map((saved) => (saved.id === committed.id ? committed : saved))
      : [committed, ...orders];
    persistOrders(nextOrders);
    setOrder(committed);
    return committed;
  };

  const saveOrder = () => {
    if (!commitOrder()) return;
    setToast({ tone: "success", message: "Orden guardada en el historial." });
  };

  const downloadOrder = async (source?: PaymentOrder) => {
    setBusy(true);
    try {
      let target = source;
      if (!target) {
        target = commitOrder() || undefined;
      }
      if (!target) return;

      const errors = getErrors(target, settings);
      if (errors.length) {
        setToast({ tone: "error", message: errors[0] });
        return;
      }
      const logoDataUrl = await imageToDataUrl("/intelly-logo.png");
      const pdf = buildOrderPdf({ order: target, settings, logoDataUrl });
      pdf.save(`orden-pago-${target.number}.pdf`);
      setToast({
        tone: "success",
        message: `PDF ${target.number} descargado correctamente.`,
      });
    } catch {
      setToast({
        tone: "error",
        message: "No fue posible crear el PDF. Inténtalo nuevamente.",
      });
    } finally {
      setBusy(false);
    }
  };

  const newOrder = () => {
    setOrder(createDraft(settings.dueDays));
    setHistoryOpen(false);
    setMobileMenuOpen(false);
  };

  const loadOrder = (saved: PaymentOrder) => {
    setOrder({
      ...saved,
      discountPercent: Number(saved.discountPercent) || 0,
      discountReason: saved.discountReason || "",
      items: saved.items.map((item) => ({ ...item })),
    });
    setHistoryOpen(false);
    setToast({ tone: "success", message: `${saved.number} abierta para editar.` });
  };

  const duplicateOrder = (saved: PaymentOrder) => {
    const fresh = createDraft(settings.dueDays, saved.serviceType);
    setOrder({
      ...fresh,
      customerName: saved.customerName,
      customerRut: saved.customerRut,
      customerEmail: saved.customerEmail,
      invoice: saved.invoice,
      discountPercent: Number(saved.discountPercent) || 0,
      discountReason: saved.discountReason || "",
      items: saved.items.map((item) => ({ ...item, id: uid() })),
    });
    setHistoryOpen(false);
    setToast({ tone: "success", message: "Copia creada con un nuevo correlativo." });
  };

  const deleteOrder = (saved: PaymentOrder) => {
    if (!window.confirm(`¿Eliminar definitivamente ${saved.number}?`)) return;
    persistOrders(orders.filter((item) => item.id !== saved.id));
    if (order.id === saved.id) setOrder(createDraft(settings.dueDays));
    setToast({ tone: "success", message: `${saved.number} fue eliminada.` });
  };

  const resetDraft = () => {
    if (
      window.confirm(
        "¿Descartar los cambios actuales y comenzar una nueva orden?",
      )
    ) {
      newOrder();
    }
  };

  if (!ready) {
    return (
      <main className="loading-screen">
        <img src="/intelly-isotipo.png" alt="" />
        <span>Preparando tu generador…</span>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={newOrder} aria-label="Nueva orden">
          <img src="/intelly-isotipo.png" alt="" />
          <span>Intelly</span>
          <i>Órdenes de pago</i>
        </button>

        <nav className="desktop-actions" aria-label="Acciones principales">
          <button className="button button-ghost" onClick={openSettings}>
            <Settings size={17} /> Configuración
          </button>
          <button
            className="button button-ghost"
            onClick={() => setHistoryOpen(true)}
          >
            <History size={17} /> Historial
            {orders.length > 0 && <span className="count">{orders.length}</span>}
          </button>
          <button className="button button-secondary" onClick={newOrder}>
            <Plus size={17} /> Nueva orden
          </button>
        </nav>

        <button
          className="icon-button mobile-menu-button"
          onClick={() => setMobileMenuOpen((open) => !open)}
          aria-label="Abrir menú"
        >
          {mobileMenuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>

        {mobileMenuOpen && (
          <div className="mobile-menu">
            <button onClick={openSettings}>
              <Settings size={18} /> Configuración
            </button>
            <button
              onClick={() => {
                setHistoryOpen(true);
                setMobileMenuOpen(false);
              }}
            >
              <History size={18} /> Historial ({orders.length})
            </button>
            <button onClick={newOrder}>
              <Plus size={18} /> Nueva orden
            </button>
          </div>
        )}
      </header>

      <section className="workspace">
        <div className="workspace-heading">
          <div>
            <span className="eyebrow">GENERADOR DE DOCUMENTOS</span>
            <h1>Crea una orden clara, lista para enviar.</h1>
            <p>
              Completa los datos, revisa el total y descarga un PDF con el
              branding de Intelly.
            </p>
          </div>
          <div className="order-status">
            <span>{order.committed ? "Orden guardada" : "Borrador actual"}</span>
            <strong>{order.number}</strong>
          </div>
        </div>

        <div className="editor-grid">
          <div className="editor-column">
            <section className="card">
              <div className="card-heading">
                <div className="step-number">01</div>
                <div>
                  <h2>Datos de la orden</h2>
                  <p>Identificación, fechas y modalidad tributaria.</p>
                </div>
              </div>

              <div className="form-grid three-columns">
                <label>
                  <span>Número de orden</span>
                  <div className="input-with-icon">
                    <FileText size={16} />
                    <input value={order.number} readOnly />
                  </div>
                </label>
                <label>
                  <span>Fecha de emisión</span>
                  <input
                    type="date"
                    value={order.issueDate}
                    onChange={(event) => {
                      const issueDate = event.target.value;
                      setOrder((current) => ({
                        ...current,
                        issueDate,
                        dueDate: addDays(issueDate, settings.dueDays),
                      }));
                    }}
                  />
                </label>
                <label>
                  <span>Fecha de vencimiento</span>
                  <input
                    type="date"
                    min={order.issueDate}
                    value={order.dueDate}
                    onChange={(event) =>
                      updateOrder("dueDate", event.target.value)
                    }
                  />
                </label>
              </div>

              <div className="invoice-row">
                <div>
                  <strong>Documento tributario</strong>
                  <span>El IVA se calcula automáticamente.</span>
                </div>
                <div className="segmented" role="group" aria-label="Factura">
                  <button
                    className={order.invoice ? "active" : ""}
                    onClick={() => updateOrder("invoice", true)}
                    type="button"
                  >
                    {order.invoice && <Check size={15} />} Con factura
                  </button>
                  <button
                    className={!order.invoice ? "active" : ""}
                    onClick={() => updateOrder("invoice", false)}
                    type="button"
                  >
                    {!order.invoice && <Check size={15} />} Sin factura
                  </button>
                </div>
              </div>

              <div className="discount-row">
                <label>
                  <span>Descuento (%)</span>
                  <div className="percent-input">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={order.discountPercent || ""}
                      placeholder="0"
                      onChange={(event) =>
                        updateOrder(
                          "discountPercent",
                          Math.min(
                            100,
                            Math.max(0, Number(event.target.value) || 0),
                          ),
                        )
                      }
                    />
                    <span>%</span>
                  </div>
                </label>
                <label>
                  <span>
                    Motivo del descuento
                    {discountPercent > 0 && <b> *</b>}
                  </span>
                  <input
                    value={order.discountReason}
                    disabled={discountPercent === 0}
                    placeholder={
                      discountPercent > 0
                        ? "Ej.: Renovación anual o cliente preferente"
                        : "Activa un descuento para indicar el motivo"
                    }
                    onChange={(event) =>
                      updateOrder("discountReason", event.target.value)
                    }
                  />
                </label>
              </div>
            </section>

            <section className="card">
              <div className="card-heading">
                <div className="step-number">02</div>
                <div>
                  <h2>Cliente</h2>
                  <p>Datos que aparecerán como destinatario del documento.</p>
                </div>
              </div>
              <div className="form-grid three-columns">
                <label>
                  <span>Nombre o razón social</span>
                  <input
                    placeholder="Nombre del cliente"
                    value={order.customerName}
                    onChange={(event) =>
                      updateOrder("customerName", event.target.value)
                    }
                  />
                </label>
                <label>
                  <span>RUT</span>
                  <input
                    placeholder="12.345.678-9"
                    value={order.customerRut}
                    onChange={(event) =>
                      updateOrder("customerRut", event.target.value)
                    }
                  />
                </label>
                <label>
                  <span>Correo</span>
                  <input
                    type="email"
                    placeholder="cliente@empresa.cl"
                    value={order.customerEmail}
                    onChange={(event) =>
                      updateOrder("customerEmail", event.target.value)
                    }
                  />
                </label>
              </div>
            </section>

            <section className="card items-card">
              <div className="card-heading items-heading">
                <div className="heading-group">
                  <div className="step-number">03</div>
                  <div>
                    <h2>Servicios</h2>
                    <p>Agrega el detalle que se cobrará en esta orden.</p>
                  </div>
                </div>
                <label className="service-select">
                  <span>Plantilla</span>
                  <select
                    value={order.serviceType}
                    onChange={(event) =>
                      changeService(event.target.value as ServiceType)
                    }
                  >
                    <option value="hosting">Hosting</option>
                    <option value="custom">Servicio libre</option>
                  </select>
                </label>
              </div>

              <div className="items-table-header" aria-hidden="true">
                <span>Item</span>
                <span>Descripción</span>
                <span>Subtotal</span>
                <span />
              </div>

              <div className="items-list">
                {order.items.length === 0 ? (
                  <button className="empty-items" onClick={addItem} type="button">
                    <Plus size={20} />
                    <strong>Agrega el primer servicio</strong>
                    <span>Define el nombre, descripción y valor neto.</span>
                  </button>
                ) : (
                  order.items.map((item, index) => (
                    <div className="item-row" key={item.id}>
                      <span className="mobile-item-label">
                        Servicio {index + 1}
                      </span>
                      <input
                        aria-label={`Item ${index + 1}`}
                        placeholder="Nombre del servicio"
                        value={item.name}
                        onChange={(event) =>
                          updateItem(item.id, "name", event.target.value)
                        }
                      />
                      <textarea
                        aria-label={`Descripción ${index + 1}`}
                        placeholder="Plan, dominio, período u otros detalles"
                        rows={2}
                        value={item.description}
                        onChange={(event) =>
                          updateItem(item.id, "description", event.target.value)
                        }
                      />
                      <div className="money-input">
                        <span>$</span>
                        <input
                          aria-label={`Subtotal ${index + 1}`}
                          inputMode="numeric"
                          value={item.amount || ""}
                          placeholder="0"
                          onChange={(event) =>
                            updateItem(
                              item.id,
                              "amount",
                              Number(event.target.value.replace(/\D/g, "")),
                            )
                          }
                        />
                      </div>
                      <button
                        className="icon-button remove-item"
                        onClick={() => removeItem(item.id)}
                        aria-label={`Eliminar item ${index + 1}`}
                        type="button"
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <button className="add-item-button" onClick={addItem} type="button">
                <Plus size={16} /> Agregar otro ítem
              </button>
            </section>
          </div>

          <aside className="summary-column">
            <section className="summary-card">
              <div className="summary-brand">
                <img src="/intelly-isotipo.png" alt="" />
                <div>
                  <span>RESUMEN DE ORDEN</span>
                  <strong>{order.number}</strong>
                </div>
              </div>

              <div className="summary-meta">
                <div>
                  <CalendarDays size={17} />
                  <span>
                    <small>Vencimiento</small>
                    <strong>{formatDate(order.dueDate)}</strong>
                  </span>
                </div>
                <div>
                  <FileText size={17} />
                  <span>
                    <small>Documento</small>
                    <strong>
                      {order.invoice ? "Con factura" : "Sin factura"}
                    </strong>
                  </span>
                </div>
              </div>

              <div className="summary-client">
                <small>CLIENTE</small>
                <strong>{order.customerName || "Aún sin cliente"}</strong>
                <span>{order.customerRut || "RUT pendiente"}</span>
              </div>

              <div className="summary-items">
                {order.items.length ? (
                  order.items.map((item) => (
                    <div key={item.id}>
                      <span>{item.name || "Ítem sin nombre"}</span>
                      <strong>{formatClp(item.amount)}</strong>
                    </div>
                  ))
                ) : (
                  <p>No hay servicios agregados.</p>
                )}
              </div>

              <div className="totals">
                <div>
                  <span>Subtotal neto</span>
                  <strong>{formatClp(subtotal)}</strong>
                </div>
                {discount > 0 && (
                  <>
                    <div className="discount-total">
                      <span>Descuento ({discountPercent}%)</span>
                      <strong>-{formatClp(discount)}</strong>
                    </div>
                    <div>
                      <span>Neto con descuento</span>
                      <strong>{formatClp(discountedSubtotal)}</strong>
                    </div>
                  </>
                )}
                <div>
                  <span>{order.invoice ? "IVA (19%)" : "IVA (sin factura)"}</span>
                  <strong>{formatClp(tax)}</strong>
                </div>
                <div className="grand-total">
                  <span>Total</span>
                  <strong>{formatClp(total)}</strong>
                </div>
              </div>

              {discount > 0 && (
                <div className="discount-note">
                  <strong>Motivo del descuento:</strong>{" "}
                  <span>{order.discountReason || "Pendiente de completar"}</span>
                </div>
              )}

              <div className="summary-actions">
                <button
                  className="button button-primary"
                  onClick={() => downloadOrder()}
                  disabled={busy}
                >
                  <Download size={18} />
                  {busy ? "Generando…" : "Descargar PDF"}
                </button>
                <button className="button button-outline" onClick={saveOrder}>
                  <Save size={17} /> Guardar orden
                </button>
              </div>

              <button className="reset-button" onClick={resetDraft}>
                <RotateCcw size={15} /> Limpiar y comenzar de nuevo
              </button>
            </section>

            <div className="privacy-note">
              <Archive size={17} />
              <span>
                Tus órdenes y ajustes se guardan únicamente en este navegador.
              </span>
            </div>
          </aside>
        </div>
      </section>

      {settingsOpen && (
        <div className="modal-backdrop" role="presentation">
          <section
            className="modal settings-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
          >
            <div className="modal-header">
              <div>
                <span className="eyebrow">CONFIGURACIÓN LOCAL</span>
                <h2 id="settings-title">Datos de Intelly</h2>
                <p>
                  Esta información aparecerá en todas las órdenes y se guardará
                  en este navegador.
                </p>
              </div>
              {requiredSettings(settings) && (
                <button
                  className="icon-button"
                  onClick={() => setSettingsOpen(false)}
                  aria-label="Cerrar configuración"
                >
                  <X size={20} />
                </button>
              )}
            </div>

            <div className="settings-content">
              <fieldset>
                <legend>
                  <Building2 size={18} /> Empresa
                </legend>
                <div className="form-grid two-columns">
                  <label>
                    <span>Razón social *</span>
                    <input
                      value={draftSettings.companyName}
                      onChange={(event) =>
                        setDraftSettings({
                          ...draftSettings,
                          companyName: event.target.value,
                        })
                      }
                      placeholder="Intelly SpA"
                    />
                  </label>
                  <label>
                    <span>RUT *</span>
                    <input
                      value={draftSettings.companyRut}
                      onChange={(event) =>
                        setDraftSettings({
                          ...draftSettings,
                          companyRut: event.target.value,
                        })
                      }
                      placeholder="76.000.000-0"
                    />
                  </label>
                  <label>
                    <span>Giro</span>
                    <input
                      value={draftSettings.businessLine}
                      onChange={(event) =>
                        setDraftSettings({
                          ...draftSettings,
                          businessLine: event.target.value,
                        })
                      }
                      placeholder="Servicios de tecnología"
                    />
                  </label>
                  <label>
                    <span>Dirección</span>
                    <input
                      value={draftSettings.address}
                      onChange={(event) =>
                        setDraftSettings({
                          ...draftSettings,
                          address: event.target.value,
                        })
                      }
                      placeholder="Ciudad, Chile"
                    />
                  </label>
                  <label>
                    <span>Correo</span>
                    <input
                      type="email"
                      value={draftSettings.email}
                      onChange={(event) =>
                        setDraftSettings({
                          ...draftSettings,
                          email: event.target.value,
                        })
                      }
                      placeholder="contacto@intelly.cl"
                    />
                  </label>
                  <label>
                    <span>Teléfono</span>
                    <input
                      value={draftSettings.phone}
                      onChange={(event) =>
                        setDraftSettings({
                          ...draftSettings,
                          phone: event.target.value,
                        })
                      }
                      placeholder="+56 9 0000 0000"
                    />
                  </label>
                </div>
              </fieldset>

              <fieldset>
                <legend>
                  <Landmark size={18} /> Cuenta para transferencia
                </legend>
                <div className="form-grid two-columns">
                  <label>
                    <span>Banco *</span>
                    <input
                      value={draftSettings.bankName}
                      onChange={(event) =>
                        setDraftSettings({
                          ...draftSettings,
                          bankName: event.target.value,
                        })
                      }
                      placeholder="Nombre del banco"
                    />
                  </label>
                  <label>
                    <span>Tipo de cuenta *</span>
                    <input
                      value={draftSettings.accountType}
                      onChange={(event) =>
                        setDraftSettings({
                          ...draftSettings,
                          accountType: event.target.value,
                        })
                      }
                      placeholder="Cuenta corriente"
                    />
                  </label>
                  <label>
                    <span>Número de cuenta *</span>
                    <input
                      value={draftSettings.accountNumber}
                      onChange={(event) =>
                        setDraftSettings({
                          ...draftSettings,
                          accountNumber: event.target.value,
                        })
                      }
                      placeholder="0000000000"
                    />
                  </label>
                  <label>
                    <span>Titular *</span>
                    <input
                      value={draftSettings.accountHolder}
                      onChange={(event) =>
                        setDraftSettings({
                          ...draftSettings,
                          accountHolder: event.target.value,
                        })
                      }
                      placeholder="Razón social del titular"
                    />
                  </label>
                  <label>
                    <span>RUT del titular</span>
                    <input
                      value={draftSettings.accountRut}
                      onChange={(event) =>
                        setDraftSettings({
                          ...draftSettings,
                          accountRut: event.target.value,
                        })
                      }
                      placeholder="76.000.000-0"
                    />
                  </label>
                  <label>
                    <span>Correo para comprobante</span>
                    <div className="input-with-icon">
                      <Mail size={16} />
                      <input
                        type="email"
                        value={draftSettings.transferEmail}
                        onChange={(event) =>
                          setDraftSettings({
                            ...draftSettings,
                            transferEmail: event.target.value,
                          })
                        }
                        placeholder="pagos@intelly.cl"
                      />
                    </div>
                  </label>
                </div>
              </fieldset>

              <fieldset>
                <legend>
                  <CircleDollarSign size={18} /> Condiciones y plazos
                </legend>
                <div className="form-grid conditions-grid">
                  <label>
                    <span>Días para vencimiento</span>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={draftSettings.dueDays}
                      onChange={(event) =>
                        setDraftSettings({
                          ...draftSettings,
                          dueDays: Number(event.target.value),
                        })
                      }
                    />
                  </label>
                  <label className="wide-field">
                    <span>Condiciones comerciales *</span>
                    <textarea
                      rows={3}
                      value={draftSettings.paymentTerms}
                      onChange={(event) =>
                        setDraftSettings({
                          ...draftSettings,
                          paymentTerms: event.target.value,
                        })
                      }
                      placeholder="Describe la vigencia, activación, renovación y plazos del servicio."
                    />
                  </label>
                  <label className="wide-field">
                    <span>Instrucciones adicionales de pago</span>
                    <textarea
                      rows={2}
                      value={draftSettings.paymentInstructions}
                      onChange={(event) =>
                        setDraftSettings({
                          ...draftSettings,
                          paymentInstructions: event.target.value,
                        })
                      }
                      placeholder="Ej.: indicar el número de orden en el comentario de la transferencia."
                    />
                  </label>
                </div>
              </fieldset>
            </div>

            <div className="modal-footer">
              <span>Los campos con * son obligatorios.</span>
              <button className="button button-primary" onClick={saveSettings}>
                <Save size={17} /> Guardar configuración
              </button>
            </div>
          </section>
        </div>
      )}

      {historyOpen && (
        <div
          className="drawer-backdrop"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setHistoryOpen(false);
          }}
        >
          <aside
            className="history-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="history-title"
          >
            <div className="drawer-header">
              <div>
                <span className="eyebrow">ALMACENAMIENTO LOCAL</span>
                <h2 id="history-title">Historial de órdenes</h2>
                <p>{orders.length} documentos guardados en este navegador.</p>
              </div>
              <button
                className="icon-button"
                onClick={() => setHistoryOpen(false)}
                aria-label="Cerrar historial"
              >
                <X size={20} />
              </button>
            </div>

            <div className="history-list">
              {orders.length === 0 ? (
                <div className="empty-history">
                  <History size={28} />
                  <h3>Aún no hay órdenes guardadas</h3>
                  <p>
                    Cuando guardes o descargues una orden, aparecerá aquí.
                  </p>
                  <button
                    className="button button-primary"
                    onClick={() => setHistoryOpen(false)}
                  >
                    Crear primera orden <ChevronRight size={17} />
                  </button>
                </div>
              ) : (
                orders.map((saved) => {
                  const savedSubtotal = saved.items.reduce(
                    (sum, item) => sum + Number(item.amount || 0),
                    0,
                  );
                  const savedDiscount = Math.round(
                    savedSubtotal *
                      (Math.min(
                        100,
                        Math.max(0, Number(saved.discountPercent) || 0),
                      ) /
                        100),
                  );
                  const savedDiscountedSubtotal =
                    savedSubtotal - savedDiscount;
                  const savedTotal =
                    savedDiscountedSubtotal +
                    (saved.invoice
                      ? Math.round(savedDiscountedSubtotal * 0.19)
                      : 0);
                  return (
                    <article className="history-card" key={saved.id}>
                      <button
                        className="history-card-main"
                        onClick={() => loadOrder(saved)}
                      >
                        <div>
                          <span>{saved.number}</span>
                          <strong>{saved.customerName}</strong>
                          <small>
                            Emitida {formatDate(saved.issueDate)} ·{" "}
                            {saved.invoice ? "Con factura" : "Sin factura"}
                          </small>
                        </div>
                        <strong>{formatClp(savedTotal)}</strong>
                      </button>
                      <div className="history-card-actions">
                        <button onClick={() => loadOrder(saved)}>
                          <FileText size={15} /> Abrir
                        </button>
                        <button onClick={() => duplicateOrder(saved)}>
                          <Copy size={15} /> Duplicar
                        </button>
                        <button onClick={() => downloadOrder(saved)}>
                          <Download size={15} /> PDF
                        </button>
                        <button
                          className="danger-action"
                          onClick={() => deleteOrder(saved)}
                        >
                          <Trash2 size={15} /> Eliminar
                        </button>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </aside>
        </div>
      )}

      {toast && (
        <div className={`toast toast-${toast.tone}`} role="status">
          {toast.tone === "success" ? <Check size={18} /> : <X size={18} />}
          <span>{toast.message}</span>
        </div>
      )}
    </main>
  );
}
