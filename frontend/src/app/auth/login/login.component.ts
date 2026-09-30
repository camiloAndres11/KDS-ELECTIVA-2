import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent implements OnInit {
  readonly tenant = environment.displayName;
  readonly proveedor = environment.auth.provider;
  readonly realm = environment.auth.keycloak.realm;

  readonly username = signal('');
  readonly password = signal('');
  readonly error = signal<string | null>(null);

  constructor(
    private auth: AuthService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    if (this.auth.isAuthenticated()) {
      void this.router.navigate(['/kds']);
    }
  }

  entrar(): void {
    this.error.set(null);
    if (this.proveedor === 'mock') {
      if (!this.auth.loginMock(this.username(), this.password())) {
        this.error.set('Credenciales incorrectas');
        return;
      }
      void this.router.navigate(['/kds']);
      return;
    }
    void this.auth.login().catch(() => this.error.set('No fue posible conectar con Keycloak'));
  }
}
