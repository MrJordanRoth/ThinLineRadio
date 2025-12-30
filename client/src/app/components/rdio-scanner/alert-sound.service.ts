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

export interface AlertSound {
    name: string;
    displayName: string;
    file: string;
}

@Injectable({
    providedIn: 'root',
})
export class AlertSoundService {
    private audio: HTMLAudioElement | null = null;
    private volume = 0.7;

    private readonly sounds: AlertSound[] = [
        { name: 'none', displayName: 'None (Silent)', file: '' },
        { name: 'alert', displayName: 'Alert', file: 'assets/sounds/alert.wav' },
        { name: 'beep', displayName: 'Beep', file: 'assets/sounds/Beep.mp3' },
        { name: 'chirp_long', displayName: 'Chirp Long', file: 'assets/sounds/chirp_long.wav' },
        { name: 'classic', displayName: 'Classic', file: 'assets/sounds/classic.wav' },
        { name: 'click', displayName: 'Click', file: 'assets/sounds/Click.mp3' },
        { name: 'ding', displayName: 'Ding', file: 'assets/sounds/ding.wav' },
        { name: 'door_bell', displayName: 'Door Bell', file: 'assets/sounds/door_bell.wav' },
        { name: 'double_pulse', displayName: 'Double Pulse', file: 'assets/sounds/double_pulse.wav' },
        { name: 'fast_beep_long', displayName: 'Fast Beep Long', file: 'assets/sounds/fast_beep_long.wav' },
        { name: 'fast_beep_short', displayName: 'Fast Beep Short', file: 'assets/sounds/fast_beep_short.wav' },
        { name: 'five_beep', displayName: 'Five Beep', file: 'assets/sounds/five_beep.wav' },
        { name: 'mdc_1200', displayName: 'MDC-1200', file: 'assets/sounds/MDC-1200.mp3' },
        { name: 'modern', displayName: 'Modern', file: 'assets/sounds/modern.wav' },
        { name: 'pluck', displayName: 'Pluck', file: 'assets/sounds/pluck.wav' },
        { name: 'pop', displayName: 'Pop', file: 'assets/sounds/pop.wav' },
        { name: 'quick_beep', displayName: 'Quick Beep', file: 'assets/sounds/quick_beep.wav' },
        { name: 'quiet', displayName: 'Quiet', file: 'assets/sounds/quiet.wav' },
        { name: 'relaxed', displayName: 'Relaxed', file: 'assets/sounds/relaxed.wav' },
        { name: 'settle_alert', displayName: 'Settle Alert', file: 'assets/sounds/settle_alert.wav' },
        { name: 'simple', displayName: 'Simple', file: 'assets/sounds/simple.wav' },
        { name: 'smoke_alarm', displayName: 'Smoke Alarm', file: 'assets/sounds/smoke_alarm.wav' },
        { name: 'startup', displayName: 'Startup', file: 'assets/sounds/startup.wav' },
        { name: 'tone', displayName: 'Tone', file: 'assets/sounds/tone.wav' },
    ];

    constructor() {
      // Load Volume
        const savedVolume = window?.localStorage?.getItem('rdio-scanner-volume');
        if (savedVolume !== null) {
            const parsed = Number(savedVolume);
            if (!Number.isNaN(parsed)) {
                this.volume = Math.min(Math.max(parsed / 100, 0), 1);
            }
        }
    }

    getAvailableSounds(): AlertSound[] {
        return this.sounds;
    }

    setVolume(volume: number): void {
        this.volume = Math.min(Math.max(volume, 0), 1);
        localStorage.setItem(
            'rdio-scanner-volume',
            Math.round(this.volume * 100).toString()
        );

        if (this.audio) {
            this.audio.volume = this.volume;
        }
    }





  playSound(name: string): void {
    this.stopSound();

    if (!name || name === 'none') return;

    //  Update Volume
    const savedVolume = localStorage.getItem('rdio-scanner-volume');
    if (savedVolume !== null) {
        const parsed = Number(savedVolume);
        if (!Number.isNaN(parsed)) {
            this.volume = Math.min(Math.max(parsed / 100, 0), 1);
        }
    }

    const sound = this.sounds.find(s => s.name === name);
    if (!sound?.file) return;

    this.audio = new Audio(sound.file);
    this.audio.volume = this.volume;
    this.audio.play().catch(() => {});
}


    stopSound(): void {
        if (this.audio) {
            this.audio.pause();
            this.audio.currentTime = 0;
            this.audio = null;
        }
    }

    previewSound(name: string): void {
        this.playSound(name);
    }
}
