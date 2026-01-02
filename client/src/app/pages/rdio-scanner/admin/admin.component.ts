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

import { Component, OnInit, OnDestroy } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import packageInfo from '../../../../../package.json';
import { RdioScannerAdminService, AdminEvent } from '../../../components/rdio-scanner/admin/admin.service';

@Component({
    selector: 'rdio-scanner-admin-page',
    styleUrls: ['./admin.component.scss'],
    templateUrl: './admin.component.html',
})
export class RdioScannerAdminPageComponent implements OnInit, OnDestroy {
    version = packageInfo.version;
    private eventSubscription: Subscription | undefined;

    constructor(
        private adminService: RdioScannerAdminService,
        private titleService: Title,
    ) {}

    ngOnInit(): void {
        // Set initial title
        this.titleService.setTitle('Admin-TLR');
        
        // Set initial title if already authenticated
        if (this.adminService.authenticated) {
            this.updateTitle();
        }

        // Listen for config events
        this.eventSubscription = this.adminService.event.subscribe(async (event: AdminEvent) => {
            if ('authenticated' in event && event.authenticated) {
                this.updateTitle();
            }

            if ('config' in event && event.config) {
                const branding = event.config.branding?.trim() || 'TLR';
                const pageTitle = `Admin-${branding}`;
                this.titleService.setTitle(pageTitle);
            }
        });
    }

    ngOnDestroy(): void {
        this.eventSubscription?.unsubscribe();
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
}
