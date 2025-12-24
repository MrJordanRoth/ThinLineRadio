/*
 * *****************************************************************************
 * Copyright (C) 2019-2024 Chrystian Huot <chrystian@huot.qc.ca>
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

import { Component, Input, OnInit, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
import { FormGroup, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { RequestAPIKeyDialogComponent } from './request-api-key-dialog.component';
import { RecoverAPIKeyDialogComponent } from './recover-api-key-dialog.component';
import { LocationDataService } from 'src/app/services/location-data.service';

@Component({
    selector: 'rdio-scanner-admin-options',
    templateUrl: './options.component.html',
})
export class RdioScannerAdminOptionsComponent implements OnInit, OnDestroy, OnChanges {
    @Input() form: FormGroup | undefined;
    private radioReferenceSubscription?: Subscription;
    private initialLoadComplete = false;
    public isEditingRadioReference = false;
    private originalRadioReferenceUsername = '';
    private originalRadioReferencePassword = '';

    constructor(
        private snackBar: MatSnackBar,
        private dialog: MatDialog,
        private locationService: LocationDataService
    ) {}

    get isRadioReferenceLoggedIn(): boolean {
        return this.hasStoredRadioReferenceCredentials();
    }

    get shouldShowLoginForm(): boolean {
        return this.isEditingRadioReference || !this.isRadioReferenceLoggedIn;
    }

    ngOnInit(): void {
        this.setupRadioReferenceValidation();
        this.setInitialRadioReferenceValidation();
        this.storeOriginalCredentials();
        this.setupRelayServerFormListeners();
        // Ensure hardcoded relay server URL is set
        this.setHardcodedRelayServerURL();
        // Mark initial load as complete after a brief delay to allow form to populate
        setTimeout(() => {
            this.initialLoadComplete = true;
        }, 100);
    }

    ngOnDestroy(): void {
        this.radioReferenceSubscription?.unsubscribe();
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['form'] && this.form) {
            this.setupRadioReferenceValidation();
            this.setInitialRadioReferenceValidation();
            this.storeOriginalCredentials();
            this.setupRelayServerFormListeners();
            this.setHardcodedRelayServerURL();
            this.isEditingRadioReference = false;
        }
    }

    private setupRadioReferenceValidation(): void {
        if (!this.form) return;

        const radioReferenceEnabledControl = this.form.get('radioReferenceEnabled');
        const usernameControl = this.form.get('radioReferenceUsername');
        const passwordControl = this.form.get('radioReferencePassword');

        if (radioReferenceEnabledControl && usernameControl && passwordControl) {
            // Listen to enabled toggle changes
            this.radioReferenceSubscription = radioReferenceEnabledControl.valueChanges.subscribe(enabled => {
                if (enabled) {
                    usernameControl.setValidators([Validators.required]);
                    passwordControl.setValidators([Validators.required]);
                } else {
                    usernameControl.clearValidators();
                    passwordControl.clearValidators();
                }
                
                usernameControl.updateValueAndValidity();
                passwordControl.updateValueAndValidity();
                
                // Force form to detect changes
                if (this.form) {
                    this.form.markAsDirty();
                    this.form.updateValueAndValidity();
                }
            });

            // Listen to username changes (only after initial load to avoid marking form dirty on auto-populate)
            usernameControl.valueChanges.subscribe(() => {
                if (this.initialLoadComplete) {
                    if (this.form) {
                        this.form.markAsDirty();
                    }
                }
            });

            // Listen to password changes (only after initial load to avoid marking form dirty on auto-populate)
            passwordControl.valueChanges.subscribe(() => {
                if (this.initialLoadComplete) {
                    if (this.form) {
                        this.form.markAsDirty();
                    }
                }
            });
        }
    }

    private setInitialRadioReferenceValidation(): void {
        if (!this.form) return;

        const radioReferenceEnabledControl = this.form.get('radioReferenceEnabled');
        const usernameControl = this.form.get('radioReferenceUsername');
        const passwordControl = this.form.get('radioReferencePassword');

        if (radioReferenceEnabledControl && usernameControl && passwordControl) {
            const enabled = radioReferenceEnabledControl.value;
            if (enabled) {
                usernameControl.setValidators([Validators.required]);
                passwordControl.setValidators([Validators.required]);
            } else {
                usernameControl.clearValidators();
                passwordControl.clearValidators();
            }
            
            usernameControl.updateValueAndValidity();
            passwordControl.updateValueAndValidity();
        }
    }

    private storeOriginalCredentials(): void {
        if (!this.form) return;
        
        // Store the current values as original values
        this.originalRadioReferenceUsername = this.form.get('radioReferenceUsername')?.value || '';
        this.originalRadioReferencePassword = this.form.get('radioReferencePassword')?.value || '';
    }

    editRadioReferenceLogin(): void {
        if (!this.form) return;
        
        // Store current values as original before editing
        this.storeOriginalCredentials();
        
        // Enter edit mode
        this.isEditingRadioReference = true;
        
        // Keep the username but clear the password for editing
        this.form.get('radioReferencePassword')?.setValue('');
        this.form.markAsDirty();
    }

    cancelEditRadioReference(): void {
        if (!this.form) return;
        
        // Restore the original username and password values
        this.form.get('radioReferenceUsername')?.setValue(this.originalRadioReferenceUsername);
        this.form.get('radioReferencePassword')?.setValue(this.originalRadioReferencePassword);
        
        // Exit edit mode
        this.isEditingRadioReference = false;
        
        // Mark form as pristine since we've restored original values
        this.form.markAsPristine();
    }

    removeRadioReferenceAccount(): void {
        if (!this.form) return;
        
        // Exit edit mode if we were editing
        this.isEditingRadioReference = false;
        
        // Clear credentials and disable Radio Reference
        this.form.get('radioReferenceEnabled')?.setValue(false);
        this.form.get('radioReferenceUsername')?.setValue('');
        this.form.get('radioReferencePassword')?.setValue('');
        this.originalRadioReferenceUsername = '';
        this.originalRadioReferencePassword = '';
        this.form.markAsDirty();
    }

    private hasStoredRadioReferenceCredentials(): boolean {
        return !!(this.originalRadioReferenceUsername && this.originalRadioReferencePassword);
    }

    private setHardcodedRelayServerURL(): void {
        if (!this.form) return;
        
        const relayServerURLControl = this.form.get('relayServerURL');
        if (relayServerURLControl) {
            relayServerURLControl.setValue('https://tlradioserver.thinlineds.com', { emitEvent: false });
        }
    }

    private setupRelayServerFormListeners(): void {
        if (!this.form) return;

        const relayServerURLControl = this.form.get('relayServerURL');
        const relayServerAPIKeyControl = this.form.get('relayServerAPIKey');

        // Don't listen to relayServerURL changes since it's hardcoded
        // if (relayServerURLControl) {
        //     relayServerURLControl.valueChanges.subscribe(() => {
        //         if (this.initialLoadComplete && this.form) {
        //             this.form.markAsDirty();
        //         }
        //     });
        // }

        if (relayServerAPIKeyControl) {
            relayServerAPIKeyControl.valueChanges.subscribe(() => {
                if (this.initialLoadComplete && this.form) {
                    this.form.markAsDirty();
                }
            });
        }
    }

    hasRelayAPIKey(): boolean {
        if (!this.form) return false;
        const apiKey = this.form.get('relayServerAPIKey')?.value;
        return apiKey && apiKey.trim().length > 0;
    }

    requestRelayAPIKey() {
        this.editRelayAPIKey();
    }

    editRelayAPIKey() {
        if (!this.form) return;

        // Use hardcoded relay server URL
        const relayServerURL = 'https://tlradioserver.thinlineds.com';
        const existingAPIKey = this.form.get('relayServerAPIKey')?.value;
        
        // Ensure the form control has the hardcoded value
        const relayServerURLControl = this.form.get('relayServerURL');
        if (relayServerURLControl) {
            relayServerURLControl.setValue(relayServerURL, { emitEvent: false });
        }

        const dialogRef = this.dialog.open(RequestAPIKeyDialogComponent, {
            width: '600px',
            data: { 
                relayServerURL: relayServerURL,
                existingAPIKey: existingAPIKey || null
            }
        });

        dialogRef.afterClosed().subscribe((apiKey: string | null) => {
            if (apiKey && this.form) {
                this.form.get('relayServerAPIKey')?.setValue(apiKey);
                this.form.markAsDirty();
                const message = existingAPIKey 
                    ? 'API key details updated! Make sure to save your configuration.' 
                    : 'API key received! Make sure to save your configuration.';
                this.snackBar.open(message, 'Close', { duration: 5000 });
            }
        });
    }

    recoverRelayAPIKey() {
        if (!this.form) return;

        // Use hardcoded relay server URL
        const relayServerURL = 'https://tlradioserver.thinlineds.com';

        const dialogRef = this.dialog.open(RecoverAPIKeyDialogComponent, {
            width: '600px',
            data: { relayServerURL: relayServerURL }
        });

        dialogRef.afterClosed().subscribe((apiKey: string | null) => {
            if (apiKey && this.form) {
                this.form.get('relayServerAPIKey')?.setValue(apiKey);
                this.form.markAsDirty();
                this.snackBar.open('API key recovered! Make sure to save your configuration.', 'Close', { duration: 5000 });
            }
        });
    }
}
