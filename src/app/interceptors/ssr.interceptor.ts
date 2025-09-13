// src/app/interceptors/ssr.interceptor.ts
import { HttpInterceptorFn } from '@angular/common/http';
import { isPlatformServer } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';
import { of } from 'rxjs';

export const ssrInterceptor: HttpInterceptorFn = (req, next) => {
  const platformId = inject(PLATFORM_ID);
  
if (isPlatformServer(platformId)) {
  const url = req.url || '';
  const isBinance = url.includes('api.binance.com');
  if (!isBinance) {
    console.log('🚫 Blocking HTTP during SSR:', url);
    return of() as any;
  }
}
return next(req);

  // Nel browser, procedi normalmente
  return next(req);
};