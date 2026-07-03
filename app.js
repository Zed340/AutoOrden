/* ===================================================================
   AUTOORDEN — TIENDA LOGICA (app.js)
   Maneja: estado en localStorage, widget de inventario, busqueda por voz,
   seleccion de producto, formulario de pedido, precios, entrega via WhatsApp,
   modales, carruseles, y animaciones de revelacion al hacer scroll.
=================================================================== */

/* -------------------------------------------------------------
   0. CONSTANTES
------------------------------------------------------------- */
const LS_INVENTORY = 'autoorden_inventory';
const LS_PENDING   = 'autoorden_pending';
const LS_SALES     = 'autoorden_sales';

const WHATSAPP_NUMBER = '09161561826';

const PRODUCTS = {
  slim: { id: 'slim', name: 'Ejecutiva de Perfil Delgado', price: 100 },
  tray: { id: 'tray', name: 'Edición Viaje con Bandeja Inteligente', price: 120 }
};

const BULK_MIN_QTY = 3;
const BULK_DISCOUNT_PER_UNIT = 10; // PEN de descuento por unidad cuando la cantidad >= BULK_MIN_QTY

const WILAYAT = [
  'Amazonas', 'Ancash', 'Apurímac', 'Arequipa', 'Ayacucho',
  'Cajamarca', 'Callao', 'Cusco', 'Huancavelica', 'Huánuco',
  'Ica', 'Junín', 'La Libertad', 'Lambayeque', 'Lima',
  'Loreto', 'Madre de Dios', 'Moquegua', 'Pasco', 'Piura',
  'Puno', 'San Martín', 'Tacna', 'Tumbes', 'Ucayali'
];

const KNOWLEDGE_BASE = [
  {
    keys: ['envío', 'delivery', 'shipping', 'llegar', 'cuánto', 'días'],
    label: 'Tiempo de envío',
    answer: 'El envío tarda de 2 a 5 días hábiles en todas las regiones de Perú, puerta a puerta.'
  },
  {
    keys: ['abierto', 'horarios', 'soporte', 'disponible', 'contacto'],
    label: 'Horarios',
    answer: 'Los pedidos son aceptados 24/7. Nuestro equipo de soporte por WhatsApp está disponible todos los días de 8 AM a 10 PM (PET).'
  },
  {
    keys: ['material', 'cuero', 'alpaca', 'hecho de', 'calidad', 'garantía'],
    label: 'Materiales',
    answer: 'Cada pieza está elaborada con alpaca peruana premium y cuero genuino, inspirado en tradiciones andinas, respaldada por una garantía de 10 años.'
  },
  {
    keys: ['mayorista', 'descuento', 'por mayor', 'más de', 'cantidad', 'bulk'],
    label: 'Descuento por mayor',
    answer: 'Pedidos de 3 unidades o más reciben un descuento especial en cada unidad del pedido.'
  }
];

/* -------------------------------------------------------------
   1. INICIALIZACION DEL ESTADO
------------------------------------------------------------- */
function initState() {
  if (!localStorage.getItem(LS_INVENTORY)) {
    localStorage.setItem(LS_INVENTORY, JSON.stringify({ total: 1000, sold: 0 }));
  }
  if (!localStorage.getItem(LS_PENDING)) {
    localStorage.setItem(LS_PENDING, JSON.stringify([]));
  }
  if (!localStorage.getItem(LS_SALES)) {
    localStorage.setItem(LS_SALES, JSON.stringify([]));
  }
}

function getInventory() { return JSON.parse(localStorage.getItem(LS_INVENTORY)); }
function getPending() { return JSON.parse(localStorage.getItem(LS_PENDING)); }
function setPending(arr) { localStorage.setItem(LS_PENDING, JSON.stringify(arr)); }

/* -------------------------------------------------------------
   2. WIDGET DE INVENTARIO
------------------------------------------------------------- */
function renderInventoryWidget() {
  const inv = getInventory();
  const remaining = Math.max(inv.total - inv.sold, 0);
  const pctSold = Math.min((inv.sold / inv.total) * 100, 100);

  const remainingEl = document.getElementById('invRemaining');
  const fillEl = document.getElementById('invFill');
  if (remainingEl) remainingEl.textContent = remaining.toLocaleString();
  if (fillEl) fillEl.style.width = pctSold + '%';
}

/* -------------------------------------------------------------
   3. REVELACION AL HACER SCROLL (IntersectionObserver)
------------------------------------------------------------- */
function initScrollReveal() {
  const items = document.querySelectorAll('.reveal');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  items.forEach((el) => observer.observe(el));
}

/* -------------------------------------------------------------
   4. BUSQUEDA POR VOZ (Web Speech API + base de conocimiento local)
------------------------------------------------------------- */
function findAnswer(query) {
  const q = query.toLowerCase();
  const match = KNOWLEDGE_BASE.find((entry) => entry.keys.some((k) => q.includes(k)));
  return match || null;
}

function showAiResponse(query) {
  const card = document.getElementById('aiResponse');
  if (!card) return;
  const match = findAnswer(query);

  if (match) {
    card.innerHTML = `<span class="ai-label">${match.label}</span>${match.answer}`;
  } else {
    card.innerHTML = `<span class="ai-label">AutoOrden</span>No pudimos encontrar una respuesta exacta a "${escapeHtml(query)}". Intenta preguntar sobre envíos, materiales, horarios o descuentos al por mayor, o contáctanos directamente por WhatsApp.`;
  }
  card.classList.add('show');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function initVoiceSearch() {
  const input = document.getElementById('voiceInput');
  const micBtn = document.getElementById('micBtn');
  const askBtn = document.getElementById('askBtn');
  if (!input || !micBtn || !askBtn) return;

  askBtn.addEventListener('click', () => {
    if (input.value.trim()) showAiResponse(input.value.trim());
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && input.value.trim()) showAiResponse(input.value.trim());
  });

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    micBtn.title = 'La búsqueda por voz no es compatible con este navegador';
    micBtn.addEventListener('click', () => {
      micBtn.title = 'La búsqueda por voz no es compatible con este navegador. Por favor, escribe tu pregunta.';
    });
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = 'es-PE'; // Español de Perú
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  micBtn.addEventListener('click', () => {
    micBtn.classList.add('listening');
    try { recognition.start(); } catch (err) { /* ya está iniciado */ }
  });

  recognition.addEventListener('result', (event) => {
    const transcript = event.results[0][0].transcript;
    input.value = transcript;
    showAiResponse(transcript);
  });

  recognition.addEventListener('end', () => micBtn.classList.remove('listening'));
  recognition.addEventListener('error', () => micBtn.classList.remove('listening'));
}

/* -------------------------------------------------------------
   5. ESTADO DEL PEDIDO
------------------------------------------------------------- */
const orderState = {
  model: 'slim',
  qty: 1
};

function selectModel(modelId) {
  orderState.model = modelId;
  document.querySelectorAll('.model-option').forEach((el) => {
    el.classList.toggle('active', el.dataset.model === modelId);
  });
  updateTotals();
}

function setQty(qty) {
  orderState.qty = Math.max(1, qty);

  document.querySelectorAll('.qty-pick').forEach((btn) => {
    const btnQty = btn.dataset.qty;
    const isBulk = btnQty === '3plus';
    btn.classList.toggle('active', isBulk ? orderState.qty >= 3 : Number(btnQty) === orderState.qty);
  });

  const stepper = document.getElementById('bulkStepper');
  const bulkInput = document.getElementById('bulkInput');
  if (orderState.qty >= BULK_MIN_QTY) {
    stepper.classList.add('show');
    bulkInput.value = orderState.qty;
  } else {
    stepper.classList.remove('show');
  }

  updateTotals();
}

function adjustBulk(delta) {
  const next = Math.max(BULK_MIN_QTY, orderState.qty + delta);
  setQty(next);
}

function calcTotal() {
  const product = PRODUCTS[orderState.model];
  const qty = orderState.qty;
  const isBulk = qty >= BULK_MIN_QTY;
  const unitPrice = isBulk ? product.price - BULK_DISCOUNT_PER_UNIT : product.price;
  return { unitPrice, qty, total: unitPrice * qty, isBulk };
}

function updateTotals() {
  const { total, isBulk } = calcTotal();
  const totalEl = document.getElementById('totalValue');
  const badge = document.getElementById('discountBadge');
  if (totalEl) totalEl.textContent = total + ' PEN';
  if (badge) badge.classList.toggle('show', isBulk);
}

/* -------------------------------------------------------------
   6. ENVIO DEL PEDIDO -> localStorage + entrega via WhatsApp
------------------------------------------------------------- */
function generateOrderId() {
  return 'AO-' + Date.now().toString(36).toUpperCase();
}

function submitOrder(e) {
  e.preventDefault();

  const name = document.getElementById('orderName').value.trim();
  const phone = document.getElementById('orderPhone').value.trim();
  const wilayah = document.getElementById('orderWilayah').value;
  const address = document.getElementById('orderAddress').value.trim();
  const errorEl = document.getElementById('formError');

  if (!name || !phone || !wilayah || !address) {
    errorEl.textContent = 'Por favor, completa tu nombre, número de teléfono, región y dirección antes de continuar.';
    errorEl.classList.add('show');
    return;
  }
  errorEl.classList.remove('show');

  const { unitPrice, qty, total } = calcTotal();
  const product = PRODUCTS[orderState.model];

  const order = {
    id: generateOrderId(),
    name,
    phone,
    qty,
    productId: product.id,
    total,
    ts: Date.now(),
    wilayah,
    address,
    status: 'pending'
  };

  const pending = getPending();
  pending.push(order);
  setPending(pending);

  const verifyLink = `${window.location.origin}${window.location.pathname.replace('index.html', '')}admin.html?ref=${order.id}`;

  const message =
    `*Nuevo Pedido AutoOrden*%0A` +
    `Modelo: ${product.name}%0A` +
    `Nombre: ${name}%0A` +
    `Teléfono: ${phone}%0A` +
    `Región: ${wilayah}%0A` +
    `Dirección: ${address}%0A` +
    `Cantidad: ${qty}%0A` +
    `Precio Unitario: ${unitPrice} PEN%0A` +
    `Total: ${total} PEN%0A` +
    `Ref Pedido: ${order.id}%0A` +
    `Verificación Admin: ${encodeURIComponent(verifyLink)}`;

  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${message}`, '_blank');

  document.getElementById('orderForm').reset();
  setQty(1);
  showModal('orderConfirmModal');
}

/* -------------------------------------------------------------
   7. MODALES
------------------------------------------------------------- */
function showModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('show');
}
function hideModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('show');
}

function initModals() {
  document.querySelectorAll('[data-open-modal]').forEach((btn) => {
    btn.addEventListener('click', () => showModal(btn.dataset.openModal));
  });
  document.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', () => hideModal(btn.dataset.closeModal));
  });
  document.querySelectorAll('.modal-overlay').forEach((overlay) => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.remove('show');
    });
  });

  // El ícono de reproducción de los reels abre el modal de video
  document.querySelectorAll('.reel-item[data-video]').forEach((item) => {
    const playIcon = item.querySelector('.play-icon');
    const video = item.querySelector('.video-preview');
    
    // Reproducir al pasar el mouse
    item.addEventListener('mouseenter', () => {
      if (video) {
        video.currentTime = 0;
        video.play().catch(() => {});
      }
    });
    
    item.addEventListener('mouseleave', () => {
      if (video) {
        video.pause();
        video.currentTime = 0;
      }
    });
    
    // Clic en cualquier parte de la tarjeta abre el modal
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      openVideoModal(item);
    });
    
    // Clic en el ícono de reproducción abre el modal
    if (playIcon) {
      playIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        openVideoModal(item);
      });
    }
  });
  
  // Función para abrir el modal de video con contenido
  function openVideoModal(item) {
    const player = document.getElementById('videoPlayer');
    const titleEl = document.getElementById('videoModalTitle');
    const descEl = document.getElementById('videoModalDescription');
    
    player.src = item.dataset.video;
    titleEl.textContent = item.dataset.title || '';
    descEl.textContent = item.dataset.description || '';
    
    showModal('videoModal');
    player.play().catch(() => {});
  }

  document.querySelectorAll('[data-close-modal="videoModal"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const player = document.getElementById('videoPlayer');
      player.pause();
      player.currentTime = 0;
    });
  });
}

/* -------------------------------------------------------------
   8. CONECTAR EVENTOS DE LA UI ESTATICA
------------------------------------------------------------- */
function initOrderControls() {
  document.querySelectorAll('.model-option').forEach((el) => {
    el.addEventListener('click', () => selectModel(el.dataset.model));
  });

  document.querySelectorAll('.qty-pick').forEach((btn) => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.qty;
      setQty(val === '3plus' ? Math.max(3, orderState.qty) : Number(val));
    });
  });

  document.getElementById('bulkMinus')?.addEventListener('click', () => adjustBulk(-1));
  document.getElementById('bulkPlus')?.addEventListener('click', () => adjustBulk(1));
  document.getElementById('bulkInput')?.addEventListener('change', (e) => {
    setQty(Math.max(BULK_MIN_QTY, Number(e.target.value) || BULK_MIN_QTY));
  });

  document.querySelectorAll('.bulk-preset').forEach((btn) => {
    btn.addEventListener('click', () => setQty(Number(btn.dataset.preset)));
  });

  document.getElementById('orderForm')?.addEventListener('submit', submitOrder);

  // Los botones "Seleccionar este modelo" en las tarjetas de productos se dirigen a la sección de pedido preseleccionado
  document.querySelectorAll('[data-select-model]').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectModel(btn.dataset.selectModel);
      document.getElementById('order')?.scrollIntoView({ behavior: 'smooth' });
    });
  });
}

/* -------------------------------------------------------------
   8. CARRUSEL
------------------------------------------------------------- */
function initCarousel(reelId, leftArrowId, rightArrowId, scrollAmount) {
  const reel = document.getElementById(reelId);
  const leftArrow = document.getElementById(leftArrowId);
  const rightArrow = document.getElementById(rightArrowId);
  if (!reel) return;

  let autoScrollInterval;
  const scrollSpeed = 1800; // ms por scroll - más rápido!

  // Agregar comportamiento de scroll suave
  reel.style.scrollBehavior = 'smooth';

  function startAutoScroll() {
    stopAutoScroll();
    autoScrollInterval = setInterval(() => {
      // Verificar si estamos al final, si es así, volver al principio
      if (reel.scrollLeft + reel.clientWidth >= reel.scrollWidth - 10) {
        reel.scrollLeft = 0;
      } else {
        reel.scrollLeft += scrollAmount;
      }
    }, scrollSpeed);
  }

  function stopAutoScroll() {
    if (autoScrollInterval) {
      clearInterval(autoScrollInterval);
      autoScrollInterval = null;
    }
  }

  // Controles de flechas
  leftArrow?.addEventListener('click', () => {
    reel.scrollLeft -= scrollAmount;
  });
  rightArrow?.addEventListener('click', () => {
    reel.scrollLeft += scrollAmount;
  });

  // Pausar al pasar el mouse
  reel.addEventListener('mouseenter', stopAutoScroll);
  reel.addEventListener('mouseleave', startAutoScroll);

  // Pausar cuando el usuario hace scroll manualmente
  let isUserScrolling = false;
  let scrollTimeout;
  reel.addEventListener('scroll', () => {
    if (!isUserScrolling) {
      stopAutoScroll();
      isUserScrolling = true;
    }
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      isUserScrolling = false;
      startAutoScroll();
    }, 1500); // Reanudar scroll automático más rápido después de scroll manual
  });

  startAutoScroll();
}

/* -------------------------------------------------------------
   9. INICIALIZACION
------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  // Ocultar precargador después de un breve retraso
  setTimeout(() => {
    const preloader = document.getElementById('preloader');
    if (preloader) {
      preloader.classList.add('hidden');
    }
  }, 2000);

  initState();
  renderInventoryWidget();
  initScrollReveal();
  initVoiceSearch();
  initModals();
  initOrderControls();
  initCarousel('collectionReel', 'reelLeftArrow', 'reelRightArrow', 278); // 260px + 18px de espacio
  initCarousel('videoReel', 'videoReelLeftArrow', 'videoReelRightArrow', 218); // 200px + 18px de espacio
  selectModel('slim');
  setQty(1);
});
