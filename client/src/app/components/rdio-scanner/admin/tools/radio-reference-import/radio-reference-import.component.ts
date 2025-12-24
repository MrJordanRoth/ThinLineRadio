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

import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { RdioScannerAdminService } from '../../admin.service';

export interface Config {
    access?: any[];
    apikeys?: any[];
    dirwatch?: any[];
    downstreams?: any[];
    groups?: any[];
    options?: any;
    systems?: any[];
    tags?: any[];
    version?: string;
    radioReference?: any;
}

export interface RadioReferenceSystem {
    id: number;
    name: string;
    type: string;
    city: string;
    county: string;
    state: string;
    country: string;
    lastUpdated: string;
}

export interface RadioReferenceTalkgroup {
    id: number;
    alphaTag: string;
    description: string;
    group: string;
    tag: string;
    enc: number; // Match the backend field name exactly (lowercase)
}



export interface RadioReferenceSite {
    id: number;
    name: string;
    latitude: number;
    longitude: number;
    countyId: number;
    countyName: string;
    rfss: number;
}

@Component({
    selector: 'rdio-scanner-admin-radio-reference-import',
    styleUrls: ['./radio-reference-import.component.scss'],
    templateUrl: './radio-reference-import.component.html',
})
export class RdioScannerAdminRadioReferenceImportComponent implements OnInit {
    @Output() config = new EventEmitter<Config>();

    baseConfig: Config = {};

    // Radio Reference connection status
    isConnected: boolean = false;
    connectionStatus: string = '';
    websocketStatus: string = '';
    hasRadioReferenceCredentials: boolean = false;

    // Import
    selectedSystem: RadioReferenceSystem | null = null;
    importType: 'talkgroups' | 'sites' = 'talkgroups';
    importData: any[] = [];
    isImporting: boolean = false;

    // Import destination
    localSystems: any[] = [];
    targetSystemId: number | null = null;

    // UI state
    isLoading: boolean = false;
    errorMessage: string = '';
    successMessage: string = '';

    // Talkgroup management
    allTalkgroups: RadioReferenceTalkgroup[] = [];
    filteredTalkgroups: RadioReferenceTalkgroup[] = [];

    // Talkgroup categories
    talkgroupCategories: { id: number, name: string, description: string }[] = [];
    selectedCategory: { id: number, name: string, description: string } | 'ALL' | undefined = undefined;
    isLoadingCategories: boolean = false;
    hasUserSelectedCategory: boolean = false; // Track if user has made an explicit selection

    // Table configuration
    importColumns = ['id', 'alphaTag', 'description', 'group', 'tag', 'encrypted', 'action'];
    talkgroupColumns = ['select', 'id', 'alphaTag', 'description', 'group', 'tag', 'encrypted'];
    pageSize = 50;
    currentPage = 0;

    // Search and filtering
    searchTerm: string = '';
    groupFilter: string = '';
    tagFilter: string = '';
    encryptedFilter: boolean | null = null;
    encryptedFilterSelection: 'all' | 'encrypted' | 'clear' = 'all';

    // Dropdown data
    countries: { id: number, name: string }[] = [];
    states: { id: number, name: string }[] = [];
    counties: { id: number, name: string }[] = [];
    systems: { id: number, name: string }[] = [];
    selectedCountry: { id: number, name: string } | null = null;
    selectedCountryId: number | null = null;
    selectedStateId: number | null = null;
    selectedCountyId: number | null = null;

    // Progress tracking
    progressCurrent: number = 0;
    progressTotal: number = 0;
    progressMessage: string = '';
    progressStatus: 'idle' | 'starting' | 'processing' | 'complete' = 'idle';
    retryCount: number = 0; // Track retry attempts
    
    // Talkgroup selection
    private selectedTalkgroupIds: Set<number> = new Set<number>();

    constructor(private adminService: RdioScannerAdminService) { }

    onCredentialsChange(): void {
        // Clear connection status when credentials change
        this.isConnected = false;
        this.connectionStatus = '';
        this.countries = [];
        this.states = [];
        this.counties = [];
        this.systems = [];
        this.selectedCountry = null;
        this.selectedCountryId = null;
        this.selectedStateId = null;
        this.selectedCountyId = null;
        this.allTalkgroups = [];
        this.filteredTalkgroups = [];
        this.errorMessage = '';
        this.clearProgress();
    }
    
    clearProgress(): void {
        this.progressCurrent = 0;
        this.progressTotal = 0;
        this.progressMessage = '';
        this.progressStatus = 'idle';
        this.retryCount = 0;
    }

    ngOnInit(): void {
        // Only load data if user is authenticated
        if (this.adminService.authenticated) {
            this.loadConfig(); // Load configuration including RadioReference credentials
            this.checkWebSocketStatus();
            
            // Set up periodic WebSocket status check
            setInterval(() => {
                this.checkWebSocketStatus();
            }, 10000); // Check every 10 seconds
        }
    }

    onTargetSystemIdChange(value: any): void {
        this.targetSystemId = this.normalizeSystemId(value);
    }

    async loadConfig(): Promise<void> {
        this.baseConfig = await this.adminService.getConfig();
        
        if (this.baseConfig.options?.radioReferenceEnabled && this.baseConfig.options?.radioReferenceUsername) {
            this.hasRadioReferenceCredentials = true;
        } else {
            this.hasRadioReferenceCredentials = false;
        }

        this.localSystems = Array.isArray(this.baseConfig.systems) ? this.baseConfig.systems : [];
        if (this.localSystems.length > 0) {
            const existing = this.localSystems.find((s: any) => this.normalizeSystemId(s.id) === this.targetSystemId);
            const candidate = existing ? this.normalizeSystemId(existing.id) : this.normalizeSystemId(this.localSystems[0]?.id);
            this.targetSystemId = candidate ?? null;
        } else if (this.localSystems.length === 0) {
            this.targetSystemId = null;
        }

        // Countries will be loaded when connection is tested successfully
    }

    checkWebSocketStatus(): void {
        const ws = this.adminService['configWebSocket'];
        if (ws && ws.readyState === WebSocket.OPEN) {
            this.websocketStatus = 'Connected';
        } else if (ws && ws.readyState === WebSocket.CONNECTING) {
            this.websocketStatus = 'Connecting...';
        } else if (ws && ws.readyState === WebSocket.CLOSING) {
            this.websocketStatus = 'Disconnecting...';
        } else {
            this.websocketStatus = 'Disconnected';
        }
    }

    // RadioReference credentials are now managed in the main admin settings
    // This component automatically uses the saved credentials from options

    async testConnection(): Promise<void> {
        if (!this.hasRadioReferenceCredentials) {
            this.connectionStatus = 'Radio Reference credentials not configured. Please configure them in the main admin settings first.';
            return;
        }

        const username = this.baseConfig.options?.radioReferenceUsername;

        if (!username) {
            this.connectionStatus = 'Radio Reference username is missing. Please check the admin settings.';
            return;
        }

        try {
            const response = await this.adminService.testRadioReferenceConnection(username);
            if (response.success) {
                this.isConnected = true;
                this.connectionStatus = `Connected successfully! Account expires: ${response.userInfo.expirationDate}`;
                
                // Now load countries since we're connected
                await this.loadCountries();
            } else {
                this.isConnected = false;
                this.connectionStatus = 'Connection failed';
            }
        } catch (error: any) {
            this.isConnected = false;
            this.connectionStatus = `Connection failed: ${error.error || error.message}`;
        }
    }

    // ----- Dropdown flow -----
    async loadCountries(): Promise<void> {
        try {
            const res = await this.adminService.rrGetCountries();
            this.countries = res?.items || [];
        } catch (error) {
            console.error('Error loading countries:', error);
        }
    }

    async onCountryChange(): Promise<void> {
        if (this.selectedCountry) {
            this.selectedCountryId = this.selectedCountry.id;
            console.log('Extracted selectedCountryId:', this.selectedCountryId);
        } else {
            this.selectedCountryId = null;
            console.log('No country selected');
        }
        
        this.states = [];
        this.counties = [];
        this.systems = [];
        this.selectedStateId = null;
        this.selectedCountyId = null;
        this.selectedSystem = null;
        this.allTalkgroups = [];
        this.filteredTalkgroups = [];
        
        if (this.selectedCountryId) {
            const res = await this.adminService.rrGetStates(this.selectedCountryId);
            this.states = res?.items || [];
        }
    }

    async onStateChange(): Promise<void> {
        this.counties = [];
        this.systems = [];
        this.selectedCountyId = null;
        this.selectedSystem = null;
        this.allTalkgroups = [];
        this.filteredTalkgroups = [];
        
        if (this.selectedStateId) {
            const res = await this.adminService.rrGetCounties(this.selectedStateId);
            this.counties = res?.items || [];
        }
    }

    async onCountyChange(): Promise<void> {
        this.systems = [];
        this.selectedSystem = null;
        this.allTalkgroups = [];
        this.filteredTalkgroups = [];
        
        if (this.selectedCountyId) {
            const res = await this.adminService.rrGetSystems(this.selectedCountyId);
            this.systems = res?.items || [];
        }
    }

    onImportTypeChange(): void {
        // Clear all data when switching import types
        this.allTalkgroups = [];
        this.filteredTalkgroups = [];
        this.selectedCategory = undefined;
        this.talkgroupCategories = [];
        this.importData = [];
        this.errorMessage = '';
        this.hasUserSelectedCategory = false; // Reset user selection flag
        
        // Load appropriate data based on import type if we have a system selected
        if (this.selectedSystem) {
            if (this.importType === 'talkgroups') {
                this.loadTalkgroupCategories();
            } else if (this.importType === 'sites') {
                this.loadSites();
            }
        }
    }

    onSystemSelectFromDropdown(systemId: number): void {
        const sys = this.systems.find(s => s.id === systemId);
        if (sys) {
            this.selectedSystem = {
                id: sys.id,
                name: sys.name,
                type: '',
                city: '',
                county: '',
                state: '',
                country: '',
                lastUpdated: ''
            };
            this.importData = [];
            this.selectedCategory = undefined;
            this.hasUserSelectedCategory = false; // Reset user selection flag
            
            // Always load talkgroup categories for new system selection
            if (this.importType === 'talkgroups') {
                this.loadTalkgroupCategories();
            } else if (this.importType === 'sites' && this.importData.length === 0) {
                this.loadSites();
            }
        }
    }

    selectSystem(system: RadioReferenceSystem): void {
        this.selectedSystem = system;
        this.importData = [];
        this.selectedCategory = undefined;
        this.allTalkgroups = [];
        this.filteredTalkgroups = [];
        this.hasUserSelectedCategory = false; // Reset user selection flag
        
        // Always load talkgroup categories for new system selection
        if (this.importType === 'talkgroups') {
            this.loadTalkgroupCategories();
        } else if (this.importType === 'sites' && this.importData.length === 0) {
            this.loadSites();
        }
    }

    async importDataFromRR(): Promise<void> {
        if (!this.selectedSystem) return;

        if (this.importType === 'talkgroups') {
            await this.loadTalkgroups();
            return;
        }

        this.isImporting = true;
        this.clearProgress();
        try {
            let response;
            
            if (this.importType === 'sites') {
                // Use the new sites method
                response = await this.adminService.getRadioReferenceSites(this.selectedSystem.id);
            } else {
                // Use the old method for other import types
                response = await this.adminService.importRadioReferenceData(
                    this.selectedSystem.id,
                    this.importType
                );
            }
            
            if (response.success && Array.isArray(response.data)) {
                this.importData = response.data;
                this.successMessage = '';
            }
        } catch (error: any) {
            console.error('Import failed:', error);
            this.errorMessage = `Import failed: ${error.message}`;
        } finally {
            this.isImporting = false;
        }
    }

    async importToConfig(): Promise<void> {
        if (!this.selectedSystem || this.importData.length === 0) return;

        try {
            switch (this.importType) {
                case 'talkgroups':
                    await this.importTalkgroups();
                    break;
                case 'sites':
                    await this.importSites();
                    break;
            }
        } catch (error: any) {
            console.error('Import failed:', error);
            this.errorMessage = `Import failed: ${error.message}`;
        }
    }

    private async importTalkgroups(): Promise<void> {
        if (!this.baseConfig.systems) return;

        let targetSystem: any = null;

        if (this.targetSystemId !== null) {
            targetSystem = this.baseConfig.systems.find((s: any) => this.normalizeSystemId(s.id) === this.targetSystemId);
        }

        if (!targetSystem) {
            targetSystem = this.baseConfig.systems.find((s: any) => s.systemRef === this.selectedSystem?.id);
        }

        if (!targetSystem) {
            const newSystemId = this.getNextSystemId();
            targetSystem = {
                id: newSystemId,
                label: this.selectedSystem?.name || 'Unknown System',
                systemRef: this.selectedSystem?.id,
                talkgroups: [],
                units: [],
                sites: [],
                autoPopulate: false,
                blacklists: '',
                delay: 0,
                led: '',
                order: this.baseConfig.systems.length + 1,
                alert: '',
                kind: this.selectedSystem?.type || ''
            };
            this.baseConfig.systems.push(targetSystem);
            this.localSystems = [...this.baseConfig.systems];
            this.targetSystemId = this.normalizeSystemId(targetSystem.id ?? newSystemId);
        } else if (this.targetSystemId === null) {
            this.targetSystemId = this.normalizeSystemId(targetSystem.id);
        }

        // Create groups and tags if they don't exist
        if (!targetSystem.talkgroups) targetSystem.talkgroups = [];
        if (!this.baseConfig.groups) this.baseConfig.groups = [];
        if (!this.baseConfig.tags) this.baseConfig.tags = [];

        // Import talkgroups
        this.importData.forEach((tg: RadioReferenceTalkgroup, index: number) => {
            // Create group if it doesn't exist
            let group = this.baseConfig.groups!.find((g: any) => g.label === tg.group);
            if (!group) {
                const groupId = Math.max(...this.baseConfig.groups!.map((g: any) => g.id || 0)) + 1;
                group = {
                    id: groupId,
                    label: tg.group,
                    alert: '',
                    led: '',
                    order: this.baseConfig.groups!.length + 1
                };
                this.baseConfig.groups!.push(group);
            }

            // Create tag if it doesn't exist
            let tag = this.baseConfig.tags!.find((t: any) => t.label === tg.tag);
            if (!tag) {
                const tagId = Math.max(...this.baseConfig.tags!.map((t: any) => t.id || 0)) + 1;
                tag = {
                    id: tagId,
                    label: tg.tag,
                    alert: '',
                    led: '',
                    order: this.baseConfig.tags!.length + 1
                };
                this.baseConfig.tags!.push(tag);
            }

            // Create talkgroup
            const newTalkgroupId = Math.max(...targetSystem.talkgroups.map((t: any) => t.id || 0)) + 1;
            const newTalkgroup = {
                id: newTalkgroupId,
                talkgroupRef: tg.id,
                label: tg.alphaTag,
                name: tg.description,
                groupIds: [group.id],
                tagId: tag.id,
                order: targetSystem.talkgroups.length + 1,
                alert: '',
                led: '',
                delay: 0,
                frequency: 0,
                type: ''
            };

            targetSystem.talkgroups.push(newTalkgroup);
        });
    }



    private async importSites(): Promise<void> {
        if (!this.baseConfig.systems) return;

        let targetSystem: any = null;

        if (this.targetSystemId !== null) {
            targetSystem = this.baseConfig.systems.find((s: any) => this.normalizeSystemId(s.id) === this.targetSystemId);
        }

        if (!targetSystem) {
            targetSystem = this.baseConfig.systems.find((s: any) => s.systemRef === this.selectedSystem?.id);
        }

        if (!targetSystem) {
            const newSystemId = this.getNextSystemId();
            targetSystem = {
                id: newSystemId,
                label: this.selectedSystem?.name || 'Unknown System',
                systemRef: this.selectedSystem?.id,
                talkgroups: [],
                units: [],
                sites: [],
                autoPopulate: false,
                blacklists: '',
                delay: 0,
                led: '',
                order: this.baseConfig.systems.length + 1,
                alert: '',
                kind: this.selectedSystem?.type || ''
            };
            this.baseConfig.systems.push(targetSystem);
            this.localSystems = [...this.baseConfig.systems];
            this.targetSystemId = this.normalizeSystemId(targetSystem.id ?? newSystemId);
        } else if (this.targetSystemId === null) {
            this.targetSystemId = this.normalizeSystemId(targetSystem.id);
        }

        if (!targetSystem.sites) targetSystem.sites = [];

        // Import sites
        this.importData.forEach((site: RadioReferenceSite, index: number) => {
            const newSiteId = Math.max(...targetSystem.sites.map((s: any) => s.id || 0)) + 1;
            const newSite = {
                id: newSiteId,
                siteRef: site.id,
                label: site.name,
                order: targetSystem.sites.length + 1
            };

            targetSystem.sites.push(newSite);
        });
    }

    resetSearch(): void {
        this.selectedSystem = null;
        this.importData = [];
    }

    removeImportItem(index: number): void {
        this.importData.splice(index, 1);
    }

    // Talkgroup management methods
    async loadTalkgroupCategories(): Promise<void> {
        if (!this.selectedSystem) return;

        try {
            this.isLoadingCategories = true;
            this.errorMessage = '';
            
            // Get talkgroup categories for the selected system
            const response = await this.adminService.getRadioReferenceTalkgroupCategories(this.selectedSystem.id);
            
            if (response && response.success && response.categories) {
                this.talkgroupCategories = response.categories;
                this.selectedCategory = undefined; // Reset selection placeholder
                this.hasUserSelectedCategory = false; // Reset user selection flag
                this.selectedTalkgroupIds.clear();
            } else {
                this.talkgroupCategories = [];
                this.selectedCategory = undefined;
                this.selectedTalkgroupIds.clear();
                if (response && response.error) {
                    this.errorMessage = response.error;
                }
            }
            
            this.isLoadingCategories = false;
        } catch (error) {
            this.isLoadingCategories = false;
            this.errorMessage = 'Failed to load talkgroup categories: ' + error;
            this.talkgroupCategories = [];
            this.selectedCategory = undefined;
            this.selectedTalkgroupIds.clear();
        }
    }

    async loadSites(): Promise<void> {
        if (!this.selectedSystem) return;

        try {
            this.isImporting = true;
            this.errorMessage = '';
            
            // Get sites for the selected system
            const response = await this.adminService.getRadioReferenceSites(this.selectedSystem.id);
            
            if (response && response.success && response.data) {
                this.importData = response.data;
            } else {
                this.importData = [];
                if (response && response.error) {
                    this.errorMessage = response.error;
                }
            }
            
            this.isImporting = false;
        } catch (error) {
            this.isImporting = false;
            this.errorMessage = 'Failed to load sites: ' + error;
            this.importData = [];
        }
    }

    async loadTalkgroups(): Promise<void> {
        if (!this.selectedSystem || this.selectedCategory === undefined) return;

        // Prevent multiple simultaneous calls
        if (this.isLoading) {
            return;
        }

        try {
            this.isLoading = true;
            this.errorMessage = '';
            this.progressStatus = 'starting';
            this.progressCurrent = 0;
            this.progressTotal = 0;
            this.retryCount = 0;
            this.selectedTalkgroupIds.clear();
            this.successMessage = '';
            
            // Set appropriate loading message based on selection
            if (this.selectedCategory === 'ALL') {
                this.progressMessage = 'Processing talkgroups. Depending on how many talkgroups there are, this could take a few minutes...';
            } else {
                this.progressMessage = 'Loading talkgroups...';
            }
            
            // Start periodic WebSocket status check
            const statusCheckInterval = setInterval(() => {
                this.checkWebSocketStatus();
                if (this.websocketStatus === 'Disconnected') {
                    console.warn('WebSocket connection lost during import!');
                    this.errorMessage = 'WebSocket connection lost. Please refresh the page and try again.';
                    clearInterval(statusCheckInterval);
                }
            }, 5000); // Check every 5 seconds
            
            let response;
            
        if (this.selectedCategory && this.selectedCategory !== 'ALL') {
                // Get talkgroups for the selected category
                response = await this.adminService.getRadioReferenceTalkgroupsByCategory(
                    this.selectedSystem.id, 
                    this.selectedCategory.id, 
                    this.selectedCategory.name
                );
        } else if (this.selectedCategory === 'ALL') {
            // Get all talkgroups from all categories
            response = await this.adminService.importRadioReferenceData(
                this.selectedSystem.id,
                'talkgroups'
            );
            } else {
                this.isLoading = false;
                return;
            }
            
            // Clear status check interval
            clearInterval(statusCheckInterval);
            
            if (response && response.success !== false) {
                if (response.data && Array.isArray(response.data)) {
                    this.allTalkgroups = response.data;
                } else {
                    this.allTalkgroups = [];
                }
                this.applyFilters();
            } else {
                console.error('Failed to load talkgroups:', response);
                this.errorMessage = response?.error || 'Failed to load talkgroups';
                this.allTalkgroups = [];
                this.filteredTalkgroups = [];
            }
        } catch (error: any) {
            console.error('Error loading talkgroups:', error);
            this.errorMessage = error.message || 'An error occurred while loading talkgroups';
            this.allTalkgroups = [];
            this.filteredTalkgroups = [];
        } finally {
            this.isLoading = false;
        }
    }

    selectCategory(category: { id: number, name: string, description: string } | 'ALL' | undefined): void {
        this.selectedCategory = category;

        this.selectedTalkgroupIds.clear();
        this.successMessage = '';
        this.errorMessage = '';
        this.encryptedFilterSelection = 'all';
        this.encryptedFilter = null;

        if (category === undefined) {
            this.hasUserSelectedCategory = false;
            this.progressStatus = 'idle';
            this.progressMessage = '';
            this.allTalkgroups = [];
            this.filteredTalkgroups = [];
            return;
        }

        // Mark that user has made an explicit selection
        this.hasUserSelectedCategory = true;
        this.allTalkgroups = [];
        this.filteredTalkgroups = [];
        this.applyFilters();
        
        // Only load talkgroups if we're not already loading
        if (!this.isLoading) {
            this.loadTalkgroups();
        }
    }

    applyFilters(): void {
        let filtered = [...this.allTalkgroups];

        // Apply search term filter
        if (this.searchTerm) {
            const term = this.searchTerm.toLowerCase();
            filtered = filtered.filter(tg => 
                tg.alphaTag.toLowerCase().includes(term) ||
                tg.description.toLowerCase().includes(term) ||
                tg.group.toLowerCase().includes(term) ||
                tg.tag.toLowerCase().includes(term) ||
                tg.id.toString().includes(term)
            );
        }

        // Apply group filter
        if (this.groupFilter) {
            filtered = filtered.filter(tg => tg.group.toLowerCase().includes(this.groupFilter.toLowerCase()));
        }

        // Apply tag filter
        if (this.tagFilter) {
            filtered = filtered.filter(tg => tg.tag.toLowerCase().includes(this.tagFilter.toLowerCase()));
        }

        // Apply encrypted filter
        if (this.encryptedFilter !== null) {
            filtered = filtered.filter(tg => this.isEncrypted(tg) === this.encryptedFilter);
        }

        this.filteredTalkgroups = filtered;
        this.currentPage = 0;
    }

    onSearchChange(): void {
        this.applyFilters();
        this.selectedTalkgroupIds.clear();
    }

    onGroupFilterChange(): void {
        this.applyFilters();
    }

    onTagFilterChange(): void {
        this.applyFilters();
    }

    onEncryptedFilterChange(): void {
        switch (this.encryptedFilterSelection) {
            case 'encrypted':
                this.encryptedFilter = true;
                break;
            case 'clear':
                this.encryptedFilter = false;
                break;
            default:
                this.encryptedFilter = null;
                break;
        }
        this.applyFilters();
    }

    getPaginatedTalkgroups(): RadioReferenceTalkgroup[] {
        const startIndex = this.currentPage * this.pageSize;
        return this.filteredTalkgroups.slice(startIndex, startIndex + this.pageSize);
    }

    onPageChange(event: any): void {
        this.currentPage = event.pageIndex;
        this.pageSize = event.pageSize;
    }

    getCurrentPageInfo(): string {
        const start = this.currentPage * this.pageSize + 1;
        const end = Math.min((this.currentPage + 1) * this.pageSize, this.filteredTalkgroups.length);
        const total = this.filteredTalkgroups.length;
        return `${start}-${end} of ${total}`;
    }

    isTalkgroupSelected(talkgroup: RadioReferenceTalkgroup): boolean {
        return this.selectedTalkgroupIds.has(talkgroup.id);
    }

    onTalkgroupCheckboxChange(talkgroup: RadioReferenceTalkgroup, checked: boolean): void {
        if (checked) {
            this.selectedTalkgroupIds.add(talkgroup.id);
        } else {
            this.selectedTalkgroupIds.delete(talkgroup.id);
        }
    }

    areAllVisibleTalkgroupsSelected(): boolean {
        const visible = this.getPaginatedTalkgroups();
        return visible.length > 0 && visible.every(tg => this.selectedTalkgroupIds.has(tg.id));
    }

    areSomeVisibleTalkgroupsSelected(): boolean {
        const visible = this.getPaginatedTalkgroups();
        const selectedCount = visible.filter(tg => this.selectedTalkgroupIds.has(tg.id)).length;
        return selectedCount > 0 && selectedCount < visible.length;
    }

    toggleSelectAllVisible(checked: boolean): void {
        const visible = this.getPaginatedTalkgroups();
        if (checked) {
            visible.forEach(tg => this.selectedTalkgroupIds.add(tg.id));
        } else {
            visible.forEach(tg => this.selectedTalkgroupIds.delete(tg.id));
        }
    }

    selectAllTalkgroups(): void {
        this.filteredTalkgroups.forEach(tg => this.selectedTalkgroupIds.add(tg.id));
    }

    selectAllVisibleTalkgroups(): void {
        this.toggleSelectAllVisible(true);
    }

    clearSelectedTalkgroups(): void {
        this.selectedTalkgroupIds.clear();
        this.successMessage = '';
    }

    getSelectedTalkgroupCount(): number {
        return this.selectedTalkgroupIds.size;
    }

    addSelectedTalkgroupsToImportList(): void {
        if (this.getSelectedTalkgroupCount() === 0) {
            return;
        }

        const selectedTalkgroups = this.allTalkgroups.filter(tg => this.selectedTalkgroupIds.has(tg.id));
        let addedCount = 0;
        selectedTalkgroups.forEach(tg => {
            if (!this.importData.some(item => item.id === tg.id)) {
                this.importData.push({ ...tg });
                addedCount++;
            }
        });

        this.selectedTalkgroupIds.clear();

        if (addedCount > 0) {
            this.successMessage = `Added ${addedCount} talkgroup${addedCount > 1 ? 's' : ''} to the review list.`;
            this.errorMessage = '';
        } else {
            this.successMessage = '';
        }
    }

    clearReviewList(): void {
        if (this.importData.length === 0) {
            return;
        }
        this.importData = [];
        this.successMessage = '';
        this.errorMessage = '';
    }

    getImportButtonLabel(): string {
        if (this.isImporting) {
            return 'Importing...';
        }
        return 'Import to System';
    }

    trackBySystemId = (_: number, system: any): number => {
        return this.normalizeSystemId(system?.id) ?? 0;
    };

    private normalizeSystemId(value: any): number | null {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    private getNextSystemId(): number {
        if (!Array.isArray(this.baseConfig.systems) || this.baseConfig.systems.length === 0) {
            return 1;
        }
        const ids = this.baseConfig.systems.map((s: any) => Number(s.id) || 0);
        return Math.max(0, ...ids) + 1;
    }

    isEncrypted(talkgroup: RadioReferenceTalkgroup): boolean {
        return talkgroup.enc === 1 || talkgroup.enc === 2;
    }

    getEncryptedText(talkgroup: RadioReferenceTalkgroup): string {
        return this.isEncrypted(talkgroup) ? 'Yes' : 'No';
    }

    getEncryptedIcon(talkgroup: RadioReferenceTalkgroup): string {
        return this.isEncrypted(talkgroup) ? 'lock' : 'lock_open';
    }

    getEncryptedColor(talkgroup: RadioReferenceTalkgroup): string {
        return this.isEncrypted(talkgroup) ? 'warn' : 'primary';
    }

    clearFilters(): void {
        this.searchTerm = '';
        this.groupFilter = '';
        this.tagFilter = '';
        this.encryptedFilter = null;
        this.encryptedFilterSelection = 'all';
        this.applyFilters();
    }

    exportToCsv(): void {
        if (this.filteredTalkgroups.length === 0) return;

        const headers = ['ID', 'Alpha Tag', 'Description', 'Group', 'Tag', 'Encrypted'];
        const csvContent = [
            headers.join(','),
            ...this.filteredTalkgroups.map(tg => [
                tg.id,
                `"${tg.alphaTag}"`,
                `"${tg.description}"`,
                `"${tg.group}"`,
                `"${tg.tag}"`,
                this.isEncrypted(tg) ? 'Yes' : 'No'
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        // Get county name from the counties array using selectedCountyId
        const countyName = this.selectedCountyId ? 
            this.counties.find(c => c.id === this.selectedCountyId)?.name || 'unknown' : 'unknown';
        
        a.download = `talkgroups_${countyName}_${this.selectedSystem?.name || 'unknown'}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    }

    getCountyPath(): string {
        const parts = [];
        
        // Get country name from the countries array using selectedCountry
        if (this.selectedCountry) parts.push(this.selectedCountry.name);
        
        // Get state name from the states array using selectedStateId
        if (this.selectedStateId) {
            const state = this.states.find(s => s.id === this.selectedStateId);
            if (state) parts.push(state.name);
        }
        
        // Get county name from the counties array using selectedCountyId
        if (this.selectedCountyId) {
            const county = this.counties.find(c => c.id === this.selectedCountyId);
            if (county) parts.push(county.name);
        }
        
        return parts.join(' > ');
    }

    getImportTypeDisplayName(): string {
        switch (this.importType) {
            case 'talkgroups':
                return 'Talkgroups';
            case 'sites':
                return 'Sites';
            default:
                return 'Data';
        }
    }

    isCheckpointMessage(message: string | null): boolean {
        return message ? message.includes('Checkpoint') : false;
    }
}
