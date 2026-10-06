import {
  HttpClient,
  Injectable,
  environment,
  setClassMetadata,
  ɵɵdefineInjectable,
  ɵɵinject
} from "./chunk-IY7DZLXM.js";

// src/app/kds/kds.service.ts
var KdsService = class _KdsService {
  http;
  api = `${environment.apiUrl}/api/v1`;
  constructor(http) {
    this.http = http;
  }
  getActiveOrders() {
    return this.http.get(`${this.api}/kitchen/orders`);
  }
  changeStatus(id, status, version) {
    return this.http.patch(`${this.api}/kitchen/orders/${id}/status`, { status, version });
  }
  changePriority(id, priority, version) {
    return this.http.patch(`${this.api}/kitchen/orders/${id}/priority`, { priority, version });
  }
  createOrder(input) {
    return this.http.post(`${this.api}/orders`, input);
  }
  static \u0275fac = function KdsService_Factory(__ngFactoryType__) {
    return new (__ngFactoryType__ || _KdsService)(\u0275\u0275inject(HttpClient));
  };
  static \u0275prov = /* @__PURE__ */ \u0275\u0275defineInjectable({ token: _KdsService, factory: _KdsService.\u0275fac, providedIn: "root" });
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(KdsService, [{
    type: Injectable,
    args: [{ providedIn: "root" }]
  }], () => [{ type: HttpClient }], null);
})();

export {
  KdsService
};
//# sourceMappingURL=chunk-TKK4VM7C.js.map
