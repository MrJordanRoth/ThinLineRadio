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

import { DOCUMENT } from '@angular/common';
import { Component, EventEmitter, Inject, Output } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Config, RdioScannerAdminService } from '../../admin.service';
import packageInfo from '../../../../../../../package.json';

@Component({
    selector: 'rdio-scanner-admin-import-export-config',
    styleUrls: ['./import-export-config.component.scss'],
    templateUrl: './import-export-config.component.html',
})
export class RdioScannerAdminImportExportConfigComponent {
    @Output() config = new EventEmitter<Config>();

    version = packageInfo.version;

    constructor(
        private adminService: RdioScannerAdminService,
        @Inject(DOCUMENT) private document: Document,
        private matSnackBar: MatSnackBar,
    ) { }

    async importAndApply(event: Event): Promise<void> {
        const target = (event.target as HTMLInputElement & EventTarget);

        const file = target.files?.item(0);

        if (!(file instanceof File)) return;

        const reader = new FileReader();

        reader.onloadend = async () => {
            target.value = '';

            try {
                const res = decodeURIComponent(Array.prototype.map.call(reader.result, (c) => {
                    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
                }).join(''));

                let config = JSON.parse(res);

                // Apply same transformations as regular import
                if (Array.isArray(config.access))
                    config.access.forEach((access: { [key: string]: unknown }) => {
                        // Handle v6 _id field -> v7 id
                        if (access['_id'] !== undefined && access['id'] === undefined) {
                            access['id'] = access['_id'];
                            delete access['_id'];
                        }
                    });

                if (Array.isArray(config.users))
                    config.users.forEach((user: { [key: string]: unknown }) => {
                        // Handle v6 _id field -> v7 id
                        if (user['_id'] !== undefined && user['id'] === undefined) {
                            user['id'] = user['_id'];
                            delete user['_id'];
                        }
                    });

                if (Array.isArray(config.userGroups))
                    config.userGroups.forEach((userGroup: { [key: string]: unknown }) => {
                        // Handle v6 _id field -> v7 id
                        if (userGroup['_id'] !== undefined && userGroup['id'] === undefined) {
                            userGroup['id'] = userGroup['_id'];
                            delete userGroup['_id'];
                        }
                    });

                if (config['apiKeys'] !== undefined && config['apikeys'] === undefined) {
                    config['apikeys'] = config['apiKeys'];
                    delete config['apiKeys'];
                }
                if (Array.isArray(config.apikeys))
                    config.apikeys.forEach((apikey: { [key: string]: unknown }) => {
                        if (apikey['_id'] !== undefined && apikey['id'] === undefined) {
                            apikey['id'] = apikey['_id'];
                            delete apikey['_id'];
                        }
                    });

                if (config['dirWatch'] !== undefined && config['dirwatch'] === undefined) {
                    config['dirwatch'] = config['dirWatch'];
                    delete config['dirWatch'];
                }
                if (Array.isArray(config.dirwatch))
                    config.dirwatch.forEach((dirwatch: { [key: string]: unknown }) => {
                        if (dirwatch['_id'] !== undefined && dirwatch['id'] === undefined) {
                            dirwatch['id'] = dirwatch['_id'];
                            delete dirwatch['_id'];
                        }
                    });

                if (Array.isArray(config.downstreams))
                    config.downstreams.forEach((downstream: { [key: string]: unknown }) => {
                        if (downstream['_id'] !== undefined && downstream['id'] === undefined) {
                            downstream['id'] = downstream['_id'];
                            delete downstream['_id'];
                        }
                        if (downstream['apiKey'] !== undefined && downstream['apikey'] === undefined) {
                            downstream['apikey'] = downstream['apiKey'];
                            delete downstream['apiKey'];
                        }
                    });

                if (Array.isArray(config.groups))
                    config.groups.forEach((group: { [key: string]: unknown }) => {
                        if (group['_id'] !== undefined && group['id'] === undefined) {
                            group['id'] = group['_id'];
                            delete group['_id'];
                        }
                    });

                    config.groups = (config.groups as { label: string }[]).sort((a, b) => a.label.localeCompare(b.label));

                if (Array.isArray(config.tags))
                    config.tags.forEach((tag: { [key: string]: unknown }) => {
                        if (tag['_id'] !== undefined && tag['id'] === undefined) {
                            tag['id'] = tag['_id'];
                            delete tag['_id'];
                        }
                    });

                    config.tags = (config.tags as { label: string }[]).sort((a, b) => a.label.localeCompare(b.label));

                if (Array.isArray(config.systems))
                    config.systems.forEach((system: { [key:string]:unknown}) => {
                        if (system['_id'] !== undefined) {
                            if (system['id'] !== undefined) {
                                system['systemRef'] = system['id'];
                            }
                            system['id'] = system['_id'];
                            delete system['_id'];
                        } else if (system['id'] !== undefined && system['systemRef'] === undefined) {
                            system['systemRef'] = system['id'];
                            delete system['id'];
                        }

                        if (system['sites'] === undefined) {
                            system['sites'] = [];
                        } else if (Array.isArray(system['sites'])) {
                            system['sites'].forEach((site: { [key: string]: unknown }) => {
                                if (site['_id'] !== undefined && site['id'] === undefined) {
                                    site['id'] = site['_id'];
                                    delete site['_id'];
                                }
                            });
                        }

                        if (system['units'] !== undefined && Array.isArray(system['units'])) {
                            system['units'].forEach((unit: { [key: string]: unknown }) => {
                                if (unit['id'] !== undefined && unit['unitRef'] === undefined && unit['_id'] === undefined) {
                                    unit['unitRef'] = unit['id'];
                                    delete unit['id'];
                                }
                                
                                if (unit['_id'] !== undefined && unit['id'] === undefined) {
                                    unit['id'] = unit['_id'];
                                    delete unit['_id'];
                                }
                                
                                if (unit['unitRef'] === undefined) {
                                    unit['unitRef'] = null;
                                }
                                if (unit['unitFrom'] === undefined) {
                                    unit['unitFrom'] = null;
                                }
                                if (unit['unitTo'] === undefined) {
                                    unit['unitTo'] = null;
                                }
                            });
                        }

                        const talkgroups = system['talkgroups'];

                        if (Array.isArray(talkgroups))
                            talkgroups.forEach((talkgroup: {[key:string]: unknown}) => {
                                const groupId = talkgroup['groupId'];
                                if (groupId !== undefined) {
                                    if (typeof groupId === 'number') {
                                        talkgroup['groupIds'] = [groupId];
                                    }
                                    delete talkgroup['groupId'];
                                }

                                if (talkgroup['id'] !== undefined && talkgroup['talkgroupRef'] === undefined) {
                                    talkgroup['talkgroupRef'] = talkgroup['id'];
                                    delete talkgroup['id'];
                                }
                                if (talkgroup['_id'] !== undefined && talkgroup['id'] === undefined) {
                                    talkgroup['id'] = talkgroup['_id'];
                                    delete talkgroup['_id'];
                                }
                            });

                    });

                if (!config.options) {
                    config.options = {};
                }
                
                const defaultOptions = {
                    defaultSystemDelay: 0,
                    userRegistrationEnabled: false,
                    publicRegistrationEnabled: false,
                    publicRegistrationMode: 'both',
                    stripePaywallEnabled: false,
                    emailServiceEnabled: false,
                    emailServiceType: 'smtp',
                    emailServiceApiKey: '',
                    emailServiceDomain: '',
                    emailServiceTemplateId: '',
                    emailSmtpHost: '',
                    emailSmtpPort: 587,
                    emailSmtpUsername: '',
                    emailSmtpPassword: '',
                    emailSmtpFromEmail: '',
                    emailSmtpFromName: '',
                    emailSmtpUseTLS: true,
                    emailLogoFilename: '',
                    emailLogoBorderRadius: '0px',
                    stripePublishableKey: '',
                    stripeSecretKey: '',
                    stripeWebhookSecret: '',
                    stripeGracePeriodDays: 0,
                    baseUrl: '',
                    adminLocalhostOnly: false,
                    radioReferenceEnabled: false,
                    radioReferenceUsername: '',
                    radioReferencePassword: '',
                    radioReferenceAPIKey: ''
                };
                
                config.options = { ...defaultOptions, ...config.options };
                
                if (config.options['afsSystems'] !== undefined) {
                    delete config.options['afsSystems'];
                }
                if (config.options['searchPatchedTalkgroups'] !== undefined) {
                    delete config.options['searchPatchedTalkgroups'];
                }
                if (config.options['tagsToggle'] !== undefined) {
                    delete config.options['tagsToggle'];
                }

                // Directly save the config with full import flag
                await this.adminService.saveConfig(config, true);
                this.matSnackBar.open('Config imported and applied successfully', '', { duration: 5000 });

            } catch (error) {
                this.matSnackBar.open(error as string, '', { duration: 5000 });
            }
        };

        reader.readAsBinaryString(file);
    }

    async export(): Promise<void> {
        const config = await this.adminService.getConfig();

        const file = encodeURIComponent(JSON.stringify(config)).replace(/%([0-9A-F]{2})/g, (_, c) => {
            return String.fromCharCode(parseInt(c, 16));
        });
        const fileName = `ThinLineRadioV7-config.json`;
        const fileType = 'application/json';
        const fileUri = `data:${fileType};base64,${window.btoa(file)}`;

        const el = this.document.createElement('a');

        el.style.display = 'none';

        el.setAttribute('href', fileUri);
        el.setAttribute('download', fileName);

        this.document.body.appendChild(el);

        el.click();

        this.document.body.removeChild(el);
    }

    async import(event: Event): Promise<void> {
        const target = (event.target as HTMLInputElement & EventTarget);

        const file = target.files?.item(0);

        if (!(file instanceof File)) return;

        const reader = new FileReader();

        reader.onloadend = () => {
            target.value = '';

            try {
                const res = decodeURIComponent(Array.prototype.map.call(reader.result, (c) => {
                    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
                }).join(''));

                const config = JSON.parse(res);

                // Remove v6-only 'access' field (not present in v7)
                if (config['access'] !== undefined) {
                    delete config['access'];
                }

                // Convert v6 'apiKeys' to v7 'apikeys'
                if (config['apiKeys'] !== undefined && config['apikeys'] === undefined) {
                    config['apikeys'] = config['apiKeys'];
                    delete config['apiKeys'];
                }
                if (Array.isArray(config.apikeys))
                    config.apikeys.forEach((apikey: { [key: string]: unknown }) => {
                        // Handle v6 _id field (RowId) -> v7 id (systemId)
                        if (apikey['_id'] !== undefined && apikey['id'] === undefined) {
                            apikey['id'] = apikey['_id'];
                            delete apikey['_id'];
                        }
                    });

                // Convert v6 'dirWatch' to v7 'dirwatch'
                if (config['dirWatch'] !== undefined && config['dirwatch'] === undefined) {
                    config['dirwatch'] = config['dirWatch'];
                    delete config['dirWatch'];
                }
                if (Array.isArray(config.dirwatch))
                    config.dirwatch.forEach((dirwatch: { [key: string]: unknown }) => {
                        // Handle v6 _id field -> v7 id
                        if (dirwatch['_id'] !== undefined && dirwatch['id'] === undefined) {
                            dirwatch['id'] = dirwatch['_id'];
                            delete dirwatch['_id'];
                        }
                    });

                if (Array.isArray(config.downstreams))
                    config.downstreams.forEach((downstream: { [key: string]: unknown }) => {
                        // Handle v6 _id field -> v7 id
                        if (downstream['_id'] !== undefined && downstream['id'] === undefined) {
                            downstream['id'] = downstream['_id'];
                            delete downstream['_id'];
                        }
                        // Convert v6 'apiKey' to v7 'apikey'
                        if (downstream['apiKey'] !== undefined && downstream['apikey'] === undefined) {
                            downstream['apikey'] = downstream['apiKey'];
                            delete downstream['apiKey'];
                        }
                    });

                if (Array.isArray(config.groups))
                    config.groups.forEach((group: { [key: string]: unknown }) => {
                        // Handle v6 _id field -> v7 id
                        if (group['_id'] !== undefined && group['id'] === undefined) {
                            group['id'] = group['_id'];
                            delete group['_id'];
                        }
                    });

                    config.groups = (config.groups as { label: string }[]).sort((a, b) => a.label.localeCompare(b.label));

                if (Array.isArray(config.tags))
                    config.tags.forEach((tag: { [key: string]: unknown }) => {
                        // Handle v6 _id field -> v7 id
                        if (tag['_id'] !== undefined && tag['id'] === undefined) {
                            tag['id'] = tag['_id'];
                            delete tag['_id'];
                        }
                    });

                    config.tags = (config.tags as { label: string }[]).sort((a, b) => a.label.localeCompare(b.label));

                if (Array.isArray(config.systems))
                    config.systems.forEach((system: { [key:string]:unknown}) => {
                        // v6 structure: _id (RowId), id (System.Id)
                        // v7 structure: id (systemId), systemRef (System.Id)
                        if (system['_id'] !== undefined) {
                            // _id is the RowId (systemId in v7)
                            if (system['id'] !== undefined) {
                                // id is the System.Id (systemRef in v7)
                                system['systemRef'] = system['id'];
                            }
                            // Convert _id to id
                            system['id'] = system['_id'];
                            delete system['_id'];
                        } else if (system['id'] !== undefined && system['systemRef'] === undefined) {
                            // If only 'id' exists and no systemRef, assume it's System.Id
                            system['systemRef'] = system['id'];
                            // id will be generated by the server
                            delete system['id'];
                        }

                        // Ensure sites array exists (v7 addition, may be missing in v6)
                        if (system['sites'] === undefined) {
                            system['sites'] = [];
                        } else if (Array.isArray(system['sites'])) {
                            // Handle site _id -> id conversion
                            system['sites'].forEach((site: { [key: string]: unknown }) => {
                                if (site['_id'] !== undefined && site['id'] === undefined) {
                                    site['id'] = site['_id'];
                                    delete site['_id'];
                                }
                            });
                        }

                        // Ensure units array is preserved (present in both v6 and v7)
                        if (system['units'] !== undefined && Array.isArray(system['units'])) {
                            system['units'].forEach((unit: { [key: string]: unknown }) => {
                                // v6 to v7 unit conversion:
                                // v6: id = unit radio ID, _id = database row ID
                                // v7: id = database row ID, unitRef = unit radio ID
                                
                                // If v6 has 'id' field and no 'unitRef', move id to unitRef
                                if (unit['id'] !== undefined && unit['unitRef'] === undefined && unit['_id'] === undefined) {
                                    // This is a v6 unit with just 'id' - move it to unitRef
                                    unit['unitRef'] = unit['id'];
                                    // Delete id so server assigns new row ID
                                    delete unit['id'];
                                }
                                
                                // Handle unit _id -> id conversion (for units that have _id)
                                if (unit['_id'] !== undefined && unit['id'] === undefined) {
                                    unit['id'] = unit['_id'];
                                    delete unit['_id'];
                                }
                                
                                // Add v7-specific unit fields with null defaults if they don't exist
                                if (unit['unitRef'] === undefined) {
                                    unit['unitRef'] = null;
                                }
                                if (unit['unitFrom'] === undefined) {
                                    unit['unitFrom'] = null;
                                }
                                if (unit['unitTo'] === undefined) {
                                    unit['unitTo'] = null;
                                }
                            });
                        }

                        const talkgroups = system['talkgroups'];

                        if (Array.isArray(talkgroups))
                            talkgroups.forEach((talkgroup: {[key:string]: unknown}) => {
                                // Convert v6 single groupId to v7 groupIds array
                                const groupId = talkgroup['groupId'];
                                if (groupId !== undefined) {
                                    if (typeof groupId === 'number') {
                                        talkgroup['groupIds'] = [groupId];
                                    }
                                    delete talkgroup['groupId'];
                                }

                                // Handle talkgroup id/talkgroupRef conversion
                                // v6: id is Talkgroup.Id (becomes talkgroupRef in v7)
                                // v6: _id is RowId (becomes id in v7)
                                // Server's FromMap handles both id and _id for backward compatibility
                                if (talkgroup['id'] !== undefined && talkgroup['talkgroupRef'] === undefined) {
                                    // id exists but talkgroupRef doesn't - id is Talkgroup.Id in v6
                                    talkgroup['talkgroupRef'] = talkgroup['id'];
                                    delete talkgroup['id'];
                                }
                                // If _id exists, convert to id (server will use it)
                                if (talkgroup['_id'] !== undefined && talkgroup['id'] === undefined) {
                                    talkgroup['id'] = talkgroup['_id'];
                                    delete talkgroup['_id'];
                                }
                            });

                    });

                // Handle options/user registration fields (v7 additions that may not exist in v6)
                if (Array.isArray(config.users))
                    config.users.forEach((user: { [key: string]: unknown }) => {
                        // Handle v6 _id field -> v7 id
                        if (user['_id'] !== undefined && user['id'] === undefined) {
                            user['id'] = user['_id'];
                            delete user['_id'];
                        }
                    });

                if (Array.isArray(config.userGroups))
                    config.userGroups.forEach((userGroup: { [key: string]: unknown }) => {
                        // Handle v6 _id field -> v7 id
                        if (userGroup['_id'] !== undefined && userGroup['id'] === undefined) {
                            userGroup['id'] = userGroup['_id'];
                            delete userGroup['_id'];
                        }
                    });

                if (Array.isArray(config.access))
                    config.access.forEach((access: { [key: string]: unknown }) => {
                        // Handle v6 _id field -> v7 id
                        if (access['_id'] !== undefined && access['id'] === undefined) {
                            access['id'] = access['_id'];
                            delete access['_id'];
                        }
                    });

                if (!config.options) {
                    config.options = {};
                }
                
                // Set defaults for ALL v7 options fields if they don't exist
                const defaultOptions = {
                    // Core options that may be missing in v6
                    defaultSystemDelay: 0,
                    // User Registration fields
                    userRegistrationEnabled: false,
                    publicRegistrationEnabled: false,
                    publicRegistrationMode: 'both',
                    stripePaywallEnabled: false,
                    emailServiceEnabled: false,
                    emailServiceType: 'smtp',
                    emailServiceApiKey: '',
                    emailServiceDomain: '',
                    emailServiceTemplateId: '',
                    emailSmtpHost: '',
                    emailSmtpPort: 587,
                    emailSmtpUsername: '',
                    emailSmtpPassword: '',
                    emailSmtpFromEmail: '',
                    emailSmtpFromName: '',
                    emailSmtpUseTLS: true,
                    emailLogoFilename: '',
                    emailLogoBorderRadius: '0px',
                    stripePublishableKey: '',
                    stripeSecretKey: '',
                    stripeWebhookSecret: '',
                    stripeGracePeriodDays: 0,
                    baseUrl: '',
                    adminLocalhostOnly: false,
                    // RadioReference fields
                    radioReferenceEnabled: false,
                    radioReferenceUsername: '',
                    radioReferencePassword: '',
                    radioReferenceAPIKey: ''
                };
                
                // Merge defaults with existing options (existing values take precedence)
                config.options = { ...defaultOptions, ...config.options };
                
                // Remove v6-only options fields that don't exist in v7
                if (config.options['afsSystems'] !== undefined) {
                    delete config.options['afsSystems'];
                }
                if (config.options['searchPatchedTalkgroups'] !== undefined) {
                    delete config.options['searchPatchedTalkgroups'];
                }
                if (config.options['tagsToggle'] !== undefined) {
                    delete config.options['tagsToggle'];
                }
                
                // Note: The options object (including relayServerURL and relayServerAPIKey) 
                // is automatically preserved as part of the config object and will be 
                // processed by the server's config handler

                // Emit config with isImport flag to indicate this is an "Import for Review"
                this.config.emit({ ...config, __isImport: true } as any);

                // const versionMajor = this.version.split('.')[0];

                // if (config['version']?.split('.')[0] === versionMajor) {
                //     this.config.emit(config);

                // } else {
                //     this.matSnackBar.open('Config file version mismatch', '', { duration: 5000 });
                // }


            } catch (error) {
                this.matSnackBar.open(error as string, '', { duration: 5000 });
            }
        };

        reader.readAsBinaryString(file);
    }
}
