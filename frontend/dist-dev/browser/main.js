import {
  authGuard
} from "./chunk-7ZJKHEPY.js";
import {
  AuthService
} from "./chunk-G7DMQKES.js";
import {
  APP_INITIALIZER,
  Component,
  RouterOutlet,
  bootstrapApplication,
  environment,
  inject,
  provideBrowserGlobalErrorListeners,
  provideHttpClient,
  provideRouter,
  setClassMetadata,
  withInterceptors,
  ɵsetClassDebugInfo,
  ɵɵdefineComponent,
  ɵɵelement
} from "./chunk-IY7DZLXM.js";
import "./chunk-NILDOHVQ.js";

// src/app/app.routes.ts
var routes = [
  { path: "", redirectTo: "auth", pathMatch: "full" },
  {
    path: "auth",
    loadChildren: () => import("./chunk-JBNF7T26.js").then((m) => m.AUTH_ROUTES)
  },
  {
    path: "kds",
    canActivate: [authGuard],
    loadChildren: () => import("./chunk-CMOL3HJY.js").then((m) => m.KDS_ROUTES)
  },
  { path: "**", redirectTo: "auth" }
];

// src/app/core/interceptors/auth.interceptor.ts
var authInterceptor = (req, next) => {
  if (!req.url.startsWith(environment.apiUrl)) {
    return next(req);
  }
  const token = inject(AuthService).token();
  if (!token) {
    return next(req);
  }
  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};

// src/app/app.config.ts
var appConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideRouter(routes),
    {
      provide: APP_INITIALIZER,
      useFactory: (auth) => () => auth.init(),
      deps: [AuthService],
      multi: true
    }
  ]
};

// src/app/app.ts
var App = class _App {
  ngOnInit() {
    const root = document.documentElement.style;
    root.setProperty("--color-accent", environment.theme.primaryColor);
    root.setProperty("--color-accent-ink", environment.theme.secondaryColor);
    root.setProperty("--color-paper", environment.theme.background);
  }
  static \u0275fac = function App_Factory(__ngFactoryType__) {
    return new (__ngFactoryType__ || _App)();
  };
  static \u0275cmp = /* @__PURE__ */ \u0275\u0275defineComponent({ type: _App, selectors: [["app-root"]], decls: 1, vars: 0, template: function App_Template(rf, ctx) {
    if (rf & 1) {
      \u0275\u0275element(0, "router-outlet");
    }
  }, dependencies: [RouterOutlet], styles: ["\n[_nghost-%COMP%] {\n  display: block;\n  height: 100vh;\n}\n/*# sourceMappingURL=app.css.map */"] });
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(App, [{
    type: Component,
    args: [{ selector: "app-root", imports: [RouterOutlet], template: "<router-outlet />\r\n", styles: ["/* src/app/app.css */\n:host {\n  display: block;\n  height: 100vh;\n}\n/*# sourceMappingURL=app.css.map */\n"] }]
  }], null, null);
})();
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && \u0275setClassDebugInfo(App, { className: "App", filePath: "src/app/app.ts", lineNumber: 11 });
})();

// src/main.ts
bootstrapApplication(App, appConfig).catch((err) => console.error(err));
//# sourceMappingURL=main.js.map
