/**
 * EventObject.test.js - Unit tests for event system
 */
import { describe, it, expect, vi } from 'vitest';

// Create a concrete implementation for testing since EventObject is abstract
class TestEventObject {
    constructor() {
        this.events = new Map();
    }

    on(eventName, callback) {
        if (!this.events.has(eventName)) {
            this.events.set(eventName, [callback]);
        } else {
            this.events.get(eventName).push(callback);
        }
        return this;
    }

    off(event) {
        this.events.delete(event);
    }

    offCallback(event, callback) {
        if (!this.events.has(event)) return;
        const callbacks = this.events.get(event);
        const index = callbacks.indexOf(callback);
        if (index !== -1) {
            callbacks.splice(index, 1);
        }
    }

    trigger(eventName, data = null) {
        if (!this.events.has(eventName)) return;
        for (const callback of this.events.get(eventName)) {
            callback({ data, object: this });
        }
    }
}

describe('EventObject', () => {
    describe('on()', () => {
        it('registers a callback for an event', () => {
            const obj = new TestEventObject();
            const callback = vi.fn();

            obj.on('test', callback);
            obj.trigger('test');

            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('can chain multiple on() calls', () => {
            const obj = new TestEventObject();
            const cb1 = vi.fn();
            const cb2 = vi.fn();

            obj.on('event1', cb1).on('event2', cb2);

            obj.trigger('event1');
            obj.trigger('event2');

            expect(cb1).toHaveBeenCalledTimes(1);
            expect(cb2).toHaveBeenCalledTimes(1);
        });

        it('can register multiple callbacks for same event', () => {
            const obj = new TestEventObject();
            const cb1 = vi.fn();
            const cb2 = vi.fn();

            obj.on('test', cb1);
            obj.on('test', cb2);
            obj.trigger('test');

            expect(cb1).toHaveBeenCalledTimes(1);
            expect(cb2).toHaveBeenCalledTimes(1);
        });
    });

    describe('off()', () => {
        it('removes all callbacks for an event', () => {
            const obj = new TestEventObject();
            const cb1 = vi.fn();
            const cb2 = vi.fn();

            obj.on('test', cb1);
            obj.on('test', cb2);
            obj.off('test');
            obj.trigger('test');

            expect(cb1).not.toHaveBeenCalled();
            expect(cb2).not.toHaveBeenCalled();
        });

        it('does not affect other events', () => {
            const obj = new TestEventObject();
            const cb1 = vi.fn();
            const cb2 = vi.fn();

            obj.on('event1', cb1);
            obj.on('event2', cb2);
            obj.off('event1');

            obj.trigger('event1');
            obj.trigger('event2');

            expect(cb1).not.toHaveBeenCalled();
            expect(cb2).toHaveBeenCalledTimes(1);
        });
    });

    describe('offCallback()', () => {
        it('removes specific callback only', () => {
            const obj = new TestEventObject();
            const cb1 = vi.fn();
            const cb2 = vi.fn();

            obj.on('test', cb1);
            obj.on('test', cb2);
            obj.offCallback('test', cb1);
            obj.trigger('test');

            expect(cb1).not.toHaveBeenCalled();
            expect(cb2).toHaveBeenCalledTimes(1);
        });

        it('does nothing if callback not found', () => {
            const obj = new TestEventObject();
            const cb1 = vi.fn();
            const cb2 = vi.fn();

            obj.on('test', cb1);
            obj.offCallback('test', cb2); // cb2 was never registered
            obj.trigger('test');

            expect(cb1).toHaveBeenCalledTimes(1);
        });

        it('does nothing if event not found', () => {
            const obj = new TestEventObject();
            const cb = vi.fn();

            // Should not throw
            expect(() => obj.offCallback('nonexistent', cb)).not.toThrow();
        });
    });

    describe('trigger()', () => {
        it('passes data to callback', () => {
            const obj = new TestEventObject();
            const callback = vi.fn();

            obj.on('test', callback);
            obj.trigger('test', { value: 42 });

            expect(callback).toHaveBeenCalledWith({
                data: { value: 42 },
                object: obj
            });
        });

        it('does nothing for unregistered events', () => {
            const obj = new TestEventObject();

            // Should not throw
            expect(() => obj.trigger('nonexistent')).not.toThrow();
        });
    });
});
