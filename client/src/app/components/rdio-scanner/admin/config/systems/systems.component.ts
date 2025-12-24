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

import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { Component, Input, QueryList, ViewChildren } from '@angular/core';
import { FormArray, FormGroup } from '@angular/forms';
import { MatExpansionPanel } from '@angular/material/expansion';
import { RdioScannerAdminService, Group, Tag } from '../../admin.service';

@Component({
    selector: 'rdio-scanner-admin-systems',
    templateUrl: './systems.component.html',
})
export class RdioScannerAdminSystemsComponent {
    @Input() form: FormArray | undefined;

    get systems(): FormGroup[] {
        return this.form?.controls
            .sort((a, b) => (a.value.order || 0) - (b.value.order || 0)) as FormGroup[];
    }

    get groups(): Group[] {
        if (!this.form) return [];
        const groupsArray = this.form.root.get('groups') as FormArray;
        return groupsArray ? groupsArray.value : [];
    }

    get tags(): Tag[] {
        if (!this.form) return [];
        const tagsArray = this.form.root.get('tags') as FormArray;
        return tagsArray ? tagsArray.value : [];
    }

    @ViewChildren(MatExpansionPanel) private panels: QueryList<MatExpansionPanel> | undefined;

    constructor(private adminService: RdioScannerAdminService) { }

    add(): void {
        const system = this.adminService.newSystemForm();

        system.markAllAsTouched();

        this.form?.insert(0, system);

        this.form?.markAsDirty();
    }

    closeAll(): void {
        this.panels?.forEach((panel) => panel.close());
    }

    drop(event: CdkDragDrop<FormGroup[]>): void {
        if (event.previousIndex !== event.currentIndex) {
            moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);

            event.container.data.forEach((dat, idx) => dat.get('order')?.setValue(idx + 1, { emitEvent: false }));

            this.form?.markAsDirty();
        }
    }

    remove(index: number): void {
        this.form?.removeAt(index);

        this.form?.markAsDirty();
    }

    removeAll(): void {
        if (!this.form || this.form.length === 0) {
            return;
        }

        const count = this.form.length;
        if (!confirm(`Are you sure you want to delete all ${count} system${count > 1 ? 's' : ''}? This action cannot be undone.`)) {
            return;
        }

        while (this.form.length > 0) {
            this.form.removeAt(0);
        }

        this.form.markAsDirty();
    }
}
