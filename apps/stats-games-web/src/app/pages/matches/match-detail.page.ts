import { Component, OnInit, ViewEncapsulation, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import type { MatchUpdateView } from '../../services/match.service';
import { MatchAnalysisViewComponent } from '../../ui';

@Component({
  standalone: true,
  selector: 'app-match-detail-page',
  encapsulation: ViewEncapsulation.None,
  imports: [IonContent, RouterLink, MatchAnalysisViewComponent],
  template: `
    <ion-content class="sg-page-content">
      <div class="page-shell page-shell--fluid sg-match-detail u-flex u-flex-col u-gap-5">
        <header class="sg-match-detail__header">
          <a routerLink="/tabs/matches" class="sg-match-detail__back u-btn u-btn--ghost">
            ← Partidas
          </a>
          <div class="sg-match-detail__heading">
            <h1 class="sg-page-header__title">Análisis de partida</h1>
            <p class="sg-page-header__subtitle">
              Stats al instante. El reporte IA se completa cuando el análisis termina.
            </p>
          </div>
        </header>

        <sg-match-analysis-view
          [matchId]="matchId()"
          [seedMatch]="seedMatch()"
          (ctaClick)="goToMatches()"
        />
      </div>
    </ion-content>
  `,
})
export class MatchDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly matchId = signal<string | null>(null);
  readonly seedMatch = signal<MatchUpdateView | null>(null);

  ngOnInit(): void {
    const raw = this.route.snapshot.paramMap.get('matchId') ?? '';
    this.matchId.set(raw ? safeDecode(raw) : null);

    const navState = (this.router.getCurrentNavigation()?.extras.state ??
      history.state) as { match?: MatchUpdateView } | null;
    const seed = navState?.match ?? null;
    if (seed && this.matchId() && seed.matchId === this.matchId()) {
      this.seedMatch.set(seed);
    }

    this.route.paramMap.subscribe((params) => {
      const next = params.get('matchId') ?? '';
      this.matchId.set(next ? safeDecode(next) : null);
    });
  }

  goToMatches(): void {
    void this.router.navigateByUrl('/tabs/matches');
  }
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
