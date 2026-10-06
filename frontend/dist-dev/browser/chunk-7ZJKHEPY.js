import {
  AuthService
} from "./chunk-G7DMQKES.js";
import {
  Router,
  inject
} from "./chunk-IY7DZLXM.js";

// src/app/core/auth/guards.ts
var authGuard = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isAuthenticated() ? true : router.createUrlTree(["/auth/login"]);
};
function roleGuard(roles) {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    if (!auth.isAuthenticated()) {
      return router.createUrlTree(["/auth/login"]);
    }
    return roles.some((rol) => auth.hasRole(rol)) ? true : router.createUrlTree(["/kds"]);
  };
}

export {
  authGuard,
  roleGuard
};
//# sourceMappingURL=chunk-7ZJKHEPY.js.map
