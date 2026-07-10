import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withComponentInputBinding } from '@angular/router';
import { provideIonicAngular, IonicRouteStrategy } from '@ionic/angular/standalone';
import { AppComponent } from './app/app.component';
import { APP_ROUTES } from './app/app.routes';
import { configureAmplify } from './app/amplify.config';
import { provideAppEcharts } from './app/core/charts/echarts.config';
import { environment } from './environments/environment';

configureAmplify(environment);

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideRouter(APP_ROUTES, withComponentInputBinding()),
    provideAppEcharts(),
  ],
}).catch((err) => console.error(err));
