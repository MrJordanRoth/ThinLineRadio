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

import { Component, OnDestroy, ViewEncapsulation } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { AdminEvent, RdioScannerAdminService, Group, Tag } from './admin.service';

@Component({
    encapsulation: ViewEncapsulation.None,
    selector: 'rdio-scanner-admin',
    styleUrls: ['./admin.component.scss'],
    templateUrl: './admin.component.html',
})
export class RdioScannerAdminComponent implements OnDestroy {
    authenticated = false;

    groups: Group[] = [];

    tags: Tag[] = [];

    private eventSubscription;

    constructor(
        private adminService: RdioScannerAdminService,
        private titleService: Title,
    ) {
        // Initialize authenticated state from admin service
        this.authenticated = this.adminService.authenticated;
        
        // Set initial title if already authenticated
        if (this.authenticated) {
            this.updateTitle();
        }
        
        this.eventSubscription = this.adminService.event.subscribe(async (event: AdminEvent) => {
            if ('authenticated' in event) {
                this.authenticated = event.authenticated || false;
                
                // Update title when authentication state changes
                if (this.authenticated) {
                    this.updateTitle();
                }
            }

            if ('config' in event && event.config) {
                const branding = event.config.branding?.trim() || 'TLR';
                const pageTitle = `Admin-${branding}`;
                this.titleService.setTitle(pageTitle);
            }
        });
    }

    private async updateTitle(): Promise<void> {
        try {
            const config = await this.adminService.getConfig();
            const branding = config.branding?.trim() || 'TLR';
            const pageTitle = `Admin-${branding}`;
            this.titleService.setTitle(pageTitle);
        } catch (error) {
            // If config fetch fails, use default
            this.titleService.setTitle('Admin-TLR');
        }
    }

    ngOnDestroy(): void {
        this.eventSubscription.unsubscribe();
    }

    async logout(): Promise<void> {
        await this.adminService.logout();
    }
}
