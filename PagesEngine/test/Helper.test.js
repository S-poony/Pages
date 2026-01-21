/**
 * Helper.test.js - Unit tests for geometry utility functions
 */
import { describe, it, expect } from 'vitest';
import { Helper } from '../src/Helper.ts';

describe('Helper', () => {
    describe('GetDistanceBetweenTwoPoint', () => {
        it('returns 0 for same point', () => {
            const point = { x: 5, y: 5 };
            expect(Helper.GetDistanceBetweenTwoPoint(point, point)).toBe(0);
        });

        it('calculates horizontal distance correctly', () => {
            const p1 = { x: 0, y: 0 };
            const p2 = { x: 10, y: 0 };
            expect(Helper.GetDistanceBetweenTwoPoint(p1, p2)).toBe(10);
        });

        it('calculates vertical distance correctly', () => {
            const p1 = { x: 0, y: 0 };
            const p2 = { x: 0, y: 10 };
            expect(Helper.GetDistanceBetweenTwoPoint(p1, p2)).toBe(10);
        });

        it('calculates diagonal distance correctly (3-4-5 triangle)', () => {
            const p1 = { x: 0, y: 0 };
            const p2 = { x: 3, y: 4 };
            expect(Helper.GetDistanceBetweenTwoPoint(p1, p2)).toBe(5);
        });
    });

    describe('GetSegmentLength', () => {
        it('calculates segment length correctly', () => {
            const segment = [{ x: 0, y: 0 }, { x: 3, y: 4 }];
            expect(Helper.GetSegmentLength(segment)).toBe(5);
        });

        it('returns 0 for zero-length segment', () => {
            const point = { x: 5, y: 5 };
            const segment = [point, point];
            expect(Helper.GetSegmentLength(segment)).toBe(0);
        });
    });

    describe('PointInRect', () => {
        const rect = { left: 0, top: 0, width: 100, height: 100 };

        it('returns point for point inside rect', () => {
            const point = { x: 50, y: 50 };
            expect(Helper.PointInRect(rect, point)).toEqual(point);
        });

        it('returns null for point outside rect (right)', () => {
            expect(Helper.PointInRect(rect, { x: 150, y: 50 })).toBeNull();
        });

        it('returns null for point outside rect (below)', () => {
            expect(Helper.PointInRect(rect, { x: 50, y: 150 })).toBeNull();
        });

        it('returns null for point outside rect (left)', () => {
            expect(Helper.PointInRect(rect, { x: -10, y: 50 })).toBeNull();
        });

        it('returns null for point outside rect (above)', () => {
            expect(Helper.PointInRect(rect, { x: 50, y: -10 })).toBeNull();
        });

        it('returns point for point on edge', () => {
            const point = { x: 0, y: 50 };
            expect(Helper.PointInRect(rect, point)).toEqual(point);
        });

        it('returns null for null input', () => {
            expect(Helper.PointInRect(rect, null)).toBeNull();
        });
    });

    describe('LimitPointToCircle', () => {
        it('returns same point if within circle', () => {
            const center = { x: 0, y: 0 };
            const point = { x: 3, y: 4 }; // distance = 5
            const result = Helper.LimitPointToCircle(center, 10, point);

            expect(result.x).toBe(3);
            expect(result.y).toBe(4);
        });

        it('limits point on circle edge if exactly at radius', () => {
            const center = { x: 0, y: 0 };
            const point = { x: 10, y: 0 }; // distance = 10
            const result = Helper.LimitPointToCircle(center, 10, point);

            expect(result.x).toBe(10);
            expect(result.y).toBe(0);
        });
    });
});
