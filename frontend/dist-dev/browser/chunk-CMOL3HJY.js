import {
  roleGuard
} from "./chunk-7ZJKHEPY.js";
import "./chunk-G7DMQKES.js";
import "./chunk-IY7DZLXM.js";
import "./chunk-NILDOHVQ.js";

// src/app/kds/kds.routes.ts
var KDS_ROUTES = [
  {
    path: "",
    loadComponent: () => import("./chunk-HHKHKYWS.js").then((m) => m.TableroKdsComponent)
  },
  {
    path: "pos",
    canActivate: [roleGuard(["POS_SYSTEM", "ADMIN"])],
    loadComponent: () => import("./chunk-FTWAHLLQ.js").then((m) => m.PosComponent)
  }
];
export {
  KDS_ROUTES
};
//# sourceMappingURL=chunk-CMOL3HJY.js.map
