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

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError, shareReplay } from 'rxjs/operators';

export interface Country {
  iso2: string;
  name: string;
}

export interface State {
  iso2: string;
  name: string;
  countryCode: string;
}

export interface City {
  id?: number;
  name: string;
  stateCode?: string;
  countryCode: string;
}

export interface County {
  id?: number;
  name: string;
  stateCode?: string;
  fips?: string;
}

@Injectable({
  providedIn: 'root'
})
export class LocationDataService {
  // Location data is served from the relay server
  // Data source: https://github.com/dr5hn/countries-states-cities-database
  // The relay server serves JSON files from its /api/location endpoints
  
  // Cache for API responses (shareReplay caches the Observable result)
  private countriesCache$: Observable<Country[]> | null = null;
  private statesCache: Map<string, Observable<State[]>> = new Map();
  private citiesCache: Map<string, Observable<City[]>> = new Map();
  private countiesCache: Map<string, Observable<County[]>> = new Map();
  
  // Relay server URL - should be set from options
  private relayServerURL: string = '';

  constructor(private http: HttpClient) {}

  /**
   * Set the relay server URL for location data
   * This should be called with the relay server URL from options
   */
  setRelayServerURL(url: string): void {
    this.relayServerURL = url ? url.replace(/\/$/, '') : ''; // Remove trailing slash
    // Clear caches when URL changes
    this.countriesCache$ = null;
    this.statesCache.clear();
    this.citiesCache.clear();
    this.countiesCache.clear();
  }

  /**
   * Check if relay server URL is configured
   */
  isConfigured(): boolean {
    return this.relayServerURL !== null && this.relayServerURL !== '';
  }

  /**
   * Get all countries from relay server
   */
  getAllCountries(): Observable<Country[]> {
    if (!this.isConfigured()) {
      console.warn('Relay server URL not configured for location data');
      return of([]);
    }

    if (!this.countriesCache$) {
      this.countriesCache$ = this.http.get<any[]>(`${this.relayServerURL}/api/location/countries`).pipe(
        map(countries => {
          if (!countries || !Array.isArray(countries)) {
            console.warn('Invalid response from countries API:', countries);
            return [];
          }
          return countries.map(c => ({
            iso2: c.iso2,
            name: c.name
          })).sort((a, b) => a.name.localeCompare(b.name));
        }),
        catchError(error => {
          console.error('Failed to fetch countries from relay server:', error);
          return of([]);
        }),
        shareReplay(1) // Cache the result
      );
    }

    return this.countriesCache$;
  }

  /**
   * Get states/provinces for a country from relay server
   */
  getStatesForCountry(countryCode: string): Observable<State[]> {
    if (!this.isConfigured()) {
      return of([]);
    }

    const cacheKey = countryCode.toUpperCase();
    if (!this.statesCache.has(cacheKey)) {
      const states$ = this.http.get<any[]>(`${this.relayServerURL}/api/location/states/${countryCode}`).pipe(
        map(states => {
          if (!states || !Array.isArray(states)) {
            return [];
          }
          return states.map(s => ({
            iso2: s.iso2,
            name: s.name,
            countryCode: countryCode.toUpperCase()
          })).sort((a, b) => a.name.localeCompare(b.name));
        }),
        catchError(error => {
          console.error(`Failed to fetch states for ${countryCode} from relay server:`, error);
          return of([]);
        }),
        shareReplay(1) // Cache the result
      );

      this.statesCache.set(cacheKey, states$);
    }

    return this.statesCache.get(cacheKey)!;
  }

  /**
   * Get cities for a country and optionally a state from relay server
   */
  getCities(countryCode: string, stateCode?: string): Observable<City[]> {
    if (!this.isConfigured()) {
      return of([]);
    }

    const cacheKey = stateCode 
      ? `${countryCode.toUpperCase()}_${stateCode.toUpperCase()}`
      : countryCode.toUpperCase();

    if (!this.citiesCache.has(cacheKey)) {
      let url: string;
      if (stateCode) {
        url = `${this.relayServerURL}/api/location/cities/${countryCode}/${stateCode}`;
      } else {
        url = `${this.relayServerURL}/api/location/cities/${countryCode}`;
      }

      const cities$ = this.http.get<any[]>(url).pipe(
        map(cities => {
          if (!cities || !Array.isArray(cities)) {
            return [];
          }
          return cities.map(c => ({
            id: c.id,
            name: c.name,
            stateCode: c.stateCode,
            countryCode: countryCode.toUpperCase()
          })).sort((a, b) => a.name.localeCompare(b.name));
        }),
        catchError(error => {
          console.error(`Failed to fetch cities from relay server:`, error);
          return of([]);
        }),
        shareReplay(1) // Cache the result
      );

      this.citiesCache.set(cacheKey, cities$);
    }

    return this.citiesCache.get(cacheKey)!;
  }

  /**
   * Helper: Get country name by code
   */
  getCountryName(code: string): Observable<string> {
    return this.getAllCountries().pipe(
      map(countries => {
        const country = countries.find(c => c.iso2 === code.toUpperCase());
        return country ? country.name : code;
      })
    );
  }

  /**
   * Get counties for a country and state from relay server
   * Currently only supports US counties
   */
  getCounties(countryCode: string, stateCode: string): Observable<County[]> {
    if (!this.isConfigured()) {
      return of([]);
    }

    const cacheKey = `${countryCode.toUpperCase()}_${stateCode.toUpperCase()}`;

    if (!this.countiesCache.has(cacheKey)) {
      const counties$ = this.http.get<any[]>(`${this.relayServerURL}/api/location/counties/${countryCode}/${stateCode}`).pipe(
        map(counties => {
          if (!counties || !Array.isArray(counties)) {
            return [];
          }
          return counties.map(c => ({
            id: c.id,
            name: c.name,
            stateCode: c.stateCode,
            fips: c.fips
          })).sort((a, b) => a.name.localeCompare(b.name));
        }),
        catchError(error => {
          console.error(`Failed to fetch counties for ${countryCode}/${stateCode} from relay server:`, error);
          return of([]);
        }),
        shareReplay(1) // Cache the result
      );

      this.countiesCache.set(cacheKey, counties$);
    }

    return this.countiesCache.get(cacheKey)!;
  }

  /**
   * Helper: Get state name by code
   */
  getStateName(countryCode: string, stateCode: string): Observable<string> {
    return this.getStatesForCountry(countryCode).pipe(
      map(states => {
        const state = states.find(s => s.iso2 === stateCode.toUpperCase());
        return state ? state.name : stateCode;
      })
    );
  }
}
