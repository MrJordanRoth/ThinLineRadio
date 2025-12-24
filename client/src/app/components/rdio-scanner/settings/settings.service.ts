/*
 * *****************************************************************************
 * Copyright (C) 2025 Thinline Dynamic Solutions
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>
 * ****************************************************************************
 */

import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { RdioScannerService } from '../rdio-scanner.service';

@Injectable()
export class SettingsService {
    private readonly apiUrl = '/api/settings';

    constructor(
        private http: HttpClient,
        private rdioScannerService: RdioScannerService,
    ) {
    }

    private getAuthHeaders(): HttpHeaders {
        const pin = this.getPin();
        const headers = new HttpHeaders();
        if (pin) {
            return headers.set('Authorization', `Bearer ${pin}`);
        }
        return headers;
    }

    private getPin(): string | undefined {
        // Get PIN from localStorage (same way RdioScannerService does it)
        const pin = window?.localStorage?.getItem('rdio-scanner-pin');
        return pin ? window.atob(pin) : undefined;
    }

    getSettings(): Observable<any> {
        const pin = this.getPin();
        const headers = this.getAuthHeaders();
        
        if (!pin) {
            // Return empty settings if no PIN
            return new Observable(observer => {
                observer.next({});
                observer.complete();
            });
        }

        // Include PIN as query parameter or in header
        return this.http.get<any>(`${this.apiUrl}?pin=${encodeURIComponent(pin)}`, { headers });
    }

    saveSettings(settings: any): Observable<any> {
        const pin = this.getPin();
        const headers = this.getAuthHeaders();
        
        if (!pin) {
            return new Observable(observer => {
                observer.error(new Error('No PIN available. Please log in.'));
                observer.complete();
            });
        }

        // Include PIN as query parameter or in header
        return this.http.post<any>(`${this.apiUrl}?pin=${encodeURIComponent(pin)}`, settings, { headers });
    }

    // Check if auto livefeed is enabled
    shouldAutoStartLivefeed(): Observable<boolean> {
        return new Observable(observer => {
            // Check if running as PWA
            const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
            const isIOSStandalone = (window.navigator as any).standalone === true;
            const isFullscreen = window.matchMedia('(display-mode: fullscreen)').matches;
            const isPWA = isStandalone || isIOSStandalone || isFullscreen;

            // Only check settings if running as PWA
            if (!isPWA) {
                observer.next(false);
                observer.complete();
                return;
            }

            // Get settings to check if auto livefeed is enabled
            this.getSettings().subscribe({
                next: (settings) => {
                    const autoLivefeed = settings?.autoLivefeed || false;
                    observer.next(autoLivefeed);
                    observer.complete();
                },
                error: () => {
                    observer.next(false);
                    observer.complete();
                }
            });
        });
    }
}

