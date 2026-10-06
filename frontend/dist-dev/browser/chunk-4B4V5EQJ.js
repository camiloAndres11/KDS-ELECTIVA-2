import {
  DefaultValueAccessor,
  FormsModule,
  NgControlStatus,
  NgControlStatusGroup,
  NgForm,
  NgModel,
  RequiredValidator,
  ɵNgNoValidate
} from "./chunk-2RN6BVV4.js";
import {
  AuthService
} from "./chunk-G7DMQKES.js";
import {
  Component,
  Router,
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
  ɵɵresetView,
  ɵɵrestoreView,
  ɵɵtext,
  ɵɵtextInterpolate,
  ɵɵtwoWayBindingSet,
  ɵɵtwoWayListener,
  ɵɵtwoWayProperty
} from "./chunk-IY7DZLXM.js";
import "./chunk-NILDOHVQ.js";

// src/app/auth/login/login.component.ts
function LoginComponent_Conditional_9_Template(rf, ctx) {
  if (rf & 1) {
    const _r1 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "form", 8);
    \u0275\u0275listener("ngSubmit", function LoginComponent_Conditional_9_Template_form_ngSubmit_0_listener() {
      \u0275\u0275restoreView(_r1);
      const ctx_r1 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r1.entrar());
    });
    \u0275\u0275elementStart(1, "label");
    \u0275\u0275text(2, " Usuario ");
    \u0275\u0275elementStart(3, "input", 9);
    \u0275\u0275twoWayListener("ngModelChange", function LoginComponent_Conditional_9_Template_input_ngModelChange_3_listener($event) {
      \u0275\u0275restoreView(_r1);
      const ctx_r1 = \u0275\u0275nextContext();
      \u0275\u0275twoWayBindingSet(ctx_r1.username, $event) || (ctx_r1.username = $event);
      return \u0275\u0275resetView($event);
    });
    \u0275\u0275elementEnd()();
    \u0275\u0275elementStart(4, "label");
    \u0275\u0275text(5, " Contrase\xF1a ");
    \u0275\u0275elementStart(6, "input", 10);
    \u0275\u0275twoWayListener("ngModelChange", function LoginComponent_Conditional_9_Template_input_ngModelChange_6_listener($event) {
      \u0275\u0275restoreView(_r1);
      const ctx_r1 = \u0275\u0275nextContext();
      \u0275\u0275twoWayBindingSet(ctx_r1.password, $event) || (ctx_r1.password = $event);
      return \u0275\u0275resetView($event);
    });
    \u0275\u0275elementEnd()();
    \u0275\u0275elementStart(7, "button", 11);
    \u0275\u0275text(8, "Entrar");
    \u0275\u0275elementEnd()();
  }
  if (rf & 2) {
    const ctx_r1 = \u0275\u0275nextContext();
    \u0275\u0275advance(3);
    \u0275\u0275twoWayProperty("ngModel", ctx_r1.username);
    \u0275\u0275advance(3);
    \u0275\u0275twoWayProperty("ngModel", ctx_r1.password);
  }
}
function LoginComponent_Conditional_10_Template(rf, ctx) {
  if (rf & 1) {
    const _r3 = \u0275\u0275getCurrentView();
    \u0275\u0275elementStart(0, "div", 6)(1, "p");
    \u0275\u0275text(2, "La autenticaci\xF3n est\xE1 a cargo de Keycloak (reino ");
    \u0275\u0275elementStart(3, "strong");
    \u0275\u0275text(4);
    \u0275\u0275elementEnd();
    \u0275\u0275text(5, ").");
    \u0275\u0275elementEnd();
    \u0275\u0275elementStart(6, "button", 12);
    \u0275\u0275listener("click", function LoginComponent_Conditional_10_Template_button_click_6_listener() {
      \u0275\u0275restoreView(_r3);
      const ctx_r1 = \u0275\u0275nextContext();
      return \u0275\u0275resetView(ctx_r1.entrar());
    });
    \u0275\u0275text(7, "Entrar con Keycloak");
    \u0275\u0275elementEnd()();
  }
  if (rf & 2) {
    const ctx_r1 = \u0275\u0275nextContext();
    \u0275\u0275advance(4);
    \u0275\u0275textInterpolate(ctx_r1.realm);
  }
}
function LoginComponent_Conditional_11_Template(rf, ctx) {
  if (rf & 1) {
    \u0275\u0275elementStart(0, "p", 7);
    \u0275\u0275text(1);
    \u0275\u0275elementEnd();
  }
  if (rf & 2) {
    const ctx_r1 = \u0275\u0275nextContext();
    \u0275\u0275advance();
    \u0275\u0275textInterpolate(ctx_r1.error());
  }
}
var LoginComponent = class _LoginComponent {
  auth;
  router;
  tenant = environment.displayName;
  proveedor = environment.auth.provider;
  realm = environment.auth.keycloak.realm;
  username = signal("", ...ngDevMode ? [{ debugName: "username" }] : (
    /* istanbul ignore next */
    []
  ));
  password = signal("", ...ngDevMode ? [{ debugName: "password" }] : (
    /* istanbul ignore next */
    []
  ));
  error = signal(null, ...ngDevMode ? [{ debugName: "error" }] : (
    /* istanbul ignore next */
    []
  ));
  constructor(auth, router) {
    this.auth = auth;
    this.router = router;
  }
  ngOnInit() {
    if (this.auth.isAuthenticated()) {
      void this.router.navigate(["/kds"]);
    }
  }
  entrar() {
    this.error.set(null);
    if (this.proveedor === "mock") {
      if (!this.auth.loginMock(this.username(), this.password())) {
        this.error.set("Credenciales incorrectas");
        return;
      }
      void this.router.navigate(["/kds"]);
      return;
    }
    void this.auth.login().catch(() => this.error.set("No fue posible conectar con Keycloak"));
  }
  static \u0275fac = function LoginComponent_Factory(__ngFactoryType__) {
    return new (__ngFactoryType__ || _LoginComponent)(\u0275\u0275directiveInject(AuthService), \u0275\u0275directiveInject(Router));
  };
  static \u0275cmp = /* @__PURE__ */ \u0275\u0275defineComponent({ type: _LoginComponent, selectors: [["app-login"]], decls: 12, vars: 3, consts: [[1, "login"], [1, "tarjeta"], [1, "encabezado"], [1, "etiqueta"], [1, "subtitulo"], [1, "formulario"], [1, "keycloak"], ["role", "alert", 1, "error"], [1, "formulario", 3, "ngSubmit"], ["type", "text", "name", "username", "autocomplete", "username", "required", "", 3, "ngModelChange", "ngModel"], ["type", "password", "name", "password", "autocomplete", "current-password", "required", "", 3, "ngModelChange", "ngModel"], ["type", "submit", 1, "boton-entrar"], ["type", "button", 1, "boton-entrar", 3, "click"]], template: function LoginComponent_Template(rf, ctx) {
    if (rf & 1) {
      \u0275\u0275elementStart(0, "main", 0)(1, "section", 1)(2, "header", 2)(3, "p", 3);
      \u0275\u0275text(4, "Kitchen Display System");
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(5, "h1");
      \u0275\u0275text(6);
      \u0275\u0275elementEnd();
      \u0275\u0275elementStart(7, "p", 4);
      \u0275\u0275text(8, "Pantalla de cocina \xB7 Inicia sesi\xF3n para continuar");
      \u0275\u0275elementEnd()();
      \u0275\u0275conditionalCreate(9, LoginComponent_Conditional_9_Template, 9, 2, "form", 5)(10, LoginComponent_Conditional_10_Template, 8, 1, "div", 6);
      \u0275\u0275conditionalCreate(11, LoginComponent_Conditional_11_Template, 2, 1, "p", 7);
      \u0275\u0275elementEnd()();
    }
    if (rf & 2) {
      \u0275\u0275advance(6);
      \u0275\u0275textInterpolate(ctx.tenant);
      \u0275\u0275advance(3);
      \u0275\u0275conditional(ctx.proveedor === "mock" ? 9 : 10);
      \u0275\u0275advance(2);
      \u0275\u0275conditional(ctx.error() ? 11 : -1);
    }
  }, dependencies: [FormsModule, \u0275NgNoValidate, DefaultValueAccessor, NgControlStatus, NgControlStatusGroup, RequiredValidator, NgModel, NgForm], styles: ["\n.login[_ngcontent-%COMP%] {\n  display: grid;\n  place-items: center;\n  min-height: 100vh;\n  padding: var(--space-6);\n}\n.tarjeta[_ngcontent-%COMP%] {\n  width: min(420px, 100%);\n  background: var(--color-surface);\n  border: 1px solid var(--color-border);\n  border-radius: var(--radius-lg);\n  padding: var(--space-8);\n  display: flex;\n  flex-direction: column;\n  gap: var(--space-6);\n}\n.encabezado[_ngcontent-%COMP%] {\n  display: flex;\n  flex-direction: column;\n  gap: var(--space-2);\n}\n.etiqueta[_ngcontent-%COMP%] {\n  margin: 0;\n  font-size: var(--text-xs);\n  letter-spacing: 0.12em;\n  text-transform: uppercase;\n  color: var(--color-accent);\n}\n.encabezado[_ngcontent-%COMP%]   h1[_ngcontent-%COMP%] {\n  font-size: var(--text-2xl);\n}\n.subtitulo[_ngcontent-%COMP%] {\n  margin: 0;\n  font-size: var(--text-sm);\n  color: var(--color-ink-muted);\n}\n.formulario[_ngcontent-%COMP%] {\n  display: flex;\n  flex-direction: column;\n  gap: var(--space-4);\n}\n.formulario[_ngcontent-%COMP%]   label[_ngcontent-%COMP%] {\n  display: flex;\n  flex-direction: column;\n  gap: var(--space-2);\n  font-size: var(--text-sm);\n  color: var(--color-ink-muted);\n}\n.formulario[_ngcontent-%COMP%]   input[_ngcontent-%COMP%] {\n  background: var(--color-paper);\n  border: 1px solid var(--color-border);\n  border-radius: var(--radius-sm);\n  padding: var(--space-3);\n  color: var(--color-ink);\n  font: inherit;\n}\n.keycloak[_ngcontent-%COMP%] {\n  display: flex;\n  flex-direction: column;\n  gap: var(--space-4);\n  font-size: var(--text-sm);\n  color: var(--color-ink-muted);\n}\n.boton-entrar[_ngcontent-%COMP%] {\n  background: var(--color-accent);\n  color: var(--color-accent-ink);\n  border: none;\n  border-radius: var(--radius-sm);\n  padding: var(--space-3) var(--space-4);\n  font-weight: 600;\n  font-size: var(--text-base);\n  transition: filter var(--dur-fast) var(--ease-out);\n}\n.boton-entrar[_ngcontent-%COMP%]:hover {\n  filter: brightness(1.1);\n}\n.error[_ngcontent-%COMP%] {\n  margin: 0;\n  font-size: var(--text-sm);\n  color: var(--color-status-critical);\n}\n/*# sourceMappingURL=login.component.css.map */"] });
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(LoginComponent, [{
    type: Component,
    args: [{ selector: "app-login", standalone: true, imports: [FormsModule], template: `<main class="login">\r
  <section class="tarjeta">\r
    <header class="encabezado">\r
      <p class="etiqueta">Kitchen Display System</p>\r
      <h1>{{ tenant }}</h1>\r
      <p class="subtitulo">Pantalla de cocina \xB7 Inicia sesi\xF3n para continuar</p>\r
    </header>\r
\r
    @if (proveedor === 'mock') {\r
      <form class="formulario" (ngSubmit)="entrar()">\r
        <label>\r
          Usuario\r
          <input type="text" name="username" autocomplete="username" [(ngModel)]="username" required />\r
        </label>\r
        <label>\r
          Contrase\xF1a\r
          <input type="password" name="password" autocomplete="current-password" [(ngModel)]="password" required />\r
        </label>\r
        <button type="submit" class="boton-entrar">Entrar</button>\r
      </form>\r
    } @else {\r
      <div class="keycloak">\r
        <p>La autenticaci\xF3n est\xE1 a cargo de Keycloak (reino <strong>{{ realm }}</strong>).</p>\r
        <button type="button" class="boton-entrar" (click)="entrar()">Entrar con Keycloak</button>\r
      </div>\r
    }\r
\r
    @if (error()) {\r
      <p class="error" role="alert">{{ error() }}</p>\r
    }\r
  </section>\r
</main>\r
`, styles: ["/* src/app/auth/login/login.component.css */\n.login {\n  display: grid;\n  place-items: center;\n  min-height: 100vh;\n  padding: var(--space-6);\n}\n.tarjeta {\n  width: min(420px, 100%);\n  background: var(--color-surface);\n  border: 1px solid var(--color-border);\n  border-radius: var(--radius-lg);\n  padding: var(--space-8);\n  display: flex;\n  flex-direction: column;\n  gap: var(--space-6);\n}\n.encabezado {\n  display: flex;\n  flex-direction: column;\n  gap: var(--space-2);\n}\n.etiqueta {\n  margin: 0;\n  font-size: var(--text-xs);\n  letter-spacing: 0.12em;\n  text-transform: uppercase;\n  color: var(--color-accent);\n}\n.encabezado h1 {\n  font-size: var(--text-2xl);\n}\n.subtitulo {\n  margin: 0;\n  font-size: var(--text-sm);\n  color: var(--color-ink-muted);\n}\n.formulario {\n  display: flex;\n  flex-direction: column;\n  gap: var(--space-4);\n}\n.formulario label {\n  display: flex;\n  flex-direction: column;\n  gap: var(--space-2);\n  font-size: var(--text-sm);\n  color: var(--color-ink-muted);\n}\n.formulario input {\n  background: var(--color-paper);\n  border: 1px solid var(--color-border);\n  border-radius: var(--radius-sm);\n  padding: var(--space-3);\n  color: var(--color-ink);\n  font: inherit;\n}\n.keycloak {\n  display: flex;\n  flex-direction: column;\n  gap: var(--space-4);\n  font-size: var(--text-sm);\n  color: var(--color-ink-muted);\n}\n.boton-entrar {\n  background: var(--color-accent);\n  color: var(--color-accent-ink);\n  border: none;\n  border-radius: var(--radius-sm);\n  padding: var(--space-3) var(--space-4);\n  font-weight: 600;\n  font-size: var(--text-base);\n  transition: filter var(--dur-fast) var(--ease-out);\n}\n.boton-entrar:hover {\n  filter: brightness(1.1);\n}\n.error {\n  margin: 0;\n  font-size: var(--text-sm);\n  color: var(--color-status-critical);\n}\n/*# sourceMappingURL=login.component.css.map */\n"] }]
  }], () => [{ type: AuthService }, { type: Router }], null);
})();
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && \u0275setClassDebugInfo(LoginComponent, { className: "LoginComponent", filePath: "src/app/auth/login/login.component.ts", lineNumber: 14 });
})();
export {
  LoginComponent
};
//# sourceMappingURL=chunk-4B4V5EQJ.js.map
