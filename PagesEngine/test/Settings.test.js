/**
 * Settings.test.js - Unit tests for configuration
 */
import { describe, it, expect } from 'vitest';
import { Settings, SizeType, DisplayType } from '../src/Settings.ts';

// Base valid settings to avoid validation errors
const validBase = { width: 400, height: 600 };

describe('Settings', () => {
    describe('getSettings()', () => {
        it('applies default values for valid settings', () => {
            const settings = new Settings();
            const result = settings.getSettings(validBase);

            expect(result.startPage).toBe(0);
            expect(result.size).toBe(SizeType.FIXED);
            expect(result.flippingTime).toBe(1000);
            expect(result.usePortrait).toBe(true);
            expect(result.drawShadow).toBe(true);
        });

        it('uses provided values over defaults', () => {
            const settings = new Settings();
            const result = settings.getSettings({
                ...validBase,
                startPage: 5,
                flippingTime: 500,
                usePortrait: false
            });

            expect(result.startPage).toBe(5);
            expect(result.flippingTime).toBe(500);
            expect(result.usePortrait).toBe(false);
        });

        it('throws error for invalid width', () => {
            const settings = new Settings();

            expect(() => settings.getSettings({ width: 0, height: 600 })).toThrow('Invalid width or height');
            expect(() => settings.getSettings({ width: -100, height: 600 })).toThrow('Invalid width or height');
        });

        it('throws error for invalid height', () => {
            const settings = new Settings();

            expect(() => settings.getSettings({ width: 400, height: 0 })).toThrow('Invalid width or height');
            expect(() => settings.getSettings({ width: 400, height: -100 })).toThrow('Invalid width or height');
        });

        it('throws error for invalid flippingTime', () => {
            const settings = new Settings();

            expect(() => settings.getSettings({ ...validBase, flippingTime: 0 })).toThrow('Invalid flipping time');
            expect(() => settings.getSettings({ ...validBase, flippingTime: -100 })).toThrow('Invalid flipping time');
        });

        it('accepts valid display type values', () => {
            const settings = new Settings();

            const doubleResult = settings.getSettings({ ...validBase, display: 'double' });
            expect(doubleResult.display).toBe(DisplayType.DOUBLE);

            const singleResult = settings.getSettings({ ...validBase, display: 'single' });
            expect(singleResult.display).toBe(DisplayType.SINGLE);
        });

        it('accepts valid size type values', () => {
            const settings = new Settings();

            const fixedResult = settings.getSettings({ ...validBase, size: 'fixed' });
            expect(fixedResult.size).toBe(SizeType.FIXED);

            const stretchResult = settings.getSettings({ ...validBase, size: 'stretch' });
            expect(stretchResult.size).toBe(SizeType.STRETCH);
        });
    });
});
