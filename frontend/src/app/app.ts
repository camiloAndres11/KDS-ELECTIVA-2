import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
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
