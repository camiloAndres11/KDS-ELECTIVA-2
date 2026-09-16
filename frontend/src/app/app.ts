import { Component, OnInit } from '@angular/core';
import { TableroKdsComponent } from './kds/tablero-kds/tablero-kds.component';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  imports: [TableroKdsComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  ngOnInit(): void {
    const root = document.documentElement.style;
    root.setProperty('--color-accent', environment.theme.primaryColor);
    root.setProperty('--color-accent-ink', environment.theme.secondaryColor);
    root.setProperty('--color-paper', environment.theme.background);
  }
}
