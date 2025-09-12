// src/app/interceptors/ssr.interceptor.ts
import { HttpInterceptorFn } from '@angular/common/http';
import { isPlatformServer } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';
import { of } from 'rxjs';

export const ssrInterceptor: HttpInterceptorFn = (req, next) => {
  const platformId = inject(PLATFORM_ID);
  
  // Blocca tutte le chiamate HTTP durante SSR
  if (isPlatformServer(platformId)) {
    console.log('🚫 Blocking HTTP request during SSR:', req.url);
    // Restituisce un observable vuoto invece di fare la richiesta
    return of() as any;
  }
  
  // Nel browser, procedi normalmente
  return next(req);
};