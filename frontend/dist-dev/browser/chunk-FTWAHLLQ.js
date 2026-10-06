import {
  DefaultValueAccessor,
  FormsModule,
  MaxLengthValidator,
  MinValidator,
  NgControlStatus,
  NgControlStatusGroup,
  NgForm,
  NgModel,
  NgSelectOption,
  NumberValueAccessor,
  SelectControlValueAccessor,
  ɵNgNoValidate,
  ɵNgSelectMultipleOption
} from "./chunk-2RN6BVV4.js";
import {
  KdsService
} from "./chunk-TKK4VM7C.js";
import {
  Component,
  RouterLink,
  environment,
  setClassMetadata,
  signal,
  ɵsetClassDebugInfo,
  ɵɵadvance,
  ɵɵconditional,
  ɵɵconditionalCreate,
  ɵɵdefineComponent,
  ɵɵdirectiveInject,
  ɵɵelementEnd,
  ɵɵelementStart,
  ɵɵgetCurrentView,
  ɵɵlistener,
  ɵɵnextContext,
  ɵɵproperty,
  ɵɵrepeater,
  ɵɵrepeaterCreate,
  ɵɵrepeaterTrackByIndex,
  ɵɵresetView,
  ɵɵrestoreView,
  ɵɵtext,
  ɵɵtextInterpolate,
  ɵɵtextInterpolate1,
  ɵɵtextInterpolate2,
  ɵɵtwoWayBindingSet,
  ɵɵtwoWayListener,
  ɵɵtwoWayProperty
} from "./chunk-IY7DZLXM.js";
import "./chunk-NILDOHVQ.js";

// src/app/kds/pos/pos.component.ts
function PosComponent_Conditional_50_For_2_Conditional_3_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "small");
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const item_r2 = \u0275\u0275nextContext().$implicit;
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(item_r2.notes);
  }
}
function PosComponent_Conditional_50_For_2_Template(rf, ctx) {
  if (rf & 1) {
    const _r1 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "li")(1, "span");
    \u0275\u0275text(2);
    \u0275\u0275elementEnd();
    \u0275\u0275conditionalCreate(3, PosComponent_Conditional_50_For_2_Conditional_3_Template, 2, 1, "small");
    \u0275\u0275elementStart(4, "button", 26);
    \u0275\u0275listener("click", function PosComponent_Conditional_50_For_2_Template_button_click_4_listener() {
      const $index_r3 = \u0275\u0275restoreView(_r1).$index;
      const ctx_r3 = \u0275\u0275nextContext(2);
      return \u0275\u0275resetView(ctx_r3.quitarItem($index_r3));
    });
    \u0275\u0275text(5, "Quitar");
    \u0275\u0275elementEnd()();
  }
  if (rf & 2) {
    const item_r2 = ctx.$implicit;
    \u0275\u0275advance(2);
    \u0275\u0275textInterpolate2("", item_r2.quantity, "\xD7 ", item_r2.productName);
    \u0275\u0275advance();
    \u0275\u0275conditional(item_r2.notes ? 3 : -1);
  }
}
function PosComponent_Conditional_50_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "ul");
    \u0275\u0275repeaterCreate(1, PosComponent_Conditional_50_For_2_Template, 6, 3, "li", null, \u0275\u0275repeaterTrackByIndex);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const ctx_r3 = \u0275\u0275nextContext();
    \u0275\u0275advance();
    \u0275\u0275repeater(ctx_r3.items());
  }
}
function PosComponent_Conditional_51_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "p", 22);
    \u0275\u0275text(1, "Sin productos todav\xEDa");
    \u0275\u0275elementEnd();
  }
}
function PosComponent_Conditional_54_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "p", 24);
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const ctx_r3 = \u0275\u0275nextContext();
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(ctx_r3.mensaje());
  }
}
function PosComponent_Conditional_55_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "p", 25);
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const ctx_r3 = \u0275\u0275nextContext();
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(ctx_r3.error());
  }
}
var PosComponent = class _PosComponent {
  kds;
  tenant = environment.displayName;
  displayCode = signal("", ...ngDevMode ? [{ debugName: "displayCode" }] : (
    /* istanbul ignore next */
    []
  ));
  channel = signal("DINE_IN", ...ngDevMode ? [{ debugName: "channel" }] : (
    /* istanbul ignore next */
    []
  ));
  priority = signal("NORMAL", ...ngDevMode ? [{ debugName: "priority" }] : (
    /* istanbul ignore next */
    []
  ));
  customerName = signal("", ...ngDevMode ? [{ debugName: "customerName" }] : (
    /* istanbul ignore next */
    []
  ));
  notes = signal("", ...ngDevMode ? [{ debugName: "notes" }] : (
    /* istanbul ignore next */
    []
  ));
  items = signal([], ...ngDevMode ? [{ debugName: "items" }] : (
    /* istanbul ignore next */
    []
  ));
  itemName = signal("", ...ngDevMode ? [{ debugName: "itemName" }] : (
    /* istanbul ignore next */
    []
  ));
  itemQuantity = signal(1, ...ngDevMode ? [{ debugName: "itemQuantity" }] : (
    /* istanbul ignore next */
    []
  ));
  itemNotes = signal("", ...ngDevMode ? [{ debugName: "itemNotes" }] : (
    /* istanbul ignore next */
    []
  ));
  enviando = signal(false, ...ngDevMode ? [{ debugName: "enviando" }] : (
    /* istanbul ignore next */
    []
  ));
  mensaje = signal(null, ...ngDevMode ? [{ debugName: "mensaje" }] : (
    /* istanbul ignore next */
    []
  ));
  error = signal(null, ...ngDevMode ? [{ debugName: "error" }] : (
    /* istanbul ignore next */
    []
  ));
  constructor(kds) {
    this.kds = kds;
  }
  agregarItem() {
    const nombre = this.itemName().trim();
    if (!nombre || this.itemQuantity() < 1) {
      return;
    }
    this.items.update((lista) => [
      ...lista,
      { productName: nombre, quantity: this.itemQuantity(), notes: this.itemNotes().trim() || void 0 }
    ]);
    this.itemName.set("");
    this.itemQuantity.set(1);
    this.itemNotes.set("");
  }
  quitarItem(indice) {
    this.items.update((lista) => lista.filter((_, i) => i !== indice));
  }
  enviar() {
    if (this.items().length === 0) {
      this.error.set("Agrega al menos un producto");
      return;
    }
    this.enviando.set(true);
    this.mensaje.set(null);
    this.error.set(null);
    this.kds.createOrder({
      displayCode: this.displayCode().trim() || this.codigoAleatorio(),
      channel: this.channel(),
      priority: this.priority(),
      customerName: this.customerName().trim() || null,
      notes: this.notes().trim() || null,
      items: this.items().map((item) => ({
        productName: item.productName,
        quantity: item.quantity,
        notes: item.notes ?? null
      }))
    }).subscribe({
      next: (pedido) => {
        this.mensaje.set(`Pedido ${pedido.displayCode} creado`);
        this.reiniciarFormulario();
      },
      error: () => {
        this.error.set("No se pudo crear el pedido (\xBFest\xE1 el backend corriendo?)");
        this.enviando.set(false);
      },
      complete: () => this.enviando.set(false)
    });
  }
  codigoAleatorio() {
    return `#P-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  }
  reiniciarFormulario() {
    this.displayCode.set("");
    this.customerName.set("");
    this.notes.set("");
    this.items.set([]);
  }
  static \u0275fac = function PosComponent_Factory(__ngFactoryType__) {
    return new (__ngFactoryType__ || _PosComponent)(\u0275\u0275directiveInject(KdsService));
  };
  static \u0275cmp = /* @__PURE__ */ \u0275\u0275defineComponent({ type: _PosComponent, selectors: [["app-pos"]], decls: 56, vars: 14, consts: [[1, "pos-encabezado"], [1, "etiqueta"], ["routerLink", "/kds", 1, "volver"], [1, "pos"], [1, "panel", 3, "ngSubmit"], [1, "fila"], ["type", "text", "name", "displayCode", "placeholder", "#P-XXXX", "maxlength", "10", 3, "ngModelChange", "ngModel"], ["name", "channel", 3, "ngModelChange", "ngModel"], ["value", "DINE_IN"], ["value", "TAKEAWAY"], ["value", "DELIVERY"], ["name", "priority", 3, "ngModelChange", "ngModel"], ["value", "NORMAL"], ["value", "HIGH"], ["value", "VIP"], ["type", "text", "name", "customerName", "maxlength", "100", 3, "ngModelChange", "ngModel"], ["type", "text", "name", "notes", 3, "ngModelChange", "ngModel"], [1, "items"], ["type", "text", "name", "itemName", "placeholder", "Producto", 1, "crecer", 3, "ngModelChange", "ngModel"], ["type", "number", "name", "itemQuantity", "min", "1", 1, "cantidad", 3, "ngModelChange", "ngModel"], ["type", "text", "name", "itemNotes", "placeholder", "Nota (opcional)", 1, "crecer", 3, "ngModelChange", "ngModel"], ["type", "button", 1, "secundario", 3, "click"], [1, "vacio"], ["type", "submit", 1, "enviar", 3, "disabled"], ["role", "status", 1, "exito"], ["role", "alert", 1, "error"], ["type", "button", 1, "quitar", 3, "click"]], template: function PosComponent_Template(rf, ctx) {
    if (rf & 1) {
      \u0275\u0275elementStart(0, "header", 0)(1, "div")(2, "p", 1);
      \u0275\u0275text(3, "Simulador POS");
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(4, "h1");
      \u0275\u0275text(5);
      \u0275\u0275elementEnd()();
      \u0275\u0275elementStart(6, "a", 2);
      \u0275\u0275text(7, "\u2190 Volver al tablero");
      \u0275\u0275elementEnd()();
      \u0275\u0275elementStart(8, "main", 3)(9, "form", 4);
      \u0275\u0275listener("ngSubmit", function PosComponent_Template_form_ngSubmit_9_listener() {
        return ctx.enviar();
      });
      \u0275\u0275elementStart(10, "h2");
      \u0275\u0275text(11, "Nuevo pedido");
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(12, "div", 5)(13, "label");
      \u0275\u0275text(14, " C\xF3digo (opcional) ");
      \u0275\u0275elementStart(15, "input", 6);
      \u0275\u0275twoWayListener("ngModelChange", function PosComponent_Template_input_ngModelChange_15_listener($event) {
        \u0275\u0275twoWayBindingSet(ctx.displayCode, $event) || (ctx.displayCode = $event);
        return $event;
      });
      \u0275\u0275elementEnd()();
      \u0275\u0275elementStart(16, "label");
      \u0275\u0275text(17, " Canal ");
      \u0275\u0275elementStart(18, "select", 7);
      \u0275\u0275twoWayListener("ngModelChange", function PosComponent_Template_select_ngModelChange_18_listener($event) {
        \u0275\u0275twoWayBindingSet(ctx.channel, $event) || (ctx.channel = $event);
        return $event;
      });
      \u0275\u0275elementStart(19, "option", 8);
      \u0275\u0275text(20, "En local");
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(21, "option", 9);
      \u0275\u0275text(22, "Para llevar");
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(23, "option", 10);
      \u0275\u0275text(24, "Domicilio");
      \u0275\u0275elementEnd()()();
      \u0275\u0275elementStart(25, "label");
      \u0275\u0275text(26, " Prioridad ");
      \u0275\u0275elementStart(27, "select", 11);
      \u0275\u0275twoWayListener("ngModelChange", function PosComponent_Template_select_ngModelChange_27_listener($event) {
        \u0275\u0275twoWayBindingSet(ctx.priority, $event) || (ctx.priority = $event);
        return $event;
      });
      \u0275\u0275elementStart(28, "option", 12);
      \u0275\u0275text(29, "Normal");
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(30, "option", 13);
      \u0275\u0275text(31, "Alta");
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(32, "option", 14);
      \u0275\u0275text(33, "VIP");
      \u0275\u0275elementEnd()()()();
      \u0275\u0275elementStart(34, "div", 5)(35, "label");
      \u0275\u0275text(36, " Cliente (opcional) ");
      \u0275\u0275elementStart(37, "input", 15);
      \u0275\u0275twoWayListener("ngModelChange", function PosComponent_Template_input_ngModelChange_37_listener($event) {
        \u0275\u0275twoWayBindingSet(ctx.customerName, $event) || (ctx.customerName = $event);
        return $event;
      });
      \u0275\u0275elementEnd()();
      \u0275\u0275elementStart(38, "label");
      \u0275\u0275text(39, " Notas generales (opcional) ");
      \u0275\u0275elementStart(40, "input", 16);
      \u0275\u0275twoWayListener("ngModelChange", function PosComponent_Template_input_ngModelChange_40_listener($event) {
        \u0275\u0275twoWayBindingSet(ctx.notes, $event) || (ctx.notes = $event);
        return $event;
      });
      \u0275\u0275elementEnd()()();
      \u0275\u0275elementStart(41, "section", 17)(42, "h3");
      \u0275\u0275text(43, "Productos");
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(44, "div", 5)(45, "input", 18);
      \u0275\u0275twoWayListener("ngModelChange", function PosComponent_Template_input_ngModelChange_45_listener($event) {
        \u0275\u0275twoWayBindingSet(ctx.itemName, $event) || (ctx.itemName = $event);
        return $event;
      });
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(46, "input", 19);
      \u0275\u0275twoWayListener("ngModelChange", function PosComponent_Template_input_ngModelChange_46_listener($event) {
        \u0275\u0275twoWayBindingSet(ctx.itemQuantity, $event) || (ctx.itemQuantity = $event);
        return $event;
      });
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(47, "input", 20);
      \u0275\u0275twoWayListener("ngModelChange", function PosComponent_Template_input_ngModelChange_47_listener($event) {
        \u0275\u0275twoWayBindingSet(ctx.itemNotes, $event) || (ctx.itemNotes = $event);
        return $event;
      });
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(48, "button", 21);
      \u0275\u0275listener("click", function PosComponent_Template_button_click_48_listener() {
        return ctx.agregarItem();
      });
      \u0275\u0275text(49, "Agregar");
      \u0275\u0275elementEnd()();
      \u0275\u0275conditionalCreate(50, PosComponent_Conditional_50_Template, 3, 0, "ul")(51, PosComponent_Conditional_51_Template, 2, 0, "p", 22);
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(52, "button", 23);
      \u0275\u0275text(53);
      \u0275\u0275elementEnd();
      \u0275\u0275conditionalCreate(54, PosComponent_Conditional_54_Template, 2, 1, "p", 24);
      \u0275\u0275conditionalCreate(55, PosComponent_Conditional_55_Template, 2, 1, "p", 25);
      \u0275\u0275elementEnd()();
    }
    if (rf & 2) {
      \u0275\u0275advance(5);
      \u0275\u0275textInterpolate(ctx.tenant);
      \u0275\u0275advance(10);
      \u0275\u0275twoWayProperty("ngModel", ctx.displayCode);
      \u0275\u0275advance(3);
      \u0275\u0275twoWayProperty("ngModel", ctx.channel);
      \u0275\u0275advance(9);
      \u0275\u0275twoWayProperty("ngModel", ctx.priority);
      \u0275\u0275advance(10);
      \u0275\u0275twoWayProperty("ngModel", ctx.customerName);
      \u0275\u0275advance(3);
      \u0275\u0275twoWayProperty("ngModel", ctx.notes);
      \u0275\u0275advance(5);
      \u0275\u0275twoWayProperty("ngModel", ctx.itemName);
      \u0275\u0275advance();
      \u0275\u0275twoWayProperty("ngModel", ctx.itemQuantity);
      \u0275\u0275advance();
      \u0275\u0275twoWayProperty("ngModel", ctx.itemNotes);
      \u0275\u0275advance(3);
      \u0275\u0275conditional(ctx.items().length > 0 ? 50 : 51);
      \u0275\u0275advance(2);
      \u0275\u0275property("disabled", ctx.enviando());
      \u0275\u0275advance();
      \u0275\u0275textInterpolate1(" ", ctx.enviando() ? "Enviando\u2026" : "Crear pedido", " ");
      \u0275\u0275advance();
      \u0275\u0275conditional(ctx.mensaje() ? 54 : -1);
      \u0275\u0275advance();
      \u0275\u0275conditional(ctx.error() ? 55 : -1);
    }
  }, dependencies: [FormsModule, \u0275NgNoValidate, NgSelectOption, \u0275NgSelectMultipleOption, DefaultValueAccessor, NumberValueAccessor, SelectControlValueAccessor, NgControlStatus, NgControlStatusGroup, MaxLengthValidator, MinValidator, NgModel, NgForm, RouterLink], styles: ["\n.pos-encabezado[_ngcontent-%COMP%] {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  padding: var(--space-4) var(--space-6);\n  border-bottom: 1px solid var(--color-border);\n  background: var(--color-surface);\n}\n.pos-encabezado[_ngcontent-%COMP%]   h1[_ngcontent-%COMP%] {\n  font-size: var(--text-xl);\n}\n.etiqueta[_ngcontent-%COMP%] {\n  margin: 0;\n  font-size: var(--text-xs);\n  letter-spacing: 0.12em;\n  text-transform: uppercase;\n  color: var(--color-accent);\n}\n.volver[_ngcontent-%COMP%] {\n  color: var(--color-ink-muted);\n  text-decoration: none;\n  font-size: var(--text-sm);\n}\n.volver[_ngcontent-%COMP%]:hover {\n  color: var(--color-ink);\n}\n.pos[_ngcontent-%COMP%] {\n  padding: var(--space-6);\n}\n.panel[_ngcontent-%COMP%] {\n  max-width: 720px;\n  margin: 0 auto;\n  background: var(--color-surface);\n  border: 1px solid var(--color-border);\n  border-radius: var(--radius-lg);\n  padding: var(--space-6);\n  display: flex;\n  flex-direction: column;\n  gap: var(--space-5);\n}\n.panel[_ngcontent-%COMP%]   h2[_ngcontent-%COMP%], \n.panel[_ngcontent-%COMP%]   h3[_ngcontent-%COMP%] {\n  margin: 0;\n}\n.fila[_ngcontent-%COMP%] {\n  display: flex;\n  gap: var(--space-4);\n  flex-wrap: wrap;\n  align-items: flex-end;\n}\nlabel[_ngcontent-%COMP%] {\n  display: flex;\n  flex-direction: column;\n  gap: var(--space-2);\n  font-size: var(--text-sm);\n  color: var(--color-ink-muted);\n  flex: 1;\n  min-width: 140px;\n}\ninput[_ngcontent-%COMP%], \nselect[_ngcontent-%COMP%] {\n  background: var(--color-paper);\n  border: 1px solid var(--color-border);\n  border-radius: var(--radius-sm);\n  padding: var(--space-3);\n  color: var(--color-ink);\n  font: inherit;\n}\n.crecer[_ngcontent-%COMP%] {\n  flex: 2;\n}\n.cantidad[_ngcontent-%COMP%] {\n  max-width: 90px;\n}\n.items[_ngcontent-%COMP%] {\n  display: flex;\n  flex-direction: column;\n  gap: var(--space-3);\n}\n.items[_ngcontent-%COMP%]   ul[_ngcontent-%COMP%] {\n  list-style: none;\n  margin: 0;\n  padding: 0;\n  display: flex;\n  flex-direction: column;\n  gap: var(--space-2);\n}\n.items[_ngcontent-%COMP%]   li[_ngcontent-%COMP%] {\n  display: flex;\n  align-items: center;\n  gap: var(--space-3);\n  background: var(--color-paper);\n  border: 1px solid var(--color-border);\n  border-radius: var(--radius-sm);\n  padding: var(--space-2) var(--space-3);\n  font-size: var(--text-sm);\n}\n.items[_ngcontent-%COMP%]   li[_ngcontent-%COMP%]   small[_ngcontent-%COMP%] {\n  color: var(--color-ink-faint);\n  flex: 1;\n}\n.quitar[_ngcontent-%COMP%] {\n  background: none;\n  border: none;\n  color: var(--color-status-critical);\n  font-size: var(--text-sm);\n}\n.enviar[_ngcontent-%COMP%] {\n  background: var(--color-accent);\n  color: var(--color-accent-ink);\n  border: none;\n  border-radius: var(--radius-sm);\n  padding: var(--space-3) var(--space-4);\n  font-weight: 600;\n  font-size: var(--text-base);\n}\n.enviar[_ngcontent-%COMP%]:disabled {\n  opacity: 0.6;\n  cursor: wait;\n}\n.secundario[_ngcontent-%COMP%] {\n  background: var(--color-surface-raised);\n  color: var(--color-ink);\n  border: 1px solid var(--color-border);\n  border-radius: var(--radius-sm);\n  padding: var(--space-3) var(--space-4);\n}\n.vacio[_ngcontent-%COMP%] {\n  margin: 0;\n  color: var(--color-ink-faint);\n  font-size: var(--text-sm);\n}\n.exito[_ngcontent-%COMP%] {\n  margin: 0;\n  color: var(--color-status-ok);\n  font-size: var(--text-sm);\n}\n.error[_ngcontent-%COMP%] {\n  margin: 0;\n  color: var(--color-status-critical);\n  font-size: var(--text-sm);\n}\n/*# sourceMappingURL=pos.component.css.map */"] });
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(PosComponent, [{
    type: Component,
    args: [{ selector: "app-pos", standalone: true, imports: [FormsModule, RouterLink], template: `<header class="pos-encabezado">\r
  <div>\r
    <p class="etiqueta">Simulador POS</p>\r
    <h1>{{ tenant }}</h1>\r
  </div>\r
  <a routerLink="/kds" class="volver">\u2190 Volver al tablero</a>\r
</header>\r
\r
<main class="pos">\r
  <form class="panel" (ngSubmit)="enviar()">\r
    <h2>Nuevo pedido</h2>\r
\r
    <div class="fila">\r
      <label>\r
        C\xF3digo (opcional)\r
        <input type="text" [(ngModel)]="displayCode" name="displayCode" placeholder="#P-XXXX" maxlength="10" />\r
      </label>\r
      <label>\r
        Canal\r
        <select [(ngModel)]="channel" name="channel">\r
          <option value="DINE_IN">En local</option>\r
          <option value="TAKEAWAY">Para llevar</option>\r
          <option value="DELIVERY">Domicilio</option>\r
        </select>\r
      </label>\r
      <label>\r
        Prioridad\r
        <select [(ngModel)]="priority" name="priority">\r
          <option value="NORMAL">Normal</option>\r
          <option value="HIGH">Alta</option>\r
          <option value="VIP">VIP</option>\r
        </select>\r
      </label>\r
    </div>\r
\r
    <div class="fila">\r
      <label>\r
        Cliente (opcional)\r
        <input type="text" [(ngModel)]="customerName" name="customerName" maxlength="100" />\r
      </label>\r
      <label>\r
        Notas generales (opcional)\r
        <input type="text" [(ngModel)]="notes" name="notes" />\r
      </label>\r
    </div>\r
\r
    <section class="items">\r
      <h3>Productos</h3>\r
      <div class="fila">\r
        <input type="text" [(ngModel)]="itemName" name="itemName" placeholder="Producto" class="crecer" />\r
        <input type="number" [(ngModel)]="itemQuantity" name="itemQuantity" min="1" class="cantidad" />\r
        <input type="text" [(ngModel)]="itemNotes" name="itemNotes" placeholder="Nota (opcional)" class="crecer" />\r
        <button type="button" class="secundario" (click)="agregarItem()">Agregar</button>\r
      </div>\r
\r
      @if (items().length > 0) {\r
        <ul>\r
          @for (item of items(); track $index) {\r
            <li>\r
              <span>{{ item.quantity }}\xD7 {{ item.productName }}</span>\r
              @if (item.notes) {\r
                <small>{{ item.notes }}</small>\r
              }\r
              <button type="button" class="quitar" (click)="quitarItem($index)">Quitar</button>\r
            </li>\r
          }\r
        </ul>\r
      } @else {\r
        <p class="vacio">Sin productos todav\xEDa</p>\r
      }\r
    </section>\r
\r
    <button type="submit" class="enviar" [disabled]="enviando()">\r
      {{ enviando() ? 'Enviando\u2026' : 'Crear pedido' }}\r
    </button>\r
\r
    @if (mensaje()) {\r
      <p class="exito" role="status">{{ mensaje() }}</p>\r
    }\r
    @if (error()) {\r
      <p class="error" role="alert">{{ error() }}</p>\r
    }\r
  </form>\r
</main>\r
`, styles: ["/* src/app/kds/pos/pos.component.css */\n.pos-encabezado {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  padding: var(--space-4) var(--space-6);\n  border-bottom: 1px solid var(--color-border);\n  background: var(--color-surface);\n}\n.pos-encabezado h1 {\n  font-size: var(--text-xl);\n}\n.etiqueta {\n  margin: 0;\n  font-size: var(--text-xs);\n  letter-spacing: 0.12em;\n  text-transform: uppercase;\n  color: var(--color-accent);\n}\n.volver {\n  color: var(--color-ink-muted);\n  text-decoration: none;\n  font-size: var(--text-sm);\n}\n.volver:hover {\n  color: var(--color-ink);\n}\n.pos {\n  padding: var(--space-6);\n}\n.panel {\n  max-width: 720px;\n  margin: 0 auto;\n  background: var(--color-surface);\n  border: 1px solid var(--color-border);\n  border-radius: var(--radius-lg);\n  padding: var(--space-6);\n  display: flex;\n  flex-direction: column;\n  gap: var(--space-5);\n}\n.panel h2,\n.panel h3 {\n  margin: 0;\n}\n.fila {\n  display: flex;\n  gap: var(--space-4);\n  flex-wrap: wrap;\n  align-items: flex-end;\n}\nlabel {\n  display: flex;\n  flex-direction: column;\n  gap: var(--space-2);\n  font-size: var(--text-sm);\n  color: var(--color-ink-muted);\n  flex: 1;\n  min-width: 140px;\n}\ninput,\nselect {\n  background: var(--color-paper);\n  border: 1px solid var(--color-border);\n  border-radius: var(--radius-sm);\n  padding: var(--space-3);\n  color: var(--color-ink);\n  font: inherit;\n}\n.crecer {\n  flex: 2;\n}\n.cantidad {\n  max-width: 90px;\n}\n.items {\n  display: flex;\n  flex-direction: column;\n  gap: var(--space-3);\n}\n.items ul {\n  list-style: none;\n  margin: 0;\n  padding: 0;\n  display: flex;\n  flex-direction: column;\n  gap: var(--space-2);\n}\n.items li {\n  display: flex;\n  align-items: center;\n  gap: var(--space-3);\n  background: var(--color-paper);\n  border: 1px solid var(--color-border);\n  border-radius: var(--radius-sm);\n  padding: var(--space-2) var(--space-3);\n  font-size: var(--text-sm);\n}\n.items li small {\n  color: var(--color-ink-faint);\n  flex: 1;\n}\n.quitar {\n  background: none;\n  border: none;\n  color: var(--color-status-critical);\n  font-size: var(--text-sm);\n}\n.enviar {\n  background: var(--color-accent);\n  color: var(--color-accent-ink);\n  border: none;\n  border-radius: var(--radius-sm);\n  padding: var(--space-3) var(--space-4);\n  font-weight: 600;\n  font-size: var(--text-base);\n}\n.enviar:disabled {\n  opacity: 0.6;\n  cursor: wait;\n}\n.secundario {\n  background: var(--color-surface-raised);\n  color: var(--color-ink);\n  border: 1px solid var(--color-border);\n  border-radius: var(--radius-sm);\n  padding: var(--space-3) var(--space-4);\n}\n.vacio {\n  margin: 0;\n  color: var(--color-ink-faint);\n  font-size: var(--text-sm);\n}\n.exito {\n  margin: 0;\n  color: var(--color-status-ok);\n  font-size: var(--text-sm);\n}\n.error {\n  margin: 0;\n  color: var(--color-status-critical);\n  font-size: var(--text-sm);\n}\n/*# sourceMappingURL=pos.component.css.map */\n"] }]
  }], () => [{ type: KdsService }], null);
})();
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && \u0275setClassDebugInfo(PosComponent, { className: "PosComponent", filePath: "src/app/kds/pos/pos.component.ts", lineNumber: 21 });
})();
export {
  PosComponent
};
//# sourceMappingURL=chunk-FTWAHLLQ.js.map
